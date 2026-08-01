/**
 * Build a REAL verifier corpus (JSONL of {@link CorpusDoc}) from this project's
 * own ingested manifest — `data/corpus/papers.jsonl`.
 *
 * WHY THIS EXISTS. `verify --corpus <path>` ranks over CorpusDocs, but the only
 * corpus in the repo was `fixtures/verify-corpus.jsonl`: 5 hand-written lines
 * for the loader tests. Verifying against a test fixture would FABRICATE
 * corroboration, so real runs shipped no `--corpus` at all — retrieval ranked an
 * empty corpus and the verifier LLM correctly answered "cannot tell" every time.
 * Every live verdict has therefore been `uncertain` for a purely mechanical
 * reason. This module closes that gap with derived-but-honest data only.
 *
 * THE THREE FIELDS, AND WHERE EACH HONESTLY COMES FROM
 *
 * - `evidenceTier` — NOT assigned here. Each doc is built by the existing
 *   {@link buildCorpusDoc}, which calls the repo's deterministic paper-level
 *   classifier {@link classifyEvidenceTier} (src/evidenceTier.ts) and carries
 *   `evidenceInputs` + `evidenceClassification` so the tier is RECOMPUTABLE.
 *   `loadCorpusFromFile` re-runs the classifier on every load and rejects any
 *   line whose tier does not match, so a hand-edited tier cannot survive.
 *
 * - `impactTier` — the existing b2 derivation: per-ISSN {@link VenueCache}
 *   (`data/corpus/venues.json`) → {@link bandImpactTier} (C8 bands). This build
 *   is OFFLINE: it reads cache entries the `venue` verb already fetched and
 *   issues NO network lookups (a manifest pass would otherwise be thousands of
 *   OpenAlex calls). A venue that is absent from the cache, has no ISSN, or
 *   bands to `unknown` falls back to {@link EXTERNAL_DEFAULT_IMPACT_TIER} — the
 *   repo's OWN conservative band for an unscored venue, not a flattering guess.
 *   `impactBasis` records which of those happened for every row.
 *
 * - `text` — the REAL canonical extracted text when it is reachable offline
 *   (`--text-dir`, R2's `text/<uid>.txt` layout), else the REAL `abstract`.
 *   Nothing is ever synthesised or paraphrased, and `textSource` records which
 *   was used. A paper with NEITHER is SKIPPED and counted — never padded with a
 *   title-only or placeholder body, which would be fabricated corroboration of
 *   exactly the kind this module exists to prevent.
 *
 * Emitted lines carry two extra provenance keys (`textSource`, `impactBasis`)
 * beyond the CorpusDoc contract. `parseCorpusDoc` builds its result from known
 * keys and ignores unknown ones, so the corpus still round-trips through the
 * strict loader (asserted in tests) while staying auditable on disk.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCorpusDoc } from './corpus.js';
import { EXTERNAL_DEFAULT_IMPACT_TIER } from './retrieval.js';
import type { CorpusDoc, VerifyImpactTier } from './types.js';
import { encodeKeySegment } from '../storage/r2.js';
import type { PaperRecord } from '../types.js';
import { bandImpactTier } from '../venue/banding.js';
import { VenueCache } from '../venue/cache.js';
import { normalizeIssn } from '../venue/openalexSources.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Which REAL text this doc's body came from (never a synthesised body). */
export type CorpusTextSource = 'canonical-text' | 'abstract';

/** Why a manifest record produced no CorpusDoc. */
export type CorpusSkipReason =
  /** No canonical text offline AND no abstract — nothing honest to rank over. */
  | 'no-text'
  /** Record carries no usable title, so the doc could not satisfy the contract. */
  | 'no-title'
  /** A second record for a paperUid already emitted (manifest upsert residue). */
  | 'duplicate-paper-id'
  /** buildCorpusDoc / the classifier rejected the record; `detail` carries why. */
  | 'build-error';

/** One skipped record, kept so the run reports WHAT it dropped and WHY. */
export interface CorpusSkip {
  paperId: string;
  reason: CorpusSkipReason;
  detail?: string;
}

