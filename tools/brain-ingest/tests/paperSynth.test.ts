/**
 * #300 · Whole-paper synthesis regression tests.
 *
 * These cover the requirements the issue calls out as easy to get wrong, and each test is
 * written to fail if the requirement is quietly reverted:
 *   §A  the prefilter is gone — the WHOLE paper reaches the prompt, including the sentences
 *       a `defaultTermsForKeys()` window provably missed (the measured `comfort`=0 /
 *       `depress`=45 case from the issue);
 *   §B  the mechanism is a SECOND VERBATIM QUOTE — a paraphrased mechanism is rejected;
 *   §C  `ownFinding: false` is REJECTED, not downgraded; intro-zone evidence is rejected;
 *   §D  blueprints are emitted with `tier: 'extracted'` + a paper citation stamped by US;
 *   G2  budget ceilings stop the run cleanly, and resumability never pays twice;
 *   G3  overlapping blueprints collapse to ONE with merged corroboration.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  blueprintDedupeKey,
  buildPaperSynthesisPrompt,
  creditedPapers,
  dedupeBlueprints,
  isMechanismLocator,
  processPaperSynthesisResponse,
  sectionFromLocator,
  synthesizePapers,
  paperUidsAlreadySynthesised,
  appendBlueprintsToDir,
  MECHANISM_LOCATOR_PREFIX,
} from '../src/synth/index.js';
import type { ActiveMetricDescriptor } from '../src/synth/load.js';
import type { PaperCitationMetadata, SynthBlueprintRecord } from '../src/synth/types.js';

// ─── fixtures ────────────────────────────────────────────────────────────────

const PAPER_UID = 'doi:10.3390/nu18091412';

/**
 * A paper shaped like the real measured failure: the metric-key-derived terms ("comfort")
 * never appear, while the words the paper actually uses ("depressive", "bloating") do — and
 * the load-bearing sentences sit past the intro zone.
 */
const INTRO = 'Introduction. Previous work by Smith et al. reported that gut flora alter mood. '.repeat(6);
const BODY = [
  'Results. Participants reporting less bloating also reported fewer depressive symptoms over the eight-week period.',
  'Discussion. Gut microbes synthesise neurotransmitter precursors that signal to the brain via the vagus nerve.',
].join(' ');
const PAPER_TEXT = `${INTRO}${BODY}`;

const EVIDENCE_QUOTE =
  'Participants reporting less bloating also reported fewer depressive symptoms over the eight-week period.';
const MECHANISM_QUOTE =
  'Gut microbes synthesise neurotransmitter precursors that signal to the brain via the vagus nerve.';

const METRICS: ActiveMetricDescriptor[] = [
  { key: 'gut_comfort_score', label: 'Gut comfort', unit: null },
  { key: 'mood_score', label: 'Mood', unit: null },
];
const ACTIVE = new Set(METRICS.map((m) => m.key));

const METADATA = new Map<string, PaperCitationMetadata>([
  [PAPER_UID, { title: 'Diet-Microbiome-Brain Axis and Mental Health', year: 2026, evidenceTier: 3 }],
]);

const TEXTS = new Map([[PAPER_UID, PAPER_TEXT]]);

/** Permissive stand-ins for the shared gates (the real ones are exercised by their own suites). */
const passClaim = (claim: unknown) => claim as never;
const passCopy = () => true;
const passBlueprint = (bp: unknown) => bp as Record<string, unknown>;

const ctx = (over: Record<string, unknown> = {}) =>
  ({
    paperUid: PAPER_UID,
    texts: TEXTS,
    paperMetadata: METADATA,
    activeMetricKeys: ACTIVE,
    validateClaim: passClaim,
    validateCopy: passCopy,
    validateBlueprint: passBlueprint,
    synthesisModel: 'gpt-5',
    promptVersion: 'test-1',
    now: () => 1_780_000_000_000,
    ...over,
  }) as never;

const claim = (over: Record<string, unknown> = {}) => ({
  subject: 'gut_comfort_score',
  object: 'mood_score',
  relation: 'correlates',
  claimKind: 'correlational',
  population: 'adults in Singapore',
  section: 'Results',
  ownFinding: true,
  citations: [{ paperId: PAPER_UID, stance: 'supports' }],
  quoteSpans: [{ paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE }],
  derivation: 'the sentence reports the two measures moving together',
  ...over,
});

const reply = (claims: unknown[]) => JSON.stringify({ claims });

// ─── §A · whole paper in, prefilter gone ─────────────────────────────────────

