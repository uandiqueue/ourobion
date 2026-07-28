import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import {
  RUN4_UNIT_BASE_SHA,
  RUN4_FUNCTIONS,
  RUN4_MAX_ADDED_LINES,
  RUN4_MAX_ALLOWLISTED_BINARY_BYTES,
  RUN4_MAX_ALLOWLISTED_BINARY_PATHS,
  RUN4_MAX_CHANGED_PATHS,
  RUN4_NODE_TOOL_DRIFT_PACKAGES,
  RUN4_NODE_TOOL_PACKAGES,
  RUN4_REQUIRED_JOBS,
  buildLocalAttestation,
  checkAggregateNeeds,
  checkDeployAttestation,
  checkLandingDelta,
  checkWorkflowProvenance,
  collectCurrentFunctionEvidence,
  hashModuleGraph,
  hashTextEvidence,
  parseFunctionConfig,
  validateFunctionConfig,
  validateRun4Workflow,
} from './run4_release_gate.mjs';

const denoConfig = JSON.stringify({ lock: { path: '../../deno.lock', frozen: true }, imports: {} });
const functionConfig = (mutate = (name, values) => values) => RUN4_FUNCTIONS.map((name) => {
  const values = mutate(name, {
    enabled: true,
    entrypoint: `./functions/${name}/index.ts`,
    importMap: `./functions/${name}/deno.json`,
  });
  return `[functions.${name}]\nenabled = ${values.enabled}\nentrypoint = "${values.entrypoint}"\nimport_map = "${values.importMap}"`;
}).join('\n\n');

const denoWorkflow = (items = RUN4_FUNCTIONS, command = 'deno check --config deno.json --lock ../../deno.lock --frozen index.ts') => `name: Test
on: [push]
jobs:
  deno-check:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        function:
${items.map((name) => `          - ${name}`).join('\n')}
    steps:
      - uses: actions/checkout@v4
      - name: Set up Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.8.1
      - name: Type check handler
        working-directory: supabase/functions/\${{ matrix.function }}
        run: ${command}
`;

const fakeFiles = {
  fileExists: () => true,
  readText: () => denoConfig,
  repoRoot: resolve('C:/repo-fixture'),
};

test('real TOML parser accepts quoted dotted names and rejects redefinitions', () => {
  const parsed = parseFunctionConfig("[functions.'alpha.beta'] # legal TOML\nenabled = true # comment\nimport_map = './functions/alpha.beta/deno.json'\nentrypoint = './functions/alpha.beta/index.ts'");
  assert.equal(parsed[0].name, 'alpha.beta');
  assert.throws(() => parseFunctionConfig('[functions.a]\nenabled=true\nentrypoint="a"\nimport_map="a"\n[functions.a]\nenabled=true\nentrypoint="a"\nimport_map="a"'), /invalid TOML/);
  assert.throws(() => parseFunctionConfig('[functions."broken]\nenabled=true\nentrypoint="x"\nimport_map="x"'), /invalid TOML/);
});

test('requires exact enabled four-function mappings and frozen Deno config', () => {
  assert.equal(validateFunctionConfig(functionConfig(), denoWorkflow(), fakeFiles).length, 4);
  assert.throws(() => validateFunctionConfig(functionConfig((name, values) => name === 'compute-baselines' ? { ...values, enabled: false } : values), denoWorkflow(RUN4_FUNCTIONS.slice(1)), fakeFiles), /explicitly enabled/);
  assert.throws(() => validateFunctionConfig(functionConfig((name, values) => name === 'compute-baselines' ? { ...values, entrypoint: './functions/evaluate-signals/index.ts' } : values), denoWorkflow(), fakeFiles), /entrypoint must be exactly/);
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow(), { ...fakeFiles, readText: () => JSON.stringify({ lock: { path: '../../wrong.lock', frozen: true } }) }), /deno\.json must use exactly/);
  for (const duplicate of [
    '{"lock":{"path":"../../deno.lock","frozen":true},"lock":{"path":"../../deno.lock","frozen":true}}',
    '{"lock":{"path":"../../deno.lock","path":"../../deno.lock","frozen":true}}',
    '{"lock":{"path":"../../deno.lock","frozen":true,"frozen":true}}',
  ]) assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow(), { ...fakeFiles, readText: () => duplicate }), /invalid deno\.json/);
});

