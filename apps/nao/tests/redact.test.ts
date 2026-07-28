// ourobion nao — redaction unit tests (node:test, zero I/O, zero mocking).
//
// redactDeep()/suppressSmallCohort() are implemented in ../src/lib/authz.ts
// (pure, no imports at all) and re-exported unchanged from
// ../src/lib/authzServer.ts to satisfy the R4-U2 interface contract's
// server-module surface (`export function redactDeep<T>(value: T): T`).
// Importing authz.ts directly here means these tests exercise the REAL
// implementation with no mock of any kind — see authzServer.ts's header for
// why authzServer.ts itself is not imported directly by node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DENY_KEYS,
  REDACTED,
  SMALL_COHORT_MIN,
  UUID_RE,
  canonicalDenyKey,
  isDenyKey,
  redactDeep,
  redactRelayBody,
  redactText,
  sanitizeStorageText,
  sanitizeStorageValue,
  suppressSmallCohort,
} from '../src/lib/authz.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(__dirname, '..');

const SAMPLE_UUID = 'a3bb189e-8bf9-4b6b-8062-9b7d7c8b0d8f';

// ── UUID_RE ──────────────────────────────────────────────────────────────────
test('UUID_RE: matches a canonical uuid, case-insensitively, anchored', () => {
  assert.equal(UUID_RE.test(SAMPLE_UUID), true);
  assert.equal(UUID_RE.test(SAMPLE_UUID.toUpperCase()), true);
  assert.equal(UUID_RE.test(`prefix-${SAMPLE_UUID}`), false); // anchored: no partial match
  assert.equal(UUID_RE.test(`${SAMPLE_UUID}-suffix`), false);
  assert.equal(UUID_RE.test('not-a-uuid'), false);
});

// ── redactDeep(): key-based denial ──────────────────────────────────────────
test('redactDeep(): drops every DENY_KEYS key at the top level', () => {
  const input: Record<string, unknown> = { ok: true, other: 'kept' };
  for (const key of DENY_KEYS) {
    input[key] = 'should not survive';
  }
  const out = redactDeep(input) as Record<string, unknown>;
  for (const key of DENY_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(out, key), false, `expected "${key}" to be dropped`);
  }
  assert.equal(out.ok, true);
  assert.equal(out.other, 'kept');
});

test('redactDeep(): deny-key matching is case-insensitive', () => {
  const out = redactDeep({ Created_By: 'x', UPDATED_BY: 'y', USER_ID: 'z', keep: 1 }) as Record<
    string,
    unknown
  >;
  assert.deepEqual(out, { keep: 1 });
});

// ── Deny-key matching is SEPARATOR-insensitive too (R4-U2 review finding 1a) ──
//
// The leaking keys in this repo are camelCase (`userId` from generate-insights,
// `updatedBy` from the ingest-control document), and `'userId'.toLowerCase()` is
// `'userid'`, which does NOT equal `'user_id'`. A lowercased set-membership test
// therefore matched NONE of the keys that actually leak, which is why wiring
// redactDeep() into the relay would not have been sufficient on its own.
/** snake_case -> camelCase, e.g. `actor_user_id` -> `actorUserId`. */
function toCamel(key: string): string {
  return key.replace(/[_-](\w)/g, (_m, c: string) => (c as string).toUpperCase());
}
/** snake_case -> kebab-case. */
function toKebab(key: string): string {
  return key.replace(/_/g, '-');
}

test('isDenyKey(): EVERY DENY_KEYS entry matches in camelCase, UPPER_SNAKE, kebab-case and Title Case', () => {
  let checked = 0;
  for (const key of DENY_KEYS) {
    const variants = [
      key,
      toCamel(key),
      key.toUpperCase(),
      toCamel(key).toUpperCase(),
      toKebab(key),
      toKebab(key).toUpperCase(),
      key.replace(/_/g, ' '),
      key.replace(/_/g, ''),
    ];
    for (const variant of variants) {
      assert.equal(isDenyKey(variant), true, `"${variant}" (variant of "${key}") must be denied`);
      checked += 1;
    }
  }
  assert.equal(checked, DENY_KEYS.length * 8);
  // The named regressions, spelled out so a reader sees them without decoding the loop.
  for (const key of ['userId', 'user_id', 'USER_ID', 'user-id', 'updatedBy', 'createdBy', 'actorUserId']) {
    assert.equal(isDenyKey(key), true, `"${key}" must be denied`);
  }
});

