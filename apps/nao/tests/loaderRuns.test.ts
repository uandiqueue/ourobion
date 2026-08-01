// ourobion nao — R4-U3 (O26) atomic-loader tests (node:test, zero I/O, zero mocking).
//
// TWO KINDS OF PROOF, and the split is deliberate — it is the same split R4-U2 used
// and for the same empirically-verified reason (see apps/nao/tests/authz.test.ts's
// header): a route handler cannot be imported under `node --test` at all, because it
// uses the `@/lib/...` TS-only path alias and transitively imports `next/headers`,
// which has no `exports` entry plain-ESM resolution can follow. `mock.module()` fails
// DURING RESOLUTION, before it can substitute anything.
//
//   1. EXECUTED. Every decision — the durable request key, the SQLSTATE→HTTP map, the
//      worst-wins publication fold, the retry policy, the RPC argument payload and the
//      response body — lives in ../src/lib/loaderRuns.ts and ../src/lib/simulatedHealth.ts,
//      which are pure and are imported and RUN here. The response-shape assertions run
//      against the REAL builder the route calls, not an invented shape.
//
//   2. SOURCE-CONFORMANCE. The remaining wiring (which RPC the route calls, that the
//      two non-atomic upserts are gone, that no secret is compared or returned, that
//      no hosted endpoint can be accepted) is asserted by reading the .ts files as
//      text — with comments stripped first, so a doc comment that legitimately
//      DISCUSSES `SUPABASE_SERVICE_ROLE_KEY` or a hosted host by name is prose, not a
//      code reference.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROUTE_POLICY, redactDeep, satisfies } from '../src/lib/authz.ts';
import {
  LOADER_CONFLICT_SQLSTATE,
  LOADER_RUN_STATUSES,
  PIPELINE_STAGES,
  PLAN_INPUTS_RPC,
  REQUEST_KEY_PREFIX,
  RETRYABLE_LOADER_SQLSTATES,
  RUN_STATUS_SEVERITY,
  buildApplyArgs,
  buildLoaderResponse,
  buildPublicationSummary,
  deriveRequestKey,
  foldRunStatus,
  gutRangeSummary,
  httpStatusForLoaderError,
  isPublished,
  isRetryable,
  isRetryableLoaderError,
  parseApplyResult,
  parsePlanInputs,
  parseRecordedDigests,
  parseWatermark,
  retryPlanFor,
  stagesFromRelayBody,
  statusFromDatabase,
  uuidsIn,
  watermarkRange,
  watermarkSummary,
  worstStatus,
  type LoaderRunStatus,
  type LoaderWatermark,
  type ObservedStage,
} from '../src/lib/loaderRuns.ts';
import {
  LOADER_REQUEST_KEY_RE,
  SIMULATED_DATA_ORIGIN_RUN4,
  generateSimulatedDays,
  planLoadRange,
  validateLoaderBody,
  validateLoaderTarget,
} from '../src/lib/simulatedHealth.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(NAO_ROOT, '..', '..');

const LOADER_ROUTE = path.join(NAO_ROOT, 'src', 'app', '(app)', 'api', 'loader', 'route.ts');
const RELAY_ROUTE = path.join(
  NAO_ROOT,
  'src',
  'app',
  '(app)',
  'api',
  'loader',
  'run-pipeline',
  'route.ts',
);
const LOADER_RUNS_LIB = path.join(NAO_ROOT, 'src', 'lib', 'loaderRuns.ts');
const SIMULATED_HEALTH_LIB = path.join(NAO_ROOT, 'src', 'lib', 'simulatedHealth.ts');
const LOADER_PANEL = path.join(NAO_ROOT, 'src', 'components', 'LoaderPanel.tsx');

/** Every file R4-U3 owns in the nao app. The source-conformance walk covers all of them. */
const U3_FILES: readonly string[] = [LOADER_ROUTE, RELAY_ROUTE, LOADER_RUNS_LIB, SIMULATED_HEALTH_LIB];

