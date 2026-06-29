/**
 * Browser capture (non-downloadable OA HTML) + retrieval hardening
 * (design §3 step 5b, §5 "Browser capture", §5b note, §10.7).
 *
 * Two concerns live here, both for the back of the retrieval pipeline:
 *
 * 1. **Browser capture** — for records classified `html` (full text only renders
 *    as an HTML article: PMC/PLoS/Frontiers/MDPI landing pages, §5b), where no OA
 *    PDF/JATS binary exists. We render the page with Playwright Chromium, save the
 *    rendered HTML to the local cache `<corpusDir>/html/<uid>.html` (design §6
 *    layout), extract its visible text, and return a `StorageInfo` *locator*
 *    (`kind:'local'`, `localPath`) plus a `FullTextInfo` (`method:'html'`). The
 *    bytes stay local (not R2) per §6 — browser-captured copies are the local
 *    cache tier; the manifest records the locator.
 *
 * 2. **Retry/backoff** — `retryWithBackoff` (exponential, jittered, retries on
 *    HTTP 429/5xx + transient network errors) for the runtime retrieval adapters
 *    (`arxivPdf`, `core`, `pmcJats`, `europepmcFulltext`) to wrap their fetches.
 *
 * ── Playwright is an OPTIONAL runtime dependency ────────────────────────────────
 * Playwright is NOT in `package.json` and is NOT needed for `tsc --noEmit` or
 * `npm install`. We therefore import it via a **dynamic** `await import('playwright')`
 * *inside* the capture function, behind a minimal locally-declared type for the
 * slice of the API we use. If the import fails (not installed), we throw a clear,
 * actionable error: install it with `npm i -D playwright` (+ `npx playwright install
 * chromium`). Nothing at module load time references playwright, so importing this
 * module — and the whole tool — works without playwright present.
 *
 * ── NETWORK DISCIPLINE / TESTS ──────────────────────────────────────────────────
 * The only live I/O is inside `captureHtml` (which launches a real browser) — that
 * path is never exercised by tests. Everything else (`retryWithBackoff`,
 * `isRetryableError`, `htmlToText`, `captureLocalPath`, the result-building) is pure
 * and unit-tested offline against in-memory inputs. `captureHtml` accepts an
 * injectable `launcher`/`now`/`sleep` so its non-browser bookkeeping (path, write,
 * sha256, FullTextInfo) is testable with a fake browser — no real Chromium, no net.
 *
 * ── ORCHESTRATOR CONTRACT (run.ts, §10.6/§10.7) ─────────────────────────────────
 * NOTE FOR THE ORCHESTRATOR: a capture/retrieval failure here must NOT abort the
 * run. Per design §10.7 the orchestrator catches the thrown error, appends
 * `errMsg(err)` to that record's `PaperRecord.errors[]`, sets `status:'failed'`,
 * and CONTINUES to the next paper. A budget hard-stop is the only clean stop (§5.1);
 * a transient capture error is a per-paper `failed`, not a run abort. `captureHtml`
 * and `retryWithBackoff` therefore THROW on terminal failure rather than swallowing
 * it, so the orchestrator owns the errors[]/status bookkeeping in one place.
 *
 * ESM / NodeNext — every import carries an explicit `.js` extension.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { StorageInfo, FullTextInfo } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal local Playwright types — the slice of the API we use, declared here so
// `playwright` is NOT a compile-time dependency (it is an optional runtime dep).
// These intentionally mirror playwright's real shapes for the calls we make.
// ─────────────────────────────────────────────────────────────────────────────

/** The `response` returned by `page.goto` — we only read its HTTP status. */
interface PwResponse {
  status(): number;
}

/** The slice of Playwright's `Page` we drive. */
interface PwPage {
  goto(
    url: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number },
  ): Promise<PwResponse | null>;
  /** Full rendered HTML of the document (`<!DOCTYPE html>…`). */
  content(): Promise<string>;
  /** `document.body.innerText` — the visible text, used as the extraction source. */
  innerText(selector: string): Promise<string>;
}

/** The slice of Playwright's `BrowserContext` we use. */
interface PwContext {
  newPage(): Promise<PwPage>;
}

