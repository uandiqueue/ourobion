import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOfflineAcceptance } from '../src/offlineAcceptance.js';
import { main } from '../src/cli.js';

const PAPER = 'paper:offline-1';
const QUOTE = 'Higher self-reported gut comfort was associated with better mood.';

function setup(response = goodResponse()) {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-offline-acceptance-'));
  writeFileSync(join(dir, 'corpus.jsonl'), JSON.stringify({ paperId: PAPER, title: 'Offline paper', year: 2026, text: QUOTE, evidenceTier: 3, impactTier: 'moderate' }) + '\n');
  writeFileSync(join(dir, 'response.json'), response);
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify({ acceptanceRunId: 'run4-offline-001', artifactRevision: 'run4/offline-001', pair: ['gut_comfort_score', 'mood_score'], paperUids: [PAPER], corpus: 'corpus.jsonl', synthesisResponse: 'response.json' }));
  return dir;
}

function goodResponse() {
  return JSON.stringify({ claims: [{ subject: 'gut_comfort_score', object: 'mood_score', relation: 'correlates', claimKind: 'correlational', effect: { size: null, unit: null, ci: null }, population: 'adults', citations: [{ paperId: PAPER, title: 'Offline paper', year: 2026, population: 'adults', evidenceTier: 3, impactTier: 'moderate', stance: 'supports' }], quoteSpans: [{ paperId: PAPER, quote: QUOTE, locator: null, charStart: null, charEnd: null }], derivation: 'The reported observations describe a correlation.' }] });
}

test('offline acceptance freezes inputs and proves quoteCheck without provider dispatch', async () => {
  const dir = setup();
  try {
    const manifest = await runOfflineAcceptance(join(dir, 'bundle.json'), true) as Record<string, any>;
    assert.equal(manifest.mode, 'dry-run');
    assert.equal(manifest.acceptanceRunId, 'run4-offline-001');
    assert.equal(manifest.families.separated, true);
    assert.equal(manifest.stages.synthesis.attempts, 0);
    assert.equal(manifest.stages.verify.attempts, 0);
    assert.equal(manifest.stages.verify.quoteCheck[0].allPresent, true);
    assert.equal(manifest.artifacts.rawEvidenceStaged, false);
    assert.doesNotMatch(JSON.stringify(manifest), /api[_-]?key|secret|postgres/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('offline acceptance fails closed on a fabricated quote or an attempt to leave dry-run', async () => {
  const dir = setup(goodResponse().replace(QUOTE, 'fabricated claim'));
  try {
    await assert.rejects(() => runOfflineAcceptance(join(dir, 'bundle.json'), true), /no quote-valid claims/);
    await assert.rejects(() => runOfflineAcceptance(join(dir, 'bundle.json'), false), /--dry-run is required/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('offline acceptance CLI contract requires dry-run and never reaches fetch', async () => {
  const dir = setup();
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('provider/network access is forbidden'); }) as typeof fetch;
  try {
    assert.equal(await main(['offline-acceptance', '--bundle', join(dir, 'bundle.json')]), 2);
    assert.equal(await main(['offline-acceptance', '--bundle', join(dir, 'bundle.json'), '--dry-run']), 0);
  } finally {
    globalThis.fetch = savedFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});
