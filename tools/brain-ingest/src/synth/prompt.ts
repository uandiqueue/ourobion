/**
 * A8 · Synthesis prompt construction (design step 2, insight-engine §A8).
 *
 * One versioned prompt per candidate pair (`PROMPT_VERSION` is the artifact's
 * provenance stamp — bump it when the text below changes). The contract handed to
 * the LLM is deliberately strict and adversary-aware because synthesis is the
 * highest hallucination-surface step (brain-synthesis-design.md "Why"):
 *   - propose claims ONLY for the ONE pair asked about (C9 — no invented edges);
 *   - ground EVERY claim in ≥1 VERBATIM quoteSpan copied character-for-character
 *     from the provided passages (a deterministic A9 quoteCheck rejects any span
 *     not literally present — the near-free hallucination catch);
 *   - cite ONLY the provided paper uids;
 *   - default to proposing NOTHING when the passages don't support an edge.
 *
 * The prompt restates the full JSON contract inline so the artifact is
 * reproducible from the mailbox request file alone.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { PaperPassages, SynthPair } from './types.js';

/** Bump on ANY change to the system/prompt text below (artifact provenance). */
export const PROMPT_VERSION = 'synthesis-2026-07-16.1';

export const SYNTHESIS_SYSTEM = [
  "You are the ourobion brain pipeline's relationship-synthesis node (A8).",
  'You read passages of scientific papers and propose RelationshipClaims between',
  'two named health metrics, grounded in verbatim quotes from those passages.',
  '',
  'This is the highest-stakes, highest-hallucination step in the system. Obey:',
  '- Propose claims ONLY for the single candidate pair named in the prompt. Never',
  '  invent other pairs, metrics, or relationships.',
  '- Ground EVERY claim in at least one quoteSpan whose `quote` is copied',
  '  CHARACTER-FOR-CHARACTER from the provided passages (same casing, spacing and',
  '  punctuation). A deterministic check rejects any quote not literally present.',
  '- Cite ONLY the paper uids provided. Never cite a paper you were not given.',
  '- `subject` and `object` MUST be the two metric keys of the candidate pair',
  '  (you choose which is subject vs object to reflect the direction the evidence',
  '  shows). `edgeId` MUST equal `${subject}|${relation}|${object}`.',
  '- Claim the WEAKEST relation/claimKind the quote licenses: prefer',
  '  `correlates`/`correlational` unless the text explicitly shows causation or a',
  '  mechanism. Record the studied population verbatim; do not generalise it.',
  '- If the passages do not support an edge for this pair, return an empty claims',
  '  array. Proposing nothing is correct and expected.',
  '- Reply with a SINGLE JSON object and nothing else (no prose, no code fences).',
].join('\n');

/** JSON contract block restated inline — keys and value shapes the reply must use. */
const CONTRACT = [
  'Reply shape (a single JSON object):',
  '{',
  '  "claims": [',
  '    {',
  '      "edgeId": "<subject>|<relation>|<object>",',
  '      "subject": "<metric_key>", "object": "<metric_key>",',
  '      "relation": "increases|decreases|modulates|correlates|confounds|no_effect",',
  '      "claimKind": "causal|correlational|mechanistic",',
  '      "effect": { "size": <number|null>, "unit": "<string|null>", "ci": [<lo>,<hi>]|null },',
  '      "population": "<verbatim studied population, or null>",',
  '      "citations": [',
  '        { "paperId": "<provided uid>", "title": "<string>", "year": <number|null>,',
  '          "population": "<verbatim per-paper population, or null>",',
  '          "evidenceTier": 1, "impactTier": "high|moderate|low|preprint",',
  '          "stance": "supports|refutes|mixed|mentions" }',
  '      ],',
  '      "quoteSpans": [',
  '        { "paperId": "<provided uid>", "quote": "<VERBATIM substring of a passage>",',
  '          "locator": "<section/figure or null>", "charStart": null, "charEnd": null }',
  '      ],',
  '      "derivation": "<plain-language: how these quotes produce this claim>"',
  '    }',
  '  ]',
  '}',
  '',
  'Notes: leave charStart/charEnd null (the pipeline backfills exact offsets from',
  'the quote check). evidenceTier: 1 mechanistic/in-vitro, 2 cross-sectional, 3',
  'cohort, 4 RCT, 5 meta-analysis/review. Omit synthesisModel/promptVersion/',
  'synthesisedAt — the pipeline stamps them.',
].join('\n');

/** Render a paper's identity + numbered passages (with offsets, for provenance). */
function paperBlock(paper: PaperPassages): string {
  const head = `PAPER uid: ${paper.paperUid}${paper.title ? `\n  title: ${paper.title}` : ''}`;
  if (paper.passages.length === 0) {
    return `${head}\n  (no passages matched the pair terms)`;
  }
  const body = paper.passages
    .map((p, i) => `  [P${i + 1} @${p.charStart}..${p.charEnd}] ${p.text}`)
    .join('\n');
  return `${head}\n${body}`;
}

/**
 * Build `{ system, prompt }` for ONE candidate pair across the provided papers.
 * The prompt names the exact allowed pair + paper uids so the post-processor's
 * unrequested-pair / foreign-paper gates have a self-describing request.
 */
export function buildSynthesisPrompt(pair: SynthPair, papers: readonly PaperPassages[]): {
  system: string;
  prompt: string;
} {
  const [a, b] = pair.metricKeys;
  const allowedIds = papers.map((p) => p.paperUid);
  const prompt = [
    `Candidate pair (the ONLY pair you may propose claims for): ${a} and ${b}.`,
    `Target: ${pair.label}`,
    '',
    `Allowed paperIds (cite ONLY these): ${JSON.stringify(allowedIds)}`,
    '',
    'Passages (quote VERBATIM from these — nothing else is checkable):',
    '',
    papers.map(paperBlock).join('\n\n'),
    '',
    CONTRACT,
  ].join('\n');
  return { system: SYNTHESIS_SYSTEM, prompt };
}
