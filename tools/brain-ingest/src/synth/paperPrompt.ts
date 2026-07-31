/**
 * #300 §A/§B/§C/§D · Whole-paper synthesis prompt.
 *
 * THE DEFECT THIS REPLACES. The pair-scoped prompt (`prompt.ts`) showed the model only
 * `selectPassages()` output — a keyword window built from `defaultTermsForKeys()`, which
 * just splits the snake_case metric key and drops a stoplist:
 *
 *     gut_comfort_score → ["gut", "comfort"]      ("score" stoplisted)
 *     mood_score        → ["mood"]
 *
 * Measured on doi:10.3390/nu18091412 (59,420 chars): `comfort` occurs **0** times and
 * `mood` 13, while `depress` occurs **45** and `anxi` **30**. The ~75 sentences that
 * actually mattered were never shown to the model. Two live `gpt-5` runs over two
 * well-matched papers each returned **`0 accepted, 0 rejected`** — zero claims emitted.
 *
 * WHY NOT A SYNONYM MAP. `METRIC_TERMS` (referenced twice in `passages.ts` comments) does
 * not exist anywhere in the repo, and it must not be built. A hand-maintained alias table
 * means a human has to expand the vocabulary before the system can research any new pair,
 * which defeats the automated-research premise outright. Whole-paper input DELETES the
 * problem instead of solving it: the model already knows "depressive symptoms" bears on
 * mood. Papers are 16k–82k chars ≈ 10–20k tokens, well inside context, ≈ $0.033/paper.
 *
 * WHAT THE MODEL IS ASKED FOR, per claim:
 *   - the EVIDENCE sentence, verbatim, with the section it came from (§C);
 *   - the paper's OWN stated MECHANISM, as a SECOND VERBATIM QUOTE (§B) — never a
 *     paraphrase, because a paraphrased pathway is exactly where invented biology appears;
 *   - whether the finding is the paper's own (§C) — `false` is REJECTED, not downgraded;
 *   - optionally, a rule BLUEPRINT so `rules` cards gain paper lineage (§D).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { ActiveMetricDescriptor } from './load.js';
import type { SynthPaperTarget } from './types.js';

/** Bump on ANY change to the system/prompt text below (artifact provenance). */
export const PAPER_PROMPT_VERSION = 'synthesis-whole-paper-2026-08-01.1';

export const PAPER_SYNTHESIS_SYSTEM = [
  "You are the ourobion brain pipeline's relationship-synthesis node, reading ONE paper in full.",
  'You propose relationships between named health metrics, each grounded in verbatim quotes',
  'from that paper, plus the mechanism the paper itself states.',
  '',
  'This is the highest-stakes, highest-hallucination step in the system. Obey:',
  '- `subject` and `object` MUST both be metric keys from the ACTIVE METRICS list in the',
  '  prompt. Never invent a metric, and never use a key not on that list.',
  '- Ground EVERY claim in at least one quoteSpan whose `quote` is copied',
  '  CHARACTER-FOR-CHARACTER from the paper text (same casing, spacing and punctuation).',
  '  A deterministic check rejects any quote not literally present.',
  '- The MECHANISM must be a VERBATIM QUOTE of the paper\'s own sentence explaining WHY the',
  '  relationship holds — never your own wording, never a summary, never a synthesis of two',
  '  sentences. If the paper states no mechanism, omit the mechanism span. Omitting it is',
  '  correct and expected; INVENTING one is the worst thing you can do here.',
  '- `ownFinding` must be `true` only when the result is THIS paper\'s own finding. Set it',
  '  `false` when the sentence reports someone else\'s result that this paper merely cites.',
  '  A false value causes rejection, so do not use it to hedge.',
  '- Quote the EVIDENCE from the body of the paper (Results/Discussion/Methods), not from the',
  '  Introduction or Background, where papers restate other people\'s work.',
  '- Claim the WEAKEST relation/claimKind the quote licenses: prefer',
  '  `correlates`/`correlational` unless the text explicitly shows causation or a mechanism.',
  '  Record the studied population verbatim; do not generalise it.',
  '- If the paper supports no relationship between any two ACTIVE metrics, return an empty',
  '  claims array. Proposing nothing is correct and expected.',
  '- Reply with a SINGLE JSON object and nothing else (no prose, no code fences).',
].join('\n');

