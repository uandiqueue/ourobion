#!/usr/bin/env node
// Executable regression harness for scripts/seed-test-data.sql.
// Owns one uniquely named disposable postgres:17 container and removes it in finally.

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTAINER = `ourobion-seed-regression-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const SEP = String.fromCharCode(31);
let checks = 0;
let exitCode = 1;

function docker(args, { allowFail = false, inherit = false } = {}) {
  const result = spawnSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail) {
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed (${result.status})\n${result.stdout}${result.stderr}`);
  }
  return result;
}

function psqlFile(path, vars = {}, { allowFail = false } = {}) {
  const args = [
    'exec', '-u', 'postgres', CONTAINER,
    'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', 'postgres', '-d', 'postgres',
  ];
  for (const [key, value] of Object.entries(vars)) args.push('-v', `${key}=${value}`);
  args.push('-f', path);
  return docker(args, { allowFail });
}

function psql(sql) {
  return docker([
    'exec', '-u', 'postgres', CONTAINER,
    'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', 'postgres', '-d', 'postgres', '-c', sql,
  ]);
}

function query(sql) {
  return docker([
    'exec', '-u', 'postgres', CONTAINER,
    'psql', '-At', '-F', SEP, '-U', 'postgres', '-d', 'postgres', '-c', sql,
  ]).stdout.replace(/\r/g, '').trim();
}

function check(label, actual, expected) {
  checks += 1;
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  process.stdout.write(`ok ${checks} - ${label}\n`);
}

