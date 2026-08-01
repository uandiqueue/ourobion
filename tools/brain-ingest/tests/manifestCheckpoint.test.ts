import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Manifest } from '../src/manifest.js';
import {
  ManifestCheckpointBuffer,
  installManifestCheckpointGuards,
} from '../src/manifestCheckpoint.js';
import type { PaperRecord } from '../src/types.js';

function rec(paperUid: string, status: PaperRecord['status'] = 'discovered'): PaperRecord {
  return {
    paperUid,
    identifiers: { doi: paperUid.replace(/^doi:/, '') },
    title: paperUid,
    authors: [],
    year: 2026,
    venue: null,
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: ['test'],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status,
    errors: [],
    fetchedAt: null,
  };
}

class FakeProcess extends EventEmitter {
  readonly pid = 42;
  readonly kills: Array<{ pid: number; signal: 'SIGINT' | 'SIGTERM' }> = [];

  kill(pid: number, signal: 'SIGINT' | 'SIGTERM'): boolean {
    this.kills.push({ pid, signal });
    return true;
  }
}

test('checkpoints changed records in one atomic bounded batch without changing record count', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ingest-checkpoint-'));
  try {
    const manifest = Manifest.open(dir);
    manifest.upsertMany([rec('doi:10.1/a'), rec('doi:10.1/b'), rec('doi:10.1/c')]);
    const logs: string[] = [];
    const checkpoint = new ManifestCheckpointBuffer(manifest, {
      interval: 2,
      log: (line) => logs.push(line),
    });

    checkpoint.stage(rec('doi:10.1/a', 'fetched'));
    assert.equal(Manifest.open(dir).get('doi:10.1/a')?.status, 'discovered');
    checkpoint.stage(rec('doi:10.1/b', 'fetched'));

    const reopened = Manifest.open(dir);
    assert.equal(reopened.all().length, 3);
    assert.equal(reopened.get('doi:10.1/a')?.status, 'fetched');
    assert.equal(reopened.get('doi:10.1/b')?.status, 'fetched');
    assert.equal(checkpoint.pendingCount(), 0);
    assert.match(logs[0] ?? '', /2 changed record\(s\), 3 total/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`${signal} synchronously flushes the pending checkpoint before re-raising the signal`, () => {
    const dir = mkdtempSync(join(tmpdir(), `brain-ingest-checkpoint-${signal.toLowerCase()}-`));
    try {
      const manifest = Manifest.open(dir);
      manifest.upsert(rec('doi:10.1/a'));
      const checkpoint = new ManifestCheckpointBuffer(manifest, { interval: 100 });
      checkpoint.stage(rec('doi:10.1/a', 'fetched'));
      const fake = new FakeProcess();
      installManifestCheckpointGuards(checkpoint, fake);

      fake.emit(signal);

      assert.equal(Manifest.open(dir).get('doi:10.1/a')?.status, 'fetched');
      assert.equal(checkpoint.pendingCount(), 0);
      assert.deepEqual(fake.kills, [{ pid: 42, signal }]);
      assert.equal(fake.listenerCount('exit'), 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('process exit synchronously flushes the pending checkpoint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ingest-checkpoint-exit-'));
  try {
    const manifest = Manifest.open(dir);
    manifest.upsert(rec('doi:10.1/a'));
    const checkpoint = new ManifestCheckpointBuffer(manifest, { interval: 100 });
    checkpoint.stage(rec('doi:10.1/a', 'fetched'));
    const fake = new FakeProcess();
    installManifestCheckpointGuards(checkpoint, fake);

    fake.emit('exit');

    assert.equal(Manifest.open(dir).get('doi:10.1/a')?.status, 'fetched');
    assert.equal(checkpoint.pendingCount(), 0);
    assert.deepEqual(fake.kills, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
