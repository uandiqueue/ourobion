// A14 empty-input guard tests (audit register): the loader CLI must refuse to run when the
// validated artifact set is EMPTY — exit 1, nothing written, no prune — unless --allow-empty
// states the intent. The guard lives in the CLI before any DB connection, so these spawn the
// real CLI as a subprocess with no database at all: reaching the SUPABASE_DB_URL complaint is
// itself proof the guard was passed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLoad } from '../lib/artifacts.mjs';
import { loadIntoDb } from '../load_edges.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..', 'load_edges.mjs');
const FIXTURES = path.join(HERE, 'fixtures', 'edges');

function runCli(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    // Never reach a real DB from these tests, whatever the developer shell exports.
    env: { ...process.env, SUPABASE_DB_URL: '', ...extraEnv },
  });
}

function fixtureHashes() {
  const digest = (basename: string) => createHash('sha256').update(readFileSync(path.join(FIXTURES, basename))).digest('hex');
  return {
    OUROBION_EXPECTED_CLAIMS_SHA256: digest('claims.jsonl'),
    OUROBION_EXPECTED_VERIFICATIONS_SHA256: digest('verifications.jsonl'),
  };
}

/** A mirror dir whose claims.jsonl exists but holds zero lines — the A14 failure scenario. */
function emptyMirror(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ourobion-edges-empty-'));
  writeFileSync(path.join(dir, 'claims.jsonl'), '');
  writeFileSync(path.join(dir, 'verifications.jsonl'), '');
  return dir;
}

