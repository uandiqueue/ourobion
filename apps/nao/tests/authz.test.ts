// ourobion nao — authorization tests (node:test, zero I/O, zero mocking).
//
// WHY NO MOCKING OF authzServer.ts / route handlers (verified empirically,
// not assumed): route handler files import the `@/lib/...` TS-only path
// alias, which plain Node cannot resolve at all (F8 in the R4-U2 inventory).
// authzServer.ts is one step further out of reach: it transitively imports
// `next/headers` (via ./supabase-server.ts), and — unlike a normal bare
// package specifier such as 'jose' (mocked successfully in auth.test.ts) —
// `next/headers` is a subpath of the `next` package with NO matching
// `exports` map entry for plain-ESM resolution (Next's own bundler resolves
// it via webpack's extension-fallback, which `node --test` does not
// replicate). `node --test`'s `mock.module()` was tried directly against this
// exact case during this unit's implementation and throws
// `ERR_MODULE_NOT_FOUND` DURING RESOLUTION, before the mock can substitute
// anything — so there is no way to import authzServer.ts (or any route file)
// under `node --test` at all, mocked or not.
//
// THE SEAM THIS UNIT CHOSE (dependency injection would require changing the
// R4-U2 interface contract's fixed function signatures, which is out of
// scope): every piece of ALLOW/DENY ARITHMETIC and every REDACTION rule lives
// in ../src/lib/authz.ts — pure, zero imports, zero I/O — and is executed
// directly and exhaustively below. authzServer.ts and every route file
// import ONLY that arithmetic; they add no decision logic of their own
// beyond "call requireRole/guardRole with the ROUTE_POLICY role, then act on
// its verdict". That remaining wiring is proven by SOURCE-CONFORMANCE
// (reading the .ts files as text and asserting their shape/calls), backed by
// `npm run typecheck` proving every call site's TYPES line up. This is the
// same technique the R4-U2 design doc itself uses for the equivalent
// constraint (e.g. "no route file references user_role").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROLE_ORDER,
  ROUTE_POLICY,
  requiredRoleFor,
  satisfies,
  type NaoRole,
} from '../src/lib/authz.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.join(NAO_ROOT, 'src', 'app', '(app)', 'api');

// ── satisfies() / ROLE_ORDER ────────────────────────────────────────────────
test('ROLE_ORDER is viewer < curator < admin', () => {
  assert.deepEqual(ROLE_ORDER, ['viewer', 'curator', 'admin']);
});

test('satisfies(): null actual never satisfies anything (fail closed)', () => {
  for (const required of ROLE_ORDER) {
    assert.equal(satisfies(null, required), false);
  }
});

test('satisfies(): a role satisfies itself and every lower requirement, never a higher one', () => {
  assert.equal(satisfies('viewer', 'viewer'), true);
  assert.equal(satisfies('viewer', 'curator'), false);
  assert.equal(satisfies('viewer', 'admin'), false);

  assert.equal(satisfies('curator', 'viewer'), true);
  assert.equal(satisfies('curator', 'curator'), true);
  assert.equal(satisfies('curator', 'admin'), false);

  assert.equal(satisfies('admin', 'viewer'), true);
  assert.equal(satisfies('admin', 'curator'), true);
  assert.equal(satisfies('admin', 'admin'), true);
});

// ── requiredRoleFor() / ROUTE_POLICY ────────────────────────────────────────
test('requiredRoleFor(): known route returns its declared role', () => {
  assert.equal(requiredRoleFor('GET', '/api/claims'), 'viewer');
  assert.equal(requiredRoleFor('get', '/api/claims'), 'viewer'); // method is case-insensitive
  assert.equal(requiredRoleFor('POST', '/api/models/caps'), 'admin');
});

test('requiredRoleFor(): unknown route returns undefined (callers must fail closed)', () => {
  assert.equal(requiredRoleFor('GET', '/api/does-not-exist'), undefined);
  assert.equal(requiredRoleFor('DELETE', '/api/claims'), undefined);
});

// ── Full actor x route decision matrix ──────────────────────────────────────
//
// Mirrors requireRole()'s exact branch structure in
// ../src/lib/authzServer.ts (verified against that file's source below, in
// the "requireRole()'s branch structure" conformance test): no session -> 401;
// session but !satisfies(role, required) -> 403; else 200. `satisfies` is
// imported for real, so this is the production arithmetic under test, not a
// re-implementation of it.
type ActorClass = 'anonymous' | 'non-member' | 'viewer' | 'curator' | 'admin';

const ACTORS: Record<ActorClass, { authenticated: boolean; role: NaoRole | null }> = {
  anonymous: { authenticated: false, role: null },
  // Covers: authenticated-but-never-a-member, AND suspended/revoked members —
  // resolveNaoRole()/requireRole() collapse all three to role=null (see that
  // module's doc comments), so they are indistinguishable at this layer by
  // design (the response must not reveal which one it was).
  'non-member': { authenticated: true, role: null },
  viewer: { authenticated: true, role: 'viewer' },
  curator: { authenticated: true, role: 'curator' },
  admin: { authenticated: true, role: 'admin' },
};

