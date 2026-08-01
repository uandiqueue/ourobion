/**
 * A10 · Verifier prompt construction (insight-engine-architecture §A10, step 2).
 *
 * WHAT THE VERDICT ANSWERS (#300 §E, owner instruction 2026-08-01). One question only:
 * **is this claim a faithful reading of the ONE paper it cites?** Concretely — the quoted
 * words are really in that paper (the deterministic A9 quote gate already proved this,
 * before any spend), the direction is the direction that paper reports, the claim kind is
 * not inflated beyond what it licenses, the effect size is the size it reports, and the
 * claim is actually about the two metrics named.
 *
 * WHAT THE VERDICT DOES **NOT** ANSWER: whether OTHER papers agree. Independent retrieval
 * still runs (it is the safeguard of docs/memory/0012 and stays mandatory), its sources are
 * still shown, stanced, and counted into `corroboration` — but they reach the user through
 * the **caveat**, never through the verdict. The defect this closes was measured live: two
 * faithful single-paper claims came back `unsupported` (conf 0.92) with the caveat "The other
 * studies found did not back this up" — the verifier had answered a question nobody asked, and
 * a claim's own paper backing it counted for nothing. A faithful reading of one paper with zero
 * corroborating studies is `supported`-WITH-CAVEAT, not `unsupported`.
 *
 * Still ADVERSARIAL, with the adversary pointed at the right target: the prompt hunts for the
 * claim OVERSTATING its own cited paper (direction flipped, association dressed as causation,
 * effect inflated, population overgeneralised, a claim about metrics the paper never measured).
 * That is what makes the second pass non-redundant rather than a rubber stamp — not the count of
 * strangers who happen to agree.
 *
 * The LLM's reply is UNTRUSTED. The prompt asks for a strict JSON verdict + a per-source stance
 * assessment + the failure-mode check blocks; the enforceable invariants (no-retrieval ⇒
 * `uncertain`; an approving verdict ⇒ a passing quote gate AND a matching direction AND no causal
 * inflation; `contradicted` ⇒ a direction that does NOT match) are RE-DERIVED deterministically
 * after the call (`enforce.ts`) and re-checked by the shared schema. The prompt states them so the
 * model aims for a valid answer; enforcement never trusts that it did.
 *
 * `VERIFIER_PROMPT_VERSION` is the artifact provenance stamp — bump it on ANY
 * change to the text below.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { QuoteCheckBlock } from './quoteCheck.js';
import type { SynthClaim, VerifyCitation } from './types.js';

/** Bump on ANY change to the system/prompt text below (artifact provenance). */
export const VERIFIER_PROMPT_VERSION = 'verifier-2026-08-01.2';

