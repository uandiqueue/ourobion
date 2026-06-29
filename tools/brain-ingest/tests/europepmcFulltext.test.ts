/**
 * Europe PMC OA full-text adapter tests (design §2/§3/§10.5) — node:test, run via tsx.
 *
 * NO network: a stub SourceCtx serves canned fixture bodies keyed by URL and records
 * that every fetch routed through the limiter for the 'europepmc' source. Proves:
 *  - ref derivation prefers PMCID (→ PMC) then PMID (→ MED), else null;
 *  - the fullTextXML URL is built correctly;
 *  - the JATS sniff accepts a real <article> and rejects an HTML not-found page;
 *  - jatsTotext harvests title + abstract + body text;
 *  - retrieve() happy path → { storage(kind:'none', method jats), fullText extracted };
 *  - a body that is not on the OA subset (HTML error) → null (caller falls through);
 *  - a record with only a DOI (no PMCID/PMID) → null without any fetch;
 *  - a fetch that throws → null (source could not serve);
 *  - every dispatched call went through limiter.schedule('europepmc', …).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type {
  PaperRecord,
  SourceCtx,
  SourceName,
  FetchOptions,
  RateLimiter,
  BudgetGuard,
  Config,
} from '../src/types.js';

import {
  retrieve,
  fetchEuropePmcJats,
  europePmcRefFromIdentifiers,
  fullTextXmlUrl,
  looksLikeJats,
  jatsToText,
} from '../src/retrieval/europepmcFulltext.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const JATS_BODY = readFileSync(join(FIXTURES, 'europepmc-fulltext-PMC1234567.xml'), 'utf8');
const HTML_NOTFOUND = readFileSync(join(FIXTURES, 'europepmc-fulltext-notfound.html'), 'utf8');

// ── Stub SourceCtx ───────────────────────────────────────────────────────────

interface FetchLogEntry {
  source: SourceName;
  url: string;
}

/**
 * Build a SourceCtx whose text fetches resolve from a URL→body map. Any other
 * fetch path throws (proves the adapter only calls fetchText, never the network).
 * The limiter wraps every scheduled fn and records the source it ran under.
 */
