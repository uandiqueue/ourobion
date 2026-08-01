/**
 * PubMed discovery adapter tests (design §2, §10.3) — node:test, run via tsx.
 *
 * NO network: a stub SourceCtx serves the canned esearch JSON / efetch XML from
 * tests/fixtures/. Proves:
 *  - parseEsearchJson pulls the PMID id list;
 *  - parseEfetchXml maps each <PubmedArticle> → Candidate with correct
 *    identifiers (pmid always; doi normalized lowercase; pmcid canonical PMC…),
 *    authors (LastName ForeName + CollectiveName), venue, year (Year and the
 *    MedlineDate fallback), and joined labelled abstract;
 *  - discover() chains esearch→efetch, routes BOTH calls through ctx.limiter,
 *    consults the budget guard, sends api_key only when configured, and returns
 *    the mapped candidates;
 *  - an empty id list short-circuits before efetch.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { discover, parseEfetchXml, parseEsearchJson } from '../src/sources/discovery/pubmed.js';
import type {
  Config,
  FetchOptions,
  SourceCtx,
  SourceName,
  Seed,
  BudgetGuard,
  RateLimiter,
} from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, 'fixtures');
const esearchJson = readFileSync(resolve(FIX, 'pubmed-esearch.json'), 'utf8');
const efetchXml = readFileSync(resolve(FIX, 'pubmed-efetch.xml'), 'utf8');

const SEED: Seed = {
  topic: 'gut_microbiome',
  query: 'gut microbiome immune',
  topicTags: ['gut_microbiome'],
};

interface CallLog {
  source: SourceName;
  url: string;
  opts?: FetchOptions;
}

/** A no-op limiter that records the source of every scheduled call. */
function makeLimiter(scheduled: SourceName[]): RateLimiter {
  return {
    schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T> {
      scheduled.push(source);
      return fn();
    },
  };
}

/** A budget guard spy that records every wouldExceed95/charge call. */
function makeBudget(charges: Array<{ source: SourceName; cost: number }>): BudgetGuard {
  return {
    wouldExceed95(_source: SourceName, _cost: number): boolean {
      return false;
    },
    charge(source: SourceName, cost: number): void {
      charges.push({ source, cost });
    },
    spent(_source: SourceName): number {
      return 0;
    },
  };
}

function makeConfig(ncbi?: string): Config {
  return {
    contactEmail: 'jayden@airap.com.sg',
    keys: {
      openalex: 'oa-key',
      r2Endpoint: 'https://r2.example',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
      ncbi,
    },
    enabled: {
      crossref: true,
      pubmed: true,
      europepmc: true,
      arxiv: true,
      s2: false,
      doaj: true,
      biorxiv: true,
      lens: false,
      openalex: true,
      unpaywall: true,
      pmc: true,
      directOa: true,
      core: false,
    },
  };
}

/**
 * Build a stub SourceCtx whose fetch helpers return fixtures keyed by URL
 * substring. Records every call (source + url + opts) for assertions. Routes
 * through the (stub) limiter exactly like the real ctx would.
 */
function makeCtx(opts: {
  ncbi?: string;
  esearch: string;
  efetch: string;
  calls: CallLog[];
  scheduled: SourceName[];
  charges: Array<{ source: SourceName; cost: number }>;
}): SourceCtx {
  const config = makeConfig(opts.ncbi);
  const limiter = makeLimiter(opts.scheduled);
  const budget = makeBudget(opts.charges);

  function route<T>(source: SourceName, url: string, o: FetchOptions | undefined, body: T): Promise<T> {
    opts.calls.push({ source, url, opts: o });
    return limiter.schedule(source, async () => body);
  }

  return {
    config,
    limiter,
    budget,
    fetchJson<T>(source: SourceName, url: string, o?: FetchOptions): Promise<T> {
      if (url.includes('esearch')) return route(source, url, o, JSON.parse(opts.esearch) as T);
      throw new Error(`unexpected fetchJson url: ${url}`);
    },
    fetchText(source: SourceName, url: string, o?: FetchOptions): Promise<string> {
      if (url.includes('efetch')) return route(source, url, o, opts.efetch) as Promise<string>;
      throw new Error(`unexpected fetchText url: ${url}`);
    },
    fetchBytes(_source: SourceName, url: string): Promise<Uint8Array> {
      throw new Error(`unexpected fetchBytes url: ${url}`);
    },
  };
}

test('parseEsearchJson returns the PMID id list', () => {
  const ids = parseEsearchJson(JSON.parse(esearchJson));
  assert.deepEqual(ids, ['38000001', '38000002', '38000003']);
});

test('parseEsearchJson tolerates a missing/empty result', () => {
  assert.deepEqual(parseEsearchJson({}), []);
  assert.deepEqual(parseEsearchJson({ esearchresult: {} }), []);
  assert.deepEqual(parseEsearchJson({ esearchresult: { idlist: [] } }), []);
});

