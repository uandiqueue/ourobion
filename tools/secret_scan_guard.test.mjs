// tools/secret_scan_guard.test.mjs
//
// O36 fail-closed secret-scanning guard — reachable-failure-path test suite (design §D.6 / §B.1
// #17). Every assertion id gets a NEGATIVE fixture (guard must report exactly that violation id)
// and a POSITIVE fixture (same shape, violation removed -> zero violations). Node's built-in
// test runner + assert/strict only — no third-party test framework.
//
// All fixtures are generated at runtime under fs.mkdtempSync(path.join(os.tmpdir(), 'o36-')) and
// removed in a `finally`. Nothing is committed. Every "secret-shaped" value used anywhere below is
// a synthetic, obviously-fake literal — never a value copied from any real .env file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as guard from './secret_scan_guard.mjs';
import * as pin from './secret-scan/pin.mjs';

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'o36-'));
}

function withTmpDir(fn) {
  const dir = tmpDir();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  return abs;
}

function runGit(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
  return res.stdout;
}

/** Initialise a minimal git repo at `root`, `git add` every path in `relPaths`, and (optionally)
 * commit. `git ls-files` / `git check-ignore` / `git ls-files --error-unmatch` all work against
 * the index without a commit; a commit is only needed for tests that care about commit history. */
function initGitRepo(root, relPaths, { commit = false } = {}) {
  runGit(root, ['init', '-q']);
  runGit(root, ['config', 'user.email', 'test@example.invalid']);
  runGit(root, ['config', 'user.name', 'O36 Test']);
  if (relPaths.length) runGit(root, ['add', ...relPaths]);
  if (commit) runGit(root, ['commit', '-q', '-m', 'fixture commit']);
}

// Fake binaries for verify-binary()/canary() tests, WITHOUT depending on the real pinned
// scanner being present and WITHOUT depending on a shell. Both verify-binary and canary spawn
// their target via `spawnSync(binary, [...fixedArgs])` with no `shell` option — on Windows,
// spawning a .bat/.cmd file that way now fails closed with EINVAL (a deliberate Node.js security
// fix disabling the old implicit cmd.exe wrapping; see CVE-2024-27980), and a POSIX shebang
// script isn't runnable that way on Windows either. Rather than weaken production spawning to
// `shell: true` just to make a test double easy, these fakes use `process.execPath` (a real,
// natively spawnable executable on every platform) as `binary`, paired with a NODE_OPTIONS
// `--require <preload>` that intercepts before Node tries to resolve the (nonsensical) first
// positional arg as a script path, prints/writes the desired output, and exits. This is
// Node-stdlib-only and platform-independent.
function toRequirePath(p) {
  return p.split(path.sep).join('/');
}

/** Run `fn(process.execPath)` with NODE_OPTIONS pointed at a preload script that makes
 * `<execPath> version` print `versionOutput` and exit 0 — simulating `<gitleaks binary> version`. */