/** Same convention as authz.test.ts: prose is not a code reference. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function code(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

// Synthetic identifiers, generated as literals here — never a real identity
// (R4-U2 invariant 5).
const TARGET = '11111111-2222-4333-8444-555555555555';
const CALLER = '99999999-8888-4777-8666-555555555555';
const REQUEST_KEY = ['u3', 'acceptance', 'key', '0001'].join('-');
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

const WATERMARK: LoaderWatermark = {
  gutCount: 14,
  gutMin: '2026-07-11',
  gutMax: '2026-07-24',
  wearCount: 14,
  wearMin: '2026-07-11',
  wearMax: '2026-07-24',
  digest: DIGEST_A,
};

// ───────────────────────────────────────────────────────────────────────────────
// 1. Authorization: who may drive the loader at all
// ───────────────────────────────────────────────────────────────────────────────

test('authorization: POST /api/loader requires curator, and neither an unauthenticated nor a non-member caller satisfies it', () => {
  // The real arithmetic, imported (not re-implemented). `null` is what
  // requireRole()/resolveNaoRole() produce for ALL of: no session, authenticated but
  // never a nao member, suspended, and revoked — collapsed deliberately so the
  // response cannot reveal which.
  assert.equal(ROUTE_POLICY['POST /api/loader'], 'curator');
  assert.equal(ROUTE_POLICY['GET /api/loader'], 'viewer');
  assert.equal(ROUTE_POLICY['POST /api/loader/run-pipeline'], 'curator');

  assert.equal(satisfies(null, 'curator'), false, 'unauthenticated / non-member must be denied');
  assert.equal(satisfies('viewer', 'curator'), false, 'an authenticated non-developer tier must be denied');
  assert.equal(satisfies('curator', 'curator'), true);
  assert.equal(satisfies('admin', 'curator'), true);
});

test('source-conformance: the gate is the first statement of POST /api/loader and precedes EVERY database call', () => {
  const source = code(LOADER_ROUTE);
  const post = source.slice(source.indexOf('export async function POST'));
  const gateAt = post.indexOf("guardRole('curator')");
  assert.ok(gateAt > -1, 'POST must gate on curator');
  assert.match(
    post.slice(post.indexOf('{') + 1).split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '',
    /^const gate = await guardRole\('curator'\)/,
  );
  // No RPC, no table read, and no body parse before the gate.
  for (const re of [/supabase\.rpc\(/, /createServerSupabaseClient\(/, /req\.json\(\)/]) {
    const at = post.search(re);
    assert.ok(at === -1 || gateAt < at, `the gate must precede ${String(re)}`);
  }
});

test('source-conformance: POST /api/loader refuses a target equal to the caller with 403, and a missing one with 400', () => {
  const source = code(LOADER_ROUTE);
  assert.match(
    source,
    /validateLoaderTarget\(body\.target, gate\.userId\)/,
    'the caller-identity check must compare the body target against the GATE’s userId',
  );
  assert.match(source, /targetError[\s\S]{0,80}?403/, 'a not-permitted target must be a 403');
  assert.match(source, /validationError[\s\S]{0,80}?400/, 'a malformed/absent field must be a 400');
});

test('the loader UI offers no interactive surface at all, while the server side stays gated', () => {
  // The loader page is an unavailable state: no demo target is registered, so
  // every load a visitor could start would be refused. The controls are REMOVED
  // rather than disabled — a disabled control is still an invitation — and this
  // asserts the removal, not merely the absence of the old target field.
  const source = code(LOADER_PANEL);
  for (const forbidden of [/<form/, /<button/, /<input/, /<select/, /onClick/, /onSubmit/, /useState/]) {
    assert.doesNotMatch(source, forbidden, `the unavailable loader surface must not render ${String(forbidden)}`);
  }
  assert.doesNotMatch(source, /fetch\(/, 'the panel must issue no request');
  assert.doesNotMatch(source, /['"]\/api\/loader/, 'the panel must name no loader endpoint');
  assert.doesNotMatch(source, /'use client'/, 'a surface with no state needs no client bundle');
  // Withdrawing the UI must not withdraw the guard: both handlers remain, and
  // remain curator-gated, so the capability is preserved for when a target exists.
  assert.equal(ROUTE_POLICY['POST /api/loader'], 'curator');
  assert.equal(ROUTE_POLICY['POST /api/loader/run-pipeline'], 'curator');
  assert.match(code(LOADER_ROUTE), /guardRole\('curator'\)/);
  assert.match(code(RELAY_ROUTE), /guardRole\('curator'\)/);
});

test('source-conformance: the loader NEVER writes the caller’s own user_id, and the two non-atomic upserts are gone', () => {
  const source = code(LOADER_ROUTE);
  // The retired self-write path (`user_id: gate.userId`) and both direct upserts.
  assert.doesNotMatch(source, /user_id:\s*gate\.userId/, 'the self-write path must be retired');
  assert.doesNotMatch(source, /\.from\('daily_gut_rows'\)[\s\S]{0,120}?\.upsert\(/, 'no direct gut upsert');
  assert.doesNotMatch(source, /\.from\('wearable_daily'\)[\s\S]{0,120}?\.upsert\(/, 'no direct wearable upsert');
  // Exactly one write path, and it is the atomic RPC. Two reads, both gated.
  const rpcCalls = [...source.matchAll(/supabase\.rpc\(\s*(?:'([a-z_]+)'|([A-Z_]+))/g)].map(
    (m) => m[1] ?? m[2],
  );
  assert.deepEqual(
    [...new Set(rpcCalls)].sort(),
    ['PLAN_INPUTS_RPC', "'nao_loader_apply_simulated_days'".replace(/'/g, '')],
    'the loader route may call only the gated plan-inputs read and the atomic apply RPC',
  );
  // The bare, ungated watermark function is service_role-only and must never be
  // called from a request path: it takes any uuid and answers about that user's rows.
  assert.doesNotMatch(source, /'nao_loader_watermark'/, 'the route must use the GATED wrapper');
  assert.equal(PLAN_INPUTS_RPC, 'nao_loader_plan_inputs');
});

// ───────────────────────────────────────────────────────────────────────────────
// 2. Durable request key
// ───────────────────────────────────────────────────────────────────────────────

const KEY_INPUT = {
  targetUserId: TARGET,
  scenario: 'recent-dip' as const,
  seed: 'run4-demo',
  days: 14,
  anchorDate: '2026-07-24',
  watermarkDigest: DIGEST_A,
};

test('deriveRequestKey: identical input yields an identical key (and it is charset-valid for the runs table)', async () => {
  const a = await deriveRequestKey(KEY_INPUT);
  const b = await deriveRequestKey({ ...KEY_INPUT });
  // Field order cannot matter: the input is an object. Written out in a different
  // literal order to make that concrete rather than implied.
  const c = await deriveRequestKey({
    watermarkDigest: DIGEST_A,
    anchorDate: '2026-07-24',
    days: 14,
    seed: 'run4-demo',
    scenario: 'recent-dip',
    targetUserId: TARGET,
  });
  assert.equal(a, b);
  assert.equal(a, c);
  assert.match(a, LOADER_REQUEST_KEY_RE, 'a derived key must satisfy the same charset/length rule as an explicit one');
  assert.ok(a.startsWith(REQUEST_KEY_PREFIX), 'a derived key is visibly distinguishable from a caller-supplied one');
  assert.equal(a.length, REQUEST_KEY_PREFIX.length + 64, 'sha-256 as hex');
  assert.deepEqual(uuidsIn(a), [], 'the key must not carry the target identity in the clear');
  assert.equal(a.includes(TARGET), false);
});

test('deriveRequestKey: changing ANY single input changes the key', async () => {
  const base = await deriveRequestKey(KEY_INPUT);
  const variants: Record<string, Parameters<typeof deriveRequestKey>[0]> = {
    target: { ...KEY_INPUT, targetUserId: CALLER },
    scenario: { ...KEY_INPUT, scenario: 'steady' },
    seed: { ...KEY_INPUT, seed: 'run4-demo2' },
    days: { ...KEY_INPUT, days: 15 },
    'days=auto': { ...KEY_INPUT, days: null },
    anchorDate: { ...KEY_INPUT, anchorDate: '2026-07-25' },
    // THE load-bearing one: the same request against a DIFFERENT raw-truth state is a
    // different request. This is what makes the key a watermark and not just a hash of
    // the body — and it is why an auto-derived key cannot (and must not) collapse a
    // retry that arrives after the first attempt committed.
    watermark: { ...KEY_INPUT, watermarkDigest: DIGEST_B },
  };
  const seen = new Map<string, string>([[base, 'base']]);
  for (const [label, input] of Object.entries(variants)) {
    const key = await deriveRequestKey(input);
    assert.notEqual(key, base, `${label} must change the key`);
    assert.equal(seen.has(key), false, `${label} collided with ${seen.get(key)}`);
    seen.set(key, label);
  }
});

test('deriveRequestKey: field boundaries cannot be forged by concatenation', async () => {
  // Without an unambiguous separator, ('ab','c') and ('a','bc') would hash the same
  // and two different requests would share one idempotency key — a replay returning
  // ANOTHER request's stored result.
  const one = await deriveRequestKey({ ...KEY_INPUT, seed: 'ab', anchorDate: '2026-07-24' });
  const two = await deriveRequestKey({ ...KEY_INPUT, seed: 'a', anchorDate: 'b2026-07-24' });
  assert.notEqual(one, two);
});

// ───────────────────────────────────────────────────────────────────────────────
// 3. The worst-wins publication fold
// ───────────────────────────────────────────────────────────────────────────────

function stage(name: string, ok: boolean, digest: string | null = DIGEST_A): ObservedStage {
  return { stage: name, ok, httpStatus: ok ? 200 : 500, watermarkDigest: digest };
}

test('the severity order is total, and its index IS the severity (which is what makes the fold order-independent)', () => {
  assert.deepEqual(LOADER_RUN_STATUSES, ['published', 'pending', 'incomplete', 'mixed', 'failed']);
  LOADER_RUN_STATUSES.forEach((status, index) => {
    assert.equal(RUN_STATUS_SEVERITY[status], index, `${status} severity`);
  });
  assert.ok(RUN_STATUS_SEVERITY.failed > RUN_STATUS_SEVERITY.mixed, 'failed outranks mixed');
  assert.ok(RUN_STATUS_SEVERITY.mixed > RUN_STATUS_SEVERITY.incomplete, 'mixed outranks incomplete');
  assert.ok(RUN_STATUS_SEVERITY.incomplete > RUN_STATUS_SEVERITY.pending, 'incomplete outranks pending');
  assert.ok(RUN_STATUS_SEVERITY.pending > RUN_STATUS_SEVERITY.published, 'nothing beats published downward');
});

test('foldRunStatus: EXHAUSTIVE over every stage subset x ok/not-ok x digest match/mismatch (2^9 combinations)', () => {
  // An independent expected-value computation, deliberately written in a different
  // shape from the implementation (a filter/branch cascade rather than a max over
  // severity terms) so the two can disagree.
  function expected(observed: readonly ObservedStage[], expectDigest: string | null): LoaderRunStatus {
    if (observed.some((s) => !s.ok)) return 'failed';
    if (expectDigest !== null && observed.some((s) => s.watermarkDigest !== null && s.watermarkDigest !== expectDigest)) {
      return 'mixed';
    }
    if (observed.length === 0) return 'pending';
    if (observed.length < PIPELINE_STAGES.length) return 'incomplete';
    return 'published';
  }

  let checked = 0;
  // 3 stages, each: absent | ok+match | ok+mismatch | fail+match | fail+mismatch.
  const shapes = [
    null,
    { ok: true, digest: DIGEST_A },
    { ok: true, digest: DIGEST_B },
    { ok: false, digest: DIGEST_A },
    { ok: false, digest: DIGEST_B },
  ] as const;
  for (const a of shapes) {
    for (const b of shapes) {
      for (const c of shapes) {
        const observed: ObservedStage[] = [];
        [a, b, c].forEach((shape, i) => {
          if (shape !== null) observed.push(stage(PIPELINE_STAGES[i], shape.ok, shape.digest));
        });
        const got = foldRunStatus(observed, DIGEST_A);
        assert.equal(got, expected(observed, DIGEST_A), `stages=${JSON.stringify(observed)}`);
        // Order-independence: the fold is a maximum, so a reversed arrival order — the
        // exact shape of a last-write-wins bug — cannot change the verdict.
        assert.equal(foldRunStatus([...observed].reverse(), DIGEST_A), got, 'reversed arrival order');
        checked += 1;
      }
    }
  }
  assert.equal(checked, 125);
});

test('foldRunStatus: a run that FAILED and also raced reports failed (a worse condition is never shadowed)', () => {
  const observed = [
    stage('compute-baselines', true, DIGEST_B), // raced
    stage('evaluate-signals', false, DIGEST_B), // and failed
    stage('generate-insights', true, DIGEST_B),
  ];
  assert.equal(foldRunStatus(observed, DIGEST_A), 'failed');
  // Remove the failure and the race is still reported — never published.
  assert.equal(foldRunStatus([observed[0], stage('evaluate-signals', true, DIGEST_B), observed[2]], DIGEST_A), 'mixed');
});

test('foldRunStatus: a later ok observation can NEVER improve an earlier failure of the same stage', () => {
  // This is the last-write-wins defect stated as a test. With a stored status column,
  // the second write wins; with a fold, the worse observation wins whatever the order.
  const failThenOk = [stage('compute-baselines', false), stage('compute-baselines', true)];
  const okThenFail = [stage('compute-baselines', true), stage('compute-baselines', false)];
  assert.equal(foldRunStatus(failThenOk, DIGEST_A), 'failed');
  assert.equal(foldRunStatus(okThenFail, DIGEST_A), 'failed');
  const full = PIPELINE_STAGES.map((s) => stage(s, true));
  assert.equal(foldRunStatus(full, DIGEST_A), 'published');
  assert.equal(
    foldRunStatus([...full, stage('generate-insights', false)], DIGEST_A),
    'failed',
    'a late failure must demote a published run',
  );
});

test('foldRunStatus: an unknown stage name is ignored, never counted toward completeness', () => {
  const full = PIPELINE_STAGES.map((s) => stage(s, true));
  assert.equal(foldRunStatus([...full, stage('a-future-fourth-stage', true)], DIGEST_A), 'published');
  assert.equal(foldRunStatus([stage('a-future-fourth-stage', false)], DIGEST_A), 'pending');
});

test('foldRunStatus: with NO expected digest the mismatch term is not contributed (an unobserved watermark is not a matching one)', () => {
  const raced = PIPELINE_STAGES.map((s) => stage(s, true, DIGEST_B));
  assert.equal(foldRunStatus(raced, DIGEST_A), 'mixed');
  assert.equal(foldRunStatus(raced, null), 'published', 'the fold itself cannot check what it was not given');
  // ...which is exactly why the SUMMARY caps an unverifiable run below published.
  assert.equal(buildPublicationSummary({ stages: raced, expectedDigest: null }).status, 'incomplete');
  assert.equal(buildPublicationSummary({ stages: raced, expectedDigest: null }).watermarkChecked, false);
  assert.equal(buildPublicationSummary({ stages: raced, expectedDigest: null }).published, false);
});

test('buildPublicationSummary: only a complete, clean, watermark-stable run is published', () => {
  const clean = buildPublicationSummary({
    stages: PIPELINE_STAGES.map((s) => stage(s, true)),
    expectedDigest: DIGEST_A,
  });
  assert.equal(clean.status, 'published');
  assert.equal(clean.published, true);
  assert.equal(clean.retryable, false);
  assert.equal(clean.stagesObserved, 3);
  assert.equal(clean.stagesExpected, 3);
  assert.equal(clean.failedStage, null);
  assert.equal(clean.watermarkChecked, true);
  assert.equal(clean.watermarkStable, true);

  const raced = buildPublicationSummary({
    stages: PIPELINE_STAGES.map((s) => stage(s, true, DIGEST_B)),
    expectedDigest: DIGEST_A,
  });
  assert.equal(raced.status, 'mixed');
  assert.equal(raced.published, false);
  assert.equal(raced.watermarkStable, false, 'a mixed run must report its watermark as unstable');
});

test('statusFromDatabase: reads nao_loader_status’s document, maps `absent` to `pending`, refuses junk', () => {
  for (const status of LOADER_RUN_STATUSES) {
    assert.equal(statusFromDatabase({ status, severity: RUN_STATUS_SEVERITY[status] }), status);
  }
  // 'absent' = no run row for the target at all, which is this scale's `pending`.
  assert.equal(statusFromDatabase({ status: 'absent', severity: 1 }), 'pending');
  for (const junk of [null, undefined, 'published', 42, [], {}, { status: 'ok' }, { status: 7 }]) {
    assert.equal(statusFromDatabase(junk), null, `${JSON.stringify(junk)}`);
  }
});

test('worstStatus: combining two DERIVATIONS is worst-wins too, so a disagreement resolves pessimistically', () => {
  for (const a of LOADER_RUN_STATUSES) {
    for (const b of LOADER_RUN_STATUSES) {
      const worst = worstStatus(a, b);
      assert.equal(RUN_STATUS_SEVERITY[worst], Math.max(RUN_STATUS_SEVERITY[a], RUN_STATUS_SEVERITY[b]));
      assert.equal(worstStatus(b, a), worst, 'commutative');
    }
  }
});

test('buildPublicationSummary: the database’s verdict can only make the answer WORSE, never better', () => {
  const clean = PIPELINE_STAGES.map((s) => stage(s, true, null));
  // Locally: all three ok, but no watermark observable ⇒ capped at incomplete.
  assert.equal(buildPublicationSummary({ stages: clean, expectedDigest: null }).status, 'incomplete');
  // With the database's watermark-verified verdict, it becomes a real publication.
  const published = buildPublicationSummary({
    stages: clean,
    expectedDigest: null,
    databaseStatus: 'published',
  });
  assert.equal(published.status, 'published');
  assert.equal(published.watermarkChecked, true, 'the database DID compare per-stage digests');
  assert.equal(published.source, 'database');
  // A database `mixed` demotes a locally-clean run...
  assert.equal(
    buildPublicationSummary({ stages: clean, expectedDigest: null, databaseStatus: 'mixed' }).status,
    'mixed',
  );
  // ...and a local failure is never upgraded by a database `published`.
  const failed = [stage('compute-baselines', false, null)];
  assert.equal(
    buildPublicationSummary({ stages: failed, expectedDigest: null, databaseStatus: 'published' }).status,
    'failed',
  );
  assert.equal(buildPublicationSummary({ stages: clean, expectedDigest: null }).source, 'relay');
});

/**
 * The EXECUTABLE fold in `nao_loader_status`, with `--` prose removed first.
 *
 * Comment-stripping is the whole point (independent review finding F4). The previous
 * version of this test matched `/severity (\d)\s+(published|…)/`, a pattern that occurs
 * ONLY in the migration's `--` documentation table and never in the `greatest()`
 * expression that actually runs — so changing `then 4` to `then 2` inside `greatest()`,
 * the exact defect the test is named for, left it green. What follows parses the running
 * SQL instead, and there is a mechanical proof it can fail: flip any `then N` in the
 * migration's greatest() and this test goes red.
 */
