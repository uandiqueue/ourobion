// ourobion nao — viewer read-only UX tests (node:test, zero I/O, zero mocking).
//
// Two halves, for the same reason authz.test.ts is split that way (see its
// header): the DECISION arithmetic lives in ../src/lib/naoAccess.ts, which is
// pure and is executed directly here; the WIRING lives in .tsx components that
// `node --test` cannot import at all (JSX is not stripped by node's type
// stripping, and the components import the `@/lib/...` TS-only path alias), so
// it is proven by reading those files as text — backed by `npm run typecheck`
// proving every call site's types line up.
//
// The property these tests actually defend is that the UI's answer is not a
// SECOND opinion about authorization. Every assertion below either derives its
// expectation from ROUTE_POLICY/satisfies (the server's own inputs) or checks
// that a component names a route key rather than a role. If the matrix changes,
// these tests change with it and nothing needs re-teaching.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { ROLE_ORDER, ROUTE_POLICY, satisfies, type NaoRole } from '../src/lib/authz.ts';
import {
  CONTROL_UNAVAILABLE_HIGHER_ACCESS,
  CONTROL_UNAVAILABLE_READ_ONLY,
  MUTATING_ROUTE_KEYS,
  READ_ONLY_BANNER_BODY,
  READ_ONLY_BANNER_LABEL,
  canUseRoute,
  controlAccess,
  firstBlockedControl,
  isMutatingRouteKey,
  isReadOnlyRole,
  requiredRoleForKey,
} from '../src/lib/naoAccess.ts';
import { validateCopyString } from '../../../shared/constants/copy_guidelines.ts';

const NAO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_DIR = path.join(NAO_ROOT, 'src', 'components');
const APP_LAYOUT = path.join(NAO_ROOT, 'src', 'app', '(app)', 'layout.tsx');

