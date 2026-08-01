/**
 * Agentic-seeder tests (session U9) — node:test via tsx, NO network.
 *
 * Covers the four areas the session gate names: candidate enumeration (registry
 * + blueprint fixtures → expected pairs, stable order), response validation
 * (unknown-pair rejection, malformed JSON, cap enforcement, dedupe), artifact
 * determinism given a fixed mock response, and fallback behavior when the
 * artifact is absent. The router is mocked with an injected fake route.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCandidates, candidateCounts } from '../src/seeder/candidates.js';
import { validateSeederResponse } from '../src/seeder/validate.js';
import {
  assembleArtifact,
  readArtifact,
  seedQueriesPath,
  seedsFromArtifact,
  writeArtifact,
} from '../src/seeder/artifact.js';
import { generateSeedQueries, enumerateSeederCandidates } from '../src/seeder/index.js';
import { loadBlueprints, loadRegistryMetrics } from '../src/seeder/load.js';
import { buildSeederPrompt } from '../src/seeder/prompt.js';
import type {
  BlueprintInput,
  RegistryMetricInput,
  SeederRouter,
  TopicInput,
} from '../src/seeder/index.js';
import type { LlmRequest, LlmResponse } from '../../llm-router/src/index.js';
import { SEEDS } from '../src/seeds.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const METRICS: RegistryMetricInput[] = [
  { key: 'urine_colour', status: 'active', derivedFrom: null },
  { key: 'stool_form', status: 'active', derivedFrom: null },
  { key: 'stool_variability', status: 'active', derivedFrom: ['stool_form'] },
  { key: 'energy_score', status: 'active', derivedFrom: null },
  // #307: this slot used to be `log_completeness`, which is now excluded from scientific discovery
  // (NON_SCIENTIFIC_METRIC_KEYS). Swapped for a real HEALTH metric with two derivation inputs so the
  // test still exercises what it is for — multiple derivedFrom inputs, ordering, direction — instead
  // of being weakened. The exclusion has its own dedicated test below.
  { key: 'gut_comfort_score', status: 'active', derivedFrom: ['urine_colour', 'energy_score'] },
  // deprecated derived metric must NOT contribute a candidate:
  { key: 'old_derived', status: 'deprecated', derivedFrom: ['urine_colour'] },
];

const BLUEPRINTS: BlueprintInput[] = [
  { ruleId: 'energy_trending_down', metricKeys: ['energy_score'], status: 'active' },
  // a cross-metric blueprint co-names a pair → one rule_blueprint candidate:
  { ruleId: 'hydration_energy_link', metricKeys: ['urine_colour', 'energy_score'], status: 'active' },
];

const TOPICS: TopicInput[] = [
  { topic: 'hydration', query: 'hydration water intake', topicTags: ['hydration'] },
  { topic: 'gut_microbiome', query: 'gut microbiome health', topicTags: ['gut_microbiome'] },
];

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'seeder-'));
}

// ── candidate enumeration ─────────────────────────────────────────────────────

test('candidates: derivedFrom pairs, direction preserved, deprecated skipped', () => {
  const c = buildCandidates({ metrics: METRICS, blueprints: [], topics: [] });
  const ids = c.map((x) => x.id);
  assert.deepEqual(ids, [
    'df:stool_variability__stool_form',
    'df:gut_comfort_score__urine_colour',
    'df:gut_comfort_score__energy_score',
  ]);
  // direction: [derived, input]
  const first = c[0]!;
  assert.deepEqual(first.metricKeys, ['stool_variability', 'stool_form']);
  assert.equal(first.source, 'derivedFrom');
  // deprecated metric contributed nothing
  assert.ok(!ids.some((id) => id.includes('old_derived')));
});

test('candidates: rule-blueprint pairs from a ≥2-key blueprint (single-key yields none)', () => {
  const c = buildCandidates({ metrics: [], blueprints: BLUEPRINTS, topics: [] });
  assert.deepEqual(
    c.map((x) => x.id),
    ['rb:energy_score__urine_colour'], // sorted pair; single-key rule contributes none
  );
  assert.equal(c[0]!.source, 'rule_blueprint');
  assert.deepEqual(c[0]!.metricKeys, ['energy_score', 'urine_colour']);
});

test('candidates: static topics become anchors with empty metricKeys', () => {
  const c = buildCandidates({ metrics: [], blueprints: [], topics: TOPICS });
  assert.deepEqual(
    c.map((x) => x.id),
    ['st:hydration', 'st:gut_microbiome'],
  );
  assert.deepEqual(c[0]!.metricKeys, []);
  assert.equal(c[0]!.topic, 'hydration');
});

test('candidates: full build is stable-ordered, deduped, and counted by source', () => {
  const c = buildCandidates({ metrics: METRICS, blueprints: BLUEPRINTS, topics: TOPICS });
  // derivedFrom (3) → rule_blueprint (1, the {urine_colour,energy_score} pair is
  // NOT already emitted by derivedFrom so it survives dedup) → static_topic (2)
  assert.deepEqual(c.map((x) => x.source), [
    'derivedFrom',
    'derivedFrom',
    'derivedFrom',
    'rule_blueprint',
    'static_topic',
    'static_topic',
  ]);
  assert.deepEqual(candidateCounts(c), { derivedFrom: 3, rule_blueprint: 1, static_topic: 2 });
  // determinism: same inputs → identical ids
  const again = buildCandidates({ metrics: METRICS, blueprints: BLUEPRINTS, topics: TOPICS });
  assert.deepEqual(c.map((x) => x.id), again.map((x) => x.id));
});

test('candidates: a blueprint pair equal to a derivedFrom pair is deduped away', () => {
  const metrics: RegistryMetricInput[] = [
    { key: 'a', status: 'active', derivedFrom: ['b'] },
    { key: 'b', status: 'active', derivedFrom: null },
  ];
  const blueprints: BlueprintInput[] = [{ ruleId: 'r', metricKeys: ['a', 'b'], status: 'active' }];
  const c = buildCandidates({ metrics, blueprints, topics: [] });
  assert.deepEqual(c.map((x) => x.id), ['df:a__b']); // rb:a__b dropped as dup
});

// ── O14 seeds-as-data: db topics anchor EXACTLY like static topics (C9 gate) ─

const DB_TOPIC: TopicInput = {
  topic: 'magnesium_sleep',
  query: 'magnesium supplementation sleep quality',
  topicTags: ['magnesium_sleep'],
};

test('O14/C9: a db-loaded topic anchors candidates exactly like a static topic — no new pair source', () => {
  const withDb = buildCandidates({
    metrics: METRICS,
    blueprints: BLUEPRINTS,
    topics: [...TOPICS, DB_TOPIC],
  });
  const anchor = withDb.find((c) => c.id === 'st:magnesium_sleep');
  assert.ok(anchor, 'the db topic becomes an st: anchor');
  assert.equal(anchor!.source, 'static_topic', 'same provenance bucket as a static topic');
  assert.deepEqual(anchor!.metricKeys, [], 'a topic anchor NEVER carries a metric pair');
  assert.equal(anchor!.topic, 'magnesium_sleep');

  // The pair-bearing candidates are BYTE-IDENTICAL with or without the db topic:
  // adding a seed can never add, remove, or reorder a pair (C9).
  const withoutDb = buildCandidates({ metrics: METRICS, blueprints: BLUEPRINTS, topics: TOPICS });
  const pairsOf = (cs: typeof withDb) => cs.filter((c) => c.metricKeys.length > 0);
  assert.deepEqual(pairsOf(withDb), pairsOf(withoutDb));

  // And no NEW candidate source appeared — the tally still knows exactly three.
  assert.deepEqual(Object.keys(candidateCounts(withDb)).sort(), [
    'derivedFrom',
    'rule_blueprint',
    'static_topic',
  ]);
});

test('O14/C9: the LLM still cannot smuggle a pair in via a db-topic response key', () => {
  const cands = buildCandidates({ metrics: [], blueprints: [], topics: [...TOPICS, DB_TOPIC] });
  const body = JSON.stringify({
    'st:magnesium_sleep': ['magnesium intake and sleep architecture'],
    // an LLM "helpfully" inventing a metric pair for the new topic — must be dropped:
    'df:magnesium_intake__sleep_duration_min': ['magnesium vs sleep duration'],
    'rb:magnesium_intake__hrv_sdnn_ms': ['magnesium vs HRV'],
  });
  const r = validateSeederResponse(body, cands);
  assert.deepEqual(r.rejectedKeys.sort(), [
    'df:magnesium_intake__sleep_duration_min',
    'rb:magnesium_intake__hrv_sdnn_ms',
  ]);
  assert.deepEqual(r.byId.get('st:magnesium_sleep'), ['magnesium intake and sleep architecture']);
});

test('O14/C9: the candidates.ts header invariant ("ONLY source of pairs") still holds verbatim', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'seeder', 'candidates.ts'),
    'utf8',
  ).replace(/\r\n/g, '\n'); // CRLF checkouts (core.autocrlf) must not defeat the pin
  assert.ok(
    src.includes('This list is the ONLY source of pairs (C9'),
    'the C9 header invariant must stay in candidates.ts — seeds-as-data adds topics, never pairs',
  );
  assert.ok(
    src.includes('the LLM must\n * not add pairs'),
    'the LLM-may-not-add-pairs clause must stay in candidates.ts',
  );
});

// ── response validation ───────────────────────────────────────────────────────

const CANDS = buildCandidates({ metrics: METRICS, blueprints: BLUEPRINTS, topics: TOPICS });

test('validate: rejects keys not in the candidate list (C9) and keeps known ones', () => {
  const body = JSON.stringify({
    'df:stool_variability__stool_form': ['bristol stool consistency'],
    'st:invented_pair': ['should be dropped'],
    'zzz:nonsense': ['also dropped'],
  });
  const r = validateSeederResponse(body, CANDS);
  assert.deepEqual(r.rejectedKeys.sort(), ['st:invented_pair', 'zzz:nonsense']);
  assert.deepEqual(r.byId.get('df:stool_variability__stool_form'), ['bristol stool consistency']);
});

test('validate: malformed JSON throws', () => {
  assert.throws(() => validateSeederResponse('{not json', CANDS), /not valid JSON/);
});

test('validate: a non-object top level throws', () => {
  assert.throws(() => validateSeederResponse('["a","b"]', CANDS), /keyed object/);
});

test('validate: caps queries per candidate and dedupes case-insensitively', () => {
  const body = JSON.stringify({
    'st:hydration': ['Q1', 'q1', 'Q2', '  Q3 ', 'Q4', 'Q5', 'Q6', 'Q7'],
  });
  const r = validateSeederResponse(body, CANDS, 3);
  // 'q1' deduped against 'Q1'; then capped to 3; trimmed
  assert.deepEqual(r.byId.get('st:hydration'), ['Q1', 'Q2', 'Q3']);
});

test('validate: an omitted candidate yields empty queries + a missing-id record', () => {
  const r = validateSeederResponse(JSON.stringify({}), CANDS);
  assert.equal(r.byId.get('st:hydration')?.length, 0);
  assert.deepEqual(r.missingIds.sort(), CANDS.map((c) => c.id).sort());
});

// ── artifact determinism + fallback ───────────────────────────────────────────

test('artifact: deterministic given a fixed mock response + fixed clock', () => {
  const byId = new Map<string, string[]>();
  for (const c of CANDS) byId.set(c.id, [`query for ${c.id}`]);
  const fixedNow = () => Date.parse('2026-07-16T00:00:00.000Z');
  const a1 = assembleArtifact({ candidates: CANDS, byId, promptVersion: 'v1', model: 'm', route: 'local_agent', now: fixedNow });
  const a2 = assembleArtifact({ candidates: CANDS, byId, promptVersion: 'v1', model: 'm', route: 'local_agent', now: fixedNow });
  assert.deepEqual(a1, a2);
  assert.equal(a1.generatedAt, '2026-07-16T00:00:00.000Z');
  assert.equal(a1.schemaVersion, 1);
});

test('artifact: write → read round-trips; absent file reads undefined (fallback)', () => {
  const dir = tmp();
  try {
    assert.equal(readArtifact(dir), undefined); // absent → fallback signal
    const byId = new Map(CANDS.map((c) => [c.id, ['q']]));
    const a = assembleArtifact({ candidates: CANDS, byId, promptVersion: 'v1', model: 'm', route: 'local_agent' });
    const path = writeArtifact(dir, a);
    assert.equal(path, seedQueriesPath(dir));
    const read = readArtifact(dir);
    assert.deepEqual(read, a);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('artifact: a malformed / wrong-version file reads as absent (never wedges a run)', () => {
  const dir = tmp();
  try {
    writeFileSync(seedQueriesPath(dir), '{ not valid', 'utf8');
    assert.equal(readArtifact(dir), undefined);
    writeFileSync(seedQueriesPath(dir), JSON.stringify({ schemaVersion: 99 }), 'utf8');
    assert.equal(readArtifact(dir), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('seedsFromArtifact: one Seed per (candidate, query); tags carry metric keys / topic', () => {
  const byId = new Map<string, string[]>([
    ['df:stool_variability__stool_form', ['q1', 'q2']],
    ['st:hydration', ['q3']],
  ]);
  // only include the two candidates we gave queries to
  const subset = CANDS.filter((c) => byId.has(c.id));
  const a = assembleArtifact({ candidates: subset, byId, promptVersion: 'v1', model: 'm', route: 'local_agent' });
  const seeds = seedsFromArtifact(a);
  assert.equal(seeds.length, 3);
  const df = seeds.filter((s) => s.topic === 'df:stool_variability__stool_form');
  assert.equal(df.length, 2);
  assert.deepEqual(df[0]!.topicTags, ['stool_variability', 'stool_form']);
  const st = seeds.find((s) => s.topic === 'st:hydration')!;
  assert.deepEqual(st.topicTags, ['hydration']); // static anchor → topic slug tag
});

// ── generateSeedQueries end-to-end with a mocked router ────────────────────────

function fakeRouter(reply: string): SeederRouter {
  return {
    async route(req: LlmRequest): Promise<LlmResponse> {
      assert.equal(req.nodeId, 'seeder');
      assert.equal(req.expectJson, true);
      return {
        text: reply,
        model: 'claude-fable-5',
        // R4-U4/O27 (B-BR1): a mailbox fulfilment is never provider-attested.
        modelIdentity: {
          model: 'claude-fable-5',
          source: 'local-agent-mailbox',
          providerAttested: false,
          family: null,
          returnedVersion: null,
          decorrelatedFromSynthesis: null,
        },
        route: 'local_agent',
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    },
  };
}

test('generateSeedQueries: mocked router → validated, capped, written artifact', async () => {
  const dir = tmp();
  try {
    const cands = buildCandidates({ metrics: METRICS, blueprints: BLUEPRINTS, topics: TOPICS });
    const reply: Record<string, string[]> = {};
    for (const c of cands) reply[c.id] = [`primary ${c.id}`, `secondary ${c.id}`];
    reply['st:invented'] = ['must be dropped']; // unknown key
    const result = await generateSeedQueries({
      corpusDir: dir,
      router: fakeRouter(JSON.stringify(reply)),
      metrics: METRICS,
      blueprints: BLUEPRINTS,
      topics: TOPICS,
      capPerCandidate: 1,
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    });
    assert.deepEqual(result.rejectedKeys, ['st:invented']);
    // cap=1 → each candidate keeps exactly one query
    for (const entry of result.artifact.candidates) {
      assert.equal(entry.queries.length, 1);
    }
    assert.deepEqual(result.artifact.counts, { derivedFrom: 3, rule_blueprint: 1, static_topic: 2 });
    assert.equal(result.response.model, 'claude-fable-5');
    // persisted + reloadable
    const read = readArtifact(dir);
    assert.deepEqual(read, result.artifact);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── prompt shape ──────────────────────────────────────────────────────────────

test('buildSeederPrompt: lists every candidate id and instructs JSON-only output', () => {
  const { system, prompt } = buildSeederPrompt(CANDS);
  for (const c of CANDS) assert.ok(prompt.includes(c.id), `prompt names ${c.id}`);
  assert.match(system, /single JSON object/i);
  assert.match(prompt, /EXACTLY these candidate ids/);
});

// ── real loaders (registry + blueprints on disk) ──────────────────────────────

test('loaders: registry exposes derivedFrom metrics and blueprints load from disk', async () => {
  const metrics = await loadRegistryMetrics();
  const derived = metrics.filter((m) => m.derivedFrom !== null);
  assert.ok(derived.some((m) => m.key === 'log_completeness'), 'log_completeness present in the REGISTRY (it is excluded from discovery, not from the registry)');
  assert.ok(derived.some((m) => m.key === 'stool_variability'), 'stool_variability present');

  const blueprints = loadBlueprints();
  assert.ok(blueprints.length >= 6, `>=6 shipped blueprints (got ${blueprints.length})`);
  assert.ok(blueprints.every((b) => Array.isArray(b.metricKeys)), 'every blueprint has metricKeys');
});

test('enumerateSeederCandidates: real registry+blueprints → 1 derivedFrom + 2 cross rules + every seed topic', async () => {
  const c = await enumerateSeederCandidates();
  const counts = candidateCounts(c);
  // #307 · This number dropped from 8 to 1, and the drop IS the finding: seven of the eight
  // derivedFrom candidates were `log_completeness__*` pairs, each asking the literature about our own
  // logging-completeness metric. `NON_SCIENTIFIC_METRIC_KEYS` now excludes them, leaving the single
  // genuine health pair `df:stool_variability__stool_form`.
  //
  // The old assertion of 8 was pinning the defect, which is why it had to change rather than the
  // exclusion being softened to satisfy it.
  assert.equal(counts.derivedFrom, 1);
  assert.ok(
    c.some((x) => x.id === 'df:stool_variability__stool_form'),
    'the one surviving derivedFrom pair is the genuine health pair',
  );
  assert.ok(
    !c.some((x) => x.id.includes('log_completeness') || x.id.includes('notes')),
    'no app-measuring metric reaches candidate enumeration',
  );
  // The 6 ported MVP rules are single-metric; the cross (coincidence) blueprints —
  // hrv_rise_after_sleep_rise (U12) and gut_comfort_mood_comove (U13, the L6 slice) —
  // each co-name a distinct pair the seeder rightly enumerates as a rule_blueprint candidate.
  assert.equal(counts.rule_blueprint, 2);
  assert.equal(counts.static_topic, SEEDS.length);
});

test('#307: app-measuring metrics are never scientific-discovery subjects', () => {
  // A bounded-ingestion run carried SEVEN log_completeness__* candidates before this guard existed
  // (__mood_score, __gut_comfort_score, __energy_score, __urine_colour, __stool_form,
  // __outside_meals, __mosquito_bites), each asking the literature about our own logging-completeness
  // metric. Killed during discovery so nothing was stored, but only because it was noticed.
  //
  // buildCandidates derives pairs MECHANICALLY from registry derivedFrom[], so any metric other
  // metrics derive from becomes a discovery subject automatically. The exclusion has to live in code.
  const candidates = buildCandidates({
    metrics: [
      { key: 'log_completeness', status: 'active', derivedFrom: ['mood_score'] },
      { key: 'notes', status: 'active', derivedFrom: ['mood_score'] },
      // a metric DERIVED FROM an app metric must also not yield the pair
      { key: 'engagement_proxy', status: 'active', derivedFrom: ['log_completeness'] },
      // a genuine scientific pair still comes through
      { key: 'gut_comfort_score', status: 'active', derivedFrom: ['stool_form'] },
    ],
    blueprints: [
      // a completeness-gated rule stays a valid RULE; only the discovery pair is dropped
      { ruleId: 'completeness_gated', metricKeys: ['log_completeness', 'mood_score'], status: 'active' },
      { ruleId: 'real_pair', metricKeys: ['mood_score', 'anxiety_score'], status: 'active' },
    ],
    topics: [],
  });

  const ids = candidates.map((c) => c.id);
  for (const id of ids) {
    assert.ok(!id.includes('log_completeness'), `no candidate may name log_completeness: ${id}`);
    assert.ok(!id.includes('notes'), `no candidate may name notes: ${id}`);
  }
  // ...while the legitimate pairs survive, so the guard is not simply suppressing everything.
  assert.ok(ids.includes('df:gut_comfort_score__stool_form'), 'a real derivedFrom pair survives');
  assert.ok(ids.includes('rb:anxiety_score__mood_score'), 'a real blueprint pair survives');
});
