// tools/check_arch_boundaries.test.mjs
//
// Tests for the O35 architecture-boundary guard. Run with:
//   node --test tools/check_arch_boundaries.test.mjs
//
// All synthetic fixtures are constructed in memory as { path, content }
// objects — nothing is written to disk or committed.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyze,
  buildAliasMap,
  buildPackageMap,
  classifySpecifier,
  isCompositionRoot,
  moduleIdOf,
  owningModuleOf,
  parseJsonc,
  readPubspecName,
  GuardError,
  __internal,
} from './check_arch_boundaries.mjs';

// ---------------------------------------------------------------------------
// SELF-SCAN HYGIENE
//
// The guard scans every tracked source file — including THIS one. A fixture
// written as a plain literal would therefore be re-read as a real import or a
// real path reference belonging to tools/check_arch_boundaries.test.mjs, and
// reported as a violation of the very rules under test.
//
// The fix is NOT an exclusion. This guard deliberately has no allowlist, no
// skip-list and no ignore-comment mechanism, and must keep it that way — one
// exclusion would be a permanent hole and a precedent. Instead every forbidden
// token is COMPOSED AT RUNTIME from fragments, so the complete pattern exists
// only in memory and never in this file's bytes. Assertions then match against
// the composed constants, so each test still proves that the intended rule
// fired for the intended reason.
//
// Invariant to preserve when editing this file: no fixture may contain a
// verbatim forbidden literal, a verbatim `import`/`export <spec>` directive, or
// a verbatim subprocess trigger token adjacent to a forbidden literal. The
// "regression lock" test at the bottom enforces this mechanically.
// ---------------------------------------------------------------------------

/** The isolated training package's directory name ("model", hyphen, "training"). */
const MT = `model-${'training'}`;
/** That package's importable Python module name ("ourobion" then "_model_lab"). */
const LAB = `ourobion${'_model_lab'}`;
/** Subprocess trigger tokens R2b scans for. */
const EXEC_SYNC = `execFile${'Sync'}`;
const SPAWN = `spa${'wn'}`;
/** Directive keywords — a verbatim one would be extracted as OUR OWN import. */
const IMPORT_KW = `imp${'ort'}`;
const EXPORT_KW = `exp${'ort'}`;

/** Builds `import [<clause> from ]'<spec>';` fixture source. */
function imp(spec, clause) {
  return `${IMPORT_KW} ${clause ? `${clause} from ` : ''}'${spec}';\n`;
}

/** Builds `export [<clause> from ]'<spec>';` fixture source. */
function exp(spec, clause) {
  return `${EXPORT_KW} ${clause ? `${clause} from ` : ''}'${spec}';\n`;
}

/** Builds a `<trigger>(<args>);` subprocess-call fixture line. */
function call(trigger, args) {
  return `${trigger}(${args});\n`;
}

function findViolations(violations, rule, file) {
  return violations.filter((v) => v.rule === rule && v.file === file);
}

/** Asserts exactly one violation of `rule` in `file`, and returns it. */
function expectOne(result, rule, file) {
  const hits = findViolations(result.violations, rule, file);
  assert.equal(
    hits.length,
    1,
    `expected exactly 1 ${rule} violation in ${file}, got ${hits.length}: ${JSON.stringify(result.violations, null, 2)}`,
  );
  return hits[0];
}

// ---------------------------------------------------------------------------
// POSITIVE cases — must produce ZERO violations
// ---------------------------------------------------------------------------

