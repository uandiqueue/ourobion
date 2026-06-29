/**
 * Browser-capture + hardening tests (design §10.7) — node:test, run via tsx.
 *
 * NO network, NO real browser. A fake `ChromiumLauncher` returns canned HTML so
 * the non-browser bookkeeping (local path, file write, sha256, FullTextInfo) is
 * exercised offline. The retry/backoff + classification helpers are pure and
 * tested with injected sleep/random. Proves:
 *  - `isRetryableError` / `httpStatusOf`: 429 + 5xx + transient net retry; 4xx don't;
 *  - `retryWithBackoff`: retries then succeeds; gives up after `attempts`; does NOT
 *    retry a non-retryable error; backoff grows and is capped;
 *  - `htmlToText` strips scripts/styles/tags + decodes entities + collapses ws;
 *  - `captureLocalPath` / `encodeUidForFile`: fs-safe `<corpusDir>/html/<uid>.html`;
 *  - `captureHtml` (fake launcher): writes the HTML, returns a local StorageInfo
 *    locator content-addressed by sha256, and an `html` FullTextInfo; closes browser;
 *  - `defaultChromiumLauncher` throws the actionable "playwright not installed" error.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  isRetryableError,
  httpStatusOf,
  retryWithBackoff,
  backoffDelayMs,
  htmlToText,
  captureLocalPath,
  encodeUidForFile,
  sha256OfText,
  captureHtml,
  defaultChromiumLauncher,
  type ChromiumLauncher,
} from '../src/retrieval/capture.js';

// ── httpStatusOf / isRetryableError ─────────────────────────────────────────────

test('httpStatusOf reads status, statusCode, and the "HTTP NNN" message shape', () => {
  assert.equal(httpStatusOf({ status: 503 }), 503);
  assert.equal(httpStatusOf({ statusCode: 429 }), 429);
  assert.equal(httpStatusOf(new Error('HTTP 502 Bad Gateway for https://x/y')), 502);
  assert.equal(httpStatusOf(new Error('totally unrelated')), null);
  assert.equal(httpStatusOf('a string'), null);
});

test('isRetryableError: 429 + 5xx + transient net are retryable; other 4xx are not', () => {
  assert.equal(isRetryableError(new Error('HTTP 429 Too Many Requests for u')), true);
  assert.equal(isRetryableError(new Error('HTTP 500 for u')), true);
  assert.equal(isRetryableError(new Error('HTTP 503 for u')), true);
  assert.equal(isRetryableError({ status: 502 }), true);
  // transient network shapes
  assert.equal(isRetryableError(new Error('ECONNRESET')), true);
  assert.equal(isRetryableError(new Error('The operation was aborted (timeout)')), true);
  assert.equal(isRetryableError(new Error('fetch failed')), true);
  assert.equal(isRetryableError(new Error('getaddrinfo ENOTFOUND api.core.ac.uk')), true);
  // non-retryable
  assert.equal(isRetryableError(new Error('HTTP 404 Not Found for u')), false);
  assert.equal(isRetryableError(new Error('HTTP 401 Unauthorized for u')), false);
  assert.equal(isRetryableError(new Error('parse error: bad json')), false);
});

// ── retryWithBackoff ─────────────────────────────────────────────────────────────

test('retryWithBackoff: succeeds after transient failures', async () => {
  let calls = 0;
  const slept: number[] = [];
  const out = await retryWithBackoff(
    async () => {
      calls++;
      if (calls < 3) throw new Error('HTTP 503 for u');
      return 'ok';
    },
    { attempts: 5, sleep: async (ms) => void slept.push(ms), random: () => 0.5 },
  );
  assert.equal(out, 'ok');
  assert.equal(calls, 3);
  assert.equal(slept.length, 2); // two backoffs before the third (successful) try
});

test('retryWithBackoff: gives up after `attempts`, re-throws the last error', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error('HTTP 500 for u');
        },
        { attempts: 3, sleep: async () => undefined, random: () => 0.5 },
      ),
    /HTTP 500/,
  );
  assert.equal(calls, 3); // 1 try + 2 retries
});

test('retryWithBackoff: a non-retryable error throws immediately (no retry)', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error('HTTP 404 for u');
        },
        { attempts: 5, sleep: async () => undefined },
      ),
    /HTTP 404/,
  );
  assert.equal(calls, 1);
});

test('backoffDelayMs: exponential growth, capped, jitter applied deterministically', () => {
  const opts = { baseDelayMs: 500, maxDelayMs: 5_000, factor: 2, jitter: 0 };
  // No jitter (random irrelevant): 500, 1000, 2000, 4000, then capped at 5000.
  assert.equal(backoffDelayMs(0, opts, () => 0.5), 500);
  assert.equal(backoffDelayMs(1, opts, () => 0.5), 1000);
  assert.equal(backoffDelayMs(2, opts, () => 0.5), 2000);
  assert.equal(backoffDelayMs(3, opts, () => 0.5), 4000);
  assert.equal(backoffDelayMs(4, opts, () => 0.5), 5000); // 8000 capped
  assert.equal(backoffDelayMs(10, opts, () => 0.5), 5000); // still capped

  // Jitter at the extremes scales the (uncapped) base by 1±jitter.
  const j = { baseDelayMs: 1000, maxDelayMs: 100_000, factor: 2, jitter: 0.25 };
  assert.equal(backoffDelayMs(0, j, () => 0), 750); // 1 - 0.25
  assert.equal(backoffDelayMs(0, j, () => 1), 1250); // 1 + 0.25
});

// ── htmlToText ───────────────────────────────────────────────────────────────────

test('htmlToText: strips scripts/styles/tags, decodes entities, collapses whitespace', () => {
  const html = `
    <html><head><style>.x{color:red}</style><script>var a=1<2;</script></head>
    <body><h1>Title</h1><p>Hello&nbsp;world &amp; friends &lt;ok&gt;</p></body></html>`;
  assert.equal(htmlToText(html), 'Title Hello world & friends <ok>');
});

// ── path helpers ─────────────────────────────────────────────────────────────────

test('encodeUidForFile: makes DOIs/arxiv/corpus uids filesystem-safe', () => {
  assert.equal(encodeUidForFile('doi:10.1371/journal.pone.0001'), 'doi_10.1371_journal.pone.0001');
  assert.equal(encodeUidForFile('arxiv:hep-th/9901001'), 'arxiv_hep-th_9901001');
  assert.equal(encodeUidForFile('corpus:01H8XYZ'), 'corpus_01H8XYZ');
});

test('captureLocalPath: <corpusDir>/html/<encoded-uid>.html', () => {
  const p = captureLocalPath('/corpus', 'doi:10.1/x');
  assert.equal(p, join('/corpus', 'html', 'doi_10.1_x.html'));
});

test('sha256OfText matches node crypto', () => {
  const s = '<html>x</html>';
  const want = createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
  assert.equal(sha256OfText(s), want);
});

// ── captureHtml with a fake launcher (no real browser, no network) ───────────────

const SAMPLE_HTML =
  '<!DOCTYPE html><html><body><h1>Gut microbiome and hydration</h1>' +
  '<p>' +
  'A long full-text article body. '.repeat(20) +
  '</p></body></html>';

/** A fake Chromium launcher serving `bodyText` + `html`, recording `closed`. */
function fakeLauncher(opts: {
  html: string;
  bodyText: string;
  status?: number;
  closed: { value: boolean };
}): ChromiumLauncher {
  return async () => ({
    launch: async () => ({
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => ({ status: () => opts.status ?? 200 }),
          content: async () => opts.html,
          innerText: async () => opts.bodyText,
        }),
      }),
      close: async () => {
        opts.closed.value = true;
      },
    }),
  });
}