/** Same convention as authz.test.ts: prose that DISCUSSES a role is not a role reference. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation from the matrix — nothing here is a hand-maintained list
// ─────────────────────────────────────────────────────────────────────────────

test('isMutatingRouteKey: reads are GET/HEAD/OPTIONS; anything else (or unparseable) is a mutation', () => {
  for (const key of ['GET /api/claims', 'HEAD /api/claims', 'OPTIONS /api/claims']) {
    assert.equal(isMutatingRouteKey(key), false, `${key} should read as a read`);
  }
  for (const key of ['POST /api/seeds', 'PATCH /api/seeds', 'PUT /api/x', 'DELETE /api/x']) {
    assert.equal(isMutatingRouteKey(key), true, `${key} should read as a mutation`);
  }
  // Fail closed on garbage rather than quietly classifying it as a harmless read.
  for (const key of ['', 'nonsense', '/api/seeds', 'POST ']) {
    assert.equal(isMutatingRouteKey(key), true, `${JSON.stringify(key)} must fail closed`);
  }
});

test('MUTATING_ROUTE_KEYS is computed from ROUTE_POLICY, not enumerated', () => {
  const expected = Object.keys(ROUTE_POLICY)
    .filter((key) => !key.startsWith('GET '))
    .sort();
  assert.deepEqual([...MUTATING_ROUTE_KEYS], expected);
  // Same 9 mutating handlers authz.test.ts's MUTATING_ACTIONS counts — if a
  // mutating route is added to the matrix it lands here with no edit, and this
  // number moves in step with that test's.
  assert.equal(MUTATING_ROUTE_KEYS.length, 9);
});

test('requiredRoleForKey mirrors ROUTE_POLICY exactly, and is undefined for anything undeclared', () => {
  for (const [key, required] of Object.entries(ROUTE_POLICY)) {
    assert.equal(requiredRoleForKey(key), required, key);
  }
  for (const key of ['DELETE /api/claims', 'POST /api/does-not-exist', 'garbage', '', 'POST ']) {
    assert.equal(requiredRoleForKey(key), undefined, JSON.stringify(key));
  }
});

test('canUseRoute IS the server decision (satisfies + ROUTE_POLICY), never a second opinion', () => {
  let checked = 0;
  for (const [key, required] of Object.entries(ROUTE_POLICY)) {
    for (const role of [null, ...ROLE_ORDER] as (NaoRole | null)[]) {
      assert.equal(
        canUseRoute(role, key),
        satisfies(role, required),
        `${key} / ${role ?? 'no role'}`,
      );
      checked += 1;
    }
  }
  assert.equal(checked, Object.keys(ROUTE_POLICY).length * 4);
});

test('canUseRoute: an undeclared route is unusable for EVERY role, admin included (fail closed)', () => {
  for (const role of [null, ...ROLE_ORDER] as (NaoRole | null)[]) {
    assert.equal(canUseRoute(role, 'POST /api/not-declared'), false);
    assert.equal(canUseRoute(role, 'garbage'), false);
  }
});

test('isReadOnlyRole is derived from what the routes allow, not from the word "viewer"', () => {
  assert.equal(isReadOnlyRole('viewer'), true);
  assert.equal(isReadOnlyRole('curator'), false);
  assert.equal(isReadOnlyRole('admin'), false);
  // No session / no membership resolves to null and must be at least as restricted.
  assert.equal(isReadOnlyRole(null), true);
  // Restated independently of the implementation: read-only means no mutating
  // ROUTE_POLICY entry is satisfiable.
  for (const role of [null, ...ROLE_ORDER] as (NaoRole | null)[]) {
    const anyMutationAllowed = MUTATING_ROUTE_KEYS.some((key) => satisfies(role, ROUTE_POLICY[key]));
    assert.equal(isReadOnlyRole(role), !anyMutationAllowed, String(role));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// What each caller sees
// ─────────────────────────────────────────────────────────────────────────────

test('a viewer: every mutating control is inactive, with the read-only reason', () => {
  for (const key of MUTATING_ROUTE_KEYS) {
    const access = controlAccess('viewer', key);
    assert.equal(access.allowed, false, key);
    assert.equal(access.reason, CONTROL_UNAVAILABLE_READ_ONLY, key);
  }
  // ...and every READ stays usable, so the page is not blanket-disabled.
  for (const key of Object.keys(ROUTE_POLICY).filter((k) => k.startsWith('GET '))) {
    const access = controlAccess('viewer', key);
    assert.equal(access.allowed, satisfies('viewer', ROUTE_POLICY[key]), key);
  }
});

test('a curator blocked by an admin-only control is NOT told their access is read-only', () => {
  const adminOnly = MUTATING_ROUTE_KEYS.filter((key) => ROUTE_POLICY[key] === 'admin');
  assert.ok(adminOnly.length > 0, 'expected at least one admin-only mutating route');
  for (const key of adminOnly) {
    const access = controlAccess('curator', key);
    assert.equal(access.allowed, false, key);
    assert.equal(access.reason, CONTROL_UNAVAILABLE_HIGHER_ACCESS, key);
    assert.notEqual(access.reason, CONTROL_UNAVAILABLE_READ_ONLY, key);
  }
  for (const key of MUTATING_ROUTE_KEYS.filter((k) => ROUTE_POLICY[k] !== 'admin')) {
    assert.deepEqual(controlAccess('curator', key), { allowed: true, reason: null }, key);
  }
});

test('an admin: every declared route is usable and no reason is ever produced', () => {
  for (const key of Object.keys(ROUTE_POLICY)) {
    assert.deepEqual(controlAccess('admin', key), { allowed: true, reason: null }, key);
  }
});

test('controlAccess: reason is non-null exactly when allowed is false', () => {
  for (const key of [...Object.keys(ROUTE_POLICY), 'POST /api/not-declared']) {
    for (const role of [null, ...ROLE_ORDER] as (NaoRole | null)[]) {
      const { allowed, reason } = controlAccess(role, key);
      assert.equal(reason === null, allowed, `${key} / ${role ?? 'no role'}`);
    }
  }
});

test('firstBlockedControl returns the first unusable route, or null when all are usable', () => {
  assert.equal(firstBlockedControl('admin', ['POST /api/models/caps', 'POST /api/seeds']), null);
  assert.equal(firstBlockedControl('curator', []), null);
  assert.deepEqual(firstBlockedControl('curator', ['POST /api/seeds', 'POST /api/models/caps']), {
    allowed: false,
    reason: CONTROL_UNAVAILABLE_HIGHER_ACCESS,
  });
  assert.deepEqual(firstBlockedControl('viewer', ['POST /api/seeds']), {
    allowed: false,
    reason: CONTROL_UNAVAILABLE_READ_ONLY,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Source-conformance: the wiring
// ─────────────────────────────────────────────────────────────────────────────

const ROUTE_KEY_LITERAL_RE = /(?:'|")((?:GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS) \/api\/[A-Za-z0-9\-/]*)(?:'|")/g;

/** Route keys a component DECLARES (the literal it hands to a gate). */
function declaredRouteKeys(code: string): string[] {
  return [...new Set([...code.matchAll(ROUTE_KEY_LITERAL_RE)].map((m) => m[1]))];
}

/**
 * Route keys a component actually CALLS with a state-changing method, read off
 * its `fetch('/api/...', { method: 'POST' })` calls. This is the half that
 * cannot be forgotten: a new mutating fetch shows up here whether or not anyone
 * remembered to gate it.
 */
