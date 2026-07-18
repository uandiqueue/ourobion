// A14 empty-input guard tests (audit register): the loader CLI must refuse to run when the
// validated artifact set is EMPTY — exit 1, nothing written, no prune — unless --allow-empty
// states the intent. The guard lives in the CLI before any DB connection, so these spawn the
// real CLI as a subprocess with no database at all: reaching the SUPABASE_DB_URL complaint is
// itself proof the guard was passed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..', 'load_edges.mjs');
const FIXTURES = path.join(HERE, 'fixtures', 'edges');

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    // Never reach a real DB from these tests, whatever the developer shell exports.
    env: { ...process.env, SUPABASE_DB_URL: '' },
  });
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
