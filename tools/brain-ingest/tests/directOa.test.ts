/**
 * Direct OA-URL retrieval adapter tests — node:test, run via tsx.
 *
 * NO network: a fake `SourceCtx` serves bytes from an in-memory map and
 * records which source was scheduled through the limiter + charged to the
 * budget guard. Proves:
 *  - `looksLikePdf` detects the `%PDF` magic bytes and rejects everything else;
 *  - `fetchBestOaUrl` returns null when the record has no `bestOaUrl`;
 *  - the happy path fetches via the 'directOa' bucket, charges the (zero)
 *    budget, and returns the raw bytes for a genuine PDF response;
 *  - a non-PDF response (HTML landing page, empty body) returns null so the
 *    caller falls through to the next source;
 *  - a fetch failure (network error / non-2xx) returns null rather than throwing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { looksLikePdf, fetchBestOaUrl } from '../src/retrieval/directOa.js';
import type { PaperRecord, SourceCtx, SourceName, FetchOptions } from '../src/types.js';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const HTML_BYTES = new TextEncoder().encode('<!doctype html><html>not a pdf</html>');

/** A recording fake SourceCtx — no network; serves `body` (or throws) from `fetchBytes`. */
function makeCtx(behavior: { body?: Uint8Array; throws?: Error }): {
  ctx: SourceCtx;
  calls: { scheduled: SourceName[]; charged: Array<{ source: SourceName; cost: number }>; urls: string[] };
} {
  const calls = {
    scheduled: [] as SourceName[],
    charged: [] as Array<{ source: SourceName; cost: number }>,
    urls: [] as string[],
  };
  const ctx: SourceCtx = {
    config: {} as SourceCtx['config'],
    limiter: {
      schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T> {
        calls.scheduled.push(source);
        return fn();
      },
    },
    budget: {
      wouldExceed95: () => false,
      charge: (source: SourceName, cost: number) => {
        calls.charged.push({ source, cost });
      },
      spent: () => 0,
    },
    fetchJson<T>(): Promise<T> {
      throw new Error('fetchJson must not be called by directOa');
    },
    fetchText(): Promise<string> {
      throw new Error('fetchText must not be called by directOa');
    },
    fetchBytes(source: SourceName, url: string, _opts?: FetchOptions): Promise<Uint8Array> {
      calls.urls.push(url);
      return ctx.limiter.schedule(source, async () => {
        if (behavior.throws) throw behavior.throws;
        return behavior.body ?? new Uint8Array(0);
      });
    },
  };
  return { ctx, calls };
}

function recordWithBestOaUrl(bestOaUrl: string | null): PaperRecord {
  return {
    paperUid: 'doi:10.1234/test',
    identifiers: { doi: '10.1234/test' },
    title: 'A Test Paper',
    authors: ['A. Author'],
    year: 2026,
    venue: 'Test Journal',
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: ['sleep_hrv'],
    oa: { isOa: true, status: 'gold', bestOaUrl, license: 'cc-by', version: 'published' },
    retrievability: 'pdf',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

test('looksLikePdf: accepts the %PDF magic bytes, rejects everything else', () => {
  assert.equal(looksLikePdf(PDF_BYTES), true);
  assert.equal(looksLikePdf(HTML_BYTES), false);
  assert.equal(looksLikePdf(new Uint8Array(0)), false);
  assert.equal(looksLikePdf(new Uint8Array([0x25, 0x50])), false); // too short
});

test('fetchBestOaUrl: returns null when the record has no bestOaUrl', async () => {
  const { ctx, calls } = makeCtx({ body: PDF_BYTES });
  const out = await fetchBestOaUrl(ctx, recordWithBestOaUrl(null));
  assert.equal(out, null);
  assert.equal(calls.urls.length, 0, 'no fetch issued without a URL');
});

test('fetchBestOaUrl: happy path fetches via the directOa bucket and returns the bytes', async () => {
  const { ctx, calls } = makeCtx({ body: PDF_BYTES });
  const rec = recordWithBestOaUrl('https://example.org/papers/test.pdf');
  const out = await fetchBestOaUrl(ctx, rec);

  assert.deepEqual(out, PDF_BYTES);
  assert.deepEqual(calls.scheduled, ['directOa']);
  assert.deepEqual(calls.urls, ['https://example.org/papers/test.pdf']);
  assert.deepEqual(calls.charged, [{ source: 'directOa', cost: 0 }]);
});

test('fetchBestOaUrl: a non-PDF response (HTML landing page) falls through to null', async () => {
  const { ctx } = makeCtx({ body: HTML_BYTES });
  const out = await fetchBestOaUrl(ctx, recordWithBestOaUrl('https://example.org/landing'));
  assert.equal(out, null);
});

test('fetchBestOaUrl: an empty body falls through to null', async () => {
  const { ctx } = makeCtx({ body: new Uint8Array(0) });
  const out = await fetchBestOaUrl(ctx, recordWithBestOaUrl('https://example.org/empty'));
  assert.equal(out, null);
});

test('fetchBestOaUrl: a fetch failure (network error / 404) returns null, never throws', async () => {
  const { ctx } = makeCtx({ throws: new Error('HTTP 404 Not Found') });
  const out = await fetchBestOaUrl(ctx, recordWithBestOaUrl('https://example.org/gone'));
  assert.equal(out, null);
});