test('#300 §A: the WHOLE paper reaches the prompt, including sentences the keyword prefilter missed', () => {
  const { prompt } = buildPaperSynthesisPrompt(
    { paperUid: PAPER_UID, title: 'T', text: PAPER_TEXT },
    METRICS,
  );

  // The full text is present verbatim and unmodified — quote offsets depend on that.
  assert.ok(prompt.includes(PAPER_TEXT), 'the entire canonical text must be embedded verbatim');

  // The exact defect from the issue: 'comfort' never occurs in this paper, so a
  // defaultTermsForKeys(['gut_comfort_score']) window could not have surfaced the evidence
  // sentence. Whole-paper input does.
  assert.equal(PAPER_TEXT.toLowerCase().includes('comfort'), false, 'fixture mirrors comfort=0');
  assert.ok(PAPER_TEXT.includes('depressive'), 'fixture mirrors depress>0');
  assert.ok(prompt.includes(EVIDENCE_QUOTE), 'the sentence the prefilter missed must be visible');

  // The vocabulary is the registry, not a hand-maintained synonym table.
  assert.ok(prompt.includes('gut_comfort_score'));
  assert.ok(prompt.includes('Gut comfort'), 'registry ui.label grounds the key in prose terms');
});

test('#371: producer uses the engine phase and renderer-supported template placeholders', () => {
  const { prompt } = buildPaperSynthesisPrompt(
    { paperUid: PAPER_UID, title: 'T', text: PAPER_TEXT },
    METRICS,
  );
  assert.ok(prompt.includes('"enabledPhase": "phase2_engine"'));
  assert.equal(prompt.includes('"enabledPhase": "phase_2"'), false);
  for (const key of ['{{metric_a_label}}', '{{metric_b_label}}', '{{lag_days}}']) {
    assert.ok(prompt.includes(key), `prompt must name ${key}`);
  }
  assert.ok(prompt.includes('Never put a raw metric key'));
  assert.ok(prompt.includes('does not supply arbitrary metric-key placeholders'));
});

test('#300 §A: no METRIC_TERMS-style synonym map is consulted or required', () => {
  // The whole-paper prompt builder takes ONLY the paper and the registry catalogue. If a synonym
  // map were reintroduced it would have to appear as another parameter or import here.
  const built = buildPaperSynthesisPrompt({ paperUid: 'p', title: null, text: 'x' }, METRICS);
  assert.ok(built.prompt.length > 0);

  // Assert over CODE, not prose: both modules deliberately *discuss* METRIC_TERMS and the
  // prefilter in their docstrings to explain why they are gone, so a naive whole-file regex
  // would match the explanation and never fail for the right reason.
  const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  for (const file of ['paperPrompt.ts', 'paperPostprocess.ts', 'paperRun.ts']) {
    const code = stripComments(readFileSync(new URL(`../src/synth/${file}`, import.meta.url), 'utf8'));
    assert.equal(/METRIC_TERMS/.test(code), false, `${file} must not gain a synonym map`);
    assert.equal(/selectPassages/.test(code), false, `${file} must not call the keyword prefilter`);
    assert.equal(
      /defaultTermsForKeys/.test(code),
      false,
      `${file} must not derive search terms by splitting the metric key`,
    );
  }
});

test('#300: the new synth sources carry NO literal NUL byte (runtime NUL separators only)', () => {
  // The blueprint dedupe key uses a NUL separator at RUNTIME, exactly as claimDedupeKey does —
  // but via the two-character `\0` source escape. A literal 0x00 byte in the source makes git
  // treat the file as binary (which broke the Run 4 product-delta measurement outright) and makes
  // ripgrep skip it silently. This guard mirrors the existing artifact.ts NUL test.
  for (const file of [
    'blueprint.ts',
    'blueprintArtifact.ts',
    'paperPostprocess.ts',
    'paperPrompt.ts',
    'paperRun.ts',
  ]) {
    const bytes = readFileSync(new URL(`../src/synth/${file}`, import.meta.url));
    assert.equal(bytes.includes(0x00), false, `${file} must contain no literal NUL byte`);
  }
  // ...while the key it builds still separates with a real NUL at runtime.
  assert.ok(blueprintDedupeKey(BLUEPRINT).includes('\0'), 'the runtime separator is still a NUL');
});

test('#300 G2: a malformed budget ceiling is REFUSED, never silently treated as no ceiling', async () => {
  const { main } = await import('../src/cli.js');
  const errors: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  (process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    errors.push(s);
    return true;
  };
  try {
    // `parseArgs` files `--max-usd -5` under flags (the next token starts with '-'), so reading
    // only `options` would mean "uncapped". A spend guard must never fail open.
    for (const argv of [
      ['synthesize-papers', '--paper', 'p1', '--max-usd', '-5'],
      ['synthesize-papers', '--paper', 'p1', '--max-calls'],
    ]) {
      errors.length = 0;
      assert.equal(await main(argv), 2, `${argv.join(' ')} must exit 2, not run uncapped`);
      assert.match(errors.join(''), /needs a non-negative value|must be a non-negative number/);
    }
  } finally {
    (process.stderr as unknown as { write: typeof write }).write = write;
  }
});

