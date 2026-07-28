#!/usr/bin/env node
// supabase/tests/authz/run.mjs — the R4-U2 RLS proof harness runner.
//
// Node stdlib only (node:child_process, node:fs, node:path, node:url). No dependency, no package.
// Run it with the repo toolchain on PATH:  . .\scripts\biotope-env.ps1 ; node supabase/tests/authz/run.mjs
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────────────────────────────────
//   1. Creates a DISPOSABLE postgres:17 container with a unique name, and removes it in a finally
//      block — on success, on assertion failure, and on crash.
//   2. Applies ci/pg-extension-stubs (pg_cron / pg_net), then ci/migrations-bootstrap.sql, then
//      10_supabase_shim.sql (the pre-migration Supabase reconstruction; see that file for why).
//   3. Applies EVERY file in supabase/migrations/ in the same plain lexicographic order the
//      `migrations-apply` CI job uses, but in three phases so that non-regression is MEASURED:
//         phase 1  every migration that sorts before the R4-U2 allocation
//         ── snapshot pg_policies + effective column privileges, and run the P-b baseline ──
//         phase 2  the three R4-U2 migrations
//         phase 3  every migration that sorts after them (other units' work, applied in real order)
//      Phase 1 + 2 + 3 together are exactly what CI applies, so this doubles as a local
//      migration shadow-apply: a syntax error, an ordering break, or a missing dependency surfaces
//      here before CI.
//   4. Seeds membership, runs 60_assertions.sql and 70_non_regression.sql, then reads every
//      recorded assertion out of authz_probe.result and decides the exit code.
//
// ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────────────────────────
//   It never touches the developer's running Supabase stack. The container name is generated per
//   run and is refused outright if it could collide with a `supabase_*` container, and the only
//   docker verbs used are run / exec / cp / rm against that one generated name.
//
// ── SELF-TEST (proving the harness can fail) ─────────────────────────────────────────────────────
//   Set AUTHZ_FAULT_SQL=<absolute path to a .sql file> to have that file applied immediately after
//   phase 2. It is the supported way to inject a deliberate flaw — e.g. stubbing public.nao_has_role
//   to `return true`, or re-granting a revoked column — and watch the relevant assertions fail. No
//   fault file lives in the repo; the flaw exists only in the scratch file you point at.
//
// Flags:  --summary  print group totals instead of every assertion name
//         --keep     leave the container running (for debugging; prints its name)

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

// The three migrations this unit owns. Everything before them is the pre-U2 baseline; everything
// after them belongs to another unit and is applied in real filename order.
const U2_MIGRATIONS = [
  '20260728010000_nao_staff_roles.sql',
  '20260728010001_nao_control_events.sql',
  '20260728010002_nao_redaction_grants.sql',
];

// A silent pass over zero assertions must be impossible. This floor is deliberately well below the
// suite's real size, so it catches "the suite did not run" without breaking on every added case.
const MIN_ASSERTIONS = 350;

const ARGS = new Set(process.argv.slice(2));
const SUMMARY_ONLY = ARGS.has('--summary');
const KEEP = ARGS.has('--keep');