test('A14: an empty artifact set aborts with exit 1 before any DB work, naming --allow-empty', () => {
  const dir = emptyMirror();
  try {
    const out = runCli(['--from-dir', dir]);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /EMPTY/);
    assert.match(out.stderr, /--allow-empty/);
    // The guard fires BEFORE the DB URL check — no transaction, no prune, was ever possible.
    assert.doesNotMatch(out.stderr, /SUPABASE_DB_URL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --check on an empty set fails the same way (check verdict mirrors the real run)', () => {
  const dir = emptyMirror();
  try {
    const out = runCli(['--from-dir', dir, '--check']);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /EMPTY/);
    assert.match(out.stderr, /--allow-empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --check --allow-empty reports the emptiness and exits 0 (no DB writes in dry-run)', () => {
  const dir = emptyMirror();
  try {
    const out = runCli(['--from-dir', dir, '--check', '--allow-empty']);
    assert.equal(out.status, 0);
    assert.match(out.stdout, /0 claim\(s\) \+ 0 verification\(s\) valid/);
    assert.match(out.stdout, /Dry run — no database writes\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --allow-empty proceeds past the guard on a real run (stops only at the missing DB URL here)', () => {
  const dir = emptyMirror();
  try {
    const out = runCli(['--from-dir', dir, '--allow-empty']);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /SUPABASE_DB_URL/); // past the guard — this is the DB-less environment talking
    assert.doesNotMatch(out.stderr, /--allow-empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the guard does not touch the normal path: --check over the fixture mirror stays green', () => {
  const out = runCli(['--from-dir', FIXTURES, '--check']);
  assert.equal(out.status, 0);
  assert.match(out.stdout, /4 claim\(s\) \+ 4 verification\(s\) valid/);
});

test('--db-url and --no-prune keep validation local and do not require ambient SUPABASE_DB_URL', () => {
  const out = runCli(['--from-dir', FIXTURES, '--check', '--db-url', 'postgresql://localhost:54322/postgres', '--no-prune'], fixtureHashes());
  assert.equal(out.status, 0);
  assert.match(out.stdout, /4 claim\(s\) \+ 4 verification\(s\) valid/);
});

test('--no-prune refuses missing, malformed, or mismatched expected hashes before DB handling', () => {
  const cases: Array<Record<string, string>> = [
    {},
    { OUROBION_EXPECTED_CLAIMS_SHA256: 'bad' },
    { OUROBION_EXPECTED_CLAIMS_SHA256: '0'.repeat(64), OUROBION_EXPECTED_VERIFICATIONS_SHA256: '1'.repeat(64) },
  ];
  for (const env of cases) {
    const out = runCli(['--from-dir', FIXTURES, '--no-prune'], env);
    assert.equal(out.status, 1);
    assert.doesNotMatch(out.stderr, /SUPABASE_DB_URL is not set/);
  }
});

test('--no-prune requires exact hashes for the R2 path before any R2 client can be constructed', () => {
  const out = runCli(['--from-r2', '--no-prune']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /expected artifact hashes/);
  assert.doesNotMatch(out.stderr, /--from-r2 needs env vars/);
});

function loadedFixture() {
  const claims = readFileSync(path.join(FIXTURES, 'claims.jsonl'), 'utf8');
  const verifications = readFileSync(path.join(FIXTURES, 'verifications.jsonl'), 'utf8');
  return buildLoad(claims, verifications);
}

function stubClient(existingClaim: unknown, existingVerifications: unknown[] = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    calls,
    async connect() {},
    async end() {},
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/select claim from public\.relationship_claims/i.test(sql)) return { rows: existingClaim === null ? [] : [{ claim: existingClaim }] };
      if (/select verified_at, verification, status/i.test(sql)) return { rows: existingVerifications };
      if (/select \(select count/i.test(sql)) return { rows: [{ claims: 1, verifications: existingVerifications.length, verified: 0 }] };
      return { rows: [] };
    },
  };
}

test('--no-prune aborts a differing existing claim before mutation/prune', async () => {
  const loaded = loadedFixture(), row = loaded.claimRows[0]!;
  const client = stubClient({ ...row.claim, derivation: 'materially different' });
  await assert.rejects(
    () => loadIntoDb([row], [], 'unused', { prune: false, clientFactory: () => client }),
    /materially different claim/,
  );
  const mutations = client.calls.filter(({ sql }) => /^\s*(?:insert|update|delete)/i.test(sql));
  assert.deepEqual(mutations, []);
  assert.ok(client.calls.some(({ sql }) => /^\s*rollback/i.test(sql)));
});

test('--no-prune exact claim and verification are idempotent with no mutation/prune', async () => {
  const loaded = loadedFixture(), row = loaded.claimRows[0]!;
  const verification = loaded.verificationRows.find((candidate) => candidate.edge_id === row.edge_id)!;
  const client = stubClient(row.claim, [{ verified_at: verification.verified_at, verification: verification.verification, status: verification.status }]);
  await loadIntoDb([row], [verification], 'unused', { prune: false, clientFactory: () => client });
  const mutations = client.calls.filter(({ sql }) => /^\s*(?:insert|update|delete)/i.test(sql));
  assert.deepEqual(mutations, []);
  assert.ok(client.calls.some(({ sql }) => /^\s*commit/i.test(sql)));
});

test('--no-prune supersedes an older active verification before inserting the newest hold', async () => {
  const loaded = loadedFixture(), row = loaded.claimRows[0]!;
  const incoming = loaded.verificationRows.find((candidate) => candidate.edge_id === row.edge_id && candidate.status === 'active')!;
  const olderAt = new Date(Date.parse(incoming.verified_at) - 1_000).toISOString();
  const client = stubClient(row.claim, [{ verified_at: olderAt, verification: { ...incoming.verification, verifiedAt: olderAt }, status: 'active' }]);
  await loadIntoDb([row], [incoming], 'unused', { prune: false, clientFactory: () => client });
  const updateAt = client.calls.findIndex(({ sql }) => /^\s*update public\.edge_verifications/i.test(sql));
  const insertAt = client.calls.findIndex(({ sql }) => /^\s*insert into public\.edge_verifications/i.test(sql));
  assert.ok(updateAt >= 0 && insertAt > updateAt);
  assert.equal(client.calls.some(({ sql }) => /^\s*delete/i.test(sql)), false);
});