test('#300 §A: an UNLABELLED metric key stays unambiguous next to its unit', () => {
  // Regression. The first metricsBlock rendered `${key}${label}${unit}`, so a metric with a unit
  // and NO ui.label collapsed to `sleep_duration_min (min)`. A live gpt-5 run then returned the
  // endpoint "sleep_duration_min (min)" and the gate rejected it as inactive-metric-key — a REAL
  // claim lost to prompt formatting, hitting exactly the six unlabelled wearable metrics.
  const unlabelled: ActiveMetricDescriptor[] = [
    { key: 'sleep_duration_min', label: null, unit: 'min' },
    { key: 'hrv_sdnn_ms', label: null, unit: 'ms' },
    { key: 'mood_score', label: 'Mood', unit: null },
  ];
  const { prompt } = buildPaperSynthesisPrompt(
    { paperUid: 'p', title: null, text: 'x' },
    unlabelled,
  );

  // The key appears quoted and whole, so its boundary cannot be misread.
  assert.ok(prompt.includes('"sleep_duration_min"'), 'the key must appear quoted and intact');
  assert.ok(prompt.includes('"hrv_sdnn_ms"'), 'the key must appear quoted and intact');
  // The exact corrupted form the live run produced must NOT be renderable.
  assert.equal(
    prompt.includes('sleep_duration_min (min)'),
    false,
    'key and unit must never be adjacent with no delimiter',
  );
  // The unit is still conveyed, just unmistakably separated from the key.
  assert.ok(/unit: min/.test(prompt), 'the unit is still available to the model');
  assert.ok(prompt.includes('means "Mood"'), 'a label is still conveyed when present');
});

// ─── §B · mechanism as a second verbatim quote ───────────────────────────────

test('#300 §B: the mechanism rides quoteSpans as a SECOND VERBATIM quote, marked via locator', () => {
  const result = processPaperSynthesisResponse(
    reply([
      claim({
        quoteSpans: [
          { paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE },
          { paperId: PAPER_UID, role: 'mechanism', mechanismIsPathway: true, quote: MECHANISM_QUOTE },
        ],
      }),
    ]),
    ctx(),
  );

  assert.equal(result.rejected.length, 0, JSON.stringify(result.rejected));
  assert.equal(result.accepted.length, 1);
  const spans = result.accepted[0]!.quoteSpans;
  assert.equal(spans.length, 2);

  const mechanism = spans.find((s) => isMechanismLocator(s.locator))!;
  assert.ok(mechanism, 'a mechanism span must be identifiable from the locator alone');
  assert.equal(mechanism.locator, `${MECHANISM_LOCATOR_PREFIX}Results`);
  assert.equal(sectionFromLocator(mechanism.locator), 'Results');

  // Verbatim at exact offsets in the canonical text — the whole point of §B.
  assert.equal(
    PAPER_TEXT.slice(mechanism.charStart!, mechanism.charEnd!),
    MECHANISM_QUOTE,
    'the mechanism must be recoverable verbatim from the canonical text at its stated offsets',
  );

  // `role` is a prompt convenience, folded into locator and dropped from the contract record.
  assert.equal((mechanism as unknown as Record<string, unknown>)['role'], undefined);
});

test('#307 D2: an UNDECLARED mechanism span is demoted to evidence, not labelled a mechanism', () => {
  // A live run quoted "This lack of association may be due to the limited variability in sleep
  // quality in this population and the small sample size." — verbatim, so the quote gate passed it,
  // and labelled it a mechanism. That is a statement about the STUDY; on a card it would tell a
  // reader their body works a certain way when the paper only said its sample was too small.
  //
  // Judging biology-vs-methodology is a JUDGEMENT, so it belongs to the model, which holds the whole
  // paper. The label is now applied only on an explicit `mechanismIsPathway: true` declaration.
  // Without it the span is DEMOTED — the quote survives as ordinary evidence, we simply stop
  // asserting it is the mechanism. Under-claiming, never mislabelling.
  const result = processPaperSynthesisResponse(
    reply([
      claim({
        quoteSpans: [
          { paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE },
          // role says mechanism, but the model did NOT declare it a pathway
          { paperId: PAPER_UID, role: 'mechanism', quote: MECHANISM_QUOTE },
        ],
      }),
    ]),
    ctx(),
  );

  assert.equal(result.rejected.length, 0, 'the claim itself must still be accepted');
  assert.equal(result.accepted.length, 1);
  const spans = result.accepted[0]!.quoteSpans;
  assert.equal(spans.length, 2, 'the quote is kept, not dropped');
  assert.equal(
    spans.filter((s) => isMechanismLocator(s.locator)).length,
    0,
    'an undeclared span must NOT carry the mechanism label',
  );
  // ...and it is still a usable, verbatim evidence span at exact offsets.
  const demoted = spans[1]!;
  assert.equal(PAPER_TEXT.slice(demoted.charStart!, demoted.charEnd!), MECHANISM_QUOTE);
});

test('#307 D2: a DECLARED mechanism span keeps the label', () => {
  const result = processPaperSynthesisResponse(
    reply([
      claim({
        quoteSpans: [
          { paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE },
          { paperId: PAPER_UID, role: 'mechanism', mechanismIsPathway: true, quote: MECHANISM_QUOTE },
        ],
      }),
    ]),
    ctx(),
  );
  assert.equal(result.accepted.length, 1);
  assert.equal(
    result.accepted[0]!.quoteSpans.filter((s) => isMechanismLocator(s.locator)).length,
    1,
  );
});

