/**
 * arXiv PDF retrieval adapter tests (design §10.5) — node:test, run via tsx.
 *
 * NO network: a fake `SourceCtx` serves bytes from the on-disk fixture and
 * records which source was scheduled through the limiter + charged to the
 * budget guard. Proves:
 *  - arXiv id normalization across new/old/prefixed/URL shapes (+ rejects junk);
 *  - `arxivPdfUrl` builds the canonical /pdf/<id>.pdf URL;
 *  - `retrieve` returns null when the record has no arXiv id (fall-through);
 *  - the happy path fetches via the 'arxiv' bucket, charges the budget, and
 *    returns an object StorageInfo content-addressed by sha256 with the right
 *    key, size, and contentType, plus an un-extracted pdf FullTextInfo;
 *  - an empty body throws.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  normalizeArxivId,
  arxivPdfUrl,
  arxivIdFromRecord,
  sha256Hex,
  fetchArxivPdf,
  retrieve,
} from '../src/retrieval/arxivPdf.js';
import type {
  PaperRecord,
  SourceCtx,
  SourceName,
  FetchOptions,
  Identifiers,
} from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'arxiv-2401.12345.pdf');
const PDF_BYTES = new Uint8Array(readFileSync(FIXTURE));
const PDF_SHA256 = createHash('sha256').update(PDF_BYTES).digest('hex');

/** A recording fake SourceCtx — no network; serves `body` from `fetchBytes`. */
function makeCtx(body: Uint8Array): {
  ctx: SourceCtx;
  calls: { scheduled: SourceName[]; charged: Array<{ source: SourceName; cost: number }>; urls: string[] };
} {
  const calls = {
    scheduled: [] as SourceName[],
    charged: [] as Array<{ source: SourceName; cost: number }>,
    urls: [] as string[],
  };
  const ctx: SourceCtx = {
    // config/limiter are not exercised by this adapter's tests beyond presence.
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
      throw new Error('fetchJson must not be called by arxivPdf');
    },
    fetchText(): Promise<string> {
      throw new Error('fetchText must not be called by arxivPdf');
    },
    fetchBytes(source: SourceName, url: string, _opts?: FetchOptions): Promise<Uint8Array> {
      calls.urls.push(url);
      // Route through the recording limiter, exactly like the real ctx would.
      return ctx.limiter.schedule(source, async () => body);
    },
  };
  return { ctx, calls };
}