test('isDenyKey(): the fold is a FULL-TOKEN match, not a substring match', () => {
  // These must all survive — a separator-insensitive fold must not turn the
  // denylist into a substring blacklist that eats legitimate payload fields.
  for (const key of ['metricKeys', 'metric_keys', 'userIds', 'keyspace', 'monkey', 'tokenizer', 'emails']) {
    assert.equal(isDenyKey(key), false, `"${key}" must NOT be denied`);
  }
  assert.equal(canonicalDenyKey('user_id'), 'userid');
  assert.equal(canonicalDenyKey('userId'), 'userid');
  assert.equal(canonicalDenyKey('USER-ID'), 'userid');
});

test('redactDeep(): drops camelCase identity keys (the shapes the edge functions actually emit)', () => {
  const out = redactDeep({
    userId: SAMPLE_UUID,
    updatedBy: 'staff@example.invalid',
    createdBy: SAMPLE_UUID,
    actorUserId: SAMPLE_UUID,
    ruleId: 'R42',
  }) as Record<string, unknown>;
  assert.deepEqual(out, { ruleId: 'R42' });
});

// ── Value-shape redaction: unanchored uuid scan + email (R4-U2 findings 3 & 4) ──
test('redactText(): scrubs a uuid EMBEDDED IN A SENTENCE, keeping the surrounding words', () => {
  const reason = `O16 orientation violation dropped: ${SAMPLE_UUID}:R42 (band amber)`;
  const out = redactText(reason);
  assert.equal(out.includes(SAMPLE_UUID), false, 'the uuid must not survive');
  assert.equal(out, `O16 orientation violation dropped: ${REDACTED}:R42 (band amber)`);
});

test('redactText(): scrubs a uuid out of a Postgres violation message', () => {
  const pgMessage =
    `duplicate key value violates unique constraint "daily_gut_rows_pkey"\n` +
    `DETAIL: Key (user_id, log_date)=(${SAMPLE_UUID}, 2026-07-28) already exists.`;
  const out = redactText(pgMessage);
  assert.equal(out.includes(SAMPLE_UUID), false);
  assert.equal(out.includes('already exists'), true, 'the operator-useful text is kept');
});

test('redactText(): scrubs an email address', () => {
  assert.equal(redactText('changed by staff.member+tag@example.invalid'), `changed by ${REDACTED}`);
  assert.equal(redactText('no identity here'), 'no identity here');
});

test('redactDeep(): applies the unanchored scan to string values at any depth', () => {
  const out = redactDeep({
    stages: [{ summary: { note: `dropped ${SAMPLE_UUID} at render` } }],
  }) as { stages: { summary: { note: string } }[] };
  assert.equal(out.stages[0].summary.note.includes(SAMPLE_UUID), false);
});

test('redactDeep(): drops identity/secret keys at ANY depth, nested objects and arrays', () => {
  const input = {
    ok: true,
    override: { node: 'seeder', updated_by: SAMPLE_UUID, per_day_usd_cap: 1.5 },
    seeds: [
      { id: 1, slug: 'a', created_by: SAMPLE_UUID },
      { id: 2, slug: 'b', created_by: SAMPLE_UUID },
    ],
    nested: { a: { b: { c: { authorization: 'Bearer xyz', keep: 'yes' } } } },
  };
  const out = redactDeep(input) as typeof input;
  assert.equal((out.override as Record<string, unknown>).updated_by, undefined);
  assert.equal((out.override as Record<string, unknown>).node, 'seeder');
  for (const seed of out.seeds as Record<string, unknown>[]) {
    assert.equal(seed.created_by, undefined);
  }
  const deepest = (
    ((out.nested as Record<string, unknown>).a as Record<string, unknown>).b as Record<string, unknown>
  ).c as Record<string, unknown>;
  assert.equal(deepest.authorization, undefined);
  assert.equal(deepest.keep, 'yes');
});

// ── redactDeep(): value-based denial (uuid-shaped VALUE, any key) ──────────
test('redactDeep(): redacts a uuid-shaped VALUE regardless of its key name', () => {
  const out = redactDeep({
    actorHint: SAMPLE_UUID, // an unanticipated key name carrying an identity value
    label: 'not a uuid, kept',
  }) as Record<string, unknown>;
  assert.equal(out.actorHint, REDACTED);
  assert.equal(out.label, 'not a uuid, kept');
});