test('#300 §B: a PARAPHRASED mechanism is rejected — invented biology cannot survive', () => {
  const paraphrased =
    'Gut bacteria produce serotonin which crosses the blood-brain barrier and lifts mood.';
  assert.equal(PAPER_TEXT.includes(paraphrased), false, 'the paraphrase is genuinely not in the paper');

  const result = processPaperSynthesisResponse(
    reply([
      claim({
        quoteSpans: [
          { paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE },
          { paperId: PAPER_UID, role: 'mechanism', mechanismIsPathway: true, quote: paraphrased },
        ],
      }),
    ]),
    ctx(),
  );

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]!.reason, 'quote-not-found');
});

// ─── §C · ownFinding + intro zone ────────────────────────────────────────────

test('#300 §C: ownFinding:false is REJECTED, not downgraded', () => {
  const result = processPaperSynthesisResponse(reply([claim({ ownFinding: false })]), ctx());

  assert.equal(result.accepted.length, 0, 'a cited-from-elsewhere finding must not be admitted at all');
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]!.reason, 'not-own-finding');
  assert.match(result.rejected[0]!.detail, /rejected, not downgraded/);
});

test('#300 §C: a missing/non-true ownFinding is rejected rather than assumed', () => {
  for (const value of [undefined, null, 'true', 1]) {
    const c = claim();
    if (value === undefined) delete (c as Record<string, unknown>)['ownFinding'];
    else (c as Record<string, unknown>)['ownFinding'] = value;
    const result = processPaperSynthesisResponse(reply([c]), ctx());
    assert.equal(result.accepted.length, 0, `ownFinding=${JSON.stringify(value)} must not be accepted`);
    assert.equal(result.rejected[0]!.reason, 'not-own-finding');
  }
});

test('#300 §C: evidence quoted from the leading intro zone is rejected; the mechanism span is exempt', () => {
  const introSentence = 'Previous work by Smith et al. reported that gut flora alter mood.';
  assert.ok(PAPER_TEXT.indexOf(introSentence) < Math.floor(PAPER_TEXT.length * 0.15));

  const rejectedRun = processPaperSynthesisResponse(
    reply([claim({ quoteSpans: [{ paperId: PAPER_UID, role: 'evidence', quote: introSentence }] })]),
    ctx(),
  );
  assert.equal(rejectedRun.accepted.length, 0);
  assert.equal(rejectedRun.rejected[0]!.reason, 'intro-zone-quote');

  // The same early sentence used as the MECHANISM is fine: it is still the paper's own words at
  // exact offsets, and papers routinely state the pathway they build on up front.
  const acceptedRun = processPaperSynthesisResponse(
    reply([
      claim({
        quoteSpans: [
          { paperId: PAPER_UID, role: 'evidence', quote: EVIDENCE_QUOTE },
          { paperId: PAPER_UID, role: 'mechanism', mechanismIsPathway: true, quote: introSentence },
        ],
      }),
    ]),
    ctx(),
  );
  assert.equal(acceptedRun.rejected.length, 0, JSON.stringify(acceptedRun.rejected));
  assert.equal(acceptedRun.accepted.length, 1);
});

test('#300 §A/§C: endpoints must be ACTIVE registry keys — the registry replaces pair-scoping', () => {
  const inactive = processPaperSynthesisResponse(
    reply([claim({ object: 'not_a_registry_metric' })]),
    ctx(),
  );
  assert.equal(inactive.accepted.length, 0);
  assert.equal(inactive.rejected[0]!.reason, 'inactive-metric-key');

  const selfEdge = processPaperSynthesisResponse(
    reply([claim({ object: 'gut_comfort_score' })]),
    ctx(),
  );
  assert.equal(selfEdge.accepted.length, 0);
  assert.equal(selfEdge.rejected[0]!.reason, 'inactive-metric-key');
});

test('#300: a foreign paperId is rejected, and corpus metadata overwrites model-supplied citation fields', () => {
  const foreign = processPaperSynthesisResponse(
    reply([claim({ citations: [{ paperId: 'doi:10.9999/fake', stance: 'supports' }] })]),
    ctx(),
  );
  assert.equal(foreign.accepted.length, 0);
  assert.equal(foreign.rejected[0]!.reason, 'foreign-paper');

  const trusted = processPaperSynthesisResponse(
    reply([
      claim({
        citations: [{ paperId: PAPER_UID, stance: 'supports', title: 'LIES', year: 1900, evidenceTier: 5 }],
      }),
    ]),
    ctx(),
  );
  assert.equal(trusted.accepted.length, 1);
  const citation = trusted.accepted[0]!.citations[0]!;
  assert.equal(citation.title, 'Diet-Microbiome-Brain Axis and Mental Health');
  assert.equal(citation.year, 2026);
  assert.equal(citation.evidenceTier, 3, 'evidenceTier comes from the corpus classifier, not the model');
});

// ─── §D · blueprint emission ─────────────────────────────────────────────────