function makeCtx(bodies: Map<string, string>): { ctx: SourceCtx; log: FetchLogEntry[] } {
  const log: FetchLogEntry[] = [];

  const limiter: RateLimiter = {
    schedule<T>(_source: SourceName, fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
  const budget: BudgetGuard = {
    wouldExceed95: () => false,
    charge: () => {
      throw new Error('europepmc is unmetered — charge must not be called');
    },
    spent: () => 0,
  };
  const config = {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'x',
      r2Endpoint: 'x',
      r2AccessKeyId: 'x',
      r2SecretAccessKey: 'x',
      r2Bucket: 'x',
    },
    enabled: {} as Config['enabled'],
  } as Config;

  const fetchText = (source: SourceName, url: string, _opts?: FetchOptions): Promise<string> => {
    log.push({ source, url });
    // Route through the limiter, exactly as the real ctx would.
    return limiter.schedule(source, async () => {
      const body = bodies.get(url);
      if (body === undefined) throw new Error(`HTTP 404 (no fixture for ${url})`);
      return body;
    });
  };

  const ctx: SourceCtx = {
    config,
    limiter,
    budget,
    fetchJson: <T>(): Promise<T> => {
      throw new Error('fetchJson must not be used by the JATS full-text adapter');
    },
    fetchText,
    fetchBytes: (): Promise<Uint8Array> => {
      throw new Error('fetchBytes must not be used by the JATS full-text adapter');
    },
  };
  return { ctx, log };
}

function recordWith(identifiers: PaperRecord['identifiers']): PaperRecord {
  return {
    paperUid: 'doi:10.1234/gut.2026.0001',
    identifiers,
    title: 'Short-chain fatty acids and gut barrier integrity',
    authors: ['A. Researcher'],
    year: 2026,
    venue: 'Journal of Gut Microbiome Studies',
    abstract: null,
    discoveredVia: 'europepmc',
    topicTags: ['gut_microbiome'],
    oa: { isOa: true, status: 'green', bestOaUrl: null, license: 'cc-by', version: 'published' },
    retrievability: 'html',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

// ── Pure helpers ───────────────────────────────────────────────────────────

test('europePmcRefFromIdentifiers prefers PMCID → PMC, then PMID → MED, else null', () => {
  assert.deepEqual(europePmcRefFromIdentifiers({ pmcid: 'PMC1234567' }), {
    source: 'PMC',
    id: '1234567',
  });
  // Both present → PMCID wins.
  assert.deepEqual(europePmcRefFromIdentifiers({ pmcid: 'PMC1234567', pmid: '999' }), {
    source: 'PMC',
    id: '1234567',
  });
  // PMID only → MED.
  assert.deepEqual(europePmcRefFromIdentifiers({ pmid: '30000001' }), {
    source: 'MED',
    id: '30000001',
  });
  // Various PMCID spellings normalize to the bare number.
  assert.deepEqual(europePmcRefFromIdentifiers({ pmcid: 'pmcid:PMC42' }), {
    source: 'PMC',
    id: '42',
  });
  // DOI / arXiv only → not addressable here.
  assert.equal(europePmcRefFromIdentifiers({ doi: '10.1/x' }), null);
  assert.equal(europePmcRefFromIdentifiers({ arxiv: '2401.00001' }), null);
  assert.equal(europePmcRefFromIdentifiers({}), null);
});

test('fullTextXmlUrl builds the REST path', () => {
  assert.equal(
    fullTextXmlUrl({ source: 'PMC', id: '1234567' }),
    'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC/1234567/fullTextXML',
  );
  assert.equal(
    fullTextXmlUrl({ source: 'MED', id: '30000001' }),
    'https://www.ebi.ac.uk/europepmc/webservices/rest/MED/30000001/fullTextXML',
  );
});

test('looksLikeJats accepts a JATS article, rejects HTML / empty', () => {
  assert.equal(looksLikeJats(JATS_BODY), true);
  assert.equal(looksLikeJats(HTML_NOTFOUND), false);
  assert.equal(looksLikeJats(''), false);
  assert.equal(looksLikeJats('<error><message>not found</message></error>'), false);
});

test('jatsToText harvests title + abstract + body text', () => {
  const text = jatsToText(JATS_BODY);
  assert.ok(text.includes('Short-chain fatty acids and gut barrier integrity'));
  assert.ok(text.includes('butyrate strengthens the intestinal epithelial barrier'));
  assert.ok(text.includes('reduced permeability by forty percent'));
  assert.ok(text.length > 100);
});

// ── fetchEuropePmcJats + retrieve ──────────────────────────────────────────

test('fetchEuropePmcJats returns the raw JATS for an OA-subset PMCID', async () => {
  const url = fullTextXmlUrl({ source: 'PMC', id: '1234567' });
  const { ctx, log } = makeCtx(new Map([[url, JATS_BODY]]));

  const jats = await fetchEuropePmcJats(ctx, recordWith({ pmcid: 'PMC1234567' }));
  assert.notEqual(jats, null);
  assert.equal(jats?.kind, 'jats');
  assert.equal(jats?.ref.source, 'PMC');
  assert.equal(jats?.ref.id, '1234567');
  assert.equal(jats?.xml, JATS_BODY);

  // Exactly one call, routed through the limiter for 'europepmc'.
  assert.equal(log.length, 1);
  assert.equal(log[0]?.source, 'europepmc');
  assert.equal(log[0]?.url, url);
});

test('retrieve happy path → storage(none, xml) + fullText(jats, extracted)', async () => {
  const url = fullTextXmlUrl({ source: 'PMC', id: '1234567' });
  const { ctx } = makeCtx(new Map([[url, JATS_BODY]]));

  const out = await retrieve(ctx, recordWith({ pmcid: 'PMC1234567' }));
  assert.notEqual(out, null);
  assert.equal(out?.storage.kind, 'none');
  assert.equal(out?.storage.contentType, 'application/xml');
  assert.ok((out?.storage.sizeBytes ?? 0) > 0);
  assert.equal(out?.fullText.extracted, true);
  assert.equal(out?.fullText.method, 'jats');
  assert.ok((out?.fullText.charCount ?? 0) > 100);
});

test('retrieve returns null when the body is not on the OA subset (HTML error)', async () => {
  const url = fullTextXmlUrl({ source: 'PMC', id: '1234567' });
  const { ctx, log } = makeCtx(new Map([[url, HTML_NOTFOUND]]));

  const out = await retrieve(ctx, recordWith({ pmcid: 'PMC1234567' }));
  assert.equal(out, null);
  // It did dispatch the call (and routed it through the limiter) before sniffing.
  assert.equal(log.length, 1);
  assert.equal(log[0]?.source, 'europepmc');
});

test('retrieve returns null without any fetch when the record has no PMCID/PMID', async () => {
  const { ctx, log } = makeCtx(new Map());
  const out = await retrieve(ctx, recordWith({ doi: '10.1234/gut.2026.0001' }));
  assert.equal(out, null);
  assert.equal(log.length, 0); // no addressable id → never hits the network
});

test('retrieve returns null when the fetch throws (source could not serve)', async () => {
  // Empty body map → fetchText throws a synthetic 404 for the built URL.
  const { ctx, log } = makeCtx(new Map());
  const out = await retrieve(ctx, recordWith({ pmcid: 'PMC9999999' }));
  assert.equal(out, null);
  assert.equal(log.length, 1); // it tried once, then swallowed the error
});