/** The slice of Playwright's `Browser` we use. */
interface PwBrowser {
  newContext(opts?: { userAgent?: string }): Promise<PwContext>;
  close(): Promise<void>;
}

/** The slice of Playwright's `BrowserType` (chromium) we use. */
interface PwBrowserType {
  launch(opts?: { headless?: boolean }): Promise<PwBrowser>;
}

/**
 * A launcher yields a Chromium `BrowserType`. The default obtains it via a
 * dynamic `import('playwright')`; tests inject a fake to avoid a real browser.
 */
export type ChromiumLauncher = () => Promise<PwBrowserType>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Local-cache subdirectory for browser-captured HTML (design §6 layout). */
export const HTML_CACHE_SUBDIR = 'html';

/** A realistic desktop UA so publisher pages render their article HTML. */
const CAPTURE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Default navigation timeout for a capture (publisher pages can be slow). */
const DEFAULT_CAPTURE_TIMEOUT_MS = 45_000;

/** Below this many chars we treat the captured text as "no real full text". */
const MIN_CAPTURED_TEXT_CHARS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no browser, no network — unit-tested offline)
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase hex sha256 of a string's UTF-8 bytes (content-addressing, §6). */
export function sha256OfText(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

/**
 * Local path a paper's captured HTML is written to:
 *   `<corpusDir>/html/<uid>.html`  (design §6 local-cache layout).
 * The uid is sanitised for the filesystem (DOIs/arXiv ids contain `/` and `:`),
 * keeping a stable, collision-free name per uid.
 */
export function captureLocalPath(corpusDir: string, paperUid: string): string {
  return join(corpusDir, HTML_CACHE_SUBDIR, `${encodeUidForFile(paperUid)}.html`);
}

/**
 * Filesystem-safe encoding of a `paper_uid` for a filename. `paper_uid`s look
 * like `doi:10.1/x.y`, `arxiv:hep-th/9901001`, `corpus:01H…` — the `:` and `/`
 * are illegal/awkward in paths, so map them to `_`. Reversibility isn't needed
 * (the manifest holds the real uid); we only need a stable, unique-per-uid name.
 */
export function encodeUidForFile(paperUid: string): string {
  return paperUid.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * Reduce rendered HTML to plain text. Prefer the browser-provided `innerText`
 * (already whitespace-sane visible text); when only raw HTML is available, strip
 * `<script>`/`<style>` blocks and tags, decode the few common entities, and
 * collapse whitespace. Pure — used both inside `captureHtml` and by callers/tests.
 */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  const decoded = decodeBasicEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

/** Decode the handful of HTML entities that survive a tag strip. */
function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry / backoff (for the runtime retrieval adapters — design §10.7)
// ─────────────────────────────────────────────────────────────────────────────

/** Tunables for {@link retryWithBackoff}. */
export interface RetryOptions {
  /** total attempts including the first (default 4 → 1 try + 3 retries). */
  attempts?: number;
  /** base delay in ms for the first backoff (default 500). */
  baseDelayMs?: number;
  /** cap on any single backoff delay in ms (default 30_000). */
  maxDelayMs?: number;
  /** multiplicative growth factor per retry (default 2 → exponential). */
  factor?: number;
  /** jitter fraction in [0,1]; delay is scaled by 1±jitter (default 0.25). */
  jitter?: number;
  /** classify whether an error is worth retrying (default {@link isRetryableError}). */
  isRetryable?: (err: unknown) => boolean;
  /** injectable sleep (deterministic tests); default setTimeout-based. */
  sleep?: (ms: number) => Promise<void>;
  /** injectable RNG in [0,1) for jitter (deterministic tests); default Math.random. */
  random?: () => number;
  /** optional per-retry hook (logging): called with attempt index + the delay. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

/** An error carrying an HTTP status — what `rawFetch` throws look like. */
interface MaybeHttpError {
  status?: number;
  statusCode?: number;
  message?: string;
}

/**
 * Pull an HTTP status code out of an error, if it has one. Handles an explicit
 * `status`/`statusCode` field and the `rawFetch` message shape
 * (`"HTTP 503 … for <url>"`) used by the orchestrator's fetch helpers.
 */
export function httpStatusOf(err: unknown): number | null {
  if (typeof err === 'object' && err !== null) {
    const e = err as MaybeHttpError;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (typeof e.message === 'string') {
      const m = /\bHTTP\s+(\d{3})\b/.exec(e.message);
      if (m && m[1] !== undefined) return Number(m[1]);
    }
  }
  return null;
}

/**
 * Whether an error should be retried with backoff (design §10.7 — retry on
 * 429/5xx). Returns true for:
 *  - HTTP 429 (rate limited) and any 5xx (server/transient),
 *  - transient network errors (abort/timeout, ECONNRESET/ETIMEDOUT/ENOTFOUND,
 *    fetch's generic "fetch failed").
 * Returns false for 4xx other than 429 (a 404/401 won't fix itself on retry).
 */
export function isRetryableError(err: unknown): boolean {
  const status = httpStatusOf(err);
  if (status !== null) return status === 429 || (status >= 500 && status <= 599);

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('aborterror') ||
    msg.includes('aborted') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  );
}

/** Default async sleep (real timers). */
function realSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Compute the backoff delay (ms) before the retry that follows a given
 * zero-based attempt index: `base * factor^attempt`, capped at `maxDelayMs`,
 * then scaled by jitter `1 ± (jitter * (2*rand - 1))`. Exported for testing.
 */
export function backoffDelayMs(
  attempt: number,
  opts: Required<Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'factor' | 'jitter'>>,
  random: () => number,
): number {
  const raw = opts.baseDelayMs * Math.pow(opts.factor, attempt);
  const capped = Math.min(raw, opts.maxDelayMs);
  const jitterScale = 1 + opts.jitter * (2 * random() - 1);
  return Math.max(0, Math.round(capped * jitterScale));
}

/**
 * Run `fn`, retrying on retryable errors with exponential, jittered backoff
 * (design §10.7). Retrieval adapters wrap their network call in this so a 429/5xx
 * or transient socket error is retried a few times before the orchestrator marks
 * the paper `failed`. A non-retryable error (e.g. HTTP 404) throws immediately —
 * no point waiting. The final attempt's error is re-thrown unchanged so the
 * orchestrator can record it in `PaperRecord.errors[]`.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 4);
  const resolved = {
    baseDelayMs: options.baseDelayMs ?? 500,
    maxDelayMs: options.maxDelayMs ?? 30_000,
    factor: options.factor ?? 2,
    jitter: Math.min(1, Math.max(0, options.jitter ?? 0.25)),
  };
  const isRetryable = options.isRetryable ?? isRetryableError;
  const sleep = options.sleep ?? realSleep;
  const random = options.random ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts - 1;
      if (isLast || !isRetryable(err)) throw err;
      const delayMs = backoffDelayMs(attempt, resolved, random);
      options.onRetry?.({ attempt: attempt + 1, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  // Unreachable (the loop either returns or throws), but satisfies the type.
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser capture (live — never exercised by tests; uses dynamic playwright)
// ─────────────────────────────────────────────────────────────────────────────

/** What a successful capture yields — the manifest patch + the saved location. */
export interface CaptureResult {
  /** locator for the local HTML cache copy (`kind:'local'`, design §6 / §8). */
  storage: StorageInfo;
  /** extraction outcome — `method:'html'` (design §8 FullTextInfo). */
  fullText: FullTextInfo;
  /** the absolute local path the HTML was written to. */
  localPath: string;
  /** the rendered HTML (returned for the caller's convenience; also on disk). */
  html: string;
  /** the extracted visible text. */
  text: string;
}

/** Options for {@link captureHtml}. */
export interface CaptureOptions {
  /** navigation timeout in ms (default 45_000). */
  timeoutMs?: number;
  /** inject a Chromium launcher (tests / custom); default = dynamic playwright. */
  launcher?: ChromiumLauncher;
  /** `Date.now`-style clock for `fetchedAt`-adjacent bookkeeping; default Date.now. */
  now?: () => number;
  /** wrap the navigation in {@link retryWithBackoff}; default true (429/5xx retry). */
  retry?: boolean;
  /** retry tunables forwarded to {@link retryWithBackoff} when `retry` is true. */
  retryOptions?: RetryOptions;
  /** optional logger for diagnostics (no secrets). */
  log?: (line: string) => void;
}

/**
 * Default launcher: dynamically import Playwright's Chromium. Kept in its own
 * function so the `import('playwright')` is reached ONLY when a capture actually
 * runs — never at module load, never under `tsc`/`npm install`. Throws a clear,
 * actionable error when playwright is not installed.
 */
export const defaultChromiumLauncher: ChromiumLauncher = async () => {
  try {
    // Dynamic import: playwright is an OPTIONAL runtime dep (not in package.json).
    // The specifier is held in a `string` variable so TypeScript does NOT try to
    // statically resolve the (absent) 'playwright' module during `tsc --noEmit` —
    // resolution happens only at runtime, when capture actually runs.
    const specifier: string = 'playwright';
    const mod = (await import(specifier)) as { chromium: PwBrowserType };
    return mod.chromium;
  } catch {
    throw new Error(
      'playwright not installed — run `npm i -D playwright` and ' +
        '`npx playwright install chromium` to enable browser capture (§5b / §10.7).',
    );
  }
};

/**
 * Capture a non-downloadable OA HTML article (design §3-5b, §5b, §10.7).
 *
 * Renders `url` with Playwright Chromium, writes the rendered HTML to
 * `<corpusDir>/html/<uid>.html` (local cache, §6), extracts its visible text, and
 * returns a {@link CaptureResult} whose `storage` is a LOCAL locator (`kind:'local'`,
 * `localPath`, `sha256`, `sizeBytes`) and whose `fullText` is `method:'html'`.
 *
 * Throws (rather than returning null) on a terminal failure — Playwright missing,
 * an HTTP error status, an empty/too-short body. The orchestrator catches it and
 * records `errors[]` + `status:'failed'` for this paper, then continues (§10.7).
 *
 * No `null` "fall-through" path: capture is the LAST retrieval route (§3), so a
 * failure here is genuinely a per-paper failure, not "try the next source".
 */
export async function captureHtml(
  url: string,
  corpusDir: string,
  paperUid: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const launcher = options.launcher ?? defaultChromiumLauncher;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS;
  const useRetry = options.retry ?? true;
  const log = options.log;

  const chromium = await launcher();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: CAPTURE_USER_AGENT });
    const page = await context.newPage();

    const navigate = async (): Promise<void> => {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
      // A null response can happen for about:blank-ish navigations; treat as error.
      if (resp === null) throw new Error(`capture: no response navigating to ${url}`);
      const status = resp.status();
      if (status >= 400) {
        // Throw an HTTP-shaped error so `isRetryableError` classifies 429/5xx.
        throw new Error(`HTTP ${status} navigating to ${url}`);
      }
    };

    if (useRetry) {
      await retryWithBackoff(navigate, options.retryOptions);
    } else {
      await navigate();
    }

    const html = await page.content();
    // Prefer the browser's visible-text extraction; fall back to stripping HTML.
    let text: string;
    try {
      text = (await page.innerText('body')).replace(/\s+/g, ' ').trim();
      if (text.length === 0) text = htmlToText(html);
    } catch {
      text = htmlToText(html);
    }

    if (html.trim().length === 0) {
      throw new Error(`capture: empty document for ${url}`);
    }

    const localPath = captureLocalPath(corpusDir, paperUid);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, html, 'utf8');
    log?.(`capture: saved ${url} → ${localPath} (${text.length} chars)`);

    const extracted = text.length >= MIN_CAPTURED_TEXT_CHARS;
    const storage: StorageInfo = {
      kind: 'local',
      localPath,
      contentType: 'text/html; charset=utf-8',
      sizeBytes: Buffer.byteLength(html, 'utf8'),
      sha256: sha256OfText(html),
    };
    const fullText: FullTextInfo = {
      extracted,
      method: 'html',
      charCount: extracted ? text.length : null,
    };

    return { storage, fullText, localPath, html, text };
  } finally {
    // Always release Chromium — a leaked browser would wedge a multi-day run.
    await browser.close();
  }
}

export default captureHtml;