const BLUEPRINT = {
  ruleId: 'gut_comfort_mood_together',
  schemaVersion: 1,
  category: 'gut',
  severity: 'info',
  scope: 'cross',
  enabledPhase: 'phase2_engine',
  metricKeys: ['gut_comfort_score', 'mood_score'],
  effectiveFrom: null,
  effectiveTo: null,
  status: 'active',
  deprecatedAt: null,
  cooldownDays: 7,
  expiryDays: 14,
  condition: {
    type: 'coincidence',
    metricKeys: ['gut_comfort_score', 'mood_score'],
    both: [
      { type: 'trend', metricKey: 'gut_comfort_score', equals: 'rising', minConfidence: 'low' },
      { type: 'trend', metricKey: 'mood_score', equals: 'rising', minConfidence: 'low' },
    ],
    lagDays: null,
    minConfidence: 'low',
  },
  template: { title: 'Gut comfort and mood rose together', body: 'These moved together this week.' },
};

test("#300 §D: an emitted blueprint is stamped tier:'extracted' with OUR paper citation, not the model's", () => {
  const result = processPaperSynthesisResponse(reply([claim({ blueprint: BLUEPRINT })]), ctx());

  assert.equal(result.accepted.length, 1);
  assert.equal(result.acceptedBlueprints?.length, 1);
  const record = result.acceptedBlueprints![0]!;
  const provenance = record.blueprint['provenance'] as Record<string, unknown>;
  assert.equal(provenance['tier'], 'extracted');
  assert.deepEqual(provenance['citation'], { paperId: PAPER_UID, locator: 'Results' });
  assert.match(String(provenance['sourceNote']), /gpt-5/);
  assert.equal(record.paperId, PAPER_UID);
});

test('#300 §D: a model-supplied provenance cannot forge lineage — ours overwrites it', () => {
  const result = processPaperSynthesisResponse(
    reply([
      claim({
        blueprint: {
          ...BLUEPRINT,
          provenance: { tier: 'hand_authored', sourceNote: 'trust me', citation: null },
        },
      }),
    ]),
    ctx(),
  );
  const provenance = result.acceptedBlueprints![0]!.blueprint['provenance'] as Record<string, unknown>;
  assert.equal(provenance['tier'], 'extracted');
  assert.notEqual(provenance['sourceNote'], 'trust me');
  assert.deepEqual(provenance['citation'], { paperId: PAPER_UID, locator: 'Results' });
});

test('#300 §D: a rejected blueprint does NOT cost the claim its acceptance', () => {
  const result = processPaperSynthesisResponse(
    reply([claim({ blueprint: { ...BLUEPRINT, metricKeys: ['bogus_metric'] } })]),
    ctx(),
  );
  assert.equal(result.accepted.length, 1, 'the edge survives a bad rule template');
  assert.equal(result.acceptedBlueprints?.length, 0);
  assert.equal(result.rejectedBlueprints?.[0]?.reason, 'inactive-metric-key');
});

test('#300 §D: a blueprint failing the shared zod gate is rejected with its reason', () => {
  const throwing = () => {
    throw new Error('template.body fails validateCopyString (diagnostic language)');
  };
  const result = processPaperSynthesisResponse(
    reply([claim({ blueprint: BLUEPRINT })]),
    ctx({ validateBlueprint: throwing }),
  );
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejectedBlueprints?.[0]?.reason, 'schema-invalid');
  assert.match(result.rejectedBlueprints![0]!.detail, /validateCopyString/);
});

// ─── G3 · blueprint dedupe ───────────────────────────────────────────────────

const recordFor = (blueprint: Record<string, unknown>, paperId: string): SynthBlueprintRecord => ({
  blueprint,
  dedupeKey: blueprintDedupeKey(blueprint),
  paperId,
  synthesisModel: 'gpt-5',
  promptVersion: 'test-1',
  synthesisedAt: '2026-08-01T00:00:00.000Z',
});

test('#300 G3: the dedupe key is metric pair + condition shape + direction, ignoring ruleId', () => {
  const a = blueprintDedupeKey(BLUEPRINT);
  const renamed = blueprintDedupeKey({ ...BLUEPRINT, ruleId: 'totally_different_id' });
  assert.equal(a, renamed, 'a different ruleId must NOT create a second near-identical card');

  // Order of the pair does not matter; direction does.
  const swapped = blueprintDedupeKey({
    ...BLUEPRINT,
    condition: {
      ...BLUEPRINT.condition,
      metricKeys: ['mood_score', 'gut_comfort_score'],
      both: [BLUEPRINT.condition.both[1], BLUEPRINT.condition.both[0]],
    },
  });
  assert.equal(a, swapped, 'the same pair in the other order is the same rule');

  const opposite = blueprintDedupeKey({
    ...BLUEPRINT,
    condition: {
      ...BLUEPRINT.condition,
      both: [
        BLUEPRINT.condition.both[0],
        { type: 'trend', metricKey: 'mood_score', equals: 'falling', minConfidence: 'low' },
      ],
    },
  });
  assert.notEqual(a, opposite, 'opposite directions are genuinely different findings');

  const lagged = blueprintDedupeKey({
    ...BLUEPRINT,
    condition: { ...BLUEPRINT.condition, lagDays: 3 },
  });
  assert.notEqual(a, lagged, 'a lagged coincidence is a different finding');
});