function withFakeVersionBinary(versionOutput, fn) {
  return withTmpDir((dir) => {
    const preloadPath = path.join(dir, 'preload-version.cjs');
    writeFileSync(
      preloadPath,
      `if (process.argv[1] && process.argv[1].endsWith('version')) {\n` +
        `  process.stdout.write(${JSON.stringify(versionOutput)} + '\\n');\n` +
        `  process.exit(0);\n` +
        `}\n`,
      'utf8'
    );
    const saved = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = `--require "${toRequirePath(preloadPath)}"`;
    try {
      return fn(process.execPath);
    } finally {
      if (saved === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = saved;
    }
  });
}

/** Run `fn(process.execPath)` with NODE_OPTIONS pointed at a preload script that makes
 * `<execPath> dir <dir> ... --report-path <p> ...` write `findings` (as JSON) to the path that
 * follows `--report-path` and exit with `exitCode` — simulating a real gitleaks `dir` scan. */
function withFakeScanBinary({ findings, exitCode }, fn) {
  return withTmpDir((dir) => {
    const preloadPath = path.join(dir, 'preload-scan.cjs');
    writeFileSync(
      preloadPath,
      `if (process.argv[1] && process.argv[1].endsWith('dir')) {\n` +
        `  const argv = process.argv;\n` +
        `  const idx = argv.indexOf('--report-path');\n` +
        `  const reportPath = argv[idx + 1];\n` +
        `  require('node:fs').writeFileSync(reportPath, ${JSON.stringify(JSON.stringify(findings))});\n` +
        `  process.exit(${exitCode});\n` +
        `}\n`,
      'utf8'
    );
    const saved = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = `--require "${toRequirePath(preloadPath)}"`;
    try {
      return fn(process.execPath);
    } finally {
      if (saved === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = saved;
    }
  });
}

// =================================================================================================
// pin.mjs — pins.json validation (design §B.1 rows 1-3)
// =================================================================================================

test('pin.validatePins: accepts a well-formed pins object', () => {
  const good = {
    version: 1,
    gitleaksVersion: 'v8.30.1',
    asset: 'gitleaks_8.30.1_linux_x64.tar.gz',
    sha256: 'a'.repeat(64),
    urlTemplate: 'https://github.com/gitleaks/gitleaks/releases/download/',
  };
  assert.doesNotThrow(() => pin.validatePins(good));
});

test('pin.validatePins: rejects wrong version field', () => {
  assert.throws(() => pin.validatePins({ version: 2 }), /version.*must be exactly 1/);
});

test('pin.validatePins: rejects malformed gitleaksVersion', () => {
  assert.throws(
    () =>
      pin.validatePins({
        version: 1,
        gitleaksVersion: '8.30.1', // missing leading v
        asset: 'gitleaks_8.30.1_linux_x64.tar.gz',
        sha256: 'a'.repeat(64),
        urlTemplate: 'https://github.com/gitleaks/gitleaks/releases/download/',
      }),
    /gitleaksVersion/
  );
});

test('pin.validatePins: rejects sha256 of wrong length/charset', () => {
  assert.throws(
    () =>
      pin.validatePins({
        version: 1,
        gitleaksVersion: 'v8.30.1',
        asset: 'gitleaks_8.30.1_linux_x64.tar.gz',
        sha256: 'not-hex',
        urlTemplate: 'https://github.com/gitleaks/gitleaks/releases/download/',
      }),
    /sha256/
  );
});

test('pin.validatePins: rejects version/asset cross-inconsistency', () => {
  assert.throws(
    () =>
      pin.validatePins({
        version: 1,
        gitleaksVersion: 'v8.30.1',
        asset: 'gitleaks_8.30.2_linux_x64.tar.gz', // mismatched version
        sha256: 'a'.repeat(64),
        urlTemplate: 'https://github.com/gitleaks/gitleaks/releases/download/',
      }),
    /version mismatch/
  );
});

test('pin.validatePins: rejects a urlTemplate on the wrong host', () => {
  assert.throws(
    () =>
      pin.validatePins({
        version: 1,
        gitleaksVersion: 'v8.30.1',
        asset: 'gitleaks_8.30.1_linux_x64.tar.gz',
        sha256: 'a'.repeat(64),
        urlTemplate: 'https://evil.example.com/download/',
      }),
    /urlTemplate/
  );
});

test('pin.buildUrl: composes the expected download URL', () => {
  const url = pin.buildUrl({
    urlTemplate: 'https://github.com/gitleaks/gitleaks/releases/download/',
    gitleaksVersion: 'v8.30.1',
    asset: 'gitleaks_8.30.1_linux_x64.tar.gz',
  });
  assert.equal(url, 'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz');
});

test('pin.derivePaths: derives distinct paths rooted at RUNNER_TEMP', () => {
  const derived = pin.derivePaths('/tmp/runner');
  assert.ok(derived.GITLEAKS_HOME.startsWith('/tmp/runner') || derived.GITLEAKS_HOME.includes('runner'));
  assert.notEqual(derived.GITLEAKS_BIN, derived.GITLEAKS_HOME);
  assert.ok(derived.GITLEAKS_IGNORE_PATH.endsWith('.gitleaksignore'));
});

test('pin.loadPins + main: fails closed when RUNNER_TEMP is unset', () => {
  withTmpDir((dir) => {
    const ghEnv = path.join(dir, 'github_env.txt');
    const savedRunnerTemp = process.env.RUNNER_TEMP;
    delete process.env.RUNNER_TEMP;
    try {
      assert.throws(() => pin.main(['--github-env', ghEnv]), /RUNNER_TEMP/);
    } finally {
      if (savedRunnerTemp !== undefined) process.env.RUNNER_TEMP = savedRunnerTemp;
    }
  });
});

test('pin.loadPins: fails closed on missing pins.json', () => {
  withTmpDir((dir) => {
    assert.throws(() => pin.loadPins(path.join(dir, 'does-not-exist.json')), /ENOENT|no such file/);
  });
});

test('pin.loadPins: fails closed on malformed JSON', () => {
  withTmpDir((dir) => {
    const p = write(dir, 'pins.json', '{ not valid json');
    assert.throws(() => pin.loadPins(p), /not valid JSON/);
  });
});

test('pin.main: writes all 8 expected variables to the GITHUB_ENV file', () => {
  withTmpDir((dir) => {
    const ghEnv = path.join(dir, 'github_env.txt');
    writeFileSync(ghEnv, '', 'utf8');
    const savedRunnerTemp = process.env.RUNNER_TEMP;
    process.env.RUNNER_TEMP = path.join(dir, 'runner-temp');
    try {
      const result = pin.main(['--github-env', ghEnv]);
      assert.equal(result.envLines.length, 8);
      const written = readFileSync(ghEnv, 'utf8');
      for (const key of ['GITLEAKS_HOME', 'GITLEAKS_BIN', 'GITLEAKS_IGNORE_PATH', 'GITLEAKS_REPORT_DIR', 'GITLEAKS_ASSET', 'GITLEAKS_URL', 'GITLEAKS_SHA256', 'GITLEAKS_VERSION']) {
        assert.match(written, new RegExp(`^${key}=`, 'm'));
      }
    } finally {
      if (savedRunnerTemp !== undefined) process.env.RUNNER_TEMP = savedRunnerTemp;
      else delete process.env.RUNNER_TEMP;
    }
  });
});

// =================================================================================================
// verify-binary
// =================================================================================================

test('verifyBinary: passes when actual version matches expected (both with leading v)', () => {
  withFakeVersionBinary('8.30.1', (bin) => {
    const result = guard.verifyBinary({ binary: bin, expectVersion: 'v8.30.1' });
    assert.equal(result.normActual, '8.30.1');
  });
});

test('verifyBinary: normalises a leading "v" on either side', () => {
  withFakeVersionBinary('v8.30.1', (bin) => {
    assert.doesNotThrow(() => guard.verifyBinary({ binary: bin, expectVersion: '8.30.1' }));
  });
});

test('verifyBinary: fails closed on a version mismatch', () => {
  withFakeVersionBinary('8.30.1', (bin) => {
    assert.throws(() => guard.verifyBinary({ binary: bin, expectVersion: 'v9.9.9' }), /version mismatch/);
  });
});

test('verifyBinary: fails closed when the binary cannot be spawned', () => {
  withTmpDir((dir) => {
    assert.throws(
      () => guard.verifyBinary({ binary: path.join(dir, 'nope-does-not-exist'), expectVersion: 'v8.30.1' }),
      /failed to spawn/
    );
  });
});

test('verifyBinary: requires both --binary and --expect-version', () => {
  assert.throws(() => guard.verifyBinary({ expectVersion: 'v8.30.1' }), /--binary/);
  assert.throws(() => guard.verifyBinary({ binary: 'x' }), /--expect-version/);
});

// =================================================================================================
// policy — config text checks
// =================================================================================================

test('checkConfigPolicy: the real tools/secret-scan/gitleaks.toml passes with zero violations', () => {
  const text = readFileSync(new URL('./secret-scan/gitleaks.toml', import.meta.url), 'utf8');
  const { violations, declaredIds } = guard.checkConfigPolicy(text);
  assert.deepEqual(violations, []);
  assert.ok(declaredIds.has('ourobion-canary'));
});

test('checkConfigPolicy: rejects a config missing [extend]', () => {
  const { violations } = guard.checkConfigPolicy('[[rules]]\nid = "ourobion-canary"\n');
  assert.ok(violations.some((v) => v.id === 'POLICY_NO_EXTEND_BLOCK'));
});

test('checkConfigPolicy: rejects useDefault = false', () => {
  const { violations } = guard.checkConfigPolicy('[extend]\nuseDefault = false\n\n[[rules]]\nid = "ourobion-canary"\n');
  assert.ok(violations.some((v) => v.id === 'POLICY_DEFAULT_RULESET_DISABLED'));
});

test('checkConfigPolicy: rejects a config missing the required ourobion-canary rule', () => {
  const { violations } = guard.checkConfigPolicy('[extend]\nuseDefault = true\n');
  assert.ok(violations.some((v) => v.id === 'POLICY_REQUIRED_RULE_MISSING'));
});

test('checkConfigPolicy: rejects a bare "paths =" key (broad native allowlist)', () => {
  const { violations } = guard.checkConfigPolicy(
    '[extend]\nuseDefault = true\n\n[[rules]]\nid = "ourobion-canary"\n\n[[allowlists]]\npaths = ["foo"]\n'
  );
  assert.ok(violations.some((v) => v.id === 'POLICY_BROAD_NATIVE_ALLOWLIST_KEY'));
});

test('checkConfigPolicy: rejects native TOML allowlist tables including commit suppression', () => {
  const result = guard.checkConfigPolicy(`${GOOD_CONFIG}\n[[allowlists]]\ncommits = ["${'a'.repeat(40)}"]\n`);
  assert.ok(result.violations.some((v) => v.id === 'POLICY_BROAD_NATIVE_ALLOWLIST_KEY'));
});

test('checkConfigPolicy: does NOT false-positive on the word "paths" inside prose/description', () => {
  const { violations } = guard.checkConfigPolicy(
    '[extend]\nuseDefault = true\n\n[[rules]]\nid = "ourobion-canary"\ndescription = "mentions paths in prose, not as a key"\n'
  );
  assert.ok(!violations.some((v) => v.id === 'POLICY_BROAD_NATIVE_ALLOWLIST_KEY'));
});

// =================================================================================================
// parseFingerprint — both fingerprint shapes
// =================================================================================================

test('parseFingerprint: parses dir-mode (3-part) fingerprints', () => {
  const parsed = guard.parseFingerprint('docs/nao/nao-app-design.md:generic-api-key:198');
  assert.deepEqual(parsed, { commit: null, file: 'docs/nao/nao-app-design.md', ruleId: 'generic-api-key', line: '198' });
});

test('parseFingerprint: parses git-mode (4-part, leading 40-hex commit) fingerprints', () => {
  const parsed = guard.parseFingerprint('0cc35a7b309a8bf1c3d45f66fca8003dddb1e6db:model-training/tests/test_release.py:stripe-access-token:118');
  assert.equal(parsed.commit, '0cc35a7b309a8bf1c3d45f66fca8003dddb1e6db');
  assert.equal(parsed.file, 'model-training/tests/test_release.py');
  assert.equal(parsed.ruleId, 'stripe-access-token');
  assert.equal(parsed.line, '118');
});

test('parseFingerprint: returns null for fewer than 3 parts', () => {
  assert.equal(guard.parseFingerprint('only:two'), null);
  assert.equal(guard.parseFingerprint('justone'), null);
});

test('parseFingerprint: a 4-part fingerprint whose first component is NOT 40 hex chars is treated as dir-mode with a colon in the file name (no crash)', () => {
  const parsed = guard.parseFingerprint('not-a-commit:some/file.txt:generic-api-key:12');
  assert.equal(parsed.commit, null);
  assert.equal(parsed.file, 'not-a-commit:some/file.txt');
  assert.equal(parsed.ruleId, 'generic-api-key');
  assert.equal(parsed.line, '12');
});

// =================================================================================================
// validateAllowlistEntry — every ALLOW_* violation id, positive + negative
// =================================================================================================

function baseEntry(overrides = {}) {
  return {
    ruleId: 'generic-api-key',
    path: 'docs/example.md',
    fingerprint: 'docs/example.md:generic-api-key:1',
    justification: 'This is a sufficiently long, human-authored justification exceeding forty characters.',
    approvedBy: 'Test Approver',
    addedOn: '2026-07-28',
    expiresOn: '2027-01-20',
    ...overrides,
  };
}

const KNOWN_IDS = new Set(guard.KNOWN_DEFAULT_RULE_IDS);
const commonOpts = { repoRoot: '/nonexistent', knownRuleIds: KNOWN_IDS, today: '2026-07-28', checkTracked: false };

test('validateAllowlistEntry: a well-formed entry has zero violations', () => {
  assert.deepEqual(guard.validateAllowlistEntry(baseEntry(), commonOpts), []);
});

test('validateAllowlistEntry: ALLOW_RULE_WILDCARD fires on "*", "", null, and an array', () => {
  for (const bad of ['*', '', null, ['a', 'b']]) {
    const v = guard.validateAllowlistEntry(baseEntry({ ruleId: bad, fingerprint: `docs/example.md:${bad}:1` }), commonOpts);
    assert.ok(v.includes('ALLOW_RULE_WILDCARD'), `expected ALLOW_RULE_WILDCARD for ruleId=${JSON.stringify(bad)}, got ${v}`);
  }
});

test('validateAllowlistEntry: ALLOW_RULE_UNKNOWN fires on a typo/unknown rule id', () => {
  const v = guard.validateAllowlistEntry(baseEntry({ ruleId: 'totally-made-up-rule-id', fingerprint: 'docs/example.md:totally-made-up-rule-id:1' }), commonOpts);
  assert.ok(v.includes('ALLOW_RULE_UNKNOWN'));
});

test('validateAllowlistEntry: ALLOW_BROAD_PATH_GLOB fires on glob-shaped paths', () => {
  for (const bad of ['docs/*.md', 'docs/**', 'docs/', 'docs/[abc].md', 'docs/{a,b}.md']) {
    const v = guard.validateAllowlistEntry(baseEntry({ path: bad }), commonOpts);
    assert.ok(v.includes('ALLOW_BROAD_PATH_GLOB'), `expected ALLOW_BROAD_PATH_GLOB for path=${bad}, got ${v}`);
  }
});

test('validateAllowlistEntry: ALLOW_PATH_NOT_TRACKED fires when git does not track the path', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.md', 'hello');
    initGitRepo(dir, ['tracked.md']);
    const v = guard.validateAllowlistEntry(
      baseEntry({ path: 'untracked.md', fingerprint: 'untracked.md:generic-api-key:1' }),
      { repoRoot: dir, knownRuleIds: KNOWN_IDS, today: '2026-07-28', checkTracked: true }
    );
    assert.ok(v.includes('ALLOW_PATH_NOT_TRACKED'));
  });
});

