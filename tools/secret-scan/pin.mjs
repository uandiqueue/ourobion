#!/usr/bin/env node
// tools/secret-scan/pin.mjs
//
// O36 fail-closed secret-scanning guard — pin resolver.
//
// Reads tools/secret-scan/pins.json (the single source of truth for the pinned gitleaks
// release), strictly validates its shape, derives the $RUNNER_TEMP-rooted working paths the
// rest of the secret-scan CI job needs, and writes them into the file named by $GITHUB_ENV so
// later steps in the same job can read them as plain environment variables.
//
// Node stdlib ONLY. No third-party imports. ESM. Must run on Node 20.
//
// Fail-closed contract (design doc §B.1, rows 1-3):
//   1. RUNNER_TEMP (env var) or --github-env (the resolved $GITHUB_ENV path) missing/empty -> fail.
//      This is deliberately the first thing checked in main().
//   2. tools/secret-scan/pins.json missing or unreadable -> readFileSync throws -> fail.
//      There is intentionally no existsSync "skip if absent" branch anywhere in this file.
//   3. pins.json malformed (bad JSON, missing key, wrong shape, internally inconsistent) -> fail.
//
// Every failure path throws; there is no catch that swallows an error and continues.

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PINS_PATH = path.join(HERE, 'pins.json');

export function fail(message) {
  throw new Error(`[secret-scan/pin] ${message}`);
}

/** Strictly validate the parsed pins.json shape. Throws on any violation. */
export function validatePins(pins) {
  if (pins === null || typeof pins !== 'object' || Array.isArray(pins)) {
    fail('pins.json must be a JSON object');
  }
  if (pins.version !== 1) {
    fail(`pins.json "version" must be exactly 1 (got ${JSON.stringify(pins.version)})`);
  }
  if (typeof pins.gitleaksVersion !== 'string' || !/^v\d+\.\d+\.\d+$/.test(pins.gitleaksVersion)) {
    fail(`pins.json "gitleaksVersion" must match ^v\\d+\\.\\d+\\.\\d+$ (got ${JSON.stringify(pins.gitleaksVersion)})`);
  }
  if (typeof pins.asset !== 'string' || !/^gitleaks_\d+\.\d+\.\d+_linux_x64\.tar\.gz$/.test(pins.asset)) {
    fail(`pins.json "asset" must match ^gitleaks_\\d+\\.\\d+\\.\\d+_linux_x64\\.tar\\.gz$ (got ${JSON.stringify(pins.asset)})`);
  }
  if (typeof pins.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(pins.sha256)) {
    fail(`pins.json "sha256" must be exactly 64 lowercase hex chars (got ${JSON.stringify(pins.sha256)})`);
  }
  if (typeof pins.urlTemplate !== 'string' || !pins.urlTemplate.startsWith('https://github.com/gitleaks/gitleaks/releases/download/')) {
    fail(`pins.json "urlTemplate" must start with https://github.com/gitleaks/gitleaks/releases/download/ (got ${JSON.stringify(pins.urlTemplate)})`);
  }

  // Cross-consistency: the version embedded in `asset` must equal `gitleaksVersion` minus its
  // leading "v". A pins.json that says gitleaksVersion=v8.30.1 but asset=..._8.30.2_... is a
  // malformed pin, not a valid one, and must fail exactly like a missing field would.
  const versionFromTag = pins.gitleaksVersion.slice(1);
  const assetMatch = pins.asset.match(/^gitleaks_(\d+\.\d+\.\d+)_linux_x64\.tar\.gz$/);
  const versionFromAsset = assetMatch ? assetMatch[1] : null;
  if (versionFromAsset !== versionFromTag) {
    fail(
      `pins.json version mismatch: gitleaksVersion implies "${versionFromTag}" but asset implies "${versionFromAsset}"`
    );
  }

  // The expanded download URL must also carry the same version (this is trivially true once we
  // *build* the URL from gitleaksVersion + asset below, but we assert it explicitly here too so a
  // future refactor that starts trusting a literal, independently-authored full URL in pins.json
  // cannot silently drift from gitleaksVersion without tripping this check).
  const expandedUrl = buildUrl(pins);
  if (!expandedUrl.includes(`/${pins.gitleaksVersion}/`) || !expandedUrl.endsWith(`/${pins.asset}`)) {
    fail(`pins.json expanded URL "${expandedUrl}" does not embed gitleaksVersion/asset consistently`);
  }

  return pins;
}

