// O16 + O18 + A1-gap vectors: the orientation-aware card semantics (backlog O16, verdict B2),
// the gap-only research-context/contradiction surfacing policy (backlog O18, decision (a),
// Jayden 2026-07-24), and the branch → §A1 gap-status mapping. Pure halves of the U4 unit —
// Deno-free by construction, imported directly via tsx (the engine_composer_render mechanism).
//
// THE ACCEPTANCE MATRIX (O16 testing gate): {subject-only, object-only, both-consistent,
// both-inconsistent} × {increases, decreases} — 8 vectors, each asserting the branch, whether a
// directional card may render (rendersCard), and that any cardEdge's SUBJECT is the fired
// metric. The binding invariant: a card never states the non-fired endpoint as having moved.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPattern,
  gapStatusFor,
  rendersCard,
  type CandidatePattern,
  type ClassifiedPattern,
  type PersonalSignalRow,
  type ServableEdge,
} from '../../../supabase/functions/generate-insights/composer.ts';
import {
  EDGE_CARD_TEMPLATE,
  renderCard,
} from '../../../supabase/functions/generate-insights/render.ts';

const GATES = { qMax: 0.05, nEffMin: 10 };

/** Edge under test: subject_metric --relation--> object_metric. */
function edge(partial: Partial<ServableEdge>): ServableEdge {
  return {
    edge_id: 'subject_metric|increases|object_metric',
    subject: 'subject_metric',
    object: 'object_metric',
    relation: 'increases',
    verified_at: '2026-07-24T00:00:00Z',
    edge_score: 0.9,
    serving_band: 'high',
    claim: { citations: [{ paperId: 'fixture:paper' }] },
    ...partial,
  };
}

/** A fired single-metric S4 signal pattern (the O16 path). */
function firedSignal(
  metricKey: string,
  states: Record<string, 'up' | 'down'>,
): CandidatePattern {
  return {
    patternKey: `signal:${metricKey}:${states[metricKey]}`,
    kind: 'signal',
    metricKeys: [metricKey],
    states,
    stats: {},
  };
}

function personal(partial: Partial<PersonalSignalRow>): PersonalSignalRow {
  return {
    metric_a: 'object_metric',
    metric_b: 'subject_metric',
    rho: 0.8,
    n_eff: 20,
    q_value: 0.01,
    stable: true,
    ...partial,
  };
}

// ─── The 8-vector orientation matrix (O16 testing gate) ─────────────────────────────────────
//
// Vector semantics against one monotonic edge subject_metric --relation--> object_metric:
//   subject-only       — only the SUBJECT endpoint fired (the fired pattern is the subject's)
//   object-only        — only the OBJECT endpoint fired (the fired pattern is the object's)
//   both-consistent    — both endpoints observed, co-movement matches the relation sign
//   both-inconsistent  — both endpoints observed, co-movement contradicts the relation sign

interface MatrixVector {
  name: string;
  relation: 'increases' | 'decreases';
  firedMetric: string;
  states: Record<string, 'up' | 'down'>;
  expectBranch: 'agree' | 'research-context';
  expectCard: boolean;
}

const MATRIX: MatrixVector[] = [
  {
    name: 'subject-only × increases → agree, directional card (subject fired)',
    relation: 'increases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'up' },
    expectBranch: 'agree',
    expectCard: true,
  },
  {
    name: 'subject-only × decreases → agree, directional card (subject fired)',
    relation: 'decreases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'down' },
    expectBranch: 'agree',
    expectCard: true,
  },
  {
    name: 'object-only × increases → agree composed row, NO card (O16: object-only signal)',
    relation: 'increases',
    firedMetric: 'object_metric',
    states: { object_metric: 'up' },
    expectBranch: 'agree',
    expectCard: false,
  },
  {
    name: 'object-only × decreases → agree composed row, NO card (O16: object-only signal)',
    relation: 'decreases',
    firedMetric: 'object_metric',
    states: { object_metric: 'down' },
    expectBranch: 'agree',
    expectCard: false,
  },
  {
    name: 'both-consistent × increases → agree, directional card (subject pattern drives it)',
    relation: 'increases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'up', object_metric: 'up' },
    expectBranch: 'agree',
    expectCard: true,
  },
  {
    name: 'both-consistent × decreases → agree, directional card (subject pattern drives it)',
    relation: 'decreases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'up', object_metric: 'down' },
    expectBranch: 'agree',
    expectCard: true,
  },
  {
    name: 'both-inconsistent × increases → research-context, NO card (gap-only per O18)',
    relation: 'increases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'up', object_metric: 'down' },
    expectBranch: 'research-context',
    expectCard: false,
  },
  {
    name: 'both-inconsistent × decreases → research-context, NO card (gap-only per O18)',
    relation: 'decreases',
    firedMetric: 'subject_metric',
    states: { subject_metric: 'up', object_metric: 'up' },
    expectBranch: 'research-context',
    expectCard: false,
  },
];

