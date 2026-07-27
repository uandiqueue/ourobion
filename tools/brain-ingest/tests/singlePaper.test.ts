import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normaliseDoi, normaliseLocalDbUrl, runSinglePaper } from '../src/singlePaper.js';

const DOI = '10.1234/local.paper';
function dir() {
  const d = mkdtempSync(join(tmpdir(), 'ourobion-single-paper-'));
  writeFileSync(join(d, 'paper.json'), JSON.stringify({ doi: `https://doi.org/${DOI}`, title: 'Local paper' }));
  writeFileSync(join(d, 'text.txt'), 'Stool form correlates with urine colour in this observational sample.');
  return d;
}
function response(quote = 'Stool form correlates with urine colour in this observational sample.') {
  return JSON.stringify({ claims: [{ edgeId: 'ignored', subject: 'stool_form', object: 'urine_colour', relation: 'correlates', claimKind: 'correlational', effect: { size: null, unit: null, ci: null }, population: 'observational sample', citations: [{ paperId: DOI, title: 'Local paper', year: null, population: 'observational sample', evidenceTier: 2, impactTier: 'low', stance: 'supports' }], quoteSpans: [{ paperId: DOI, quote, locator: null, charStart: null, charEnd: null }], derivation: 'The quoted observational result describes a correlation.' }] });
}

test('normalises DOI forms and rejects malformed DOI', () => {
  assert.equal(normaliseDoi(`https://doi.org/${DOI}`), DOI);
  assert.throws(() => normaliseDoi('not-a-doi'));
});

test('DB URL gate accepts only canonical loopback PostgreSQL authorities and no parameters', () => {
  assert.equal(normaliseLocalDbUrl('postgresql://localhost:5432/postgres'), 'postgresql://127.0.0.1:5432/postgres');
  assert.equal(normaliseLocalDbUrl('postgres://127.0.0.1/db'), 'postgresql://127.0.0.1/db');
  assert.equal(normaliseLocalDbUrl('postgresql://[::1]:5432/db'), 'postgresql://[::1]:5432/db');
  assert.equal(normaliseLocalDbUrl('postgresql://user:p%40ss@localhost/db'), 'postgresql://user:p%40ss@127.0.0.1/db');
  for (const value of ['postgresql://localhost/db', 'postgresql://127.0.0.1/db', 'postgresql://[::1]/db']) {
    const effective = new URL(normaliseLocalDbUrl(value)).hostname.replace(/^\[|\]$/g, '');
    assert.ok(effective === '127.0.0.1' || effective === '::1');
  }
  for (const value of [
    'https://localhost/db',
    'postgresql://example.com/db',
    'postgresql://127.0.0.1.evil/db',
    'postgresql://%6cocalhost/db',
    'postgresql://%5B::1%5D/db',
    'postgresql://[::1/db',
    'postgresql://localhost/db?host=remote',
    'postgresql://localhost/db?socket=/tmp/postgres',
    'postgresql://localhost/db#remote',
    'postgresql://localhost//socket',
  ]) assert.throws(() => normaliseLocalDbUrl(value));
});

