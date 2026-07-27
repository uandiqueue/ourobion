#!/usr/bin/env node
// tools/check_arch_boundaries.mjs
//
// O35 architecture-boundary guard. Mechanises two prose rules from AGENTS.md:
//
//   R1  — "No module imports from another module's /impl directory — public
//          index/facade only." (docs/biotope/architecture-context.md:146,
//          docs/shared/agent-protocol.md:84)
//   R2  — model-training isolation (AGENTS.md "Language is task-fit" section):
//          apps/, supabase/, shared/, tools/ must not import, subprocess-invoke,
//          or path-construct into model-training/.
//
// Node standard library ONLY. No third-party imports. ESM, runs under Node 20+.
//
// Structure: a PURE analyzer (`analyze`, `buildAliasMap`, `buildPackageMap`,
// `classifySpecifier`, `parseJsonc`, ...) that never touches the filesystem or
// git, plus a thin CLI driver at the bottom that only runs when this module is
// executed directly.
//
// ---------------------------------------------------------------------------
// R1 SEMANTICS (the part that must not fail open)
// ---------------------------------------------------------------------------
//
// (a) IMPORT-FORM COVERAGE. Every extracted specifier is *classified*, never
//     silently dropped. `classifySpecifier` returns either
//     { kind: 'internal', target } — a repo-relative path — or
//     { kind: 'external', reason } — a form that provably cannot denote a path
//     inside this repository (Dart SDK libraries, third-party pub packages,
//     npm/`node:` bare specifiers). A form that is neither resolvable nor
//     provably external throws a GuardError. In particular Dart's DOT-LESS
//     RELATIVE form (`modules/m1_core/impl/auth_service.dart`) and its
//     `package:<name>/<sub>` form are both resolved — they are the two forms
//     that actually appear in apps/biotope and an earlier revision of this
//     guard was blind to both.
//
// (b) MODULE IDENTITY. A path's owning module is the full path prefix through
//     the first `modules/<name>` segment pair (see MODULE_SEGMENT_RE), so
//     modules in different apps can never collide. Additionally, a test file
//     at `<app>/test/<seg>/...` belongs to module `<app>/lib/modules/<seg>`
//     when that module directory is present in the scanned file set — this is
//     derived from the data, never from a hardcoded module list.
//
// (c) COMPOSITION-ROOT EXEMPTION. The prose rule bans a *module* importing
//     another *module's* impl. A file located DIRECTLY in a `lib/` directory
//     (e.g. apps/biotope/lib/main.dart) is the app composition root: it is not
//     a module, so wiring imports from it are outside the rule's scope. This
//     exemption is deliberately NARROW — it applies only to files whose parent
//     directory is itself named `lib`. Any file at a deeper path outside
//     `modules/` (e.g. `<app>/lib/sub/deep.dart`) gets no exemption and IS a
//     violation if it reaches into a module's impl/.
//
// (d) VIOLATION CONDITION. Flag when the resolved target lies inside
//     `<M_to>/impl/`, `M_to` is a module, the importer is not the composition
//     root, and the importer's owning module `M_from` !== `M_to`. An importer
//     with no owning module (and no exemption) therefore violates, which is
//     what makes (c)'s narrowness meaningful.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCANNED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.dart',
]);

// Sidecar manifests that are read for *resolution context* only — they are
// never themselves scanned for rule violations.
export const TSCONFIG_BASENAME = 'tsconfig.json';
export const PUBSPEC_BASENAME = 'pubspec.yaml';

// Owning-module identity: the full path prefix through the FIRST
// `modules/<name>` segment pair. `apps/biotope/lib/modules/m1_core/impl/x.dart`
// -> `apps/biotope/lib/modules/m1_core`.
const MODULE_SEGMENT_RE = /(?:^|\/)modules\/([^/]+)(?=\/|$)/;

// A test file at `<app>/test/<seg>/...` may map to module
// `<app>/lib/modules/<seg>`. Non-greedy so the FIRST `test/` wins.
const TEST_DIR_RE = /^(?:(.*?)\/)?test\/([^/]+)\//;

// Used only for the fail-closed check in checkR1: an *unresolved* `package:`
// subpath that reaches into a module's impl/ means we cannot prove the import
// is same-module, so the guard refuses to run rather than pass silently.
const MODULE_IMPL_SUBPATH_RE = /(?:^|\/)modules\/[^/]+\/impl\//;

