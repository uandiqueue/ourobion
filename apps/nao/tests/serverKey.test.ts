import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PublishableKeyConfigurationError, resolvePublishableKey } from '../src/lib/serverKey.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..', '..');

test('resolvePublishableKey accepts a named opaque key with legacy variables absent', () => {
  assert.deepEqual(
    resolvePublishableKey({ SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_opaque' }) }),
    { value: 'sb_publishable_opaque', source: 'named' },
  );
});

test('resolvePublishableKey accepts the singular replacement form', () => {
  assert.deepEqual(resolvePublishableKey({ SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_one' }), {
    value: 'sb_publishable_one',
    source: 'singular',
  });
});

test('resolvePublishableKey treats malformed named configuration as fail-closed', () => {
  assert.throws(
    () => resolvePublishableKey({ SUPABASE_PUBLISHABLE_KEYS: 'not-json', SUPABASE_ANON_KEY: 'legacy' }),
    PublishableKeyConfigurationError,
  );
  assert.throws(
    () => resolvePublishableKey({ SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ other: 'sb_publishable_other' }) }),
    PublishableKeyConfigurationError,
  );
});

test('resolvePublishableKey permits legacy fallback only with an explicit exact local CLI URL', () => {
  assert.equal(
    resolvePublishableKey(
      { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon' },
      { allowLegacyLocalCli: true, supabaseUrl: 'http://127.0.0.1:54321' },
    ).source,
    'legacy-local-cli',
  );
  assert.throws(() => resolvePublishableKey({}), PublishableKeyConfigurationError);
});

test('resolvePublishableKey rejects legacy fallback for hosted or URL-confused origins', () => {
  for (const supabaseUrl of [
    undefined,
    'https://project.supabase.co',
    'http://127.0.0.1:54321/functions/v1/run-pipeline',
    'http://127.0.0.1:54321?host=evil.example',
    'http://user:pass@127.0.0.1:54321',
    'http://127.0.0.1:54322',
    'http://localhost.example:54321',
  ]) {
    assert.throws(
      () => resolvePublishableKey(
        { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon' },
        { allowLegacyLocalCli: true, supabaseUrl },
      ),
      PublishableKeyConfigurationError,
      `legacy key unexpectedly accepted for ${String(supabaseUrl)}`,
    );
  }
  assert.throws(
    () => resolvePublishableKey(
      { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon' },
      { supabaseUrl: 'http://127.0.0.1:54321' },
    ),
    PublishableKeyConfigurationError,
  );
});

test('resolvePublishableKey rejects a secret replacement key in either replacement variable', () => {
  assert.throws(
    () => resolvePublishableKey({ SUPABASE_PUBLISHABLE_KEY: 'sb_secret_wrong' }),
    PublishableKeyConfigurationError,
  );
  assert.throws(
    () => resolvePublishableKey({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_secret_wrong' }),
    }),
    PublishableKeyConfigurationError,
  );
});

test('the Nao engine caller sends an opaque publishable key only on apikey', () => {
  const route = readFileSync(
    path.join(appRoot, 'src', 'app', '(app)', 'api', 'loader', 'run-pipeline', 'route.ts'),
    'utf8',
  );
  const relay = route.slice(route.indexOf('// ── relay:begin'), route.indexOf('// ── relay:end'));
  assert.match(relay, /apikey:\s*publishableKey/);
  assert.doesNotMatch(relay, /Authorization\s*:/);
  assert.doesNotMatch(relay, /Bearer \$\{/);
});

test('the local staff operator is pinned to the local Supabase DB container', () => {
  const script = readFileSync(path.join(repoRoot, 'scripts', 'nao-local-staff.ps1'), 'utf8');
  assert.match(script, /\$ContainerName\s*=\s*'supabase_db_ourobion'/);
  assert.match(script, /docker\s+@lookupArgs/);
  assert.match(script, /docker\s+@mutationArgs/);
  assert.doesNotMatch(script, /DatabaseUrl|postgresql:\/\/|Get-Command\s+psql/);
});

test('the changed PowerShell operator scripts parse without executing', { skip: process.platform !== 'win32' }, () => {
  const scripts = ['nao-local-staff.ps1', 'demo-dryrun-run2.ps1', 'seed-test-data.ps1']
    .map((name) => path.join(repoRoot, 'scripts', name).replaceAll("'", "''"));
  const command = scripts
    .map((script) => `[void][scriptblock]::Create((Get-Content -Raw -LiteralPath '${script}'))`)
    .join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the demo legacy service-role bearer is guarded as local Auth-admin bootstrap only', () => {
  const script = readFileSync(path.join(repoRoot, 'scripts', 'demo-dryrun-run2.ps1'), 'utf8');
  assert.match(script, /function Assert-LocalSupabaseApiUrl/);
  assert.match(script, /LOCAL AUTH API BOOTSTRAP ONLY/);
  const adminCall = script.slice(script.indexOf("Invoke-Step 'S6 demo user"), script.indexOf("Invoke-Step 'S7 sign-in"));
  assert.match(adminCall, /Assert-LocalSupabaseApiUrl\s+\$script:ApiUrl/);
  assert.match(adminCall, /\/auth\/v1\/admin\/users/);
  assert.doesNotMatch(adminCall, /\/functions\/v1\//);
});