/** One emitted doc plus the provenance written alongside it. */
export interface CorpusBuildRow {
  doc: CorpusDoc;
  textSource: CorpusTextSource;
  /** How `impactTier` was reached (cache band reason, or the unresolved path). */
  impactBasis: string;
}

/** Counters over a whole build — the honest accounting the CLI prints. */
export interface CorpusBuildStats {
  recordsRead: number;
  emitted: number;
  skipped: number;
  byTextSource: Record<CorpusTextSource, number>;
  byImpactTier: Record<VerifyImpactTier, number>;
  /** Rows whose impactTier came from a real cached+banded venue (not the fallback). */
  venueBanded: number;
  /** Rows that fell back to the repo's conservative unscored-venue band. */
  venueUnresolved: number;
  byEvidenceTier: Record<string, number>;
  /** Docs whose classification is `unknown`/`conflicted` (tier-2 review floor). */
  evidenceReviewRequired: number;
  bySkipReason: Record<string, number>;
}

export interface CorpusBuildResult {
  rows: CorpusBuildRow[];
  skips: CorpusSkip[];
  stats: CorpusBuildStats;
}

/** Resolve a paper's canonical extracted text offline; null when unreachable. */
export type CanonicalTextLoader = (paper: PaperRecord) => string | null;

/**
 * Resolve a paper's impactTier offline. A null `tier` means "not bandable" — the
 * caller applies the conservative fallback — while `basis` still explains WHY,
 * so a cached-but-unresolvable venue is never misreported as simply uncached.
 */
export type ImpactTierResolver = (
  paper: PaperRecord,
) => { tier: VerifyImpactTier | null; basis: string };

