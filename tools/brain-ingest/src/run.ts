/**
 * Orchestrator — the end-to-end pipeline (design §3 steps 1–7, §10.6).
 *
 * Wires the layers built in §10.1–§10.5 into one resumable run:
 *
 *   1. discover   — every enabled discovery adapter, for the chosen seed(s)
 *   2. resolve    — dedup candidates → canonical papers + `paper_uid` (§4)
 *   3. OA-locate  — OpenAlex batched list calls, Unpaywall per-DOI fallback (§5.1)
 *   4. classify   — retrievability (`pdf` | `html` | `paywalled` | `unknown`)
 *   5. retrieve   — pmcJats → europepmc → core → arxivPdf (first source that serves)
 *   6. extract    — JATS/PDF → plain text (§5)
 *   7. store      — bytes/JATS + extracted text → R2; finalise manifest record
 *
 * Guardrails honoured:
 *  - **Budget fail-closed (§5.1), PER SOURCE not per run:** each metered adapter
 *    (currently only CORE, `src/retrieval/core.ts`) asks its own budget guard
 *    `wouldExceed95` before dispatching and returns `null` — never throws — once
 *    at its hard-stop line, so a paper stays `status:'discovered'` (NEVER
 *    `'failed'`) rather than being marked unretrievable. Deliberately NOT a
 *    whole-run early-exit: the free, unmetered steps ahead of CORE (PMC JATS,
 *    Europe PMC, arXiv, the direct-OA-URL fetch) never touch CORE's budget, so a
 *    capped CORE must not stop the run from still serving those papers — only
 *    CORE itself declines. The run finishes its `--limit` batch normally; the
 *    tallies below report whether any metered source ended the run at its cap
 *    (`budgetStopped`) and how many papers are left `discovered` (`deferred`),
 *    purely informational — resume tomorrow to pick up whatever CORE couldn't
 *    reach today.
 *  - **Resumable:** a paper already `status:'fetched'` is skipped on re-run.
 *  - **Dry run:** `--dry-run` plans (discover + resolve + classify) and writes the
 *    `discovered` records, but issues no retrieval / R2 calls.
 *  - **Host-memory guard (opt-in via `opts.memoryGuard`, `limits/memoryGuard.ts`):**
 *    before each retrieval attempt, pause briefly if the HOST MACHINE (not this
 *    process) is critically low on free RAM, then proceed regardless — a
 *    considerate pause, never a reason to leave a paper unfetched. The CLI
 *    enables this for real `ingest`/`resume` runs; `run()` callers (tests) that
 *    omit it get no memory checking at all.
 *
 * Network discipline: all HTTP routes through a {@link SourceCtx} whose fetch
 * helpers run inside the per-source rate limiter; adapters charge the budget
 * guard themselves. This module touches the network only via that ctx and R2 —
 * never in a path tests exercise (tests target the pure adapter helpers + the
 * manifest/seeds, against fixtures).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type {
  Config,
  SourceCtx,
  SourceName,
  RateLimiter,
  BudgetGuard,
  FetchOptions,
  Candidate,
  PaperRecord,
  OaInfo,
  WorkMeta,
  Retrievability,
  StorageInfo,
  FullTextInfo,
  Seed,
} from './types.js';

import { loadConfig } from './config.js';
import { createRateLimiter } from './limits/rateLimiter.js';
import { createBudgetGuard } from './limits/budget.js';
import { resolveDedup, reconcileByIdentifiers, mergeIdentifiers, normalizeIdentifiers } from './identity.js';
import { SEEDS, seedByTopic, SEED_TOPICS } from './seeds.js';
import { Manifest, parseJsonl, type ManifestSummary } from './manifest.js';
import { R2Store, pdfKey, jatsKey, textKey, sha256, MANIFEST_KEY, metaKey } from './storage/r2.js';
import { extractFromPdf, extractFromJats } from './extract.js';

// Discovery adapters (each exports `discover: DiscoverFn`).
import { discover as discoverCrossref } from './sources/discovery/crossref.js';
import { discover as discoverPubmed } from './sources/discovery/pubmed.js';
import { discover as discoverEuropePmc } from './sources/discovery/europepmc.js';
import { discover as discoverArxiv } from './sources/discovery/arxiv.js';
import { discover as discoverS2 } from './sources/discovery/s2.js';

// OA-location adapters (each exports `resolveOa: ResolveOaFn`).
import { resolveOa as resolveOaOpenAlex, OPENALEX_LIST_COST } from './sources/oa/openalex.js';
import { resolveOa as resolveOaUnpaywall } from './sources/oa/unpaywall.js';

// Crosswalk enrichment — NCBI ID Converter fills PMID↔PMCID↔DOI so the §4
// reconciliation can link representations that arrived with disjoint ids.
import { enrichWithIdConverter } from './sources/idconv.js';

// Retrieval adapters — the byte-exposing in-band fetchers (so we can upload to R2).
import { retrieveJats as retrievePmcJats } from './retrieval/pmcJats.js';
import { fetchEuropePmcJats, jatsToText } from './retrieval/europepmcFulltext.js';
import { retrieve as retrieveCore } from './retrieval/core.js';
import { fetchArxivPdf, arxivIdFromRecord } from './retrieval/arxivPdf.js';
import { fetchBestOaUrl } from './retrieval/directOa.js';
import { waitForMemory, type MemoryGuardOptions } from './limits/memoryGuard.js';
import { loadIngestControl, clearRequestedRun } from './control.js';

// ─────────────────────────────────────────────────────────────────────────────
// Options + result
// ─────────────────────────────────────────────────────────────────────────────

/** Options accepted by {@link run}. */
export interface RunOptions {
  /** Restrict to one seed by `topic` slug; omitted ⇒ all six seeds (§3). */
  seed?: string;
  /** Cap the number of papers processed this run (post-dedup). */
  limit?: number;
  /** Plan only — discover + resolve + classify + persist `discovered`; no fetch/R2. */
  dryRun?: boolean;
  /** Inject a pre-built config (tests / callers); default `loadConfig()`. */
  config?: Config;
  /** Inject a corpus dir (manifest + usage live here); default `<repoRoot>/data/corpus`. */
  corpusDir?: string;
  /** Inject an R2 store (a mock in tests); default built from `config`. */
  store?: R2Store;
  /** Where to write log lines; default `process.stdout.write`. */
  log?: (line: string) => void;
  /**
   * Enable the host-memory guard (`limits/memoryGuard.ts`) before each
   * retrieval attempt. Opt-in and `undefined` by default (a no-op) so
   * existing/test callers of `run()` are unaffected — the CLI (`cli.ts`)
   * passes `{}` (all defaults) for real `ingest`/`resume` invocations.
   */
  memoryGuard?: MemoryGuardOptions;
  /**
   * Read `control/ingest-config.json` from R2 (`src/control.ts`) before doing
   * any work: honor `paused`, fall back to a queued `requestedRun`'s seed/limit
   * when the caller didn't pass its own, and apply any `limits` override to the
   * budget guard. Opt-in and `undefined` by default (no R2 read, no behavior
   * change) so existing/test callers are unaffected; the CLI's `--remote-control`
   * flag turns this on.
   */
  controlFromR2?: boolean;
}