// Any RFC-3986-style URI scheme prefix (`dart:`, `package:`, `http:`, ...).
const URI_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

// AGENTS.md's exact stated import-ban scope for R2a/R2b (apps/, supabase/,
// shared/, tools/) and the narrower R2c scope (apps/, supabase/, shared/,
// tools/brain-ingest/ only — deliberately excludes the rest of tools/, which
// legitimately contains the literal strings "model-training*" as CI job
// names/working-directory expectations — see tools/run4_release_gate.mjs).
const R2_IMPORT_SUBPROCESS_SCOPE = ['apps/', 'supabase/', 'shared/', 'tools/'];
const R2C_PATH_SCOPE = ['apps/', 'supabase/', 'shared/', 'tools/brain-ingest/'];

// Matches a model-training path reference: the literal segment "model-training"
// preceded by start-of-string, '.', or '/', and followed by '/' or end-of-string.
const MODEL_TRAINING_PATH_RE = /(^|[.\\/])model-training([\\/]|$)/;
const OUROBION_MODEL_LAB_MARKER = 'ourobion_model_lab';
const RELEVANT_UNRESOLVED_IMPORT_RE = /(?:model-training|ourobion_model_lab|modules[\\/].*[\\/]impl[\\/])/;

// ---------------------------------------------------------------------------
// GuardError — thrown for every fail-closed condition the analyzer detects.
// ---------------------------------------------------------------------------

export class GuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GuardError';
  }
}

// ---------------------------------------------------------------------------
// String / comment aware scanning helpers
// ---------------------------------------------------------------------------

/**
 * Strips // line comments and /* block comments *\/ from source text while
 * staying aware of string literals ('...', "...", `...`) so that a `//`
 * occurring inside a string (e.g. a URL) is never treated as a comment start.
 * Preserves length and newline positions so line numbers computed against the
 * output still line up with the original source.
 */
export function stripComments(source) {
  let out = '';
  const n = source.length;
  let i = 0;
  let state = 'normal'; // 'normal' | 'line' | 'block' | 'string'
  let stringChar = '';

  while (i < n) {
    const c = source[i];
    const c2 = i + 1 < n ? source[i + 1] : '';

    if (state === 'normal') {
      if (c === '/' && c2 === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'string'; stringChar = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }

    if (state === 'line') {
      if (c === '\n') { state = 'normal'; out += '\n'; i += 1; continue; }
      out += ' '; i += 1; continue;
    }

    if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'normal'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' '; i += 1; continue;
    }

    // state === 'string'
    if (c === '\\') { out += c + c2; i += 2; continue; }
    if (c === stringChar) { state = 'normal'; out += c; i += 1; continue; }
    out += c; i += 1; continue;
  }

  return out;
}

/**
 * Scans arbitrary text (assumed already comment-stripped) for quoted string
 * literals ('...', "...", `...`), escape-aware. Returns each literal's
 * unescaped inner content plus the index of its opening quote in `text`.
 */
export function scanStringLiterals(text) {
  const results = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const start = i;
      let j = i + 1;
      let buf = '';
      while (j < n && text[j] !== quote) {
        if (text[j] === '\\') { buf += text[j + 1] ?? ''; j += 2; continue; }
        buf += text[j]; j += 1;
      }
      results.push({ content: buf, index: start });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return results;
}

/**
 * Given text and the index of an opening '(' inside it, scans forward with
 * balanced-paren + string-aware matching to find the index of the matching
 * ')'. Returns -1 if no match is found (malformed/truncated input).
 */
