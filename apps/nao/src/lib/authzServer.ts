// ourobion nao — server-only authorization glue (R4-U2).
//
// The ONE place a route handler learns "is this caller a nao member, and at
// what tier". Every route under apps/nao/src/app/(app)/api/** calls
// requireRole()/guardRole() as its first statement — see the
// source-conformance test in apps/nao/tests/authz.test.ts, which walks every
// route file and fails if a handler lacks the call, or if its role argument
// drifts from ./authz.ts's ROUTE_POLICY.
//
// resolveNaoRole() / requireRole() read the database function `nao_role()`
// EVERY TIME they run — no caching, no memoisation, and NO reading a role out
// of the session/JWT. This is deliberate, not an oversight:
//   - A Supabase access token lives for the session TTL and is silently
//     refreshed by @supabase/ssr (see src/middleware.ts). Any role baked into
//     a claim would stay valid up to that TTL even after a revoke/suspend/
//     demote in `nao_members` — a table read is revocation-immediate, a claim
//     read is not.
//   - auth.ts's old `role()`/`user_role` scaffold read a claim that nothing
//     ever set (see auth.ts's header comment for why it was deleted in this
//     unit) — it was a trap, not a feature: a future token-customisation hook
//     populated from any user-influenceable source would have silently become
//     an authorization input.
// Neither function below references `user_role`, `claims`, or any JWT payload
// field for role — the only role input is the `nao_role()` RPC result.
//
// TEST SEAM (deliberate, disclosed): this module imports `next/headers`
// transitively (via ./supabase-server.ts), which `node --test` cannot safely
// exercise without a live Next request context — the same F8 constraint that
// keeps route handlers themselves (which import the `@/lib/...` TS-only path
// alias) from being importable by node's test runner. `requireRole`/
// `resolveNaoRole` are therefore proven by:
//   (a) `tsc --noEmit` type-checking this exact call shape against every
//       route file's usage, and
//   (b) the source-conformance test in authz.test.ts asserting this module
//       (i) never references `user_role` / decodes a JWT payload for role,
//       and (ii) is called correctly by every route.
// The actual allow/deny ARITHMETIC these functions depend on — `satisfies()`
// and the whole `ROUTE_POLICY` matrix — lives in ./authz.ts, which has ZERO
// I/O and IS fully exercised by node --test with no mocking, so the decision
// logic itself is proven directly by execution, not merely asserted by
// source shape.
//
// `redactDeep`, `redactRelayBody` and `redactText` have no dependency on any of
// the above: they are pure, defined in ./authz.ts, and re-exported here
// UNCHANGED so this module satisfies the R4-U2 interface contract's
// server-module surface (`export function redactDeep<T>(value: T): T`) while
// staying directly testable via `../src/lib/authz.ts` with no mocking at all.
// `recordControlEvent` (below) is the one member of this module's surface that
// is NOT pure and NOT in the original contract §3 — it was the missing writer
// for `public.nao_control_events`, without which requirement 6 ("control
// mutations are append-only and attributed to the acting nao user") was true of
// the table and false of the system.
import { createServerSupabaseClient } from './supabase-server.ts';
import {
  redactDeep,
  redactRelayBody,
  redactText,
  sanitizeStorageValue,
  satisfies,
  type NaoRole,
} from './authz.ts';

export { redactDeep, redactRelayBody, redactText, sanitizeStorageValue };

/**
 * Thrown by requireRole(). `status` is always exactly 401 (no session at all)
 * or 403 (session present but no/insufficient nao_members role) — see
 * requireRole()'s doc comment for the fail-closed rule that decides which.
 */
export class NaoAuthzError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = 'NaoAuthzError';
    this.status = status;
  }
}

function isNaoRole(value: unknown): value is NaoRole {
  return value === 'viewer' || value === 'curator' || value === 'admin';
}