test('#300 G3: overlapping blueprints from 3 papers collapse to ONE with merged corroboration', () => {
  const records = [
    recordFor({ ...BLUEPRINT, provenance: { tier: 'extracted', sourceNote: 'from A', citation: { paperId: 'paper:A', locator: null } } }, 'paper:A'),
    recordFor({ ...BLUEPRINT, ruleId: 'other_id', provenance: { tier: 'extracted', sourceNote: 'from B', citation: { paperId: 'paper:B', locator: null } } }, 'paper:B'),
    recordFor({ ...BLUEPRINT, ruleId: 'third_id', provenance: { tier: 'extracted', sourceNote: 'from C', citation: { paperId: 'paper:C', locator: null } } }, 'paper:C'),
  ];

  const { toWrite, merged } = dedupeBlueprints(new Set(), records);

  assert.equal(toWrite.length, 1, '20 papers must not yield 20 near-identical cards');
  assert.equal(merged.length, 2);
  const note = String((toWrite[0]!.blueprint['provenance'] as Record<string, unknown>)['sourceNote']);
  assert.match(note, /corroborated by paper:B, paper:C/);
  assert.deepEqual(creditedPapers(toWrite[0]!.blueprint).sort(), ['paper:A', 'paper:B', 'paper:C']);

  // The surviving blueprint keeps the FIRST paper as its gated citation.
  const citation = (toWrite[0]!.blueprint['provenance'] as Record<string, unknown>)['citation'] as Record<string, unknown>;
  assert.equal(citation['paperId'], 'paper:A');
});

test('#300 G3: a dedupe key already in the artifact is not re-emitted on a re-run', () => {
  const record = recordFor(BLUEPRINT, 'paper:A');
  const { toWrite, merged } = dedupeBlueprints(new Set([record.dedupeKey]), [record]);
  assert.equal(toWrite.length, 0);
  assert.equal(merged.length, 1);
});

test('#300 G3: appending the same blueprint batch twice writes nothing the second time', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-bp-'));
  const first = appendBlueprintsToDir(dir, [recordFor(BLUEPRINT, 'paper:A')]);
  assert.equal(first.written, 1);
  const second = appendBlueprintsToDir(dir, [recordFor(BLUEPRINT, 'paper:A')]);
  assert.equal(second.written, 0, 'idempotent — a re-run cannot duplicate a rule');
  assert.equal(readFileSync(first.path, 'utf8').trim().split('\n').length, 1);
});

// ─── G1/G2 · batch, budget ceilings, resumability ────────────────────────────

/** The uid the whole-paper prompt names, so a mock reply can cite the RIGHT paper. */
const uidFromPrompt = (prompt: string): string => /PAPER uid: (\S+)/.exec(prompt)?.[1] ?? '';

/** A one-claim reply citing whichever paper the prompt was built for. */
const replyForPrompt = (prompt: string): string => {
  const uid = uidFromPrompt(prompt);
  return reply([
    claim({
      citations: [{ paperId: uid, stance: 'supports' }],
      quoteSpans: [{ paperId: uid, role: 'evidence', quote: EVIDENCE_QUOTE }],
    }),
  ]);
};

const routerFor = (perCall: { inputTokens: number; outputTokens: number }) => ({
  calls: [] as string[],
  async route(req: { prompt: string }) {
    this.calls.push(req.prompt);
    return {
      text: replyForPrompt(req.prompt),
      usage: perCall,
      model: 'gpt-5',
      modelIdentity: {
        model: 'gpt-5',
        source: 'provider-response' as const,
        providerAttested: true,
        family: 'openai' as const,
        returnedVersion: null,
        decorrelatedFromSynthesis: null,
      },
      route: 'api_worker' as const,
    };
  },
});

const ROUTER_CONFIG = {
  // `nodes.synthesis.model` is the fallback rate used when the provider-ATTESTED id (e.g. the
  // dated snapshot `gpt-5-2025-08-07`) has no prices[] row of its own — see paperRun.ts. Without
  // it a real run accounted US$0 for genuine spend, making --max-usd decorative.
  nodes: { synthesis: { model: 'gpt-5' } },
  prices: { 'gpt-5': { inputUsdPerMTok: 1_000_000, outputUsdPerMTok: 0 } },
} as never;

const batchOpts = (over: Record<string, unknown> = {}) => ({
  paperUids: ['p1', 'p2', 'p3'],
  textLoader: async () => PAPER_TEXT,
  paperMetadata: new Map(
    ['p1', 'p2', 'p3'].map((uid) => [uid, { title: uid, year: 2026, evidenceTier: 3 as const }]),
  ),
  activeMetricKeys: ACTIVE,
  metricCatalogue: METRICS,
  validateClaim: passClaim,
  validateCopy: passCopy,
  validateBlueprint: passBlueprint,
  routerConfig: ROUTER_CONFIG,
  emitBlueprints: false,
  now: () => 1_780_000_000_000,
  ...over,
});