test('parseEfetchXml maps articles → Candidates with full identifiers', () => {
  const cands = parseEfetchXml(efetchXml);
  assert.equal(cands.length, 3);

  const [a, b, c] = cands;

  // Article 1: structured abstract, two named authors, the FULL id set, Year.
  assert.ok(a);
  assert.equal(a.discoveredVia, 'pubmed');
  // Track C: pubmed/doi/pmc are ALL parsed off the ArticleIdList so dedup can link
  // disjoint-id variants up front (the PMCID was previously the gap).
  assert.deepEqual(Object.keys(a.identifiers).sort(), ['doi', 'pmcid', 'pmid']);
  assert.equal(a.identifiers.pmid, '38000001');
  assert.equal(a.identifiers.doi, '10.1038/s41577-024-00001-2'); // lowercased
  assert.equal(a.identifiers.pmcid, 'PMC11000001'); // canonical PMC form
  assert.equal(a.title, 'The gut microbiome shapes systemic immune responses.');
  assert.deepEqual(a.authors, ['Smith Jane A', 'Doe Richard']);
  assert.equal(a.venue, 'Nature Reviews Immunology');
  assert.equal(a.year, 2024);
  assert.equal(
    a.abstract,
    'BACKGROUND: The intestinal microbiota influences host immunity. ' +
      'RESULTS: Microbial metabolites modulate T-cell differentiation.',
  );

  // Article 2: MedlineDate year fallback, CollectiveName author, no PMCID,
  // single unlabelled abstract, venue from <Title> with an entity.
  assert.ok(b);
  assert.equal(b.identifiers.pmid, '38000002');
  assert.equal(b.identifiers.doi, '10.1016/j.chom.2023.00002');
  assert.equal(b.identifiers.pmcid, undefined);
  assert.deepEqual(b.authors, ['The MICRO Study Consortium']);
  assert.equal(b.venue, 'Cell Host & Microbe');
  assert.equal(b.year, 2023); // parsed out of "2023 Winter"
  assert.equal(b.abstract, 'A single unlabelled abstract paragraph with no structure.');

  // Article 3: no DOI, no abstract, ISOAbbreviation venue fallback.
  assert.ok(c);
  assert.equal(c.identifiers.pmid, '38000003');
  assert.equal(c.identifiers.doi, undefined);
  assert.equal(c.venue, 'J Infect Dis'); // ISOAbbreviation fallback
  assert.equal(c.year, 2022);
  assert.equal(c.abstract, null);
  assert.deepEqual(c.authors, ['Tan Wei']);
});

test('parseEfetchXml handles a single (non-array) PubmedArticle', () => {
  const single = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>99</PMID>
      <Article>
        <ArticleTitle>Solo.</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016449">Randomized Controlled Trial</PublicationType>
          <PublicationType UI="D016430">Multicenter Study</PublicationType>
        </PublicationTypeList>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName UI="D015331" MajorTopicYN="Y">Cohort Studies</DescriptorName></MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList><ArticleId IdType="pubmed">99</ArticleId></ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;
  const cands = parseEfetchXml(single);
  assert.equal(cands.length, 1);
  assert.equal(cands[0]?.identifiers.pmid, '99');
  assert.equal(cands[0]?.title, 'Solo.');
  assert.deepEqual(cands[0]?.publicationTypes, [
    { ui: 'D016449', name: 'Randomized Controlled Trial' },
    { ui: 'D016430', name: 'Multicenter Study' },
  ]);
  assert.deepEqual(cands[0]?.meshHeadings, [
    { ui: 'D015331', name: 'Cohort Studies', majorTopic: true },
  ]);
});

test('discover() chains esearch→efetch through the limiter + budget guard (keyed)', async () => {
  const calls: CallLog[] = [];
  const scheduled: SourceName[] = [];
  const charges: Array<{ source: SourceName; cost: number }> = [];
  const ctx = makeCtx({ ncbi: 'my-ncbi-key', esearch: esearchJson, efetch: efetchXml, calls, scheduled, charges });

  const cands = await discover(ctx, SEED);

  assert.equal(cands.length, 3);
  assert.equal(cands[0]?.identifiers.pmid, '38000001');

  // Exactly two outbound calls, both routed through the limiter for 'pubmed'.
  assert.equal(calls.length, 2);
  assert.deepEqual(scheduled, ['pubmed', 'pubmed']);

  // The budget guard was consulted on every call (no-op for unmetered pubmed).
  assert.ok(charges.length >= 2);
  assert.ok(charges.every((c) => c.source === 'pubmed'));

  // esearch carries term + retmode=json; efetch carries the joined ids + xml.
  const [search, fetchCall] = calls;
  assert.ok(search?.url.includes('esearch.fcgi'));
  assert.equal(search?.opts?.query?.term, SEED.query);
  assert.equal(search?.opts?.query?.retmode, 'json');
  assert.equal(search?.opts?.query?.api_key, 'my-ncbi-key'); // key forwarded

  assert.ok(fetchCall?.url.includes('efetch.fcgi'));
  assert.equal(fetchCall?.opts?.query?.id, '38000001,38000002,38000003');
  assert.equal(fetchCall?.opts?.query?.retmode, 'xml');
  assert.equal(fetchCall?.opts?.query?.email, 'jayden@airap.com.sg');
});

test('discover() omits api_key when no NCBI key is configured', async () => {
  const calls: CallLog[] = [];
  const ctx = makeCtx({
    ncbi: undefined,
    esearch: esearchJson,
    efetch: efetchXml,
    calls,
    scheduled: [],
    charges: [],
  });
  await discover(ctx, SEED);
  assert.equal(calls[0]?.opts?.query?.api_key, undefined);
});

test('discover() short-circuits (no efetch) when esearch returns no PMIDs', async () => {
  const calls: CallLog[] = [];
  const ctx = makeCtx({
    esearch: JSON.stringify({ esearchresult: { count: '0', idlist: [] } }),
    efetch: efetchXml,
    calls,
    scheduled: [],
    charges: [],
  });
  const cands = await discover(ctx, SEED);
  assert.deepEqual(cands, []);
  assert.equal(calls.length, 1); // only the esearch call happened
  assert.ok(calls[0]?.url.includes('esearch.fcgi'));
});