export const VERIFIER_SYSTEM = [
  "You are the ourobion brain pipeline's adversarial edge-verification node (A10).",
  'A DIFFERENT model read ONE paper and synthesised a RelationshipClaim between two health',
  'metrics from it. Your job is NOT to agree — it is to REFUTE the claim as a reading of THAT',
  'paper. One question decides your verdict:',
  '',
  '    Is this claim a faithful reading of the paper it cites?',
  '',
  'Rules (a second pass only earns its cost if it is adversarial and grounded):',
  '- Judge the VERDICT only from the CITED PAPER block — that paper\'s own quoted words. Those',
  '  quotes were checked character-by-character against the paper before you were called, so they',
  '  are what it really says. Never use outside knowledge or the synthesizer\'s reasoning.',
  '- Actively look for the claim OVERSTATING its own paper: direction flipped, claim-kind inflated',
  '  (an association written as a cause), effect size overstated, population overgeneralised, or a',
  '  claim about metrics the quoted words never measure. That is the refutation you are hunting.',
  '- The OTHER STUDIES block is CONTEXT FOR THE CAVEAT ONLY. It does NOT decide the verdict.',
  '  Whether other studies agree, disagree, or never mention the topic says nothing about whether',
  '  this claim reads its own paper honestly. NEVER answer "unsupported" because other studies did',
  '  not back the claim up, and never answer it because none were found — say that in "caveat".',
  '- Assign each shown OTHER study a stance: supports | refutes | mixed | mentions. This feeds the',
  '  caveat and the stored corroboration counts, not the verdict.',
  '- Verdict rules you MUST respect (they are also re-checked mechanically):',
  '    supported / partial → the cited quotes must back the claim, with the direction the paper',
  '      reports and no inflation of a correlation into a cause;',
  '    contradicted → the cited paper\'s own words must report the OPPOSITE of the claim;',
  '    if no independent retrieval ran at all → the verdict can only be "uncertain".',
  '- APPROVE WITH A CAVEAT rather than retreating to "uncertain". When the cited paper DOES back the',
  '  claim but only thinly — one paper is all there is, a weak study design, a population that does',
  '  not match, an effect size the paper never states — answer "partial" and NAME that exact',
  '  limitation in "caveat". Weak-but-real support is a qualified yes, not a shrug; burying it in',
  '  "uncertain" hides the limitation instead of stating it.',
  '- Reserve the non-approving verdicts for what they actually mean:',
  '    unsupported → the cited paper does not address this claim (the quoted words are about',
  '      something else, or about metrics the claim does not name);',
  '    contradicted → the cited paper argues AGAINST the claim;',
  '    uncertain → no retrieval ran, or the cited quotes genuinely cannot settle it.',
  '  Never use "uncertain" merely because the support is thin — that is what "caveat" is for.',
  '- The caveat must name a limitation you actually observed. Do NOT',
  '  invent one, and do NOT write a generic reassurance; it is shown to a person as a real',
  '  qualification. No limitation ⇒ "caveat": null. Write it in plain, non-clinical language,',
  '  one or two short sentences, about the EVIDENCE — not about you or your process.',
  '- A confident wrong verdict is still the worst outcome. Approving a faithful single-paper reading',
  '  WITH its caveat is not a confident verdict; approving it silently would be.',
  '- Reply with a SINGLE JSON object and nothing else (no prose, no code fences).',
].join('\n');

/** JSON contract block restated inline — keys and value shapes the reply must use. */
const CONTRACT = [
  'Reply shape (a single JSON object):',
  '{',
  '  "verdict": "supported|partial|unsupported|contradicted|uncertain",',
  '  "sourceStances": [ { "paperId": "<one of the shown OTHER paperIds>",',
  '                       "stance": "supports|refutes|mixed|mentions" } ],',
  '  "directionCheck": { "matchesClaim": <bool> },',
  '  "claimKindCheck": { "matchesClaim": <bool>,',
  '                      "supportedKind": "causal|correlational|mechanistic" },',
  '  "scopeCheck": { "mismatch": <bool>, "supportedPopulation": "<string|null>" },',
  '  "effectSizeCheck": { "matchesClaim": <bool>, "extractedSize": <number|null> },',
  '  "confidence": <0..1>,',
  '  "caveat": "<the limitation you observed, or null>"',
  '}',
  '',
  'Notes: every check block is about the CITED PAPER — directionCheck is "the cited paper reports',
  'the direction this claim asserts", claimKindCheck.supportedKind is the strongest kind its quoted',
  'words license (always one of the three words — never null), scopeCheck compares the claimed',
  'population with the one it studied, and effectSizeCheck is the size it actually reports.',
  'When the claim states NO effect ("effect: none stated") there is nothing to mismatch, so',
  'effectSizeCheck is { "matchesClaim": true, "extractedSize": null } — reserve false for a claim',
  'that asserts a size the paper does not carry. Judge these against the cited quotes, NOT against',
  'the other studies: with no other studies retrieved these are still fully answerable, and',
  'answering "false" to every check because nothing external was found is a WRONG answer.',
  'confidence is your calibrated belief in the',
  'verdict, 0..1. Study-design strength is NOT yours to state: it is taken from the source metadata.',
  'Only reference paperIds shown above — inventing a source is a rejected answer. caveat is a short',
  'plain-language sentence naming a limitation the evidence really has, or null when it has none; a',
  'caveat naming something you did not observe is discarded and replaced.',
].join('\n');

/**
 * Render one retrieved source for the OTHER-STUDIES block: header + its verbatim
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
    return head + '\n        evidence: (no passages available — this source cannot inform the caveat)';
  }
  const lines = passages.map((p) => `          - [${s.paperId} @ ${p.locator}] "${p.text}"`);
  return head + '\n        evidence (verbatim passages):\n' + lines.join('\n');
}

/** How a quote span addresses its span in the cited paper's canonical text. */
function spanLocator(span: SynthClaim['quoteSpans'][number]): string {
  if (span.locator !== null && span.locator.length > 0) return span.locator;
  if (span.charStart !== null && span.charEnd !== null) return `chars:${span.charStart}-${span.charEnd}`;
  return 'offsets not recorded';
}

