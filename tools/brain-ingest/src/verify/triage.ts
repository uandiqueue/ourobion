/**
 * A10 · Budget triage (C7 — insight-engine-architecture §A10; brain-synthesis-design
 * "Cheaper checks", point 4 "Tiered spend").
 *
 * The verification budget is finite, so full independent-retrieval verification
 * (corpus + live top-up + the decorrelated verifier LLM) is spent ONLY where it
 * earns its cost:
 *   - HIGH-IMPACT edges — a claim resting on a high-impact venue is one a wrong
 *     verdict would propagate loudly; and
 *   - LOW-CORROBORATION edges — a claim backed by few independent sources is
 *     exactly where a hallucinated edge is most likely and least caught by the
 *     structural corroboration signal.
 * Every other edge gets the cheap `quoteCheck`-only pass: the deterministic quote
 * gate already ran (near-free), and with no independent retrieval the record can
 * only be `uncertain` (never served) — which is the correct, safe default for a
 * low-stakes, well-corroborated edge until the budget frees up.
 *
 * Pure + deterministic: same (claim, config) → same decision. No I/O, no LLM.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { SynthClaim, TriageConfig, TriageDecision, VerifyImpactTier } from './types.js';

/** Impact-tier ordering (strongest first) for picking a claim's top venue. */
const IMPACT_ORDER: readonly VerifyImpactTier[] = ['high', 'moderate', 'low', 'preprint'];

/** The shipped default policy (C7). Full retrieval for high-impact OR <2 supporting sources. */
export const DEFAULT_TRIAGE_CONFIG: TriageConfig = {
  fullRetrievalImpactTiers: ['high'],
  lowCorroborationThreshold: 2,
};

/** Strongest impact tier among a claim's citations, or null when it has none. */
export function topImpactTier(claim: SynthClaim): VerifyImpactTier | null {
  let best: VerifyImpactTier | null = null;
  for (const c of claim.citations) {
    const tier = c.impactTier as VerifyImpactTier;
    if (best === null || IMPACT_ORDER.indexOf(tier) < IMPACT_ORDER.indexOf(best)) {
      best = tier;
    }
  }
  return best;
}

/**
 * Count of DISTINCT supporting citations (echo control: identical paperIds count
 * once). This is the corroboration signal the low-corroboration test reads — the
 * structural "backed by N independent papers" count (brain-synthesis-design
 * "Cross-paper corroboration").
 */
export function supportingCitationCount(claim: SynthClaim): number {
  const ids = new Set<string>();
  for (const c of claim.citations) {
    if (c.stance === 'supports') ids.add(c.paperId);
  }
  return ids.size;
}

/**
 * Decide the verification-budget rung for one claim under `config`
 * (default {@link DEFAULT_TRIAGE_CONFIG}). Full retrieval when the claim is
 * high-impact OR low-corroboration; quoteCheck-only otherwise.
 */
export function decideTriage(
  claim: SynthClaim,
  config: TriageConfig = DEFAULT_TRIAGE_CONFIG,
): TriageDecision {
  const top = topImpactTier(claim);
  const supporting = supportingCitationCount(claim);
  const reasons: string[] = [];

  const highImpact = top !== null && config.fullRetrievalImpactTiers.includes(top);
  if (highImpact) reasons.push(`high-impact citation (${top})`);

  const lowCorroboration = supporting < config.lowCorroborationThreshold;
  if (lowCorroboration) {
    reasons.push(
      `low corroboration (${supporting} supporting < threshold ${config.lowCorroborationThreshold})`,
    );
  }

  return {
    mode: reasons.length > 0 ? 'full' : 'quoteCheck-only',
    reasons,
    supportingCitations: supporting,
    topImpactTier: top,
  };
}
