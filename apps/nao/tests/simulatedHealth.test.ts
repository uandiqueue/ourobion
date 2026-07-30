/**
 * Fixture-only tests for the simulated health-data generator + loader planning
 * (`src/lib/simulatedHealth.ts`). No live Supabase — everything under test is pure
 * (the /api/loader route handlers are IO glue over these functions, nao's
 * ingestControl convention). Run: node --test (Node >=26).
 *
 * Asserts:
 *  - determinism: identical options → identical rows; a different seed diverges;
 *  - correlated-shift shape: 'recent-dip' days sit clearly below baseline days for
 *    the driven metrics, and gut_comfort/mood co-move over a long steady stretch;
 *  - CHECK-constraint safety: every generated value stays inside the daily_gut_rows
 *    migration's CHECK ranges across a long horizon;
 *  - provenance: EVERY row (both tables) carries SIMULATED_DATA_ORIGIN;
 *  - day-continuation math: first load ends today; increments fill forward to today
 *    first, then backfill history; never a day after today;
 *  - request validation: days/seed/scenario bounds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DIP_DAYS,
  LOADER_REQUEST_KEY_RE,
  LOADER_TARGET_RE,
  LOCAL_TEST_DATA_ORIGIN,
  MAX_LOAD_DAYS,
  SIMULATED_DATA_ORIGIN,
  SIMULATED_DATA_ORIGIN_RUN4,
  SIMULATION_ORIGIN_REGISTRY,
  SIMULATION_ORIGIN_RE,
  addDaysIso,
  diffDaysIso,
  generateSimulatedDays,
  isLoaderWritableOrigin,
  isRegisteredSimulatedOrigin,
  planLoadRange,
  validateLoaderBody,
  validateLoaderTarget,
} from '../src/lib/simulatedHealth.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MIGRATIONS_DIR = path.join(
  REPO_ROOT,
  'supabase',
  'migrations',
);
const PROVENANCE_MIGRATION = '20260729010000_nao_simulation_provenance.sql';

const TODAY = '2026-07-24';

/**
 * R4-U3: `target` is a REQUIRED body field, so every body a test expects to be
 * ACCEPTED now carries one. Synthetic, generated as a literal here — never a real
 * identifier (R4-U2 invariant 5: no real credential or identity in any fixture).
 */
const TARGET = '11111111-2222-4333-8444-555555555555';
const CALLER = '99999999-8888-4777-8666-555555555555';
const REQUEST_KEY = ['u3', 'acceptance', 'key', '0001'].join('-');

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

test('generateSimulatedDays: deterministic — same options, same rows; different seed diverges', () => {
  const opts = { startDate: '2026-07-01', days: 21, seed: 'abc', anchorDate: TODAY } as const;
  const a = generateSimulatedDays(opts);
  const b = generateSimulatedDays(opts);
  assert.deepEqual(a, b, 'same inputs must yield byte-identical rows (idempotent re-loads)');

  const c = generateSimulatedDays({ ...opts, seed: 'xyz' });
  assert.notDeepEqual(a, c, 'a different seed must yield a different dataset');
});

test('generateSimulatedDays: overlapping batches agree day-by-day (continuation stitches cleanly)', () => {
  const whole = generateSimulatedDays({ startDate: '2026-07-04', days: 21, seed: 's', anchorDate: TODAY });
  const tail = generateSimulatedDays({ startDate: '2026-07-11', days: 14, seed: 's', anchorDate: TODAY });
  assert.deepEqual(whole.slice(7), tail, 'each day depends only on (seed, scenario, anchor, date)');
});