test('captureHtml: writes HTML to local cache + returns a local locator', async () => {
  const dir = join(tmpdir(), `ourobion-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const closed = { value: false };
  try {
    const bodyText = 'Gut microbiome and hydration ' + 'full text body. '.repeat(30);
    const res = await captureHtml('https://journals.plos.org/x', dir, 'doi:10.1371/x.y', {
      launcher: fakeLauncher({ html: SAMPLE_HTML, bodyText, closed }),
      retry: false,
    });

    // Storage is a LOCAL locator content-addressed by sha256 (§6 / §8).
    assert.equal(res.storage.kind, 'local');
    assert.equal(res.storage.localPath, join(dir, 'html', 'doi_10.1371_x.y.html'));
    assert.equal(res.storage.contentType, 'text/html; charset=utf-8');
    assert.equal(res.storage.sha256, sha256OfText(SAMPLE_HTML));
    assert.equal(res.storage.sizeBytes, Buffer.byteLength(SAMPLE_HTML, 'utf8'));

    // FullText method is 'html'; extracted because the body is long enough.
    assert.equal(res.fullText.method, 'html');
    assert.equal(res.fullText.extracted, true);
    assert.equal(res.fullText.charCount, res.text.length);

    // The HTML actually hit disk and round-trips.
    assert.ok(existsSync(res.localPath));
    assert.equal(readFileSync(res.localPath, 'utf8'), SAMPLE_HTML);

    // Browser was always closed (finally block).
    assert.equal(closed.value, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('captureHtml: a short body marks fullText not-extracted (charCount null)', async () => {
  const dir = join(tmpdir(), `ourobion-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const closed = { value: false };
  try {
    const res = await captureHtml('https://example.org/abstract-only', dir, 'doi:10.1/short', {
      launcher: fakeLauncher({ html: '<html><body>tiny</body></html>', bodyText: 'tiny', closed }),
      retry: false,
    });
    assert.equal(res.fullText.method, 'html');
    assert.equal(res.fullText.extracted, false);
    assert.equal(res.fullText.charCount, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('captureHtml: an HTTP 4xx navigation throws (terminal — orchestrator marks failed)', async () => {
  const dir = join(tmpdir(), `ourobion-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const closed = { value: false };
  try {
    await assert.rejects(
      () =>
        captureHtml('https://example.org/gone', dir, 'doi:10.1/gone', {
          launcher: fakeLauncher({ html: SAMPLE_HTML, bodyText: 'x', status: 404, closed }),
          retry: false,
        }),
      /HTTP 404/,
    );
    // Browser still closed despite the throw.
    assert.equal(closed.value, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('defaultChromiumLauncher: throws an actionable error when playwright is absent', async () => {
  // playwright is NOT a dependency of this tool, so the dynamic import fails.
  await assert.rejects(() => defaultChromiumLauncher(), /playwright not installed/);
});
