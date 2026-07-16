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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// ── fixtures ─────────────────────────────────────────────────────────────────

const METRICS: RegistryMetricInput[] = [
  { key: 'urine_colour', status: 'active', derivedFrom: null },
  { key: 'stool_form', status: 'active', derivedFrom: null },
  { key: 'stool_variability', status: 'active', derivedFrom: ['stool_form'] },
  { key: 'energy_score', status: 'active', derivedFrom: null },
  { key: 'log_completeness', status: 'active', derivedFrom: ['urine_colour', 'energy_score'] },
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
    'df:log_completeness__urine_colour',
    'df:log_completeness__energy_score',
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
      return { text: reply, model: 'claude-fable-5', route: 'local_agent', usage: { inputTokens: 10, outputTokens: 20 } };
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
  assert.ok(derived.some((m) => m.key === 'log_completeness'), 'log_completeness present');
  assert.ok(derived.some((m) => m.key === 'stool_variability'), 'stool_variability present');

  const blueprints = loadBlueprints();
  assert.ok(blueprints.length >= 6, `>=6 shipped blueprints (got ${blueprints.length})`);
  assert.ok(blueprints.every((b) => Array.isArray(b.metricKeys)), 'every blueprint has metricKeys');
});

test('enumerateSeederCandidates: real registry+blueprints → 8 derivedFrom + 6 topics', async () => {
  const c = await enumerateSeederCandidates();
  const counts = candidateCounts(c);
  assert.equal(counts.derivedFrom, 8);
  assert.equal(counts.rule_blueprint, 0); // all shipped MVP rules are single-metric
  assert.equal(counts.static_topic, 6);
});
