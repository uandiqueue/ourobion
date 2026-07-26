import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { verifyDenoMatrix } from './check_supabase_deno_matrix.mjs'

const FUNCTION = '[functions.compute-baselines]\nentrypoint = "./functions/compute-baselines/index.ts"\n'
const WORKFLOW = '  deno-check:\n    strategy:\n      matrix:\n        function:\n          - compute-baselines\n'

function withFixture({ config = FUNCTION, workflow = WORKFLOW, entrypoint = true }, run) {
  const root = mkdtempSync(join(tmpdir(), 'ourobion-deno-matrix-'))
  try {
    const configPath = join(root, 'supabase', 'config.toml')
    const workflowPath = join(root, '.github', 'workflows', 'ci.yml')
    mkdirSync(join(root, 'supabase', 'functions', 'compute-baselines'), { recursive: true })
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    if (entrypoint) writeFileSync(join(root, 'supabase', 'functions', 'compute-baselines', 'index.ts'), '')
    writeFileSync(configPath, config)
    writeFileSync(workflowPath, workflow)
    return run({ repoRoot: root, configPath, workflowPath })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('accepts a configured entrypoint represented in the Deno matrix', () => {
  withFixture({}, (paths) => assert.deepEqual(verifyDenoMatrix(paths), ['compute-baselines']))
})

test('fails when a configured function is absent from the Deno matrix', () => {
  withFixture({ workflow: '  deno-check:\n    strategy:\n      matrix:\n        function:\n          - evaluate-signals\n' }, (paths) => {
    assert.throws(() => verifyDenoMatrix(paths), /missing from Deno matrix: compute-baselines/)
  })
})

test('fails when a configured function entrypoint is absent', () => {
  withFixture({ entrypoint: false }, (paths) => {
    assert.throws(() => verifyDenoMatrix(paths), /Configured Supabase function entrypoint missing/)
  })
})