// ═══════════════════════════════════════════════════════════════════════════
// The REAL relay payload (R4-U2 review finding 1)
//
// The test that used to sit here asserted against an INVENTED shape
// (`perUser: [{ user_id }]`, commented "a hypothetical future stage shape").
// That is why the live leak passed review: the present-day shape that actually
// carries identity is `cards.droppedAtRender[].userId` and
// `brainScopeSkips[].userId` — camelCase, nested two levels inside
// run-pipeline's stage envelope — and nothing asserted on it.
//
// Everything below is built from the code, not from imagination:
//   * supabase/functions/generate-insights/index.ts:487-488 — the array shapes
//       renderDrops:     { userId, ruleId, reason }[]
//       brainScopeSkips: { userId, ruleId, pair }[]
//   * supabase/functions/generate-insights/index.ts:1017-1035 — the response body
//       { ok, day, users, rules, firedPatterns, insights,
//         cards: { upserted, byProducer, droppedAtRender, dismissedSkipped, snoozedSkipped },
//         gapLedger, brainScopeSkips }
//   * supabase/functions/run-pipeline/index.ts:121-128,143-146 — the envelope
//       { ok: true, stages: [{ stage, status, ok, summary }] }  (summary = the body above, verbatim)
// ═══════════════════════════════════════════════════════════════════════════

const OTHER_UUIDS = [
  '11111111-2222-3333-4444-555555555555',
  '22222222-3333-4444-5555-666666666666',
  '33333333-4444-5555-6666-777777777777',
  '44444444-5555-6666-7777-888888888888',
  '55555555-6666-7777-8888-999999999999',
];

/** generate-insights' ACTUAL success body shape (index.ts:1017-1035). */
interface InsightsSummary {
  ok: boolean;
  day: string;
  users: number;
  rules: { loaded: number; skippedAtLoad: string[] };
  firedPatterns: number;
  insights: { upserted: number; byBranch: Record<string, number> };
  cards: {
    upserted: number;
    byProducer: Record<string, number>;
    droppedAtRender: Record<string, unknown>[];
    dismissedSkipped: number;
    snoozedSkipped: number;
  };
  gapLedger: { pairsTouched: number; demandByStatus: Record<string, number> };
  brainScopeSkips: Record<string, unknown>[];
}

/** run-pipeline's ACTUAL stage envelope (index.ts:121-128, 143-146). */
interface StageResult {
  stage: string;
  status: number;
  ok: boolean;
  summary: unknown;
}
interface PipelineEnvelope {
  ok: boolean;
  stages: StageResult[];
}

/** The generate-insights stage summary of a relayed envelope, typed for assertions. */
function insightsStage(envelope: unknown): InsightsSummary {
  const stages = (envelope as PipelineEnvelope).stages;
  const stage = stages[stages.length - 1];
  assert.equal(stage.stage, 'generate-insights');
  return stage.summary as InsightsSummary;
}

/** generate-insights' ACTUAL success body, with `n` distinct users in the identity arrays. */
function generateInsightsBody(userIds: readonly string[]): InsightsSummary {
  return {
    ok: true,
    day: '2026-07-28',
    users: userIds.length,
    rules: { loaded: 12, skippedAtLoad: [] as string[] },
    firedPatterns: 3,
    insights: { upserted: 4, byBranch: { agree: 2, 'research-context': 1, idiosyncratic: 1, contradiction: 0 } },
    cards: {
      upserted: 4,
      byProducer: { rules: 2, edge: 1, personal: 1 },
      droppedAtRender: userIds.map((userId) => ({
        userId,
        ruleId: 'O16-orientation',
        // free text that ALSO embeds the id — generate-insights:807-810 builds exactly this
        reason: `O16 orientation violation dropped: ${userId}:O16-orientation`,
      })),
      dismissedSkipped: 0,
      snoozedSkipped: 1,
    },
    gapLedger: { pairsTouched: 2, demandByStatus: { open: 7 } },
    brainScopeSkips: userIds.map((userId) => ({
      userId,
      ruleId: 'C10-coincidence',
      pair: 'gut_comfort|sleep_efficiency',
    })),
  };
}

/** run-pipeline's ACTUAL success envelope with all three stage summaries nested. */
function runPipelineEnvelope(userIds: readonly string[]): PipelineEnvelope {
  return {
    ok: true,
    stages: [
      { stage: 'compute-baselines', status: 200, ok: true, summary: { ok: true, users: userIds.length, snapshots: 40 } },
      { stage: 'evaluate-signals', status: 200, ok: true, summary: { ok: true, day: '2026-07-28', evaluated: 12 } },
      { stage: 'generate-insights', status: 200, ok: true, summary: generateInsightsBody(userIds) },
    ],
  };
}

/** Every uuid anywhere in a serialised payload. The single assertion that matters. */
function uuidsIn(value: unknown): string[] {
  return JSON.stringify(value).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
}

