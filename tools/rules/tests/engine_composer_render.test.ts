// S7/S8 unit vectors: the composer's branch truth table + completeness scorer (composer.ts)
// and the S8 render-time copy gate + producer namespaces (render.ts). These are the pure halves
// of the refactored generate-insights engine — Deno-free by construction, imported directly via
// tsx (the engine-stats mechanism). The live end-to-end pass is the U12 session log's evidence;
// these vectors pin the branch semantics so they cannot drift silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPattern,
  completenessScore,
  edgeDirectionConsistent,
  gapStatusFor,
  gradeApplicability,
  insightId,
  MONOTONIC_RELATIONS,
  pairKey,
  personalPassesGate,
  rendersCard,
  type CandidatePattern,
  type PersonalSignalRow,
  type ServableEdge,
} from '../../../supabase/functions/generate-insights/composer.ts';
import {
  CO_MOVEMENT_EDGE_CARD_TEMPLATE,
  CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL,
  coMovementEdgeCardTemplate,
  directionalTermsIn,
  EDGE_CARD_TEMPLATE,
  EDGE_CARD_TEMPLATE_WITH_PERSONAL,
  edgeCardTemplate,
  edgeRuleId,
  fillTemplate,
  PERSONAL_CARD_TEMPLATE,
  personalRuleId,
  relationPhrase,
  renderCard,
  renderCoMovementCard,
} from '../../../supabase/functions/generate-insights/render.ts';

const GATES = { qMax: 0.05, nEffMin: 10 };

function edge(partial: Partial<ServableEdge>): ServableEdge {
  return {
    edge_id: 'a_metric|increases|b_metric',
    subject: 'a_metric',
    object: 'b_metric',
    relation: 'increases',
    verified_at: '2026-07-11T00:00:00Z',
    edge_score: 0.9,
    serving_band: 'high',
    claim: { citations: [{ paperId: 'fixture:paper' }] },
    ...partial,
  };
}

function personal(partial: Partial<PersonalSignalRow>): PersonalSignalRow {
  return { metric_a: 'a_metric', metric_b: 'b_metric', rho: 0.8, n_eff: 20, q_value: 0.01, stable: true, ...partial };
}

function pattern(partial: Partial<CandidatePattern>): CandidatePattern {
  return {
    patternKey: 'signal:a_metric:up',
    kind: 'signal',
    metricKeys: ['a_metric'],
    states: { a_metric: 'up' },
    stats: {},
    ...partial,
  };
}

// ─── Branch truth table (composer.ts header; doc §S7 made disjoint) ────────────────────────

test('agree: servable consistent monotonic edge with personal null-or-consistent', () => {
  // Personal absent entirely.
  const noPersonal = classifyPattern(pattern({}), [edge({})], () => null, GATES);
  assert.equal(noPersonal?.branch, 'agree');
  assert.equal(noPersonal?.personal, null);
  // Personal present, gate-passing, sign-consistent (rho > 0 vs increases) → agree + attached.
  const withPersonal = classifyPattern(pattern({}), [edge({})], () => personal({}), GATES);
  assert.equal(withPersonal?.branch, 'agree');
  assert.equal(withPersonal?.personal?.rho, 0.8);
  assert.equal(withPersonal?.topEdge?.edge_id, 'a_metric|increases|b_metric');
});

test('contradiction: gate-passing personal signal with the OPPOSITE sign to a monotonic edge', () => {
  const out = classifyPattern(pattern({}), [edge({})], () => personal({ rho: -0.7 }), GATES);
  assert.equal(out?.branch, 'contradiction');
  // A NON-gate-passing opposite signal is treated as absent → agree, not contradiction.
  const weak = classifyPattern(pattern({}), [edge({})], () => personal({ rho: -0.7, q_value: 0.4 }), GATES);
  assert.equal(weak?.branch, 'agree');
});