/**
 * The CITED PAPER block — the only basis for the verdict.
 *
 * Built from the claim's own `quoteSpans` (grouped per cited paper, with that citation's
 * title/year/tier for context). These are the SAME spans the deterministic A9 gate checked
 * character-for-character; when `quoteCheck` says every span was found, the block says so, because
 * that is then a fact and not a promise. Without a passing block the wording stays neutral — the
 * prompt never asserts a check that did not pass.
 */
function citedPaperBlock(claim: SynthClaim, quoteCheck?: QuoteCheckBlock): string {
  const verified = quoteCheck !== undefined && quoteCheck.allPresent && quoteCheck.spansFound >= 1;
  const provenance = verified
    ? 'quoted by the claim (each one verified present verbatim in this paper, at the offsets shown,\n' +
      '        by a deterministic check that ran BEFORE this call):'
    : 'quoted by the claim (as recorded on the claim; not confirmed present by this call):';
  const byPaper = new Map<string, SynthClaim['quoteSpans'][number][]>();
  for (const span of claim.quoteSpans) {
    const list = byPaper.get(span.paperId);
    if (list === undefined) byPaper.set(span.paperId, [span]);
    else list.push(span);
  }
  if (byPaper.size === 0) {
    return '  (no quoted words on this claim — it cannot be a faithful reading of anything; answer "unsupported")';
  }
  const blocks: string[] = [];
  let i = 0;
  for (const [paperId, spans] of byPaper) {
    i++;
    const cite = claim.citations.find((c) => c.paperId === paperId);
    const yr = cite === undefined || cite.year === null ? 'n.d.' : String(cite.year);
    const head =
      `  [C${i}] paperId: ${paperId} (${yr})` +
      (cite === undefined ? '' : ` — evidenceTier ${cite.evidenceTier}, impact ${cite.impactTier}`) +
      (cite === undefined ? '' : `\n        title: ${cite.title}`) +
      (cite === undefined || cite.population === null ? '' : `\n        population studied: ${cite.population}`);
    const lines = spans.map((s) => `          - [${paperId} @ ${spanLocator(s)}] "${s.quote}"`);
    blocks.push(`${head}\n        ${provenance}\n${lines.join('\n')}`);
  }
  return blocks.join('\n');
}

/** Compact claim summary the verifier assesses against its cited paper. */
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
    `how the synthesizer read the paper: ${claim.derivation}`,
  ].join('\n');
}

/**
 * Build `{ system, prompt }` for verifying ONE claim against the paper it cites.
 *
 * `sources` are the independently retrieved OTHER studies — shown for the caveat and for the stored
 * corroboration counts, explicitly NOT as the basis of the verdict. An empty `sources` is a normal,
 * verdict-neutral outcome (grounded absence), not a reason to withhold approval; `quoteCheck` is the
 * deterministic A9 block, passed so the prompt can state that the cited quotes were verified.
 */
export function buildVerifierPrompt(
  claim: SynthClaim,
  sources: readonly VerifyCitation[],
  quoteCheck?: QuoteCheckBlock,
): { system: string; prompt: string } {
  const others =
    sources.length === 0
      ? '  (no other studies were retrieved — that is a fact about the literature search, NOT about\n' +
        '   this claim: it cannot make the claim unsupported. Name it in "caveat" if it is the\n' +
        '   limitation worth stating.)'
      : sources.map(sourceBlock).join('\n');
  const prompt = [
    'Claim under review (proposed by a DIFFERENT, decorrelated model):',
    claimBlock(claim),
    '',
    'CITED PAPER — its own words. THE ONLY BASIS FOR YOUR VERDICT:',
    citedPaperBlock(claim, quoteCheck),
    '',
    'OTHER STUDIES retrieved independently — CAVEAT CONTEXT ONLY, not the verdict:',
    others,
    '',
    CONTRACT,
  ].join('\n');
  return { system: VERIFIER_SYSTEM, prompt };
}
