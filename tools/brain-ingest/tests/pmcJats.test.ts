/**
 * PMC JATS retrieval adapter tests (design §5, §10.5) — node:test, run via tsx.
 *
 * NO network: a stub SourceCtx serves the canned fixture XML and records which
 * URLs were requested. Proves:
 *  - PMCID normalisation (PMC.../pmc.../bare digits/garbage);
 *  - parseJats char-counts the <body> and rejects a non-article envelope;
 *  - retrieve() returns a manifest-shaped {storage, fullText} with method:'jats';
 *  - retrieveJats() also returns the in-band {kind:'jats', xml} envelope;
 *  - a record with no PMCID → null (caller falls through);
 *  - efetch error envelope → falls back to the OA web service;
 *  - a budget guard that denies → null, no fetch issued;
 *  - every fetch routed through the source 'pmc'.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  retrieve,
  retrieveJats,
  normalizePmcid,
  parseJats,
} from '../src/retrieval/pmcJats.js';
import type {
  PaperRecord,
  SourceCtx,
  SourceName,
  FetchOptions,
  OaInfo,
} from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const GOOD_JATS = readFileSync(join(FIXTURES, 'pmc-efetch-PMC1234567.xml'), 'utf8');
const ERROR_XML = readFileSync(join(FIXTURES, 'pmc-efetch-error.xml'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Stub SourceCtx — answers fetchText from a URL→body map, records calls.
// ─────────────────────────────────────────────────────────────────────────────

interface CallLog {
  source: SourceName;
  url: string;
}

interface StubOptions {
  /** Map matched by substring of the request URL → response body (or Error to throw). */
  routes: Array<{ match: string; body: string | Error }>;
  /** When set, wouldExceed95 returns true and charge throws (budget deny). */
  deny?: boolean;
}

function makeCtx(opts: StubOptions): { ctx: SourceCtx; calls: CallLog[]; charged: number[] } {
  const calls: CallLog[] = [];
  const charged: number[] = [];

  const fetchText = async (
    source: SourceName,
    url: string,
    _o?: FetchOptions,
  ): Promise<string> => {
    calls.push({ source, url });
    for (const r of opts.routes) {
      if (url.includes(r.match)) {
        if (r.body instanceof Error) throw r.body;
        return r.body;
      }
    }
    throw new Error(`no stub route for ${url}`);
  };

  const ctx: SourceCtx = {
    // config is unused by this adapter; cast a minimal stub.
    config: {} as SourceCtx['config'],
    limiter: { schedule: async (_s, fn) => fn() },
    budget: {
      wouldExceed95: () => opts.deny === true,
      charge: (_s, cost) => {
        if (opts.deny === true) throw new Error('95% hard stop');
        charged.push(cost);
      },
      spent: () => 0,
    },
    fetchJson: async <T,>() => {
      throw new Error('fetchJson must not be called by pmcJats');
    },
    fetchText,
    fetchBytes: async () => {
      throw new Error('fetchBytes must not be called by pmcJats (JATS is text)');
    },
  };

  return { ctx, calls, charged };
}

const OA_CLOSED: OaInfo = {
  isOa: false,
  status: 'unknown',
  bestOaUrl: null,
  license: null,
  version: null,
};