test('validateAllowlistEntry: a tracked path passes ALLOW_PATH_NOT_TRACKED', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.md', 'hello');
    initGitRepo(dir, ['tracked.md']);
    const v = guard.validateAllowlistEntry(
      baseEntry({ path: 'tracked.md', fingerprint: 'tracked.md:generic-api-key:1' }),
      { repoRoot: dir, knownRuleIds: KNOWN_IDS, today: '2026-07-28', checkTracked: true }
    );
    assert.ok(!v.includes('ALLOW_PATH_NOT_TRACKED'));
  });
});

test('validateAllowlistEntry: ALLOW_NATIVE_BROAD_FIELD fires on any gitleaks-native broad key', () => {
  for (const key of ['paths', 'regexes', 'stopwords', 'regexTarget', 'commits', 'tags']) {
    const v = guard.validateAllowlistEntry(baseEntry({ [key]: ['x'] }), commonOpts);
    assert.ok(v.includes('ALLOW_NATIVE_BROAD_FIELD'), `expected ALLOW_NATIVE_BROAD_FIELD for key=${key}, got ${v}`);
  }
});

test('validateAllowlistEntry: ALLOW_FINGERPRINT_MISSING fires on absent/short fingerprints', () => {
  assert.ok(guard.validateAllowlistEntry(baseEntry({ fingerprint: '' }), commonOpts).includes('ALLOW_FINGERPRINT_MISSING'));
  assert.ok(guard.validateAllowlistEntry(baseEntry({ fingerprint: 'only:two' }), commonOpts).includes('ALLOW_FINGERPRINT_MISSING'));
});

test('validateAllowlistEntry: ALLOW_FINGERPRINT_MISMATCH fires when file/rule component disagrees with path/ruleId', () => {
  const v = guard.validateAllowlistEntry(baseEntry({ fingerprint: 'some/other/file.md:generic-api-key:1' }), commonOpts);
  assert.ok(v.includes('ALLOW_FINGERPRINT_MISMATCH'));
  const v2 = guard.validateAllowlistEntry(baseEntry({ fingerprint: 'docs/example.md:some-other-rule:1' }), commonOpts);
  assert.ok(v2.includes('ALLOW_FINGERPRINT_MISMATCH'));
});

test('validateAllowlistEntry: ALLOW_FINGERPRINT_MISMATCH also works for git-mode (4-part) fingerprints', () => {
  const entry = baseEntry({
    fingerprint: 'a'.repeat(40) + ':docs/example.md:generic-api-key:1',
  });
  assert.deepEqual(guard.validateAllowlistEntry(entry, commonOpts), []);
  const bad = baseEntry({ fingerprint: 'a'.repeat(40) + ':docs/OTHER.md:generic-api-key:1' });
  assert.ok(guard.validateAllowlistEntry(bad, commonOpts).includes('ALLOW_FINGERPRINT_MISMATCH'));
});

test('validateAllowlistEntry: ALLOW_JUSTIFICATION_THIN fires on short or boilerplate justifications', () => {
  for (const bad of ['fp', 'false positive', 'TODO', 'This is short.', 'placeholder']) {
    const v = guard.validateAllowlistEntry(baseEntry({ justification: bad }), commonOpts);
    assert.ok(v.includes('ALLOW_JUSTIFICATION_THIN'), `expected THIN for "${bad}", got ${v}`);
  }
});

test('validateAllowlistEntry: ALLOW_NO_OWNER fires on empty approvedBy', () => {
  assert.ok(guard.validateAllowlistEntry(baseEntry({ approvedBy: '' }), commonOpts).includes('ALLOW_NO_OWNER'));
  assert.ok(guard.validateAllowlistEntry(baseEntry({ approvedBy: '   ' }), commonOpts).includes('ALLOW_NO_OWNER'));
});

