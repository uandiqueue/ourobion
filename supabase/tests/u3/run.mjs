#!/usr/bin/env node
// supabase/tests/u3/run.mjs — the R4-U3 atomic-loader proof harness runner.
//
// Node stdlib only (node:child_process, node:fs, node:path, node:url). No dependency, no package.
// Run it with the repo toolchain on PATH:  . .\scripts\biotope-env.ps1 ; node supabase/tests/u3/run.mjs
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────────────────────────────────
//   1. Creates a DISPOSABLE postgres:17 container with a unique name, and removes it in a finally
//      block — on success, on assertion failure, and on crash.
//   2. Applies ci/pg-extension-stubs (pg_cron / pg_net), then ci/migrations-bootstrap.sql, then
//      supabase/tests/authz/10_supabase_shim.sql and 20_probe_harness.sql. Both are REUSED BY PATH
//      from the R4-U2 harness rather than copied, so the assertion primitives and the reconstruction
//      of Supabase's default privileges cannot silently diverge between the two suites.
//   3. Applies EVERY file in supabase/migrations/ in plain lexicographic filename order — exactly
//      what the `migrations-apply` CI job does — so this doubles as a local shadow apply: a syntax
//      error, an ordering break, or a missing dependency surfaces here.
//   4. Seeds (10_seed.sql) and runs the assertion suite (20_assertions.sql).
//   5. Runs the CONCURRENCY probe: two parallel psql children racing the same request key against a
//      real transaction-scoped advisory lock (30_concurrency_a.sql / 31_concurrency_b.sql), then
//      the TOCTOU probe: the TARGET's own RLS-governed write racing the loader
//      (32_toctou_b.sql / 33_toctou_a.sql) — the one interleaving the advisory lock cannot cover,
//      where the guarantee has to come from the ON CONFLICT DO UPDATE predicate rather than from
//      the scan that precedes it.
//   6. Runs the TOP-LEVEL ABORT probe: a forced failure on the second truth table where nothing
//      catches the error, so the whole top-level transaction really aborts — the path PostgREST
//      takes. The forcing constraint is added and dropped here and exists ONLY in this disposable
//      container; no migration adds a constraint to either truth table.
//   7. Applies 40_late_assertions.sql, reads every recorded assertion out of authz_probe.result, and
//      decides the exit code against a MIN_ASSERTIONS floor.
//
// ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────────────────────────
//   It never touches the developer's running Supabase stack. The container name is generated per run
//   and refused outright if it could collide with a `supabase_*` container, and the only docker verbs
//   used are run / exec / cp / rm against that one generated name.
//
// ── SELF-TEST (proving the harness can fail) ─────────────────────────────────────────────────────
//   Set U3_FAULT_SQL=<absolute path to a .sql file> to have that file applied immediately after the
//   migrations and before the seed. It is the supported way to inject a deliberate flaw — e.g.
//   stubbing the target gate to allow anything, or removing the provenance scan — and watch the
//   relevant assertions fail. No fault file lives in the repo; the flaw exists only in the scratch
//   file you point at.
//
// ── WHAT THIS HARNESS CANNOT PROVE ───────────────────────────────────────────────────────────────
//   Everything 20_probe_harness.sql:24-35 already disclaims, and it applies here verbatim: no Kong /
//   PostgREST routing, no real HTTP, no proof that 42501 maps to 403 or OU409 to 409, no JWT
//   signature verification, no service_role BYPASSRLS, and the edge functions are not exercised. It
//   is a faithful reconstruction of Supabase's auth helpers and default privileges, not the real
//   supabase/postgres image.
//
// Flags:  --summary  print group totals instead of every assertion name
//         --keep     leave the container running (for debugging; prints its name)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

// The four migrations this unit owns. Their presence is checked so a rename cannot make the suite
// silently pass against a schema that lacks them.
const U3_MIGRATIONS = [
  '20260728030000_nao_simulation_provenance.sql',
  '20260728030001_nao_loader_runs.sql',
  '20260728030002_nao_loader_apply_simulated_days.sql',
  '20260728030003_gap_demand_identity.sql',
];

// A silent pass over zero assertions must be impossible. Deliberately below the suite's real size, so
// it catches "the suite did not run" without breaking on every added case.
const MIN_ASSERTIONS = 120;