function mutatingFetchKeys(code: string): string[] {
  const out: string[] = [];
  const re = /fetch\(\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const after = code.slice(re.lastIndex, re.lastIndex + 400);
    const nextFetch = after.indexOf('fetch(');
    const window = nextFetch === -1 ? after : after.slice(0, nextFetch);
    const method = /method:\s*'([A-Z]+)'/.exec(window)?.[1];
    if (method === undefined) continue; // no init object at all -> a GET
    const routePath = match[1].split('?')[0];
    const key = `${method} ${routePath}`;
    if (isMutatingRouteKey(key)) out.push(key);
  }
  return [...new Set(out)];
}

/**
 * Panels that have NOT adopted the gate yet, and why. Both are being rewritten
 * concurrently in other sessions, so they were deliberately left untouched; each
 * needs exactly one line at its mount site (see the session log). Removing a
 * name from this set without wiring the panel turns this into a failing test,
 * which is the point — the exclusion cannot quietly become permanent.
 */
const PENDING_GATE_ADOPTION = new Set(['LoaderPanel.tsx', 'BrainPipelinePanel.tsx']);

function componentFiles(): string[] {
  return readdirSync(COMPONENTS_DIR)
    .filter((name) => name.endsWith('.tsx'))
    .sort();
}

// The detectors, under test. A detector only ever run against compliant files
// is not known to detect anything (the lesson authz.test.ts's review finding 5
// wrote down); these fixtures are the non-compliant inputs it must see.
test('detector fixtures: mutatingFetchKeys finds writes and ignores reads', () => {
  const fixture = [
    "const a = await fetch('/api/claims?paper=x');",
    "const b = await fetch('/api/seeds', { method: 'PATCH', body: JSON.stringify({}) });",
    "const c = await fetch('/api/models/caps', {",
    "  method: 'POST',",
    "  headers: { 'content-type': 'application/json' },",
    '});',
  ].join('\n');
  assert.deepEqual(mutatingFetchKeys(fixture), ['PATCH /api/seeds', 'POST /api/models/caps']);
  assert.deepEqual(mutatingFetchKeys("await fetch('/api/gaps');"), []);
});

test('detector fixtures: an UNGATED mutating fetch fails the gate check', () => {
  const fixture = [
    "async function reject() {",
    "  await fetch('/api/claims/reject', { method: 'POST', body: '{}' });",
    '}',
  ].join('\n');
  const calls = mutatingFetchKeys(fixture);
  assert.deepEqual(calls, ['POST /api/claims/reject']);
  // Nothing declares it, so the assertion the real test makes would fail here.
  assert.equal(declaredRouteKeys(fixture).includes(calls[0]), false);
});

test('detector fixtures: declaredRouteKeys reads route-key literals and nothing else', () => {
  const fixture = [
    "const A = 'POST /api/seeds';",
    "const B = \"GET /api/seeds\";",
    "const notAKey = 'POST something else';",
    "const alsoNot = '/api/seeds';",
  ].join('\n');
  assert.deepEqual(declaredRouteKeys(fixture).sort(), ['GET /api/seeds', 'POST /api/seeds']);
});

test('source-conformance: every mutating fetch in a component is gated on the route key it calls', () => {
  let gatedFiles = 0;
  for (const name of componentFiles()) {
    const code = stripComments(readFileSync(path.join(COMPONENTS_DIR, name), 'utf8'));
    const calls = mutatingFetchKeys(code);
    if (calls.length === 0) continue;
    if (PENDING_GATE_ADOPTION.has(name)) continue;
    for (const key of calls) {
      assert.ok(
        declaredRouteKeys(code).includes(key),
        `${name}: posts to "${key}" but never declares it to a control gate`,
      );
    }
    assert.match(
      code,
      /from '\.\/NaoAccess'/,
      `${name}: gates must come from the shared module, not a local reimplementation`,
    );
    gatedFiles += 1;
  }
  assert.equal(gatedFiles, 4, `expected 4 adopted mutating panels, found ${gatedFiles}`);
});

test('source-conformance: every route key a component names exists in ROUTE_POLICY (no typo, no drift)', () => {
  let keys = 0;
  for (const name of componentFiles()) {
    const code = stripComments(readFileSync(path.join(COMPONENTS_DIR, name), 'utf8'));
    for (const key of declaredRouteKeys(code)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(ROUTE_POLICY, key),
        `${name}: declares "${key}", which is not a declared route`,
      );
      keys += 1;
    }
  }
  assert.ok(keys > 0, 'expected at least one declared route key across the components');
});

test('source-conformance: no component decides access by naming a role', () => {
  // A component that compares against 'viewer'/'curator'/'admin' has started
  // keeping its own copy of the policy — the exact drift this unit exists to
  // prevent. Only ../src/lib/naoAccess.ts and ../src/lib/authz.ts know the tiers.
  for (const name of componentFiles()) {
    const code = stripComments(readFileSync(path.join(COMPONENTS_DIR, name), 'utf8'));
    for (const role of ROLE_ORDER) {
      assert.doesNotMatch(
        code,
        new RegExp(`['"]${role}['"]`),
        `${name}: must not name the "${role}" tier — ask the route matrix instead`,
      );
    }
  }
});