test('validateAllowlistEntry: ALLOW_BAD_DATE fires on bad format, inverted range, and > 180 day span', () => {
  assert.ok(guard.validateAllowlistEntry(baseEntry({ addedOn: '07-28-2026' }), commonOpts).includes('ALLOW_BAD_DATE'));
  assert.ok(guard.validateAllowlistEntry(baseEntry({ addedOn: '2026-07-28', expiresOn: '2026-07-01' }), commonOpts).includes('ALLOW_BAD_DATE'));
  assert.ok(guard.validateAllowlistEntry(baseEntry({ addedOn: '2026-01-01', expiresOn: '2026-12-31' }), commonOpts).includes('ALLOW_BAD_DATE'));
});

test('validateAllowlistEntry: a 180-day-exact span passes ALLOW_BAD_DATE', () => {
  const v = guard.validateAllowlistEntry(baseEntry({ addedOn: '2026-01-01', expiresOn: '2026-06-30' }), commonOpts);
  assert.ok(!v.includes('ALLOW_BAD_DATE'));
});

test('validateAllowlistEntry: ALLOW_EXPIRED fires when today > expiresOn', () => {
  const v = guard.validateAllowlistEntry(baseEntry({ expiresOn: '2026-01-01' }), { ...commonOpts, today: '2026-07-28' });
  assert.ok(v.includes('ALLOW_EXPIRED'));
});

test('validateAllowlistEntry: ALLOW_EXPIRED does not fire when today <= expiresOn', () => {
  const v = guard.validateAllowlistEntry(baseEntry({ expiresOn: '2027-01-20' }), { ...commonOpts, today: '2026-07-28' });
  assert.ok(!v.includes('ALLOW_EXPIRED'));
});

// =================================================================================================
// policy() — full integration (config + allowlist + bypass channels + emit-ignore), via a
// disposable synthetic git repo.
// =================================================================================================

const GOOD_CONFIG = `[extend]\nuseDefault = true\n\n[[rules]]\nid = "ourobion-canary"\ndescription = "canary"\nregex = '''OUROBION_CANARY_SECRET_[A-Z0-9]{32}'''\n`;

function goodAllowlistEntryFor(repoRelPath) {
  return {
    version: 1,
    entries: [
      {
        ruleId: 'generic-api-key',
        path: repoRelPath,
        fingerprint: `${repoRelPath}:generic-api-key:1`,
        justification: 'Synthetic placeholder value used only in this test fixture, well over forty characters long.',
        approvedBy: 'Test Approver',
        addedOn: '2026-07-28',
        expiresOn: '2027-01-20',
      },
    ],
  };
}

test('policy(): passes end-to-end on a valid config + valid allowlist, and emits the ignore file', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    // policy() never invokes gitleaks itself (it is a pure text/allowlist validator — see the
    // module doc comment), so this fixture's content only needs to exist and be tracked; it
    // deliberately does NOT contain a real-rule-shaped literal (avoids this guard's own tracked
    // test source tripping a real gitleaks scan of this repo, which happened during development).
    write(dir, 'example.md', 'placeholder documentation content, not a credential\n');
    initGitRepo(dir, ['example.md']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify(goodAllowlistEntryFor('example.md')));
    const emitPath = path.join(dir, 'out', '.gitleaksignore');
    const result = guard.policy({ configPath, allowlistPath, emitIgnorePath: emitPath, repoRoot: dir, today: '2026-07-28' });
    assert.equal(result.emittedCount, 1);
    const emitted = readFileSync(emitPath, 'utf8').trim().split('\n');
    assert.deepEqual(emitted, ['example.md:generic-api-key:1']);
  });
});

test('policy(): fails closed when allowlist.json is missing', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    initGitRepo(dir, []);
    assert.throws(() => guard.policy({ configPath, allowlistPath: path.join(dir, 'nope.json'), repoRoot: dir }), /ENOENT|no such file/);
  });
});

test('policy(): fails closed when the allowlist cap is exceeded (raised cap = 16)', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    const entries = [];
    for (let i = 0; i < 17; i += 1) {
      write(dir, `f${i}.md`, 'x');
      entries.push({
        ruleId: 'generic-api-key',
        path: `f${i}.md`,
        fingerprint: `f${i}.md:generic-api-key:1`,
        justification: 'Synthetic placeholder value used only in this test fixture, well over forty characters.',
        approvedBy: 'Test',
        addedOn: '2026-07-28',
        expiresOn: '2027-01-20',
      });
    }
    initGitRepo(dir, entries.map((e) => e.path));
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir, today: '2026-07-28' }), /ALLOW_CAP_EXCEEDED/);
  });
});

test('policy(): 16 entries (the raised cap) is accepted', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    const entries = [];
    for (let i = 0; i < 16; i += 1) {
      write(dir, `f${i}.md`, 'x');
      entries.push({
        ruleId: 'generic-api-key',
        path: `f${i}.md`,
        fingerprint: `f${i}.md:generic-api-key:1`,
        justification: 'Synthetic placeholder value used only in this test fixture, well over forty characters.',
        approvedBy: 'Test',
        addedOn: '2026-07-28',
        expiresOn: '2027-01-20',
      });
    }
    initGitRepo(dir, entries.map((e) => e.path));
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries }));
    assert.doesNotThrow(() => guard.policy({ configPath, allowlistPath, repoRoot: dir, today: '2026-07-28' }));
  });
});

test('policy(): ALLOW_DUPLICATE fires on two entries sharing a fingerprint', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    write(dir, 'example.md', 'x');
    initGitRepo(dir, ['example.md']);
    const dup = goodAllowlistEntryFor('example.md');
    dup.entries.push({ ...dup.entries[0] });
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify(dup));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir, today: '2026-07-28' }), /ALLOW_DUPLICATE/);
  });
});

test('policy(): fails closed when the config disables the default ruleset', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', '[extend]\nuseDefault = false\n\n[[rules]]\nid = "ourobion-canary"\n');
    initGitRepo(dir, []);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }), /POLICY_DEFAULT_RULESET_DISABLED/);
  });
});

test('policy(): BYPASS_TRACKED_IGNORE_FILE fires on a tracked repo-root .gitleaksignore', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    write(dir, '.gitleaksignore', 'somefile:some-rule:1\n');
    initGitRepo(dir, ['.gitleaksignore']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }), /BYPASS_TRACKED_IGNORE_FILE/);
  });
});

test('policy(): BYPASS_TRACKED_SECOND_CONFIG fires on a tracked gitleaks.toml outside tools/secret-scan/', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    write(dir, 'other/gitleaks.toml', '[extend]\nuseDefault = true\n');
    initGitRepo(dir, ['other/gitleaks.toml']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }), /BYPASS_TRACKED_SECOND_CONFIG/);
  });
});

test('policy(): BYPASS_GITLEAKS_ALLOW_COMMENT fires on a tracked inline allow-comment marker', () => {
  // The marker is built from guard.ALLOW_COMMENT_MARKER (itself fragment-assembled), not spelled
  // out contiguously here — this test file is tracked source too, and a naive spelled-out marker
  // in THIS file would make the guard flag its own test suite (measured: it did, once these
  // files were tracked instead of untracked during development — see the coordinator's
  // follow-up correction). Constructing it at runtime from the same source of truth the guard
  // itself uses keeps this test file free of the contiguous literal while still exercising the
  // exact real-world shape (a `// <marker>` trailing comment).
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    write(dir, 'src/file.ts', `const x = "sk-fake"; // ${guard.ALLOW_COMMENT_MARKER}\n`);
    initGitRepo(dir, ['src/file.ts']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }), /BYPASS_GITLEAKS_ALLOW_COMMENT/);
  });
});

test('policy(): CANARY_TOKEN_COMMITTED fires on a COMPLETE canary token (prefix + exactly 32 alnum chars), not a bare prefix mention', () => {
  // Built from guard.CANARY_TOKEN_PREFIX at runtime (never a contiguous complete token in this
  // tracked test file's own source, for the same self-inflicted-finding reason as above).
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    const completeToken = guard.CANARY_TOKEN_PREFIX + 'X'.repeat(32);
    write(dir, 'oops.txt', completeToken + '\n');
    initGitRepo(dir, ['oops.txt']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.throws(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }), /CANARY_TOKEN_COMMITTED/);
  });
});