test('the REAL run-pipeline relay payload (cohort of 1) survives with ZERO user uuids and zero userId keys', () => {
  const payload = runPipelineEnvelope([SAMPLE_UUID]);
  // Sanity: the fixture really does leak before redaction — otherwise this test proves nothing.
  assert.deepEqual(uuidsIn(payload).length > 0, true, 'fixture must contain uuids pre-redaction');
  assert.equal(JSON.stringify(payload).includes('"userId"'), true, 'fixture must contain userId keys');

  const out = redactRelayBody(payload);
  const serialised = JSON.stringify(out);
  assert.deepEqual(uuidsIn(out), [], `a user uuid survived the relay redaction: ${serialised}`);
  assert.equal(serialised.includes('"userId"'), false, 'a userId key survived the relay redaction');
  assert.equal(serialised.includes(SAMPLE_UUID), false);

  // The non-identity summary numbers the console renders are untouched.
  assert.equal((out as PipelineEnvelope).stages.length, 3);
  const summary = insightsStage(out);
  assert.equal(summary.ok, true);
  assert.equal(summary.users, 1);
  assert.equal(summary.cards.upserted, 4);
  assert.equal(summary.gapLedger.pairsTouched, 2);
});

test('a cohort of 1 is SUPPRESSED, not merely stripped — the metric pair must not survive either', () => {
  const out = redactRelayBody(runPipelineEnvelope([SAMPLE_UUID]));
  const summary = insightsStage(out);
  // Stripping `userId` alone would leave `{ ruleId, pair }` — a cohort of ONE whose
  // two correlated health metrics are named. k=5 collapses the array instead.
  assert.deepEqual(summary.brainScopeSkips, [{ suppressed: 'small-cohort', rows: 1, cohortBelow: 5 }]);
  assert.deepEqual(summary.cards.droppedAtRender, [
    { suppressed: 'small-cohort', rows: 1, cohortBelow: 5 },
  ]);
  assert.equal(JSON.stringify(out).includes('gut_comfort|sleep_efficiency'), false);
});

test('a cohort at k=5 keeps its rows, and every identity in them is still gone', () => {
  const out = redactRelayBody(runPipelineEnvelope(OTHER_UUIDS));
  const summary = insightsStage(out);
  assert.equal(summary.brainScopeSkips.length, 5, 'at k=5 the rows are retained');
  assert.deepEqual(uuidsIn(out), [], 'no uuid may survive even when the cohort is large enough');
  for (const row of summary.brainScopeSkips) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'userId'), false);
    assert.equal(row.ruleId, 'C10-coincidence');
  }
  // The embedded-uuid free text in droppedAtRender[].reason is scrubbed in place.
  for (const row of summary.cards.droppedAtRender) {
    assert.equal(typeof row.reason, 'string');
    assert.equal((row.reason as string).includes('-'), true, 'the reason text itself is kept');
    assert.match(row.reason as string, /\[redacted\]/);
  }
});

test('redactRelayBody(): a stage FAILURE envelope relaying a Postgres message is scrubbed', () => {
  // run-pipeline/index.ts:135-140 returns { ok:false, failedStage, stages } and the stage
  // summary is the stage's own error body ({error: upsertError.message}).
  const failure = {
    ok: false,
    failedStage: 'generate-insights',
    stages: [
      {
        stage: 'generate-insights',
        status: 500,
        ok: false,
        summary: {
          error:
            `insert into "insights" violates unique constraint — ` +
            `Key (user_id, day)=(${SAMPLE_UUID}, 2026-07-28) already exists.`,
        },
      },
    ],
  };
  const out = redactRelayBody(failure);
  assert.deepEqual(uuidsIn(out), []);
  assert.match(JSON.stringify(out), /already exists/, 'the operator-useful message is kept');
});

test('redactRelayBody(): arrays that carry no identity at all are left alone', () => {
  const payload = { stages: [{ stage: 'a', status: 200, ok: true, summary: { counts: [1, 2, 3] } }] };
  assert.deepEqual(redactRelayBody(payload), payload);
});

// ── The ROUTE's own relay path, extracted from source and EXECUTED ──────────
//
// The helper being correct is not the finding — the finding was that the ROUTE
// never called it. So this test does not re-implement the route: it slices the
// relay block out of api/loader/run-pipeline/route.ts between its
// `relay:begin`/`relay:end` sentinels and runs THAT SOURCE TEXT with `fetch`
// stubbed. Same technique as supabase/functions/_shared/internal_auth.test.ts's
// prelude extraction, and for the same reason (a route file cannot be imported
// under `node --test`: it uses the `@/lib/...` TS-only path alias — see
// authz.test.ts's header).
const RUN_PIPELINE_ROUTE = path.join(
  NAO_ROOT,
  'src',
  'app',
  '(app)',
  'api',
  'loader',
  'run-pipeline',
  'route.ts',
);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