function recordWithPmcid(pmcid: string | undefined): PaperRecord {
  return {
    paperUid: 'pmcid:PMC1234567',
    identifiers: pmcid === undefined ? {} : { pmcid },
    title: 'Short-chain fatty acids and the gut-brain axis',
    authors: [],
    year: 2026,
    venue: 'Journal of Gut Microbiome Research',
    abstract: null,
    discoveredVia: 'pubmed',
    topicTags: ['gut_microbiome'],
    oa: OA_CLOSED,
    retrievability: 'html',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-unit tests
// ─────────────────────────────────────────────────────────────────────────────

test('normalizePmcid accepts PMC.../pmc.../prefixed/bare and rejects garbage', () => {
  assert.deepEqual(normalizePmcid('PMC1234567'), { numeric: '1234567', canonical: 'PMC1234567' });
  assert.deepEqual(normalizePmcid('pmc1234567'), { numeric: '1234567', canonical: 'PMC1234567' });
  assert.deepEqual(normalizePmcid('pmcid:PMC1234567'), {
    numeric: '1234567',
    canonical: 'PMC1234567',
  });
  assert.deepEqual(normalizePmcid('1234567'), { numeric: '1234567', canonical: 'PMC1234567' });
  assert.equal(normalizePmcid(undefined), null);
  assert.equal(normalizePmcid(''), null);
  assert.equal(normalizePmcid('not-an-id'), null);
});

test('parseJats char-counts the <body> of a real JATS article', () => {
  const r = parseJats(GOOD_JATS);
  assert.equal(r.usable, true);
  assert.ok(r.charCount > 50, `expected substantial body text, got ${r.charCount}`);
  // Body text only — must not include the journal title from <front>.
  // (sanity: count is far below the whole-document length)
  assert.ok(r.charCount < GOOD_JATS.length);
});

test('parseJats rejects a non-article envelope (E-utils error)', () => {
  assert.deepEqual(parseJats(ERROR_XML), { usable: false, charCount: 0 });
  assert.deepEqual(parseJats(''), { usable: false, charCount: 0 });
  assert.deepEqual(parseJats('   '), { usable: false, charCount: 0 });
  assert.deepEqual(parseJats('<<<not xml'), { usable: false, charCount: 0 });
});

// ─────────────────────────────────────────────────────────────────────────────
// retrieve() / retrieveJats() with the stub ctx
// ─────────────────────────────────────────────────────────────────────────────

test('retrieve() returns a jats-method manifest patch from efetch', async () => {
  const { ctx, calls, charged } = makeCtx({
    routes: [{ match: 'efetch.fcgi', body: GOOD_JATS }],
  });
  const out = await retrieve(ctx, recordWithPmcid('PMC1234567'));
  assert.ok(out != null);
  assert.equal(out.fullText.method, 'jats');
  assert.equal(out.fullText.extracted, true);
  assert.ok((out.fullText.charCount ?? 0) > 0);
  assert.equal(out.storage.kind, 'none');
  assert.equal(out.storage.contentType, 'application/xml');
  assert.ok((out.storage.sizeBytes ?? 0) > 0);

  // Routed through 'pmc' and charged the (zero) cost exactly once.
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.source, 'pmc');
  assert.ok(calls[0]?.url.includes('efetch.fcgi'));
  assert.deepEqual(charged, [0]);
});

test('retrieveJats() returns the in-band {kind:"jats", xml} envelope', async () => {
  const { ctx } = makeCtx({ routes: [{ match: 'efetch.fcgi', body: GOOD_JATS }] });
  const out = await retrieveJats(ctx, recordWithPmcid('PMC1234567'));
  assert.ok(out != null);
  assert.equal(out.jats.kind, 'jats');
  assert.equal(out.jats.xml, GOOD_JATS);
});

test('no PMCID → null (caller falls through), no fetch issued', async () => {
  const { ctx, calls } = makeCtx({ routes: [{ match: 'efetch.fcgi', body: GOOD_JATS }] });
  const out = await retrieve(ctx, recordWithPmcid(undefined));
  assert.equal(out, null);
  assert.equal(calls.length, 0);
});

test('efetch error envelope → falls back to the OA web service', async () => {
  const { ctx, calls } = makeCtx({
    routes: [
      { match: 'efetch.fcgi', body: ERROR_XML },
      { match: 'oa.fcgi', body: GOOD_JATS },
    ],
  });
  const out = await retrieve(ctx, recordWithPmcid('PMC1234567'));
  assert.ok(out != null);
  assert.equal(out.fullText.method, 'jats');
  // Both endpoints were tried, in order, both as source 'pmc'.
  assert.equal(calls.length, 2);
  assert.ok(calls[0]?.url.includes('efetch.fcgi'));
  assert.ok(calls[1]?.url.includes('oa.fcgi'));
  assert.ok(calls.every((c) => c.source === 'pmc'));
});

test('efetch network error → falls back to OA service', async () => {
  const { ctx, calls } = makeCtx({
    routes: [
      { match: 'efetch.fcgi', body: new Error('connection reset') },
      { match: 'oa.fcgi', body: GOOD_JATS },
    ],
  });
  const out = await retrieve(ctx, recordWithPmcid('PMC1234567'));
  assert.ok(out != null);
  assert.equal(calls.length, 2);
});

test('both endpoints fail → null', async () => {
  const { ctx } = makeCtx({
    routes: [
      { match: 'efetch.fcgi', body: ERROR_XML },
      { match: 'oa.fcgi', body: ERROR_XML },
    ],
  });
  const out = await retrieve(ctx, recordWithPmcid('PMC1234567'));
  assert.equal(out, null);
});

test('budget guard denial → null and no fetch issued, no charge', async () => {
  const { ctx, calls, charged } = makeCtx({
    routes: [{ match: 'efetch.fcgi', body: GOOD_JATS }],
    deny: true,
  });
  const out = await retrieve(ctx, recordWithPmcid('PMC1234567'));
  assert.equal(out, null);
  assert.equal(calls.length, 0);
  assert.deepEqual(charged, []);
});