test('policy(): CANARY_TOKEN_COMMITTED does NOT fire on the bare prefix alone (the false-positive this check used to have)', () => {
  // Mirrors the real tools/secret-scan/gitleaks.toml shape: the prefix followed by the RULE'S
  // OWN REGEX SYNTAX (`[A-Z0-9]{32}`), not 32 literal alnum characters. A config declaring the
  // canary rule must never be flagged as if it were a leaked fixture.
  withTmpDir((dir) => {
    // Tracked under tools/secret-scan/ (matching the real repo convention) so this fixture
    // doesn't collide with the separate BYPASS_TRACKED_SECOND_CONFIG check, which is what would
    // fire on a tracked gitleaks.toml outside that directory — a different check than the one
    // under test here.
    const configPath = write(dir, 'tools/secret-scan/gitleaks.toml', GOOD_CONFIG);
    initGitRepo(dir, ['tools/secret-scan/gitleaks.toml']);
    const allowlistPath = write(dir, 'allowlist.json', JSON.stringify({ version: 1, entries: [] }));
    assert.doesNotThrow(() => guard.policy({ configPath, allowlistPath, repoRoot: dir }));
  });
});

// =================================================================================================
// canary() — via a fake scan binary (see writeFakeScanBinary above)
// =================================================================================================

test('canary(): passes when the fake scan reports both the custom and a default rule', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    withFakeScanBinary({ exitCode: 1, findings: [{ RuleID: 'ourobion-canary' }, { RuleID: 'stripe-access-token' }] }, (bin) => {
      const result = guard.canary({ binary: bin, configPath, dir: path.join(dir, 'scan-target'), reportPath: path.join(dir, 'report.json') });
      assert.ok(result.ruleIds.has('ourobion-canary'));
      assert.ok(result.ruleIds.has('stripe-access-token'));
    });
  });
});

test('canary(): fails closed when the scan comes back clean (exit 0)', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    withFakeScanBinary({ exitCode: 0, findings: [] }, (bin) => {
      assert.throws(
        () => guard.canary({ binary: bin, configPath, dir: path.join(dir, 'scan-target'), reportPath: path.join(dir, 'report.json') }),
        /no leaks found/
      );
    });
  });
});

test('canary(): fails closed when the custom rule is missing from the findings', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    withFakeScanBinary({ exitCode: 1, findings: [{ RuleID: 'stripe-access-token' }] }, (bin) => {
      assert.throws(
        () => guard.canary({ binary: bin, configPath, dir: path.join(dir, 'scan-target'), reportPath: path.join(dir, 'report.json') }),
        /ourobion-canary/
      );
    });
  });
});

test('canary(): fails closed when the default rule is missing from the findings (useDefault did not take)', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    withFakeScanBinary({ exitCode: 1, findings: [{ RuleID: 'ourobion-canary' }] }, (bin) => {
      assert.throws(
        () => guard.canary({ binary: bin, configPath, dir: path.join(dir, 'scan-target'), reportPath: path.join(dir, 'report.json') }),
        /useDefault=true did not take effect/
      );
    });
  });
});

test('canary(): fails closed on an unexpected exit code (e.g. 126 = unknown flag)', () => {
  withTmpDir((dir) => {
    const configPath = write(dir, 'gitleaks.toml', GOOD_CONFIG);
    withFakeScanBinary({ exitCode: 126, findings: [] }, (bin) => {
      assert.throws(
        () => guard.canary({ binary: bin, configPath, dir: path.join(dir, 'scan-target'), reportPath: path.join(dir, 'report.json') }),
        /exited 126/
      );
    });
  });
});

// =================================================================================================
// verify-report
// =================================================================================================

test('verifyReport: passes on an empty findings array (worktree scope, sentinels tracked)', () => {
  withTmpDir((dir) => {
    write(dir, 'sentinel-a.txt', 'a');
    write(dir, 'sentinel-b.txt', 'b');
    initGitRepo(dir, ['sentinel-a.txt', 'sentinel-b.txt']);
    const reportPath = write(dir, 'report.json', '[]');
    assert.doesNotThrow(() =>
      guard.verifyReport({ reportPath, scope: 'worktree', minFiles: 2, sentinels: ['sentinel-a.txt', 'sentinel-b.txt'], repoRoot: dir })
    );
  });
});

test('verifyReport: fails closed on a missing report file', () => {
  withTmpDir((dir) => {
    assert.throws(() => guard.verifyReport({ reportPath: path.join(dir, 'missing.json'), scope: 'history' }), /ENOENT|no such file/);
  });
});

test('verifyReport: fails closed on an empty (zero-byte) report file', () => {
  withTmpDir((dir) => {
    const reportPath = write(dir, 'report.json', '');
    assert.throws(() => guard.verifyReport({ reportPath, scope: 'history' }), /empty/);
  });
});

test('verifyReport: fails closed when the report does not parse to an array', () => {
  withTmpDir((dir) => {
    const reportPath = write(dir, 'report.json', '{"not":"an array"}');
    assert.throws(() => guard.verifyReport({ reportPath, scope: 'history' }), /did not parse to an array/);
  });
});

test('verifyReport: fails closed when findings are non-empty', () => {
  withTmpDir((dir) => {
    const reportPath = write(dir, 'report.json', JSON.stringify([{ File: 'x', RuleID: 'y', StartLine: 1 }]));
    assert.throws(() => guard.verifyReport({ reportPath, scope: 'history' }), /unexpected finding/);
  });
});

test('verifyReport: fails closed when tracked file count is below --min-files (degenerate checkout)', () => {
  withTmpDir((dir) => {
    write(dir, 'only-one.txt', 'x');
    initGitRepo(dir, ['only-one.txt']);
    const reportPath = write(dir, 'report.json', '[]');
    assert.throws(
      () => guard.verifyReport({ reportPath, scope: 'worktree', minFiles: 500, repoRoot: dir }),
      /below --min-files/
    );
  });
});

test('verifyReport: fails closed when a sentinel path is not tracked', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.txt', 'x');
    initGitRepo(dir, ['tracked.txt']);
    const reportPath = write(dir, 'report.json', '[]');
    assert.throws(
      () => guard.verifyReport({ reportPath, scope: 'worktree', minFiles: 1, sentinels: ['not-tracked.txt'], repoRoot: dir }),
      /not tracked/
    );
  });
});

// History scope used to accept any empty report without asking whether the scan had anything to
// walk. Now that the history step is pinned to the landing ref's ancestry rather than every ref
// the runner fetched, "0 findings" is only evidence if the traversal is proven — so history scope
// requires an explicit floor and refuses a shallow or truncated ancestry.
test('verifyReport: history scope requires an explicit --min-commits floor (no silent default)', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.txt', 'x');
    initGitRepo(dir, ['tracked.txt']);
    const reportPath = write(dir, 'report.json', '[]');
    assert.throws(() => guard.verifyReport({ reportPath, scope: 'history', repoRoot: dir }), /--min-commits is required/);
    assert.throws(() => guard.verifyReport({ reportPath, scope: 'history', minCommits: 0, repoRoot: dir }), /--min-commits is required/);
  });
});

test('verifyReport: history scope fails closed when the ancestry is shorter than the floor', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.txt', 'x');
    initGitRepo(dir, ['tracked.txt'], { commit: true });
    const reportPath = write(dir, 'report.json', '[]');
    assert.throws(
      () => guard.verifyReport({ reportPath, scope: 'history', minCommits: 250, repoRoot: dir }),
      /below --min-commits 250/
    );
    // The same one-commit repo passes once the floor honestly matches it.
    assert.doesNotThrow(() => guard.verifyReport({ reportPath, scope: 'history', minCommits: 1, repoRoot: dir }));
  });
});

