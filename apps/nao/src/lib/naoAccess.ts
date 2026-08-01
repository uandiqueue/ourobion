// ourobion nao — UI availability, DERIVED from the one declared authorization
// surface (R4 viewer read-only UX).
//
// This module answers exactly one question for the browser: "would the server
// accept this call from this caller?" — so a control that the server would
// refuse can be rendered unavailable up front instead of firing and coming back
// refused. It is a COURTESY, never a boundary: every route still calls
// guardRole() as its first statement (proven by the source-conformance tests in
// ./../../tests/authz.test.ts), and a forged request from a browser with every
// control re-enabled by hand is refused identically. Nothing here weakens,
// mirrors, or short-circuits that.
//
// THE WHOLE POINT IS THAT NOTHING HERE IS HAND-MAINTAINED. Every answer comes
// from ./authz.ts's ROUTE_POLICY matrix and satisfies() — the same two values
// the server decides with. A hand-written list of "buttons a viewer may not
// press" would silently drift from the server the first time a route's required
// role changed; ROUTE_POLICY cannot, because authz.test.ts fails if a handler
// has no entry, has a stale entry, or guards with a role that differs from its
// entry. MUTATING_ROUTE_KEYS below is likewise computed from the matrix's own
// keys rather than enumerated, so a route added tomorrow is covered on the day
// it ships.
//
// Zero I/O and zero framework imports (like ./authz.ts, and for the same
// reason): `node --test` imports and executes this directly, with no mocking, so
// the availability arithmetic the UI renders is proven by execution rather than
// asserted by source shape.
import { ROUTE_POLICY, requiredRoleFor, satisfies, type NaoRole } from './authz.ts';

/**
 * A ROUTE_POLICY key: `"${METHOD} ${routePath}"`, e.g. `"POST /api/seeds"`.
 * Deliberately the SAME string the matrix is keyed by, so a control declares
 * the route it calls and nothing has to translate between two vocabularies.
 */
export type RouteKey = string;

/**
 * Methods that only read. Everything else is treated as a mutation — an
 * allowlist, not a denylist, so an unfamiliar method (a future PUT/DELETE)
 * counts as mutating rather than slipping through as a read.
 */
const READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

function splitRouteKey(key: RouteKey): { method: string; routePath: string } | null {
  const at = key.indexOf(' ');
  if (at <= 0 || at === key.length - 1) {
    return null;
  }
  return { method: key.slice(0, at), routePath: key.slice(at + 1) };
}

/** True iff `key` names a method that changes state (see {@link READ_METHODS}). */
export function isMutatingRouteKey(key: RouteKey): boolean {
  const parts = splitRouteKey(key);
  if (parts === null) {
    return true; // unparseable: fail closed, treat as a mutation
  }
  return !READ_METHODS.has(parts.method.toUpperCase());
}

/**
 * Every state-changing route the app declares, computed from ROUTE_POLICY's own
 * keys. NOT a curated list: adding a mutating route to the matrix adds it here,
 * which is what keeps {@link isReadOnlyRole} honest without anyone remembering
 * to update it.
 */
export const MUTATING_ROUTE_KEYS: readonly RouteKey[] = Object.freeze(
  Object.keys(ROUTE_POLICY).filter(isMutatingRouteKey).sort(),
);

/** The role a route key requires, or `undefined` when the key is not declared. */
export function requiredRoleForKey(key: RouteKey): NaoRole | undefined {
  const parts = splitRouteKey(key);
  if (parts === null) {
    return undefined;
  }
  return requiredRoleFor(parts.method, parts.routePath);
}

/**
 * Would the server accept this call from a caller holding `role`?
 *
 * An undeclared key returns `false` — the same fail-closed rule
 * `requiredRoleFor`'s doc comment states for the server side. A control wired to
 * a route nobody declared renders unavailable rather than enabled-and-hopeful.
 */
export function canUseRoute(role: NaoRole | null, key: RouteKey): boolean {
  const required = requiredRoleForKey(key);
  if (required === undefined) {
    return false;
  }
  return satisfies(role, required);
}

/**
 * True iff `role` can call NO state-changing route at all. Derived by asking
 * {@link canUseRoute} about every mutating key in the matrix, so it is a
 * statement about what this build's routes actually allow, not a synonym for
 * the string 'viewer'.
 */
export function isReadOnlyRole(role: NaoRole | null): boolean {
  return MUTATING_ROUTE_KEYS.every((key) => !canUseRoute(role, key));
}

// ---------------------------------------------------------------------------
// Copy. Plain-language, no role names, no status codes, no table names — a
// person reading this should learn what they can do, not how the system is
// wired. Every string below is held to the repo's non-diagnostic copy gate by
// apps/nao/tests/naoAccess.test.ts.
// ---------------------------------------------------------------------------

/** Shown on a control the caller cannot use, when they cannot change anything at all. */
export const CONTROL_UNAVAILABLE_READ_ONLY = 'Your access is read-only, so this control is inactive.';

/** Shown on a control the caller cannot use, when they can change some other things. */
export const CONTROL_UNAVAILABLE_HIGHER_ACCESS = 'This control is inactive at your access level.';

export const READ_ONLY_BANNER_LABEL = 'READ-ONLY ACCESS';

export const READ_ONLY_BANNER_BODY =
  'You can read everything in nao — papers, claims, model spend, knowledge gaps and pipeline ' +
  'history. Controls that would change the corpus are shown, but stay inactive.';

/** What a control should render: usable, or unavailable with a short reason. */
export interface ControlAccess {
  allowed: boolean;
  /** `null` exactly when `allowed` is true. */
  reason: string | null;
}

/**
 * The one call a control makes. `reason` is the short line rendered beside (and
 * as the title of) an unavailable control — chosen from the two strings above by
 * asking the matrix what this caller can do overall, so a curator blocked by an
 * admin-only control is not told their access is read-only.
 */
export function controlAccess(role: NaoRole | null, key: RouteKey): ControlAccess {
  if (canUseRoute(role, key)) {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason: isReadOnlyRole(role) ? CONTROL_UNAVAILABLE_READ_ONLY : CONTROL_UNAVAILABLE_HIGHER_ACCESS,
  };
}

/** The first unusable route in `keys`, or `null` when the caller may use them all. */
export function firstBlockedControl(role: NaoRole | null, keys: readonly RouteKey[]): ControlAccess | null {
  for (const key of keys) {
    const access = controlAccess(role, key);
    if (!access.allowed) {
      return access;
    }
  }
  return null;
}