// Every assertion group that MUST be represented. A file that fails to load, or a block that is
// accidentally deleted, would otherwise reduce the suite without reducing it below the floor.
const REQUIRED_GROUPS = [
  'u3.objects', 'u3.anon', 'u3.gate', 'u3.gate_msg', 'u3.target', 'u3.deny_msg', 'u3.payload',
  'u3.happy', 'u3.plan', 'u3.conflict', 'u3.rollback', 'u3.replay', 'u3.sparse', 'u3.lease',
  'u3.fold', 'u3.release', 'u3.residue', 'u3.demand', 'u3.nonreg', 'u3.privacy', 'u3.concurrent',
  'u3.toplevel', 'u3.runscope', 'u3.toctou',
];

const ARGS = new Set(process.argv.slice(2));
const SUMMARY_ONLY = ARGS.has('--summary');
const KEEP = ARGS.has('--keep');

const CONTAINER = `ourobion-u3-loader-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
if (/supabase/i.test(CONTAINER)) throw new Error(`refusing to use container name ${CONTAINER}`);

const CURATOR_CLAIMS =
  '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
const TOPLEVEL_TARGET = 'dddddddd-0000-4000-8000-000000000012';
const TOPLEVEL_KEY = 'toplevel-key-0000000001';

function docker(args, { capture = false, allowFail = false } = {}) {
  const r = spawnSync('docker', args, {
    cwd: REPO,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    const detail = capture ? `\n${r.stdout ?? ''}${r.stderr ?? ''}` : '';
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed (exit ${r.status})${detail}`);
  }
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function psqlFile(containerPath) {
  const r = docker(
    ['exec', '-u', 'postgres', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-q',
      '-U', 'postgres', '-d', 'postgres', '-f', containerPath],
    { capture: true, allowFail: true },
  );
  const noise = r.stderr.split('\n').filter((l) => l.trim() && !/NOTICE:/.test(l)).join('\n');
  if (noise) process.stdout.write(`${noise}\n`);
  if (r.status !== 0) throw new Error(`psql -f ${containerPath} failed (exit ${r.status})`);
  return r.stdout;
}