/**
 * Read the caller's nao role fresh from the database on EVERY call:
 * `supabase.rpc('nao_role')`, a `security definer`, `stable` Postgres function
 * keyed off `auth.uid()` (it takes NO argument — it is impossible to ask
 * about another user; see the R4-U2 interface contract §1).
 *
 * Returns `null` when there is no signed-in session, OR the signed-in user
 * has no effective `nao_members` row (never provisioned, suspended, or
 * revoked — the database function collapses all three to NULL, and this
 * function does not need to know which). Never derived from a JWT claim.
 */
export async function resolveNaoRole(): Promise<NaoRole | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data, error } = await supabase.rpc('nao_role');
  if (error || !isNaoRole(data)) {
    return null;
  }
  return data;
}

/**
 * Every route handler's first statement (directly, or via {@link guardRole}).
 * Resolves the caller and their nao role from the database — never a claim —
 * and throws {@link NaoAuthzError} when the caller may not proceed:
 *   - no session at all                              -> 401 (unauthenticated)
 *   - session, but no/insufficient nao_members role   -> 403 (unauthorised)
 * Both denial messages are the SAME kind of opaque string ('not authenticated'
 * / 'no nao access') and neither reveals whether a nao membership exists for
 * the account or what role it holds — an unauthorized caller cannot
 * distinguish "you're not a member" from "you're a member but too low a
 * tier" from the response alone. Any RPC error is treated as "no role" (fail
 * closed to 403), never as success.
 */
export async function requireRole(required: NaoRole): Promise<{ userId: string; role: NaoRole }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new NaoAuthzError(401, 'not authenticated');
  }
  const { data, error } = await supabase.rpc('nao_role');
  const role = !error && isNaoRole(data) ? data : null;
  if (!satisfies(role, required)) {
    throw new NaoAuthzError(403, 'no nao access');
  }
  // `satisfies(null, required)` is always `false` (see ./authz.ts), so
  // reaching here proves `role` is non-null — TS just can't narrow through a
  // function call, hence the explicit assertion.
  return { userId: user.id, role: role as NaoRole };
}