function extractRelayBlock(): string {
  const source = readFileSync(RUN_PIPELINE_ROUTE, 'utf8').replace(/\r\n/g, '\n');
  // The distinctive box-drawn marker, not the bare word: the route's header
  // comment also NAMES these sentinels in prose.
  const begin = source.indexOf('── relay:begin');
  const end = source.indexOf('── relay:end');
  assert.notEqual(begin, -1, 'the route lost its relay:begin sentinel');
  assert.notEqual(end, -1, 'the route lost its relay:end sentinel');
  const body = source.slice(source.indexOf('\n', begin) + 1, source.lastIndexOf('\n', end));
  assert.match(body, /try \{/, 'extracted block does not look like the relay try/catch');
  return body;
}

/** Run the route's real relay block against a stubbed upstream response. */
async function runRelay(upstream: { status: number; ok: boolean; text: string } | Error): Promise<{
  status: number;
  body: unknown;
}> {
  const compiled = new AsyncFunction(
    'fetch',
    'json',
    'redactRelayBody',
    'redactText',
    'url',
    'anonKey',
    'internalSecret',
    'INTERNAL_SECRET_HEADER',
    extractRelayBlock(),
  );
  const captured: { status: number; body: unknown } = { status: 0, body: null };
  const jsonStub = (body: unknown, status = 200) => {
    captured.status = status;
    captured.body = body;
    return { status, body };
  };
  const fetchStub = async () => {
    if (upstream instanceof Error) throw upstream;
    return { status: upstream.status, ok: upstream.ok, text: async () => upstream.text };
  };
  await compiled(
    fetchStub,
    jsonStub,
    redactRelayBody,
    redactText,
    'https://example.invalid',
    'anon-key-not-a-secret',
    'x'.repeat(43),
    'X-Ourobion-Internal-Secret',
  );
  return captured;
}

test("ROUTE relay path: the JSON branch of run-pipeline/route.ts returns ZERO uuids for the real payload", async () => {
  const upstreamBody = JSON.stringify(runPipelineEnvelope([SAMPLE_UUID]));
  assert.equal(upstreamBody.includes(SAMPLE_UUID), true, 'the upstream body must leak pre-relay');

  const { status, body } = await runRelay({ status: 200, ok: true, text: upstreamBody });
  assert.equal(status, 200, 'the relay must preserve the upstream status');
  assert.deepEqual(uuidsIn(body), [], `the ROUTE relayed a user uuid to the browser: ${JSON.stringify(body)}`);
  assert.equal(JSON.stringify(body).includes('"userId"'), false);
});

test('ROUTE relay path: with a cohort of 5 the rows ARE relayed, and every userId key/value is gone', async () => {
  // The cohort-of-1 case above is closed by the suppression pass alone, so it does
  // NOT prove the camelCase key fold is load-bearing. This one does: at k=5 the rows
  // survive suppression, so the ONLY thing that removes `userId` is isDenyKey()'s
  // separator-insensitive fold. Revert that fold and this test fails.
  const upstreamBody = JSON.stringify(runPipelineEnvelope(OTHER_UUIDS));
  const { status, body } = await runRelay({ status: 200, ok: true, text: upstreamBody });
  assert.equal(status, 200);
  const summary = insightsStage(body);
  assert.equal(summary.brainScopeSkips.length, 5, 'the rows must survive at k=5');
  assert.equal(
    JSON.stringify(body).includes('"userId"'),
    false,
    'the ROUTE relayed a camelCase userId key to the browser',
  );
  assert.deepEqual(uuidsIn(body), [], 'the ROUTE relayed a user uuid to the browser');
});

test('ROUTE relay path: the non-JSON `raw` branch scrubs an embedded uuid', async () => {
  const { status, body } = await runRelay({
    status: 200,
    ok: true,
    text: `<html>internal error for user ${SAMPLE_UUID}</html>`,
  });
  assert.equal(status, 502, 'a non-JSON 200 is relayed as 502, unchanged behaviour');
  assert.deepEqual(uuidsIn(body), []);
  assert.match(JSON.stringify(body), /internal error for user/);
});

test('ROUTE relay path: the catch branch scrubs err.message', async () => {
  const { status, body } = await runRelay(
    new Error(`fetch failed: Key (user_id, log_date)=(${SAMPLE_UUID}, 2026-07-28)`),
  );
  assert.equal(status, 502);
  assert.deepEqual(uuidsIn(body), []);
  assert.match(JSON.stringify(body), /fetch failed/);
});

// -- sanitizeStorageText/sanitizeStorageValue (R4-U2 re-review finding N1) --
//
// redactDeep()/redactText() remove IDENTITY; they say nothing about whether a
// string is safe to STORE. These strip whatever Postgres text/jsonb cannot
// hold (NUL foremost -- the byte that let `paused`/`seed` suppress an audit
// row) and any lone UTF-16 surrogate, at any depth, including object keys.
const NUL = String.fromCharCode(0);
const LONE_HIGH_SURROGATE = String.fromCharCode(0xd800);
const LONE_LOW_SURROGATE = String.fromCharCode(0xdc00);
const DEL_CHAR = String.fromCharCode(0x7f);
const OTHER_CONTROL_CHAR = String.fromCharCode(0x01);

test('sanitizeStorageText(): strips a NUL byte', () => {
  assert.equal(sanitizeStorageText(`paused${NUL}value`), 'pausedvalue');
  assert.equal(sanitizeStorageText(NUL), '');
});

test('sanitizeStorageText(): strips other C0 control characters but keeps tab/newline/CR', () => {
  assert.equal(sanitizeStorageText(`a${OTHER_CONTROL_CHAR}b`), 'ab');
  assert.equal(sanitizeStorageText('a\tb\nc\rd'), 'a\tb\nc\rd', 'tab/newline/CR are JSON-safe and kept');
});

test('sanitizeStorageText(): strips DEL (0x7f)', () => {
  assert.equal(sanitizeStorageText(`a${DEL_CHAR}b`), 'ab');
});

test('sanitizeStorageText(): strips a LONE surrogate but keeps a valid surrogate PAIR', () => {
  assert.equal(sanitizeStorageText(`a${LONE_HIGH_SURROGATE}b`), 'ab', 'a lone high surrogate is dropped');
  assert.equal(sanitizeStorageText(`a${LONE_LOW_SURROGATE}b`), 'ab', 'a lone low surrogate is dropped');
  const emoji = String.fromCharCode(0xd83d, 0xde00); // U+1F600 GRINNING FACE -- a real surrogate PAIR
  assert.equal(sanitizeStorageText(`x${emoji}y`), `x${emoji}y`, 'a valid pair must survive intact');
});

test('sanitizeStorageText(): passes an already-clean string through unchanged (fast path)', () => {
  assert.equal(sanitizeStorageText('run2-demo'), 'run2-demo');
  assert.equal(sanitizeStorageText(''), '');
});

test('sanitizeStorageValue(): sanitises nested strings, ARRAY elements, and OBJECT KEYS at any depth', () => {
  const input = {
    [`clean${NUL}key`]: `value with ${NUL} nul`,
    list: [`a${NUL}b`, { deeper: `c${NUL}d` }],
    nested: { a: { b: { c: `e${NUL}f` } } },
    number: 42,
    bool: true,
    nil: null,
  };
  const out = sanitizeStorageValue(input) as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(out, `clean${NUL}key`), false, 'a NUL in a KEY must not survive');
  assert.equal(out.cleankey, 'value with  nul');
  assert.deepEqual(out.list, ['ab', { deeper: 'cd' }]);
  assert.equal((out.nested as any).a.b.c, 'ef');
  assert.equal(out.number, 42);
  assert.equal(out.bool, true);
  assert.equal(out.nil, null);
});