test('verifyReport: history scope rejects a sentinel commit that is not an ancestor of HEAD', () => {
  withTmpDir((dir) => {
    write(dir, 'tracked.txt', 'x');
    initGitRepo(dir, ['tracked.txt'], { commit: true });
    const reportPath = write(dir, 'report.json', '[]');
    assert.throws(
      () => guard.verifyReport({ reportPath, scope: 'history', minCommits: 1, sentinelCommits: ['b'.repeat(40)], repoRoot: dir }),
      /unavailable or not a commit/
    );
    assert.throws(
      () => guard.verifyReport({ reportPath, scope: 'history', minCommits: 1, sentinelCommits: ['not-a-sha'], repoRoot: dir }),
      /not a full 40-character SHA/
    );
  });
});

// =================================================================================================
// client-surface — F1-F6, N1-N5, H1-H4, L1-L4 (design §D)
// =================================================================================================

function buildBaseRepo(dir) {
  // apps/biotope: minimal safe Flutter surface
  write(
    dir,
    'apps/biotope/pubspec.yaml',
    'name: biotope\nflutter:\n  uses-material-design: true\n  assets:\n    - .env.public\n    - assets/images/\n'
  );
  write(
    dir,
    'apps/biotope/lib/main.dart',
    "import 'package:flutter_dotenv/flutter_dotenv.dart';\n\nvoid main() async {\n  await dotenv.load(fileName: '.env.public');\n  final supabaseUrl = dotenv.env['SUPABASE_URL'];\n  final supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'];\n}\n"
  );
  // apps/nao: minimal safe client + public template + gen-env
  write(dir, "apps/nao/src/app/login/page.tsx", "'use client';\n\nexport default function Page() { return null; }\n");
  write(
    dir,
    'apps/nao/.env.public.example',
    'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nNEXT_PUBLIC_APP_ENV=development\n'
  );
  write(
    dir,
    'apps/nao/scripts/gen-env.mjs',
    "const publicPairs = parseDotenv(p('.env.public'));\n" +
      "const secretPairs = parseDotenv(p('.env'));\n" +
      "writeFileSync(p('.env.local'), serialize(publicPairs));\n" +
      "writeFileSync(p('.dev.vars'), serialize(secretPairs));\n"
  );
  write(dir, 'supabase/functions/.gitkeep', '');
  write(dir, 'tools/.gitkeep', '');
  write(dir, '.gitignore', '.env\n.env.*\n!.env.example\n!.env.public.example\n.env.local\n.dev.vars\napps/nao/.gitignore-marker\nbuild/\n');
  write(dir, 'apps/nao/.gitignore', '/.next/\n/.open-next/\n');
  const files = [
    'apps/biotope/pubspec.yaml',
    'apps/biotope/lib/main.dart',
    'apps/nao/src/app/login/page.tsx',
    'apps/nao/.env.public.example',
    'apps/nao/scripts/gen-env.mjs',
    'supabase/functions/.gitkeep',
    'tools/.gitkeep',
    '.gitignore',
    'apps/nao/.gitignore',
  ];
  initGitRepo(dir, files);
  return files;
}

test('client-surface: the base fixture (mirroring the real repo shape) passes with zero violations', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- F1_ASSET_MANIFEST ---
test('F1_ASSET_MANIFEST: fires when pubspec.yaml asset list includes a non-.env.public dotenv entry', () => {
  withTmpDir((dir) => {
    const files = buildBaseRepo(dir);
    write(dir, 'apps/biotope/pubspec.yaml', 'name: biotope\nflutter:\n  assets:\n    - .env.public\n    - .env\n');
    runGit(dir, ['add', 'apps/biotope/pubspec.yaml']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F1_ASSET_MANIFEST'));
  });
});

// --- F2_DOTENV_SOURCE ---
test('F2_DOTENV_SOURCE: fires when dotenv.load loads something other than .env.public', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/biotope/lib/main.dart',
      "import 'package:flutter_dotenv/flutter_dotenv.dart';\nvoid main() async {\n  await dotenv.load(fileName: '.env');\n}\n"
    );
    runGit(dir, ['add', 'apps/biotope/lib/main.dart']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F2_DOTENV_SOURCE'));
  });
});

// --- F3_DART_ENV_READ ---
test('F3_DART_ENV_READ: fires when Dart code reads a server-only name', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/biotope/lib/main.dart',
      "import 'package:flutter_dotenv/flutter_dotenv.dart';\nvoid main() async {\n  await dotenv.load(fileName: '.env.public');\n  final k = dotenv.env['SUPABASE_SERVICE_ROLE_KEY'];\n}\n"
    );
    runGit(dir, ['add', 'apps/biotope/lib/main.dart']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F3_DART_ENV_READ'));
  });
});

// --- F4_CLIENT_TS_ENV_READ ---
test('F4_CLIENT_TS_ENV_READ: fires when a "use client" file transitively imports a server-only reference', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/helper.ts', "export function bad() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }\n");
    write(dir, 'apps/nao/src/app/login/page.tsx', "'use client';\n\nimport { bad } from '../../lib/helper';\n\nexport default function Page() { bad(); return null; }\n");
    runGit(dir, ['add', 'apps/nao/src/lib/helper.ts', 'apps/nao/src/app/login/page.tsx']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F4_CLIENT_TS_ENV_READ'));
  });
});

test('F4_CLIENT_TS_ENV_READ: follows the active @/ alias transitively', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/alias-helper.ts', 'export const bad = process.env.SUPABASE_SERVICE_ROLE_KEY;\n');
    write(dir, 'apps/nao/src/app/login/page.tsx', "'use client';\nimport { bad } from '@/lib/alias-helper';\nexport default function Page() { return String(bad); }\n");
    runGit(dir, ['add', 'apps/nao/src/lib/alias-helper.ts', 'apps/nao/src/app/login/page.tsx']);
    assert.ok(guard.computeClientSurface({ repoRoot: dir }).violations.some((v) => v.id === 'F4_CLIENT_TS_ENV_READ'));
  });
});

// --- F5_TRACKED_BUNDLE ---
test('F5_TRACKED_BUNDLE: fires when a build-output path is tracked', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/.next/foo.js', 'console.log(1);');
    runGit(dir, ['add', '-f', 'apps/nao/.next/foo.js']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F5_TRACKED_BUNDLE'));
  });
});

// --- F6_IGNORE_INTEGRITY ---
test('F6_IGNORE_INTEGRITY: fires when a canonical build-output path is no longer ignored', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    // Remove the app-local .gitignore that ignores .open-next / .next.
    write(dir, 'apps/nao/.gitignore', '# rule removed\n');
    runGit(dir, ['add', 'apps/nao/.gitignore']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'F6_IGNORE_INTEGRITY'));
  });
});

// --- N1_EXACT_SET ---
test('N1_EXACT_SET: fires on an unapproved 4th NEXT_PUBLIC_* name', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/extra.ts', 'export const x = process.env.NEXT_PUBLIC_EXTRA_THING;\n');
    runGit(dir, ['add', 'apps/nao/src/lib/extra.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'N1_EXACT_SET'));
  });
});

// --- N2_NO_PROMOTED_SECRET ---
test('N2_NO_PROMOTED_SECRET: fires when a server-only name is promoted under NEXT_PUBLIC_', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/oops.ts', 'export const x = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;\n');
    runGit(dir, ['add', 'apps/nao/src/lib/oops.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'N2_NO_PROMOTED_SECRET'));
  });
});