function decide(actor: ActorClass, required: NaoRole): { status: 401 | 403 | 200 } {
  const { authenticated, role } = ACTORS[actor];
  if (!authenticated) return { status: 401 };
  if (!satisfies(role, required)) return { status: 403 };
  return { status: 200 };
}

test('full actor x route matrix (5 actor classes x every ROUTE_POLICY entry)', () => {
  const routeCount = Object.keys(ROUTE_POLICY).length;
  let assertions = 0;
  for (const [key, required] of Object.entries(ROUTE_POLICY)) {
    for (const actor of Object.keys(ACTORS) as ActorClass[]) {
      const { status } = decide(actor, required);
      assertions += 1;
      if (actor === 'anonymous') {
        assert.equal(status, 401, `${key} / anonymous should be 401, got ${status}`);
      } else if (actor === 'non-member') {
        assert.equal(status, 403, `${key} / non-member should be 403, got ${status}`);
      } else {
        const expected = satisfies(ACTORS[actor].role, required) ? 200 : 403;
        assert.equal(status, expected, `${key} / ${actor} should be ${expected}, got ${status}`);
      }
    }
  }
  // 14 routes x 5 actor classes (verified count — see ROUTE_POLICY's header
  // comment for why this is 14, not the brief's "13").
  assert.equal(routeCount, 14, `expected 14 declared routes, found ${routeCount}`);
  assert.equal(assertions, 70);
});

test('every admin-gated route denies both viewer and curator', () => {
  const adminRoutes = Object.entries(ROUTE_POLICY).filter(([, role]) => role === 'admin');
  assert.ok(adminRoutes.length > 0, 'expected at least one admin-gated route');
  for (const [key] of adminRoutes) {
    assert.equal(decide('viewer', 'admin').status, 403, `${key}: viewer must be denied`);
    assert.equal(decide('curator', 'admin').status, 403, `${key}: curator must be denied`);
    assert.equal(decide('admin', 'admin').status, 200, `${key}: admin must be allowed`);
  }
});

// ── Source-conformance: every route file, walked from disk ─────────────────
//
// This is what stops a future route from shipping unguarded: it fails if a
// handler has no requireRole/guardRole call, if that call's role drifts from
// ROUTE_POLICY, or if ROUTE_POLICY has a stale/missing entry.
// HANDLER DETECTION (R4-U2 review finding 5): this used to be the single
// pattern `export async function (GET|POST|…)\(`, which is ONE of the several
// spellings Next.js accepts. A future handler written
//   export const POST = async (req: Request) => …
//   export const POST: RouteHandler = …
//   async function POST() {} ; export { POST }
//   export { handler as POST }
//   export function HEAD() {}          (a method this matrix does not declare)
// was INVISIBLE to discoverHandlers(), so it would have satisfied all three
// conformance tests below — including the `handlers.length === 14` count, since
// an undiscovered handler is simply not counted — while shipping with no gate
// at all. That is the same class of defect as the guard-exclusion set this unit
// removed: a test that cannot see the problem it exists to catch.
//
// All export forms are now recognised, and HEAD/OPTIONS are included so a
// handler for an undeclared method fails the ROUTE_POLICY test (fail closed)
// instead of passing unseen. The matcher is exercised against a NEGATIVE
// FIXTURE below ('broadened handler detection…'), because a detector that is
// only ever run against compliant files is not known to detect anything.
const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const METHOD_ALT = HTTP_METHODS.join('|');

/** Declaration forms: `export [async] function POST(` and `export const/let/var POST[: T] =`. */
const HANDLER_DECL_PATTERNS: readonly string[] = [
  `export\\s+(?:async\\s+)?function\\s+(${METHOD_ALT})\\s*\\(`,
  `export\\s+(?:const|let|var)\\s+(${METHOD_ALT})\\s*(?::[^=\\n]+)?=`,
];
/** Local (non-exported) declaration, so an `export { POST }` can be traced to its body. */
const LOCAL_DECL_PATTERNS: readonly string[] = [
  `(?:async\\s+)?function\\s+(${METHOD_ALT})\\s*\\(`,
  `(?:const|let|var)\\s+(${METHOD_ALT})\\s*(?::[^=\\n]+)?=`,
];
/** `export { POST }`, `export { handler as POST }`, `export { a, b as PATCH }`. */
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g;

interface DiscoveredHandler {
  file: string; // absolute path
  routePath: string; // "/api/claims"
  method: string;
  body: string; // source text from this handler's declaration to the next one (or EOF)
}

