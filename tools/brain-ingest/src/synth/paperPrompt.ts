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
// Bumped for #307: the mechanism-vs-limitation specification (D2) and the strengthened blueprint
// ask (D1-a) both changed the prompt text, and this stamp is the artifact's provenance — claims
// synthesised under the two versions are not interchangeable and must not share a dedupe key.
export const PAPER_PROMPT_VERSION = 'synthesis-whole-paper-2026-08-02.3';

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
  '- A MECHANISM explains the BIOLOGY OR BEHAVIOUR that links the two metrics. A sentence about',
  '  the STUDY — its sample size, its statistical power, how much its participants varied, what',
  '  future work should do — is NOT a mechanism, however plainly the paper states it. Judge this',
  '  yourself; you have the whole paper and you are the only thing here that can tell the',
  '  difference. Two concrete cases:',
  '    MECHANISM     "These acute changes indicate parasympathetic activation and reduced',
  '                   physiological arousal during mindfulness practice."   <- explains the body',
  '    NOT MECHANISM "This lack of association may be due to the limited variability in sleep',
  '                   quality in this population and the small sample size."  <- explains the STUDY',
  '  The second is a limitation. Quoting it as a mechanism would tell a reader their body works a',
  '  certain way when the paper only said its own sample was too small. OMIT instead.',
  '- A `no_effect` claim takes NO mechanism span. There is no relationship, so there is no pathway',
  '  to explain, and a sentence explaining why nothing was found is a limitation, not a mechanism.',
  '- Set `"mechanismIsPathway": true` on any mechanism span you emit, as your explicit declaration',
  '  that the quote explains the biology or behaviour and is not a statement about the study. If you',
  '  cannot declare that honestly, omit the span.',
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
  '        { "paperId": "<the provided uid>", "role": "mechanism", "mechanismIsPathway": true,',
  '          "quote": "<VERBATIM sentence stating WHY — omit this span entirely if the paper states',
  '                     none, if the claim is no_effect, or if the only candidate is a statement',
  '                     about the study rather than about the biology>" }',
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
 * Rule-blueprint block (#300 §D). Kept as a SEPARATE section of the prompt so the claim contract
 * above stays readable, and so a model that emits only claims is still valid.
 *
 * #307 D1-a · The ask was STRENGTHENED after a measured yield of 1 blueprint from 15 papers, against
 * the 3–5 per paper the ≥50-card goal assumed. At the measured rate 50 cards needs ~750 papers
 * (~US$37, over the US$20 ceiling), so the goal was unreachable on prompt wording alone.
 *
 * Three things were wrong with the original wording, all of them ours:
 *   1. it opened with "OPTIONALLY", which invites skipping;
 *   2. it said "weekly self-tracked data", which reads as excluding anything measured at
 *      session scale — most HR/HRV findings — when in fact the user logs these metrics DAILY, so
 *      any co-movement is recognisable across a week regardless of the study's measurement window;
 *   3. it never said a blueprint is the thing that becomes a CARD, so the model had no way to know
 *      it was the load-bearing output rather than an optional extra.
 *
 * It is still not mandatory: a `no_effect` claim genuinely has no card to make, and forcing one
 * would manufacture a rule from an absence.
 */
const BLUEPRINT_CONTRACT = [
  'BLUEPRINTS — these become the insight cards the user actually sees, so they are the most',
  'valuable thing you produce here. EXPECTED for every claim with a DIRECTION',
  '(`increases`/`decreases`/`modulates`/`correlates`). Emit one unless you genuinely cannot.',
  '',
  'Do NOT emit one for a `no_effect` claim: there is no pattern to recognise, and inventing a rule',
  'from an absence is wrong.',
  '',
  'The person logs these metrics EVERY DAY, so a relationship measured over any window — a single',
  'session, a night, eight weeks — can still show up as two of their own metrics moving together',
  'across a week. Do not withhold a blueprint because the study measured something over minutes',
  'rather than weeks; translate the DIRECTION of the finding into a weekly pattern.',
  '',
  'Set `blueprint` on the claim to:',
  '{',
  '  "ruleId": "<snake_case_id>",',
  '  "schemaVersion": 1,',
  '  "category": "hydration|gut|vector|behaviour|descriptive",',
  '  "severity": "info|notice|watch",',
  '  "scope": "cross",',
  '  "enabledPhase": "phase2_engine",',
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
  '    "title": "<short observational headline; may use {{metric_a_label}} / {{metric_b_label}}>",',
  '    "body": "<observational sentence; may use only {{metric_a_label}}, {{metric_b_label}},',
  '             and {{lag_days}} placeholders>"',
  '  }',
  '}',
  '',
  'COPY RULES for template.title and template.body — these are shown to the user, and a',
  'blueprint that breaks them is discarded:',
  '- Observational only. Describe what moved together. Never diagnose, never advise, never',
  '  imply causation about the person, never name a condition or a treatment.',
  '- Say "these moved together" / "appeared alongside", not "causes", "risk of", "you should",',
  '  "indicates", "symptom of", or "deficiency".',
  '- Never put a raw metric key such as sleep_duration_min in user-facing copy. Use the supplied',
  '  label placeholders exactly; the renderer does not supply arbitrary metric-key placeholders.',
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