// --- N3_NO_SECRET_RHS ---
test('N3_NO_SECRET_RHS: fires when a NEXT_PUBLIC_* assignment right-hand-side references a server-only name', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/oops2.ts', 'const NEXT_PUBLIC_APP_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;\n');
    runGit(dir, ['add', 'apps/nao/src/lib/oops2.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'N3_NO_SECRET_RHS'));
  });
});

// --- N4_PUBLIC_TEMPLATE_CLEAN ---
test('N4_PUBLIC_TEMPLATE_CLEAN: fires when .env.public.example declares a server-only name', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/.env.public.example',
      'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nNEXT_PUBLIC_APP_ENV=development\nSUPABASE_SERVICE_ROLE_KEY=\n'
    );
    runGit(dir, ['add', 'apps/nao/.env.public.example']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'N4_PUBLIC_TEMPLATE_CLEAN'));
  });
});

test('N4_PUBLIC_TEMPLATE_CLEAN: a "# Bad: SERVER_KEY" documentation comment does NOT false-positive (design §D.0)', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/biotope/.env.public.example',
      '# Good: SUPABASE_URL, SUPABASE_ANON_KEY\n# Bad: SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, DATABASE_PASSWORD\nSUPABASE_URL=https://x.supabase.co\nSUPABASE_ANON_KEY=x\n'
    );
    runGit(dir, ['add', 'apps/biotope/.env.public.example']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- N5_GENENV_DIRECTION (advisory) ---
test('N5_GENENV_DIRECTION: fires (advisory) when the expected write statement cannot be found', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/gen-env.mjs', '// totally refactored, no recognisable shape\nexport function run() {}\n');
    runGit(dir, ['add', 'apps/nao/scripts/gen-env.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    const n5 = result.violations.find((v) => v.id === 'N5_GENENV_DIRECTION');
    assert.ok(n5, 'expected an N5 violation');
    assert.equal(n5.advisory, true);
    assert.match(n5.detail, /re-review/);
  });
});

test('N5_GENENV_DIRECTION: fires when the client write statement mentions the secret-parse identifier', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/scripts/gen-env.mjs',
      "const publicPairs = parseDotenv(p('.env.public'));\n" +
        "const secretPairs = parseDotenv(p('.env'));\n" +
        "writeFileSync(p('.env.local'), serialize([...publicPairs, ...secretPairs]));\n"
    );
    runGit(dir, ['add', 'apps/nao/scripts/gen-env.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'N5_GENENV_DIRECTION' && v.advisory === true));
  });
});

// --- H1_RESPONSE_BODY ---
test('H1_RESPONSE_BODY: fires when a tainted identifier reaches a response constructor', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/leaky/route.ts',
      "export async function GET() {\n  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n  return NextResponse.json({ k });\n}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/leaky/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'H1_RESPONSE_BODY'));
  });
});

test('H1_RESPONSE_BODY: an untainted response body does NOT false-positive', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/safe/route.ts',
      "export async function GET() {\n  const body = { ok: true };\n  return NextResponse.json(body);\n}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/safe/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- H2_HEADERS ---
test('H2_HEADERS: fires when a tainted value is set on a RESPONSE INIT headers: literal', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/leaky2/route.ts',
      "export async function GET() {\n  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n  return new Response('{}', { headers: { 'x-debug': k } });\n}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/leaky2/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'H2_HEADERS'));
  });
});

test('H2_HEADERS: does NOT false-positive on an outbound fetch() carrying a server-only Authorization header (regression test)', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/relay/route.ts',
      "export async function POST() {\n" +
        "  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;\n" +
        "  const res = await fetch('https://example.invalid/fn', {\n" +
        "    method: 'POST',\n" +
        "    headers: { Authorization: `Bearer ${serviceRoleKey}` },\n" +
        "  });\n" +
        "  return NextResponse.json(await res.json());\n" +
        "}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/relay/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, [], 'an outbound server-to-server fetch() headers object must not be flagged as a client-surface leak');
  });
});

// --- H3_NO_BULK_ENV ---
test('H3_NO_BULK_ENV: fires on a bulk env-dump pattern anywhere in the H-scope', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'supabase/functions/leaky/index.ts', 'export default () => { return new Response(JSON.stringify({ ...process.env })); };\n');
    runGit(dir, ['add', 'supabase/functions/leaky/index.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'H3_NO_BULK_ENV'));
  });
});

test('H1_RESPONSE_BODY: rejects a bare process.env response', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/app/api/leak/route.ts', 'export const GET = () => Response.json(process.env);\n');
    runGit(dir, ['add', 'apps/nao/src/app/api/leak/route.ts']);
    assert.ok(guard.computeClientSurface({ repoRoot: dir }).violations.some((v) => v.id === 'H1_RESPONSE_BODY'));
  });
});

// --- H4_NO_COOKIE_TAINT ---
test('H4_NO_COOKIE_TAINT: fires when a tainted value is written into a cookie', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/leakycookie/route.ts',
      "export async function GET() {\n  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n  cookies().set('debug', k);\n  return NextResponse.json({});\n}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/leakycookie/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'H4_NO_COOKIE_TAINT'));
  });
});

// --- L1_LOG_CALL ---
test('L1_LOG_CALL: fires when a tainted value reaches console.log', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/leaky.mjs', 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\nconsole.log("key is", k);\n');
    runGit(dir, ['add', 'apps/nao/scripts/leaky.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'L1_LOG_CALL'));
  });
});

test('L1_LOG_CALL: logging a fixed message with only variable NAMES does not false-positive', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/safe.mjs', 'console.log("missing R2 creds: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");\n');
    runGit(dir, ['add', 'apps/nao/scripts/safe.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- L2_BULK_ENV_LOG ---
test('L2_BULK_ENV_LOG: fires when a log call argument contains a bulk env-dump pattern', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/leaky2.mjs', 'console.log(JSON.stringify(process.env));\n');
    runGit(dir, ['add', 'apps/nao/scripts/leaky2.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'L2_BULK_ENV_LOG'));
  });
});

test('L1_LOG_CALL: rejects a bare process.env log argument', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/leaky-env.mjs', 'console.log(process.env);\n');
    runGit(dir, ['add', 'apps/nao/scripts/leaky-env.mjs']);
    assert.ok(guard.computeClientSurface({ repoRoot: dir }).violations.some((v) => v.id === 'L1_LOG_CALL'));
  });
});

test('L2_BULK_ENV_LOG: tools/**/tests/** is excluded from the bulk-env-in-log scope (legit child-process env spreads)', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'tools/edge-loader/tests/edge_loader_cli.test.ts', 'const env = { ...process.env, FOO: "1" };\nconsole.log(JSON.stringify(process.env));\n');
    runGit(dir, ['add', 'tools/edge-loader/tests/edge_loader_cli.test.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- L3_THROW_MESSAGE ---
test('L3_THROW_MESSAGE: fires when a tainted value reaches a thrown Error message', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/leaky3.mjs', 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\nthrow new Error(`bad key: ${k}`);\n');
    runGit(dir, ['add', 'apps/nao/scripts/leaky3.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'L3_THROW_MESSAGE'));
  });
});

test('L3_THROW_MESSAGE: a fixed "missing creds" message naming only variable NAMES does not false-positive', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/safe3.mjs', 'throw new Error("missing R2 creds: R2_ACCESS_KEY_ID");\n');
    runGit(dir, ['add', 'apps/nao/scripts/safe3.mjs']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// --- L4_TRACE_CONTEXT ---
test('L4_TRACE_CONTEXT: fires when a tainted value reaches Sentry.captureException', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/lib/trace.ts',
      "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\nSentry.captureException(new Error('x'), { extra: { k } });\n"
    );
    runGit(dir, ['add', 'apps/nao/src/lib/trace.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.ok(result.violations.some((v) => v.id === 'L4_TRACE_CONTEXT'));
  });
});

