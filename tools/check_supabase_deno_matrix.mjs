#!/usr/bin/env node
/** Ensures CI's Deno matrix covers every configured Supabase Edge Function. */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CONFIG_SECTION = /^\[functions\.([A-Za-z0-9_-]+)]\s*$/m
const ENTRYPOINT = /^entrypoint\s*=\s*"([^"]+)"\s*$/m
const DENO_CHECK_JOB = /^  deno-check:\s*\n([\s\S]*?)(?=^  [A-Za-z0-9_-]+:\s*$|(?![\s\S]))/m
const FUNCTION_MATRIX = /^        function:\s*\n((?:          - [A-Za-z0-9_-]+\s*\n)+)/m

function fileText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

export function configuredFunctions(configText) {
  const sections = configText.split(/(?=^\[functions\.)/m).filter((section) => CONFIG_SECTION.test(section))
  return sections.map((section) => {
    const name = section.match(CONFIG_SECTION)?.[1]
    const entrypoint = section.match(ENTRYPOINT)?.[1]
    if (!name || !entrypoint) throw new Error(`Configured function ${name ?? '<unknown>'} has no entrypoint`)
    return { name, entrypoint }
  })
}

export function denoMatrixFunctions(workflowText) {
  const job = workflowText.match(DENO_CHECK_JOB)?.[1]
  if (!job) throw new Error('CI deno-check job was not found')
  const matrix = job.match(FUNCTION_MATRIX)?.[1]
  if (!matrix) throw new Error('CI deno-check function matrix was not found')
  return matrix.match(/^\s{10}- ([A-Za-z0-9_-]+)\s*$/gm)?.map((line) => line.trim().slice(2)) ?? []
}

export function verifyDenoMatrix({ configPath, workflowPath, repoRoot }) {
  const configured = configuredFunctions(fileText(configPath))
  const matrix = denoMatrixFunctions(fileText(workflowPath))
  const missingEntrypoints = configured
    .filter(({ entrypoint }) => !existsSync(resolve(repoRoot, 'supabase', entrypoint.replace(/^\.\//, ''))))
    .map(({ name, entrypoint }) => `${name} (${entrypoint})`)
  if (missingEntrypoints.length) throw new Error(`Configured Supabase function entrypoint missing: ${missingEntrypoints.join(', ')}`)

  const configuredNames = new Set(configured.map(({ name }) => name))
  const matrixNames = new Set(matrix)
  const missingFromMatrix = [...configuredNames].filter((name) => !matrixNames.has(name))
  const extraInMatrix = [...matrixNames].filter((name) => !configuredNames.has(name))
  if (missingFromMatrix.length || extraInMatrix.length || matrixNames.size !== matrix.length) {
    const details = [
      missingFromMatrix.length && `missing from Deno matrix: ${missingFromMatrix.join(', ')}`,
      extraInMatrix.length && `extra in Deno matrix: ${extraInMatrix.join(', ')}`,
      matrixNames.size !== matrix.length && 'Deno matrix contains duplicate function names',
    ].filter(Boolean)
    throw new Error(details.join('; '))
  }
  return configured.map(({ name }) => name)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const names = verifyDenoMatrix({
    repoRoot,
    configPath: resolve(repoRoot, 'supabase/config.toml'),
    workflowPath: resolve(repoRoot, '.github/workflows/ci.yml'),
  })
  console.log(`Deno matrix covers configured functions: ${names.join(', ')}`)
}