/**
 * Discover every exported HTTP-method handler in one module's source text, in
 * any export spelling. Pure (text in, handlers out) so the negative fixture
 * test can drive it directly without writing a decoy route file to disk — a
 * decoy on disk would break the 14-handler count for every other test.
 */
function handlersIn(content: string, routePath: string, file: string): DiscoveredHandler[] {
  const found = new Map<string, number>(); // method -> index of its declaration

  for (const pattern of HANDLER_DECL_PATTERNS) {
    for (const m of content.matchAll(new RegExp(pattern, 'g'))) {
      const method = m[1];
      if (!found.has(method)) found.set(method, m.index ?? 0);
    }
  }

  // Re-export lists: resolve the exported NAME, then locate its local declaration
  // so the handler's body (and therefore its guard) is the code, not the export line.
  for (const list of content.matchAll(EXPORT_LIST_RE)) {
    for (const spec of list[1].split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      const exported = (parts[parts.length - 1] ?? '').trim();
      const local = (parts[0] ?? '').trim();
      if (!(HTTP_METHODS as readonly string[]).includes(exported)) continue;
      if (found.has(exported)) continue;
      let at = list.index ?? 0;
      for (const pattern of LOCAL_DECL_PATTERNS) {
        const localRe = new RegExp(pattern.replace(`(${METHOD_ALT})`, `(${local})`));
        const hit = localRe.exec(content);
        if (hit) {
          at = hit.index;
          break;
        }
      }
      found.set(exported, at);
    }
  }

  const ordered = [...found.entries()].sort((a, b) => a[1] - b[1]);
  return ordered.map(([method, start], i) => ({
    file,
    routePath,
    method,
    body: content.slice(start, i + 1 < ordered.length ? ordered[i + 1][1] : content.length),
  }));
}

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkRouteFiles(full));
    } else if (entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

function routePathFor(file: string): string {
  const rel = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join('/');
  return rel === '' ? '/api' : `/api/${rel}`;
}

// ── Unrecognised export shapes (R4-U2 re-review finding N2) ────────────────
//
// The broadened matcher above recognises every export spelling Next.js
// accepts FOR A HANDLER DEFINED IN THIS FILE. Two shapes still fall outside
// that: `export * from './impl'` (the handler is defined in ANOTHER module
// this detector never reads) and `export const { POST } = someObject` (a
// destructuring export — HANDLER_DECL_PATTERNS only recognises the method
// name as the bound identifier directly, e.g. `export const POST =`, not as
// a destructured property). Silently discovering ZERO handlers for a route
// file shaped either way is exactly the class of defect the broadened
// matcher above was built to close — so rather than pass either shape
// unseen, discoverHandlers() hard-fails the instant it sees one.
const EXPORT_STAR_RE = /export\s*\*\s*from\s*['"][^'"]+['"]/;
const EXPORT_DESTRUCTURE_RE = /export\s+(?:const|let|var)\s*\{[^}]*\}\s*=/;

function assertNoUnrecognisedExportShapes(content: string, fileLabel: string): void {
  if (EXPORT_STAR_RE.test(content)) {
    throw new Error(
      `${fileLabel}: contains "export * from ...", an export shape discoverHandlers() cannot see ` +
        'through (the handler, if any, is defined in a module this detector never reads). Rewrite the ' +
        'route file to export its handlers directly, or extend the detector to resolve the target module.',
    );
  }
  if (EXPORT_DESTRUCTURE_RE.test(content)) {
    throw new Error(
      `${fileLabel}: contains a destructuring export ("export const { ... } = ..."), an export shape ` +
        'discoverHandlers() cannot see through (HANDLER_DECL_PATTERNS only matches the method name as the ' +
        'directly bound identifier). Rewrite the route file to export its handlers directly, or extend the ' +
        'detector to resolve destructuring.',
    );
  }
}

function discoverHandlers(): DiscoveredHandler[] {
  const handlers: DiscoveredHandler[] = [];
  for (const file of walkRouteFiles(API_ROOT)) {
    // Comments stripped FIRST (same convention as the forged-claim tests below):
    // a doc comment discussing `guardRole(...)` or a handler's name is prose, and
    // must neither be discovered as a handler nor satisfy a guard-presence check.
    const content = stripComments(readFileSync(file, 'utf8'));
    assertNoUnrecognisedExportShapes(content, path.relative(NAO_ROOT, file));
    handlers.push(...handlersIn(content, routePathFor(file), file));
  }
  return handlers;
}

// `api/loader/run-pipeline/route.ts` now carries its own `guardRole('curator')`
// call (R4-U2 integration fix) alongside its separate internal-secret protocol
// for the machine-to-machine leg to the `run-pipeline` edge function — the two
// are distinct authorization questions (which human may press the button, vs.
// which caller the edge function accepts) and both are satisfied. There is no
// longer any guard-presence exclusion: all 14 discovered handlers are checked.
const GUARD_PRESENCE_EXCLUDED_ROUTES = new Set<string>([]);