test("correlated shift: 'recent-dip' days sit clearly below baseline for the driven metrics", () => {
  const days = generateSimulatedDays({ startDate: '2026-06-27', days: 28, seed: 'dip', anchorDate: TODAY });
  const dipStart = addDaysIso(TODAY, -(DIP_DAYS - 1));
  const dip = days.filter((d) => d.date >= dipStart);
  const base = days.filter((d) => d.date < dipStart);
  assert.equal(dip.length, DIP_DAYS);

  const by = (rows: typeof days, pick: (d: (typeof days)[number]) => number) => mean(rows.map(pick));
  assert.ok(
    by(base, (d) => d.gut.gut_comfort_score) - by(dip, (d) => d.gut.gut_comfort_score) >= 1,
    'gut_comfort drops ≥1 point in the dip',
  );
  assert.ok(
    by(base, (d) => d.gut.mood_score) - by(dip, (d) => d.gut.mood_score) >= 1,
    'mood drops ≥1 point in the dip',
  );
  assert.ok(
    by(base, (d) => d.wearable.sleep_duration_min) - by(dip, (d) => d.wearable.sleep_duration_min) >= 50,
    'sleep drops ≥50 min in the dip',
  );
  assert.ok(
    by(base, (d) => d.wearable.hrv_sdnn_ms) - by(dip, (d) => d.wearable.hrv_sdnn_ms) >= 8,
    'HRV drops ≥8 ms in the dip',
  );
});

test("'steady' scenario has no dip: recent days match the overall level", () => {
  const days = generateSimulatedDays({
    startDate: '2026-06-27',
    days: 28,
    seed: 'flat',
    scenario: 'steady',
    anchorDate: TODAY,
  });
  const dipStart = addDaysIso(TODAY, -(DIP_DAYS - 1));
  const recent = mean(days.filter((d) => d.date >= dipStart).map((d) => d.gut.gut_comfort_score));
  const overall = mean(days.map((d) => d.gut.gut_comfort_score));
  assert.ok(Math.abs(recent - overall) < 1, 'no systematic recent shift under steady');
});

test('correlation backbone: gut_comfort and mood co-move over a long steady stretch', () => {
  const days = generateSimulatedDays({
    startDate: '2026-01-01',
    days: 120,
    seed: 'corr',
    scenario: 'steady',
    anchorDate: TODAY,
  });
  const rho = pearson(
    days.map((d) => d.gut.gut_comfort_score),
    days.map((d) => d.gut.mood_score),
  );
  assert.ok(rho > 0.3, `expected shared-latent correlation > 0.3, got ${rho.toFixed(3)}`);
});

test('CHECK-constraint safety: every value in range across 120 days (incl. dip days)', () => {
  const days = generateSimulatedDays({ startDate: '2026-03-27', days: 120, seed: 'rng', anchorDate: '2026-07-24' });
  for (const d of days) {
    const g = d.gut;
    assert.ok(g.urine_colour >= 1 && g.urine_colour <= 8, `urine_colour ${g.urine_colour}`);
    assert.ok(g.stool_form >= 1 && g.stool_form <= 7, `stool_form ${g.stool_form}`);
    assert.ok(g.stool_count >= 0 && g.stool_count <= 10, `stool_count ${g.stool_count}`);
    assert.ok(g.outside_meals >= 0 && g.outside_meals <= 3, `outside_meals ${g.outside_meals}`);
    assert.ok(g.mosquito_bites >= 0 && g.mosquito_bites <= 20, `mosquito_bites ${g.mosquito_bites}`);
    for (const score of [g.energy_score, g.mood_score, g.gut_comfort_score]) {
      assert.ok(score >= 1 && score <= 5, `score ${score}`);
      assert.ok(Number.isInteger(score), 'ordinal scores are integers');
    }
    assert.ok(g.log_completeness >= 0 && g.log_completeness <= 100, `dqs ${g.log_completeness}`);
    assert.ok(g.notes.length <= 140, 'notes within the CHECK length');
    assert.ok(d.wearable.sleep_duration_min > 0 && Number.isInteger(d.wearable.sleep_duration_min));
    assert.ok(Number.isInteger(d.wearable.step_count));
  }
});