test('#300 G1: one process, N papers, N calls — serial, one call per paper', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  const router = routerFor({ inputTokens: 0, outputTokens: 0 });

  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, texts: undefined }) as never,
  );

  assert.equal(router.calls.length, 3, 'exactly one provider call per paper');
  assert.equal(result.budget.providerCalls, 3);
  assert.equal(result.budget.papersSynthesised, 3);
  assert.equal(result.budget.stopReason, 'completed');
});

test('#300 whole-paper push publishes the blueprint before its claim', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  const puts: string[] = [];
  const r2Store = {
    async getObjectText() {
      throw new Error('missing');
    },
    async putObject(key: string) {
      puts.push(key);
      return { key, sha256: 'test', sizeBytes: 1 };
    },
  };
  const router = {
    async route() {
      return {
        text: JSON.stringify({
          claims: [
            claim({
              citations: [{ paperId: 'p1', stance: 'supports' }],
              quoteSpans: [{ paperId: 'p1', role: 'evidence', quote: EVIDENCE_QUOTE }],
              blueprint: BLUEPRINT,
            }),
          ],
        }),
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'gpt-5',
        modelIdentity: {
          model: 'gpt-5',
          source: 'provider-response' as const,
          providerAttested: true,
          family: 'openai' as const,
          returnedVersion: null,
          decorrelatedFromSynthesis: null,
        },
        route: 'api_worker' as const,
      };
    },
  };

  const result = await synthesizePapers(
    batchOpts({
      edgesDir: dir,
      paperUids: ['p1'],
      router,
      emitBlueprints: true,
      pushR2: true,
      r2Store,
    }) as never,
  );

  assert.deepEqual(puts, ['edges/blueprints.jsonl', 'edges/claims.jsonl']);
  assert.equal(result.blueprintR2?.written, 1);
  assert.equal(result.r2?.written, 1);
});

test('#300 G2: a call ceiling stops the run CLEANLY and reports how to resume', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  const router = routerFor({ inputTokens: 0, outputTokens: 0 });

  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, maxCalls: 2 }) as never,
  );

  assert.equal(router.calls.length, 2, 'the ceiling is enforced BEFORE the third call, not after');
  assert.equal(result.budget.stopReason, 'call-ceiling');
  assert.equal(result.budget.papersSynthesised, 2);
  assert.equal(result.budget.papersNotReached, 1);
  assert.equal(result.perPaper.at(-1)!.status, 'not-reached');
  // Papers that DID complete keep their output — no half-written all-or-nothing failure.
  assert.ok(result.accepted.length >= 2);
});

test('#300 G2: a USD ceiling stops the run cleanly, priced with the router\'s own config', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  // 1 input token at $1,000,000/MTok = $1.00 per call, so a $1.50 ceiling allows exactly 2 calls.
  const router = routerFor({ inputTokens: 1, outputTokens: 0 });

  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, maxUsd: 1.5 }) as never,
  );

  assert.equal(router.calls.length, 2);
  assert.equal(result.budget.stopReason, 'budget-ceiling');
  assert.ok(Math.abs(result.budget.usdSpent - 2) < 1e-9, `spent ${result.budget.usdSpent}`);
  assert.equal(result.budget.papersNotReached, 1);
});

test('#300 G2: resumability — a paper already in claims.jsonl is skipped with NO provider call', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  mkdirSync(dir, { recursive: true });
  // Pre-seed the artifact as a previous run would have left it.
  writeFileSync(
    join(dir, 'claims.jsonl'),
    JSON.stringify({
      edgeId: 'a|correlates|b',
      citations: [{ paperId: 'p1' }],
      promptVersion: 'test-1',
    }) + '\n',
    'utf8',
  );
  assert.ok(paperUidsAlreadySynthesised(join(dir, 'claims.jsonl')).has('p1'));

  const router = routerFor({ inputTokens: 0, outputTokens: 0 });
  const result = await synthesizePapers(batchOpts({ edgesDir: dir, router }) as never);

  assert.equal(router.calls.length, 2, 'p1 must cost nothing on the re-run — never pay twice');
  assert.equal(result.budget.papersSkippedAlreadyDone, 1);
  assert.equal(result.perPaper.find((p) => p.paperUid === 'p1')!.status, 'skipped-already-done');
});

test('#300 G2: --no-resume re-synthesises an already-present paper', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  writeFileSync(
    join(dir, 'claims.jsonl'),
    JSON.stringify({ edgeId: 'a|correlates|b', citations: [{ paperId: 'p1' }], promptVersion: 'v' }) + '\n',
    'utf8',
  );
  const router = routerFor({ inputTokens: 0, outputTokens: 0 });
  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, resume: false }) as never,
  );
  assert.equal(router.calls.length, 3);
  assert.equal(result.budget.papersSkippedAlreadyDone, 0);
});

