/**
 * arXiv discovery adapter tests (design §2, §10.3) — node:test, run via tsx.
 *
 * Pure-offline: parses a canned Atom fixture (NO network), and drives the
 * adapter through a stub SourceCtx that captures the call so we can assert it
 * routes through `ctx.fetchText('arxiv', …)` with the right query params and
 * never charges the (unmetered) budget.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  discover,
  parseArxivFeed,
  parseArxivId,
  parseYear,
} from '../src/sources/discovery/arxiv.js';
import type {
  Candidate,
  Config,
  FetchOptions,
  Seed,
  SourceCtx,
  SourceName,
} from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, 'fixtures', 'arxiv.query.xml'), 'utf8');

const SEED: Seed = {
  topic: 'sleep_hrv',
  query: 'heart rate variability',
  topicTags: ['sleep_hrv'],
};

// ─── A stub SourceCtx that records the fetchText call and serves the fixture ──

interface CapturedCall {
  source: SourceName;
  url: string;
  opts?: FetchOptions;
}

interface Stub {
  ctx: SourceCtx;
  calls: CapturedCall[];
  /** how many times ctx.budget.charge was invoked. */
  charges: { count: number };
}

function makeStubCtx(body: string): Stub {
  const calls: CapturedCall[] = [];
  const charges = { count: 0 };
  const ctx: SourceCtx = {
    config: {} as Config,
    limiter: {
      schedule: <T>(_source: SourceName, fn: () => Promise<T>) => fn(),
    },
    budget: {
      wouldExceed95: () => false,
      charge: () => {
        charges.count += 1;
      },
      spent: () => 0,
    },
    fetchText: async (source, url, opts) => {
      calls.push({ source, url, opts });
      return body;
    },
    fetchJson: async () => {
      throw new Error('arXiv adapter must not call fetchJson');
    },
    fetchBytes: async () => {
      throw new Error('arXiv adapter must not call fetchBytes');
    },
  };
  return { ctx, calls, charges };
}

// ─── Pure parser unit tests ───────────────────────────────────────────────────

test('parseArxivId strips URL prefix and version suffix (both id schemes)', () => {
  assert.equal(parseArxivId('http://arxiv.org/abs/2101.00001v2'), '2101.00001');
  assert.equal(parseArxivId('http://arxiv.org/abs/2101.00001'), '2101.00001');
  assert.equal(parseArxivId('http://arxiv.org/abs/cond-mat/0211045v1'), 'cond-mat/0211045');
  assert.equal(parseArxivId('https://arxiv.org/abs/2406.12345v10'), '2406.12345');
  assert.equal(parseArxivId(undefined), '');
  assert.equal(parseArxivId(''), '');
});

test('parseYear extracts the 4-digit year or null', () => {
  assert.equal(parseYear('2021-01-01T09:30:00Z'), 2021);
  assert.equal(parseYear('2002-11-21T12:00:00Z'), 2002);
  assert.equal(parseYear(undefined), null);
  assert.equal(parseYear('not-a-date'), null);
});

test('parseArxivFeed maps entries to normalized Candidates', () => {
  const candidates = parseArxivFeed(FIXTURE);
  assert.equal(candidates.length, 2);

  const first = candidates[0] as Candidate;
  assert.equal(first.identifiers.arxiv, '2101.00001'); // version stripped
  assert.equal(first.title, 'Heart Rate Variability as a Marker of Autonomic Recovery'); // whitespace normalized
  assert.deepEqual(first.authors, ['Ada Lovelace', 'Grace Hopper']); // author array
  assert.equal(first.year, 2021);
  assert.equal(first.venue, 'J. Physiol. Signals 12 (2021) 100-110'); // journal_ref preferred
  assert.equal(first.discoveredVia, 'arxiv');
  assert.ok(first.abstract && !/\n/.test(first.abstract)); // abstract normalized, no newlines

  const second = candidates[1] as Candidate;
  assert.equal(second.identifiers.arxiv, 'cond-mat/0211045'); // old-scheme id
  assert.deepEqual(second.authors, ['Alan Turing']); // single author coerced to array
  assert.equal(second.venue, 'arXiv'); // no journal_ref → default venue
  assert.equal(second.year, 2002);
});

test('parseArxivFeed tolerates an empty feed', () => {
  const empty = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';
  assert.deepEqual(parseArxivFeed(empty), []);
});

test('parseArxivFeed collapses a single-entry feed (parser returns object not array)', () => {
  const single =
    '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">' +
    '<entry><id>http://arxiv.org/abs/2406.99999v1</id>' +
    '<title>Lone Entry</title><published>2024-05-05T00:00:00Z</published>' +
    '<author><name>Solo Writer</name></author></entry></feed>';
  const candidates = parseArxivFeed(single);
  assert.equal(candidates.length, 1);
  assert.equal((candidates[0] as Candidate).identifiers.arxiv, '2406.99999');
});

// ─── Adapter wiring test ────────────────────────────────────────────────────

test('discover routes through ctx.fetchText("arxiv", …) and charges no budget', async () => {
  const { ctx, calls, charges } = makeStubCtx(FIXTURE);
  const candidates = await discover(ctx, SEED);

  assert.equal(candidates.length, 2);
  assert.equal(calls.length, 1);

  const call = calls[0] as CapturedCall;
  assert.equal(call.source, 'arxiv');
  assert.equal(call.url, 'http://export.arxiv.org/api/query');
  assert.equal(call.opts?.query?.search_query, 'all:heart rate variability');
  assert.ok((call.opts?.query?.max_results as number) > 0);

  // arXiv is unmetered → the adapter must not charge the budget guard.
  assert.equal(charges.count, 0);
});