/** Outcome of a {@link run} — the numbers the CLI prints. */
export interface RunResult {
  seedsRun: string[];
  discovered: number;
  /** papers newly fetched-and-stored this run */
  fetched: number;
  /** papers skipped because already `fetched` (resume) */
  skipped: number;
  /** papers left `discovered` because a budget hard-stop fired */
  deferred: number;
  /** true when a §5.1 budget hard-stop ended the run early */
  budgetStopped: boolean;
  summary: ManifestSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpus dir + ctx
// ─────────────────────────────────────────────────────────────────────────────

/** Default corpus dir: `<repoRoot>/data/corpus` (matches budget.ts, design §6). */
export function defaultCorpusDir(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../src
  const toolRoot = resolve(here, '..'); // .../tools/brain-ingest
  return resolve(toolRoot, '..', '..', 'data', 'corpus'); // <repoRoot>/data/corpus
}

/** Append `query` params (skipping `undefined`) onto a URL. */
function buildUrl(url: string, query?: FetchOptions['query']): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/** Run `fetch` with an optional abort timeout; returns the raw Response. */
async function rawFetch(url: string, opts: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the live {@link SourceCtx} every adapter receives. The fetch helpers
 * route through `limiter.schedule(source, …)` (pacing + concurrency) and apply
 * the per-call query/headers/timeout from {@link FetchOptions}. Budget charging
 * is the adapter's own responsibility via `ctx.budget` (cost is source-specific).
 */
export function createSourceCtx(
  config: Config,
  limiter: RateLimiter,
  budget: BudgetGuard,
): SourceCtx {
  return {
    config,
    limiter,
    budget,
    fetchJson<T>(source: SourceName, url: string, opts: FetchOptions = {}): Promise<T> {
      return limiter.schedule(source, async () => {
        const res = await rawFetch(buildUrl(url, opts.query), opts);
        return (await res.json()) as T;
      });
    },
    fetchText(source: SourceName, url: string, opts: FetchOptions = {}): Promise<string> {
      return limiter.schedule(source, async () => {
        const res = await rawFetch(buildUrl(url, opts.query), opts);
        return res.text();
      });
    },
    fetchBytes(source: SourceName, url: string, opts: FetchOptions = {}): Promise<Uint8Array> {
      return limiter.schedule(source, async () => {
        const res = await rawFetch(buildUrl(url, opts.query), opts);
        return new Uint8Array(await res.arrayBuffer());
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — discovery
// ─────────────────────────────────────────────────────────────────────────────

/** A discovery adapter paired with the source it represents (for enablement). */
interface DiscoveryEntry {
  source: SourceName;
  discover: (ctx: SourceCtx, seed: Seed) => Promise<Candidate[]>;
}

const DISCOVERY_ADAPTERS: DiscoveryEntry[] = [
  { source: 'crossref', discover: discoverCrossref },
  { source: 'pubmed', discover: discoverPubmed },
  { source: 'europepmc', discover: discoverEuropePmc },
  { source: 'arxiv', discover: discoverArxiv },
  { source: 's2', discover: discoverS2 },
];

/**
 * Discover candidates for one seed across every *enabled* discovery adapter.
 * A failing adapter (network/parse) is logged and skipped — one bad source must
 * not sink the run.
 */
async function discoverSeed(
  ctx: SourceCtx,
  seed: Seed,
  log: (line: string) => void,
): Promise<Candidate[]> {
  const all: Candidate[] = [];
  for (const entry of DISCOVERY_ADAPTERS) {
    if (!ctx.config.enabled[entry.source]) continue;
    try {
      const found = await entry.discover(ctx, seed);
      all.push(...found);
      log(`  discover[${entry.source}] ${seed.topic}: ${found.length} candidate(s)`);
    } catch (err) {
      log(`  discover[${entry.source}] ${seed.topic}: FAILED — ${errMsg(err)} (skipped)`);
    }
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps 2–4 — dedup → records → OA-location → classify
// ─────────────────────────────────────────────────────────────────────────────

/** A fresh `discovered` `PaperRecord` from a deduped canonical paper. */
function newRecord(
  paperUid: string,
  candidate: Candidate,
  identifiers: PaperRecord['identifiers'],
  discoveredVia: string[],
  topicTags: string[],
): PaperRecord {
  return {
    paperUid,
    identifiers,
    title: candidate.title,
    authors: candidate.authors,
    year: candidate.year,
    venue: candidate.venue,
    abstract: candidate.abstract,
    discoveredVia: discoveredVia.join(','),
    topicTags,
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    metrics: { citedByCount: null, source: null, asOf: null },
    journal: { issn: [], publisher: null, type: null },
    workType: null,
    concepts: [],
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

/**
 * Classify retrievability from the resolved OA info (design §3 step 4):
 *  - a usable OA URL → `pdf` (we have a binary/full-text URL to fetch),
 *  - OA-but-no-URL (e.g. bronze landing page) → `html` (browser-capture, §5b),
 *  - explicitly not OA → `paywalled`,
 *  - never resolved → `unknown`.
 */
export function classifyRetrievability(oa: OaInfo): Retrievability {
  if (oa.isOa) return oa.bestOaUrl ? 'pdf' : 'html';
  if (oa.status === 'closed') return 'paywalled';
  return 'unknown';
}

/**
 * Resolve OA location for `records` in bulk: OpenAlex batched list calls first,
 * then Unpaywall as the per-DOI fallback for anything OpenAlex did not return.
 * Mutates each record's `oa{}` + `retrievability` in place and returns them.
 */
async function resolveOaAndClassify(
  ctx: SourceCtx,
  records: PaperRecord[],
  log: (line: string) => void,
  now: () => number,
): Promise<void> {
  const resolved = new Map<string, OaInfo>();
  // OpenAlex also returns richer per-work metadata (citations, journal, type,
  // concepts) — captured here and applied below. Unpaywall has none of this.
  const metaByUid = new Map<string, WorkMeta>();
  // OpenAlex returns each work's FULL id set (DOI+PMID+PMCID together). We merge
  // these into the record's identifiers so the §4 reconciliation pass can collapse
  // records that were minted with disjoint ids.
  const idsByUid = new Map<string, Partial<PaperRecord['identifiers']>>();

  if (ctx.config.enabled.openalex) {
    try {
      for (const [uid, { oa, meta, ids }] of await resolveOaOpenAlex(ctx, records)) {
        resolved.set(uid, oa);
        metaByUid.set(uid, meta);
        idsByUid.set(uid, ids);
      }
    } catch (err) {
      log(`  oa[openalex]: FAILED — ${errMsg(err)} (falling back to unpaywall)`);
    }
  }

  // Unpaywall fallback for records OpenAlex left unresolved or marked not-OA.
  const needFallback = records.filter((r) => {
    const got = resolved.get(r.paperUid);
    return got === undefined || (!got.isOa && r.identifiers.doi !== undefined);
  });
  if (needFallback.length > 0 && ctx.config.enabled.unpaywall) {
    try {
      for (const [uid, info] of await resolveOaUnpaywall(ctx, needFallback)) {
        // Prefer an OA hit from Unpaywall over an OpenAlex "not OA".
        const prior = resolved.get(uid);
        if (prior === undefined || (!prior.isOa && info.isOa)) resolved.set(uid, info);
      }
    } catch (err) {
      log(`  oa[unpaywall]: FAILED — ${errMsg(err)} (continuing)`);
    }
  }

  const asOf = new Date(now()).toISOString();
  for (const rec of records) {
    const info = resolved.get(rec.paperUid);
    if (info) rec.oa = info;
    // Merge OpenAlex's full id set into the record (fill gaps; existing non-null
    // ids win on conflict). `mergeIdentifiers(a, b)` keeps `a`'s values.
    const oaIds = idsByUid.get(rec.paperUid);
    if (oaIds) rec.identifiers = mergeIdentifiers(normalizeIdentifiers(rec.identifiers), oaIds);
    const meta = metaByUid.get(rec.paperUid);
    if (meta) {
      rec.metrics = { citedByCount: meta.citedByCount, source: 'openalex', asOf };
      rec.journal = meta.journal;
      rec.workType = meta.workType;
      rec.concepts = meta.concepts;
    }
    rec.retrievability = classifyRetrievability(rec.oa);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps 5–7 — retrieve → extract → store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outcome of a retrieval attempt. Two shapes:
 *  - `kind:'upload'` — the orchestrator HAS the bytes (PMC/Europe PMC JATS, arXiv
 *    PDF) and uploads them + the extracted text to R2 itself.
 *  - `kind:'patch'` — CORE already self-describes a `{storage, fullText}` patch
 *    (its pre-extracted `text/<uid>.txt` is asserted present); the orchestrator
 *    applies the patch as-is rather than re-uploading bytes it does not hold.
 */
type RetrievedPayload =
  | {
      kind: 'upload';
      /** R2 key the bytes belong under (`pdf/…` | `jats/…`). */
      contentKey: string;
      /** the raw bytes to store under `contentKey` */
      bytes: Uint8Array;
      contentType: string;
      /** the extraction method that produced the text (source-tagged for directOa; see FullTextInfo.method) */
      method: 'jats' | 'pdf' | 'directOa';
      /** extracted plain text (from JATS walk or `unpdf`) */
      text: string;
    }
  | {
      kind: 'patch';
      storage: StorageInfo;
      fullText: FullTextInfo;
    };

/**
 * The metered-with-a-daily-cap sources a retrieval attempt may touch — used
 * only for the post-loop informational `budgetStopped` check (§5.1), never to
 * gate the loop itself. Empty: CORE (the only retrieval-time source that was
 * ever in this list) turned out, on live verification, to have no confirmed
 * daily cap — just a ~10-req/60s bucket, which `limits/rateLimiter.ts` paces
 * to directly (see `retrieval/core.ts`'s docstring). OpenAlex is genuinely
 * metered ($1/day) but is never retrieved-through (only touched during the
 * earlier OA-location phase), so it doesn't belong in this retrieval-scoped list.
 */
function meteredSourcesForRetrieval(): SourceName[] {
  return [];
}

/**
 * Try each retrieval source in §5 preference order for one record, returning the
 * first {@link RetrievedPayload} produced (or `null` if none can serve it).
 * Extraction is done here so the orchestrator owns the single text artifact (§5):
 *  - PMC JATS / Europe PMC JATS → `extractFromJats`,
 *  - arXiv PDF / direct OA URL → `extractFromPdf` (unpdf),
 *  - CORE → its own `retrieve` already yields extracted text (`method:'core'`) or
 *    a stored-PDF descriptor; we re-fetch nothing it didn't hand back.
 *
 * The direct-OA-URL step (before CORE) fetches `record.oa.bestOaUrl` — a link
 * OpenAlex/Unpaywall already resolved for free during OA-location — so a
 * record doesn't cost a metered CORE token for content we'd already located.
 */
async function retrieveRecord(
  ctx: SourceCtx,
  record: PaperRecord,
): Promise<RetrievedPayload | null> {
  // 1) PMC JATS (preferred clean text, §5) — needs a PMCID. The in-band
  //    `retrieveJats` hands back the XML so we can persist `jats/<uid>.xml`.
  try {
    const jats = await retrievePmcJats(ctx, record);
    if (jats !== null) {
      const text = extractFromJats(jats.jats.xml).text;
      return {
        kind: 'upload',
        contentKey: jatsKey(record.paperUid),
        bytes: new TextEncoder().encode(jats.jats.xml),
        contentType: 'application/xml',
        method: 'jats',
        text,
      };
    }
  } catch {
    /* try next source */
  }

  // 2) Europe PMC OA JATS — needs a PMCID / source ref.
  try {
    const epmc = await fetchEuropePmcJats(ctx, record);
    if (epmc !== null) {
      const text = jatsToText(epmc.xml);
      return {
        kind: 'upload',
        contentKey: jatsKey(record.paperUid),
        bytes: new TextEncoder().encode(epmc.xml),
        contentType: 'application/xml',
        method: 'jats',
        text,
      };
    }
  } catch {
    /* try next source */
  }

  // 3) arXiv PDF — needs an arXiv id. We hold the bytes → extract + upload.
  try {
    const id = arxivIdFromRecord(record);
    if (id !== null) {
      const { bytes } = await fetchArxivPdf(ctx, id);
      const text = (await extractFromPdf(bytes)).text;
      return {
        kind: 'upload',
        contentKey: pdfKey(record.paperUid),
        bytes,
        contentType: 'application/pdf',
        method: 'pdf',
        text,
      };
    }
  } catch {
    /* try next source */
  }

  // 4) Direct OA-URL fetch — `record.oa.bestOaUrl`, resolved for free during
  //    OA-location. Only serves records where that URL turns out to actually
  //    be a PDF (`fetchBestOaUrl` returns null otherwise); we hold the bytes →
  //    extract + upload, same shape as the arXiv step above.
  try {
    const bytes = await fetchBestOaUrl(ctx, record);
    if (bytes !== null) {
      const text = (await extractFromPdf(bytes)).text;
      return {
        kind: 'upload',
        contentKey: pdfKey(record.paperUid),
        bytes,
        contentType: 'application/pdf',
        method: 'directOa',
        text,
      };
    }
  } catch {
    /* try next source */
  }

  // 5) CORE aggregator — returns its own self-describing `{storage, fullText}`
  //    patch (its pre-extracted `text/<uid>.txt` is asserted present, or a PDF
  //    descriptor it has already addressed). The bytes aren't surfaced through
  //    `RetrieveFn`, so we apply CORE's patch as-is rather than re-uploading.
  try {
    const core = await retrieveCore(ctx, record);
    if (core !== null && core.fullText.extracted) {
      return { kind: 'patch', storage: core.storage, fullText: core.fullText };
    }
  } catch {
    /* nothing more to try */
  }

  return null;
}

/**
 * Fetch → extract → store one record to R2 and return the finalised `fetched`
 * record (or a `failed` record with a reason). Idempotent on R2 via `sync`.
 */
async function fetchAndStore(
  ctx: SourceCtx,
  store: R2Store,
  record: PaperRecord,
  now: () => number,
): Promise<{ record: PaperRecord; stored: boolean }> {
  let payload: RetrievedPayload | null;
  try {
    payload = await retrieveRecord(ctx, record);
  } catch (err) {
    return { record: { ...record, status: 'failed', errors: [...record.errors, errMsg(err)] }, stored: false };
  }

  if (payload === null) {
    // No source could serve it. Not a hard failure — leave it discoverable for a
    // future source/route (browser-capture, §10.7); mark failed only when OA said
    // a binary should exist. Keep it 'discovered' so a later run can retry.
    return { record: { ...record }, stored: false };
  }

  try {
    if (payload.kind === 'patch') {
      // CORE self-described its storage + fullText (text already at text/<uid>.txt);
      // apply the patch as-is — we hold no separate body to upload.
      const finalised: PaperRecord = {
        ...record,
        storage: payload.storage,
        fullText: payload.fullText,
        status: 'fetched',
        fetchedAt: new Date(now()).toISOString(),
      };
      return { record: finalised, stored: true };
    }

    // kind:'upload' — we hold the bytes: store the binary/JATS + the extracted text.
    const contentSync = await store.sync(payload.contentKey, payload.bytes, payload.contentType);
    const textBytes = new TextEncoder().encode(payload.text);
    await store.sync(textKey(record.paperUid), textBytes, 'text/plain; charset=utf-8');

    const finalised: PaperRecord = {
      ...record,
      storage: {
        kind: 'object',
        key: contentSync.key,
        contentType: payload.contentType,
        sizeBytes: contentSync.sizeBytes,
        sha256: contentSync.sha256 ?? sha256(payload.bytes),
      },
      fullText: {
        extracted: payload.text.length > 0,
        method: payload.method,
        charCount: payload.text.length > 0 ? payload.text.length : null,
      },
      status: 'fetched',
      fetchedAt: new Date(now()).toISOString(),
    };
    return { record: finalised, stored: true };
  } catch (err) {
    return {
      record: { ...record, status: 'failed', errors: [...record.errors, `store: ${errMsg(err)}`] },
      stored: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata → R2 (the canonical metadata store, design §1/§6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync the full metadata view to R2 (NOT called in dry-run): the combined index
 * `manifest/papers.jsonl` (one JSON per line) plus one `meta/<uid>.json` per
 * record (the full {@link PaperRecord} as pretty JSON). `R2Store.sync` sha-skips
 * unchanged objects, so this is idempotent and cheap on resume / multi-day runs.
 */
async function syncMetadata(
  store: R2Store,
  records: readonly PaperRecord[],
  log: (line: string) => void,
): Promise<void> {
  const encoder = new TextEncoder();

  // Combined index: one JSON object per line (JSONL), all current records.
  const jsonl = records.map((r) => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
  await store.sync(MANIFEST_KEY, encoder.encode(jsonl), 'application/x-ndjson');

  // Per-paper objects: the full record as pretty JSON, content-addressed by uid.
  for (const rec of records) {
    const body = encoder.encode(JSON.stringify(rec, null, 2));
    await store.sync(metaKey(rec.paperUid), body, 'application/json');
  }

  log(`metadata → R2: ${records.length} meta/ + manifest index`);
}

/**
 * Hydrate an empty local manifest from R2's canonical index (design §6). No-op when
 * the local cache already has records, or when R2 has no index yet (fresh bucket).
 * Best-effort: any read error leaves the manifest empty (a clean first run). This is
 * what makes resume work on a machine that has never run before — without it, a
 * fresh clone re-discovers and re-downloads everything it already has on R2.
 */
async function hydrateManifestFromR2(
  manifest: Manifest,
  store: R2Store,
  log: (line: string) => void,
): Promise<void> {
  if (manifest.all().length > 0) return; // local cache already populated
  try {
    const text = await store.getObjectText(MANIFEST_KEY);
    const records = parseJsonl(text);
    if (records.length > 0) {
      manifest.upsertMany(records);
      log(`hydrated ${records.length} record(s) from R2 (${MANIFEST_KEY}) — resuming`);
    }
  } catch {
    // No index on R2 yet (fresh bucket) or unreadable — start clean.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The run
// ─────────────────────────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve the seed list from `opts.seed` (one topic) or all six. */
function selectSeeds(seedTopic: string | undefined): Seed[] {
  if (seedTopic === undefined) return [...SEEDS];
  const seed = seedByTopic(seedTopic);
  if (seed === undefined) {
    throw new Error(
      `unknown --seed '${seedTopic}'. Known topics: ${SEED_TOPICS.join(', ')}`,
    );
  }
  return [seed];
}

/**
 * Run the pipeline (design §3 steps 1–7, §10.6). Discovers, resolves, classifies,
 * and (unless `dryRun`) retrieves + stores each paper, honouring the §5.1 budget
 * hard-stop and resuming from the manifest. Returns the run tallies.
 */
export async function run(opts: RunOptions = {}): Promise<RunResult> {
  const log = opts.log ?? ((line: string) => process.stdout.write(line + '\n'));
  const config = opts.config ?? loadConfig();
  const corpusDir = opts.corpusDir ?? defaultCorpusDir();

  const now = Date.now;
  const limiter = createRateLimiter({ ncbiKeyed: config.keys.ncbi !== undefined });
  const manifest = Manifest.open(corpusDir);
  const store = opts.store ?? new R2Store(config);

  // ── Remote control plane (opt-in, src/control.ts) ───────────────────────────
  // Read BEFORE anything else: `paused` must skip discovery/OA-location too, not
  // just retrieval. Best-effort (loadIngestControl never throws) — a missing or
  // unreadable control document behaves exactly like an uncontrolled run.
  const control = opts.controlFromR2 ? await loadIngestControl(store) : undefined;
  if (control?.paused) {
    log(
      `ingest: paused via remote control (control/ingest-config.json, set by ${control.updatedBy} ` +
        `at ${control.updatedAt}) — no work done this run.`,
    );
    return {
      seedsRun: [],
      discovered: 0,
      fetched: 0,
      skipped: 0,
      deferred: 0,
      budgetStopped: false,
      summary: manifest.summary(),
    };
  }

  const budget = createBudgetGuard({
    corpusDir,
    budgetOverrides:
      control?.limits.openalexDailyUsd !== undefined
        ? { openalex: { unit: 'usd', daily: control.limits.openalexDailyUsd } }
        : undefined,
  });
  const ctx = createSourceCtx(config, limiter, budget);

  // R2 is canonical (design §6): if the local manifest cache is empty (fresh clone,
  // or wiped), hydrate it from R2's manifest/papers.jsonl so "already explored /
  // already fetched" survives across machines and resume skips re-work. Skipped in
  // dry-run (no R2 I/O). Best-effort: a missing index (fresh bucket) just starts clean.
  if (!opts.dryRun) {
    await hydrateManifestFromR2(manifest, store, log);
  }

  // A queued remote run request (from the nao UI) only fills in a seed/limit the
  // caller didn't already specify — explicit CLI intent always wins. One-shot:
  // cleared once this run actually uses it (see the end of the function).
  const requestedRun = control?.requestedRun ?? null;
  const usedRequestedRun = opts.seed === undefined && opts.limit === undefined && requestedRun !== null;
  const effectiveSeed = opts.seed ?? requestedRun?.seed;
  const effectiveLimit = opts.limit ?? requestedRun?.limit;

  const seeds = selectSeeds(effectiveSeed);
  log(`ingest: seeds=[${seeds.map((s) => s.topic).join(', ')}]${opts.dryRun ? ' (dry-run)' : ''}`);

  // ── Steps 1–4: discover → dedup → record → OA-locate → classify ─────────────
  const candidates: Candidate[] = [];
  const topicByUid = new Map<string, Set<string>>();
  for (const seed of seeds) {
    const found = await discoverSeed(ctx, seed, log);
    candidates.push(...found);
    // Remember which seed topic(s) surfaced each candidate, keyed later by uid.
    for (const c of found) {
      const key = candidateKey(c);
      const tags = topicByUid.get(key) ?? new Set<string>();
      for (const t of seed.topicTags) tags.add(t);
      topicByUid.set(key, tags);
    }
  }

  // Use a FIXED clock (0) for the corpus:ULID fallback so an id-less paper resolves
  // to the SAME uid on every run/machine (the uid is then purely fingerprint-derived),
  // preventing duplicate meta/ objects for one paper. id-bearing papers ignore this —
  // their uid comes from the DOI/PMID/PMCID/arXiv id.
  const deduped = resolveDedup(candidates, 0);
  log(`resolve: ${candidates.length} candidate(s) → ${deduped.length} canonical paper(s)`);

  // Build / merge records: reuse an existing manifest record (resume) or make new.
  let records: PaperRecord[] = [];
  for (const d of deduped) {
    const existing = manifest.get(d.paperUid);
    const tags = collectTopicTags(d.candidate, topicByUid, existing);
    if (existing) {
      // Resume: keep prior status/storage; only refresh metadata + topic tags.
      records.push({ ...existing, identifiers: { ...d.identifiers, ...existing.identifiers }, topicTags: tags });
    } else {
      records.push(newRecord(d.paperUid, d.candidate, d.identifiers, d.discoveredVia, tags));
    }
  }

  await resolveOaAndClassify(ctx, records, log, now);

  // ── §3/§4 crosswalk: NCBI ID Converter fills PMID↔PMCID↔DOI ──────────────────
  // OpenAlex may return a paper with only some of its ids (e.g. a PMID but no
  // PMCID for a brand-new paper). The authoritative NCBI crosswalk gap-fills the
  // missing pmid/pmcid/doi IN PLACE, so the reconcile below — and the corpus-wide
  // reconcile over manifest.all() — can link records that arrived with disjoint ids
  // (e.g. this run's doi/pmid record to a legacy `pmcid:`-only orphan). Best-effort.
  await enrichWithIdConverter(ctx, records, log);

  // ── §4 reconciliation: collapse records whose OpenAlex-enriched ids now overlap ──
  // After OA-location, OpenAlex has filled each record's full id set, so two
  // records minted with DISJOINT ids (e.g. a `doi:`-only + a `pmcid:`-only variant
  // of one paper) now share an identifier. Merge them into one DOI-preferring uid
  // and drop the orphan uids (locally here; on R2 below). Guarantees one uid/paper.
  const before = records.length;
  const reconciled = reconcileByIdentifiers(records);
  records = reconciled.merged;
  for (const uid of reconciled.absorbed) {
    manifest.delete(uid); // drop the orphan from the local index
  }
  if (reconciled.absorbed.length > 0) {
    // groups merged = how many records collapsed away (before - after).
    const groups = before - records.length;
    log(
      `reconciled: merged ${groups} duplicate group(s) → removed ${reconciled.absorbed.length} orphan meta/ object(s)`,
    );
  }

  // Persist the discovered/classified state up front (so a crash keeps progress).
  manifest.upsertMany(records);

  // R2 orphan cleanup (NOT in dry-run): delete the absorbed uids' meta/<uid>.json.
  // The manifest/papers.jsonl index is rewritten from manifest.all() by syncMetadata,
  // so absorbed uids drop from it automatically. We do NOT delete jats/ or text/
  // objects: a merged-away fetched record's bytes stay referenced via the base
  // record's storage.key.
  if (!opts.dryRun && reconciled.absorbed.length > 0) {
    for (const uid of reconciled.absorbed) {
      await store.deleteObject(metaKey(uid));
    }
  }

  // Push the discovered/classified metadata to R2 (canonical store) — skip in
  // dry-run. A re-sync is idempotent (sha-skip), so this is cheap on resume.
  if (!opts.dryRun) {
    await syncMetadata(store, manifest.all(), log);
  }

  // ── Step 5–7: retrieve → extract → store (skipped under --dry-run) ──────────
  // Within a --limit, prioritise actually-retrievable papers (pdf → html → unknown
  // → paywalled) so a small run spends its slots fetching OA full text instead of
  // skipping paywalled records. Discovery order is preserved within a rank (stable
  // sort, V8). No limit ⇒ process every record in discovery order.
  const ordered =
    effectiveLimit !== undefined
      ? [...records].sort((a, b) => fetchabilityRank(a) - fetchabilityRank(b))
      : records;
  const limited = effectiveLimit !== undefined ? ordered.slice(0, Math.max(0, effectiveLimit)) : ordered;

  let fetched = 0;
  let skipped = 0;
  let deferred = 0;
  let budgetStopped = false;

  if (opts.dryRun) {
    for (const rec of limited) {
      log(`  plan ${rec.paperUid} [${rec.retrievability}] via ${rec.discoveredVia}`);
    }
    log('dry-run: no retrieval / R2 calls issued.');
  } else {
    for (const rec of limited) {
      if (rec.status === 'fetched') {
        skipped++;
        continue;
      }

      // §5.1 fail-closed is now PER METERED SOURCE (inside that source's own
      // adapter, e.g. core.ts's own `wouldExceed95` check before it dispatches)
      // rather than a whole-run early-exit here — see the module docstring for
      // why: the free steps ahead of CORE must still get a chance even once
      // CORE itself is capped for the day.
      if (opts.memoryGuard !== undefined) {
        await waitForMemory(opts.memoryGuard, log);
      }

      const { record: finalised, stored } = await fetchAndStore(ctx, store, rec, now);
      manifest.upsert(finalised);
      if (stored) {
        fetched++;
        log(`  fetched ${finalised.paperUid} → ${finalised.storage.key} (${finalised.fullText.charCount ?? 0} chars)`);
      } else if (finalised.status === 'failed') {
        log(`  failed ${finalised.paperUid}: ${finalised.errors[finalised.errors.length - 1] ?? 'unknown'}`);
      } else {
        log(`  unretrieved ${finalised.paperUid} [${finalised.retrievability}] — left 'discovered'`);
      }
    }

    // Informational only (never gated the loop above): did a metered source end
    // this run at/over its hard-stop, and how many papers are left `discovered`
    // for a future run to pick up? `deferred` counts every still-unfetched paper
    // in this batch, not only budget-caused ones — paywalled/unknown records look
    // the same as budget-capped ones from here, and that's an honest number either way.
    // Currently always false (see meteredSourcesForRetrieval's docstring) — kept
    // as the hook for a future retrieval-time source with a genuine daily cap.
    budgetStopped = meteredSourcesForRetrieval().some((src) => budget.wouldExceed95(src, costFor(src)));
    deferred = limited.filter((r) => r.status !== 'fetched').length - fetched;
    if (budgetStopped) {
      log(
        `budget note: a metered source is at/over its 95% daily cap — ${deferred} paper(s) ` +
          `in this batch remain 'discovered'; resume tomorrow for whatever needed it.`,
      );
    }
  }

  // ── §4 CORPUS-WIDE reconciliation (after the fetch loop, before the final sync) ──
  // The within-run pass above only sees THIS run's `records`. A duplicate orphan
  // left in the manifest by a PRIOR run (e.g. a `pmcid:`-only twin) is not in this
  // run's batch, so it survives. But this run upserted the enriched `doi:` record
  // (now carrying that `pmcid`) into the manifest, so `manifest.all()` contains BOTH
  // — re-running reconcile over the WHOLE corpus collapses them to the `doi:` uid and
  // absorbs the stale `pmcid:` orphan. Run AFTER the fetch loop so fetched statuses
  // are final (a fetched record is never absorbed-then-recreated by a later fetch).
  const corpus = reconcileByIdentifiers(manifest.all());
  for (const uid of corpus.absorbed) {
    manifest.delete(uid);
  }
  manifest.upsertMany(corpus.merged);
  if (corpus.absorbed.length > 0) {
    log(`reconciled corpus: removed ${corpus.absorbed.length} duplicate uid(s)`);
  }

  // R2 orphan cleanup for the corpus-wide absorbed uids (non-dry only). De-duplicated
  // against the within-run absorbed set already cleaned above. We still never delete
  // jats/`/`text/`/`pdf/` bytes — a merged-away fetched record keeps its storage.key.
  if (!opts.dryRun && corpus.absorbed.length > 0) {
    const alreadyDeleted = new Set(reconciled.absorbed);
    for (const uid of corpus.absorbed) {
      if (alreadyDeleted.has(uid)) continue;
      await store.deleteObject(metaKey(uid));
    }
  }

  // Final metadata sync — captures everything the retrieval loop just finalised
  // (storage{}, fullText{}, fetchedAt) AND the corpus-wide reconcile above.
  // Idempotent; skipped under --dry-run.
  if (!opts.dryRun) {
    await syncMetadata(store, manifest.all(), log);
  }

  // A queued remote run request is one-shot: clear it once actually honored
  // (not on a dry-run — a plan shouldn't consume the request). Best-effort —
  // see clearRequestedRun's docstring for what happens if this write fails.
  if (usedRequestedRun && !opts.dryRun && control) {
    await clearRequestedRun(store, control);
    log(`remote control: cleared the consumed run request from ${requestedRun?.requestedBy ?? 'unknown'}`);
  }

  const summary = manifest.summary();
  return {
    seedsRun: seeds.map((s) => s.topic),
    discovered: records.length,
    fetched,
    skipped,
    deferred,
    budgetStopped,
    summary,
  };
}

/** Per-request cost for a metered retrieval source (mirrors the adapter's charge). */
function costFor(source: SourceName): number {
  if (source === 'openalex') return OPENALEX_LIST_COST;
  // CORE charges 1 token/request; over-estimate at 1 for the pre-dispatch guard.
  if (source === 'core') return 1;
  return 0;
}

/**
 * Sort key so a --limit prefers papers we can ACTUALLY retrieve full text for with
 * the implemented adapters, most-reliable first: PMC JATS (pmcid) → arXiv (arxiv id)
 * → other OA pdf (CORE/landing, less certain) → html → unknown → paywalled.
 */
function fetchabilityRank(r: PaperRecord): number {
  if (r.identifiers.pmcid !== undefined) return 0;
  if (r.identifiers.arxiv !== undefined) return 1;
  if (r.retrievability === 'pdf') return 2;
  if (r.retrievability === 'html') return 3;
  if (r.retrievability === 'unknown') return 4;
  return 5;
}

/** A stable key for a raw candidate (pre-uid), used to tally seed topics. */
function candidateKey(c: Candidate): string {
  const ids = c.identifiers;
  return (
    ids.doi ?? ids.pmcid ?? ids.pmid ?? ids.arxiv ?? `${c.title.toLowerCase()}|${c.year ?? ''}`
  );
}

/** Union the seed topics that surfaced this paper's member candidates (+ any prior tags). */
function collectTopicTags(
  candidate: Candidate,
  topicByUid: Map<string, Set<string>>,
  existing: PaperRecord | undefined,
): string[] {
  const tags = new Set<string>(existing?.topicTags ?? []);
  const direct = topicByUid.get(candidateKey(candidate));
  if (direct) for (const t of direct) tags.add(t);
  return [...tags];
}

// ─────────────────────────────────────────────────────────────────────────────
// status / resume entrypoints (CLI verbs)
// ─────────────────────────────────────────────────────────────────────────────

/** Build the human-readable manifest + budget status block (the `status` verb). */
export function statusReport(opts: { config?: Config; corpusDir?: string } = {}): string {
  const config = opts.config ?? loadConfig();
  const corpusDir = opts.corpusDir ?? defaultCorpusDir();
  const manifest = Manifest.open(corpusDir);
  const budget = createBudgetGuard({ corpusDir });
  const s = manifest.summary();

  const lines: string[] = [];
  lines.push('manifest:');
  lines.push(`  total:      ${s.total}`);
  lines.push(`  discovered: ${s.discovered}`);
  lines.push(`  fetched:    ${s.fetched}`);
  lines.push(`  failed:     ${s.failed}`);
  const topics = Object.entries(s.byTopic);
  if (topics.length > 0) {
    lines.push('  by topic:');
    for (const [tag, n] of topics) lines.push(`    ${tag}: ${n}`);
  }
  lines.push('budget (today):');
  lines.push(`  openalex: $${budget.spent('openalex').toFixed(4)} / $1.00`);
  // CORE has no confirmed daily cap (verified live 2026-07-01) — it's paced by
  // limits/rateLimiter.ts's ~10-req/60s profile instead, not tracked here.
  lines.push('  core:     unmetered (rate-limited to ~10 req/60s, no daily cap)');
  void config; // config validated above (fails fast on a bad .env)
  return lines.join('\n');
}