export function buildUrl(pins) {
  return `${pins.urlTemplate}${pins.gitleaksVersion}/${pins.asset}`;
}

/** Load and validate pins.json from the given path (defaults to the co-located pins.json). */
export function loadPins(pinsPath = PINS_PATH) {
  const raw = readFileSync(pinsPath, 'utf8'); // throws if missing/unreadable — condition #2
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`pins.json is not valid JSON: ${err.message}`);
  }
  return validatePins(parsed);
}

/** Derive the $RUNNER_TEMP-rooted working paths the CI job needs. */
export function derivePaths(runnerTemp) {
  const gitleaksHome = path.join(runnerTemp, 'secret-scan-gitleaks');
  return {
    GITLEAKS_HOME: gitleaksHome,
    GITLEAKS_BIN: path.join(gitleaksHome, 'gitleaks'),
    GITLEAKS_IGNORE_PATH: path.join(runnerTemp, 'secret-scan-ignore', '.gitleaksignore'),
    GITLEAKS_REPORT_DIR: path.join(runnerTemp, 'secret-scan-reports'),
  };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === '--github-env') {
      args.githubEnv = argv[i + 1];
      i += 1;
    } else if (tok === '--pins') {
      args.pins = argv[i + 1];
      i += 1;
    } else {
      args._.push(tok);
    }
  }
  return args;
}

function requireNonEmpty(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    fail(`${label} is missing or empty`);
  }
  return value;
}

export function main(argv) {
  const args = parseArgs(argv);

  // Condition #1 (design §B.1 row 1): RUNNER_TEMP and the resolved GITHUB_ENV path must both be
  // present and non-empty. Checked explicitly here rather than relied upon via shell `set -u`,
  // because this script must fail closed even when invoked directly (as our own validation does).
  const runnerTemp = requireNonEmpty(process.env.RUNNER_TEMP, 'RUNNER_TEMP environment variable');
  const githubEnvPath = requireNonEmpty(args.githubEnv, '--github-env argument (resolved $GITHUB_ENV path)');

  const pins = loadPins(args.pins);
  const derived = derivePaths(runnerTemp);

  // Make sure every directory we hand downstream steps actually exists — the guard is
  // self-sufficient and does not depend on ci.yml (a reserved, unmodifiable file) doing this.
  mkdirSync(derived.GITLEAKS_HOME, { recursive: true });
  mkdirSync(path.dirname(derived.GITLEAKS_IGNORE_PATH), { recursive: true });
  mkdirSync(derived.GITLEAKS_REPORT_DIR, { recursive: true });

  const url = buildUrl(pins);

  const envLines = [
    `GITLEAKS_HOME=${derived.GITLEAKS_HOME}`,
    `GITLEAKS_BIN=${derived.GITLEAKS_BIN}`,
    `GITLEAKS_IGNORE_PATH=${derived.GITLEAKS_IGNORE_PATH}`,
    `GITLEAKS_REPORT_DIR=${derived.GITLEAKS_REPORT_DIR}`,
    `GITLEAKS_ASSET=${pins.asset}`,
    `GITLEAKS_URL=${url}`,
    `GITLEAKS_SHA256=${pins.sha256}`,
    `GITLEAKS_VERSION=${pins.gitleaksVersion}`,
  ];

  appendFileSync(githubEnvPath, envLines.join('\n') + '\n', 'utf8');

  process.stdout.write(
    `[secret-scan/pin] wrote ${envLines.length} variables to ${githubEnvPath} (gitleaks ${pins.gitleaksVersion})\n`
  );

  return { pins, derived, url, envLines };
}

const isDirectRun = (() => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  }
}