export function findMatchingParen(text, openIndex) {
  const n = text.length;
  let depth = 0;
  for (let i = openIndex; i < n; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i += 1;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (c === '(') { depth += 1; continue; }
    if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

// ---------------------------------------------------------------------------
// tsconfig / JSONC parsing + alias-map building
// ---------------------------------------------------------------------------

/** Parses JSONC (JSON with // and /* *\/ comments, plus trailing commas). */
export function parseJsonc(text) {
  const withoutComments = stripComments(text);
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

function normalizeRepoPath(p) {
  let norm = path.posix.normalize(p);
  if (norm === '.') return '';
  if (norm.startsWith('./')) norm = norm.slice(2);
  return norm;
}

function countStars(s) {
  return (s.match(/\*/g) || []).length;
}

function isTrailingWildcard(s) {
  return countStars(s) === 1 && s.endsWith('*');
}

/**
 * Builds alias-resolution contexts from a set of tsconfig.json files.
 * `files` is an array of { path, content } entries (repo-relative posix
 * paths) for every discovered tsconfig.json. Supports only:
 *   - exact (non-wildcard) path mappings, and
 *   - single-trailing-'*' wildcard mappings (e.g. "@/*": ["./src/*"]).
 * Any other form (multiple '*', '*' not at the end, or multiple targets that
 * disagree in shape) throws a GuardError — this must fail closed, never
 * silently drop the form.
 */
export function buildAliasMap({ files }) {
  const contexts = [];
  for (const { path: filePath, content } of files) {
    let json;
    try {
      json = parseJsonc(content);
    } catch (err) {
      throw new GuardError(`tsconfig ${filePath} could not be parsed as JSONC: ${err.message}`);
    }
    if (json == null || typeof json !== 'object') {
      throw new GuardError(`tsconfig ${filePath} did not parse to an object`);
    }
    const compilerOptions = json.compilerOptions;
    const dir = normalizeRepoPath(path.posix.dirname(filePath));
    const baseUrlAbs = compilerOptions && typeof compilerOptions.baseUrl === 'string'
      ? normalizeRepoPath(path.posix.join(dir, compilerOptions.baseUrl))
      : dir;

    const rules = [];
    const rawPaths = compilerOptions && compilerOptions.paths;
    if (rawPaths && typeof rawPaths === 'object') {
      for (const [key, targets] of Object.entries(rawPaths)) {
        if (!Array.isArray(targets) || targets.length === 0) {
          throw new GuardError(
            `tsconfig ${filePath}: unsupported "paths" entry for "${key}" — expected a non-empty array of target strings`,
          );
        }
        const keyStars = countStars(key);
        if (keyStars > 1 || (keyStars === 1 && !isTrailingWildcard(key))) {
          throw new GuardError(
            `tsconfig ${filePath}: unsupported "paths" key "${key}" — only a single trailing '*' wildcard is supported`,
          );
        }
        const keyIsWildcard = keyStars === 1;

        const shapes = new Set();
        for (const target of targets) {
          if (typeof target !== 'string') {
            throw new GuardError(`tsconfig ${filePath}: unsupported "paths" target for "${key}" — expected a string`);
          }
          const targetStars = countStars(target);
          const targetIsWildcard = targetStars === 1 && isTrailingWildcard(target);
          if (targetStars > 1 || (targetStars === 1 && !targetIsWildcard) || targetIsWildcard !== keyIsWildcard) {
            throw new GuardError(
              `tsconfig ${filePath}: unsupported "paths" target "${target}" for key "${key}" — wildcard shape must match the key (single trailing '*' or none) exactly`,
            );
          }
          shapes.add(target);
        }
        if (shapes.size > 1) {
          throw new GuardError(
            `tsconfig ${filePath}: unsupported "paths" entry for "${key}" — multiple targets that disagree in shape: ${JSON.stringify(targets)}`,
          );
        }
        const target = targets[0];
        rules.push({
          prefix: keyIsWildcard ? key.slice(0, -1) : key,
          isWildcard: keyIsWildcard,
          targetPrefix: keyIsWildcard ? target.slice(0, -1) : target,
        });
      }
    }
    contexts.push({ dir, baseUrlAbs, rules });
  }
  return contexts;
}

function isWithinDir(filePath, dir) {
  if (dir === '') return true;
  return filePath === dir || filePath.startsWith(`${dir}/`);
}

function resolveAlias(filePath, specifier, aliasContexts) {
  let best = null;
  for (const ctx of aliasContexts) {
    if (isWithinDir(filePath, ctx.dir) && (!best || ctx.dir.length > best.dir.length)) {
      best = ctx;
    }
  }
  if (!best) return null;
  for (const rule of best.rules) {
    if (rule.isWildcard) {
      if (specifier.startsWith(rule.prefix)) {
        const rest = specifier.slice(rule.prefix.length);
        return normalizeRepoPath(path.posix.join(best.baseUrlAbs, rule.targetPrefix + rest));
      }
    } else if (specifier === rule.prefix) {
      return normalizeRepoPath(path.posix.join(best.baseUrlAbs, rule.targetPrefix));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// pubspec.yaml discovery -> Dart `package:` resolution map
// ---------------------------------------------------------------------------

/**
 * Reads the top-level `name:` scalar out of a pubspec.yaml. Only a key at
 * column 0 counts (that is what "top-level" means in YAML), which is why this
 * needs no YAML library: `name:` can appear nowhere else at column 0.
 * Returns null when there is no such key.
 */
export function readPubspecName(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const m = /^name:[ \t]*(.*)$/.exec(rawLine);
    if (!m) continue;
    let value = m[1];
    const hashIdx = value.indexOf('#');
    if (hashIdx !== -1) value = value.slice(0, hashIdx);
    value = value.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
    if (value.length > 0) return value;
  }
  return null;
}

/**
 * Builds the Dart package-name -> package-root-directory map from every
 * discovered pubspec.yaml. `package:<name>/<sub>` then resolves to
 * `<packageRoot>/lib/<sub>`.
 *
 * NOTHING is hardcoded: the package name comes from the pubspec's own `name:`
 * field, which in this repo is `src` while the directory is `apps/biotope`.
 * Fails closed if a pubspec has no readable name (its `package:` imports would
 * silently become unresolvable) or if two pubspecs claim the same name (the
 * mapping would be ambiguous).
 */
export function buildPackageMap({ files }) {
  const roots = new Map();
  for (const { path: filePath, content } of files) {
    const dir = normalizeRepoPath(path.posix.dirname(filePath));
    const name = readPubspecName(content);
    if (name == null) {
      throw new GuardError(
        `pubspec ${filePath}: no top-level "name:" field found — Dart "package:" imports could not be resolved, refusing to report a false pass`,
      );
    }
    const existing = roots.get(name);
    if (existing !== undefined && existing !== dir) {
      throw new GuardError(
        `two pubspec files declare the same package name "${name}" ("${existing}" and "${dir}") — "package:${name}/..." resolution would be ambiguous`,
      );
    }
    roots.set(name, dir);
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Specifier classification (total: resolve, or explicitly declare external)
// ---------------------------------------------------------------------------

function external(reason, extra = {}) {
  return { kind: 'external', reason, ...extra };
}

/**
 * Wraps a successfully resolved target, failing closed when it escapes the
 * repository root.
 *
 * `path.posix.join('tools', '../../shared/x.ts')` normalises to
 * '../shared/x.ts' — a path that is no longer repo-relative at all. Treating
 * such a value as an internal repo path silently corrupts every downstream
 * judgement: module identity, the impl/ test and the composition-root test all
 * read a prefix that does not exist in this repository. So it throws rather
 * than guessing. No tracked source legitimately imports from above the repo
 * root, so this condition only ever means "the analyzer was fed something it
 * cannot reason about".
 */
function internal(filePath, specifier, target) {
  if (target === '..' || target.startsWith('../')) {
    throw new GuardError(
      `${filePath}: specifier "${specifier}" resolves to "${target}", which escapes the repository root — `
      + 'refusing to treat an out-of-repo path as repo-relative',
    );
  }
  return { kind: 'internal', target };
}

/**
 * Classifies an import specifier. Returns EITHER
 *   { kind: 'internal', target }  — repo-relative posix path, or
 *   { kind: 'external', reason }  — a form that provably cannot denote a path
 *                                   inside this repository.
 *
 * There is deliberately no third "ignore it" outcome. The exhaustive list of
 * EXTERNAL forms, each of which resolves outside the repo by construction:
 *
 *   - Dart `dart:*`             — Dart/Flutter SDK libraries.
 *   - Dart `package:<n>/...`    — where <n> is declared by no pubspec.yaml in
 *                                 the scanned set, i.e. a third-party pub
 *                                 dependency living in the pub cache
 *                                 (`package:flutter/material.dart`, ...).
 *   - JS/TS bare specifiers     — npm package names ('react', '@scope/pkg')
 *                                 and `node:*` builtins; these resolve into
 *                                 node_modules or the runtime. R2a still
 *                                 inspects their leading path segment
 *                                 separately, so a bare "model-training/..."
 *                                 specifier is not lost by this branch.
 *   - JS/TS root-absolute       — a leading '/' is not a repo-relative path.
 *
 * Everything else is resolved. Note the DART-SPECIFIC rule: in Dart every
 * specifier without a URI scheme is a relative URI reference resolved against
 * the importing library's own URI, so `modules/m1/impl/x.dart` (dot-less) is
 * just as relative as `./x.dart` or `../x.dart`. That is NOT true in JS/TS,
 * where a dot-less specifier is a package name — hence the language split.
 *
 * Two conditions throw (fail closed) rather than being assumed harmless:
 * an unknown URI scheme in a Dart directive, and a resolved target that escapes
 * the repository root (see `internal`).
 */
export function classifySpecifier(filePath, specifier, { aliasContexts = [], packageRoots = new Map() } = {}) {
  const importerDir = path.posix.dirname(filePath);
  const isDart = filePath.endsWith('.dart');

  if (isDart) {
    if (specifier.startsWith('dart:')) {
      return external('Dart SDK library ("dart:" scheme)');
    }
    if (specifier.startsWith('package:')) {
      const rest = specifier.slice('package:'.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx <= 0) {
        throw new GuardError(
          `${filePath}: malformed Dart package URI "${specifier}" — expected "package:<name>/<path>"`,
        );
      }
      const pkgName = rest.slice(0, slashIdx);
      const subPath = rest.slice(slashIdx + 1);
      const root = packageRoots.get(pkgName);
      if (root === undefined) {
        return external(
          `pub package "${pkgName}" is declared by no pubspec.yaml in the scanned set (third-party dependency)`,
          { packageSubpath: subPath },
        );
      }
      // Dart package layout: package:<name>/<sub> <=> <packageRoot>/lib/<sub>
      return internal(filePath, specifier, normalizeRepoPath(path.posix.join(root, 'lib', subPath)));
    }
    if (URI_SCHEME_RE.test(specifier)) {
      throw new GuardError(
        `${filePath}: unrecognised URI scheme in Dart directive "${specifier}" — refusing to guess whether it points inside the repo`,
      );
    }
    // './x', '../x' AND dot-less 'modules/a/impl/x.dart' — all relative.
    return internal(filePath, specifier, normalizeRepoPath(path.posix.join(importerDir, specifier)));
  }

  // TypeScript / JavaScript
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return internal(filePath, specifier, normalizeRepoPath(path.posix.join(importerDir, specifier)));
  }
  const aliased = resolveAlias(filePath, specifier, aliasContexts);
  if (aliased != null) return internal(filePath, specifier, aliased);
  if (specifier.startsWith('/')) {
    return external('root-absolute specifier — not a repo-relative path');
  }
  return external('bare npm package or "node:" builtin specifier');
}

// ---------------------------------------------------------------------------
// Module identity
// ---------------------------------------------------------------------------

/**
 * The module that OWNS a path, purely from the `modules/<name>` pattern, or
 * null when the path is not inside any module. The id is the whole prefix
 * through `modules/<name>`, so `a/lib/modules/m1` and `b/lib/modules/m1` are
 * distinct modules.
 */
export function moduleIdOf(filePath) {
  const m = MODULE_SEGMENT_RE.exec(filePath);
  if (!m) return null;
  return filePath.slice(0, m.index + m[0].length);
}

/**
 * True when `filePath` sits DIRECTLY in a `lib/` directory — the app
 * composition root. See note (c) at the top of this file: this is the single,
 * deliberately narrow R1 exemption, and it is positional only (parent
 * directory named exactly `lib`), so `<app>/lib/sub/deep.dart` is NOT exempt.
 */
export function isCompositionRoot(filePath) {
  const dir = path.posix.dirname(filePath);
  return dir === 'lib' || dir.endsWith('/lib');
}

/**
 * The importer's owning module: its own `modules/<name>` prefix if it has one,
 * else — for a test file at `<app>/test/<seg>/...` — `<app>/lib/modules/<seg>`
 * when that module is actually present in the scanned set. `presentModuleIds`
 * is derived from the file set, so no module name is ever hardcoded.
 */
export function owningModuleOf(filePath, presentModuleIds = new Set()) {
  const direct = moduleIdOf(filePath);
  if (direct != null) return direct;
  const m = TEST_DIR_RE.exec(filePath);
  if (m) {
    const appPrefix = m[1] ? `${m[1]}/` : '';
    const candidate = `${appPrefix}lib/modules/${m[2]}`;
    if (presentModuleIds.has(candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

const JS_IMPORT_RE = /\bimport\s+(?:[^;'"()]*?\bfrom\s*)?(['"])([^'"]+)\1/g;
const JS_EXPORT_FROM_RE = /\bexport\s+(?:[^;'"()]*?\bfrom\s*)?(['"])([^'"]+)\1/g;
const JS_DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"`])([^'"`]*)\1\s*\)/g;
const JS_REQUIRE_RE = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const DART_IMPORT_RE = /\b(?:import|export|part)\s+(['"])([^'"]+)\1/g;

/**
 * Extracts import/export/require/dynamic-import specifiers from
 * comment-stripped source text. Returns [{ specifier, index }].
 */
export function extractImports(strippedContent, isDart) {
  const results = [];
  const regexes = isDart
    ? [DART_IMPORT_RE]
    : [JS_IMPORT_RE, JS_EXPORT_FROM_RE, JS_DYNAMIC_IMPORT_RE, JS_REQUIRE_RE];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m = re.exec(strippedContent);
    while (m !== null) {
      results.push({ specifier: m[2], index: m.index });
      if (re.lastIndex === m.index) re.lastIndex += 1;
      m = re.exec(strippedContent);
    }
  }
  if (!isDart) {
    const calls = findSubprocessCalls(strippedContent, [/\bimport\s*\(/g]);
    for (const call of calls) {
      const closeIndex = findMatchingParen(strippedContent, call.openIndex);
      const args = closeIndex === -1 ? strippedContent.slice(call.openIndex + 1) : strippedContent.slice(call.openIndex + 1, closeIndex);
      const staticLiteral = /^\s*(['"`])[\s\S]*\1\s*$/.test(args) && !args.includes('${');
      if (!staticLiteral && RELEVANT_UNRESOLVED_IMPORT_RE.test(args)) {
        throw new GuardError(`unresolved dynamic import at line ${lineOf(strippedContent, call.matchStart)} reaches a protected boundary: ${args.trim()}`);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Subprocess-call detection (R2b)
// ---------------------------------------------------------------------------

const SUBPROCESS_CALL_PATTERNS = [
  /\b(?:spawnSync|execFileSync|execFile|execSync|spawn|exec|fork)\s*\(/g,
  /\bDeno\.Command\s*\(/g,
  /\bProcess\.(?:run|start|runSync)\s*\(/g,
];

function stringHasModelTrainingReference(s) {
  return MODEL_TRAINING_PATH_RE.test(s) || s.includes(OUROBION_MODEL_LAB_MARKER);
}

function findSubprocessCalls(strippedContent, patterns = SUBPROCESS_CALL_PATTERNS) {
  const calls = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m = pattern.exec(strippedContent);
    while (m !== null) {
      const openIndex = m.index + m[0].length - 1; // last matched char is '('
      calls.push({ matchStart: m.index, matchText: m[0], openIndex });
      if (pattern.lastIndex === m.index) pattern.lastIndex += 1;
      m = pattern.exec(strippedContent);
    }
  }
  return calls;
}

// ---------------------------------------------------------------------------
// Scope helpers
// ---------------------------------------------------------------------------

function inScope(filePath, prefixes) {
  return prefixes.some((p) => filePath.startsWith(p));
}

// ---------------------------------------------------------------------------
// Rule checks
// ---------------------------------------------------------------------------

function checkR1(filePath, specifier, index, strippedContent, classified, presentModuleIds, violations) {
  if (classified.kind === 'external') {
    // Fail closed on the one external case that could hide a real R1 breach:
    // an unresolved `package:` import whose subpath reaches into a module's
    // impl/. Without the pubspec we cannot tell whether it is same-module, and
    // guessing "fine" is exactly the fail-open this guard is meant to prevent.
    if (classified.packageSubpath != null && MODULE_IMPL_SUBPATH_RE.test(`/${classified.packageSubpath}`)) {
      throw new GuardError(
        `${filePath}:${lineOf(strippedContent, index)}: cannot evaluate R1 for "${specifier}" — ${classified.reason}. `
        + 'A package import reaching into a module\'s impl/ must be resolvable; add the owning pubspec.yaml to the scanned set.',
      );
    }
    return;
  }

  const target = classified.target;
  const moduleTo = moduleIdOf(target);
  if (moduleTo == null) return;                              // target is not in any module
  if (!target.startsWith(`${moduleTo}/impl/`)) return;       // target is not in that module's impl/
  if (isCompositionRoot(filePath)) return;                   // narrow exemption — see note (c)

  const moduleFrom = owningModuleOf(filePath, presentModuleIds);
  if (moduleFrom !== null && moduleFrom === moduleTo) return; // same module: allowed

  violations.push({
    rule: 'R1',
    file: filePath,
    line: lineOf(strippedContent, index),
    detail: `imports another module's impl directly (specifier "${specifier}" resolves to "${target}", owned by module "${moduleTo}"; importing module: ${moduleFrom === null ? '<none — not a module and not a composition root>' : `"${moduleFrom}"`})`,
  });
}

function checkR2aImport(filePath, specifier, index, strippedContent, classified, violations) {
  if (specifier.includes(OUROBION_MODEL_LAB_MARKER)) {
    violations.push({
      rule: 'R2a',
      file: filePath,
      line: lineOf(strippedContent, index),
      detail: `import specifier references ${OUROBION_MODEL_LAB_MARKER}: "${specifier}"`,
    });
    return;
  }
  if (classified.kind === 'internal') {
    const resolved = classified.target;
    if (resolved === 'model-training' || resolved.startsWith('model-training/')) {
      violations.push({
        rule: 'R2a',
        file: filePath,
        line: lineOf(strippedContent, index),
        detail: `import resolves into model-training/ (specifier "${specifier}" -> "${resolved}")`,
      });
      return;
    }
  }
  // Always ALSO check the literal leading path segment, whether or not the
  // specifier resolved. Dart resolves dot-less specifiers against the importing
  // file, so "model-training/x.dart" resolves to something innocuous-looking
  // while still being a model-training reference; this branch keeps that
  // visible instead of letting successful resolution swallow it.
  const firstSegment = specifier.split('/')[0];
  if (firstSegment === 'model-training' || MODEL_TRAINING_PATH_RE.test(specifier)) {
    violations.push({
      rule: 'R2a',
      file: filePath,
      line: lineOf(strippedContent, index),
      detail: `import specifier's first path segment is model-training: "${specifier}"`,
    });
  }
}

function checkR2b(filePath, strippedContent, violations) {
  const calls = findSubprocessCalls(strippedContent);
  for (const call of calls) {
    const closeIndex = findMatchingParen(strippedContent, call.openIndex);
    if (closeIndex === -1) {
      const tail = strippedContent.slice(call.openIndex + 1);
      if (RELEVANT_UNRESOLVED_IMPORT_RE.test(tail)) {
        throw new GuardError(`${filePath}:${lineOf(strippedContent, call.matchStart)}: unresolved subprocess call reaches model-training`);
      }
      continue;
    }
    const window = strippedContent.slice(call.openIndex + 1, closeIndex);
    const literals = scanStringLiterals(window);
    const hit = literals.find((lit) => stringHasModelTrainingReference(lit.content));
    if (hit) {
      violations.push({
        rule: 'R2b',
        file: filePath,
        line: lineOf(strippedContent, call.matchStart),
        detail: `subprocess call "${call.matchText.trim()}" references model-training via literal "${hit.content}"`,
      });
    } else if (/\b(?:MODEL_TRAINING\w*|modelTraining\w*|ourobionModelLab\w*)\b/.test(window)) {
      throw new GuardError(`${filePath}:${lineOf(strippedContent, call.matchStart)}: subprocess call uses an unresolved model-training identifier`);
    }
  }
}

function checkR2c(filePath, strippedContent, violations) {
  const literals = scanStringLiterals(strippedContent);
  for (const lit of literals) {
    if (MODEL_TRAINING_PATH_RE.test(lit.content)) {
      violations.push({
        rule: 'R2c',
        file: filePath,
        line: lineOf(strippedContent, lit.index),
        detail: `string literal references a model-training path: "${lit.content}"`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Pure analyzer entry point
// ---------------------------------------------------------------------------

function normalizeFilesInput(files) {
  if (files instanceof Map) {
    return Array.from(files.entries()).map(([key, value]) => {
      if (value && typeof value === 'object' && 'content' in value) {
        return { path: value.path ?? key, content: value.content };
      }
      return { path: key, content: value };
    });
  }
  return Array.from(files).map((entry) => ({ path: entry.path, content: entry.content }));
}

/**
 * Pure analyzer. `files` is a Map or iterable of { path, content } repo-
 * relative entries (posix separators). Never touches the filesystem or git.
 * Throws GuardError for every fail-closed condition. Returns
 * { violations: [{ rule, file, line, detail }], scannedCount }.
 */
export function analyze({ files }) {
  if (files == null) {
    throw new GuardError('analyze() requires a `files` Map or array — received null/undefined');
  }
  const allEntries = normalizeFilesInput(files);

  const tsconfigEntries = allEntries.filter((e) => path.posix.basename(e.path) === TSCONFIG_BASENAME);
  const pubspecEntries = allEntries.filter((e) => path.posix.basename(e.path) === PUBSPEC_BASENAME);
  const sourceEntries = allEntries.filter((e) => SCANNED_EXTENSIONS.has(path.posix.extname(e.path)));

  if (sourceEntries.length === 0) {
    throw new GuardError(
      'scan universe is empty: zero files matched the scanned extensions (.ts .tsx .mts .cts .js .mjs .cjs .dart) — refusing to report a false pass',
    );
  }

  const aliasContexts = buildAliasMap({ files: tsconfigEntries });
  const packageRoots = buildPackageMap({ files: pubspecEntries });
  const resolutionCtx = { aliasContexts, packageRoots };

  // Module directories actually present in the scanned set — derived, never
  // hardcoded. Built from ALL entries (not just source files) so a module is
  // recognised regardless of which of its files happen to be scannable.
  const presentModuleIds = new Set();
  for (const entry of allEntries) {
    const id = moduleIdOf(entry.path);
    if (id != null) presentModuleIds.add(id);
  }

  const violations = [];

  for (const entry of sourceEntries) {
    const isDart = entry.path.endsWith('.dart');
    const stripped = stripComments(entry.content);

    const imports = extractImports(stripped, isDart);
    for (const imp of imports) {
      const classified = classifySpecifier(entry.path, imp.specifier, resolutionCtx);
      checkR1(entry.path, imp.specifier, imp.index, stripped, classified, presentModuleIds, violations);
      if (inScope(entry.path, R2_IMPORT_SUBPROCESS_SCOPE)) {
        checkR2aImport(entry.path, imp.specifier, imp.index, stripped, classified, violations);
      }
    }

    if (inScope(entry.path, R2_IMPORT_SUBPROCESS_SCOPE)) {
      checkR2b(entry.path, stripped, violations);
    }

    if (inScope(entry.path, R2C_PATH_SCOPE)) {
      checkR2c(entry.path, stripped, violations);
    }
  }

  return { violations, scannedCount: sourceEntries.length };
}

// ---------------------------------------------------------------------------
// CLI driver (runs only when this module is executed directly)
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectRepoFiles({ repoRoot = REPO_ROOT } = {}) {
  let lsOutput;
  try {
    lsOutput = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' });
  } catch (err) {
    throw new GuardError(`git ls-files failed or git is unavailable: ${err.message}`);
  }

  const trackedPaths = lsOutput.split('\n').map((line) => line.trim()).filter(Boolean);
  if (trackedPaths.length === 0) {
    throw new GuardError('git ls-files returned zero tracked files — refusing to report a false pass');
  }

  const files = [];
  for (const relPath of trackedPaths) {
    const ext = path.posix.extname(relPath);
    const basename = path.posix.basename(relPath);
    // tsconfig.json and pubspec.yaml are collected as *resolution context*
    // (TS path aliases / Dart package names), not as scan targets.
    const isManifest = basename === TSCONFIG_BASENAME || basename === PUBSPEC_BASENAME;
    if (!SCANNED_EXTENSIONS.has(ext) && !isManifest) continue;

    let content;
    try {
      content = readFileSync(path.join(repoRoot, relPath), 'utf8');
    } catch (err) {
      throw new GuardError(`could not read tracked file "${relPath}": ${err.message}`);
    }
    files.push({ path: relPath, content });
  }

  return files;
}

function runCli() {
  let result;
  try {
    const files = collectRepoFiles({ repoRoot: REPO_ROOT });
    result = analyze({ files });
  } catch (err) {
    process.stderr.write(`FAIL-CLOSED: ${err.message}\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write(`Scanned ${result.scannedCount} source file(s).\n`);

  if (result.violations.length === 0) {
    process.stdout.write('OK: no architecture-boundary violations found.\n');
    process.exitCode = 0;
    return;
  }

  for (const v of result.violations) {
    process.stdout.write(`${v.rule} ${v.file}:${v.line} -> ${v.detail}\n`);
  }
  process.stderr.write(`FAIL: ${result.violations.length} architecture-boundary violation(s) found.\n`);
  process.exitCode = 1;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runCli();
}

export const __internal = {
  collectRepoFiles,
  REPO_ROOT,
};
