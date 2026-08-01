import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeClaimsJsonl, prepareOfflineAcceptance, readFrozenFile, runOfflineAcceptance } from '../src/offlineAcceptance.js';
import { main } from '../src/cli.js';

const PAPER = 'paper:offline-1';
const INDEPENDENT = 'paper:offline-2';
const QUOTE = 'Higher self-reported gut comfort was associated with better mood.';
const INDEPENDENT_QUOTE = 'Independent observations linked higher gut comfort with better mood.';

function setup(response = goodResponse(), paperUids = [PAPER]) {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-offline-acceptance-'));
  const evidenceInputs = {
    abstract: null,
    workType: null,
    publicationTypes: [],
    meshHeadings: [{ ui: 'D015331', name: 'Cohort Studies', majorTopic: false }],
  };
  writeFileSync(join(dir, 'corpus.jsonl'), [
    JSON.stringify({ paperId: PAPER, title: 'Offline paper', year: 2026, text: QUOTE, evidenceTier: 3, evidenceInputs, impactTier: 'moderate' }),
    JSON.stringify({ paperId: INDEPENDENT, title: 'Independent paper', year: 2025, text: INDEPENDENT_QUOTE, evidenceTier: 3, evidenceInputs, impactTier: 'moderate' }),
  ].join('\n') + '\n');
  writeFileSync(join(dir, 'response.json'), response);
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify({ acceptanceRunId: 'run4-offline-001', artifactRevision: 'run4/offline-001', pair: ['gut_comfort_score', 'mood_score'], paperUids, corpus: 'corpus.jsonl', synthesisResponse: 'response.json' }));
  return dir;
}

function quoteCheckOnlyResponse() {
  const parsed = JSON.parse(goodResponse()) as { claims: Array<Record<string, any>> };
  parsed.claims[0]!.citations.push({ paperId: INDEPENDENT, title: 'Independent paper', year: 2025, population: 'adults', evidenceTier: 3, impactTier: 'moderate', stance: 'supports' });
  parsed.claims[0]!.quoteSpans.push({ paperId: INDEPENDENT, quote: INDEPENDENT_QUOTE, locator: null, charStart: null, charEnd: null });
  return JSON.stringify(parsed);
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
    assert.equal(manifest.stages.verify.fullMode, true);
    assert.equal(manifest.stages.verify.retrievalPerformed, true);
    assert.ok(manifest.stages.verify.retrievalSources[0] > 0);
    assert.equal(manifest.artifacts.rawEvidenceStaged, false);
    assert.doesNotMatch(JSON.stringify(manifest), /api[_-]?key|secret|postgres/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('checked-in two-paper bundle is quote-valid, independently retrieved, and metadata-authoritative', async () => {
  const bundle = new URL('../fixtures/offline-acceptance-run4/bundle.json', import.meta.url);
  const prepared = await prepareOfflineAcceptance(fileURLToPath(bundle));
  assert.equal(prepared.corpus.length, 2);
  assert.equal(prepared.acceptedClaims.length, 1);
  assert.equal(prepared.acceptedClaims[0]?.citations[0]?.title, 'Frozen cited study');
  assert.equal(prepared.acceptedClaims[0]?.citations[0]?.year, 2024);
  const manifest = prepared.manifest as Record<string, any>;
  assert.ok(manifest.stages.verify.retrievalSources[0] > 0);
  assert.deepEqual(manifest.stages.verify.retrievalPaperIds[0], ['fixture:run4-independent']);
});

test('quoteCheck-only triage is explicitly non-acceptance even when every quote is present', async () => {
  const dir = setup(quoteCheckOnlyResponse(), [PAPER, INDEPENDENT]);
  try {
    await assert.rejects(
      () => runOfflineAcceptance(join(dir, 'bundle.json'), true),
      /full-mode A10 retrieval.*quoteCheck-only\/empty retrieval is non-acceptance/,
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('frozen reads reject in-place mutation and symlink evidence', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-frozen-read-'));
  const evidence = join(dir, 'evidence.json');
  writeFileSync(evidence, '{before:true}');
  try {
    assert.throws(
      () => readFrozenFile(evidence, 'evidence', () => appendFileSync(evidence, ' replacement')),
      /changed during read/,
    );
    const link = join(dir, 'link.json');
    try {
      symlinkSync(evidence, link, 'file');
      assert.throws(() => readFrozenFile(link, 'evidence'), /regular non-symlink/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      t.diagnostic('file symlinks unavailable on this Windows host');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('frozen reads stay descriptor-bound and reject path replacement', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-frozen-replace-'));
  const evidence = join(dir, 'evidence.json');
  const replacement = join(dir, 'replacement.json');
  const displaced = join(dir, 'displaced.json');
  writeFileSync(evidence, 'original');
  writeFileSync(replacement, 'replacement');
  let replaceError: unknown;
  let thrown: unknown;
  try {
    try {
      readFrozenFile(evidence, 'evidence', () => {
        try {
          renameSync(evidence, displaced);
          renameSync(replacement, evidence);
        } catch (error) { replaceError = error; }
      });
    } catch (error) { thrown = error; }
    if (replaceError !== undefined) {
      t.skip('open-file replacement unavailable on this platform');
      return;
    }
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /path was replaced during read/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('claimsSha256 input is the exact staged claims.jsonl byte encoding', () => {
  const bytes = encodeClaimsJsonl([{ edgeId: 'edge', value: 'one' } as never, { edgeId: 'edge-2', value: 'two' } as never]);
  const exact = [JSON.stringify({ edgeId: 'edge', value: 'one' }), JSON.stringify({ edgeId: 'edge-2', value: 'two' }), ''].join('\n');
  assert.equal(bytes.toString('utf8'), exact);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '008c92e2556d2202a3eec37584993cdad4a4121f2559f92eb51e198b1d188288');
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