test('provenance: EVERY generated row is flagged simulated on both tables', () => {
  // R4-U3: the DEFAULT stamp is now the atomic loader's own origin
  // (SIMULATED_DATA_ORIGIN_RUN4). The assertion is unchanged in force — every row on
  // both tables must carry a registered simulated marker — and strengthened: it also
  // pins WHICH marker, so a silent change of default is a failing test.
  const days = generateSimulatedDays({ startDate: '2026-07-01', days: 30, seed: 'prov', anchorDate: TODAY });
  for (const d of days) {
    assert.equal(d.gut.data_origin, SIMULATED_DATA_ORIGIN_RUN4, `gut row ${d.date}`);
    assert.equal(d.wearable.source, SIMULATED_DATA_ORIGIN_RUN4, `wearable row ${d.date}`);
    assert.equal(isRegisteredSimulatedOrigin(d.gut.data_origin), true, `gut origin registered ${d.date}`);
    assert.equal(isRegisteredSimulatedOrigin(d.wearable.source), true, `wearable origin registered ${d.date}`);
  }
});

test('provenance: the run-2 origin is still emittable byte-for-byte (nothing already stored is orphaned)', () => {
  // SIMULATED_DATA_ORIGIN is what every row loaded before R4-U3 carries. It stays
  // exported, stays REGISTERED (so the loader recognises such a row as simulated and
  // may overwrite it), and stays emittable via the explicit option — which is what
  // "remain compatible with the value already in the column" means mechanically.
  assert.equal(SIMULATED_DATA_ORIGIN, 'simulated:run2-demo');
  assert.equal(SIMULATED_DATA_ORIGIN_RUN4, 'simulated:run4-demo');
  const days = generateSimulatedDays({
    startDate: '2026-07-01',
    days: 5,
    seed: 'prov',
    anchorDate: TODAY,
    origin: SIMULATED_DATA_ORIGIN,
  });
  for (const d of days) {
    assert.equal(d.gut.data_origin, SIMULATED_DATA_ORIGIN, `gut row ${d.date}`);
    assert.equal(d.wearable.source, SIMULATED_DATA_ORIGIN, `wearable row ${d.date}`);
  }
  // The origin option changes ONLY provenance — the numbers stay byte-identical, so a
  // re-stamp can never be confused with a re-generation.
  const withDefault = generateSimulatedDays({
    startDate: '2026-07-01',
    days: 5,
    seed: 'prov',
    anchorDate: TODAY,
  });
  assert.deepEqual(
    days.map((d) => ({ ...d, gut: { ...d.gut, data_origin: '' }, wearable: { ...d.wearable, source: '' } })),
    withDefault.map((d) => ({ ...d, gut: { ...d.gut, data_origin: '' }, wearable: { ...d.wearable, source: '' } })),
    'the origin option must not perturb the generated values',
  );
});

/**
 * The migration's seed rows, READ FROM THE MIGRATION.
 *
 * The previous version of the drift test hard-coded three marker names and never opened
 * the .sql at all, while the migration seeded FOUR rows — so it could not detect the very
 * drift it was named for (independent review finding F11). Parsing the file is the whole
 * point: a marker added, removed, or flipped on either side now fails here.
 */
interface SeededOrigin {
  origin: string;
  label: string;
  isSimulated: boolean;
  loaderWritable: boolean;
  owner: string;
}