function executableFold(migration: string): { severityExpr: string; statusExpr: string } {
  const sql = migration.replace(/--.*$/gm, '');
  const severityAt = sql.indexOf('v_severity := greatest(');
  assert.ok(severityAt > -1, 'nao_loader_status must fold with greatest() over severity terms');
  const severityEnd = sql.indexOf(');', severityAt);
  assert.ok(severityEnd > severityAt, 'the greatest() expression must terminate');
  const statusAt = sql.indexOf('v_status := case v_severity', severityEnd);
  assert.ok(statusAt > -1, 'the severity must be mapped back to a status name in SQL');
  const statusEnd = sql.indexOf('end;', statusAt);
  assert.ok(statusEnd > statusAt, 'the status case expression must terminate');
  return {
    severityExpr: sql.slice(severityAt, severityEnd + 2),
    statusExpr: sql.slice(statusAt, statusEnd + 4),
  };
}

/**
 * Which status each executable `case` term IS, identified by the CONDITION it tests
 * rather than by the number it yields — so the number is free to be wrong and be caught.
 */
const SQL_FOLD_TERMS: readonly { status: LoaderRunStatus; condition: RegExp }[] = [
  { status: 'failed', condition: /not\s+s\.ok/ },
  { status: 'mixed', condition: /watermark_digest/ },
  { status: 'incomplete', condition: /v_stages\s+between\s+1\s+and\s+2/ },
  { status: 'pending', condition: /v_stages\s*=\s*0/ },
];