function recordWith(identifiers: Identifiers): PaperRecord {
  return {
    paperUid: 'arxiv:2401.12345',
    identifiers,
    title: 'A Test Preprint',
    authors: ['A. Author'],
    year: 2024,
    venue: 'arXiv',
    abstract: null,
    discoveredVia: 'arxiv',
    topicTags: ['sleep_hrv'],
    oa: { isOa: true, status: 'green', bestOaUrl: null, license: null, version: 'submitted' },
    retrievability: 'pdf',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

test('normalizeArxivId: accepts new/old/prefixed/URL shapes', () => {
  assert.equal(normalizeArxivId('2401.12345'), '2401.12345');
  assert.equal(normalizeArxivId('2401.12345v2'), '2401.12345v2');
  assert.equal(normalizeArxivId('  2401.12345 '), '2401.12345');
  assert.equal(normalizeArxivId('arXiv:2401.12345'), '2401.12345');
  assert.equal(normalizeArxivId('arxiv:2401.12345v3'), '2401.12345v3');
  // 5-digit serial (post-2015 high-volume months).
  assert.equal(normalizeArxivId('2401.123456'), null); // 6 digits is not valid
  assert.equal(normalizeArxivId('1501.00001'), '1501.00001');
  // Old scheme.
  assert.equal(normalizeArxivId('hep-th/9901001'), 'hep-th/9901001');
  assert.equal(normalizeArxivId('math.GT/0309136v1'), 'math.GT/0309136v1');
  assert.equal(normalizeArxivId('arXiv:hep-th/9901001'), 'hep-th/9901001');
  // Full URLs.
  assert.equal(normalizeArxivId('https://arxiv.org/abs/2401.12345v1'), '2401.12345v1');
  assert.equal(normalizeArxivId('https://arxiv.org/pdf/2401.12345.pdf'), '2401.12345');
  assert.equal(normalizeArxivId('http://arxiv.org/abs/hep-th/9901001'), 'hep-th/9901001');
});

test('normalizeArxivId: rejects junk / non-arxiv', () => {
  assert.equal(normalizeArxivId(undefined), null);
  assert.equal(normalizeArxivId(''), null);
  assert.equal(normalizeArxivId('   '), null);
  assert.equal(normalizeArxivId('10.1234/foo.bar'), null); // a DOI
  assert.equal(normalizeArxivId('not-an-id'), null);
  assert.equal(normalizeArxivId('2401.12'), null); // serial too short
});

test('arxivPdfUrl + arxivIdFromRecord', () => {
  assert.equal(arxivPdfUrl('2401.12345'), 'https://arxiv.org/pdf/2401.12345.pdf');
  assert.equal(arxivPdfUrl('hep-th/9901001'), 'https://arxiv.org/pdf/hep-th/9901001.pdf');
  assert.equal(arxivIdFromRecord(recordWith({ arxiv: 'arXiv:2401.12345v2' })), '2401.12345v2');
  assert.equal(arxivIdFromRecord(recordWith({ doi: '10.1/x' })), null);
});

test('sha256Hex matches node crypto over the fixture', () => {
  assert.equal(sha256Hex(PDF_BYTES), PDF_SHA256);
});

test('retrieve: returns null when the record has no arXiv id', async () => {
  const { ctx, calls } = makeCtx(PDF_BYTES);
  const out = await retrieve(ctx, recordWith({ doi: '10.1234/no-arxiv' }));
  assert.equal(out, null);
  // No fetch / no charge happened on the null path.
  assert.equal(calls.urls.length, 0);
  assert.equal(calls.charged.length, 0);
});

test('retrieve: happy path fetches via arxiv bucket and content-addresses the PDF', async () => {
  const { ctx, calls } = makeCtx(PDF_BYTES);
  const rec = recordWith({ arxiv: '2401.12345', doi: '10.1234/test' });
  const out = await retrieve(ctx, rec);

  assert.ok(out !== null);
  // Routed through the 'arxiv' limiter bucket and charged the (zero) budget.
  assert.deepEqual(calls.scheduled, ['arxiv']);
  assert.deepEqual(calls.charged, [{ source: 'arxiv', cost: 0 }]);
  assert.deepEqual(calls.urls, ['https://arxiv.org/pdf/2401.12345.pdf']);

  // StorageInfo: object, keyed by paper_uid under pdf/, content-addressed.
  assert.equal(out.storage.kind, 'object');
  assert.equal(out.storage.key, 'pdf/arxiv:2401.12345.pdf');
  assert.equal(out.storage.contentType, 'application/pdf');
  assert.equal(out.storage.sizeBytes, PDF_BYTES.byteLength);
  assert.equal(out.storage.sha256, PDF_SHA256);

  // FullText: not yet extracted here (extract.ts does that), method tagged pdf.
  assert.deepEqual(out.fullText, { extracted: false, method: 'pdf', charCount: null });
});

test('fetchArxivPdf: returns tagged bytes; throws on empty body', async () => {
  const { ctx } = makeCtx(PDF_BYTES);
  const res = await fetchArxivPdf(ctx, '2401.12345');
  assert.equal(res.kind, 'pdf');
  assert.equal(res.bytes.byteLength, PDF_BYTES.byteLength);

  const { ctx: emptyCtx } = makeCtx(new Uint8Array(0));
  await assert.rejects(() => fetchArxivPdf(emptyCtx, '2401.12345'), /empty body/);
});