function migrationSeededOrigins(): SeededOrigin[] {
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && name >= PROVENANCE_MIGRATION)
    .sort();
  const byOrigin = new Map<string, SeededOrigin>();
  let statements = 0;

  for (const migration of migrations) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, migration), 'utf8');
    let cursor = 0;
    while (true) {
      const start = sql.indexOf('insert into public.nao_simulation_origins', cursor);
      if (start === -1) break;
      const end = sql.indexOf('on conflict', start);
      assert.ok(end > start, `${migration}: registry seed statement must end in an on-conflict clause`);
      statements += 1;
      // `--` prose inside a VALUES list must not be mistaken for a row.
      const block = sql.slice(start, end).replace(/--.*$/gm, '');
      // The column list carries no quoted literals, so it cannot match this tuple shape.
      for (const m of block.matchAll(
        /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*'([^']+)'\s*\)/g,
      )) {
        byOrigin.set(m[1], {
          origin: m[1],
          label: m[2],
          isSimulated: m[3] === 'true',
          loaderWritable: m[4] === 'true',
          owner: m[5],
        });
      }
      cursor = end + 'on conflict'.length;
    }
  }
  const rows = [...byOrigin.values()];
  // A floor, never an equality: the parser must not be able to pass by finding nothing,
  // and the number can only ever grow.
  assert.ok(statements >= 2, `parsed only ${statements} registry seed statement(s)`);
  assert.ok(rows.length >= 5, `parsed only ${rows.length} seed row(s) — the parser has drifted`);
  return rows;
}

test('origin registry: the TS mirror is EXACTLY the forward migrations’ effective seed rows', () => {
  const seeded = migrationSeededOrigins();
  const mirrored: SeededOrigin[] = SIMULATION_ORIGIN_REGISTRY.map((entry) => ({
    origin: entry.origin,
    label: entry.label,
    isSimulated: entry.isSimulated,
    loaderWritable: entry.loaderWritable,
    owner: entry.owner,
  }));
  const byOrigin = (a: SeededOrigin, b: SeededOrigin): number => a.origin.localeCompare(b.origin);
  assert.deepEqual(
    [...mirrored].sort(byOrigin),
    [...seeded].sort(byOrigin),
    'every field of every registered origin must agree between SQL and TypeScript',
  );
});

test('origin registry: is_simulated and loader_writable answer DIFFERENT questions, and a typo fails closed', () => {
  for (const entry of SIMULATION_ORIGIN_REGISTRY) {
    assert.match(entry.origin, SIMULATION_ORIGIN_RE, `${entry.origin} must satisfy the registry CHECK regex`);
    // "may a row bearing this be overwritten" vs "may THIS loader author it".
    assert.equal(isRegisteredSimulatedOrigin(entry.origin), entry.isSimulated, `${entry.origin} overwritable`);
    assert.equal(
      isLoaderWritableOrigin(entry.origin),
      entry.isSimulated && entry.loaderWritable,
      `${entry.origin} loader-writable`,
    );
    // Loader-writable is strictly narrower: it can never widen the overwrite answer.
    if (isLoaderWritableOrigin(entry.origin)) {
      assert.equal(isRegisteredSimulatedOrigin(entry.origin), true, `${entry.origin}`);
    }
  }
  // The concrete case the review found: R4-U2's fixture marker is REGISTERED and
  // SIMULATED (a row bearing it may be overwritten) but must never be STAMPED by this
  // loader — it belongs to another harness.
  assert.equal(isRegisteredSimulatedOrigin('seed:baseline'), true);
  assert.equal(isLoaderWritableOrigin('seed:baseline'), false, 'seed:baseline belongs to 30_pre_u2_seed.sql');
  assert.equal(isRegisteredSimulatedOrigin(LOCAL_TEST_DATA_ORIGIN), true);
  assert.equal(
    isLoaderWritableOrigin(LOCAL_TEST_DATA_ORIGIN),
    false,
    'the local SQL seeder owns its marker; the Nao loader must not stamp it',
  );
  // The release marker is recognised so the run ledger can reference it, and is neither.
  assert.equal(isRegisteredSimulatedOrigin('release:run4-demo'), false);
  assert.equal(isLoaderWritableOrigin('release:run4-demo'), false);

  // Unregistered ⇒ treated as real data ⇒ never written, never overwritten. This is
  // the property the open text column never had.
  for (const unregistered of [
    'simulated:run4-demoo', // a typo
    'provider:oura', // a real provider marker
    'probe:pa', // R4-U2's authz fixture — deliberately NOT registered, therefore protected
    'probe:pb',
    'wearable',
    '',
    'nocolon',
  ]) {
    assert.equal(isRegisteredSimulatedOrigin(unregistered), false, `"${unregistered}" must not be registered`);
    assert.equal(isLoaderWritableOrigin(unregistered), false, `"${unregistered}" must not be writable`);
  }
  for (const junk of [null, undefined]) {
    assert.equal(isRegisteredSimulatedOrigin(junk), false);
    assert.equal(isLoaderWritableOrigin(junk), false);
  }
});

