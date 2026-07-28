#!/usr/bin/env node
// supabase/tests/profile_prefs/run.mjs — the UI gap 2 daily-digest preference proof.
//
// Node stdlib only. Run with the repo toolchain on PATH:
//   . .\scripts\biotope-env.ps1 ; node supabase/tests/profile_prefs/run.mjs
//
// Applies every migration in plain filename order to a DISPOSABLE postgres:17
// container, then runs assertions.sql as two different authenticated subjects to
// prove that `public.profile_notification_prefs` is reachable ONLY through the
// two SECURITY DEFINER RPCs, and that neither RPC can be aimed at another user.
//
// It reuses supabase/tests/authz/10_supabase_shim.sql read-only — that file
// reproduces Supabase's default privileges (`alter default privileges ... grant
// all`), which is what makes this migration's explicit revokes meaningful. Do
// not fork it: if the shim and this test drift, the revokes stop being tested.
// Nothing in supabase/tests/authz/ is modified by this runner.
//
// Flags:  --keep  leave the container running (prints its name)

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

const KEEP = process.argv.slice(2).includes('--keep');

// A silent pass over zero assertions must be impossible.
const MIN_ASSERTIONS = 30;

const CONTAINER = `ourobion-prefs-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
if (CONTAINER.includes('supabase')) throw new Error(`refusing container name ${CONTAINER}`);

function docker(args, { capture = false, allowFail = false } = {}) {
  const r = spawnSync('docker', args, {
    cwd: REPO,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed (exit ${r.status})`
      + (capture ? `\n${r.stdout ?? ''}${r.stderr ?? ''}` : ''));
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

const SEP = String.fromCharCode(31);

function psqlQuery(sql) {
  return docker(
    ['exec', '-u', 'postgres', CONTAINER, 'psql', '-At', '-F', SEP,
      '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { capture: true },
  ).stdout.replace(/\r/g, '').trimEnd();
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForPostgres() {
  for (let i = 0; i < 120; i += 1) {
    if (docker(['exec', '-u', 'postgres', CONTAINER, 'pg_isready', '-U', 'postgres'],
      { capture: true, allowFail: true }).status === 0) return;
    sleepSync(500);
  }
  throw new Error('postgres did not become ready in the disposable container');
}

function step(label) {
  process.stdout.write(`\n── ${label}\n`);
}

let exitCode = 1;
try {
  const migrations = readdirSync(resolve(REPO, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql')).sort();

  step(`disposable container ${CONTAINER} (postgres:17)`);
  docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=postgres',
    '-e', 'POSTGRES_DB=postgres', 'postgres:17'], { capture: true });
  waitForPostgres();

  step('extension stubs + repo files');
  docker(['cp', 'ci/pg-extension-stubs/.', `${CONTAINER}:/usr/share/postgresql/17/extension/`],
    { capture: true });
  docker(['exec', CONTAINER, 'mkdir', '-p', '/harness'], { capture: true });
  docker(['cp', 'ci', `${CONTAINER}:/harness/ci`], { capture: true });
  docker(['cp', 'supabase/migrations', `${CONTAINER}:/harness/migrations`], { capture: true });
  docker(['cp', 'supabase/tests/authz/10_supabase_shim.sql',
    `${CONTAINER}:/harness/10_supabase_shim.sql`], { capture: true });
  docker(['cp', 'supabase/tests/profile_prefs/assertions.sql',
    `${CONTAINER}:/harness/assertions.sql`], { capture: true });
  docker(['exec', CONTAINER, 'chown', '-R', 'postgres:postgres', '/harness'], { capture: true });

  step('bootstrap + Supabase default-privilege shim');
  psqlFile('/harness/ci/migrations-bootstrap.sql');
  psqlFile('/harness/10_supabase_shim.sql');

  step(`apply ${migrations.length} migrations in plain filename order`);
  for (const f of migrations) {
    process.stdout.write(`   ${f}\n`);
    psqlFile(`/harness/migrations/${f}`);
  }

  step('assertions');
  psqlFile('/harness/assertions.sql');

  const rows = psqlQuery('select name, expected, actual, ok from prefs_probe.result order by id')
    .split('\n').filter(Boolean).map((line) => {
      const [name, expected, actual, ok] = line.split(SEP);
      return { name, expected, actual, ok: ok === 't' };
    });

  for (const r of rows) {
    process.stdout.write(`   ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}\n`);
  }

  const failures = rows.filter((r) => !r.ok);
  if (failures.length) {
    process.stdout.write(`\n${failures.length} FAILED ASSERTION(S):\n`);
    for (const f of failures) {
      process.stdout.write(`  ${f.name}\n      expected: ${f.expected}\n      actual:   ${f.actual}\n`);
    }
  }

  process.stdout.write('\n─────────────────────────────────────────────────────────────\n');
  process.stdout.write(`assertions run     : ${rows.length}\n`);
  process.stdout.write(`assertions passed  : ${rows.length - failures.length}\n`);
  process.stdout.write(`assertions failed  : ${failures.length}\n`);
  process.stdout.write(`minimum required   : ${MIN_ASSERTIONS}\n`);

  const problems = [];
  if (rows.length < MIN_ASSERTIONS) {
    problems.push(`only ${rows.length} assertions ran; at least ${MIN_ASSERTIONS} required`);
  }
  if (failures.length) problems.push(`${failures.length} assertion(s) failed`);

  if (problems.length) {
    process.stdout.write(`\nRESULT: FAIL\n  - ${problems.join('\n  - ')}\n`);
  } else {
    process.stdout.write('\nRESULT: PASS — every assertion held.\n');
    exitCode = 0;
  }
} catch (err) {
  process.stdout.write(`\nRESULT: ERROR — ${err.message}\n`);
} finally {
  if (KEEP) {
    process.stdout.write(`\n(--keep) container left running: ${CONTAINER}\n`);
  } else {
    const r = docker(['rm', '-f', '-v', CONTAINER], { capture: true, allowFail: true });
    process.stdout.write(r.status === 0
      ? `\ndisposable container removed: ${CONTAINER}\n`
      : `\nWARNING: could not remove ${CONTAINER}: ${r.stderr.trim()}\n`);
  }
}

process.exit(exitCode);