test('positive: same-module import into its own impl/ — no violation', () => {
  const files = [
    { path: 'appmod/modules/a/impl/secret.ts', content: 'export const Secret = 1;\n' },
    { path: 'appmod/modules/a/user.ts', content: `${imp('./impl/secret.ts', '{ Secret }')}export const y = Secret;\n` },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
  assert.ok(result.scannedCount > 0);
});

test('positive: cross-module import of a sibling module\'s index facade (ts + dart) — no violation', () => {
  const files = [
    { path: 'appmod/modules/b/index.ts', content: exp('./impl/thing.ts', '*') },
    { path: 'appmod/modules/a/consumer.ts', content: `${imp('../b/index.ts', '{ Thing }')}export const t = Thing;\n` },
    { path: 'appmod/modules/b/index.dart', content: exp('impl/thing.dart') },
    { path: 'appmod/modules/a/consumer.dart', content: imp('../b/index.dart') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test('positive: relative import into shared/ from apps/ — no violation', () => {
  const files = [
    { path: 'shared/types/foo.ts', content: 'export type Foo = { id: string };\n' },
    { path: 'apps/testapp/consumer.ts', content: imp('../../shared/types/foo.ts', 'type { Foo }') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test('positive: TS alias import resolving inside the same app — no violation', () => {
  const files = [
    {
      path: 'appx/tsconfig.json',
      content: JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    },
    { path: 'appx/src/lib/other.ts', content: 'export const other = 1;\n' },
    { path: 'appx/src/app/page.ts', content: `${imp('@/lib/other', '{ other }')}export const p = other;\n` },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test(`positive: subprocess call that does not reference ${MT} — no violation`, () => {
  const files = [
    {
      path: 'tools/somepkg/runner.mjs',
      content: imp('node:child_process', `{ ${EXEC_SYNC} }`) + call(EXEC_SYNC, "'git', ['status']"),
    },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test('positive: string literals with "training" alone or "model_training_notes" do not match the path pattern', () => {
  const files = [
    {
      path: 'shared/notes.ts',
      content: "export const a = 'training';\nexport const b = 'model_training_notes';\n",
    },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

// ---------------------------------------------------------------------------
// NEGATIVE cases — one per rule, asserting rule id + reason
// ---------------------------------------------------------------------------

test('negative R1 (TypeScript): module A importing ../b/impl/secret.ts is flagged', () => {
  const files = [
    {
      path: 'appmod/modules/a/consumer.ts',
      content: `${imp('../b/impl/secret.ts', '{ Secret }')}export const s = Secret;\n`,
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R1', 'appmod/modules/a/consumer.ts');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, /\.\.\/b\/impl\/secret\.ts/);
  assert.match(hits[0].detail, /appmod\/modules\/b/);
});

test('negative R1 (Dart): module A importing ../b/impl/secret.dart is flagged', () => {
  const files = [
    { path: 'appmod/modules/a/consumer.dart', content: imp('../b/impl/secret.dart') },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R1', 'appmod/modules/a/consumer.dart');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, /\.\.\/b\/impl\/secret\.dart/);
  assert.match(hits[0].detail, /appmod\/modules\/b/);
});

test(`negative R2a: apps/ importing ../../${MT}/src/x.ts is flagged`, () => {
  const files = [
    {
      path: 'apps/foo/consumer.ts',
      content: `${imp(`../../${MT}/src/x.ts`, '{ X }')}export const x = X;\n`,
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2a', 'apps/foo/consumer.ts');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, new RegExp(MT));
});

test(`negative R2a: apps/ importing bare ${LAB} specifier is flagged`, () => {
  const files = [
    { path: 'apps/foo/consumer2.ts', content: `${imp(LAB, 'x')}export const y = x;\n` },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2a', 'apps/foo/consumer2.ts');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, new RegExp(LAB));
});

test(`negative R2b: tools/ subprocess call referencing ${LAB} is flagged`, () => {
  const files = [
    {
      path: 'tools/foo/runner.mjs',
      content: imp('node:child_process', `{ ${EXEC_SYNC} }`)
        + call(EXEC_SYNC, `'python', ['-m', '${LAB}.cli']`),
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2b', 'tools/foo/runner.mjs');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, new RegExp(LAB));
  assert.match(hits[0].detail, new RegExp(EXEC_SYNC));
});

test(`negative R2b: tools/ subprocess call referencing a ${MT}/ path is flagged`, () => {
  const files = [
    {
      path: 'tools/foo/runner2.mjs',
      content: imp('node:child_process', `{ ${SPAWN} }`)
        + call(SPAWN, `'python', ['${MT}/run.py']`),
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2b', 'tools/foo/runner2.mjs');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, new RegExp(`${MT}/run\\.py`));
  assert.match(hits[0].detail, new RegExp(SPAWN));
});

test(`negative R2c: shared/ string literal referencing a ${MT} path is flagged`, () => {
  const files = [
    {
      path: 'shared/config/paths.ts',
      content: `export const P = '${MT}/manifests/x.json';\n`,
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2c', 'shared/config/paths.ts');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
  assert.match(hits[0].detail, new RegExp(`${MT}/manifests/x\\.json`));
});

// ---------------------------------------------------------------------------
// R1 IMPORT-FORM COVERAGE
//
// These pin the two Dart forms an earlier revision of this guard could not see
// at all — dot-less relative imports and `package:` imports. Each negative case
// asserts the rule id AND the offending specifier, so it can only pass by
// firing for the intended reason.
// ---------------------------------------------------------------------------

test("form coverage: Dart '../' cross-module reach into impl/ is flagged", () => {
  const files = [
    { path: 'app/lib/modules/m2/impl/y.dart', content: 'class Y {}\n' },
    { path: 'app/lib/modules/m1/x.dart', content: imp('../m2/impl/y.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/lib/modules/m1/x.dart');
  assert.match(v.detail, /\.\.\/m2\/impl\/y\.dart/);
  assert.equal(v.line, 1);
  assert.match(v.detail, /app\/lib\/modules\/m2/);
  assert.match(v.detail, /app\/lib\/modules\/m1/);
});

test('form coverage: Dart DOT-LESS relative reach into impl/ is flagged (was invisible)', () => {
  // `app/lib/sub/deep.dart` is outside modules/ but NOT directly in lib/, so it
  // gets no composition-root exemption. The dot-less specifier resolves against
  // the importing file's own directory, exactly as Dart does.
  const files = [
    { path: 'app/lib/modules/m2/impl/y.dart', content: 'class Y {}\n' },
    { path: 'app/lib/sub/deep.dart', content: imp('modules/m2/impl/y.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/lib/sub/deep.dart');
  assert.match(v.detail, /"modules\/m2\/impl\/y\.dart"/);
  assert.match(v.detail, /app\/lib\/sub\/modules\/m2\/impl\/y\.dart/);
  assert.equal(v.line, 1);
});

test('form coverage: dot-less specifier is resolved, never classified external', () => {
  const res = classifySpecifier('app/lib/main.dart', 'modules/m1/impl/x.dart', {});
  assert.deepEqual(res, { kind: 'internal', target: 'app/lib/modules/m1/impl/x.dart' });
});

test('form coverage: `package:<name>/...` reach into another module impl/ is flagged, via pubspec-derived mapping', () => {
  // The pubspec declares name `mypkg` while the directory is `app` — proving the
  // mapping is data-driven and not derived from the directory name.
  const files = [
    { path: 'app/pubspec.yaml', content: 'name: mypkg\ndescription: "x"\nversion: 1.0.0+1\n' },
    { path: 'app/lib/modules/m2/impl/y.dart', content: 'class Y {}\n' },
    { path: 'app/lib/modules/m1/consumer.dart', content: imp('package:mypkg/modules/m2/impl/y.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/lib/modules/m1/consumer.dart');
  assert.match(v.detail, /"package:mypkg\/modules\/m2\/impl\/y\.dart"/);
  // resolved through <pubspecDir>/lib/<sub>, i.e. app/lib/...
  assert.match(v.detail, /app\/lib\/modules\/m2\/impl\/y\.dart/);
  assert.match(v.detail, /app\/lib\/modules\/m1/);
});

test('form coverage: `package:` name mapping is by pubspec `name:`, not by directory name', () => {
  const roots = buildPackageMap({
    files: [{ path: 'app/pubspec.yaml', content: '# name: decoy\nname: mypkg\n' }],
  });
  assert.equal(roots.get('mypkg'), 'app');
  assert.equal(roots.get('app'), undefined);
  assert.deepEqual(
    classifySpecifier('app/lib/x.dart', 'package:mypkg/modules/m2/impl/y.dart', { packageRoots: roots }),
    { kind: 'internal', target: 'app/lib/modules/m2/impl/y.dart' },
  );
});

test('form coverage: readPubspecName handles quotes, inline comments, and only column-0 keys', () => {
  assert.equal(readPubspecName('name: src\n'), 'src');
  assert.equal(readPubspecName("name: 'quoted'  # trailing\n"), 'quoted');
  assert.equal(readPubspecName('flutter:\n  name: nested\n'), null);
  assert.equal(readPubspecName('description: nope\n'), null);
});

test('form coverage: dart: and third-party package: specifiers are explicitly external, not violations', () => {
  const files = [
    { path: 'app/pubspec.yaml', content: 'name: mypkg\n' },
    {
      path: 'app/lib/modules/m1/x.dart',
      content: imp('dart:convert')
        + imp('package:flutter/material.dart')
        + imp('package:supabase_flutter/supabase_flutter.dart'),
    },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
  assert.equal(classifySpecifier('app/lib/x.dart', 'dart:convert', {}).kind, 'external');
  assert.equal(classifySpecifier('app/lib/x.dart', 'package:flutter/material.dart', {}).kind, 'external');
  // JS/TS bare specifiers stay external — a dot-less TS specifier is a package
  // name, NOT a relative path (the language split matters).
  assert.equal(classifySpecifier('app/src/x.ts', 'react', {}).kind, 'external');
  assert.equal(classifySpecifier('app/src/x.ts', 'node:path', {}).kind, 'external');
});

test('positive: same-module deep impl/ subdirectory via ../../impl/ stays clean (real-repo shape)', () => {
  const files = [
    { path: 'app/pubspec.yaml', content: 'name: src\n' },
    { path: 'app/lib/modules/m2/impl/normaliser.dart', content: 'class N {}\n' },
    { path: 'app/lib/modules/m2/impl/behaviour/mosquito_logging.dart', content: 'class M {}\n' },
    {
      path: 'app/lib/modules/m2/ui/screens/daily_log_screen.dart',
      content: imp('../../impl/normaliser.dart') + imp('../../impl/behaviour/mosquito_logging.dart'),
    },
    // dot-less, same directory — the index façade shape used across the repo
    { path: 'app/lib/modules/m2/index.dart', content: exp('impl/normaliser.dart') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

// ---------------------------------------------------------------------------
// COMPOSITION-ROOT EXEMPTION — both directions, to pin its narrowness
// ---------------------------------------------------------------------------

test('composition root: app/lib/main.dart importing modules/m1/impl/x.dart is EXEMPT (zero violations)', () => {
  const files = [
    { path: 'app/lib/modules/m1/impl/x.dart', content: 'class X {}\n' },
    { path: 'app/lib/main.dart', content: imp('modules/m1/impl/x.dart') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
  // ...and it was exempt, not merely unparsed:
  assert.deepEqual(
    classifySpecifier('app/lib/main.dart', 'modules/m1/impl/x.dart', {}),
    { kind: 'internal', target: 'app/lib/modules/m1/impl/x.dart' },
  );
  assert.equal(isCompositionRoot('app/lib/main.dart'), true);
});

test('composition root: the SAME import from app/lib/sub/deep.dart is NOT exempt (violation)', () => {
  const files = [
    { path: 'app/lib/modules/m1/impl/x.dart', content: 'class X {}\n' },
    { path: 'app/lib/sub/deep.dart', content: imp('modules/m1/impl/x.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/lib/sub/deep.dart');
  assert.match(v.detail, /"modules\/m1\/impl\/x\.dart"/);
  assert.equal(isCompositionRoot('app/lib/sub/deep.dart'), false);
});

test('composition root: exemption is positional only — nested lib/ dirs and non-lib parents', () => {
  assert.equal(isCompositionRoot('apps/biotope/lib/main.dart'), true);
  assert.equal(isCompositionRoot('lib/main.dart'), true);
  assert.equal(isCompositionRoot('apps/biotope/lib/core/theme.dart'), false);
  assert.equal(isCompositionRoot('apps/biotope/libs/main.dart'), false);
  assert.equal(isCompositionRoot('apps/biotope/test/widget_test.dart'), false);
});

// ---------------------------------------------------------------------------
// TEST-DIRECTORY MODULE MAPPING — both directions
// ---------------------------------------------------------------------------

const TEST_MAPPING_FIXTURES = [
  { path: 'app/pubspec.yaml', content: 'name: n\n' },
  { path: 'app/lib/modules/m1/index.dart', content: exp('impl/z.dart') },
  { path: 'app/lib/modules/m1/impl/z.dart', content: 'class Z {}\n' },
  { path: 'app/lib/modules/m2/impl/y.dart', content: 'class Y {}\n' },
];

test('test-dir mapping: app/test/m2/foo_test.dart importing its OWN module impl is clean', () => {
  const files = [
    ...TEST_MAPPING_FIXTURES,
    { path: 'app/test/m2/foo_test.dart', content: imp('package:n/modules/m2/impl/y.dart') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test('test-dir mapping: app/test/m1/foo_test.dart importing m2 impl is a CROSS-module violation', () => {
  const files = [
    ...TEST_MAPPING_FIXTURES,
    { path: 'app/test/m1/foo_test.dart', content: imp('package:n/modules/m2/impl/y.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/test/m1/foo_test.dart');
  assert.match(v.detail, /"package:n\/modules\/m2\/impl\/y\.dart"/);
  assert.match(v.detail, /app\/lib\/modules\/m2/);
  // proves the importer was mapped to m1 rather than treated as module-less
  assert.match(v.detail, /importing module: "app\/lib\/modules\/m1"/);
});

test('test-dir mapping: a test segment with no matching module dir maps to no module (still a violation)', () => {
  const files = [
    ...TEST_MAPPING_FIXTURES,
    { path: 'app/test/guards/foo_test.dart', content: imp('package:n/modules/m2/impl/y.dart') },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'app/test/guards/foo_test.dart');
  assert.match(v.detail, /importing module: <none/);
  assert.equal(owningModuleOf('app/test/guards/foo_test.dart', new Set(['app/lib/modules/m1'])), null);
});

test('module identity: ids carry their full path prefix, so same-named modules in different apps differ', () => {
  assert.equal(moduleIdOf('a/lib/modules/m1/impl/x.dart'), 'a/lib/modules/m1');
  assert.equal(moduleIdOf('b/lib/modules/m1/impl/x.dart'), 'b/lib/modules/m1');
  assert.equal(moduleIdOf('modules/m1/x.ts'), 'modules/m1');
  assert.equal(moduleIdOf('app/lib/core/theme.dart'), null);

  // Both modules are named `m1`, in different apps. The importer walks up
  // exactly to the repo root (4 segments up from a/lib/modules/m1) and back
  // down into app b, so nothing escapes the root.
  const files = [
    { path: 'b/lib/modules/m1/impl/x.dart', content: 'class X {}\n' },
    {
      path: 'a/lib/modules/m1/consumer.dart',
      content: imp('../../../../b/lib/modules/m1/impl/x.dart'),
    },
  ];
  const v = expectOne(analyze({ files }), 'R1', 'a/lib/modules/m1/consumer.dart');
  assert.match(v.detail, /owned by module "b\/lib\/modules\/m1"/);
  assert.match(v.detail, /importing module: "a\/lib\/modules\/m1"/);
});

// ---------------------------------------------------------------------------
// SCOPE PROOF for R2c — deliberate scope limit, no allowlist needed
// ---------------------------------------------------------------------------

test('scope proof: the same R2c-style literal in tools/ (not tools/brain-ingest/) is NOT flagged', () => {
  const files = [
    {
      path: 'tools/run4_release_gate_like.mjs',
      content: `const workingDir = '${MT}/manifests/x.json';\n`,
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2c', 'tools/run4_release_gate_like.mjs');
  assert.equal(hits.length, 0, JSON.stringify(result.violations));
});

test('scope proof: the same literal in tools/brain-ingest/ IS flagged', () => {
  const files = [
    {
      path: 'tools/brain-ingest/src/whatever.ts',
      content: `const workingDir = '${MT}/manifests/x.json';\n`,
    },
  ];
  const result = analyze({ files });
  const hits = findViolations(result.violations, 'R2c', 'tools/brain-ingest/src/whatever.ts');
  assert.equal(hits.length, 1, JSON.stringify(result.violations));
});

// ---------------------------------------------------------------------------
// FAIL-CLOSED tests
// ---------------------------------------------------------------------------

test('fail-closed: unsupported tsconfig "paths" form throws', () => {
  const files = [
    {
      path: 'weird/tsconfig.json',
      content: JSON.stringify({ compilerOptions: { paths: { '@/*/utils': ['./src/*/utils'] } } }),
    },
    { path: 'weird/x.ts', content: 'export const a = 1;\n' },
  ];
  assert.throws(
    () => analyze({ files }),
    (err) => err instanceof GuardError && /paths/.test(err.message),
  );
});

test('fail-closed: buildAliasMap directly throws on multiple "*" in a paths key', () => {
  const files = [
    {
      path: 'weird2/tsconfig.json',
      content: JSON.stringify({ compilerOptions: { paths: { '@/*/*': ['./src/*/*'] } } }),
    },
  ];
  assert.throws(
    () => buildAliasMap({ files }),
    (err) => err instanceof GuardError,
  );
});

test('fail-closed: buildAliasMap throws when targets disagree in shape', () => {
  const files = [
    {
      path: 'weird3/tsconfig.json',
      content: JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*', './lib/other'] } } }),
    },
  ];
  assert.throws(
    () => buildAliasMap({ files }),
    (err) => err instanceof GuardError,
  );
});

test('fail-closed: parseJsonc handles comments and trailing commas', () => {
  const parsed = parseJsonc(`{
    // a comment
    "a": 1,
    /* block */
    "b": [1, 2,],
  }`);
  assert.deepEqual(parsed, { a: 1, b: [1, 2] });
});

test('fail-closed: empty file set is rejected', () => {
  assert.throws(
    () => analyze({ files: [] }),
    (err) => err instanceof GuardError && /empty/i.test(err.message),
  );
  assert.throws(
    () => analyze({ files: new Map() }),
    (err) => err instanceof GuardError && /empty/i.test(err.message),
  );
});

test('fail-closed: comment-only occurrence of a forbidden import is not flagged, but the same line uncommented is', () => {
  const forbidden = imp(`../../${MT}/src/x.ts`);
  const files = [
    { path: 'apps/foo/commented.ts', content: `// ${forbidden}` },
    { path: 'apps/foo/uncommented.ts', content: forbidden },
  ];
  const result = analyze({ files });
  assert.equal(findViolations(result.violations, 'R2a', 'apps/foo/commented.ts').length, 0, JSON.stringify(result.violations));
  assert.equal(findViolations(result.violations, 'R2a', 'apps/foo/uncommented.ts').length, 1, JSON.stringify(result.violations));
});

test('fail-closed: a resolved target that ESCAPES the repository root throws', () => {
  // path.posix.join('a', '../../outside/y.ts') normalises to '../outside/y.ts',
  // which is not a repo-relative path at all. Treating it as one silently
  // corrupts module identity, the impl/ test and the composition-root test,
  // because they all read a prefix that does not exist in this repository.
  assert.throws(
    () => analyze({ files: [{ path: 'a/x.ts', content: imp('../../outside/y.ts') }] }),
    (err) => err instanceof GuardError
      && /escapes the repository root/.test(err.message)
      && /a\/x\.ts/.test(err.message)
      && /\.\.\/\.\.\/outside\/y\.ts/.test(err.message)
      && /"\.\.\/outside\/y\.ts"/.test(err.message),
  );
  // Dart resolution is guarded on the same path.
  assert.throws(
    () => classifySpecifier('a/x.dart', '../../outside/y.dart', {}),
    (err) => err instanceof GuardError && /escapes the repository root/.test(err.message),
  );
  // Walking up to EXACTLY the repo root is fine — only going above it throws.
  assert.deepEqual(
    classifySpecifier('a/x.ts', '../b/y.ts', {}),
    { kind: 'internal', target: 'b/y.ts' },
  );
});

test('fail-closed: an UNRESOLVABLE package: import reaching into a module impl/ throws instead of passing', () => {
  // No pubspec declares `app`, so `package:app/...` cannot be resolved. Because
  // its subpath reaches into a module's impl/ we cannot prove it is same-module,
  // so the guard must refuse to run rather than silently ignore the form. This
  // is the specific regression that would re-open the fail-open hole.
  const files = [
    { path: 'app/pubspec.yaml', content: 'name: mypkg\n' },
    { path: 'app/lib/modules/m2/impl/y.dart', content: 'class Y {}\n' },
    { path: 'app/lib/modules/m1/consumer.dart', content: imp('package:app/modules/m2/impl/y.dart') },
  ];
  assert.throws(
    () => analyze({ files }),
    (err) => err instanceof GuardError
      && /cannot evaluate R1/.test(err.message)
      && /package:app\/modules\/m2\/impl\/y\.dart/.test(err.message),
  );
});

test('fail-closed: an unresolvable package: import NOT reaching into impl/ is external, not an error', () => {
  const files = [
    { path: 'app/pubspec.yaml', content: 'name: mypkg\n' },
    { path: 'app/lib/modules/m1/consumer.dart', content: imp('package:flutter/material.dart') },
  ];
  const result = analyze({ files });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
});

test('fail-closed: pubspec.yaml without a top-level name: throws', () => {
  const files = [
    { path: 'app/pubspec.yaml', content: 'description: "no name here"\nversion: 1.0.0\n' },
    { path: 'app/lib/main.dart', content: imp('core/theme.dart') },
  ];
  assert.throws(
    () => analyze({ files }),
    (err) => err instanceof GuardError && /no top-level "name:"/.test(err.message),
  );
});

test('fail-closed: two pubspecs declaring the same package name throw (ambiguous mapping)', () => {
  assert.throws(
    () => buildPackageMap({
      files: [
        { path: 'a/pubspec.yaml', content: 'name: dup\n' },
        { path: 'b/pubspec.yaml', content: 'name: dup\n' },
      ],
    }),
    (err) => err instanceof GuardError && /same package name "dup"/.test(err.message),
  );
});

test('fail-closed: a malformed or unknown-scheme Dart directive throws rather than being assumed safe', () => {
  assert.throws(
    () => analyze({ files: [{ path: 'app/lib/x.dart', content: imp('package:noslash') }] }),
    (err) => err instanceof GuardError && /malformed Dart package URI/.test(err.message),
  );
  assert.throws(
    () => analyze({ files: [{ path: 'app/lib/x.dart', content: imp('https://example.com/x.dart') }] }),
    (err) => err instanceof GuardError && /unrecognised URI scheme/.test(err.message),
  );
});

test(`fail-closed: Dart dot-less "${MT}/..." is still flagged by R2a despite now resolving`, () => {
  // Dot-less Dart resolution turns this into apps/foo/<training-dir>/run.dart,
  // which no longer starts with the training dir — so R2a must ALSO inspect the
  // literal leading segment, or successful resolution would swallow the breach.
  const files = [
    { path: 'apps/foo/x.dart', content: imp(`${MT}/run.dart`) },
  ];
  const v = expectOne(analyze({ files }), 'R2a', 'apps/foo/x.dart');
  assert.match(v.detail, new RegExp(`${MT}/run\\.dart`));
});

// ---------------------------------------------------------------------------
// REAL-REPO regression tests
// ---------------------------------------------------------------------------

test('real repo: the previously-invisible Dart forms are actually resolved (the pass is not blindness)', () => {
  const files = __internal.collectRepoFiles({ repoRoot: __internal.REPO_ROOT });

  // The pubspec sidecar must reach the analyzer, otherwise `package:` imports
  // would degrade to "external" and R1 would go blind again.
  const pubspecs = files.filter((f) => f.path.endsWith('pubspec.yaml'));
  assert.ok(pubspecs.length > 0, 'expected at least one pubspec.yaml in the collected file set');
  const packageRoots = buildPackageMap({ files: pubspecs });
  assert.ok(packageRoots.size > 0);

  // Every real Dart import that mentions impl/ must classify as INTERNAL —
  // i.e. the guard resolves it and evaluates R1 on it, rather than skipping it.
  const dartFiles = files.filter((f) => f.path.endsWith('.dart'));
  assert.ok(dartFiles.length > 0);
  let implImportsSeen = 0;
  let dotlessSeen = 0;
  let packageSeen = 0;
  for (const f of dartFiles) {
    const re = /^[ \t]*(?:import|export|part)[ \t]+'([^']*impl\/[^']*)'/gm;
    let m = re.exec(f.content);
    while (m !== null) {
      const spec = m[1];
      const res = classifySpecifier(f.path, spec, { packageRoots });
      assert.equal(res.kind, 'internal', `unresolved impl-reaching specifier "${spec}" in ${f.path}`);
      implImportsSeen += 1;
      if (spec.startsWith('package:')) packageSeen += 1;
      else if (!spec.startsWith('./') && !spec.startsWith('../')) dotlessSeen += 1;
      m = re.exec(f.content);
    }
  }
  assert.ok(implImportsSeen > 0, 'expected real impl/ imports to exist in the tracked tree');
  assert.ok(dotlessSeen > 0, 'expected real DOT-LESS relative impl/ imports (e.g. apps/biotope/lib/main.dart)');
  assert.ok(packageSeen > 0, 'expected real package: impl/ imports (e.g. apps/biotope/test/**)');
});

test('regression lock: the guard scans ITSELF, and is clean under its own rules', () => {
  // A guard that is not in `git ls-files` is a guard that has never been
  // scanned. That is how this file's own fixtures once slipped through: both
  // files were untracked, so the "zero violations" result below was vacuous for
  // them. This lock makes "the guard is scanned AND clean" an enforced
  // invariant, and it fails loudly if the self-scan hygiene at the top of this
  // file is ever broken by a new verbatim fixture.
  const files = __internal.collectRepoFiles({ repoRoot: __internal.REPO_ROOT });
  const scannedPaths = new Set(files.map((f) => f.path));

  for (const ownPath of ['tools/check_arch_boundaries.mjs', 'tools/check_arch_boundaries.test.mjs']) {
    assert.ok(
      scannedPaths.has(ownPath),
      `${ownPath} is missing from the scanned set — the guard must be tracked by git so it scans itself`,
    );
  }

  const result = analyze({ files });
  assert.equal(
    result.violations.length,
    0,
    `the guard's own files must not violate its rules; found:\n${result.violations
      .map((v) => `${v.rule} ${v.file}:${v.line} -> ${v.detail}`)
      .join('\n')}`,
  );
});

test('real repo: zero violations over the tracked worktree, and files were actually scanned', () => {
  const files = __internal.collectRepoFiles({ repoRoot: __internal.REPO_ROOT });
  const result = analyze({ files });
  assert.ok(result.scannedCount > 0, 'expected at least one scanned source file');
  assert.equal(
    result.violations.length,
    0,
    `expected zero real violations, found:\n${result.violations
      .map((v) => `${v.rule} ${v.file}:${v.line} -> ${v.detail}`)
      .join('\n')}`,
  );
});