test('source-conformance: ROUTE_POLICY matches every discovered handler exactly (no missing, no stale entries)', () => {
  const handlers = discoverHandlers();
  assert.equal(handlers.length, 14, `expected 14 discovered handlers, found ${handlers.length}`);

  const discoveredKeys = new Set(handlers.map((h) => `${h.method} ${h.routePath}`));
  for (const key of discoveredKeys) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(ROUTE_POLICY, key),
      `discovered handler "${key}" has no ROUTE_POLICY entry`,
    );
  }
  for (const key of Object.keys(ROUTE_POLICY)) {
    assert.ok(discoveredKeys.has(key), `ROUTE_POLICY entry "${key}" has no matching route handler on disk`);
  }
});

test('source-conformance: every non-excluded handler calls requireRole/guardRole with the ROUTE_POLICY role', () => {
  const handlers = discoverHandlers();
  let checked = 0;
  for (const h of handlers) {
    const key = `${h.method} ${h.routePath}`;
    if (GUARD_PRESENCE_EXCLUDED_ROUTES.has(key)) {
      continue;
    }
    const required = ROUTE_POLICY[key];
    assert.ok(required, `no ROUTE_POLICY entry for "${key}" (should have been caught above)`);
    const callRe = /(?:requireRole|guardRole)\(\s*'([a-z]+)'\s*\)/;
    const call = callRe.exec(h.body);
    assert.ok(call, `${key} (${path.relative(NAO_ROOT, h.file)}): no requireRole/guardRole(...) call found`);
    assert.equal(
      call[1],
      required,
      `${key} (${path.relative(NAO_ROOT, h.file)}): guarded with '${call[1]}' but ROUTE_POLICY requires '${required}'`,
    );
    checked += 1;
  }
  assert.equal(checked, 14, `expected all 14 handlers guard-checked (no exclusions), checked ${checked}`);
});

test('source-conformance: the run-pipeline route is present in ROUTE_POLICY with the correct role', () => {
  assert.equal(ROUTE_POLICY['POST /api/loader/run-pipeline'], 'curator');
});