export interface CorpusBuildOptions {
  /** Canonical-text source. Omitted → every doc falls back to its abstract. */
  loadText?: CanonicalTextLoader;
  /** Venue banding. Omitted → every doc takes the conservative unscored band. */
  resolveImpact?: ImpactTierResolver;
  /** Stop after this many EMITTED docs (smoke runs); undefined = whole manifest. */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline adapters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical-text loader over a LOCAL mirror of R2's `text/<uid>.txt` layout
 * (same {@link encodeKeySegment} filename), for when the corpus text has been
 * synced down. A missing/unreadable/blank file returns null so the caller falls
 * back to the abstract rather than emitting an empty body.
 */
export function textDirLoader(dir: string): CanonicalTextLoader {
  return (paper) => {
    try {
      const text = readFileSync(join(dir, `${encodeKeySegment(paper.paperUid)}.txt`), 'utf8');
      return text.trim() === '' ? null : text;
    } catch {
      return null;
    }
  };
}

/**
 * impactTier from the per-ISSN venue cache ONLY — cache hits are banded with
 * {@link bandImpactTier} (C8), misses return null. NO network: a manifest-wide
 * pass would be thousands of OpenAlex lookups, and the `venue` verb is the
 * sanctioned place to warm the cache one ISSN at a time.
 *
 * A paper may list several ISSNs (print + electronic). The first that both hits
 * the cache and bands to `resolved` wins; a cached-but-unresolvable venue is
 * reported as such so the fallback is visible rather than silent.
 */
export function cachedVenueImpactResolver(cache: VenueCache): ImpactTierResolver {
  return (paper) => {
    const issns = (paper.journal?.issn ?? [])
      .map((raw) => normalizeIssn(raw))
      .filter((issn): issn is string => issn !== null);
    const unbandable: string[] = [];
    for (const issn of issns) {
      const venue = cache.get(issn);
      if (venue === undefined) {
        unbandable.push(`${issn}:not-cached`);
        continue;
      }
      const outcome = bandImpactTier(venue);
      if (outcome.kind === 'resolved') {
        return { tier: outcome.tier, basis: `venue-cache ${issn}: ${outcome.reason}` };
      }
      unbandable.push(`${issn}:${outcome.reason}`);
    }
    const why = issns.length === 0 ? 'no-issn-on-record' : unbandable.join(' ');
    return {
      tier: null,
      basis: `unresolved-venue (${why}) → conservative '${EXTERNAL_DEFAULT_IMPACT_TIER}' band`,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The build
// ─────────────────────────────────────────────────────────────────────────────

function emptyStats(): CorpusBuildStats {
  return {
    recordsRead: 0,
    emitted: 0,
    skipped: 0,
    byTextSource: { 'canonical-text': 0, abstract: 0 },
    byImpactTier: { high: 0, moderate: 0, low: 0, preprint: 0 },
    venueBanded: 0,
    venueUnresolved: 0,
    byEvidenceTier: {},
    evidenceReviewRequired: 0,
    bySkipReason: {},
  };
}

/**
 * Project manifest records into CorpusDocs. Pure apart from the injected
 * adapters, so tests drive it with in-memory records and no filesystem.
 *
 * A record contributes a doc only when it has a title AND a real body (canonical
 * text, else abstract). Everything else is skipped and counted — no placeholder
 * text, no invented tier.
 */
export function buildCorpusRows(
  records: readonly PaperRecord[],
  opts: CorpusBuildOptions = {},
): CorpusBuildResult {
  const rows: CorpusBuildRow[] = [];
  const skips: CorpusSkip[] = [];
  const stats = emptyStats();
  const seen = new Set<string>();

  for (const paper of records) {
    if (opts.limit !== undefined && rows.length >= opts.limit) break;
    stats.recordsRead += 1;

    const skip = (reason: CorpusSkipReason, detail?: string): void => {
      skips.push({ paperId: paper.paperUid, reason, ...(detail !== undefined ? { detail } : {}) });
      stats.skipped += 1;
      stats.bySkipReason[reason] = (stats.bySkipReason[reason] ?? 0) + 1;
    };

    if (seen.has(paper.paperUid)) {
      skip('duplicate-paper-id');
      continue;
    }
    if (typeof paper.title !== 'string' || paper.title.trim() === '') {
      skip('no-title');
      continue;
    }

    // Real text only: canonical extracted text if offline-reachable, else the
    // real abstract. Never a title-only or synthesised body.
    const canonical = opts.loadText?.(paper) ?? null;
    const abstract = typeof paper.abstract === 'string' ? paper.abstract : '';
    let text: string;
    let textSource: CorpusTextSource;
    if (canonical !== null && canonical.trim() !== '') {
      text = canonical;
      textSource = 'canonical-text';
    } else if (abstract.trim() !== '') {
      text = abstract;
      textSource = 'abstract';
    } else {
      skip('no-text', paper.fullText?.extracted === true
        ? 'fullText.extracted is true but the text is not reachable offline, and there is no abstract'
        : 'no abstract and no extracted full text');
      continue;
    }

    const resolved = opts.resolveImpact?.(paper);
    const banded = resolved !== undefined && resolved.tier !== null;
    const impactTier = resolved?.tier ?? EXTERNAL_DEFAULT_IMPACT_TIER;
    const impactBasis = resolved?.basis
      ?? `no-venue-resolver → conservative '${EXTERNAL_DEFAULT_IMPACT_TIER}' band`;

    let doc: CorpusDoc;
    try {
      // evidenceTier is the classifier's, via the existing projection — this
      // module never assigns one.
      doc = buildCorpusDoc(paper, text, impactTier);
    } catch (err) {
      skip('build-error', err instanceof Error ? err.message : String(err));
      continue;
    }

    seen.add(paper.paperUid);
    rows.push({ doc, textSource, impactBasis });
    stats.emitted += 1;
    stats.byTextSource[textSource] += 1;
    stats.byImpactTier[impactTier] += 1;
    if (banded) stats.venueBanded += 1;
    else stats.venueUnresolved += 1;
    const tierKey = String(doc.evidenceTier);
    stats.byEvidenceTier[tierKey] = (stats.byEvidenceTier[tierKey] ?? 0) + 1;
    if (doc.evidenceClassification?.reviewRequired === true) stats.evidenceReviewRequired += 1;
  }

  return { rows, skips, stats };
}

/**
 * Serialize rows to JSONL. Each line is the CorpusDoc plus the `textSource` /
 * `impactBasis` provenance keys the strict loader ignores.
 */
export function serializeCorpusRows(rows: readonly CorpusBuildRow[]): string {
  return rows
    .map((row) => JSON.stringify({ ...row.doc, textSource: row.textSource, impactBasis: row.impactBasis }))
    .join('\n') + (rows.length > 0 ? '\n' : '');
}
