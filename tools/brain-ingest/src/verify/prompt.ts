/**
 * A10 · Verifier prompt construction (insight-engine-architecture §A10, step 2).
 *
 * The verifier is ADVERSARIAL and REFUTE-FIRST: it is told to actively hunt for
 * contradiction, to trust only the retrieved sentences it is shown (never its own
 * priors), and to answer `uncertain` whenever the retrieved evidence does not
 * ground the claim. This is what makes the second pass non-redundant rather than a
 * rubber stamp (docs/memory/0012, brain-synthesis-design "The safeguard").
 *
 * #300 §E · APPROVE-WITH-CAVEAT narrows WHEN `uncertain` is produced, without loosening
 * anything that produces an approval. Thin-but-real grounding (one supporting source, a
 * weak design, a population mismatch) is now asked for as `partial` + a `caveat` naming
 * that limitation, instead of the blanket "default to uncertain when unsure" this prompt
 * used to carry — which was turning every qualification into silence on the card. The
 * mechanical floor is UNCHANGED and still decides the outcome: `partial` continues to
 * require independent retrieval AND ≥1 source the model itself marked "supports", both
 * re-derived in `enforce.ts` and re-checked by the shared schema. The prompt can only ask
 * for a verdict; it cannot grant one.
 *
 * The LLM's reply is UNTRUSTED. The prompt asks for a strict JSON verdict + a
 * per-source stance assessment + the failure-mode check blocks; the schema
 * invariants (no-retrieval ⇒ uncertain; supported/partial ⇒ ≥1 supporting source;
 * contradicted ⇒ ≥1 contradicting) are RE-ENFORCED deterministically after the
 * call (`enforce.ts`) — the prompt states them so the model aims for a valid
 * answer, but enforcement never trusts that it did.
 *
 * `VERIFIER_PROMPT_VERSION` is the artifact provenance stamp — bump it on ANY
 * change to the text below.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { SynthClaim, VerifyCitation } from './types.js';

/** Bump on ANY change to the system/prompt text below (artifact provenance). */
export const VERIFIER_PROMPT_VERSION = 'verifier-2026-08-01.1';

export const VERIFIER_SYSTEM = [
  "You are the ourobion brain pipeline's adversarial edge-verification node (A10).",
  'A DIFFERENT model synthesised a RelationshipClaim between two health metrics from',
  'the literature. Your job is NOT to agree — it is to REFUTE. You independently',
  'retrieved the evidence below; assess whether it truly grounds the claim.',
  '',
  'Rules (a second pass only earns its cost if it is adversarial and grounded):',
  '- Judge ONLY from the retrieved sources shown, and within each source ONLY from its',
  '  quoted evidence passages. Never use outside knowledge or the synthesizer\'s',
  '  reasoning. A source listed with no evidence passages cannot ground the claim.',
  '  If the shown passages do not settle it, the answer is uncertain.',
  '- Actively look for CONTRADICTION (direction flipped, claim-kind inflated, effect',
  '  overstated, population overgeneralised), not just confirmation.',
  '- Assign each shown source a stance: supports | refutes | mixed | mentions.',
  '- Verdict rules you MUST respect (they are also re-checked mechanically):',
  '    supported / partial → needs ≥1 source you marked "supports";',
  '    contradicted → needs ≥1 source you marked "refutes";',
  '    if no sources were retrieved at all → the verdict can only be "uncertain".',
  '- APPROVE WITH A CAVEAT rather than retreating to "uncertain". When the shown evidence',
  '  DOES ground the claim but only thinly — one supporting source, a weak study design, a',
  '  population that does not match, a correlation carrying a causal claim — answer "partial"',
  '  and NAME that exact limitation in "caveat". Weak-but-real support is a qualified yes, not',
  '  a shrug; burying it in "uncertain" hides the limitation instead of stating it.',
  '- Reserve the non-approving verdicts for what they actually mean:',
  '    unsupported → the shown evidence does not address this claim (it is irrelevant to it);',
  '    contradicted → the shown evidence argues AGAINST the claim;',
  '    uncertain → nothing was retrieved, or the shown passages genuinely cannot settle it.',
  '  Never use "uncertain" merely because the support is thin — that is what "caveat" is for.',
  '- The caveat must name a limitation you actually observed in the shown evidence. Do NOT',
  '  invent one, and do NOT write a generic reassurance; it is shown to a person as a real',
  '  qualification. No limitation ⇒ "caveat": null. Write it in plain, non-clinical language,',
  '  one or two short sentences, about the EVIDENCE — not about you or your process.',
  '- A confident wrong verdict is still the worst outcome. Approving thin evidence WITH its',
  '  caveat is not a confident verdict; approving it silently would be.',
  '- Reply with a SINGLE JSON object and nothing else (no prose, no code fences).',
].join('\n');