test('the TypeScript fold and the EXECUTABLE SQL fold declare the SAME total order (they must never drift)', () => {
  const migration = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20260729010001_nao_loader_runs.sql'),
    'utf8',
  );
  const { severityExpr, statusExpr } = executableFold(migration);

  // ── 1. Every severity TERM inside greatest() yields this module's severity ──────────
  const terms = [...severityExpr.matchAll(/case\s+when\s+([\s\S]*?)\s+then\s+(\d+)\s+else\s+0\s+end/g)].map(
    (m) => ({ condition: m[1], severity: Number(m[2]) }),
  );
  assert.equal(terms.length, SQL_FOLD_TERMS.length, 'the executable fold must have one term per non-zero severity');
  const seen = new Set<LoaderRunStatus>();
  for (const term of terms) {
    const matched = SQL_FOLD_TERMS.filter((known) => known.condition.test(term.condition));
    assert.equal(matched.length, 1, `term is not identifiable by its condition: ${term.condition}`);
    const { status } = matched[0];
    assert.equal(seen.has(status), false, `${status} is folded twice`);
    seen.add(status);
    // THE ASSERTION THE OLD TEST COULD NOT MAKE: the number the running SQL yields.
    assert.equal(
      term.severity,
      RUN_STATUS_SEVERITY[status],
      `the SQL term testing ${status} yields ${term.severity}, but ${status} is severity ${RUN_STATUS_SEVERITY[status]} in TypeScript`,
    );
  }
  assert.deepEqual([...seen].sort(), ['failed', 'incomplete', 'mixed', 'pending'], 'every non-zero severity folded');
  // `published` is the floor, expressed as greatest()'s trailing 0 argument.
  assert.equal(RUN_STATUS_SEVERITY.published, 0);
  assert.match(severityExpr, /,\s*0\s*\)/, 'greatest() must carry the published floor as its 0 term');

  // ── 2. The severity → status NAMES the running SQL maps back to ─────────────────────
  const named = [...statusExpr.matchAll(/when\s+(\d+)\s+then\s+'([a-z]+)'/g)].map((m) => ({
    severity: Number(m[1]),
    status: m[2] as LoaderRunStatus,
  }));
  const fallback = /else\s+'([a-z]+)'/.exec(statusExpr);
  assert.ok(fallback !== null, 'the SQL status case must have an else branch');
  const fallbackStatus = fallback[1] as LoaderRunStatus;
  for (const { severity, status } of named) {
    assert.equal(
      RUN_STATUS_SEVERITY[status],
      severity,
      `SQL maps severity ${severity} to '${status}', TypeScript says ${RUN_STATUS_SEVERITY[status]}`,
    );
  }
  assert.equal(RUN_STATUS_SEVERITY[fallbackStatus], 0, 'the else branch must be the severity-0 status');
  assert.deepEqual(
    [...named.map((n) => n.status), fallbackStatus].sort(),
    [...LOADER_RUN_STATUSES].sort(),
    'the SQL must name every status this module declares, and no others',
  );

  // ── 3. The `--` documentation table must agree with the code it documents ───────────
  const declared = [...migration.matchAll(/severity (\d)\s+(published|pending|incomplete|mixed|failed)\b/g)].map(
    (m) => ({ severity: Number(m[1]), status: m[2] as LoaderRunStatus }),
  );
  assert.equal(declared.length, 5, 'the SQL fold must document all five severities');
  for (const { severity, status } of declared) {
    assert.equal(RUN_STATUS_SEVERITY[status], severity, `${status} must be severity ${severity} on both sides`);
  }

  // ── 4. Still a derivation, not a stored column ──────────────────────────────────────
  // Comments are stripped first: the migration legitimately DISCUSSES the absent column
  // by name ("THERE IS NO overall_status COLUMN, AND THAT IS THE DESIGN"), and that prose
  // is the opposite of the defect — only a real column declaration counts.
  const sql = migration.replace(/--.*$/gm, '');
  assert.match(sql, /greatest\(/, 'the SQL fold must be a maximum over severity terms');
  assert.doesNotMatch(sql, /overall_status/, 'there must be no stored aggregate column');
  assert.doesNotMatch(sql, /^\s*(?:overall_status|publication_status)\s+text/m);
});

test('the SQL status verdict is RUN-SCOPED, so an over-running pipeline cannot be answered about the wrong run', () => {
  // Review finding F3: nao_loader_record_pipeline looked the run up BY KEY and then
  // returned a verdict derived from whatever run was most recent for the TARGET, so a
  // raced run reported `pending` (severity 1) instead of `mixed` (severity 3) and the
  // returned requestKey was somebody else's.
  const runs = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20260729010001_nao_loader_runs.sql'),
    'utf8',
  ).replace(/--.*$/gm, '');
  const apply = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20260729010002_nao_loader_apply_simulated_days.sql'),
    'utf8',
  ).replace(/--.*$/gm, '');

  assert.match(
    runs,
    /create or replace function public\.nao_loader_status\(\s*p_target_user_id uuid,\s*p_request_key text\s*\)/,
    'a run-scoped nao_loader_status(uuid, text) must exist',
  );
  assert.match(
    apply,
    /return public\.nao_loader_status\(v_run\.target_user_id,\s*p_request_key\)/,
    'record_pipeline must pass the CALLER’s request key through, not just the target',
  );
  assert.doesNotMatch(
    apply,
    /return public\.nao_loader_status\(v_run\.target_user_id\)\s*;/,
    'the target-scoped form must not be the answer record_pipeline gives',
  );
  // ...and it hands back the digest it observed, so the relay's own fold has something
  // real to compare against (finding F10).
  assert.match(apply, /jsonb_build_object\('observedDigest', v_digest\)/);
});

test('SQL source-conformance: BOTH truth-table upserts guard their DO UPDATE branch on existing provenance', () => {
  // Review finding F1, as a source assertion over the running SQL. The behavioural proof
  // is the two-process TOCTOU race in supabase/tests/u3 (u3.toctou.*), which cannot run
  // in CI (docker); this one can, and it catches the guard being deleted.
  const apply = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20260729010002_nao_loader_apply_simulated_days.sql'),
    'utf8',
  ).replace(/--.*$/gm, '');

  for (const [table, column] of [
    ['daily_gut_rows', 'data_origin'],
    ['wearable_daily', 'source'],
  ] as const) {
    const at = apply.indexOf(`insert into public.${table} (`);
    assert.ok(at > -1, `the apply function must upsert ${table}`);
    // From the insert to the end of the statement that closes the CTE and counts it.
    const end = apply.indexOf('select count(*) into v_n from written;', at);
    assert.ok(end > at, `${table}'s upsert must count what it actually wrote`);
    const statement = apply.slice(at, end);
    assert.match(statement, /on conflict[\s\S]*?do update set/, `${table} upserts`);
    assert.match(
      statement,
      new RegExp(`where ${table}\\.${column} is not null`),
      `${table}'s DO UPDATE must refuse a row whose provenance is absent`,
    );
    assert.match(
      statement,
      new RegExp(`exists \\(select 1 from public\\.nao_simulation_origins o[\\s\\S]*?o\\.origin = ${table}\\.${column}[\\s\\S]*?o\\.revoked_at is null and o\\.is_simulated\\)`),
      `${table}'s DO UPDATE must require the EXISTING row's provenance to be registered simulation`,
    );
    // RETURNING, not `get diagnostics` — the diagnostic cannot distinguish the branches,
    // which is exactly why the original row-count guard could not see the overwrite.
    assert.match(statement, /returning 1 as one/, `${table}'s upsert must count via RETURNING`);
    assert.doesNotMatch(statement, /get diagnostics/, `${table} must not rely on get diagnostics`);
  }
  // A skipped row fails the WHOLE transaction with the same refusal the scan gives.
  assert.match(apply, /using errcode = 'OU409'[\s\S]{0,200}?protected date\(s\)/);
  // And the repair path carries the same lease refusal as the write path (finding F2).
  const release = apply.slice(apply.indexOf('function public.nao_loader_release_simulated_days'));
  assert.match(
    release,
    /lease_until[\s\S]*?raise exception 'nao: loader target not permitted' using errcode = '42501'/,
    'the release RPC must refuse to delete under an open publication lease',
  );
});

test('buildPublicationSummary carries no identity, and survives redactDeep unchanged', () => {
  const summary = buildPublicationSummary({
    stages: PIPELINE_STAGES.map((s) => stage(s, true)),
    expectedDigest: DIGEST_A,
  });
  assert.deepEqual(uuidsIn(summary), []);
  assert.deepEqual(redactDeep(summary), summary, 'nothing in the verdict is identity- or secret-shaped');
});

// ───────────────────────────────────────────────────────────────────────────────
// 4. Publication ordering + "a failure after each stage stays retryable"
// ───────────────────────────────────────────────────────────────────────────────