test('planLoadRange: first load is one batch of N days ENDING today', () => {
  const plan = planLoadRange(null, 14, TODAY);
  assert.deepEqual(plan, {
    segments: [{ startDate: '2026-07-11', days: 14 }],
    forwardDays: 14,
    backfillDays: 0,
  });
  const last = addDaysIso(plan.segments[0].startDate, plan.segments[0].days - 1);
  assert.equal(last, TODAY, 'the first load must reach today (the engine evaluates today)');
});

test('planLoadRange: fills forward from maxDate+1, clamped at today', () => {
  const plan = planLoadRange({ minDate: '2026-07-01', maxDate: '2026-07-19' }, 5, TODAY);
  assert.deepEqual(plan.segments, [{ startDate: '2026-07-20', days: 5 }]);
  assert.equal(plan.forwardDays, 5);
  assert.equal(plan.backfillDays, 0);
});

test('planLoadRange: overflow past today becomes history backfill (forward first, then prepend)', () => {
  const plan = planLoadRange({ minDate: '2026-07-11', maxDate: '2026-07-22' }, 7, TODAY);
  assert.equal(plan.forwardDays, 2, 'only 2 days of forward headroom to today');
  assert.equal(plan.backfillDays, 5);
  assert.deepEqual(plan.segments, [
    { startDate: '2026-07-23', days: 2 },
    { startDate: '2026-07-06', days: 5 },
  ]);
});

test('planLoadRange: range already at today → pure backfill, never a day after today', () => {
  const plan = planLoadRange({ minDate: '2026-07-11', maxDate: TODAY }, 7, TODAY);
  assert.equal(plan.forwardDays, 0);
  assert.equal(plan.backfillDays, 7);
  assert.deepEqual(plan.segments, [{ startDate: '2026-07-04', days: 7 }]);
  const end = addDaysIso(plan.segments[0].startDate, plan.segments[0].days - 1);
  assert.equal(end, '2026-07-10', 'backfill ends where the existing range began');
});

test('diffDaysIso / addDaysIso round-trip', () => {
  assert.equal(diffDaysIso('2026-07-01', '2026-07-24'), 23);
  assert.equal(addDaysIso('2026-07-01', 23), '2026-07-24');
  assert.equal(addDaysIso('2026-07-01', -1), '2026-06-30');
});

test('validateLoaderBody: accepts a minimal and a full valid body (target is now REQUIRED)', () => {
  // R4-U3: an empty body is no longer valid — `target` is required, because the
  // retired self-write path ("write to whoever is signed in") is exactly what O26
  // forbids. Every days/seed/scenario acceptance these three lines asserted before is
  // asserted here unchanged, with the required field supplied.
  assert.equal(validateLoaderBody({ target: TARGET }), null);
  assert.equal(
    validateLoaderBody({ target: TARGET, days: 14, seed: 'run2-demo', scenario: 'recent-dip' }),
    null,
  );
  assert.equal(validateLoaderBody({ target: TARGET, days: MAX_LOAD_DAYS, scenario: 'steady' }), null);
  assert.equal(
    validateLoaderBody({
      target: TARGET,
      days: 14,
      seed: 'run4-demo',
      scenario: 'steady',
      origin: SIMULATED_DATA_ORIGIN_RUN4,
      requestKey: REQUEST_KEY,
    }),
    null,
  );
});

test('validateLoaderBody: a body WITHOUT target is rejected (the self-write path is retired)', () => {
  assert.match(validateLoaderBody({}) ?? '', /target is required/);
  assert.match(validateLoaderBody({ days: 14 }) ?? '', /target is required/);
  assert.match(validateLoaderBody({ target: null }) ?? '', /target is required/);
});