test('research-context: only context-only or direction-inconsistent edges', () => {
  // correlates can never set a direction (1-hop monotonic-only invariant, §1.3).
  const context = classifyPattern(pattern({}), [edge({ relation: 'correlates' })], () => null, GATES);
  assert.equal(context?.branch, 'research-context');
  // Both endpoints observed moving together against a `decreases` edge → inconsistent.
  const inconsistent = classifyPattern(
    pattern({ states: { a_metric: 'up', b_metric: 'up' } }),
    [edge({ relation: 'decreases' })],
    () => null,
    GATES,
  );
  assert.equal(inconsistent?.branch, 'research-context');
});

test('idiosyncratic: gate-passing personal pair with no servable edge (pair patterns)', () => {
  const out = classifyPattern(
    pattern({ metricKeys: ['a_metric', 'b_metric'], kind: 'coincidence' }),
    [],
    () => personal({}),
    GATES,
  );
  assert.equal(out?.branch, 'idiosyncratic');
  assert.deepEqual(out?.edges, []);
  // No edge + no personal → null (gap fuel, no insight).
  const nothing = classifyPattern(pattern({}), [], () => null, GATES);
  assert.equal(nothing, null);
});

test('monotonic-only direction: correlates/modulates edges get direction null', () => {
  assert.equal(edgeDirectionConsistent(edge({ relation: 'correlates' }), { a_metric: 'up' }), null);
  assert.equal(edgeDirectionConsistent(edge({}), { a_metric: 'up', b_metric: 'up' }), 'consistent');
  assert.equal(edgeDirectionConsistent(edge({}), { a_metric: 'up', b_metric: 'down' }), 'inconsistent');
  // Only one endpoint observed → no contradiction observable → consistent (recorded call).
  assert.equal(edgeDirectionConsistent(edge({}), { a_metric: 'up' }), 'consistent');
});

test('personal serve gate: q ≤ 0.05 ∧ n_eff ≥ 10 ∧ stable (§S5 / C4)', () => {
  assert.equal(personalPassesGate(personal({}), GATES), true);
  assert.equal(personalPassesGate(personal({ q_value: 0.06 }), GATES), false);
  assert.equal(personalPassesGate(personal({ n_eff: 9 }), GATES), false);
  assert.equal(personalPassesGate(personal({ stable: false }), GATES), false);
  assert.equal(personalPassesGate(null, GATES), false);
});

test('U1 applicability stub grades every citation "unknown" (typed seam for the later grader)', () => {
  assert.deepEqual(gradeApplicability('paper-1'), { paperId: 'paper-1', score: 'unknown', rationale: null });
});

// ─── Completeness scorer (§S7.2) ───────────────────────────────────────────────────────────

test('completeness: dqs-weight-normalised day coverage, computed from S2 raw day counts', () => {
  const days = new Map([['urine_colour', 28], ['stool_form', 14]]);
  const weight = (k: string) => (k === 'urine_colour' ? 25 : 25);
  const c = completenessScore(['urine_colour', 'stool_form'], days, 28, weight);
  assert.equal(c.score, 0.75); // 0.5·(28/28) + 0.5·(14/28)
  assert.equal(c.daysPresent, 14); // conservative: the min across contributing metrics
  assert.deepEqual(c.perMetric, { urine_colour: 28, stool_form: 14 });
});

test('completeness: all-zero dqs weights (wearable-only pairs) fall back to equal weights', () => {
  const days = new Map([['sleep_duration_min', 28], ['hrv_sdnn_ms', 7]]);
  const c = completenessScore(['sleep_duration_min', 'hrv_sdnn_ms'], days, 28, () => 0);
  assert.equal(c.score, 0.625); // 0.5·1 + 0.5·0.25 — not 0/NaN
});

// ─── Deterministic insight identity ─────────────────────────────────────────────────────────