test('parsed YAML matrix and command reject omissions, extras, duplicates, and no-op text', () => {
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow(RUN4_FUNCTIONS.slice(0, 3)), fakeFiles), /matrix.*mismatch/);
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow([...RUN4_FUNCTIONS, 'extra']), fakeFiles), /matrix.*mismatch/);
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow([...RUN4_FUNCTIONS, RUN4_FUNCTIONS[0]]), fakeFiles), /duplicates/);
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow(RUN4_FUNCTIONS, 'echo deno check --config deno.json --lock ../../deno.lock --frozen index.ts'), fakeFiles), /command is not the exact/);
  assert.throws(() => validateFunctionConfig(functionConfig(), denoWorkflow().replace('  deno-check:', '  deno-check:\n    continue-on-error: true'), fakeFiles), /continue-on-error/);
});

test('actual Run 4 workflow has exact aggregate structure and executable gates', () => {
  const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
  assert.doesNotThrow(() => validateRun4Workflow(workflow));
  assert.throws(() => validateRun4Workflow(workflow.replace('needs: [context, ', 'needs: [')), /needs.*mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace(', model-training-core, model-training-lint-type]', ']')), /needs.*mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace('node tools/run4_release_gate.mjs aggregate', 'echo node tools/run4_release_gate.mjs aggregate')), /runtime assertion drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace('      - name: Fail unless every required dependency succeeded', '      - name: Fail unless every required dependency succeeded\n        if: ${{ 1 == 0 }}')), /cannot set if/);
  assert.throws(() => validateRun4Workflow(workflow.replace('      - name: Recompute frozen graphs and verify local-only runtime attestation', '      - name: Recompute frozen graphs and verify local-only runtime attestation\n        continue-on-error: ${{ true }}')), /cannot set continue-on-error/);
  assert.throws(() => validateRun4Workflow(workflow.replace('run: node tools/context_sync.mjs --check', 'run: echo node tools/context_sync.mjs --check')), /context step Context check command drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace('run: flutter test', 'run: echo flutter test')), /flutter step Test command drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace('run: python -m unittest discover -s tests -v', 'run: echo python -m unittest discover -s tests -v')), /model-training-core step Unit tests.*command drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace('run: ruff check .', 'run: echo ruff check .')), /model-training-lint-type step Lint command drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace("python-version: '3.10'", "python-version: '3.11'")), /model-training-core must use exact Python 3\.10 setup/);
  assert.throws(() => validateRun4Workflow(workflow.replace('      - name: Apply migrations in filename order', '      - name: Apply migrations in filename order\n        continue-on-error: ${{ true }}')), /cannot set continue-on-error/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/          - tools\/brain-ingest\r?\n/, '')), /node-tools package matrix mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/          - tools\/metric-view\r?\n/, '          - tools/not-a-package\n')), /node-tools package matrix mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/          - tools\/metric-view\r?\n/, '          - tools/metric-view\n          - tools/metric-view\n')), /node-tools package matrix contains duplicates/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/          - package: tools\/rules\r?\n            drift_check: true\r?\n/, '')), /node-tools drift include set mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/(      - name: Test\r?\n        working-directory: apps\/biotope)/, '$1\n        shell: true {0}')), /flutter step Test cannot set shell/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/      - name: Context check\r?\n        run: node tools\/context_sync\.mjs --check/, '      - name: Context check\n        run: node tools/context_sync.mjs --check\n      - name: Unapproved context no-op\n        run: echo pass')), /context approved step set mismatch/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/      - name: Test\r?\n        working-directory: apps\/nao/, '      - name: Test\n        working-directory: tools/rules')), /nao step Test working-directory drifted/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/name: CI\r?\n/, 'name: CI\ndefaults:\n  run:\n    shell: true {0}\n')), /workflow cannot set defaults/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/  context:\r?\n/, '  context:\n    defaults:\n      run:\n        working-directory: tools/rules\n')), /context job cannot set defaults/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/(  model-training-core:[\s\S]*?working-directory: )model-training/, '$1tools/rules')), /model-training-core job defaults must use only model-training/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/name: CI\r?\n/, 'name: CI\nenv:\n  NODE_OPTIONS: --require ./evil.cjs\n')), /workflow env cannot set NODE_OPTIONS/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/  context:\r?\n/, '  context:\n    env:\n      BASH_ENV: ./evil.sh\n')), /context job env cannot set BASH_ENV/);
  assert.throws(() => validateRun4Workflow(workflow.replace(/(  run4-release:[\s\S]*?    runs-on: )ubuntu-latest/, '$1self-hosted')), /run4-release must run on exact ubuntu-latest/);
  assert.deepEqual([...RUN4_NODE_TOOL_PACKAGES].length, 6);
  assert.deepEqual([...RUN4_NODE_TOOL_DRIFT_PACKAGES].length, 2);
});