test('validateLoaderBody: rejects a target that is not a uuid', () => {
  for (const badTarget of [
    'not-a-uuid',
    '11111111-2222-4333-8444-55555555555', // one hex digit short
    '11111111-2222-4333-8444-5555555555555', // one too many
    '11111111222243338444555555555555', // unhyphenated
    `${TARGET} `,
    ` ${TARGET}`,
    `${TARGET}${String.fromCharCode(0)}`,
    42,
    true,
    {},
    [TARGET],
  ]) {
    assert.match(
      validateLoaderBody({ target: badTarget }) ?? '',
      /target must be a uuid/,
      `${JSON.stringify(badTarget)} must be rejected`,
    );
  }
  assert.match(LOADER_TARGET_RE.source, /8}-\[0-9a-f\]\{4}/, 'the shape check is the canonical 8-4-4-4-12');
});

test('validateLoaderBody: rejects a requestKey that is too short, too long, or outside the charset', () => {
  assert.equal(validateLoaderBody({ target: TARGET, requestKey: 'x'.repeat(16) }), null);
  assert.equal(validateLoaderBody({ target: TARGET, requestKey: 'x'.repeat(128) }), null);
  for (const badKey of [
    'x'.repeat(15), // a durable key short enough to collide is worse than none
    'x'.repeat(129),
    '',
    'has space aaaaaaaaaa',
    `nul${String.fromCharCode(0)}aaaaaaaaaaaaaa`,
    'semi;colonaaaaaaaaaa',
    'slash/esaaaaaaaaaaaa',
    'emoji\u{1F600}aaaaaaaaaaaa',
    12345678901234567890,
  ]) {
    assert.match(
      validateLoaderBody({ target: TARGET, requestKey: badKey }) ?? '',
      /requestKey/,
      `${JSON.stringify(badKey)} must be rejected`,
    );
  }
  assert.equal(LOADER_REQUEST_KEY_RE.test('nlk1-' + 'a'.repeat(64)), true, 'a derived key must be accepted');
});

test('validateLoaderBody: accepts only a LOADER-WRITABLE origin (fail closed on an unknown or foreign marker)', () => {
  for (const registered of SIMULATION_ORIGIN_REGISTRY) {
    const verdict = validateLoaderBody({ target: TARGET, origin: registered.origin });
    if (registered.isSimulated && registered.loaderWritable) {
      assert.equal(verdict, null, `${registered.origin} must be accepted`);
    } else {
      assert.match(verdict ?? '', /registered simulated origin/, `${registered.origin} must be refused`);
    }
  }
  // The review's F9 case, stated as a test: another harness's marker is registered and
  // simulated, and the route must still refuse to stamp it.
  assert.match(
    validateLoaderBody({ target: TARGET, origin: 'seed:baseline' }) ?? '',
    /registered simulated origin/,
    'seed:baseline is R4-U2’s fixture provenance and must never be caller-selectable here',
  );
  assert.match(
    validateLoaderBody({ target: TARGET, origin: 'release:run4-demo' }) ?? '',
    /registered simulated origin/,
  );
  assert.match(
    validateLoaderBody({ target: TARGET, origin: 'simulated:run4-demoo' }) ?? '',
    /registered simulated origin/,
  );
  assert.match(validateLoaderBody({ target: TARGET, origin: 'provider:oura' }) ?? '', /registered simulated origin/);
  assert.match(validateLoaderBody({ target: TARGET, origin: 'probe:pa' }) ?? '', /registered simulated origin/);
  // Shape first, membership second — a value that cannot even be a registry key gets
  // the shape message.
  assert.match(validateLoaderBody({ target: TARGET, origin: 'nocolon' }) ?? '', /namespace:name/);
  assert.match(validateLoaderBody({ target: TARGET, origin: 'UPPER:case' }) ?? '', /namespace:name/);
  assert.match(validateLoaderBody({ target: TARGET, origin: 7 }) ?? '', /namespace:name/);
});