/** JSON contract block restated inline — keys and value shapes the reply must use. */
const PAPER_CONTRACT = [
  'Reply shape (a single JSON object):',
  '{',
  '  "claims": [',
  '    {',
  '      "subject": "<active_metric_key>", "object": "<active_metric_key>",',
  '      "relation": "increases|decreases|modulates|correlates|confounds|no_effect",',
  '      "claimKind": "causal|correlational|mechanistic",',
  '      "effect": { "size": <number|null>, "unit": "<string|null>", "ci": [<lo>,<hi>]|null },',
  '      "population": "<verbatim studied population, or null>",',
  '      "section": "<which section the evidence quote came from, e.g. Results>",',
  '      "ownFinding": true,',
  '      "evidenceTier": 1,',
  '      "citations": [',
  '        { "paperId": "<the provided uid>", "stance": "supports|refutes|mixed|mentions" }',
  '      ],',
  '      "quoteSpans": [',
  '        { "paperId": "<the provided uid>", "role": "evidence",',
  '          "quote": "<VERBATIM sentence stating the relationship>" },',
  '        { "paperId": "<the provided uid>", "role": "mechanism",',
  '          "quote": "<VERBATIM sentence stating WHY — omit this span entirely if the paper states none>" }',
  '      ],',
  '      "derivation": "<plain language: how these quotes produce this claim>",',
  '      "blueprint": null',
  '    }',
  '  ]',
  '}',
  '',
  'evidenceTier: 1 mechanistic/in-vitro, 2 cross-sectional, 3 cohort, 4 RCT,',
  '5 meta-analysis/review. Leave charStart/charEnd out — the pipeline computes exact offsets',
  'from your quote. Omit synthesisModel/promptVersion/synthesisedAt — the pipeline stamps them.',
  'Title/year/evidenceTier on citations are overwritten from the corpus manifest, so you may',
  'omit them; only `paperId` and `stance` are read.',
].join('\n');

/**
 * Optional rule-blueprint block (#300 §D). Kept as a SEPARATE section of the prompt so the
 * claim contract above stays readable, and so a model that emits only claims is still valid.
 */
const BLUEPRINT_CONTRACT = [
  'OPTIONALLY, when a claim describes a pattern that could be recognised in a person\'s own',
  'weekly self-tracked data, set `blueprint` on that claim to:',
  '{',
  '  "ruleId": "<snake_case_id>",',
  '  "schemaVersion": 1,',
  '  "category": "hydration|gut|vector|behaviour|descriptive",',
  '  "severity": "info|notice|watch",',
  '  "scope": "cross",',
  '  "enabledPhase": "phase_2",',
  '  "metricKeys": ["<active_metric_key>", "<active_metric_key>"],',
  '  "effectiveFrom": null, "effectiveTo": null,',
  '  "status": "active", "deprecatedAt": null,',
  '  "cooldownDays": 7, "expiryDays": 14,',
  '  "condition": {',
  '    "type": "coincidence",',
  '    "metricKeys": ["<same two keys, same order as metricKeys>"],',
  '    "both": [',
  '      { "type": "trend", "metricKey": "<metricKeys[0]>", "equals": "rising|falling|stable",',
  '        "minConfidence": "low|medium|high" },',
  '      { "type": "trend", "metricKey": "<metricKeys[1]>", "equals": "rising|falling|stable",',
  '        "minConfidence": "low|medium|high" }',
  '    ],',
  '    "lagDays": null,',
  '    "minConfidence": "low|medium|high"',
  '  },',
  '  "template": {',
  '    "title": "<short observational headline>",',
  '    "body": "<observational sentence; may use {{snake_case}} placeholders>"',
  '  }',
  '}',
  '',
  'COPY RULES for template.title and template.body — these are shown to the user, and a',
  'blueprint that breaks them is discarded:',
  '- Observational only. Describe what moved together. Never diagnose, never advise, never',
  '  imply causation about the person, never name a condition or a treatment.',
  '- Say "these moved together" / "appeared alongside", not "causes", "risk of", "you should",',
  '  "indicates", "symptom of", or "deficiency".',
  '- The pipeline stamps provenance (tier `extracted` plus the paper citation) — omit it.',
].join('\n');