/** The constant, opaque response body/status for a denied request. Never echoes an identity or a role. */
export function authzErrorResponse(err: NaoAuthzError): Response {
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Control-event recording (R4-U2 requirement 6).
// ---------------------------------------------------------------------------

/**
 * The closed action vocabulary of `public.nao_control_events.action`.
 *
 * Mirrors the CHECK constraint in
 * supabase/migrations/20260728010001_nao_control_events.sql byte-for-byte.
 * Adding an action needs a migration by design — an audit log with an open
 * vocabulary cannot be reviewed — and this union is what makes a typo a
 * `tsc --noEmit` failure instead of a runtime 23514.
 */
export type NaoControlAction =
  | 'ingest_control.patch'
  | 'ingest.trigger'
  | 'seeds.add'
  | 'seeds.toggle'
  | 'models.cap_override'
  | 'claims.reject'
  | 'loader.simulate'
  | 'pipeline.run';

/**
 * Record ONE row in the append-only, admin-readable
 * `public.nao_control_events` log. Every mutating nao handler calls this — the
 * source-conformance test in apps/nao/tests/authz.test.ts fails if a mutating
 * handler does not.
 *
 * ATTRIBUTION IS NOT A PARAMETER, deliberately: there is no actor argument to
 * get wrong or to lie in. The `nao_control_events_stamp` BEFORE INSERT trigger
 * OVERWRITES `actor_user_id` with `auth.uid()` and `actor_role` with
 * `nao_role()`, and raises 42501 when either is null — so the write happens
 * through the cookie-bound anon client (never the service role, for whom
 * `auth.uid()` is NULL and the insert would be refused).
 *
 * `detail` and `target` are passed through the SAME redaction as a response
 * body ({@link redactDeep} / {@link redactText}), because the table's contract
 * is that `detail` never contains a secret or a raw identity and nothing in the
 * database can enforce that. A caller that hands over a whole request body
 * therefore cannot leak an `authorization`/`secret` key or a user uuid into the
 * audit log by accident.
 *
 * SANITISED FOR STORAGE, ALWAYS (R4-U2 re-review finding N1): after redaction,
 * `detail`/`target` also go through {@link sanitizeStorageValue}, which strips
 * any character Postgres `text`/`jsonb` cannot hold (NUL foremost — a NUL in
 * `paused` or `seed` used to make THIS insert fail with "unsupported Unicode
 * escape sequence" while the caller's own mutation, having no such
 * restriction, still succeeded — an authorized actor suppressing their own
 * audit row). This is what makes the catch-and-swallow below acceptable: it
 * now only catches failures this layer cannot prevent (the database being
 * unreachable, a schema change), never a failure caused by the CONTENT of the
 * event, because no such content survives to reach the insert.
 *
 * BEST-EFFORT BY DESIGN: a failed audit insert is logged — with the action and
 * (redacted) target named, plus the error, so a missing row is identifiable
 * after the fact — and swallowed. The alternative — 500ing a control action
 * that already succeeded — would be worse for both the operator and the audit
 * trail, and the row-level guarantees this log makes (append-only, unspoofable
 * attribution) are about rows that exist, not about liveness.
 */
export async function recordControlEvent(
  action: NaoControlAction,
  target: string | null = null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    // ── control-event:begin — extracted verbatim (this sentinel spans the
    // rest of the try body AND the whole catch block below, not just the
    // insert call — apps/nao/tests/redact.test.ts wraps it in its OWN
    // `try { ... }` to reconstruct exactly this shape, so it can exercise
    // both the success path and the swallow/log path for real) ──
    // sanitizeStorageValue runs AFTER redactDeep/redactText: redaction removes
    // IDENTITY, sanitisation removes any byte the database cannot store at
    // all. Together they guarantee this insert can never fail on the
    // CONTENT of an event, whatever validation upstream did or didn't catch —
    // which is what makes swallowing the (now purely infrastructural) failure
    // below acceptable rather than silently losing an authorized actor's audit
    // row (R4-U2 re-review finding N1).
    const safeTarget = target === null ? null : sanitizeStorageValue(redactText(target));
    const safeDetail = sanitizeStorageValue(redactDeep(detail));
    const { error } = await supabase.from('nao_control_events').insert({
      action,
      target: safeTarget,
      detail: safeDetail,
    });
    if (error) {
      console.error(
        `nao_control_events insert failed for action=${action} target=${safeTarget ?? 'null'}: ${redactText(error.message)}`,
      );
    }
  } catch (err) {
    console.error(
      `nao_control_events insert threw for action=${action} target=${target === null ? 'null' : redactText(target)}: ${redactText(err instanceof Error ? err.message : String(err))}`,
    );
  }
  // ── control-event:end ──
}

export type RoleGate =
  | { ok: true; userId: string; role: NaoRole }
  | { ok: false; response: Response };

/**
 * Convenience wrapper around {@link requireRole} for route handlers that
 * prefer a return-value guard over try/catch (every route in this unit uses
 * this form — see apps/nao/src/app/(app)/api/**\/route.ts). Exactly
 * equivalent to:
 *   try { const { userId, role } = await requireRole(required); ... }
 *   catch (err) {
 *     if (err instanceof NaoAuthzError) return authzErrorResponse(err);
 *     throw err;
 *   }
 * Re-throws anything that is not a NaoAuthzError (a genuine bug, not a denial)
 * so it surfaces as a 500 rather than being silently swallowed as a 403.
 */
export async function guardRole(required: NaoRole): Promise<RoleGate> {
  try {
    const { userId, role } = await requireRole(required);
    return { ok: true, userId, role };
  } catch (err) {
    if (err instanceof NaoAuthzError) {
      return { ok: false, response: authzErrorResponse(err) };
    }
    throw err;
  }
}