const CONTAINER = `ourobion-u2-authz-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
if (/^supabase/i.test(CONTAINER) || CONTAINER.includes('supabase')) {
  throw new Error(`refusing to use container name ${CONTAINER}`);
}

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
  // NOTICEs (mostly "already exists, skipping") are noise; anything else psql says on stderr is
  // worth seeing.
  const noise = r.stderr.split('\n').filter((l) => l.trim() && !/NOTICE:/.test(l)).join('\n');
  if (noise) process.stdout.write(`${noise}\n`);
  if (r.status !== 0) throw new Error(`psql -f ${containerPath} failed (exit ${r.status})`);
  return r.stdout;
}

const SEP = String.fromCharCode(31); // ASCII unit separator - cannot occur in a recorded value

function psqlQuery(sql) {
  const r = docker(
    ['exec', '-u', 'postgres', CONTAINER, 'psql', '-At', '-F', SEP,
      '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { capture: true },
  );
  return r.stdout.replace(/\r/g, '').trimEnd();
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

function partitionMigrations() {
  const dir = resolve(REPO, 'supabase', 'migrations');
  const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const missing = U2_MIGRATIONS.filter((m) => !all.includes(m));
  if (missing.length) throw new Error(`R4-U2 migrations missing: ${missing.join(', ')}`);
  const first = U2_MIGRATIONS[0];
  const last = U2_MIGRATIONS[U2_MIGRATIONS.length - 1];
  return {
    pre: all.filter((f) => f < first),
    u2: U2_MIGRATIONS,
    post: all.filter((f) => f > last),
  };
}

function step(label) {
  process.stdout.write(`\n── ${label}\n`);
}

let exitCode = 1;
try {
  const phases = partitionMigrations();

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
  docker(['exec', CONTAINER, 'chown', '-R', 'postgres:postgres', '/harness'], { capture: true });

  step('bootstrap supabase-shaped primitives + the pre-migration shim');
  psqlFile('/harness/ci/migrations-bootstrap.sql');
  psqlFile('/harness/authz/10_supabase_shim.sql');

  step(`phase 1 — ${phases.pre.length} pre-U2 migrations, filename order`);
  for (const f of phases.pre) {
    process.stdout.write(`   ${f}\n`);
    psqlFile(`/harness/migrations/${f}`);
  }

  step('snapshot the authorization surface + run the P-b baseline (phase = pre)');
  psqlFile('/harness/authz/20_probe_harness.sql');
  psqlFile('/harness/authz/30_pre_u2_seed.sql');
  psqlFile('/harness/authz/40_pre_u2_probe.sql');

  step(`phase 2 — the ${phases.u2.length} R4-U2 migrations`);
  for (const f of phases.u2) {
    process.stdout.write(`   ${f}\n`);
    psqlFile(`/harness/migrations/${f}`);
  }

  if (process.env.AUTHZ_FAULT_SQL) {
    const fault = resolve(process.env.AUTHZ_FAULT_SQL);
    if (!existsSync(fault)) throw new Error(`AUTHZ_FAULT_SQL not found: ${fault}`);
    step(`FAULT INJECTION (self-test) — applying ${fault}`);
    docker(['cp', fault, `${CONTAINER}:/harness/fault.sql`], { capture: true });
    docker(['exec', CONTAINER, 'chown', 'postgres:postgres', '/harness/fault.sql'],
      { capture: true });
    psqlFile('/harness/fault.sql');
  }

  if (phases.post.length) {
    step(`phase 3 — ${phases.post.length} migration(s) sorting after the R4-U2 allocation`);
    for (const f of phases.post) {
      process.stdout.write(`   ${f}\n`);
      psqlFile(`/harness/migrations/${f}`);
    }
  }

  step('provision membership + run the assertion suite');
  psqlFile('/harness/authz/50_post_u2_seed.sql');
  psqlFile('/harness/authz/60_assertions.sql');
  psqlFile('/harness/authz/70_non_regression.sql');

  step('results');
  const rows = psqlQuery(
    'select phase, name, expected, actual, ok from authz_probe.result order by id',
  ).split('\n').filter(Boolean).map((line) => {
    const [phase, name, expected, actual, ok] = line.split(SEP);
    return { phase, name, expected, actual, ok: ok === 't' };
  });

  const groups = new Map();
  for (const r of rows) {
    const key = `${r.phase}/${r.name.split('.')[0]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  for (const [key, list] of groups) {
    const failed = list.filter((r) => !r.ok).length;
    process.stdout.write(
      `\n[${failed ? 'FAIL' : ' ok ' }] ${key}  (${list.length} assertion${list.length === 1 ? '' : 's'}`
      + `${failed ? `, ${failed} failed` : ''})\n`,
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

  const unsetPhase = rows.filter((r) => r.phase === '<unset>').length;

  process.stdout.write('\n─────────────────────────────────────────────────────────────\n');
  process.stdout.write(`assertions run     : ${rows.length}`
    + ` (pre ${rows.filter((r) => r.phase === 'pre').length},`
    + ` post ${rows.filter((r) => r.phase === 'post').length})\n`);
  process.stdout.write(`assertions passed  : ${rows.length - failures.length}\n`);
  process.stdout.write(`assertions failed  : ${failures.length}\n`);
  process.stdout.write(`minimum required   : ${MIN_ASSERTIONS}\n`);

  const problems = [];
  if (rows.length < MIN_ASSERTIONS) {
    problems.push(`only ${rows.length} assertions ran; the suite requires at least ${MIN_ASSERTIONS}`
      + ' (a silent pass over an empty suite must be impossible)');
  }
  if (unsetPhase) problems.push(`${unsetPhase} assertion(s) recorded without a phase`);
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
