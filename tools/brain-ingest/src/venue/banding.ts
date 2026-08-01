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

/**
 * The C8 bands this run adopted — PROVISIONAL and explicitly uncalibrated.
 *
 * ⚠ The h-index cutoffs `highHIndexMin: 100` / `moderateHIndexMin: 50` are
 * PROVISIONAL, UNCITED, and UNJUSTIFIABLE AS GLOBAL INTEGERS (evidence-review
 * RU6d). No literature establishes 100 or 50 — or any global integer — as a
 * meaningful venue-h-index threshold; worse, the choice is arbitrary *by
 * construction*: journal/venue h-index is field- and size-dependent and
 * explicitly NOT cross-field comparable (Schubert & Glänzel 2007; Bihari 2020),
 * so a single global integer necessarily mis-ranks across fields — `≥100`
 * systematically OVER-promotes high-citation-base fields (biomed / life
 * sciences) and UNDER-promotes math / CS / humanities, whose Q1-equivalent
 * venues carry far lower absolute h. These are engineering judgment, not
 * science. The principled replacement is a FIELD-NORMALIZED or PERCENTILE rule
 * (percentile within a subject category), or a field-normalized indicator such
 * as SNIP / Journal Citation Indicator (JCI) — which needs per-field reference
 * data this repo does not have, so it is BACKLOGGED (phase2-research-fixes B6),
 * not guessed. Bounded risk: `impactTier` is notability-only, never trust (see
 * the OR-ladder note on `bandImpactTier` + the header's notability≠trust rule).
 */
export const IMPACT_BANDS_C8: ImpactBandThresholds = {
  // ⚠ RU6d: PROVISIONAL / UNCITED / not cross-field comparable → field-normalized
  //   or percentile rule (SNIP / JCI) backlogged (B6). Do NOT read as calibrated.
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
 *
 * ⚠ The `SJR-quartile ∨ h-index` combination is a DELIBERATE RECALL-FAVOURING
 * HEURISTIC, NOT a metrically-principled rule (evidence-review RU6f). The two
 * legs are NON-COMMENSURABLE — a prestige-weighted, field-normalized quartile
 * computed on Scopus (SJR) vs a raw, size-driven, field-*un*normalized integer
 * computed on OpenAlex (h-index) — and they sit on non-commensurable databases.
 * The OpenAlex h leg "runs hotter" than the Scopus SJR leg (OpenAlex captures
 * higher average citation counts; Mezquita-Peris 2025), and because the tiers
 * combine with OR (not AND), the MORE-PERMISSIVE leg always wins: at each tier
 * the SJR leg is tested first, but the h leg can still promote a venue the SJR
 * leg would not. So this is asymmetric and recall-favouring by design — kept as
 * a documented tradeoff, not because it is principled. The bounded-risk
 * justification (RU6g, the strongest C8 decision — do NOT disturb it): the only
 * failure mode is occasionally over-ranking large / high-volume venues, and
 * `impactTier` feeds DISCOVERY / RANKING ONLY, NEVER trust — it is excluded from
 * edgeScore / reliability *and* the UX applicability axis (ADR-0003 §5;
 * notability ≠ trust). Reconsidering the OR (and field-normalizing the h leg)
 * is backlogged with the cutoffs (B6). Do NOT change the OR logic or tier order
 * here — this is documentation of an accepted, bounded tradeoff.
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