test('runtime aggregate requires the exact ten successful dependencies', () => {
  const good = Object.fromEntries(RUN4_REQUIRED_JOBS.map((name) => [name, { result: 'success' }]));
  assert.equal(Object.keys(checkAggregateNeeds(JSON.stringify(good))).length, 10);
  const missing = { ...good }; delete missing.context;
  assert.throws(() => checkAggregateNeeds(JSON.stringify(missing)), /runtime needs.*mismatch/);
  const collision = { ...good }; delete collision.context; delete collision['deno-check']; collision['context|deno-check'] = { result: 'success' };
  assert.throws(() => checkAggregateNeeds(JSON.stringify(collision)), /runtime needs.*mismatch/);
  assert.throws(() => checkAggregateNeeds(JSON.stringify({ ...good, context: { result: 'skipped' } })), /not successful/);
  assert.throws(() => checkAggregateNeeds(JSON.stringify({ ...good, 'model-training-core': { result: 'failure' } })), /model-training-core=failure/);
  assert.throws(() => checkAggregateNeeds(JSON.stringify({ ...good, 'model-training-lint-type': { result: 'skipped' } })), /model-training-lint-type=skipped/);
});

test('landing delta fixes accepted constants and rejects shallow, rename, binary, and overflow input', () => {
  const head = 'b'.repeat(40);
  const mock = (responses) => (_command, args) => `${responses[args.join(' ')] ?? responses[args[0]] ?? ''}`;
  const common = {
    'rev-parse --is-shallow-repository': 'false\n',
    [`cat-file -t ${RUN4_UNIT_BASE_SHA}`]: 'commit\n',
    'rev-parse HEAD': `${head}\n`,
    [`merge-base ${RUN4_UNIT_BASE_SHA} ${head}`]: `${RUN4_UNIT_BASE_SHA}\n`,
  };
  assert.throws(() => checkLandingDelta({ base: 'a'.repeat(40), maxPaths: RUN4_MAX_CHANGED_PATHS, maxAdded: RUN4_MAX_ADDED_LINES, git: mock(common) }), /accepted current unit SHA/);
  assert.throws(() => checkLandingDelta({ base: RUN4_UNIT_BASE_SHA, maxPaths: RUN4_MAX_CHANGED_PATHS, maxAdded: RUN4_MAX_ADDED_LINES, git: mock({ ...common, 'rev-parse --is-shallow-repository': 'true\n' }) }), /shallow/);
  assert.throws(() => checkLandingDelta({ base: RUN4_UNIT_BASE_SHA, maxPaths: RUN4_MAX_CHANGED_PATHS, maxAdded: RUN4_MAX_ADDED_LINES, git: mock({ ...common, [`diff --name-status -z --find-renames ${RUN4_UNIT_BASE_SHA}..${head}`]: 'R100\0old\0new\0' }) }), /rename\/copy/);
  assert.throws(() => checkLandingDelta({ base: RUN4_UNIT_BASE_SHA, maxPaths: RUN4_MAX_CHANGED_PATHS, maxAdded: RUN4_MAX_ADDED_LINES, git: mock({ ...common, [`diff --name-status -z --find-renames ${RUN4_UNIT_BASE_SHA}..${head}`]: 'M\0asset.bin\0', [`diff --numstat -z ${RUN4_UNIT_BASE_SHA}..${head}`]: '-\t-\tasset.bin\0' }) }), /binary\/unparsable/);
});

