import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function parseLineCommentJson(relativePath: string): Record<string, unknown> {
  const json = read(relativePath)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  return JSON.parse(json) as Record<string, unknown>;
}

function dotenvKeys(relativePath: string): string[] {
  return read(relativePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim());
}

test('production Worker config declares exact runtime values and native data bindings', () => {
  const config = parseLineCommentJson('wrangler.jsonc') as {
    compatibility_date?: string;
    compatibility_flags?: string[];
    secrets?: { required?: string[] };
    vars?: Record<string, string>;
    r2_buckets?: Array<{ binding?: string }>;
    d1_databases?: Array<{ binding?: string }>;
  };

  assert.equal(config.compatibility_date, '2024-12-01');
  assert.deepEqual(
    config.compatibility_flags,
    ['nodejs_compat', 'nodejs_compat_populate_process_env'],
    'the preserved pre-2025-04-01 date needs an explicit flag so Worker text bindings populate process.env',
  );
  assert.deepEqual(config.secrets?.required, [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'OUROBION_INTERNAL_SECRET',
    'GH_ACTIONS_TOKEN',
  ]);
  assert.deepEqual(config.vars, {
    GH_REPO: 'uandiqueue/ourobion',
    GH_ACTIONS_REF: 'dev-phase2-run4',
  });
  assert.deepEqual(config.r2_buckets?.map(({ binding }) => binding), ['CORPUS']);
  assert.deepEqual(config.d1_databases?.map(({ binding }) => binding), ['DB']);
});

test('build-time public values stay separate from Worker runtime values', () => {
  assert.deepEqual(dotenvKeys('.env.public.example'), [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_ENV',
  ]);

  const serverTemplate = read('.env.example');
  assert.doesNotMatch(serverTemplate, /SUPABASE_SERVICE_ROLE_KEY/);
  const serverKeys = dotenvKeys('.env.example');
  for (const key of ['SUPABASE_PUBLISHABLE_KEY', 'OUROBION_INTERNAL_SECRET', 'GH_ACTIONS_TOKEN']) {
    assert.ok(serverKeys.includes(key), `${key} must be projected into local Worker runtime config`);
  }
});

test('CloudflareEnv types cover the configured Worker contract', () => {
  const declarations = read('env.d.ts');
  for (const name of [
    'CORPUS',
    'DB',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'OUROBION_INTERNAL_SECRET',
    'GH_ACTIONS_TOKEN',
    'GH_REPO',
    'GH_ACTIONS_REF',
  ]) {
    assert.match(declarations, new RegExp(`\\b${name}\\??: `), `${name} must be typed`);
  }
});

test('Next output tracing is pinned exactly to apps/nao', () => {
  const source = read('next.config.mjs');
  assert.equal(source.match(/outputFileTracingRoot\s*:/g)?.length, 1);
  assert.match(source, /outputFileTracingRoot:\s*import\.meta\.dirname/);
  assert.notEqual(appRoot, path.resolve(appRoot, '..', '..'));
});