test('validateLoaderTarget: the target must be DISTINCT from the caller, case-insensitively', () => {
  assert.equal(validateLoaderTarget(TARGET, CALLER), null);
  assert.match(validateLoaderTarget(CALLER, CALLER) ?? '', /not permitted/);
  assert.match(validateLoaderTarget(CALLER.toUpperCase(), CALLER) ?? '', /not permitted/);
  assert.match(validateLoaderTarget(CALLER, CALLER.toUpperCase()) ?? '', /not permitted/);
  // A missing/malformed target is still refused here, so the route cannot reach the
  // RPC with one even if the body validator were bypassed.
  assert.match(validateLoaderTarget(undefined, CALLER) ?? '', /must be a uuid/);
  assert.match(validateLoaderTarget('', CALLER) ?? '', /must be a uuid/);
  assert.match(validateLoaderTarget('not-a-uuid', CALLER) ?? '', /must be a uuid/);
});

test('validateLoaderTarget: the refusal message is the SAME fixed string the RPC uses (no oracle)', () => {
  // The RPC answers every not-permitted-target reason — unregistered, revoked, is
  // itself nao staff, equals the caller — with ONE message and errcode 42501, so the
  // function is not an oracle over the demo roster or over nao_members. The route's
  // own pre-check must not be more informative than that, or it re-opens the oracle
  // at the layer above.
  assert.equal(validateLoaderTarget(CALLER, CALLER), 'loader target not permitted');
});

test('validateLoaderBody: rejects bad days / seed / scenario / shapes', () => {
  assert.match(validateLoaderBody({ days: 0 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: -3 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: 3.5 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: MAX_LOAD_DAYS + 1 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: '14' }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ seed: '' }) ?? '', /seed/);
  assert.match(validateLoaderBody({ seed: 'x'.repeat(65) }) ?? '', /seed/);
  assert.match(validateLoaderBody({ scenario: 'apocalypse' }) ?? '', /scenario/);
  assert.match(validateLoaderBody(null) ?? '', /JSON object/);
  assert.match(validateLoaderBody([1]) ?? '', /JSON object/);
});

// R4-U2 re-review finding N1: `seed` was length-capped but never
// charset-checked, so it flowed straight into recordControlEvent's audit
// `detail` at api/loader/route.ts untouched — a NUL (or any other character
// the database cannot store) inside it could suppress the `loader.simulate`
// audit row while the loader's own write (plain numeric rows, never the seed
// string itself) still succeeded.
test('validateLoaderBody: rejects a NUL, and any character outside the allowed charset, in seed', () => {
  const nul = String.fromCharCode(0);
  assert.match(validateLoaderBody({ seed: `run4-demo${nul}` }) ?? '', /seed/);
  for (const badSeed of ['has space', 'semi;colon', 'quote"mark', "slash/es", 'emoji\u{1F600}', 'newline\n']) {
    assert.match(validateLoaderBody({ seed: badSeed }) ?? '', /seed/, `"${badSeed}" must be rejected`);
  }
});

test('validateLoaderBody: accepts every seed value real callers pass today', () => {
  // DEFAULT_SEED (api/loader/route.ts's fallback), every seed literal used by
  // this file's own fixtures above ('abc', 'xyz', 's', 'dip', 'flat', 'corr',
  // 'rng', 'prov'), and a colon-namespaced value in the style
  // SIMULATED_DATA_ORIGIN already uses ('simulated:run2-demo').
  const realSeeds = [
    'run2-demo', // DEFAULT_SEED
    'abc',
    'xyz',
    's',
    'dip',
    'flat',
    'corr',
    'rng',
    'prov',
    'simulated:run4-demo',
    'a.b_c-D9',
  ];
  for (const seed of realSeeds) {
    assert.equal(validateLoaderBody({ target: TARGET, seed }), null, `"${seed}" must be accepted`);
  }
});