test('landing delta allowlisted-binary exception passes allowlisted paths at zero added lines, treats a deleted blob as zero bytes, enforces its own path/byte caps, and leaves text-diff behavior unchanged', () => {
  const head = 'b'.repeat(40);
  const common = {
    'rev-parse --is-shallow-repository': 'false\n',
    [`cat-file -t ${RUN4_UNIT_BASE_SHA}`]: 'commit\n',
    'rev-parse HEAD': `${head}\n`,
    [`merge-base ${RUN4_UNIT_BASE_SHA} ${head}`]: `${RUN4_UNIT_BASE_SHA}\n`,
  };
  // Unlike the plain `mock` above, this one can also throw — needed to simulate `git cat-file -s`
  // failing for a path with no blob at head (e.g. a deletion), the same way real git would.
  const mockGit = (responses) => (_command, args) => {
    const key = args.join(' ');
    const value = key in responses ? responses[key] : responses[args[0]];
    if (value instanceof Error) throw value;
    return `${value ?? ''}`;
  };
  const run = (nameStatusRows, numstatRows, extra = {}) => checkLandingDelta({
    base: RUN4_UNIT_BASE_SHA,
    maxPaths: RUN4_MAX_CHANGED_PATHS,
    maxAdded: RUN4_MAX_ADDED_LINES,
    git: mockGit({
      ...common,
      [`diff --name-status -z --find-renames ${RUN4_UNIT_BASE_SHA}..${head}`]: nameStatusRows,
      [`diff --numstat -z ${RUN4_UNIT_BASE_SHA}..${head}`]: numstatRows,
      ...extra,
    }),
  });

  // Existing text-diff behavior is unchanged: no binary rows involved, allowlisted counters stay zero.
  assert.deepEqual(run('M\0src/file.ts\0', '5\t2\tsrc/file.ts\0'), { base: RUN4_UNIT_BASE_SHA, head, changedPaths: 1, addedLines: 5, allowlistedBinaryPaths: 0, allowlistedBinaryBytes: 0 });

  // An allowlisted binary row (directory-prefix match) passes, contributes 0 added lines, and its blob
  // size at head is measured and reported.
  const assetPath = 'assets/ourobion-nao-logo/logo/png/nao-mark-dark-256.png';
  assert.deepEqual(
    run(`A\0${assetPath}\0`, `-\t-\t${assetPath}\0`, { [`cat-file -s ${head}:${assetPath}`]: '1234\n' }),
    { base: RUN4_UNIT_BASE_SHA, head, changedPaths: 1, addedLines: 0, allowlistedBinaryPaths: 1, allowlistedBinaryBytes: 1234 },
  );

  // A deleted allowlisted binary path (exact-path match) has no blob at head, so it measures 0 bytes.
  // That conclusion is drawn from the 'D' name-status letter, NOT from `cat-file -s` failing: the mock
  // below throws for the missing object exactly as real git would, and the gate must never need to ask.
  const deletedPath = 'apps/nao/src/app/icon.png';
  assert.deepEqual(
    run(`D\0${deletedPath}\0`, `-\t-\t${deletedPath}\0`, { [`cat-file -s ${head}:${deletedPath}`]: new Error(`fatal: path '${deletedPath}' does not exist in '${head}'`) }),
    { base: RUN4_UNIT_BASE_SHA, head, changedPaths: 1, addedLines: 0, allowlistedBinaryPaths: 1, allowlistedBinaryBytes: 0 },
  );

  // The inverse, and the reason the deletion case keys off name-status: a path that is ADDED (not
  // deleted) but whose `cat-file -s` fails is a genuinely unmeasured blob. It must fail closed rather
  // than be silently counted as 0 bytes, which would let arbitrarily large binary content past the
  // byte cap on any transient git error.
  const unmeasurablePath = 'apps/nao/public/brand/unmeasurable.png';
  assert.throws(
    () => run(`A\0${unmeasurablePath}\0`, `-\t-\t${unmeasurablePath}\0`, { [`cat-file -s ${head}:${unmeasurablePath}`]: new Error('fatal: git failed') }),
    /git failed/,
  );

  // Exceeding the allowlisted-binary PATH count fails even though every path is individually
  // allowlisted and the total byte size stays far under the byte cap.
  const manyPaths = Array.from({ length: RUN4_MAX_ALLOWLISTED_BINARY_PATHS + 1 }, (_, index) => `apps/nao/public/brand/asset-${index}.png`);
  const manyExtra = Object.fromEntries(manyPaths.map((path) => [`cat-file -s ${head}:${path}`, '10\n']));
  assert.throws(
    () => run(manyPaths.map((path) => `A\0${path}\0`).join(''), manyPaths.map((path) => `-\t-\t${path}\0`).join(''), manyExtra),
    /allowlisted binary paths/,
  );

  // Exceeding the allowlisted-binary BYTE cap fails even with only two allowlisted paths.
  const bigPathA = 'apps/nao/public/brand/big-a.png';
  const bigPathB = 'apps/nao/public/brand/big-b.png';
  assert.throws(
    () => run(
      `A\0${bigPathA}\0A\0${bigPathB}\0`,
      `-\t-\t${bigPathA}\0-\t-\t${bigPathB}\0`,
      { [`cat-file -s ${head}:${bigPathA}`]: `${RUN4_MAX_ALLOWLISTED_BINARY_BYTES}\n`, [`cat-file -s ${head}:${bigPathB}`]: '2\n' },
    ),
    /allowlisted binary bytes/,
  );
});