test('source-conformance: the (app) layout resolves the tier server-side and passes it down', () => {
  const code = stripComments(readFileSync(APP_LAYOUT, 'utf8'));
  // Read fresh from the database on the server, never from a claim or the browser.
  assert.match(code, /await resolveNaoRole\(\)/, 'the tier must come from resolveNaoRole()');
  assert.match(code, /from '@\/lib\/authzServer'/);
  assert.match(code, /<ReadOnlyBanner role=\{role\} \/>/, 'the banner must be rendered from the shell');
  assert.match(code, /<NaoAccessProvider role=\{role\}>/, 'the tier must reach client controls via the provider');
  // A cookie read cannot be prerendered; without this the shelled pages would
  // bake one visitor's banner state into everyone's HTML.
  assert.match(code, /export const dynamic = 'force-dynamic'/);
});

test('source-conformance: the banner renders for a read-only caller only, and asks the matrix', () => {
  const code = stripComments(
    readFileSync(path.join(COMPONENTS_DIR, 'ReadOnlyBanner.tsx'), 'utf8'),
  );
  assert.match(code, /if \(!isReadOnlyRole\(role\)\) \{\s*return null;/);
  assert.match(code, /READ_ONLY_BANNER_LABEL/);
  assert.match(code, /READ_ONLY_BANNER_BODY/);
});

test('source-conformance: the client gate never re-derives the tier from anything the browser holds', () => {
  const code = stripComments(readFileSync(path.join(COMPONENTS_DIR, 'NaoAccess.tsx'), 'utf8'));
  for (const forbidden of ['user_role', 'app_metadata', 'user_metadata', 'getUser', 'createBrowserClient', 'document.cookie']) {
    assert.doesNotMatch(
      code,
      new RegExp(forbidden.replace('.', '\\.')),
      `NaoAccess.tsx must not read ${forbidden} — the tier arrives from the server layout`,
    );
  }
});

test('no UI module imports the server guard, and no route file imports the UI gate', () => {
  // The two directions of the boundary: presentation may not pull in
  // guardRole/requireRole, and no route may start deciding with naoAccess.
  for (const name of componentFiles()) {
    const code = stripComments(readFileSync(path.join(COMPONENTS_DIR, name), 'utf8'));
    assert.doesNotMatch(code, /\b(guardRole|requireRole)\b/, `${name}: server guards are not a UI concern`);
  }
  const apiRoot = path.join(NAO_ROOT, 'src', 'app', '(app)', 'api');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : entry.name === 'route.ts'
          ? [path.join(dir, entry.name)]
          : [],
    );
  for (const file of walk(apiRoot)) {
    assert.doesNotMatch(
      stripComments(readFileSync(file, 'utf8')),
      /naoAccess/,
      `${path.relative(NAO_ROOT, file)}: a route must decide with guardRole, never with the UI helper`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy gate
// ─────────────────────────────────────────────────────────────────────────────

const COPY_FILES = [
  'src/lib/naoAccess.ts',
  'src/components/NaoAccess.tsx',
  'src/components/ReadOnlyBanner.tsx',
  'src/components/IngestControlPanel.tsx',
  'src/components/SeedsPanel.tsx',
  'src/components/GapsPanel.tsx',
  'src/components/ClaimsPanel.tsx',
  'src/components/ModelsPanel.tsx',
] as const;

function literalCopy(relativePath: string): string[] {
  const source = ts.createSourceFile(
    relativePath,
    readFileSync(path.join(NAO_ROOT, relativePath), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, ' ').trim();
      if (value !== '') values.push(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

test('every literal on the access surface passes the non-diagnostic copy gate', () => {
  for (const relativePath of COPY_FILES) {
    for (const value of literalCopy(relativePath)) {
      assert.equal(
        validateCopyString(value),
        true,
        `${relativePath} fails validateCopyString: ${JSON.stringify(value)}`,
      );
    }
  }
});

test('the access copy names no role, no table and no status code', () => {
  const strings = [
    CONTROL_UNAVAILABLE_READ_ONLY,
    CONTROL_UNAVAILABLE_HIGHER_ACCESS,
    READ_ONLY_BANNER_LABEL,
    READ_ONLY_BANNER_BODY,
  ];
  for (const value of strings) {
    assert.equal(validateCopyString(value), true, value);
    for (const jargon of [...ROLE_ORDER, 'nao_members', 'nao_role', '403', '401', 'RLS', 'forbidden']) {
      assert.doesNotMatch(value.toLowerCase(), new RegExp(jargon.toLowerCase()), `"${value}" leaks "${jargon}"`);
    }
  }
});