test('a pipeline failure after EACH stage is never published, and is always retryable', () => {
  // `run-pipeline` stops at the first non-ok stage, so a failure at stage i yields
  // i-1 ok rows plus the failed one — never the later stages. Walk all three.
  for (let failAt = 0; failAt < PIPELINE_STAGES.length; failAt += 1) {
    const observed: ObservedStage[] = [];
    for (let i = 0; i < failAt; i += 1) observed.push(stage(PIPELINE_STAGES[i], true));
    observed.push(stage(PIPELINE_STAGES[failAt], false));

    const summary = buildPublicationSummary({ stages: observed, expectedDigest: DIGEST_A });
    assert.equal(summary.status, 'failed', `failure at ${PIPELINE_STAGES[failAt]}`);
    assert.equal(summary.published, false, `a partial pipeline must never report published`);
    assert.equal(summary.retryable, true);
    assert.equal(summary.failedStage, PIPELINE_STAGES[failAt]);

    const plan = retryPlanFor(summary.status);
    assert.equal(plan.retryable, true);
    // Projections are rebuilt ONLY through the existing engine functions — never
    // hand-edited (docs/memory/0001-two-tier-truth.md). There is exactly one rebuild
    // path, and re-running from the start is a rebuild (every engine is a whole-batch
    // upsert-plus-prune over raw truth), not a duplicate.
    assert.equal(plan.rebuildVia, 'run-pipeline');
    assert.deepEqual(plan.stagesToRerun, PIPELINE_STAGES);
    assert.equal(plan.rawTruthAffected, false, 'a pipeline failure never damages raw truth');
  }
});

test('an INCOMPLETE run (the sequencer stopped early with no failure reported) is also not published', () => {
  for (const count of [0, 1, 2]) {
    const observed = PIPELINE_STAGES.slice(0, count).map((s) => stage(s, true));
    const summary = buildPublicationSummary({ stages: observed, expectedDigest: DIGEST_A });
    assert.equal(summary.published, false, `${count} stage(s) observed must not be published`);
    assert.equal(summary.status, count === 0 ? 'pending' : 'incomplete');
    assert.equal(isRetryable(summary.status), true);
  }
});

test('isPublished / isRetryable partition the status space with no gap', () => {
  for (const status of LOADER_RUN_STATUSES) {
    assert.equal(isPublished(status), status === 'published');
    assert.equal(isRetryable(status), !isPublished(status), `${status}`);
  }
});

test('stagesFromRelayBody: reads the REAL run-pipeline envelope, and refuses to invent stages from junk', () => {
  // The exact shape supabase/functions/run-pipeline/index.ts returns.
  const envelope = {
    ok: false,
    failedStage: 'evaluate-signals',
    stages: [
      { stage: 'compute-baselines', status: 200, ok: true, summary: { users: 2 } },
      { stage: 'evaluate-signals', status: 500, ok: false, summary: { error: 'boom' } },
    ],
  };
  const observed = stagesFromRelayBody(envelope, DIGEST_A);
  assert.deepEqual(observed, [
    { stage: 'compute-baselines', ok: true, httpStatus: 200, watermarkDigest: DIGEST_A },
    { stage: 'evaluate-signals', ok: false, httpStatus: 500, watermarkDigest: DIGEST_A },
  ]);
  assert.equal(buildPublicationSummary({ stages: observed, expectedDigest: DIGEST_A }).status, 'failed');

  for (const junk of [null, undefined, 'string', 42, [], {}, { stages: 'nope' }, { stages: [1, 'two', null] }]) {
    assert.deepEqual(stagesFromRelayBody(junk, DIGEST_A), [], `${JSON.stringify(junk)}`);
  }
  // `ok` is only ever true when it is literally true — a truthy string must not pass.
  assert.equal(stagesFromRelayBody({ stages: [{ stage: 'compute-baselines', ok: 'yes' }] }, null)[0].ok, false);
});