function waitForPostgres() {
  for (let i = 0; i < 120; i += 1) {
    const ready = docker(
      ['exec', '-u', 'postgres', CONTAINER, 'pg_isready', '-U', 'postgres'],
      { allowFail: true },
    );
    if (ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error('disposable postgres did not become ready');
}

const seedVars = (email, extra = {}) => ({
  email,
  days: 3,
  base_dqs: 78,
  region: 'SG',
  include_wearable: 1,
  with_antibiotics: 0,
  wipe_first: 0,
  ...extra,
});

function seed(email, extra = {}, opts = {}) {
  return psqlFile('/harness/scripts/seed-test-data.sql', seedVars(email, extra), opts);
}

function replayDigest(userId) {
  return query(`
    select md5(
      coalesce((select string_agg((to_jsonb(g) - 'id' - 'created_at' - 'updated_at')::text,
                                  '|' order by g.log_date)
                  from public.daily_gut_rows g where g.user_id = '${userId}'), '')
      || '#'
      || coalesce((select string_agg((to_jsonb(w) - 'synced_at')::text,
                                     '|' order by w.date)
                     from public.wearable_daily w where w.user_id = '${userId}'), '')
    )`);
}

function userDigest(userId) {
  return query(`select md5(jsonb_build_object(
    'gut', coalesce((select jsonb_agg(to_jsonb(g) order by g.log_date, g.id)
                       from public.daily_gut_rows g where g.user_id = '${userId}'), '[]'::jsonb),
    'wearable', coalesce((select jsonb_agg(to_jsonb(w) order by w.date)
                            from public.wearable_daily w where w.user_id = '${userId}'), '[]'::jsonb),
    'antibiotics', coalesce((select jsonb_agg(to_jsonb(a) order by a.start_date, a.id)
                              from public.antibiotic_courses a where a.user_id = '${userId}'), '[]'::jsonb),
    'engagement', coalesce((select jsonb_agg(to_jsonb(e) order by e.user_id)
                              from public.engagement_state e where e.user_id = '${userId}'), '[]'::jsonb),
    'baselines', coalesce((select jsonb_agg(to_jsonb(b) order by b.metric_key, b.id)
                             from public.baseline_snapshots b where b.user_id = '${userId}'), '[]'::jsonb),
    'insights', coalesce((select jsonb_agg(to_jsonb(i) order by i.rule_id, i.id)
                            from public.insight_cards i where i.user_id = '${userId}'), '[]'::jsonb)
  )::text)`);
}

function expectPreflightRefusal(email, userId, expectedReason) {
  psql('alter sequence seed_probe.write_attempts restart with 1;');
  const result = seed(email, {}, { allowFail: true });
  check(`${expectedReason} conflict is refused`, String(result.status === 0), 'false');
  check(
    `${expectedReason} refusal is classified`,
    String(`${result.stdout}${result.stderr}`.includes(`has ${expectedReason} provenance`)),
    'true',
  );
  check(
    `${expectedReason} preflight runs before every write attempt`,
    query('select is_called::text from seed_probe.write_attempts'),
    'false',
  );
  check(
    `${expectedReason} refusal leaves no script marker`,
    query(`select (count(*) filter (where data_origin = 'seed:local-test-data'))::text
             from public.daily_gut_rows where user_id = '${userId}'`),
    '0',
  );
  check(
    `${expectedReason} refusal leaves no derived engagement row`,
    query(`select count(*)::text from public.engagement_state where user_id = '${userId}'`),
    '0',
  );
}

function expectWipeMarkerRefusal(email, userId, label) {
  const before = userDigest(userId);
  psql('alter sequence seed_probe.write_attempts restart with 1;');
  const result = seed(email, { wipe_first: 1 }, { allowFail: true });
  check(`${label} marker blocks destructive wipe`, String(result.status === 0), 'false');
  check(
    `${label} marker refusal is classified`,
    String(`${result.stdout}${result.stderr}`.includes('Local seed provenance is unavailable or revoked')),
    'true',
  );
  check(
    `${label} marker refusal precedes every wipe write attempt`,
    query('select is_called::text from seed_probe.write_attempts'),
    'false',
  );
  check(`${label} marker refusal preserves every target row`, userDigest(userId), before);
}

try {
  const runnerSource = readFileSync(resolve(ROOT, 'scripts', 'seed-test-data.ps1'), 'utf8');
  const sqlSource = readFileSync(resolve(ROOT, 'scripts', 'seed-test-data.sql'), 'utf8');
  check(
    'the destructive runner default remains explicitly true',
    String(/\$WipeFirst\s*=\s*\$true/.test(runnerSource)),
    'true',
  );
  check(
    'the standalone SQL destructive default remains 1',
    String(/\\set\s+wipe_first\s+1\b/.test(sqlSource)),
    'true',
  );
  check(
    'the PowerShell runner makes a SQL refusal process-fatal',
    String(/'ON_ERROR_STOP=1'/.test(runnerSource)),
    'true',
  );

  process.stdout.write(`disposable container: ${CONTAINER}\n`);
  docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=postgres',
    '-e', 'POSTGRES_DB=postgres', 'postgres:17']);
  waitForPostgres();

  docker(['cp', 'ci/pg-extension-stubs/.', `${CONTAINER}:/usr/share/postgresql/17/extension/`]);
  docker(['exec', CONTAINER, 'mkdir', '-p', '/harness/scripts']);
  docker(['cp', 'ci', `${CONTAINER}:/harness/ci`]);
  docker(['cp', 'supabase/migrations', `${CONTAINER}:/harness/migrations`]);
  docker(['cp', 'supabase/tests/authz', `${CONTAINER}:/harness/authz`]);
  docker(['cp', 'scripts/seed-test-data.sql', `${CONTAINER}:/harness/scripts/seed-test-data.sql`]);
  docker(['exec', CONTAINER, 'chown', '-R', 'postgres:postgres', '/harness']);

  psqlFile('/harness/ci/migrations-bootstrap.sql');
  psqlFile('/harness/authz/10_supabase_shim.sql');
  const migrations = readdirSync(resolve(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const migration of migrations) psqlFile(`/harness/migrations/${migration}`);

  const users = {
    replay: ['10000000-0000-4000-8000-000000000001', 'seed-replay@harness.invalid'],
    real: ['10000000-0000-4000-8000-000000000002', 'seed-real@harness.invalid'],
    unregistered: ['10000000-0000-4000-8000-000000000003', 'seed-unregistered@harness.invalid'],
    revoked: ['10000000-0000-4000-8000-000000000004', 'seed-revoked@harness.invalid'],
    foreign: ['10000000-0000-4000-8000-000000000005', 'seed-foreign@harness.invalid'],
    registeredReal: ['10000000-0000-4000-8000-000000000006', 'seed-registered-real@harness.invalid'],
    wipeTarget: ['10000000-0000-4000-8000-000000000007', 'seed-wipe-target@harness.invalid'],
    bystander: ['10000000-0000-4000-8000-000000000008', 'seed-bystander@harness.invalid'],
  };
  psql(`insert into auth.users (id, email) values
    ${Object.values(users).map(([id, email]) => `('${id}', '${email}')`).join(',\n    ')};`);

  check(
    'forward migration registers the script-owned non-revoked marker',
    query(`select concat_ws('/', is_simulated, loader_writable, owner, revoked_at is null)
             from public.nao_simulation_origins where origin = 'seed:local-test-data'`),
    't/f/scripts/seed-test-data.sql/t',
  );

  psql(`update public.nao_simulation_origins
          set revoked_at = now()
        where origin = 'seed:local-test-data';`);
  psqlFile('/harness/migrations/20260730010000_register_local_test_data_origin.sql');
  check(
    'forward migration reapply preserves an existing marker revocation',
    query(`select (revoked_at is not null)::text
             from public.nao_simulation_origins where origin = 'seed:local-test-data'`),
    'true',
  );
  psql(`update public.nao_simulation_origins
          set revoked_at = null
        where origin = 'seed:local-test-data';`);
  check(
    'explicit test-only reset restores the marker for later seeder checks',
    query(`select (revoked_at is null)::text
             from public.nao_simulation_origins where origin = 'seed:local-test-data'`),
    'true',
  );

  seed(users.replay[1], { with_antibiotics: 1 });
  check(
    'both truth tables carry the exact local marker and antibiotic seed is singular',
    query(`select
      (select count(*) from public.daily_gut_rows where user_id = '${users.replay[0]}'
        and data_origin = 'seed:local-test-data') || '/' ||
      (select count(*) from public.wearable_daily where user_id = '${users.replay[0]}'
        and source = 'seed:local-test-data') || '/' ||
      (select count(*) from public.antibiotic_courses where user_id = '${users.replay[0]}'
        and drug_name = 'Amoxicillin (seed)')`),
    '3/3/1',
  );
  const firstDigest = replayDigest(users.replay[0]);
  seed(users.replay[1], { with_antibiotics: 1 });
  check('same-marker replay reproduces the same seeded values', replayDigest(users.replay[0]), firstDigest);
  check(
    'optional antibiotic seed is idempotent',
    query(`select count(*)::text from public.antibiotic_courses
            where user_id = '${users.replay[0]}' and drug_name = 'Amoxicillin (seed)'`),
    '1',
  );

  seed(users.wipeTarget[1], { with_antibiotics: 1 });
  psql(`
    insert into public.baseline_snapshots (user_id, metric_key, confidence)
      values ('${users.wipeTarget[0]}', 'seed-regression', 'high');
    insert into public.insight_cards (user_id, rule_id, title, body, category)
      values ('${users.wipeTarget[0]}', 'seed-regression', 'Seed regression',
              'Disposable wipe preservation fixture.', 'descriptive');
  `);
  seed(users.bystander[1], { with_antibiotics: 1 });
  psql(`
    insert into public.baseline_snapshots (user_id, metric_key, confidence)
      values ('${users.bystander[0]}', 'seed-bystander', 'medium');
    insert into public.insight_cards (user_id, rule_id, title, body, category)
      values ('${users.bystander[0]}', 'seed-bystander', 'Bystander fixture',
              'Must remain byte-identical during another user''s wipe.', 'descriptive');
  `);

  psql(`
    insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
      values ('${users.real[0]}', current_date - 2, 'real', null);
    insert into public.wearable_daily (user_id, date, source)
      values ('${users.unregistered[0]}', current_date - 2, 'provider:oura');
    insert into public.nao_simulation_origins
      (origin, label, is_simulated, loader_writable, owner, revoked_at)
      values ('retired:seed-regression', 'retired harness marker', true, false,
              'scripts/tests/seed-test-data-regression.mjs', now());
    insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
      values ('${users.revoked[0]}', current_date - 2, 'retired', 'retired:seed-regression');
    insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
      values ('${users.foreign[0]}', current_date - 2, 'foreign', 'simulated:run4-demo');
    insert into public.nao_simulation_origins
      (origin, label, is_simulated, loader_writable, owner)
      values ('registeredreal:seed-regression', 'registered real harness marker', false, false,
              'scripts/tests/seed-test-data-regression.mjs');
    insert into public.wearable_daily (user_id, date, source)
      values ('${users.registeredReal[0]}', current_date - 2, 'registeredreal:seed-regression');

    create schema seed_probe;
    create sequence seed_probe.write_attempts;
    create function seed_probe.bump() returns trigger language plpgsql as $$
    begin
      perform nextval('seed_probe.write_attempts');
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end $$;
    create trigger seed_probe_gut before insert or update or delete on public.daily_gut_rows
      for each row execute function seed_probe.bump();
    create trigger seed_probe_wear before insert or update or delete on public.wearable_daily
      for each row execute function seed_probe.bump();
    create trigger seed_probe_abx before insert or update or delete on public.antibiotic_courses
      for each row execute function seed_probe.bump();
    create trigger seed_probe_engagement before insert or update or delete on public.engagement_state
      for each row execute function seed_probe.bump();
    create trigger seed_probe_baseline before insert or update or delete on public.baseline_snapshots
      for each row execute function seed_probe.bump();
    create trigger seed_probe_insight before insert or update or delete on public.insight_cards
      for each row execute function seed_probe.bump();
  `);

  psql(`delete from public.nao_simulation_origins where origin = 'seed:local-test-data';`);
  expectWipeMarkerRefusal(users.wipeTarget[1], users.wipeTarget[0], 'missing');
  psqlFile('/harness/migrations/20260730010000_register_local_test_data_origin.sql');
  psql(`update public.nao_simulation_origins
          set revoked_at = now()
        where origin = 'seed:local-test-data';`);
  psqlFile('/harness/migrations/20260730010000_register_local_test_data_origin.sql');
  check(
    'revocation remains set before destructive refusal is exercised',
    query(`select (revoked_at is not null)::text
             from public.nao_simulation_origins where origin = 'seed:local-test-data'`),
    'true',
  );
  expectWipeMarkerRefusal(users.wipeTarget[1], users.wipeTarget[0], 'revoked');
  psql(`update public.nao_simulation_origins
          set revoked_at = null
        where origin = 'seed:local-test-data';`);
  check(
    'explicit test-only reset makes the marker effective after refusal checks',
    query(`select (revoked_at is null)::text
             from public.nao_simulation_origins where origin = 'seed:local-test-data'`),
    'true',
  );

  const wipeTargetBefore = userDigest(users.wipeTarget[0]);
  const bystanderBefore = userDigest(users.bystander[0]);
  seed(users.wipeTarget[1], { days: 2, with_antibiotics: 0, wipe_first: 1 });
  check(
    'valid destructive wipe changes the selected target user',
    String(userDigest(users.wipeTarget[0]) !== wipeTargetBefore),
    'true',
  );
  check(
    'valid destructive wipe leaves the bystander user byte-identical',
    userDigest(users.bystander[0]),
    bystanderBefore,
  );

  expectPreflightRefusal(users.real[1], users.real[0], 'real-or-null');
  expectPreflightRefusal(users.unregistered[1], users.unregistered[0], 'unregistered');
  expectPreflightRefusal(users.revoked[1], users.revoked[0], 'revoked');
  expectPreflightRefusal(users.foreign[1], users.foreign[0], 'foreign');
  expectPreflightRefusal(users.registeredReal[1], users.registeredReal[0], 'registered-real');

  check('the complete executable regression matrix ran', String(checks + 1), '47');

  process.stdout.write(`PASS - ${checks} executable seeder regression checks\n`);
  exitCode = 0;
} catch (error) {
  process.stderr.write(`FAIL - ${error.message}\n`);
  exitCode = 1;
} finally {
  const removed = docker(['rm', '-f', '-v', CONTAINER], { allowFail: true });
  process.stdout.write(
    removed.status === 0
      ? `disposable container removed: ${CONTAINER}\n`
      : `WARNING: could not remove ${CONTAINER}: ${removed.stderr}\n`,
  );
}

process.exit(exitCode);