/** JSON contract block restated inline — keys and value shapes the reply must use. */
const CONTRACT = [
  'Reply shape (a single JSON object):',
  '{',
  '  "verdict": "supported|partial|unsupported|contradicted|uncertain",',
  '  "sourceStances": [ { "paperId": "<one of the shown paperIds>",',
  '                       "stance": "supports|refutes|mixed|mentions" } ],',
  '  "directionCheck": { "matchesClaim": <bool> },',
  '  "claimKindCheck": { "matchesClaim": <bool>,',
  '                      "supportedKind": "causal|correlational|mechanistic" },',
  '  "scopeCheck": { "mismatch": <bool>, "supportedPopulation": "<string|null>" },',
  '  "effectSizeCheck": { "matchesClaim": <bool>, "extractedSize": <number|null> },',
  '  "evidenceTier": 1,',
  '  "confidence": <0..1>,',
  '  "caveat": "<the limitation you observed, or null>"',
  '}',
  '',
  'Notes: evidenceTier = study-design strength of the STRONGEST supporting source',
  '(1 mechanistic/in-vitro, 2 cross-sectional, 3 cohort, 4 RCT, 5 meta-analysis/review).',
  'confidence is your calibrated belief in the verdict, 0..1. Only reference paperIds',
  'shown below — inventing a source is a rejected answer. caveat is a short plain-language',
  'sentence naming a limitation the shown evidence really has, or null when it has none;',
  'a caveat naming something you did not observe is discarded and replaced.',
].join('\n');

/**
 * Render one retrieved source for the evidence block: header + its verbatim
 * evidence passages, each with provenance (paperId + locator into the source's
 * canonical text / abstract). A source without passages is explicitly marked
 * ungroundable (O15: the verifier judges ONLY shown evidence).
 */
function sourceBlock(s: VerifyCitation, i: number): string {
  const yr = s.year === null ? 'n.d.' : String(s.year);
  const head =
    `  [S${i + 1}] paperId: ${s.paperId} (${yr}) — evidenceTier ${s.evidenceTier}, impact ${s.impactTier}\n` +
    `        title: ${s.title}`;
  const passages = s.evidence ?? [];
  if (passages.length === 0) {
    return head + '\n        evidence: (no passages available — this source cannot ground the claim)';
  }
  const lines = passages.map((p) => `          - [${s.paperId} @ ${p.locator}] "${p.text}"`);
  return head + '\n        evidence (verbatim passages):\n' + lines.join('\n');
}

/** Compact claim summary the verifier assesses (its own retrieval is the evidence). */
function claimBlock(claim: SynthClaim): string {
  const eff =
    claim.effect.size === null
      ? 'none stated'
      : `${claim.effect.size}${claim.effect.unit ? ' ' + claim.effect.unit : ''}` +
        (claim.effect.ci ? ` (CI ${claim.effect.ci[0]}..${claim.effect.ci[1]})` : '');
  return [
    `edgeId: ${claim.edgeId}`,
    `relation: ${claim.subject} ${claim.relation} ${claim.object}`,
    `claimKind: ${claim.claimKind}`,
    `effect: ${eff}`,
    `population (claimed scope): ${claim.population ?? 'unspecified'}`,
  ].join('\n');
}

/**
 * Build `{ system, prompt }` for verifying ONE claim against its independently
 * retrieved sources. When `sources` is empty the prompt still runs (the model
 * should answer `uncertain`); enforcement guarantees it regardless.
 */
export function buildVerifierPrompt(
  claim: SynthClaim,
  sources: readonly VerifyCitation[],
): { system: string; prompt: string } {
  const evidence =
    sources.length === 0
      ? '  (no sources retrieved — you cannot ground this claim; answer "uncertain")'
      : sources.map(sourceBlock).join('\n');
  const prompt = [
    'Claim under review (proposed by a DIFFERENT, decorrelated model):',
    claimBlock(claim),
    '',
    'Independently retrieved sources (YOUR evidence — assess each one):',
    evidence,
    '',
    CONTRACT,
  ].join('\n');
  return { system: VERIFIER_SYSTEM, prompt };
}