test('#300 G1: one unparseable reply does not discard the papers that succeeded', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  let n = 0;
  const router = {
    calls: [] as string[],
    async route(req: { prompt: string }) {
      this.calls.push(req.prompt);
      n += 1;
      return {
        text: n === 2 ? 'not json at all' : replyForPrompt(req.prompt),
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'gpt-5',
        modelIdentity: {
          model: 'gpt-5',
          source: 'provider-response' as const,
          providerAttested: true,
          family: 'openai' as const,
          returnedVersion: null,
          decorrelatedFromSynthesis: null,
        },
        route: 'api_worker' as const,
      };
    },
  };

  const result = await synthesizePapers(batchOpts({ edgesDir: dir, router }) as never);

  assert.equal(router.calls.length, 3, 'the batch continues past the bad paper');
  assert.equal(result.perPaper.filter((p) => p.status === 'failed').length, 1);
  assert.equal(result.perPaper.filter((p) => p.status === 'synthesised').length, 2);
  assert.ok(result.accepted.length >= 2, 'the good papers still produced claims');
});

test('#300 G6: corpus metadata is resolved ONCE per run, not once per paper', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  const router = routerFor({ inputTokens: 0, outputTokens: 0 });

  // Goal 1 roughly triples the corpus to ~3,000 papers. The requirement is that per-paper work
  // stays independent of corpus size — manifest hydration must not sit on the hot path.
  const CORPUS = 3_000;
  let lookups = 0;
  const big = new Map<string, PaperCitationMetadata>(
    Array.from({ length: CORPUS }, (_, i) => [
      `p${i}`,
      { title: `paper ${i}`, year: 2026, evidenceTier: 3 as const },
    ]),
  );
  const counting: ReadonlyMap<string, PaperCitationMetadata> = {
    get size() {
      return big.size;
    },
    has(key: string) {
      lookups += 1;
      return big.has(key);
    },
    get(key: string) {
      lookups += 1;
      return big.get(key);
    },
    keys: () => big.keys(),
    values: () => big.values(),
    entries: () => big.entries(),
    forEach: big.forEach.bind(big),
    [Symbol.iterator]: () => big[Symbol.iterator](),
  } as unknown as ReadonlyMap<string, PaperCitationMetadata>;

  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, paperUids: ['p1', 'p2', 'p3'], paperMetadata: counting }) as never,
  );

  assert.equal(result.budget.papersSynthesised, 3);
  // A handful of lookups per paper is fine; anything proportional to the 3,000-paper corpus
  // would mean the manifest had crept onto the per-paper path.
  assert.ok(lookups < 100, `metadata lookups (${lookups}) must not scale with the ${CORPUS}-paper corpus`);
  assert.equal(router.calls.length, 3, 'a 3,000-paper corpus still costs exactly 3 calls for 3 papers');
});

test('#300 G2: an ATTESTED snapshot id with no price row is accounted, not silently zeroed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  // The real defect this pins: OpenAI attests a DATED SNAPSHOT ('gpt-5-2025-08-07') which has no
  // prices[] row, while only the configured id ('gpt-5') does. A live two-paper run therefore spent
  // US$0.055 and recorded US$0.000000 — so --max-usd could never fire. Accounting must fall back to
  // the configured node rate rather than treating an unpriced attested id as free.
  const router = {
    calls: [] as string[],
    async route(req: { prompt: string }) {
      this.calls.push(req.prompt);
      return {
        text: replyForPrompt(req.prompt),
        usage: { inputTokens: 1, outputTokens: 0 },
        model: 'gpt-5-2025-08-07', // attested snapshot — deliberately absent from prices[]
        modelIdentity: {
          model: 'gpt-5-2025-08-07',
          source: 'provider-response' as const,
          providerAttested: true,
          family: 'openai' as const,
          returnedVersion: null,
          decorrelatedFromSynthesis: null,
        },
        route: 'api_worker' as const,
      };
    },
  };

  const result = await synthesizePapers(
    batchOpts({ edgesDir: dir, router, paperUids: ['p1', 'p2', 'p3'], maxUsd: 1.5 }) as never,
  );

  // 1 input token at $1,000,000/MTok = $1.00 per call under the CONFIGURED gpt-5 rate, so a $1.50
  // ceiling must stop the run after two calls. If the unpriced snapshot were zeroed it would run all
  // three and report US$0.
  assert.ok(result.budget.usdSpent > 0, 'an unpriced attested id must NOT be accounted as free');
  assert.equal(result.budget.stopReason, 'budget-ceiling');
  assert.equal(router.calls.length, 2, 'the ceiling must actually fire');
});

test('#300 G2: a dry run assembles prompts, makes no call, and writes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-batch-'));
  const router = routerFor({ inputTokens: 0, outputTokens: 0 });
  const result = await synthesizePapers(batchOpts({ edgesDir: dir, router, dryRun: true }) as never);

  assert.equal(router.calls.length, 0);
  assert.equal(result.budget.providerCalls, 0);
  assert.equal(result.budget.usdSpent, 0);
  assert.equal(result.assembled?.length, 3);
  assert.equal(result.write, undefined);
});
