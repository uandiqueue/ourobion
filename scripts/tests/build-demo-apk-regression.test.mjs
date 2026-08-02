#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

const script = read('scripts/build-demo-apk.ps1');
const gradle = read('apps/biotope/android/app/build.gradle.kts');
const mainManifest = read('apps/biotope/android/app/src/main/AndroidManifest.xml');
const docs = [
  read('README.md'),
  read('apps/biotope/README.md'),
  read('docs/shared/hackathon/submission/demo-runbook.md'),
];
const stableAssetUrl =
  'https://github.com/uandiqueue/ourobion/releases/download/biotope-demo-v1/ourobion-biotope-demo.apk';

test('release builder fails closed around hosted config and signing', () => {
  assert.match(script, /\[switch\]\$AcceptDebugSigning/);
  assert.match(script, /\$usesDebugSigning -and -not \$AcceptDebugSigning/);
  assert.match(script, /https:\/\/bewwvcksgpxoomyjavjp\.supabase\.co/);
  assert.match(script, /Refusing to build an APK for localhost or another project/);
  assert.match(script, /git -C \$RepoRoot status --porcelain --untracked-files=normal/);
  assert.match(script, /The Git worktree is dirty/);
  assert.match(gradle, /signingConfigs\.getByName\(\x22debug\x22\)/);
});

test('release networking is declared in main and enforced by preflight', () => {
  assert.match(
    mainManifest,
    /<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>/,
  );
  assert.match(script, /MainManifestPath/);
  assert.match(script, /hasReleaseInternetPermission/);
  assert.match(
    script,
    /Android main manifest must declare android\.permission\.INTERNET/,
  );
});

test('release builder creates and verifies one universal APK', () => {
  assert.match(script, /& flutter build apk --release --no-pub/);
  assert.match(script, /assets\/flutter_assets\/\.env\.public/);
  assert.match(script, /Assert-HostedPublicEnv -Values \$embeddedEnv/);
  assert.match(script, /apksigner verify --verbose --print-certs/);
  assert.match(script, /Get-FileHash -LiteralPath \$ApkPath -Algorithm SHA256/);
  assert.match(script, /source commit/);
});

test('all reviewer entry points carry the stable link and safety notes', () => {
  for (const doc of docs) {
    assert.ok(doc.includes(stableAssetUrl), 'missing stable APK asset URL');
    assert.match(doc, /Install unknown apps/i);
    assert.match(doc, /private reviewer\/submission handoff/i);
    assert.match(doc, /iOS.+out of scope/is);
    assert.match(doc, /same\s+Windows host/i);
  }
});