for (const v of MATRIX) {
  test(`O16 matrix: ${v.name}`, () => {
    const e = edge({ relation: v.relation, edge_id: `subject_metric|${v.relation}|object_metric` });
    const out = classifyPattern(firedSignal(v.firedMetric, v.states), [e], () => null, GATES);
    assert.ok(out !== null);
    assert.equal(out.branch, v.expectBranch);
    assert.equal(rendersCard(out), v.expectCard);
    if (v.expectCard) {
      // The binding O16 invariant: the card's stated mover IS the fired metric.
      assert.equal(out.cardEdge?.subject, v.firedMetric);
      assert.equal(out.topEdge?.edge_id, e.edge_id);
    } else {
      assert.equal(out.cardEdge, null);
    }
  });
}

// ─── O16 corner cases beyond the 8 vectors ──────────────────────────────────────────────────

test('O16: object pattern with BOTH endpoints observed still yields no card — the subject pattern owns it', () => {
  // Both metrics fired; the OBJECT metric's own pattern must not render (its counterpart
  // subject pattern renders the identical edge card instead — same upsert key semantics).
  const out = classifyPattern(
    firedSignal('object_metric', { subject_metric: 'up', object_metric: 'up' }),
    [edge({})],
    () => null,
    GATES,
  );
  assert.equal(out?.branch, 'agree');
  assert.equal(out?.cardEdge, null);
  assert.equal(rendersCard(out!), false);
});

test('O16: a subject-endpoint edge is preferred as topEdge/cardEdge over a HIGHER-scored object-endpoint edge', () => {
  const objectEndpoint = edge({
    edge_id: 'other_metric|increases|fired_metric',
    subject: 'other_metric',
    object: 'fired_metric',
    edge_score: 0.95,
  });
  const subjectEndpoint = edge({
    edge_id: 'fired_metric|increases|partner_metric',
    subject: 'fired_metric',
    object: 'partner_metric',
    edge_score: 0.6,
  });
  const out = classifyPattern(
    firedSignal('fired_metric', { fired_metric: 'up' }),
    [objectEndpoint, subjectEndpoint],
    () => null,
    GATES,
  );
  assert.equal(out?.branch, 'agree');
  assert.equal(out?.cardEdge?.edge_id, 'fired_metric|increases|partner_metric');
  assert.equal(out?.topEdge?.edge_id, 'fired_metric|increases|partner_metric');
  assert.equal(rendersCard(out!), true);
});

test('O16: pair (coincidence) patterns keep cardEdge === topEdge — both endpoints are observed by construction', () => {
  const out = classifyPattern(
    {
      patternKey: 'rule:fixture',
      kind: 'coincidence',
      metricKeys: ['subject_metric', 'object_metric'],
      states: { subject_metric: 'up', object_metric: 'up' },
      stats: {},
    },
    [edge({})],
    () => null,
    GATES,
  );
  assert.equal(out?.branch, 'agree');
  assert.equal(out?.cardEdge?.edge_id, out?.topEdge?.edge_id);
  assert.equal(rendersCard(out!), true);
});

// ─── O18 surfacing policy: rendersCard is the single gate ───────────────────────────────────