test('sanitizeStorageValue(): does not mutate the input', () => {
  const input = { key: `a${NUL}b` };
  const copy = { ...input };
  sanitizeStorageValue(input);
  assert.deepEqual(input, copy);
});

test('regression: redaction still applies when composed with sanitisation (sanitising must not bypass redactDeep)', () => {
  const input = {
    secret: `sk-should-be-redacted${NUL}`,
    user_id: SAMPLE_UUID,
    reason: `dropped ${SAMPLE_UUID}${NUL} at render`,
    keep: 'plain value',
  };
  const out = sanitizeStorageValue(redactDeep(input)) as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'secret'), false, 'secret-shaped key still stripped');
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'user_id'), false, 'uuid-shaped key still stripped');
  assert.equal((out.reason as string).includes(SAMPLE_UUID), false, 'uuid-shaped VALUE still redacted');
  assert.equal((out.reason as string).includes(NUL), false, 'NUL still stripped after redaction');
  assert.equal(out.keep, 'plain value');
});

// ── recordControlEvent's insert payload, extracted from source and EXECUTED ──
//
// The extracted block now spans the WHOLE try body (minus the initial
// `createServerSupabaseClient()` call, whose result is already supplied as
// the `supabase` parameter) AND the entire catch block — see
// authzServer.ts's control-event:begin/end comment for why. That trailing,
// unclosed `} catch (err) { ... }` is reconstructed into valid code by
// wrapping the extracted text in the harness's OWN `try {`, which is exactly
// how the real function is shaped (this is asserted below, not assumed).
function compileRecordControlEventBlock(): (...args: unknown[]) => Promise<unknown> {
  const source = readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
  const begin = source.indexOf('── control-event:begin');
  const end = source.indexOf('── control-event:end');
  assert.notEqual(begin, -1, 'authzServer lost its control-event:begin sentinel');
  assert.notEqual(end, -1, 'authzServer lost its control-event:end sentinel');
  const block = source.slice(source.indexOf('\n', begin) + 1, source.lastIndexOf('\n', end));
  assert.match(block, /nao_control_events/, 'extracted block does not look like the audit insert');
  assert.match(block, /^\s*}\s*catch\s*\(err\)\s*{/m, 'the block must still end with the dangling catch clause');

  return new AsyncFunction(
    'supabase',
    'action',
    'target',
    'detail',
    'redactText',
    'redactDeep',
    'sanitizeStorageValue',
    `try {\n${block}`,
  ) as (...args: unknown[]) => Promise<unknown>;
}