test('source-conformance: the relay derives its verdict and never rewrites run-pipeline’s HTTP semantics', () => {
  const source = code(RELAY_ROUTE);
  assert.match(source, /buildPublicationSummary\(/, 'the relay must derive the publication verdict');
  assert.match(source, /stagesFromRelayBody\(/);
  // No stored aggregate anywhere: the verdict is computed per response.
  for (const forbidden of [/overall_status/, /publication_status/, /\.update\(\s*\{[^}]*status/]) {
    assert.doesNotMatch(source, forbidden, `a STORED status is the defect being closed: ${String(forbidden)}`);
  }
  // The extracted-and-executed relay block must still exist untouched in shape.
  const raw = readFileSync(RELAY_ROUTE, 'utf8');
  assert.ok(raw.includes('── relay:begin'), 'the relay:begin sentinel must survive');
  assert.ok(raw.includes('── relay:end'), 'the relay:end sentinel must survive');
  const block = raw.slice(raw.indexOf('── relay:begin'), raw.indexOf('── relay:end'));
  assert.match(block, /redactRelayBody\(JSON\.parse\(text\)\)/, 'the relay must stay redacted');
  // The fold must live OUTSIDE the block: redact.test.ts compiles the block with a
  // FIXED parameter list (fetch, json, redactRelayBody, redactText, url, anonKey,
  // internalSecret, INTERNAL_SECRET_HEADER), so a reference to anything else would be
  // a ReferenceError at test time — which is exactly why the verdict is computed in
  // the `json` the block closes over.
  assert.doesNotMatch(block, /buildPublicationSummary|recordStages\(|supabase|requestKey/);
  // The verdict IS recorded through the definer function, which is what observes the
  // per-stage watermark digest the route cannot read for another user.
  assert.match(source, /nao_loader_record_pipeline/);
  assert.doesNotMatch(source, /'nao_loader_watermark'/, 'the relay must not call the ungated read either');
});

test('the relay scopes the run by requestKey, not by a target uuid', () => {
  const source = code(RELAY_ROUTE);
  // A uuid in the request body would be a target identifier the relay does not need:
  // the run row already knows its target, and the definer re-validates it.
  assert.match(source, /body\.requestKey/);
  assert.doesNotMatch(source, /body\.target/, 'the relay must not take a target uuid');
  assert.match(source, /LOADER_REQUEST_KEY_RE\.test\(requestKey\)/, 'the key shape is validated');
});

// ───────────────────────────────────────────────────────────────────────────────
// 5. SQLSTATE -> HTTP
// ───────────────────────────────────────────────────────────────────────────────

test('httpStatusForLoaderError: every SQLSTATE the loader RPCs raise maps to its intended status', () => {
  assert.equal(httpStatusForLoaderError('42501'), 403, 'every authorization denial');
  assert.equal(httpStatusForLoaderError(LOADER_CONFLICT_SQLSTATE), 409, 'provenance conflict, nothing written');
  assert.equal(LOADER_CONFLICT_SQLSTATE, 'OU409');
  assert.equal(httpStatusForLoaderError('23514'), 400, 'CHECK violation (payload/shape)');
  assert.equal(httpStatusForLoaderError('22023'), 400, 'invalid parameter / row-count assertion');
  assert.equal(httpStatusForLoaderError('22P02'), 400, 'malformed input syntax');
  assert.equal(httpStatusForLoaderError('42883'), 400, 'no function matches — a missing required argument');
  for (const unknown of ['XX000', '57014', '', 'nonsense', null, undefined]) {
    assert.equal(httpStatusForLoaderError(unknown), 500, `${String(unknown)} is a genuine server fault`);
  }
  // A denial must never be reported as a server error: that is the difference between
  // "you may not" and "we broke", and R4-U2's release gate cares about exactly that
  // distinction on the edge-function side.
  assert.notEqual(httpStatusForLoaderError('42501'), 500);
});

test('a TRANSIENT serialization failure is retryable, not a 500 (the single-flight isolation assumption, made visible)', () => {
  // Review finding F7: the RPC's replay depends on READ COMMITTED — each statement in
  // plpgsql takes a fresh snapshot, which is what lets the loser of a race see the
  // winner's committed run row. Under REPEATABLE READ the loser raises 40001 instead,
  // and 40001 was absent from the map, so a retryable race surfaced as an opaque 500.
  for (const transient of RETRYABLE_LOADER_SQLSTATES) {
    assert.equal(httpStatusForLoaderError(transient), 503, `${transient} must be retryable, not a server fault`);
    assert.equal(isRetryableLoaderError(transient), true);
    assert.notEqual(httpStatusForLoaderError(transient), 500);
  }
  assert.deepEqual([...RETRYABLE_LOADER_SQLSTATES].sort(), ['40001', '40P01'], 'serialization failure and deadlock');
  // 409 already means "the provenance refusal", which is NOT retryable unchanged, so a
  // transient failure must not borrow it.
  for (const transient of RETRYABLE_LOADER_SQLSTATES) {
    assert.notEqual(httpStatusForLoaderError(transient), httpStatusForLoaderError(LOADER_CONFLICT_SQLSTATE));
  }
  for (const permanent of ['42501', LOADER_CONFLICT_SQLSTATE, '23514', '22023', '22P02', '42883', 'XX000', null]) {
    assert.equal(isRetryableLoaderError(permanent), false, `${String(permanent)} is not a transient failure`);
  }
  // The assumption is not merely handled, it is WRITTEN DOWN where the dependency lives.
  const apply = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20260729010002_nao_loader_apply_simulated_days.sql'),
    'utf8',
  );
  assert.match(apply, /READ COMMITTED/, 'the migration header must state the isolation-level dependency');
  assert.match(apply, /40001/, 'and name the SQLSTATE a stricter level would raise');
});

test('parseRecordedDigests: the relay’s watermark check is WIRED, not a permanently-null branch', () => {
  // Review finding F10: the only call site passed `observedDigest: null` and
  // `expectedDigest: null`, so foldRunStatus's watermark term and
  // PublicationSummary.watermarkStable were unreachable in production — dead code
  // asserting a capability. nao_loader_record_pipeline now returns both digests.
  assert.deepEqual(parseRecordedDigests({ watermarkAfter: DIGEST_A, observedDigest: DIGEST_B }), {
    expected: DIGEST_A,
    observed: DIGEST_B,
  });
  // Only a real sha-256 hex digest is accepted; anything else degrades to "not observed",
  // which caps the verdict below published rather than pretending the check passed.
  for (const junk of [null, undefined, '', 'nope', 42, {}, [], 'A'.repeat(64), 'a'.repeat(63)]) {
    assert.deepEqual(parseRecordedDigests({ watermarkAfter: junk, observedDigest: junk }), {
      expected: null,
      observed: null,
    });
  }
  for (const junk of [null, undefined, 'string', 7, []]) {
    assert.deepEqual(parseRecordedDigests(junk), { expected: null, observed: null });
  }
  // And the wiring is real: with the pair fed in, a moved watermark reaches `mixed`
  // through the LOCAL fold, without the database having to say so.
  const digests = parseRecordedDigests({ watermarkAfter: DIGEST_A, observedDigest: DIGEST_B });
  const racedStages = PIPELINE_STAGES.map((s) => stage(s, true, digests.observed));
  const summary = buildPublicationSummary({ stages: racedStages, expectedDigest: digests.expected });
  assert.equal(summary.status, 'mixed');
  assert.equal(summary.watermarkChecked, true);
  assert.equal(summary.watermarkStable, false);
  assert.equal(summary.published, false);
});

test('source-conformance: the relay feeds the RECORDED digests into its own fold', () => {
  const source = code(RELAY_ROUTE);
  assert.match(source, /parseRecordedDigests\(/, 'the relay must read the digests record_pipeline returns');
  assert.match(source, /expectedDigest:\s*digests\.expected/, 'the run’s committed watermark is the expectation');
  assert.match(source, /digests\.observed/, 'the observed digest must be attributed to the stages');
  // The dead shape: a hard-coded null expectation at the call site.
  assert.doesNotMatch(
    source,
    /expectedDigest:\s*null/,
    'a hard-coded null expectation is the dead-code shape this replaced',
  );
});

// ───────────────────────────────────────────────────────────────────────────────
// 6. The RPC payload: gut + wearable planned and written TOGETHER
// ───────────────────────────────────────────────────────────────────────────────

test('watermarkRange: the plan is computed over BOTH truth tables, so a divergence can only close', () => {
  assert.deepEqual(watermarkRange(WATERMARK), { minDate: '2026-07-11', maxDate: '2026-07-24' });
  // Wearable history reaches further back, gut reaches further forward: the union is
  // the honest existing range. Pre-U3 the plan saw the gut side only, so a
  // wearable-only day was invisible to planning.
  assert.deepEqual(
    watermarkRange({
      ...WATERMARK,
      gutMin: '2026-07-11',
      gutMax: '2026-07-24',
      wearMin: '2026-07-04',
      wearMax: '2026-07-20',
    }),
    { minDate: '2026-07-04', maxDate: '2026-07-24' },
  );
  // One side entirely empty (a half-loaded history) still yields a usable range.
  assert.deepEqual(
    watermarkRange({ ...WATERMARK, wearCount: 0, wearMin: null, wearMax: null }),
    { minDate: '2026-07-11', maxDate: '2026-07-24' },
  );
  // Nothing loaded at all ⇒ null ⇒ the route plans a first load ending today.
  assert.equal(
    watermarkRange({ ...WATERMARK, gutCount: 0, gutMin: null, gutMax: null, wearCount: 0, wearMin: null, wearMax: null }),
    null,
  );
});

test('watermarkSummary: reports the two tables separately and flags a misalignment', () => {
  assert.equal(watermarkSummary(WATERMARK).aligned, true);
  assert.equal(watermarkSummary({ ...WATERMARK, wearCount: 13 }).aligned, false, 'a missing wearable day is visible');
  assert.equal(watermarkSummary({ ...WATERMARK, wearMax: '2026-07-23' }).aligned, false);
  assert.deepEqual(uuidsIn(watermarkSummary(WATERMARK)), []);
});

test('buildApplyArgs: parameter names transcribe the RPC signature, and every day is a MATCHED PAIR', () => {
  const plan = planLoadRange(null, 14, '2026-07-24');
  const generated = plan.segments.flatMap((segment) =>
    generateSimulatedDays({
      startDate: segment.startDate,
      days: segment.days,
      seed: 'run4-demo',
      scenario: 'recent-dip',
      anchorDate: '2026-07-24',
      origin: SIMULATED_DATA_ORIGIN_RUN4,
    }),
  );
  const args = buildApplyArgs({
    target: TARGET,
    requestKey: REQUEST_KEY,
    origin: SIMULATED_DATA_ORIGIN_RUN4,
    seed: 'run4-demo',
    scenario: 'recent-dip',
    anchorDate: '2026-07-24',
    daysRequested: 14,
    plan,
    generated,
  });
  assert.deepEqual(Object.keys(args).sort(), [
    'p_days',
    'p_origin',
    'p_plan',
    'p_request_key',
    'p_target_user_id',
  ]);
  assert.equal(args.p_target_user_id, TARGET);
  assert.equal(args.p_origin, SIMULATED_DATA_ORIGIN_RUN4);
  assert.equal(args.p_days.length, 14);
  assert.equal(args.p_plan.daysRequested, 14);
  assert.deepEqual(args.p_plan.segments, plan.segments);
  // ONE array, ONE statement, ONE transaction: there is no ordering between the two
  // tables to get wrong, and no window in which one side exists without the other.
  for (const day of args.p_days) {
    assert.equal(day.gut.log_date, day.date, 'the gut row must be for the same day');
    assert.equal(day.wearable.date, day.date, 'the wearable row must be for the same day');
    assert.equal(day.gut.data_origin, SIMULATED_DATA_ORIGIN_RUN4);
    assert.equal(day.wearable.source, SIMULATED_DATA_ORIGIN_RUN4);
  }
  // The payload names a user nowhere — the RPC writes `p_target_user_id`, so no row
  // in the payload can be pointed at a different account.
  assert.equal(JSON.stringify(args.p_days).includes('user_id'), false);
});

// ───────────────────────────────────────────────────────────────────────────────
// 7. The response: no identity, no secret
// ───────────────────────────────────────────────────────────────────────────────

/** The EXACT document `nao_loader_apply_simulated_days` returns (jsonb_build_object, migration 030002). */
const APPLY_RESULT_RAW = {
  ok: true,
  replayed: false,
  targetLabel: 'demo:u3',
  origin: SIMULATED_DATA_ORIGIN_RUN4,
  requestKey: REQUEST_KEY,
  loadedDays: 14,
  gutRowsWritten: 14,
  wearableRowsWritten: 14,
  firstDate: '2026-07-11',
  lastDate: '2026-07-24',
  plan: { seed: 'run4-demo', scenario: 'recent-dip' },
  watermarkBefore: DIGEST_A,
  watermarkAfter: DIGEST_B,
};

const WATERMARK_AFTER: LoaderWatermark = { ...WATERMARK, gutCount: 14, digest: DIGEST_B };

function realResponse(overrides: Partial<Parameters<typeof buildLoaderResponse>[0]> = {}) {
  const plan = planLoadRange(null, 14, '2026-07-24');
  return buildLoaderResponse({
    loadedDays: 14,
    plan,
    seed: 'run4-demo',
    scenario: 'recent-dip',
    origin: SIMULATED_DATA_ORIGIN_RUN4,
    requestKey: REQUEST_KEY,
    requestKeyMode: 'explicit',
    today: '2026-07-24',
    watermarkBefore: WATERMARK,
    watermarkAfter: WATERMARK_AFTER,
    applied: parseApplyResult(APPLY_RESULT_RAW),
    ...overrides,
  });
}

test('the REAL loader response carries ZERO user uuids and survives redactDeep unchanged', () => {
  const body = realResponse();
  assert.deepEqual(uuidsIn(body), [], `the response leaked an identity: ${JSON.stringify(body)}`);
  assert.equal(JSON.stringify(body).includes(TARGET), false);
  assert.equal(JSON.stringify(body).includes(CALLER), false);
  // No identity-shaped or secret-shaped KEY either, at any depth: redactDeep drops
  // those, so an unchanged round-trip proves none is present. (A field named around
  // the deny-list would be a real regression of R4-U2's finding 1, not a hole.)
  assert.deepEqual(redactDeep(body), body);
  for (const forbidden of ['user_id', 'userId', 'target"', 'actor', 'secret', 'token', 'apikey']) {
    assert.equal(JSON.stringify(body).includes(forbidden), false, `the response must not carry ${forbidden}`);
  }
  // What it DOES carry: a hash and a non-identifying registry label.
  assert.equal(body.targetLabel, 'demo:u3');
  assert.equal(body.requestKey, REQUEST_KEY);
  assert.equal(body.ok, true);
  assert.equal(body.loadedDays, 14);
  assert.equal(body.origin, SIMULATED_DATA_ORIGIN_RUN4);
  assert.equal(body.requestKeyMode, 'explicit');
  assert.equal(body.replayed, false);
  // `range` is the POST-write watermark, re-read through the gated RPC — not the
  // pre-write one, and not a read of the caller's own rows (which would be a
  // different user's data entirely).
  assert.deepEqual(body.range, gutRangeSummary(WATERMARK_AFTER));
  assert.equal(body.watermarkAfter?.digest, DIGEST_B);
  assert.equal(body.watermarkBefore.digest, DIGEST_A);
  assert.equal(body.today, '2026-07-24');
});

test('the response reports the RUN’s own day count, so a replay does not claim a fresh write', () => {
  // On a replay the RPC returns the stored result and writes nothing; `generated.length`
  // is what WOULD have been written, so the run's own count is authoritative.
  const replay = realResponse({
    loadedDays: 7,
    applied: parseApplyResult({ ...APPLY_RESULT_RAW, replayed: true, loadedDays: 14 }),
  });
  assert.equal(replay.loadedDays, 14);
  assert.equal(replay.replayed, true);
  // With no count reported, the route's own generated count is used.
  const noCount = realResponse({
    loadedDays: 7,
    applied: parseApplyResult({ ...APPLY_RESULT_RAW, loadedDays: null }),
  });
  assert.equal(noCount.loadedDays, 7);
});

test('parseApplyResult reads the RPC’s real jsonb (digests as strings, counts possibly as strings)', () => {
  const parsed = parseApplyResult(APPLY_RESULT_RAW);
  assert.equal(parsed.watermarkBeforeDigest, DIGEST_A);
  assert.equal(parsed.watermarkAfterDigest, DIGEST_B);
  assert.equal(parsed.loadedDays, 14);
  assert.equal(parsed.gutRowsWritten, 14);
  assert.equal(parsed.wearableRowsWritten, 14);
  assert.equal(parsed.firstDate, '2026-07-11');
  assert.equal(parsed.lastDate, '2026-07-24');
  // jsonb numerics can arrive as strings through PostgREST; a non-digest string must not.
  assert.equal(parseApplyResult({ ...APPLY_RESULT_RAW, loadedDays: '21' }).loadedDays, 21);
  assert.equal(parseApplyResult({ ...APPLY_RESULT_RAW, watermarkAfter: 'not-a-digest' }).watermarkAfterDigest, null);
  assert.equal(parseApplyResult({ ...APPLY_RESULT_RAW, firstDate: 'nonsense' }).firstDate, null);
});

test('a uuid can never arrive in the response through targetLabel, however the RPC misbehaves', () => {
  // The label is accepted only in the registry’s own `demo:<name>` shape, so a
  // function that returned a uuid (or a sentence containing one) under this key
  // contributes null rather than a leak.
  for (const hostile of [TARGET, `demo:${TARGET}`, `user ${TARGET}`, 'DEMO:U3', 'demo:', 42, null, {}]) {
    const parsed = parseApplyResult({ ...APPLY_RESULT_RAW, targetLabel: hostile });
    assert.equal(parsed.targetLabel, null, `${JSON.stringify(hostile)} must not become a label`);
    assert.deepEqual(uuidsIn(realResponse({ applied: parsed })), []);
  }
  assert.equal(parseApplyResult(APPLY_RESULT_RAW).targetLabel, 'demo:u3');
});

test('parseApplyResult: an unusable or hostile RPC document degrades safely instead of relaying', () => {
  for (const junk of [null, undefined, 'string', 42, [], {}]) {
    const parsed = parseApplyResult(junk);
    assert.equal(parsed.replayed, false, 'replayed must never be assumed');
    assert.equal(parsed.targetLabel, null);
    assert.equal(parsed.watermarkAfterDigest, null);
  }
  // A whole extra document is NOT copied through: only named fields cross.
  const parsed = parseApplyResult({ ...APPLY_RESULT_RAW, leakedUserId: TARGET, secret: 'sk-live-nope' });
  assert.deepEqual(Object.keys(parsed).sort(), [
    'firstDate',
    'gutRowsWritten',
    'lastDate',
    'loadedDays',
    'replayed',
    'targetLabel',
    'watermarkAfterDigest',
    'watermarkBeforeDigest',
    'wearableRowsWritten',
  ]);
  assert.deepEqual(uuidsIn(realResponse({ applied: parsed })), []);
  assert.equal(JSON.stringify(realResponse({ applied: parsed })).includes('sk-live-nope'), false);
});

test('parsePlanInputs: reads the gated wrapper’s document — the watermark plus a non-identifying label', () => {
  const doc = {
    gutCount: 14,
    gutMin: '2026-07-11',
    gutMax: '2026-07-24',
    wearCount: 14,
    wearMin: '2026-07-11',
    wearMax: '2026-07-24',
    digest: DIGEST_A,
    targetLabel: 'demo:u3',
  };
  const parsed = parsePlanInputs(doc);
  assert.deepEqual(parsed?.watermark, WATERMARK);
  assert.equal(parsed?.targetLabel, 'demo:u3');
  // A label that is not the registry shape (a uuid, say) contributes null, so the
  // plan-inputs read cannot become the leak the apply result is guarded against.
  assert.equal(parsePlanInputs({ ...doc, targetLabel: TARGET })?.targetLabel, null);
  assert.equal(parsePlanInputs({ ...doc, digest: '' }), null, 'no digest ⇒ unusable');
  assert.equal(parsePlanInputs(null), null);
});

test('parseWatermark: refuses a document with no digest (an unusable watermark must not look usable)', () => {
  assert.equal(parseWatermark(null), null);
  assert.equal(parseWatermark({}), null);
  assert.equal(parseWatermark({ digest: '' }), null);
  assert.equal(parseWatermark({ digest: 42 }), null);
  assert.equal(parseWatermark([WATERMARK]), null);
  const parsed = parseWatermark({ digest: DIGEST_A, gutCount: '14', gutMin: 'nonsense', wearMax: '2026-07-24' });
  assert.equal(parsed?.gutCount, 14, 'a numeric-string count from jsonb is accepted');
  assert.equal(parsed?.gutMin, null, 'a non-ISO date is dropped rather than propagated');
  assert.equal(parsed?.wearMax, '2026-07-24');
});

test('a REPLAYED apply reports itself, so an idempotent retry is visible rather than merely harmless', () => {
  const body = realResponse({ applied: parseApplyResult({ ...APPLY_RESULT_RAW, replayed: true }) });
  assert.equal(body.replayed, true);
  assert.deepEqual(uuidsIn(body), []);
});

// ───────────────────────────────────────────────────────────────────────────────
// 8. No service-role comparison, no secret out, no hosted endpoint
// ───────────────────────────────────────────────────────────────────────────────

test('no U3 file references the service-role key or compares a service-role credential', () => {
  for (const file of U3_FILES) {
    const source = code(file);
    const rel = path.relative(REPO_ROOT, file);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/, `${rel}: must not reference the service-role key`);
    assert.doesNotMatch(source, /service_role/, `${rel}: must not name the service_role in request logic`);
    // No equality comparison against ANY secret-shaped value: a credential check in
    // request logic belongs in the constant-time verifier
    // (supabase/functions/_shared/internal_auth.ts), never in a nao route.
    assert.doesNotMatch(
      source,
      /(?:SECRET|secret|KEY|token)[A-Za-z_]*\s*(?:===|!==|==|!=)/,
      `${rel}: must not compare a credential with an equality operator`,
    );
  }
});

test('the loader route holds no credential at all, and the relay never returns or logs one', () => {
  const loader = code(LOADER_ROUTE);
  // The loader route needs no secret: it writes through the caller's own cookie-bound
  // client and one definer RPC.
  for (const forbidden of [/OUROBION_INTERNAL_SECRET/, /internalSecret/, /anonKey/, /apikey/]) {
    assert.doesNotMatch(loader, forbidden, `the loader route must not hold ${String(forbidden)}`);
  }
  const relay = code(RELAY_ROUTE);
  // The relay does hold the internal secret — as an OUTBOUND header, never in a
  // response body and never in a log line.
  assert.match(relay, /\[INTERNAL_SECRET_HEADER\]: internalSecret/, 'the secret is an outbound header');
  for (const m of relay.matchAll(/(?:respond|json)\(([\s\S]{0,200}?)\)\s*[,;]/g)) {
    for (const forbidden of ['internalSecret', 'anonKey']) {
      assert.equal(
        m[1].includes(forbidden),
        false,
        `a response body must never carry ${forbidden}: ${m[1].slice(0, 80)}`,
      );
    }
  }
  for (const m of relay.matchAll(/console\.[a-z]+\(([\s\S]{0,200}?)\);/g)) {
    for (const forbidden of ['internalSecret', 'anonKey', 'SECRET']) {
      assert.equal(m[1].includes(forbidden), false, `a log line must never carry ${forbidden}`);
    }
  }
  // The malformed-secret branch describes the requirement without echoing the value.
  assert.doesNotMatch(relay, /\$\{internalSecret\}/, 'the secret must never be interpolated into a string');
});

test('no U3 file accepts a hosted endpoint: the upstream URL comes from server env ONLY', () => {
  for (const file of U3_FILES) {
    const source = code(file);
    const rel = path.relative(REPO_ROOT, file);
    // No hosted host literal, and no absolute URL literal at all, in executable code.
    assert.doesNotMatch(source, /\.supabase\.co/, `${rel}: no hosted Supabase host literal`);
    assert.doesNotMatch(source, /\.workers\.dev/, `${rel}: no hosted Worker host literal`);
    assert.doesNotMatch(source, /https?:\/\//, `${rel}: no absolute URL literal in executable code`);
    // Nothing from the REQUEST may influence the outbound URL.
    assert.doesNotMatch(source, /body\.(?:url|host|endpoint|origin_url)/, `${rel}: no body-derived endpoint`);
    assert.doesNotMatch(source, /new URL\(\s*(?:body|parsed)/, `${rel}: no URL built from the request body`);
  }
  const relay = code(RELAY_ROUTE);
  // The one place a URL is formed: from process.env, then used verbatim.
  assert.match(relay, /process\.env\.SUPABASE_URL \?\? process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  const fetchTargets = [...relay.matchAll(/fetch\(\s*`([^`]*)`/g)].map((m) => m[1]);
  assert.deepEqual(fetchTargets, ['${url}/functions/v1/run-pipeline'], 'exactly one, env-derived, fetch target');
});

test('the pure libs stay pure: no IO, no clock, no framework import (so node --test proves them by execution)', () => {
  for (const file of [LOADER_RUNS_LIB, SIMULATED_HEALTH_LIB]) {
    const source = code(file);
    const rel = path.relative(REPO_ROOT, file);
    for (const forbidden of [/from 'next/, /from '@\//, /createServerSupabaseClient/, /process\.env/, /Date\.now\(\)/]) {
      assert.doesNotMatch(source, forbidden, `${rel}: ${String(forbidden)} would break direct importability/purity`);
    }
  }
  // loaderRuns.ts's single crypto dependency is Web Crypto, which exists in BOTH
  // runtimes this code runs in (Node >= 26 and the Cloudflare Worker). `node:crypto`
  // does not exist in the Worker, so it must not appear.
  const runs = code(LOADER_RUNS_LIB);
  assert.doesNotMatch(runs, /node:crypto/);
  assert.match(runs, /globalThis\.crypto\.subtle\.digest\('SHA-256'/);
});

// ───────────────────────────────────────────────────────────────────────────────
// 9. Downstream structural guarantee (fact 6) — the hold edge is unservable
// ───────────────────────────────────────────────────────────────────────────────

test('generate-insights still excludes non-serving edges at the QUERY level, so a hold edge cannot reach a card', () => {
  // Not an application branch: a `serving_band = 'hold'` row never enters the in-memory
  // edge array, so it structurally cannot be cited by any card even if the composer
  // downstream has a bug. This is the mechanism the acceptance run's hold-edge
  // assertion leans on, so a regression here must fail a test rather than a demo.
  const gi = readFileSync(
    path.join(REPO_ROOT, 'supabase', 'functions', 'generate-insights', 'index.ts'),
    'utf8',
  );
  assert.match(gi, /\.in\("serving_band", \["high", "mid"\]\)/, 'the serving-band filter must stay a query filter');
});

test(
  "R4-U3 requirement 8 (no duplicate gaps): generate-insights calls record_gap_events_keyed, " +
    "keyed on this run's fetched INPUTS, never on its emitted gap events",
  () => {
    // The gap fixed by this unit: record_gap_events is additive (demand = demand + 1 per
    // event), so a retried pipeline used to double-count gap_ledger.demand. The migration's
    // record_gap_events_keyed (supabase/migrations/20260729010003_gap_demand_identity.sql)
    // applies each (demand_key, pair, scope, status) at most once; this pins the CALL SITE so
    // a regression back to the unkeyed RPC — or a key derived from the emitted events instead
    // of the run's inputs — fails a test, not a demo replay.
    const gi = code(
      path.join(REPO_ROOT, 'supabase', 'functions', 'generate-insights', 'index.ts'),
    );
    assert.match(
      gi,
      /supabase\.rpc\("record_gap_events_keyed",/,
      'must call the keyed RPC',
    );
    assert.doesNotMatch(
      gi,
      /supabase\.rpc\("record_gap_events",/,
      'the unkeyed RPC must never be called again',
    );
    // Keyed on the fetched INPUT surfaces (rules/baselines/personal/edges/series), never on
    // gapByAggKey/gapEvents (the emitted events) — keying on outputs would dedupe a run over
    // genuinely new data that happened to produce an identical event set (migration comment,
    // gap_demand_applications.demand_key).
    assert.match(
      gi,
      /computeDemandKey\(day, ruleRows, baselines, personalRows, edges, seriesRows\)/,
      'the demand key must be derived from this run\'s fetched inputs',
    );
    assert.doesNotMatch(
      gi,
      /computeDemandKey\([^)]*gapEvents/,
      'the demand key must never be derived from the emitted events',
    );
  },
);

test('validateLoaderBody + validateLoaderTarget are the boundary: the route adds no third validation path', () => {
  const source = code(LOADER_ROUTE);
  assert.match(source, /validateLoaderBody\(body\)/);
  assert.match(source, /validateLoaderTarget\(body\.target, gate\.userId\)/);
  // The route must not re-derive validation inline (a second validator drifts).
  assert.doesNotMatch(source, /LOADER_TARGET_RE/, 'the route must not re-implement the target shape check');
  assert.equal(validateLoaderBody({ target: TARGET }), null);
  assert.equal(validateLoaderTarget(TARGET, CALLER), null);
});
