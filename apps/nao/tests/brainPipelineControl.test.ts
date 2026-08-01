import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAIN_PIPELINE_CORPORA,
  BRAIN_PIPELINE_METRICS,
  parseBrainPipelineRequest,
} from '../src/lib/brainPipelineControl.ts';

const valid = {
  pair: ['sleep_duration_min', 'resting_hr_bpm'],
  papers: ['doi:10.1016/j.isci.2026.116224'],
  artifactRevision: 'edges-2026-08-01.1',
};

test('uses the active shared metric registry and defaults omitted dryRun to true', () => {
  assert.ok(BRAIN_PIPELINE_METRICS.some((metric) => metric.key === 'sleep_duration_min'));
  const parsed = parseBrainPipelineRequest(valid);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.dryRun, true);
  assert.deepEqual(parsed.workflowInputs, {
    operation: 'full',
    papers: 'doi:10.1016/j.isci.2026.116224',
    artifact_revision: 'edges-2026-08-01.1',
    corpus: '',
    dry_run: true,
    confirm_spend: '',
  });
});

// GitHub validates workflow_dispatch inputs against the workflow's declared
// `on.workflow_dispatch.inputs` and 422s the whole call for an undeclared name
// or a missing required one. These two assertions are the contract with
// .github/workflows/brain-pipeline.yml, which declares `operation` required and
// declares no `pair`.
test('sends every declared workflow input and nothing the workflow does not declare', () => {
  const parsed = parseBrainPipelineRequest(valid);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const declared = ['operation', 'papers', 'artifact_revision', 'corpus', 'dry_run', 'confirm_spend'];
  assert.deepEqual(Object.keys(parsed.workflowInputs).sort(), [...declared].sort());
  assert.equal('pair' in parsed.workflowInputs, false);
  // The metric pair is still parsed and still reaches the control-audit detail.
  assert.deepEqual(parsed.value.pair, ['sleep_duration_min', 'resting_hr_bpm']);
});

test('the workflow file declares every input dispatched, and marks operation required', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  // Checked out CRLF on Windows; normalise so the anchored matches below hold.
  const yaml = readFileSync(path.join(repoRoot, '.github/workflows/brain-pipeline.yml'), 'utf8')
    .replace(/\r\n/g, '\n');
  const inputsBlock = yaml.slice(yaml.indexOf('workflow_dispatch:'), yaml.indexOf('\nconcurrency:'));
  const declared = new Set([...inputsBlock.matchAll(/^ {6}([a-z0-9_]+):$/gm)].map((m) => m[1]));
  const parsed = parseBrainPipelineRequest(valid);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  for (const key of Object.keys(parsed.workflowInputs)) {
    assert.equal(declared.has(key), true, `brain-pipeline.yml does not declare input '${key}'`);
  }
  assert.match(inputsBlock, /operation:\s*\n\s*description:[^\n]*\n\s*required: true/);
});

test('accepts a bounded live request only with an approved corpus and exact RUN', () => {
  const parsed = parseBrainPipelineRequest({
    ...valid,
    dryRun: false,
    corpus: BRAIN_PIPELINE_CORPORA[0],
    confirmSpend: 'RUN',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.workflowInputs.dry_run, false);
  assert.equal(parsed.workflowInputs.confirm_spend, 'RUN');
});

for (const [name, body, expected] of [
  ['missing revision', { ...valid, artifactRevision: '' }, /artifactRevision is required/],
  ['unknown field', { ...valid, provider: 'anthropic' }, /unknown field/],
  ['same metric twice', { ...valid, pair: ['sleep_duration_min', 'sleep_duration_min'] }, /different/],
  ['inactive metric', { ...valid, pair: ['sleep_duration_min', 'not_a_metric'] }, /active registry/],
  ['duplicate paper', { ...valid, papers: ['pmid:1', 'pmid:1'] }, /duplicate/],
  ['too many papers', { ...valid, papers: Array.from({ length: 21 }, (_, i) => `pmid:${i}`) }, /1 and 20/],
  ['live without corpus', { ...valid, dryRun: false, confirmSpend: 'RUN' }, /non-empty approved corpus/],
  ['live wrong confirmation', { ...valid, dryRun: false, corpus: BRAIN_PIPELINE_CORPORA[0], confirmSpend: 'run' }, /exact confirmation RUN/],
  ['arbitrary corpus', { ...valid, dryRun: false, corpus: '../../secret', confirmSpend: 'RUN' }, /approved repository corpus/],
  ['dry run confirmation', { ...valid, confirmSpend: 'RUN' }, /must not include/],
] as const) {
  test(`rejects ${name}`, () => {
    const parsed = parseBrainPipelineRequest(body);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, expected);
  });
}