test('insightId is a deterministic sha-256 of (user, patternKey, edgeId|none, periodStart)', async () => {
  const a = await insightId('u1', 'signal:m:up', 'e1', '2026-07-16');
  const b = await insightId('u1', 'signal:m:up', 'e1', '2026-07-16');
  const c = await insightId('u1', 'signal:m:up', null, '2026-07-16');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ─── S8 render gate + producer namespaces ───────────────────────────────────────────────────

test('renderCard fills placeholders and passes clean copy', () => {
  const out = renderCard(
    { title: 'Pattern: {{metric_a_label}}', body: 'Your {{metric_a_label}} data shows a pattern.' },
    { metric_a_label: 'sleep duration min' },
  );
  assert.ok(out.ok);
  assert.equal(out.ok && out.copy.title, 'Pattern: sleep duration min');
});

test('render-time copy gate DROPS a card whose FINAL copy fails validateCopyString', () => {
  const out = renderCard(
    { title: 'Fine title', body: 'This may be a disease pattern.' },
    {},
  );
  assert.equal(out.ok, false);
  assert.deepEqual(!out.ok && out.failure, { reason: 'copy-gate', field: 'body' });
});

test('an unresolved {{placeholder}} DROPS the card (broken copy never ships)', () => {
  const out = renderCard(
    { title: 'Fine title', body: 'Your {{unknown_thing}} data moved.' },
    {},
  );
  assert.equal(out.ok, false);
  assert.deepEqual(
    !out.ok && out.failure,
    { reason: 'unresolved-placeholder', field: 'body', placeholders: ['unknown_thing'] },
  );
});

test('the shipped composer templates render clean with representative values', () => {
  // R4-U4/B-SCI1: a CAUSAL claim kind is what licenses "tends to raise", and B-UI9 adds the
  // posture disclosure placeholder that leads the body (empty string for a live artifact).
  const edgeValues = {
    metric_a_label: 'sleep duration min',
    metric_b_label: 'hrv sdnn ms',
    pattern_metric_label: 'sleep duration min',
    direction_phrase: 'upward',
    relation_phrase: 'tends to raise',
    posture_disclosure: '',
  };
  for (const template of [EDGE_CARD_TEMPLATE, EDGE_CARD_TEMPLATE_WITH_PERSONAL]) {
    const edgeCard = renderCard(template, edgeValues, { effectiveKind: 'causal' });
    assert.ok(edgeCard.ok, JSON.stringify(edgeCard));
  }
  const personalCard = renderCard(PERSONAL_CARD_TEMPLATE, {
    metric_a_label: 'energy score',
    metric_b_label: 'mood score',
  });
  assert.ok(personalCard.ok, JSON.stringify(personalCard));
  // The still-researching variant must SAY it is an unverified personal observation.
  assert.ok(personalCard.ok && personalCard.copy.body.includes('unverified personal observation'));
});

// A21 honesty split: the pairwise-corroboration clause ships only when a gate-passing personal
// signal backs it — an agree card fired per D14 with the personal signal absent (or failing its
// serve gate) must NOT claim the user's own data matches.
test('A21: agree card without a gate-passing personal signal omits the matching-pattern clause', () => {
  const CLAUSE = 'Your own recent data shows a matching pattern';
  assert.ok(!EDGE_CARD_TEMPLATE.body.includes(CLAUSE));
  assert.ok(EDGE_CARD_TEMPLATE_WITH_PERSONAL.body.includes(CLAUSE));
  // The selection function the handler calls with (classified.personal !== null).
  assert.equal(edgeCardTemplate(false), EDGE_CARD_TEMPLATE);
  assert.equal(edgeCardTemplate(true), EDGE_CARD_TEMPLATE_WITH_PERSONAL);
  // Both variants share the title, so the upsert identity is unchanged by the split.
  assert.equal(EDGE_CARD_TEMPLATE.title, EDGE_CARD_TEMPLATE_WITH_PERSONAL.title);
});

// A23: a non-monotonic relation must fail loudly, never default to a directional phrase.
// R4-U4/B-SCI1 extends this: the phrase is now chosen by the EFFECTIVE claim kind, and an
// unknown kind is as fatal as a non-monotonic relation.
test('A23: relationPhrase throws on non-monotonic relations', () => {
  assert.equal(relationPhrase('increases', 'causal'), 'tends to raise');
  assert.equal(relationPhrase('decreases', 'causal'), 'tends to lower');
  assert.throws(() => relationPhrase('correlates', 'causal'), /not monotonic/);
  assert.throws(() => relationPhrase('modulates', 'causal'), /not monotonic/);
});

// B-SCI1 · THE REGRESSION TEST FOR THE DEFECT THIS UNIT FIXES. Before R4-U4 every relation
// rendered as "tends to raise"/"tends to lower" regardless of what the research claimed, so a
// correlational finding was stated causally. Each kind must now get its own wording.
test('B-SCI1: relationPhrase never states a correlational claim causally', () => {
  assert.equal(relationPhrase('increases', 'correlational'), 'is associated with higher');
  assert.equal(relationPhrase('decreases', 'correlational'), 'is associated with lower');
  assert.equal(relationPhrase('increases', 'mechanistic'), 'has a proposed route to higher');
  assert.equal(relationPhrase('decreases', 'mechanistic'), 'has a proposed route to lower');
  // The specific inflation B-SCI1 records must be impossible.
  assert.notEqual(relationPhrase('increases', 'correlational'), 'tends to raise');
  assert.notEqual(relationPhrase('decreases', 'correlational'), 'tends to lower');
});

// Fail-closed: an edge whose claim kind could not be established gets NO directional wording.
test('B-SCI1: relationPhrase refuses to render without an established claim kind', () => {
  assert.throws(() => relationPhrase('increases', null), /no established claim kind/);
});

test('producer rule_id namespaces are disjoint and pair-order-stable', () => {
  assert.equal(edgeRuleId('a|increases|b'), 'edge:a|increases|b');
  assert.equal(personalRuleId('b_metric', 'a_metric'), 'personal:a_metric|b_metric');
  assert.equal(personalRuleId('a_metric', 'b_metric'), 'personal:a_metric|b_metric');
  assert.equal(pairKey('b_metric', 'a_metric'), 'a_metric|b_metric');
});

// ─── the co-movement edge card (correlational edges reach a card, no direction) ───────
//
// The three acceptance cases the unit is gated on, as node vectors beside the Deno ones:
//   (a) correlational edge + coincidence pattern  ⇒ card renders, no directional language
//   (b) correlational edge + single-metric signal ⇒ still no card
//   (c) contradiction over the same pair          ⇒ contradiction still wins

const CORRELATES_EDGE_ID = 'a_metric|correlates|b_metric';

function correlates(partial: Partial<ServableEdge> = {}): ServableEdge {
  return edge({
    edge_id: CORRELATES_EDGE_ID,
    relation: 'correlates',
    edge_score: 0.6,
    caveat: 'One observational cohort only, so the pairing may not transfer to every setting.',
    claim: { citations: [{ paperId: 'doi:10.1000/example' }], claimKind: 'correlational' },
    verification: { claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' } },
    ...partial,
  });
}

const coincidencePair = pattern({
  patternKey: 'rule:a-b-comove',
  kind: 'coincidence',
  metricKeys: ['a_metric', 'b_metric'],
  states: { a_metric: 'up', b_metric: 'up' },
});

test('co-movement (a): a correlational edge over a fired coincidence pair renders a cited card', () => {
  const out = classifyPattern(coincidencePair, [correlates()], () => personal({}), GATES);
  assert.equal(out?.branch, 'agree');
  assert.equal(out?.coMovementEdge?.edge_id, CORRELATES_EDGE_ID);
  assert.equal(out?.topEdge?.edge_id, CORRELATES_EDGE_ID);
  // The DIRECTIONAL seam stays empty: `cardEdge` feeds relationPhrase(), which throws for a
  // non-monotonic relation, so a correlational edge must never appear there.
  assert.equal(out?.cardEdge, null);
  assert.equal(rendersCard(out!), true);
  assert.equal(gapStatusFor(out!), null);
  // The composed edge ref still reports NO direction and NON-monotonic — no sign was synthesised.
  assert.equal(out?.edges[0]?.direction, null);
  assert.equal(out?.edges[0]?.monotonic, false);
  assert.equal(out?.edges[0]?.caveat, correlates().caveat);
  assert.equal(out?.edges[0]?.citations[0]?.paperId, 'doi:10.1000/example');

  const rendered = renderCoMovementCard(
    coMovementEdgeCardTemplate(out?.personal !== null),
    { metric_a_label: 'gut comfort', metric_b_label: 'mood', posture_disclosure: '' },
    { effectiveKind: 'correlational' },
  );
  assert.ok(rendered.ok, JSON.stringify(rendered));
  assert.ok(rendered.ok && rendered.copy.body.includes('moved together in your recent logs'));
  assert.ok(rendered.ok && rendered.copy.body.includes('Direction of influence was not established.'));
  // No directional language anywhere in the FINAL copy.
  assert.deepEqual(rendered.ok ? directionalTermsIn(rendered.copy.title) : ['unrendered'], []);
  assert.deepEqual(rendered.ok ? directionalTermsIn(rendered.copy.body) : ['unrendered'], []);
});

test('co-movement (b): a correlational edge on a SINGLE-metric signal pattern still renders no card', () => {
  const out = classifyPattern(pattern({}), [correlates()], () => personal({}), GATES);
  assert.equal(out?.branch, 'research-context');
  assert.equal(out?.coMovementEdge, null);
  assert.equal(rendersCard(out!), false);
  assert.equal(gapStatusFor(out!), 'blocked-completeness');
});

test('co-movement (c): contradiction still wins over a co-movement edge on the same pair', () => {
  const out = classifyPattern(
    coincidencePair,
    [correlates(), edge({ edge_score: 0.95 })],
    () => personal({ rho: -0.7 }),
    GATES,
  );
  assert.equal(out?.branch, 'contradiction');
  assert.equal(out?.coMovementEdge, null);
  assert.equal(out?.cardEdge, null);
  assert.equal(rendersCard(out!), false);
  assert.equal(gapStatusFor(out!), 'needs-review');
});

test('co-movement: a monotonic direction-consistent edge still outranks the co-movement path', () => {
  // Rule 2 returns before rule 2b, so an already-serving directional pattern is untouched even
  // when a higher-scored correlational edge sits on the same pair.
  const out = classifyPattern(
    coincidencePair,
    [correlates({ edge_score: 0.99 }), edge({})],
    () => null,
    GATES,
  );
  assert.equal(out?.branch, 'agree');
  assert.equal(out?.cardEdge?.edge_id, 'a_metric|increases|b_metric');
  assert.equal(out?.coMovementEdge, null);
});

test('co-movement: the co-movement path never widens MONOTONIC_RELATIONS', () => {
  assert.deepEqual([...MONOTONIC_RELATIONS].sort(), ['decreases', 'increases']);
});

test('co-movement: the co-movement templates carry no direction slot and render clean', () => {
  for (const template of [CO_MOVEMENT_EDGE_CARD_TEMPLATE, CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL]) {
    assert.ok(!template.body.includes('{{direction_phrase}}'));
    assert.ok(!template.body.includes('{{relation_phrase}}'));
    const out = renderCoMovementCard(
      template,
      { metric_a_label: 'sleep duration', metric_b_label: 'heart-rate variability (SDNN)', posture_disclosure: '' },
      { effectiveKind: 'correlational' },
    );
    assert.ok(out.ok, JSON.stringify(out));
  }
});

test('co-movement: the directional-copy gate drops co-movement copy that names a direction', () => {
  const out = renderCoMovementCard(
    { title: 'Fine title', body: 'Your {{metric_a_label}} data rose alongside your {{metric_b_label}} data.' },
    { metric_a_label: 'gut comfort', metric_b_label: 'mood' },
    { effectiveKind: 'correlational' },
  );
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.failure.reason, 'directional-copy-gate');
});

test('fillTemplate reports every missing placeholder', () => {
  const out = fillTemplate('{{a}} and {{b}} and {{a}}', { a: 1 });
  assert.equal(out.text, '1 and {{b}} and 1');
  assert.deepEqual(out.missing, ['b']);
});
