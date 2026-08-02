import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BRAIN_PIPELINE_METRICS, parseBrainPipelineRequest } from '../src/lib/brainPipelineControl.ts';

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
    authorization_operation_id: '',
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
  const declared = [
    'operation',
    'papers',
    'artifact_revision',
    'authorization_operation_id',
    'dry_run',
    'confirm_spend',
  ];
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

test('accepts a bounded live request with exact RUN and no caller-selected corpus', () => {
  const parsed = parseBrainPipelineRequest({
    ...valid,
    dryRun: false,
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
  ['live wrong confirmation', { ...valid, dryRun: false, confirmSpend: 'run' }, /exact confirmation RUN/],
  ['caller-selected corpus', { ...valid, corpus: '../../secret' }, /unknown field/],
  ['spoofed authorization operation', { ...valid, authorization_operation_id: 'spoof' }, /unknown field/],
  ['dry run confirmation', { ...valid, confirmSpend: 'RUN' }, /must not include/],
] as const) {
  test(`rejects ${name}`, () => {
    const parsed = parseBrainPipelineRequest(body);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, expected);
  });
}

test('route binds workflow authorization to the validated control operation id', async () => {
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(
    new URL('../src/app/(app)/api/brain-pipeline/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /authorization_operation_id:\s*operation\.operationId/);
  assert.doesNotMatch(route, /authorization_operation_id:\s*parsed\.value/);
});
