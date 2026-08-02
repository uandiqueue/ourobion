import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/brain-pipeline.yml', import.meta.url), 'utf8');

test('brain pipeline project-only mode cannot reach synthesis or verification', () => {
  assert.match(workflow, /operation:\s*[\s\S]*type: choice[\s\S]*project-only/);
  assert.match(workflow, /- name: Synthesis\s*\n\s*if: inputs\.operation == 'full'/);
  assert.match(workflow, /- name: Verification\s*\n\s*if: inputs\.operation == 'full'/);
  assert.match(workflow, /- name: Hydrate local corpus manifest from R2\s*\n\s*if: inputs\.operation == 'full'/);
  assert.match(workflow, /Project-only: provider stages are unreachable/);
});

test('full workflow uses only the post-300 whole-paper synthesis command', () => {
  assert.match(workflow, /ARGS=\(synthesize-papers --paper "\$PAPERS"\)/);
  assert.doesNotMatch(workflow, /ARGS=\(synthesize --pair/);
  assert.doesNotMatch(workflow, /--no-blueprints/);
  assert.doesNotMatch(workflow, /inputs\.pair/);
});

test('project-only projection is exact-hash pinned and incremental', () => {
  assert.match(workflow, /check-r2-edge-artifacts/);
  assert.match(workflow, /expected_blueprints_sha256/);
  assert.match(workflow, /OUROBION_EXPECTED_CLAIMS_SHA256/);
  assert.match(workflow, /OUROBION_EXPECTED_VERIFICATIONS_SHA256/);
  assert.match(workflow, /ARGS=\(--from-dir "\$RUNNER_TEMP\/brain-edge-bundle" --no-prune\)/);
  assert.match(workflow, /confirm_projection=PROJECT/);
  assert.match(workflow, /check-r2-edge-artifacts[\s\S]*--out-dir "\$RUNNER_TEMP\/brain-edge-bundle"/);
});

test('project-only .env contains storage configuration but no provider credentials', () => {
  const block = /- name: Write R2 \.env from secrets([\s\S]*?)(?=\n\s*- name:)/.exec(workflow)?.[1];
  assert.ok(block);
  assert.match(block, /R2_ENDPOINT/);
  assert.doesNotMatch(block, /OPENAI_API_KEY|ANTHROPIC_API_KEY|AGNES_API_KEY/);
});

test('provider credentials are scoped to full-operation steps', () => {
  const checkBlock = /- name: Check router config \(decorrelation \+ keys\)([\s\S]*?)(?=\n\s*- name:)/.exec(workflow)?.[1];
  assert.ok(checkBlock);
  assert.match(checkBlock, /if: inputs\.operation == 'full'/);
  assert.match(checkBlock, /OPENAI_API_KEY|ANTHROPIC_API_KEY|AGNES_API_KEY/);
});

test('live verifier builds a real corpus and excludes every cited paper id', () => {
  assert.match(workflow, /- name: Build echo-controlled verifier corpus/);
  assert.match(workflow, /build-verify-corpus[\s\\]*\n[\s\S]*--exclude-claims \.\.\/\.\.\/data\/corpus\/edges\/claims\.jsonl/);
  assert.match(workflow, /--corpus \.\.\/\.\.\/data\/corpus\/verify-corpus-workflow\.jsonl/);
  assert.doesNotMatch(workflow, /--exclude-claims data\/corpus\/edges\/claims\.jsonl/);
  assert.doesNotMatch(workflow, /--corpus data\/corpus\/verify-corpus-workflow\.jsonl/);
  assert.doesNotMatch(workflow, /tools\/brain-ingest\/fixtures\/verify-corpus\.jsonl/);
  assert.doesNotMatch(workflow, /^\s{6}corpus:$/m);
});

test('Agnes dispatch remains acceptance-only with a finite owner-audited authorization', () => {
  assert.match(workflow, /^\s{6}authorization_operation_id:$/m);
  assert.match(workflow, /requires nao's audited authorization_operation_id UUID/);
  assert.match(workflow, /AGNES_MAX_POST_STARTS="\$\(\(PAPER_COUNT \* 60\)\)"/);
  assert.match(workflow, /anthropic: \{maxPostStarts: 0, maxReservedUsd: 0/);
  assert.match(workflow, /openai: \{maxPostStarts: 0, maxReservedUsd: 0/);
  assert.match(workflow, /agnes: \{maxPostStarts: \$agnesMaxPostStarts, maxReservedUsd: 0/);
  assert.match(workflow, /--acceptance-authorization "\$ACCEPTANCE_AUTHORIZATION_FILE"/);
  assert.match(workflow, /--acceptance-run-id "\$ACCEPTANCE_RUN_ID"/);
});

test('live spend requires a fresh completed nao audit lifecycle, not only a UUID shape', () => {
  const gate = workflow.indexOf('- name: Validate completed nao authorization');
  const router = workflow.indexOf('- name: Check router config (decorrelation + keys)');
  const synthesis = workflow.indexOf('- name: Synthesis');
  assert.ok(gate > 0 && gate < router && router < synthesis);
  assert.match(workflow, /validate_nao_authorization\.mjs/);
  assert.match(workflow, /--operation-id \$AUTHORIZATION_OPERATION_ID/);
  assert.match(workflow, /--artifact-revision \$REVISION/);
  assert.match(workflow, /--paper-count \$\{#PAPER_LIST\[@\]\}/);
});

test('one validated artifact snapshot drives edge, rule, and card projections in order', () => {
  const materialize = workflow.indexOf('- name: Materialize current validated R2 artifact bundle');
  const edgeLoad = workflow.indexOf('- name: Edge load (projection)');
  const ruleLoad = workflow.indexOf('- name: Verified rule load (projection)');
  const cards = workflow.indexOf('- name: Regenerate hosted insight cards');
  assert.ok(materialize > 0 && materialize < edgeLoad && edgeLoad < ruleLoad && ruleLoad < cards);
  assert.match(workflow, /load_edges\.mjs --from-dir "\$RUNNER_TEMP\/brain-edge-bundle"/);
  assert.match(workflow, /load_rules\.mjs "\$\{ARGS\[@\]\}"/);
  assert.match(workflow, /ARGS=\(--from-edges-dir "\$RUNNER_TEMP\/brain-edge-bundle"\)/);
  assert.match(workflow, /functions\/v1\/run-pipeline/);
  assert.match(workflow, /X-Ourobion-Internal-Secret/);
  assert.match(workflow, /all\(\.stages\[\]; \.ok == true\)/);
});

test('workflow retains a human-attributed acceptance run record', () => {
  assert.match(workflow, /authorized by nao curator control event \$\{AUTHORIZATION_OPERATION_ID\}/);
  assert.match(workflow, /dispatched by GitHub actor \$\{GITHUB_ACTOR\}/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /attempts\.jsonl/);
});