test('source-conformance: every route file imports guardRole/requireRole/redactDeep from @/lib/authzServer, not a local reimplementation', () => {
  for (const file of walkRouteFiles(API_ROOT)) {
    const key = discoverHandlers().find((h) => h.file === file);
    if (!key) continue; // no handlers at all (shouldn't happen, but not this test's concern)
    const content = readFileSync(file, 'utf8');
    const routePath = routePathFor(file);
    const anyGuardedHandlerHere = Object.keys(ROUTE_POLICY).some(
      (k) => k.endsWith(` ${routePath}`) && !GUARD_PRESENCE_EXCLUDED_ROUTES.has(k),
    );
    if (!anyGuardedHandlerHere) continue;
    assert.match(
      content,
      /from ['"]@\/lib\/authzServer['"]/,
      `${path.relative(NAO_ROOT, file)}: must import from '@/lib/authzServer'`,
    );
  }
});

// ── The detector itself, under test (R4-U2 review finding 5) ───────────────
test('broadened handler detection: an UNGUARDED `export const POST = async` is caught (the old matcher missed it)', () => {
  const fixture = [
    "export const dynamic = 'force-dynamic';",
    '',
    'export const POST = async (req: Request): Promise<Response> => {',
    '  const body = await req.json();',
    "  return new Response(JSON.stringify({ ok: true, echoed: body }), { status: 200 });",
    '};',
  ].join('\n');

  // The OLD matcher — this is the exact regex that shipped — sees nothing.
  const oldMatcher = new RegExp(`export\\s+async\\s+function\\s+(${METHOD_ALT})\\s*\\(`, 'g');
  assert.deepEqual([...fixture.matchAll(oldMatcher)], [], 'the old matcher must be blind to this form');

  // The broadened matcher discovers it...
  const found = handlersIn(fixture, '/api/decoy', 'fixture://decoy/route.ts');
  assert.equal(found.length, 1, 'the broadened matcher must discover the arrow-function handler');
  assert.equal(found[0].method, 'POST');

  // ...and the guard-presence check therefore FAILS on it, which is the point.
  const callRe = /(?:requireRole|guardRole)\(\s*'([a-z]+)'\s*\)/;
  assert.equal(callRe.exec(found[0].body), null, 'the fixture is deliberately unguarded');
  // ...as does the ROUTE_POLICY membership check.
  assert.equal(
    Object.prototype.hasOwnProperty.call(ROUTE_POLICY, `${found[0].method} ${found[0].routePath}`),
    false,
  );
});

test('broadened handler detection: every export spelling Next.js accepts is discovered', () => {
  const cases: Array<[string, string[]]> = [
    ['export async function GET() {}', ['GET']],
    ['export function GET() {}', ['GET']],
    ['export const POST = async (req: Request) => {};', ['POST']],
    ['export const POST: RouteHandler = async (req) => {};', ['POST']],
    ['export let PATCH = async () => {};', ['PATCH']],
    ['async function DELETE() {}\nexport { DELETE };', ['DELETE']],
    ['const handler = async () => {};\nexport { handler as PUT };', ['PUT']],
    ['export function HEAD() {}', ['HEAD']],
    ['export async function OPTIONS() {}', ['OPTIONS']],
    // Not handlers — must not be discovered.
    ["export const dynamic = 'force-dynamic';", []],
    ['export const revalidate = 0;', []],
    ['export { somethingElse };', []],
  ];
  for (const [source, expected] of cases) {
    assert.deepEqual(
      handlersIn(source, '/api/fixture', 'fixture://route.ts').map((h) => h.method),
      expected,
      `detection failed for: ${source}`,
    );
  }
});

// ── Unrecognised export shapes hard-fail rather than pass unseen (R4-U2 re-review finding N2) ──
test('unrecognised export shapes: `export * from` hard-fails instead of silently discovering nothing', () => {
  const fixture = ["export const dynamic = 'force-dynamic';", '', "export * from './impl';"].join('\n');
  assert.throws(
    () => assertNoUnrecognisedExportShapes(fixture, 'fixture://decoy/route.ts'),
    /export \* from/,
  );
});

test('unrecognised export shapes: `export const { POST } = h` hard-fails instead of silently discovering nothing', () => {
  const fixture = [
    "const h = { POST: async () => new Response('ok') };",
    'export const { POST } = h;',
  ].join('\n');
  assert.throws(
    () => assertNoUnrecognisedExportShapes(fixture, 'fixture://decoy/route.ts'),
    /destructuring export/,
  );
});

test('unrecognised export shapes: `export let { GET, POST } = h` (destructuring more than one name) also hard-fails', () => {
  const fixture = 'export let { GET, POST } = someHandlers;';
  assert.throws(
    () => assertNoUnrecognisedExportShapes(fixture, 'fixture://decoy/route.ts'),
    /destructuring export/,
  );
});

test('unrecognised export shapes: a normal, compliant declaration/re-export list trips NEITHER check', () => {
  const fixture = [
    "export async function GET() {}",
    'export const POST = async (req: Request) => {};',
    "async function DELETE() {}\nexport { DELETE };",
    "export * as namespaced from './other';", // a namespace import re-export, not a wildcard re-export
  ].join('\n');
  assert.doesNotThrow(() => assertNoUnrecognisedExportShapes(fixture, 'fixture://route.ts'));
});

test('unrecognised export shapes: every real route file on disk trips neither check', () => {
  for (const file of walkRouteFiles(API_ROOT)) {
    const content = stripComments(readFileSync(file, 'utf8'));
    assert.doesNotThrow(
      () => assertNoUnrecognisedExportShapes(content, path.relative(NAO_ROOT, file)),
      `${path.relative(NAO_ROOT, file)} unexpectedly trips the unrecognised-export-shape check`,
    );
  }
});

// ── The gate must be the FIRST statement (R4-U2 review finding 6) ──────────
//
// Six mutating handlers used to parse and validate the request body BEFORE
// calling guardRole, which handed an authenticated non-member a 400-vs-403
// SCHEMA ORACLE: it could map every mutating endpoint's request shape, and read
// the validators' exact messages, with no nao access at all. Source-order is
// the only place this is checkable, since the handlers are not importable.
test('source-conformance: the role gate is the FIRST statement of every handler, before any body parsing', () => {
  const handlers = discoverHandlers();
  let checked = 0;
  for (const h of handlers) {
    const key = `${h.method} ${h.routePath}`;
    const rel = path.relative(NAO_ROOT, h.file);
    // Body text after the handler's own signature line.
    const afterSignature = h.body.slice(h.body.indexOf('{') + 1);
    const firstStatement = afterSignature
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '');
    assert.match(
      firstStatement ?? '',
      /^const gate = await guardRole\('(viewer|curator|admin)'\)/,
      `${key} (${rel}): the first statement must be the guardRole gate, found: ${firstStatement}`,
    );
    const gateAt = h.body.search(/(?:requireRole|guardRole)\(/);
    for (const parseRe of [/req\.json\(\)/, /new URL\(req\.url\)/, /req\.headers/, /req\.formData\(\)/]) {
      const parseAt = h.body.search(parseRe);
      if (parseAt === -1) continue;
      assert.ok(
        gateAt > -1 && gateAt < parseAt,
        `${key} (${rel}): the gate must precede reading the request (${String(parseRe)})`,
      );
    }
    checked += 1;
  }
  assert.equal(checked, 14);
});

// ── Every mutating handler records a control event (R4-U2 review finding 2) ──
//
// public.nao_control_events shipped correct and harness-proven with ZERO write
// call sites, which made requirement 6 ("control mutations are append-only and
// attributed to the acting nao user") true of the table and false of the
// system — while 20260728010002_nao_redaction_grants.sql justified revoking
// updated_by/created_by by pointing at that always-empty log. This test is what
// stops the writers from disappearing again.
const MUTATING_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
  'POST /api/claims/reject': 'claims.reject',
  'POST /api/ingest-control': 'ingest_control.patch',
  'POST /api/ingest-control/trigger': 'ingest.trigger',
  'POST /api/loader': 'loader.simulate',
  'POST /api/loader/run-pipeline': 'pipeline.run',
  'POST /api/models/caps': 'models.cap_override',
  'POST /api/seeds': 'seeds.add',
  'PATCH /api/seeds': 'seeds.toggle',
});