/**
 * Render the ACTIVE metric vocabulary the model may use as claim endpoints.
 *
 * THE KEY MUST BE UNAMBIGUOUSLY DELIMITED. The first version rendered
 * `${key}${label}${unit}`, which for a metric with a unit but NO `ui.label` collapsed to
 * `sleep_duration_min (min)` — key and unit separated by nothing but a space and a paren. A live
 * run then returned the endpoint `sleep_duration_min (min)`, which the gate correctly rejected as
 * `inactive-metric-key`. **A real claim was lost to prompt formatting**, and it hit exactly the six
 * unlabelled wearable metrics (`resting_hr_bpm`, `hrv_sdnn_ms`, `sleep_duration_min`, `spo2_pct`,
 * `body_temp_c`, `step_count`) — the ones most likely to appear in physiology papers.
 *
 * So the key is now emitted alone and QUOTED before any gloss, with annotations explicitly named.
 * The quotes are what make the boundary unmistakable even when a gloss is absent.
 */
function metricsBlock(metrics: readonly ActiveMetricDescriptor[]): string {
  const lines = metrics.map((m) => {
    const notes: string[] = [];
    if (m.label) notes.push(`means "${m.label}"`);
    if (m.unit) notes.push(`unit: ${m.unit}`);
    const gloss = notes.length > 0 ? `  — ${notes.join('; ')}` : '';
    return `  "${m.key}"${gloss}`;
  });
  return [
    'ACTIVE METRICS. `subject` and `object` MUST each be one of these keys, copied EXACTLY as',
    'written inside the quotes. Never append a unit, a label, or parentheses to a key.',
    ...lines,
  ].join('\n');
}

/**
 * Build `{ system, prompt }` for ONE paper, whole text (#300 §A).
 *
 * The full canonical text is embedded verbatim and UNMODIFIED — no windowing, no
 * truncation, no normalisation. That matters for more than recall: every quote the model
 * returns is checked against this same canonical text at exact character offsets, so
 * altering the text here would break the quote gate's offsets.
 */
export function buildPaperSynthesisPrompt(
  paper: SynthPaperTarget,
  metrics: readonly ActiveMetricDescriptor[],
  opts: { includeBlueprints?: boolean } = {},
): { system: string; prompt: string } {
  const includeBlueprints = opts.includeBlueprints ?? true;
  const prompt = [
    `PAPER uid: ${paper.paperUid}`,
    ...(paper.title ? [`title: ${paper.title}`] : []),
    `canonical text length: ${paper.text.length} chars`,
    '',
    `Cite ONLY this paperId: ${JSON.stringify(paper.paperUid)}`,
    '',
    metricsBlock(metrics),
    '',
    'FULL PAPER TEXT (quote VERBATIM from this — nothing else is checkable):',
    '<<<PAPER_TEXT',
    paper.text,
    'PAPER_TEXT',
    '',
    PAPER_CONTRACT,
    ...(includeBlueprints ? ['', BLUEPRINT_CONTRACT] : []),
  ].join('\n');
  return { system: PAPER_SYNTHESIS_SYSTEM, prompt };
}