function makeSupabaseStub(outcome: { error: { message: string } | null }): {
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };
  inserted: Record<string, unknown> | null;
} {
  const stub = {
    inserted: null as Record<string, unknown> | null,
    from(table: string) {
      assert.equal(table, 'nao_control_events');
      return {
        insert: async (row: Record<string, unknown>) => {
          stub.inserted = row;
          return { error: outcome.error };
        },
      };
    },
  };
  return stub;
}

test('nao_control_events.detail: a secret-shaped and a uuid-shaped value are stripped before insert', async () => {
  const compiled = compileRecordControlEventBlock();
  const supabaseStub = makeSupabaseStub({ error: null });
  await compiled(
    supabaseStub,
    'claims.reject',
    SAMPLE_UUID, // a caller passing an identity as `target`
    {
      reason: `rejected on behalf of ${SAMPLE_UUID}`,
      secret: 'sk-should-never-be-logged',
      authorization: 'Bearer should-never-be-logged',
      user_id: SAMPLE_UUID,
      userId: SAMPLE_UUID,
      enabled: true,
    },
    redactText,
    redactDeep,
    sanitizeStorageValue,
  );

  const inserted = supabaseStub.inserted;
  assert.notEqual(inserted, null, 'the extracted block did not perform an insert');
  const row = inserted as unknown as Record<string, unknown>;
  const detail = row.detail as Record<string, unknown>;
  assert.equal(row.action, 'claims.reject');
  assert.equal(row.target, REDACTED, 'a uuid-shaped target must be redacted');
  for (const key of ['secret', 'authorization', 'user_id', 'userId']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(detail, key),
      false,
      `detail.${key} must not reach nao_control_events`,
    );
  }
  assert.equal((detail.reason as string).includes(SAMPLE_UUID), false, 'a uuid inside free text must go');
  assert.equal(detail.enabled, true, 'non-identity detail is kept');
  assert.equal(JSON.stringify(row).includes('should-never-be-logged'), false);
  assert.deepEqual(uuidsIn(row), []);
});

test('nao_control_events insert: a NUL in target AND nested in detail is sanitised away — the row that reaches the insert is storage-safe', async () => {
  const compiled = compileRecordControlEventBlock();
  const supabaseStub = makeSupabaseStub({ error: null });
  await compiled(
    supabaseStub,
    'loader.simulate',
    `run4-demo${NUL}`, // e.g. a `seed` value carrying an embedded NUL
    { seed: `run4-demo${NUL}`, days: 14, nested: { note: `x${NUL}y` } },
    redactText,
    redactDeep,
    sanitizeStorageValue,
  );

  const row = supabaseStub.inserted as unknown as Record<string, unknown>;
  assert.notEqual(row, null, 'the insert must still happen — this is the whole point of the fix');
  assert.equal(row.target, 'run4-demo', 'the NUL is stripped, not merely tolerated');
  const detail = row.detail as Record<string, unknown>;
  assert.equal(detail.seed, 'run4-demo');
  assert.equal((detail.nested as { note: string }).note, 'xy');
  assert.equal(JSON.stringify(row).includes(NUL), false, 'no NUL survives into the row that would be inserted');
});