test('O18: research-context and contradiction NEVER render — gap-only (decision (a))', () => {
  const researchContext = classifyPattern(
    firedSignal('subject_metric', { subject_metric: 'up' }),
    [edge({ relation: 'correlates' })],
    () => null,
    GATES,
  );
  assert.equal(researchContext?.branch, 'research-context');
  assert.equal(rendersCard(researchContext!), false);

  const contradiction = classifyPattern(
    firedSignal('subject_metric', { subject_metric: 'up' }),
    [edge({})],
    () => personal({ rho: -0.7 }),
    GATES,
  );
  assert.equal(contradiction?.branch, 'contradiction');
  assert.equal(rendersCard(contradiction!), false);
});

test('O18: idiosyncratic renders the personal card (architecture §S7 does BOTH card and gap event)', () => {
  const out = classifyPattern(
    {
      patternKey: 'rule:fixture',
      kind: 'coincidence',
      metricKeys: ['object_metric', 'subject_metric'],
      states: { subject_metric: 'up' },
      stats: {},
    },
    [],
    () => personal({}),
    GATES,
  );
  assert.equal(out?.branch, 'idiosyncratic');
  assert.equal(rendersCard(out!), true);
});

// ─── Branch → §A1 gap-status mapping ────────────────────────────────────────────────────────

test('gapStatusFor maps branches to the architecture §A1 statuses', () => {
  const served: ClassifiedPattern = {
    branch: 'agree', edges: [], personal: null, topEdge: edge({}), cardEdge: edge({}),
    coMovementEdge: null,
  };
  assert.equal(gapStatusFor(served), null); // a served card is not a gap

  const objectOnly: ClassifiedPattern = {
    branch: 'agree', edges: [], personal: null, topEdge: edge({}), cardEdge: null,
    coMovementEdge: null,
  };
  assert.equal(gapStatusFor(objectOnly), 'personal-signal-no-edge');

  // Co-movement: an agree pattern served by a CO-MOVEMENT edge is likewise not a gap — reading only
  // cardEdge here would log unmet demand for a pair the same run just served.
  const coMovementServed: ClassifiedPattern = {
    branch: 'agree', edges: [], personal: null, topEdge: edge({ relation: 'correlates' }),
    cardEdge: null, coMovementEdge: edge({ relation: 'correlates' }),
  };
  assert.equal(gapStatusFor(coMovementServed), null);
  assert.equal(rendersCard(coMovementServed), true);

  const researchContext: ClassifiedPattern = {
    branch: 'research-context', edges: [], personal: null, topEdge: null, cardEdge: null,
    coMovementEdge: null,
  };
  assert.equal(gapStatusFor(researchContext), 'blocked-completeness'); // §S7: completeness-gated

  const contradiction: ClassifiedPattern = {
    branch: 'contradiction', edges: [], personal: personal({}), topEdge: null, cardEdge: null,
    coMovementEdge: null,
  };
  assert.equal(gapStatusFor(contradiction), 'needs-review');

  const idiosyncratic: ClassifiedPattern = {
    branch: 'idiosyncratic', edges: [], personal: personal({}), topEdge: null, cardEdge: null,
    coMovementEdge: null,
  };
  assert.equal(gapStatusFor(idiosyncratic), 'personal-signal-no-edge');
});

// ─── Render-level: the directional template states exactly the fired metric ─────────────────

test('O16 render: the directional card names the FIRED metric as the mover', () => {
  // The handler passes metric_a_label = label(fired metric) (asserted equal to
  // cardEdge.subject) — the rendered body must state the fired metric shifted, and the
  // non-fired endpoint may appear only inside the citation framing.
  // R4-U4: a live artifact contributes an empty posture disclosure, so the body still opens on
  // the fired metric; 'causal' is what licenses the "tends to raise" phrasing used here.
  const rendered = renderCard(
    EDGE_CARD_TEMPLATE,
    {
      metric_a_label: 'sleep duration min',
      metric_b_label: 'hrv sdnn ms',
      pattern_metric_label: 'sleep duration min',
      direction_phrase: 'upward',
      relation_phrase: 'tends to raise',
      posture_disclosure: '',
    },
    { effectiveKind: 'causal' },
  );
  assert.ok(rendered.ok);
  assert.ok(rendered.ok && rendered.copy.body.startsWith('Your sleep duration min data shifted upward'));
  assert.ok(rendered.ok && !rendered.copy.body.includes('Your hrv sdnn ms data shifted'));
});