test('single-paper requests host response without artifacts, then writes gated INTERIM hold idempotently', async () => {
  const d = dir();
  try {
    const requested = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    assert.equal(requested.status, 'request-needed');
    assert.equal(existsSync(join(d, 'edges', 'claims.jsonl')), false);
    writeFileSync(join(d, 'synthesis-response.json'), response());
    const done = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    assert.equal(done.status, 'completed');
    const verification = done.verification as Record<string, unknown>;
    assert.equal(verification.verdict, 'uncertain');
    assert.equal(verification.status, 'active');
    assert.equal(verification.independentRetrievalPerformed, false);
    assert.equal(verification.checksPerformed, false);
    assert.equal(verification.nonServableHold, true);
    const interim = JSON.parse(readFileSync(join(d, 'edges', 'verifications.jsonl'), 'utf8').trim()) as Record<string, any>;
    assert.match(interim.verifierModel, /^INTERIM:/);
    assert.equal(interim.independentRetrieval.performed, false);
    assert.deepEqual(interim.independentRetrieval.sources, []);
    assert.equal(interim.directionCheck.matchesClaim, false);
    assert.equal(interim.claimKindCheck.matchesClaim, false);
    assert.equal(interim.scopeCheck.supportedPopulation, null);
    assert.equal(interim.effectSizeCheck.extractedSize, null);
    const claims = readFileSync(join(d, 'edges', 'claims.jsonl'), 'utf8');
    await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    assert.equal(readFileSync(join(d, 'edges', 'claims.jsonl'), 'utf8'), claims);
    const repeated = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    assert.equal(repeated.repeated, true);
    const resumed = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], resume: true });
    assert.equal(resumed.resumed, true);
    writeFileSync(join(d, 'text.txt'), 'changed');
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], resume: true }), /drift/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completed receipt refuses response and artifact drift on resume and default repeat', async () => {
  const d = dir();
  try {
    writeFileSync(join(d, 'synthesis-response.json'), response());
    await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    writeFileSync(join(d, 'synthesis-response.json'), response().replace('correlation.', 'observational association.'));
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] }), /receipt drift/);
    writeFileSync(join(d, 'synthesis-response.json'), response());
    writeFileSync(join(d, 'edges', 'claims.jsonl'), '{malformed\n');
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], resume: true }), /invalid JSON/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('single-paper rejects a fabricated quote before any local artifact write', async () => {
  const d = dir();
  try {
    writeFileSync(join(d, 'synthesis-response.json'), response('fabricated quote'));
    const result = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] });
    assert.equal(result.claimCount, 0);
    assert.equal(existsSync(join(d, 'edges', 'claims.jsonl')), false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('single-paper rejects missing/mismatched inputs, inactive metrics, foreign citations, diagnostic copy, and dry-run writes', async () => {
  const d = dir();
  try {
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: join(d, 'missing'), pair: ['stool_form', 'urine_colour'] }), /local-dir must exist/);
    writeFileSync(join(d, 'paper.json'), JSON.stringify({ doi: '10.9999/other' }));
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] }), /does not match/);
    writeFileSync(join(d, 'paper.json'), JSON.stringify({ doi: DOI }));
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['not_a_metric', 'urine_colour'] }), /not an active/);
    const foreign = JSON.parse(response()) as { claims: Array<Record<string, unknown>> };
    (foreign.claims[0]!.citations as Array<Record<string, unknown>>)[0]!.paperId = 'foreign-paper';
    writeFileSync(join(d, 'synthesis-response.json'), JSON.stringify(foreign));
    const foreignResult = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], dryRun: true });
    assert.match(JSON.stringify(foreignResult.rejected), /foreign-paper/);
    const diagnostic = JSON.parse(response()) as { claims: Array<Record<string, unknown>> };
    diagnostic.claims[0]!.derivation = 'This diagnoses a condition.';
    writeFileSync(join(d, 'synthesis-response.json'), JSON.stringify(diagnostic));
    const dry = await runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], dryRun: true });
    assert.match(JSON.stringify(dry.rejected), /copy-gate/);
    assert.equal(existsSync(join(d, 'edges')), false);
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'], loadLocalDb: 'postgresql://example.com/db' }), /localhost/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('local directory rejects UNC/device roots and symlinked required/output children', async (t) => {
  await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: '\\\\server\\share', pair: ['stool_form', 'urine_colour'] }), /UNC\/device/);
  await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: '\\\\?\\C:\\unsafe', pair: ['stool_form', 'urine_colour'] }), /UNC\/device/);
  const d = dir(), outside = mkdtempSync(join(tmpdir(), 'ourobion-single-paper-outside-'));
  try {
    writeFileSync(join(d, 'synthesis-response.json'), response());
    try {
      symlinkSync(outside, join(d, 'edges'), 'junction');
      await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] }), /non-symlink directory/);
      rmSync(join(d, 'edges'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      t.diagnostic('directory symlinks unavailable on this Windows host');
    }
    writeFileSync(join(outside, 'paper.json'), JSON.stringify({ doi: DOI }));
    rmSync(join(d, 'paper.json'));
    try { symlinkSync(join(outside, 'paper.json'), join(d, 'paper.json'), 'file'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.diagnostic('file symlinks unavailable on this Windows host'); return; }
      throw error;
    }
    await assert.rejects(() => runSinglePaper({ doi: DOI, localDir: d, pair: ['stool_form', 'urine_colour'] }), /non-symlink/);
  } finally { rmSync(d, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test('--local-dir itself rejects a root symlink/junction when the platform supports links', async (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'ourobion-single-paper-root-link-'));
  const target = dir(), linkedRoot = join(parent, 'linked-root');
  try {
    try { symlinkSync(target, linkedRoot, 'junction'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.diagnostic('root junctions unavailable on this Windows host'); return; }
      throw error;
    }
    await assert.rejects(
      () => runSinglePaper({ doi: DOI, localDir: linkedRoot, pair: ['stool_form', 'urine_colour'] }),
      /local-dir itself must not be a symlink, junction, or reparse link/,
    );
  } finally { rmSync(parent, { recursive: true, force: true }); rmSync(target, { recursive: true, force: true }); }
});