// A psql -c whose FAILURE is the expected outcome. Returns the exit status.
function psqlCommandAllowFail(sql) {
  const r = docker(
    ['exec', '-u', 'postgres', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-q',
      '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { capture: true, allowFail: true },
  );
  return r;
}

function psqlCommand(sql) {
  const r = psqlCommandAllowFail(sql);
  if (r.status !== 0) {
    throw new Error(`psql -c failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
  }
  return r.stdout;
}

const SEP = String.fromCharCode(31); // ASCII unit separator — cannot occur in a recorded value

function psqlQuery(sql) {
  const r = docker(
    ['exec', '-u', 'postgres', CONTAINER, 'psql', '-At', '-F', SEP,
      '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { capture: true },
  );
  return r.stdout.replace(/\r/g, '').trimEnd();
}

// The concurrency probe needs two psql children ALIVE AT THE SAME TIME, which spawnSync cannot do.
function psqlFileAsync(containerPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker',
      ['exec', '-u', 'postgres', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-q',
        '-U', 'postgres', '-d', 'postgres', '-f', containerPath],
      { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', rejectPromise);
    child.on('close', (status) => resolvePromise({ status, stdout: out, stderr: err }));
  });
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForPostgres() {
  for (let i = 0; i < 120; i += 1) {
    const r = docker(['exec', '-u', 'postgres', CONTAINER, 'pg_isready', '-U', 'postgres'],
      { capture: true, allowFail: true });
    if (r.status === 0) return;
    sleepSync(500);
  }
  throw new Error('postgres did not become ready in the disposable container');
}

function step(label) {
  process.stdout.write(`\n── ${label}\n`);
}

let exitCode = 1;
try {
  const dir = resolve(REPO, 'supabase', 'migrations');
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const missing = U3_MIGRATIONS.filter((m) => !migrations.includes(m));
  if (missing.length) throw new Error(`R4-U3 migrations missing: ${missing.join(', ')}`);

  step(`disposable container ${CONTAINER} (postgres:17)`);
  docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=postgres',
    '-e', 'POSTGRES_DB=postgres', 'postgres:17'], { capture: true });
  waitForPostgres();

  step('install pg_cron / pg_net stubs and copy the repo files in');
  docker(['cp', 'ci/pg-extension-stubs/.', `${CONTAINER}:/usr/share/postgresql/17/extension/`],
    { capture: true });
  docker(['exec', CONTAINER, 'mkdir', '-p', '/harness'], { capture: true });
  docker(['cp', 'ci', `${CONTAINER}:/harness/ci`], { capture: true });
  docker(['cp', 'supabase/migrations', `${CONTAINER}:/harness/migrations`], { capture: true });
  docker(['cp', 'supabase/tests/authz', `${CONTAINER}:/harness/authz`], { capture: true });
  docker(['cp', 'supabase/tests/u3', `${CONTAINER}:/harness/u3`], { capture: true });
  docker(['exec', CONTAINER, 'chown', '-R', 'postgres:postgres', '/harness'], { capture: true });

  step('bootstrap supabase-shaped primitives + the R4-U2 shim and assertion primitives');
  psqlFile('/harness/ci/migrations-bootstrap.sql');
  psqlFile('/harness/authz/10_supabase_shim.sql');
  psqlFile('/harness/authz/20_probe_harness.sql');

  step(`apply all ${migrations.length} migrations in plain filename order (the CI apply order)`);
  for (const f of migrations) {
    process.stdout.write(`   ${f}\n`);
    psqlFile(`/harness/migrations/${f}`);
  }

  if (process.env.U3_FAULT_SQL) {
    const fault = resolve(process.env.U3_FAULT_SQL);
    if (!existsSync(fault)) throw new Error(`U3_FAULT_SQL not found: ${fault}`);
    step(`FAULT INJECTION (self-test) — applying ${fault}`);
    docker(['cp', fault, `${CONTAINER}:/harness/fault.sql`], { capture: true });
    docker(['exec', CONTAINER, 'chown', 'postgres:postgres', '/harness/fault.sql'],
      { capture: true });
    psqlFile('/harness/fault.sql');
  }

  step('seed the fixtures and run the assertion suite');
  psqlFile('/harness/u3/10_seed.sql');
  psqlFile('/harness/u3/20_assertions.sql');

  step('concurrency probe — two callers, one request key, one real advisory lock');
  const [a, b] = await Promise.all([
    psqlFileAsync('/harness/u3/30_concurrency_a.sql'),
    psqlFileAsync('/harness/u3/31_concurrency_b.sql'),
  ]);
  for (const [label, r] of [['A', a], ['B', b]]) {
    const noise = r.stderr.split('\n').filter((l) => l.trim() && !/NOTICE:/.test(l)).join('\n');
    process.stdout.write(`   caller ${label}: exit ${r.status}${noise ? `\n${noise}` : ''}\n`);
    if (r.status !== 0) throw new Error(`concurrency caller ${label} failed (exit ${r.status})`);
  }

  step('TOCTOU probe — the TARGET\'s own RLS write racing the loader (the F1 interleaving)');
  // B writes a REAL row and holds it uncommitted; A (1.5 s later) calls the loader over a range
  // containing that date, passes the pre-write scan because B is invisible, and BLOCKS on the
  // unique index; B commits only once it can SEE that block, so the loader is provably past its
  // scan when the real row appears. The write-time guard on the ON CONFLICT DO UPDATE branch is
  // then the only thing that can refuse it. Both children are expected to exit 0: the loader's
  // OU409 is captured inside a plpgsql subtransaction so the assertions can read it.
  const [tb, ta] = await Promise.all([
    psqlFileAsync('/harness/u3/32_toctou_b.sql'),
    psqlFileAsync('/harness/u3/33_toctou_a.sql'),
  ]);
  for (const [label, r] of [['B (the target)', tb], ['A (the loader)', ta]]) {
    const noise = r.stderr.split('\n').filter((l) => l.trim() && !/NOTICE:/.test(l)).join('\n');
    process.stdout.write(`   caller ${label}: exit ${r.status}${noise ? `\n${noise}` : ''}\n`);
    if (r.status !== 0) throw new Error(`toctou caller ${label} failed (exit ${r.status})`);
  }

  step('top-level abort probe — a forced second-table failure with nothing catching it');
  // HARNESS-ONLY, and dropped again below. NOT VALID so the rows already written by earlier sections
  // are not re-validated; the constraint only has to bite on the NEW insert.
  psqlCommand('alter table public.wearable_daily add constraint u3_tmp_force_failure '
    + 'check (spo2_pct is null or spo2_pct < 0) not valid;');

  const applyStatement = `begin;
  set local request.jwt.claims = '${CURATOR_CLAIMS}';
  set local role authenticated;
  select public.nao_loader_apply_simulated_days(
    '${TOPLEVEL_TARGET}'::uuid, '${TOPLEVEL_KEY}', 'simulated:run4-demo',
    '{"scenario":"steady","seed":"harness"}'::jsonb,
    authz_probe.u3_days(date '2026-07-01', 14));
commit;`;

  const faulted = psqlCommandAllowFail(applyStatement);
  process.stdout.write(`   forced-failure call exit ${faulted.status} `
    + `(non-zero is the expected outcome)\n`);
  if (faulted.status === 0) {
    throw new Error('the forced second-table failure did NOT fail — the probe is vacuous');
  }

  // Snapshot the post-abort state BEFORE the retry, because the retry deliberately reuses the key.
  psqlCommand(`insert into authz_probe.u3_capture (key, value)
    select 'toplevel.after_abort', jsonb_build_object(
      'gut',  (select count(*) from public.daily_gut_rows where user_id = '${TOPLEVEL_TARGET}'),
      'wear', (select count(*) from public.wearable_daily where user_id = '${TOPLEVEL_TARGET}'),
      'runs', (select count(*) from public.nao_loader_runs where request_key = '${TOPLEVEL_KEY}'))
    on conflict (key) do update set value = excluded.value;`);

  psqlCommand('alter table public.wearable_daily drop constraint u3_tmp_force_failure;');
  psqlCommand(applyStatement);
  process.stdout.write('   the same request key succeeded once the fault was removed\n');

  step('late assertions');
  psqlFile('/harness/u3/40_late_assertions.sql');

  step('results');
  const rows = psqlQuery(
    'select phase, name, expected, actual, ok from authz_probe.result order by id',
  ).split('\n').filter(Boolean).map((line) => {
    const [phase, name, expected, actual, ok] = line.split(SEP);
    return { phase, name, expected, actual, ok: ok === 't' };
  });

  const groups = new Map();
  for (const r of rows) {
    const key = r.name.split('.').slice(0, 2).join('.');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  for (const [key, list] of groups) {
    const failed = list.filter((r) => !r.ok).length;
    process.stdout.write(
      `\n[${failed ? 'FAIL' : ' ok '}] ${key}  (${list.length} assertion`
      + `${list.length === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''})\n`,
    );
    if (!SUMMARY_ONLY) {
      for (const r of list) {
        process.stdout.write(`         ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}\n`);
      }
    }
  }

  const failures = rows.filter((r) => !r.ok);
  if (failures.length) {
    process.stdout.write(`\n${failures.length} FAILED ASSERTION(S):\n`);
    for (const f of failures) {
      process.stdout.write(
        `  ${f.phase} ${f.name}\n      expected: ${f.expected}\n      actual:   ${f.actual}\n`,
      );
    }
  }

  const wrongPhase = rows.filter((r) => r.phase !== 'u3').length;
  const missingGroups = REQUIRED_GROUPS.filter((g) => !groups.has(g));

  process.stdout.write('\n─────────────────────────────────────────────────────────────\n');
  process.stdout.write(`assertions run     : ${rows.length}\n`);
  process.stdout.write(`assertions passed  : ${rows.length - failures.length}\n`);
  process.stdout.write(`assertions failed  : ${failures.length}\n`);
  process.stdout.write(`minimum required   : ${MIN_ASSERTIONS}\n`);
  process.stdout.write(`groups present     : ${groups.size} `
    + `(${REQUIRED_GROUPS.length} required)\n`);

  const problems = [];
  if (rows.length < MIN_ASSERTIONS) {
    problems.push(`only ${rows.length} assertions ran; the suite requires at least ${MIN_ASSERTIONS}`
      + ' (a silent pass over an empty suite must be impossible)');
  }
  if (wrongPhase) problems.push(`${wrongPhase} assertion(s) recorded outside phase 'u3'`);
  if (missingGroups.length) {
    problems.push(`required assertion group(s) absent: ${missingGroups.join(', ')}`);
  }
  if (failures.length) problems.push(`${failures.length} assertion(s) failed`);

  if (problems.length) {
    process.stdout.write(`\nRESULT: FAIL\n  - ${problems.join('\n  - ')}\n`);
    exitCode = 1;
  } else {
    process.stdout.write('\nRESULT: PASS — every assertion held.\n');
    exitCode = 0;
  }
} catch (err) {
  process.stdout.write(`\nRESULT: ERROR — ${err.message}\n`);
  exitCode = 1;
} finally {
  if (KEEP) {
    process.stdout.write(`\n(--keep) container left running: ${CONTAINER}\n`);
  } else {
    const r = docker(['rm', '-f', '-v', CONTAINER], { capture: true, allowFail: true });
    process.stdout.write(
      r.status === 0
        ? `\ndisposable container removed: ${CONTAINER}\n`
        : `\nWARNING: could not remove ${CONTAINER}: ${r.stderr.trim()}\n`,
    );
  }
}

process.exit(exitCode);