// --- surface report is written to disk ---
test('clientSurface: writes a machine-readable surface report when --surface-report is given', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    const reportPath = path.join(dir, 'out', 'surfaces.json');
    guard.clientSurface({ repoRoot: dir, surfaceReportPath: reportPath });
    const parsed = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.ok(Array.isArray(parsed.surfaces));
    assert.ok(parsed.surfaces.every((s) => s.status === 'SCANNED'));
  });
});

test('clientSurface: required missing surfaces make manifest-invalid reachable', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    rmSync(path.join(dir, 'apps/nao/src'), { recursive: true });
    assert.ok(guard.computeClientSurface({ repoRoot: dir }).violations.some((v) => v.id === 'SURFACE_MANIFEST_INVALID'));
  });
});

test('clientSurface: required surface read failures are fatal', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    const target = path.join(dir, 'apps/biotope/pubspec.yaml');
    rmSync(target);
    mkdirSync(target);
    assert.throws(() => guard.computeClientSurface({ repoRoot: dir }), /EISDIR|illegal operation|directory/i);
  });
});

test('inspectClientBundle: requires non-empty output and rejects the synthetic canary', () => {
  withTmpDir((dir) => {
    const bundle = path.join(dir, 'static');
    mkdirSync(bundle);
    assert.throws(() => guard.inspectClientBundle({ bundleDir: bundle, canary: 'synthetic-canary' }), /empty/);
    writeFileSync(path.join(bundle, 'chunk.js'), 'safe client code');
    assert.equal(guard.inspectClientBundle({ bundleDir: bundle, canary: 'synthetic-canary' }).files, 1);
    writeFileSync(path.join(bundle, 'chunk.js'), 'contains synthetic-canary');
    assert.throws(() => guard.inspectClientBundle({ bundleDir: bundle, canary: 'synthetic-canary' }), /reached client bundle/);
  });
});

test('SERVER_ONLY_NAMES protects the nao internal-secret sender value', () => {
  assert.ok(guard.SERVER_ONLY_NAMES.includes('OUROBION_INTERNAL_SECRET'));
});

// --- the CLI-facing wrapper actually throws (non-zero node exit) on a hard violation ---
test('clientSurface: the throwing CLI wrapper fails closed (non-zero exit path) when a hard violation exists', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/src/lib/oops.ts', 'export const x = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;\n');
    runGit(dir, ['add', 'apps/nao/src/lib/oops.ts']);
    assert.throws(() => guard.clientSurface({ repoRoot: dir }), /N2_NO_PROMOTED_SECRET/);
  });
});

// --- an advisory-only violation set does NOT throw the CLI wrapper ---
test('clientSurface: an advisory-only violation (N5) does not throw the CLI-facing wrapper', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(dir, 'apps/nao/scripts/gen-env.mjs', '// totally refactored, no recognisable shape\nexport function run() {}\n');
    runGit(dir, ['add', 'apps/nao/scripts/gen-env.mjs']);
    assert.doesNotThrow(() => guard.clientSurface({ repoRoot: dir }));
  });
});

// =================================================================================================
// local-artifacts (design §D.1 part 4 — reachable-failure-path fixture proof)
// =================================================================================================

test('localArtifacts: detects a synthetic server-only value inside a local .open-next build artifact', () => {
  withTmpDir((dir) => {
    write(
      dir,
      'apps/nao/.open-next/server-functions/default/.env',
      'R2_SECRET_ACCESS_KEY=SYNTHETIC_NOT_A_REAL_KEY_000000000000\nSOME_OTHER_VAR=fine\n'
    );
    const result = guard.localArtifacts({ repoRoot: dir });
    assert.ok(result.findings.some((f) => f.key === 'R2_SECRET_ACCESS_KEY'));
  });
});

test('localArtifacts: reports no findings when no local build-output directories exist', () => {
  withTmpDir((dir) => {
    const result = guard.localArtifacts({ repoRoot: dir });
    assert.deepEqual(result.findings, []);
  });
});

test('localArtifacts: a commented-out server-only assignment is not flagged', () => {
  withTmpDir((dir) => {
    write(dir, 'apps/nao/.open-next/server-functions/default/.env', '# R2_SECRET_ACCESS_KEY=commented_out\n');
    const result = guard.localArtifacts({ repoRoot: dir });
    assert.deepEqual(result.findings, []);
  });
});

// =================================================================================================
// findCallSites / extractBalancedArgs — the balanced-paren extraction primitive
// =================================================================================================

test('findCallSites (via H1) correctly balances nested parens/strings inside a response call', () => {
  withTmpDir((dir) => {
    buildBaseRepo(dir);
    write(
      dir,
      'apps/nao/src/app/api/nested/route.ts',
      "export async function GET() {\n  return NextResponse.json({ a: foo(bar('a)b'), b: 2 });\n}\n"
    );
    runGit(dir, ['add', 'apps/nao/src/app/api/nested/route.ts']);
    const result = guard.computeClientSurface({ repoRoot: dir });
    assert.deepEqual(result.violations, []);
  });
});

// =================================================================================================
// REGRESSION LOCK — policy() over the REAL repo, with this unit's own six files TRACKED.
// =================================================================================================
//
// Why this test exists (do not delete or weaken it): every validation of this unit, up to and
// including a full manual pass, was run while the six O36 files sat UNTRACKED in the worktree (a
// fresh `git add` had never happened). `policy()`'s bypass-channel and canary-leak checks are
// scoped to `git ls-files` / `git grep` over the TRACKED tree by design — so those checks
// silently never saw this guard's own files, and two real false positives
// (BYPASS_GITLEAKS_ALLOW_COMMENT and CANARY_TOKEN_COMMITTED, both caused by this guard's own
// source necessarily mentioning the exact literals it searches for) went undetected until a
// human ran `git add -N` and re-ran `policy()` by hand. That is the textbook shape of "a guard
// that validates the tracked tree cannot be trusted until its own files are in the tracked tree."
// "policy() is clean over the real, tracked repo" must therefore be an ENFORCED INVARIANT covered
// by this suite, not a one-off manual check — otherwise the same class of regression can reappear
// silently the next time any of these six files is edited.
//
// The second assertion below (every owned file present in `git ls-files`) exists so this test
// cannot pass VACUOUSLY: if these files ever dropped out of the tracked set again (a bad
// .gitignore rule, an accidental unstage, a rebase mishap), `policy()` would simply stop seeing
// them and "pass" having checked nothing relevant — exactly the original bug. Asserting presence
// first means that failure mode fails loudly here too.
test('REGRESSION LOCK: policy() passes over the real repo, with all six O36 files present in git ls-files', () => {
  const realRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ownedFiles = [
    'tools/secret-scan/pins.json',
    'tools/secret-scan/pin.mjs',
    'tools/secret-scan/gitleaks.toml',
    'tools/secret-scan/allowlist.json',
    'tools/secret_scan_guard.mjs',
    'tools/secret_scan_guard.test.mjs',
  ];

  const tracked = guard.gitLsFiles(realRepoRoot);
  for (const f of ownedFiles) {
    assert.ok(
      tracked.includes(f),
      `expected "${f}" to be present in \`git ls-files\` at ${realRepoRoot} (got ${tracked.length} tracked files total) — ` +
        'if this fails, the six O36 files are untracked again and this test would otherwise pass vacuously'
    );
  }

  const configPath = path.join(realRepoRoot, 'tools/secret-scan/gitleaks.toml');
  const allowlistPath = path.join(realRepoRoot, 'tools/secret-scan/allowlist.json');
  assert.doesNotThrow(() => guard.policy({ configPath, allowlistPath, repoRoot: realRepoRoot }));
});
