/**
 * Manifest tests (design §6, §8, §10.6) — node:test, via tsx. NO network.
 *
 * Proves the crash-safe, resumable JSONL manifest:
 *  - append() writes one line; readAll() round-trips it;
 *  - upsert() inserts new uids (append) and replaces existing ones (rewrite)
 *    without ever duplicating a line — the manifest is idempotent;
 *  - a re-opened manifest (simulated restart) sees the latest record per uid;
 *  - parseJsonl tolerates a torn trailing line (hard-crash mid-append);
 *  - summarize() counts statuses + topic tags.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Manifest, readAll, parseJsonl, summarize, MANIFEST_FILENAME } from '../src/manifest.js';
import type { PaperRecord } from '../src/types.js';

function tmpCorpus(): string {
  return mkdtempSync(join(tmpdir(), 'brain-ingest-manifest-'));
}

function rec(paperUid: string, over: Partial<PaperRecord> = {}): PaperRecord {
  return {
    paperUid,
    identifiers: { doi: paperUid.replace(/^doi:/, '') },
    title: `Title ${paperUid}`,
    authors: ['A. Author'],
    year: 2024,
    venue: 'Journal',
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: ['gut_microbiome'],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
    ...over,
  };
}

test('append + readAll round-trips a single record', () => {
  const dir = tmpCorpus();
  try {
    const m = Manifest.open(dir);
    m.append(rec('doi:10.1/a'));
    const back = readAll(join(dir, MANIFEST_FILENAME));
    assert.equal(back.length, 1);
    assert.equal(back[0]?.paperUid, 'doi:10.1/a');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upsert appends new uids and replaces existing ones without duplicating lines', () => {
  const dir = tmpCorpus();
  const path = join(dir, MANIFEST_FILENAME);
  try {
    const m = Manifest.open(dir);
    assert.equal(m.upsert(rec('doi:10.1/a')), true); // inserted
    assert.equal(m.upsert(rec('doi:10.1/b')), true); // inserted
    // Update 'a' to fetched — must NOT add a 3rd line.
    assert.equal(m.upsert(rec('doi:10.1/a', { status: 'fetched' })), false); // updated

    const lines = readFileSync(path, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2, 'no duplicate line for the updated uid');

    const back = readAll(path);
    assert.equal(back.length, 2);
    assert.equal(back.find((r) => r.paperUid === 'doi:10.1/a')?.status, 'fetched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('delete removes a uid from the index + file and reports prior existence', () => {
  const dir = tmpCorpus();
  const path = join(dir, MANIFEST_FILENAME);
  try {
    const m = Manifest.open(dir);
    m.upsert(rec('doi:10.1/a'));
    m.upsert(rec('doi:10.1/b'));
    m.upsert(rec('doi:10.1/c'));

    assert.equal(m.delete('doi:10.1/b'), true, 'existing uid → true');
    assert.equal(m.delete('doi:10.1/missing'), false, 'absent uid → false');

    // In-memory view drops it, order preserved for the rest.
    assert.equal(m.has('doi:10.1/b'), false);
    assert.deepEqual(m.all().map((r) => r.paperUid), ['doi:10.1/a', 'doi:10.1/c']);

    // The file was atomically rewritten — only two lines remain.
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);

    // A reopened manifest (restart) no longer sees the deleted uid.
    const m2 = Manifest.open(dir);
    assert.equal(m2.has('doi:10.1/b'), false);
    assert.equal(m2.all().length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('re-opening the manifest (restart) sees the latest record per uid', () => {
  const dir = tmpCorpus();
  try {
    const m1 = Manifest.open(dir);
    m1.upsert(rec('doi:10.1/a', { status: 'discovered' }));
    m1.upsert(rec('doi:10.1/a', { status: 'fetched', fetchedAt: '2026-06-29T00:00:00.000Z' }));

    // Simulate a crash + restart: a brand-new instance reads from disk.
    const m2 = Manifest.open(dir);
    assert.equal(m2.get('doi:10.1/a')?.status, 'fetched');
    assert.equal(m2.withStatus('fetched').length, 1);
    assert.equal(m2.withStatus('discovered').length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest reconstruction round-trips exact PubMed publication types and MeSH headings', () => {
  const dir = tmpCorpus();
  try {
    Manifest.open(dir).upsert(rec('doi:10.1/indexed', {
      publicationTypes: [
        { ui: 'D016449', name: 'Randomized Controlled Trial' },
        { ui: 'D017418', name: 'Meta-Analysis' },
      ],
      meshHeadings: [
        { ui: 'D000818', name: 'Animals', majorTopic: false },
        { ui: 'D006801', name: 'Humans', majorTopic: true },
      ],
    }));
    const reconstructed = Manifest.open(dir).get('doi:10.1/indexed')!;
    assert.deepEqual(reconstructed.publicationTypes, [
      { ui: 'D016449', name: 'Randomized Controlled Trial' },
      { ui: 'D017418', name: 'Meta-Analysis' },
    ]);
    assert.deepEqual(reconstructed.meshHeadings, [
      { ui: 'D000818', name: 'Animals', majorTopic: false },
      { ui: 'D006801', name: 'Humans', majorTopic: true },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseJsonl tolerates a torn trailing line (hard crash mid-append)', () => {
  const dir = tmpCorpus();
  const path = join(dir, MANIFEST_FILENAME);
  try {
    const good = JSON.stringify(rec('doi:10.1/a'));
    // second line is half-written JSON (no closing brace)
    writeFileSync(path, good + '\n' + '{"paperUid":"doi:10.1/b","tit', 'utf8');
    const back = readAll(path);
    assert.equal(back.length, 1);
    assert.equal(back[0]?.paperUid, 'doi:10.1/a');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('summarize counts statuses and topic tags', () => {
  const records = [
    rec('doi:10.1/a', { status: 'discovered', topicTags: ['gut_microbiome'] }),
    rec('doi:10.1/b', { status: 'fetched', topicTags: ['gut_microbiome', 'hydration'] }),
    rec('doi:10.1/c', { status: 'failed', topicTags: ['hydration'] }),
  ];
  const s = summarize(records);
  assert.equal(s.total, 3);
  assert.equal(s.discovered, 1);
  assert.equal(s.fetched, 1);
  assert.equal(s.failed, 1);
  assert.equal(s.byTopic['gut_microbiome'], 2);
  assert.equal(s.byTopic['hydration'], 2);
});

test('readAll returns [] for a missing manifest (fresh corpus)', () => {
  const dir = tmpCorpus();
  try {
    assert.deepEqual(readAll(join(dir, MANIFEST_FILENAME)), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseJsonl collapses duplicate uids last-write-wins inside readAll', () => {
  const dir = tmpCorpus();
  const path = join(dir, MANIFEST_FILENAME);
  try {
    const l1 = JSON.stringify(rec('doi:10.1/a', { status: 'discovered' }));
    const l2 = JSON.stringify(rec('doi:10.1/a', { status: 'fetched' }));
    writeFileSync(path, l1 + '\n' + l2 + '\n', 'utf8');
    // parseJsonl keeps both raw rows; readAll dedups.
    assert.equal(parseJsonl(readFileSync(path, 'utf8')).length, 2);
    const back = readAll(path);
    assert.equal(back.length, 1);
    assert.equal(back[0]?.status, 'fetched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