test('workflow provenance binds exact Run 4 PR merge parents and rejects shallow checkout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run4-event-'));
  try {
    const landing = 'c'.repeat(40);
    const base = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const eventPath = join(dir, 'event.json');
    writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { ref: 'dev-phase2-run4', sha: base }, head: { sha: head } } }));
    const git = (_command, args) => {
      if (args.join(' ') === 'rev-parse --is-shallow-repository') return 'false\n';
      return `${args[0] === 'rev-parse' ? landing : `${landing} ${base} ${head}`}\n`;
    };
    assert.deepEqual(checkWorkflowProvenance({ eventPath, githubSha: landing, git }), { event: 'pull_request', landingSha: landing, baseSha: base, headSha: head });
    const shallowGit = (_command, args) => args.join(' ') === 'rev-parse --is-shallow-repository' ? 'true\n' : '';
    assert.throws(() => checkWorkflowProvenance({ eventPath, githubSha: landing, git: shallowGit }), /shallow/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('module graph hash ignores cache paths but binds local source bytes and dependency edges', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run4-graph-'));
  try {
    const source = join(dir, 'source.ts');
    writeFileSync(source, 'export const value = 1;\n');
    const graph = { modules: [
      { specifier: pathToFileURL(source).href, local: '/cache/a', dependencies: [{ code: { specifier: 'https://example.test/mod.ts' } }] },
      { specifier: 'https://example.test/mod.ts', local: '/cache/b', dependencies: [] },
    ] };
    const first = hashModuleGraph(JSON.stringify(graph), { repoRoot: dir });
    graph.modules[0].local = '/different/cache';
    assert.equal(hashModuleGraph(JSON.stringify(graph), { repoRoot: dir }), first);
    assert.equal(hashTextEvidence('line one\r\nline two\r\n'), hashTextEvidence('line one\nline two\n'));
    writeFileSync(source, 'export const value = 1;\r\n');
    assert.equal(hashModuleGraph(JSON.stringify(graph), { repoRoot: dir }), first);
    writeFileSync(source, 'export const value = 2;\n');
    assert.notEqual(hashModuleGraph(JSON.stringify(graph), { repoRoot: dir }), first);
    writeFileSync(source, 'export const value = 1;\n');
    graph.modules[0].dependencies.push({ type: { specifier: 'https://example.test/types.d.ts' } });
    assert.notEqual(hashModuleGraph(JSON.stringify(graph), { repoRoot: dir }), first);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('local-only attestation generator and verifier reject provenance, source, graph, route, and probe drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run4-attestation-'));
  try {
    const graphDir = join(dir, 'graphs');
    mkdirSync(graphDir);
    const routes = RUN4_FUNCTIONS.map((name) => ({
      name,
      path: `/functions/v1/${name}`,
      handlerReached: true,
      httpStatus: 401,
      bodySha256: 'a'.repeat(64),
    }));
    for (const name of RUN4_FUNCTIONS) {
      const entrypoint = resolve('supabase', 'functions', name, 'index.ts');
      writeFileSync(join(graphDir, `${name}.json`), JSON.stringify({ modules: [{ specifier: pathToFileURL(entrypoint).href, dependencies: [] }] }));
    }
    const run = () => '2.81.2\n';
    const manifest = buildLocalAttestation({ graphDir, supabaseCli: 'supabase', routes, run });
    const manifestPath = join(dir, 'manifest.json');
    const verify = (change, message) => {
      const altered = structuredClone(manifest);
      change(altered);
      writeFileSync(manifestPath, JSON.stringify(altered));
      assert.throws(() => checkDeployAttestation({ manifestPath, graphDir, supabaseCli: 'supabase', run }), message);
    };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.doesNotThrow(() => checkDeployAttestation({ manifestPath, graphDir, supabaseCli: 'supabase', run }));
    verify((value) => { value.cliVersion = '2.81.1'; }, /tool versions drifted/);
    verify((value) => { value.hostedDeployParityClaimed = true; }, /explicitly deny hosted deploy parity/);
    verify((value) => { value.configSha256 = 'b'.repeat(64); }, /config\/lock hash mismatch/);
    verify((value) => { value.lockSha256 = 'b'.repeat(64); }, /config\/lock hash mismatch/);
    verify((value) => { value.functions[0].entrypointSha256 = 'b'.repeat(64); }, /source\/config drift/);
    verify((value) => { value.functions[0].importMapSha256 = 'b'.repeat(64); }, /source\/config drift/);
    verify((value) => { value.functions[0].moduleGraphSha256 = 'b'.repeat(64); }, /module graph drift/);
    verify((value) => { value.serveProbe.routes.pop(); }, /route set/);
    verify((value) => { value.serveProbe.routes.push(structuredClone(value.serveProbe.routes[0])); }, /duplicates/);
    verify((value) => { value.serveProbe.command = 'supabase functions deploy'; }, /normalized local serve evidence/);
    verify((value) => { value.provenance.unitBaseSha = 'b'.repeat(40); }, /provenance drifted/);
    assert.deepEqual(collectCurrentFunctionEvidence(graphDir).functions.map((item) => item.name).sort(), [...RUN4_FUNCTIONS].sort());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