test('source-conformance: every mutating handler uses a lifecycle boundary with its declared action', () => {
  const handlers = discoverHandlers();
  const mutating = handlers.filter((h) => h.method !== 'GET' && h.method !== 'HEAD' && h.method !== 'OPTIONS');
  assert.equal(mutating.length, 8, `expected 8 mutating handlers, found ${mutating.length}`);

  for (const h of mutating) {
    const key = `${h.method} ${h.routePath}`;
    const rel = path.relative(NAO_ROOT, h.file);
    const expected = MUTATING_ACTIONS[key];
    assert.ok(expected, `${key} (${rel}): mutating handler with no declared control action`);
    const call = /(?:action:\s*|recordControlEvent\(\s*)'([a-z_.]+)'/.exec(h.body);
    assert.ok(call, `${key} (${rel}): no declared audit action`);
    assert.equal(call[1], expected, `${key} (${rel}): records '${call[1]}' but should record '${expected}'`);
    assert.match(
      h.body,
      /(?:runAuditedControlMutation|applyTransactionalControlMutation)\(/,
      `${key} (${rel}): missing truthful lifecycle boundary`,
    );
    assert.match(h.body, /controlOperationId\(req\)/, `${key} (${rel}): missing stable operation id`);
    if (key === 'POST /api/loader') {
      assert.match(h.body, /action:\s*'loader\.simulate'/,
        `${key} (${rel}): loader attempt must use the closed loader action`);
      assert.match(h.body, /NaoControlOutcomeUnknownError/,
        `${key} (${rel}): response-loss ambiguity must remain outcome unknown`);
      assert.match(h.body, /controlOutcomeUnknownErrorResponse\(error\)/,
        `${key} (${rel}): outcome unknown must expose the stable operation id for reconciliation`);
    }
  }
  // No stale entry either.
  for (const key of Object.keys(MUTATING_ACTIONS)) {
    assert.ok(
      mutating.some((h) => `${h.method} ${h.routePath}` === key),
      `MUTATING_ACTIONS entry "${key}" has no matching handler on disk`,
    );
  }
});

test('source-conformance: every database mutation renders an indeterminate RPC response as outcome unknown', () => {
  const databaseMutations = new Set([
    'POST /api/claims/reject',
    'POST /api/models/caps',
    'POST /api/seeds',
    'PATCH /api/seeds',
  ]);
  const handlers = discoverHandlers().filter((handler) =>
    databaseMutations.has(`${handler.method} ${handler.routePath}`));
  assert.equal(handlers.length, databaseMutations.size);
  for (const handler of handlers) {
    const key = `${handler.method} ${handler.routePath}`;
    assert.match(handler.body, /error instanceof NaoControlOutcomeUnknownError/,
      `${key}: response-loss ambiguity must not become a generic 500 or false not-started claim`);
    assert.match(handler.body, /controlOutcomeUnknownErrorResponse\(error\)/,
      `${key}: outcome-unknown must return its stable operation id`);
  }
});

test("source-conformance: the recorded actions are exactly nao_control_events' CHECK vocabulary", () => {
  // Ties the route layer to the migration: adding an action needs both, and a
  // typo in either is a failing test rather than a runtime 23514.
  const migration = readFileSync(
    path.resolve(NAO_ROOT, '..', '..', 'supabase', 'migrations', '20260728010001_nao_control_events.sql'),
    'utf8',
  );
  const checkBlock = migration.slice(
    migration.indexOf('action        text not null check'),
    migration.indexOf('target        text'),
  );
  const declared = [...checkBlock.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(declared, Object.values(MUTATING_ACTIONS).sort());
});

test('source-conformance: recordControlEvent redacts detail and target, and never takes an actor argument', () => {
  // Line endings are NORMALISED to LF before slicing. On a Windows checkout
  // (core.autocrlf=true) the file is CRLF, so an indexOf() of a pattern written
  // with a literal '\n' finds nothing and returns -1 — and `slice(0, -1)` then
  // silently widens `signature` to the WHOLE remainder of the module, which
  // matches `userId` inside guardRole() and fails for the wrong reason. The
  // assertion below must test the function signature only.
  const server = readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8')
    .replace(/\r\n/g, '\n');
  const fn = server.slice(server.indexOf('export async function recordControlEvent'));
  assert.match(fn, /redactDeep\(event\.detail\)/, 'detail must be redacted before insert');
  assert.match(fn, /redactText\(event\.target\)/, 'target must be redacted before insert');
  // Attribution comes from the DB trigger (auth.uid()), never from a parameter —
  // there must be no actor/userId/role argument to get wrong or to lie in.
  const signatureEnd = fn.indexOf('): Promise<void> {\n');
  assert.notEqual(signatureEnd, -1, 'recordControlEvent lost its event-only implementation signature');
  const signature = fn.slice(0, signatureEnd);
  assert.match(signature, /event:\s*ControlEventInput/);
  assert.doesNotMatch(signature, /legacy|eventOrAction|NaoControlAction/,
    'recordControlEvent must not retain the U3 compatibility overload');
  for (const forbidden of ['actor', 'userId', 'user_id', 'role']) {
    assert.doesNotMatch(
      signature,
      new RegExp(forbidden),
      `recordControlEvent must not accept "${forbidden}" — the stamp trigger forces auth.uid()`,
    );
  }
});

// ── R4-U2 re-review finding N1: the audit insert can never fail on CONTENT ──
//
// `recordControlEvent` used to insert `redactDeep(detail)`/`redactText(target)`
// DIRECTLY. Redaction removes identity; it says nothing about whether a
// string is safe to store. A NUL byte in `paused` (ingestControl.ts) or
// `seed` (simulatedHealth.ts) made THIS insert fail with "unsupported Unicode
// escape sequence" while the caller's own mutation — an R2 write / numeric
// rows, neither of which round-trips the raw string through Postgres —
// succeeded anyway: an authorized actor suppressing their own audit row.
test('source-conformance: recordControlEvent sanitises detail and target for storage AFTER redacting them', () => {
  const server = readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8');
  const fn = server.slice(server.indexOf('export async function recordControlEvent'));
  assert.match(
    fn,
    /sanitizeStorageValue\(redactDeep\(event\.detail\)\)/,
    'detail must be sanitised for storage AFTER being redacted',
  );
  assert.match(
    fn,
    /sanitizeStorageValue\(redactText\(event\.target\)\)/,
    'target must be sanitised for storage AFTER being redacted',
  );
  assert.match(fn, /p_detail:\s*safeDetail/, 'the SANITISED detail, not the raw redacted one, must be inserted');
  assert.match(fn, /p_target:\s*safeTarget/, 'the SANITISED target, not the raw redacted one, must be inserted');
});

test('source-conformance: audit persistence failures are thrown, never logged and swallowed', () => {
  const server = readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8');
  const fn = server.slice(server.indexOf('export async function recordControlEvent'));
  assert.match(fn, /throw new Error\('control audit persistence failed'\)/);
  assert.doesNotMatch(fn, /console\.error/);
});

// ── The relay redaction is actually wired in (R4-U2 review finding 1) ──────
test('source-conformance: no handler relays an edge-function body or an error message unredacted', () => {
  for (const file of walkRouteFiles(API_ROOT)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    const rel = path.relative(NAO_ROOT, file);
    // Every JSON.parse of a relayed body must be wrapped in the relay redaction.
    for (const m of code.matchAll(/JSON\.parse\(([A-Za-z_$][\w$]*)\)/g)) {
      const before = code.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      assert.match(
        before,
        /redactRelayBody\(\s*$/,
        `${rel}: JSON.parse(${m[1]}) is relayed without redactRelayBody(...)`,
      );
    }
    // Every error string returned to the client must go through redactText.
    for (const m of code.matchAll(/error:\s*([^,\n}]*(?:err|error)\.message[^,\n}]*)/g)) {
      assert.match(
        m[1],
        /redactText\(/,
        `${rel}: an error message is returned to the client unredacted: ${m[1].trim()}`,
      );
    }
  }
});

// ── Forged-claim proof: role resolution ignores JWT claims entirely ────────
//
// requireRole()/resolveNaoRole() cannot be swayed by a forged `user_role`
// claim because they never read one — proven here by static absence across
// every module that could plausibly carry that logic, matching the R4-U2
// design's own technique for the identical constraint (design doc §A.4 item
// 4: "a source assertion checks that no U2 module and no route file
// references user_role").
//
// Comments are stripped before searching: this unit's own doc comments
// legitimately DISCUSS the deleted `user_role` scaffold by name (e.g. "the
// old role()/user_role scaffold was removed") — that prose is not a code
// reference and must not fail this check. Only executable code (a property
// access, an object key, a type field) counts.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('forged-claim proof: `user_role` appears NOWHERE in executable code in auth.ts, authzServer.ts, authz.ts, or any route file', () => {
  const filesToCheck = [
    path.join(NAO_ROOT, 'src', 'lib', 'auth.ts'),
    path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'),
    path.join(NAO_ROOT, 'src', 'lib', 'authz.ts'),
    ...walkRouteFiles(API_ROOT),
  ];
  for (const file of filesToCheck) {
    const code = stripComments(readFileSync(file, 'utf8'));
    assert.doesNotMatch(code, /user_role/, `${path.relative(NAO_ROOT, file)} must not reference user_role in code`);
  }
});

test("forged-claim proof: authzServer.ts's role resolution reads ONLY the nao_role() RPC — never a claim/metadata field", () => {
  const code = stripComments(readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8'));
  // The only role SOURCE must be the RPC call.
  assert.match(code, /supabase\.rpc\(\s*['"]nao_role['"]\s*\)/, 'must call supabase.rpc(\'nao_role\')');
  // Never read a claim/JWT/metadata field as a role input.
  for (const forbidden of ['user_role', 'app_metadata', 'user_metadata', '.claims', 'jwtDecode', 'jwt_decode']) {
    assert.doesNotMatch(code, new RegExp(forbidden.replace('.', '\\.')), `must not reference ${forbidden}`);
  }
});

test("forged-claim proof: requireRole()'s branch structure is unauthenticated -> 401, then !satisfies(...) -> 403 (never a claim-derived shortcut)", () => {
  const content = readFileSync(path.join(NAO_ROOT, 'src', 'lib', 'authzServer.ts'), 'utf8');
  const fn = content.slice(content.indexOf('export async function requireRole'));
  assert.match(fn, /if\s*\(\s*!user\s*\)\s*\{\s*throw new NaoAuthzError\(401,/s);
  assert.match(fn, /if\s*\(\s*!satisfies\(role,\s*required\)\s*\)\s*\{\s*throw new NaoAuthzError\(403,/s);
});

// ── Redacted-table select() hygiene ──────────────────────────────────────────
test("source-conformance: no route selects '*' on a redacted table (models/claims-reject/seeds)", () => {
  const redactedTables = ['llm_router_cap_overrides', 'edge_human_verdicts', 'ingestion_seeds'];
  for (const file of walkRouteFiles(API_ROOT)) {
    const content = readFileSync(file, 'utf8');
    for (const table of redactedTables) {
      const re = new RegExp(
        `\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,80}?\\.select\\(\\s*['"]\\*['"]\\s*\\)`,
      );
      assert.doesNotMatch(
        content,
        re,
        `${path.relative(NAO_ROOT, file)}: must not select('*') on ${table}`,
      );
    }
  }
});

test('source-conformance: no route file references SUPABASE_SERVICE_ROLE_KEY in executable code', () => {
  // Comments stripped first, same convention as the user_role forged-claim test above: a route
  // file's doc comment may legitimately DISCUSS this env var by name (e.g. run-pipeline/route.ts
  // now documents "nao NO LONGER READS SUPABASE_SERVICE_ROLE_KEY anywhere" as history/rationale)
  // without that prose being a code reference. Only an actual identifier/string in executable
  // code counts.
  for (const file of walkRouteFiles(API_ROOT)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    assert.doesNotMatch(
      code,
      /SUPABASE_SERVICE_ROLE_KEY/,
      `${path.relative(NAO_ROOT, file)}: must not reference SUPABASE_SERVICE_ROLE_KEY`,
    );
  }
});

test("source-conformance: claims/reject, models, models/caps, and seeds routes never select/return created_by or updated_by", () => {
  const files = [
    path.join(API_ROOT, 'claims', 'reject', 'route.ts'),
    path.join(API_ROOT, 'models', 'route.ts'),
    path.join(API_ROOT, 'models', 'caps', 'route.ts'),
    path.join(API_ROOT, 'seeds', 'route.ts'),
  ];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    // created_by/updated_by are still WRITTEN (the RLS with-check columns) —
    // that's fine and required. They must never appear inside a .select(...)
    // column list, whether inline (`.select('a, b')`) or via a named column
    // constant (`.select(SEED_COLUMNS)`, declared as `const SEED_COLUMNS =
    // 'a, b'`) — this regex captures both forms.
    const candidateLists = [
      ...content.matchAll(/(?:const\s+\w+\s*=\s*|\.select\()\s*(['"])((?:(?!\1).)*)\1/g),
    ].map((m) => m[2]);
    assert.ok(candidateLists.length > 0, `${path.relative(NAO_ROOT, file)}: expected at least one column list to check`);
    for (const cols of candidateLists) {
      assert.doesNotMatch(
        cols,
        /created_by|updated_by/,
        `${path.relative(NAO_ROOT, file)}: a select column list must not include created_by/updated_by (found in "${cols}")`,
      );
    }
  }
});