test('nao_control_events insert: a failed insert is swallowed but the log names the action and the target', async () => {
  const compiled = compileRecordControlEventBlock();
  const supabaseStub = makeSupabaseStub({ error: { message: `duplicate key (user_id)=(${SAMPLE_UUID})` } });
  const originalError = console.error;
  const calls: string[] = [];
  console.error = (msg?: unknown) => {
    calls.push(String(msg));
  };
  try {
    await compiled(
      supabaseStub,
      'ingest_control.patch',
      'ingest-control',
      { paused: true },
      redactText,
      redactDeep,
      sanitizeStorageValue,
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(calls.length, 1, 'exactly one console.error for the failed insert');
  assert.match(calls[0], /ingest_control\.patch/, 'the swallowed-failure log must name the action');
  assert.match(calls[0], /ingest-control/, 'the swallowed-failure log must name the target');
  assert.equal(calls[0].includes(SAMPLE_UUID), false, 'the underlying Postgres message must still be redacted');
  assert.match(calls[0], /already exists|duplicate key/, 'the error text itself is still logged');
});

test('nao_control_events insert: a THROWN error (not just a returned error) is also swallowed with action+target logged', async () => {
  const compiled = compileRecordControlEventBlock();
  const supabaseStub = {
    from: () => {
      throw new Error(`connection lost for user ${SAMPLE_UUID}`);
    },
  };
  const originalError = console.error;
  const calls: string[] = [];
  console.error = (msg?: unknown) => {
    calls.push(String(msg));
  };
  try {
    await compiled(
      supabaseStub,
      'seeds.toggle',
      'seed-42',
      { enabled: false },
      redactText,
      redactDeep,
      sanitizeStorageValue,
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(calls.length, 1, 'exactly one console.error for the thrown failure');
  assert.match(calls[0], /seeds\.toggle/, 'the swallowed-throw log must name the action');
  assert.match(calls[0], /seed-42/, 'the swallowed-throw log must name the target');
  assert.equal(calls[0].includes(SAMPLE_UUID), false, 'a thrown error message must still be redacted');
  assert.match(calls[0], /connection lost/, 'the error text itself is still logged');
});

// ── redactDeep(): scalars, arrays, depth ────────────────────────────────────
test('redactDeep(): passes through non-uuid strings, numbers, booleans, null unchanged', () => {
  assert.equal(redactDeep('hello'), 'hello');
  assert.equal(redactDeep(42), 42);
  assert.equal(redactDeep(true), true);
  assert.equal(redactDeep(null), null);
});

test('redactDeep(): walks arrays element-wise, including arrays of arrays', () => {
  const out = redactDeep([[{ created_by: 'x', v: 1 }], [{ v: 2 }]]) as unknown[][];
  assert.deepEqual(out, [[{ v: 1 }], [{ v: 2 }]]);
});

test('redactDeep(): maxDepth bounds recursion instead of throwing', () => {
  // Build a chain deeper than the default max depth.
  let deep: unknown = { bottom: SAMPLE_UUID };
  for (let i = 0; i < 30; i += 1) {
    deep = { nested: deep };
  }
  assert.doesNotThrow(() => redactDeep(deep));
  const shallow = redactDeep(deep, 2) as Record<string, unknown>;
  // At depth 2 we should hit the REDACTED sentinel rather than the original object.
  assert.equal(JSON.stringify(shallow).includes(REDACTED), true);
});

test('redactDeep(): does not mutate the input', () => {
  const input = { created_by: 'x', keep: 1 };
  const copy = { ...input };
  redactDeep(input);
  assert.deepEqual(input, copy);
});

// ── suppressSmallCohort() ────────────────────────────────────────────────────
test('SMALL_COHORT_MIN is 5', () => {
  assert.equal(SMALL_COHORT_MIN, 5);
});

test('suppressSmallCohort(): drops rows below k, keeps rows at/above k (default k=5)', () => {
  const rows = [{ demand: 1 }, { demand: 4 }, { demand: 5 }, { demand: 6 }, { demand: 0 }];
  const out = suppressSmallCohort(rows);
  assert.deepEqual(
    out.map((r) => r.demand),
    [5, 6],
  );
});

test('suppressSmallCohort(): honors an explicit k (4 and 6)', () => {
  const rows = [{ demand: 3 }, { demand: 4 }, { demand: 5 }, { demand: 6 }];
  assert.deepEqual(
    suppressSmallCohort(rows, 4).map((r) => r.demand),
    [4, 5, 6],
  );
  assert.deepEqual(
    suppressSmallCohort(rows, 6).map((r) => r.demand),
    [6],
  );
});

test('suppressSmallCohort(): empty input → empty output', () => {
  assert.deepEqual(suppressSmallCohort([]), []);
});
