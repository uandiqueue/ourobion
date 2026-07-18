/**
 * b2 · impactTier banding — venue notability bands per phase2-run-config C8.
 *
 * Pure function: {@link VenueInfo} (+ an optional SJR quartile) → an
 * `ImpactTier` band, thresholds carried in a config object (C8 marks them
 * provisional — never inline the literals at call sites).
 *
 * C8 (docs/shared/phase2-run-config-decisions.md, provisional):
 *   high      SJR Q1  OR  OpenAlex h-index ≥ 100
 *   moderate  SJR Q2  OR  h-index ≥ 50
 *   low       everything else WITH a resolvable venue
 *   preprint  unreviewed servers (OpenAlex source `type` + name heuristics —
 *             trust the SOURCE type, work-level types are noisy (design gotcha))
 *
 * An unresolvable venue is a typed `unknown` outcome, NOT `low`: C8's `low`
 * band explicitly requires a resolvable venue, and neither doc licenses a
 * silent default. Callers decide what an unknown venue does to a Citation.
 *
 * SJR: the support-models design names SJR (scimagojr.com) as a banding input
 * but ships no dataset in this repo, so the quartile is an OPTIONAL caller
 * input here (null/omitted = not available) and the OpenAlex-only path is
 * fully functional without it. See the U4 session log — do not fabricate one.
 *
 * `impactTier` is a NOTABILITY axis only — it is EXCLUDED from edgeScore /
 * reliability (ADR docs/shared/decisions/0003-paper-reliability.md invariant:
 * notability ≠ trust). This module feeds `Citation.impactTier`, nothing else.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { VenueInfo } from './openalexSources.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors `ImpactTier` in shared/brain/relationships.ts:67 (comment-level coupling). */
export type ImpactTier = 'high' | 'moderate' | 'low' | 'preprint';

/** SJR quartile (Q1 best). */
export type SjrQuartile = 1 | 2 | 3 | 4;

/** C8 thresholds — a config object so the provisional numbers live in ONE place. */
export interface ImpactBandThresholds {
  /** h-index at or above this → 'high'. */
  highHIndexMin: number;
  /** h-index at or above this → 'moderate'. */
  moderateHIndexMin: number;
  /** SJR quartile mapping to 'high' (Q1). */
  highSjrQuartile: SjrQuartile;
  /** SJR quartile mapping to 'moderate' (Q2). */
  moderateSjrQuartile: SjrQuartile;
  /**
   * OpenAlex source `type` values treated as unreviewed servers. bioRxiv /
   * medRxiv / arXiv are `repository` in OpenAlex; journals are `journal`.
   */
  preprintSourceTypes: readonly string[];
  /**
   * Lowercased display-name substrings that mark a preprint server even when
   * the source `type` says otherwise ('rxiv' catches arXiv AND the bioRxiv /
   * medRxiv / chemRxiv / PsyArXiv family — 'arxiv' would miss med/bio/chemRxiv).
   */
  preprintNamePatterns: readonly string[];
}

/** The C8 bands this run adopted — PROVISIONAL and explicitly uncalibrated. */
export const IMPACT_BANDS_C8: ImpactBandThresholds = {
  highHIndexMin: 100,
  moderateHIndexMin: 50,
  highSjrQuartile: 1,
  moderateSjrQuartile: 2,
  preprintSourceTypes: ['repository'],
  preprintNamePatterns: ['rxiv', 'ssrn', 'research square', 'preprint', 'osf preprints'],
};

/**
 * Banding outcome. `resolved` carries a tier assignable to
 * `Citation.impactTier`; `unknown` means the venue could not be banded and the
 * caller must decide (never silently 'low' — see header).
 */
export type ImpactTierOutcome =
  | { kind: 'resolved'; tier: ImpactTier; reason: string }
  | { kind: 'unknown'; reason: string };

/** Optional banding inputs. */
export interface BandOptions {
  /** SJR quartile when the caller has one (no dataset in-repo — see header). */
  sjrQuartile?: SjrQuartile | null;
  /** Threshold overrides (tests exercise boundaries; runs use the C8 default). */
  thresholds?: ImpactBandThresholds;
}

// ─────────────────────────────────────────────────────────────────────────────
// The banding function
// ─────────────────────────────────────────────────────────────────────────────

/** True when the venue looks like an unreviewed preprint server. */
export function isPreprintVenue(
  venue: VenueInfo,
  thresholds: ImpactBandThresholds = IMPACT_BANDS_C8,
): boolean {
  const type = venue.type?.toLowerCase().trim() ?? '';
  if (thresholds.preprintSourceTypes.includes(type)) return true;
  const name = venue.displayName?.toLowerCase() ?? '';
  return thresholds.preprintNamePatterns.some((p) => name.includes(p));
}

/**
 * Band a venue into an `ImpactTier` per C8.
 *
 * Precedence: unresolved → unknown; preprint server → 'preprint' (an
 * unreviewed server's h-index is not peer-reviewed notability); then
 * `high` / `moderate` on SJR-quartile OR h-index; else 'low' (resolvable
 * venue). Every outcome carries a `reason` for triage.
 */
export function bandImpactTier(venue: VenueInfo, opts: BandOptions = {}): ImpactTierOutcome {
  const t = opts.thresholds ?? IMPACT_BANDS_C8;
  const sjr = opts.sjrQuartile ?? null;

  if (!venue.resolved) {
    return { kind: 'unknown', reason: `venue-unresolved (issn '${venue.issn}')` };
  }

  if (isPreprintVenue(venue, t)) {
    return {
      kind: 'resolved',
      tier: 'preprint',
      reason: `preprint-server (type '${venue.type ?? 'null'}', name '${venue.displayName ?? 'null'}')`,
    };
  }

  const h = venue.hIndex;
  if (sjr === t.highSjrQuartile) {
    return { kind: 'resolved', tier: 'high', reason: `sjr-q${sjr}` };
  }
  if (h !== null && h >= t.highHIndexMin) {
    return { kind: 'resolved', tier: 'high', reason: `h-index ${h} >= ${t.highHIndexMin}` };
  }
  if (sjr === t.moderateSjrQuartile) {
    return { kind: 'resolved', tier: 'moderate', reason: `sjr-q${sjr}` };
  }
  if (h !== null && h >= t.moderateHIndexMin) {
    return { kind: 'resolved', tier: 'moderate', reason: `h-index ${h} >= ${t.moderateHIndexMin}` };
  }
  return { kind: 'resolved', tier: 'low', reason: 'resolvable-venue-below-bands' };
}
