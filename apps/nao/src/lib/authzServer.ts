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
  prepareControlMutationStorage,
  sanitizeStorageValue,
  satisfies,
  type NaoRole,
} from './authz.ts';
import {
  CONTROL_OPERATION_HEADER,
  NaoControlAuditError,
  NaoControlMutationError,
  NaoControlOutcomeUnknownError,
  requireKnownControlRpcCall,
  resolveControlOperationId,
  runAuditedControlMutation as runAuditedControlMutationPure,
  type ControlEventInput,
  type NaoControlAction,
} from './controlAudit.ts';

export { redactDeep, redactRelayBody, redactText, sanitizeStorageValue };
export {
  CONTROL_OPERATION_HEADER,
  NaoControlAuditError,
  NaoControlMutationError,
  NaoControlOutcomeUnknownError,
};

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
export type { NaoControlAction } from './controlAudit.ts';

/**
 * Record one phase in the append-only, admin-readable
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
 * SANITISED FOR STORAGE, ALWAYS: after redaction,
 * `detail`/`target` also go through {@link sanitizeStorageValue}, which strips
 * any character Postgres `text`/`jsonb` cannot hold (NUL foremost — a NUL in
 * `paused` or `seed` used to make THIS insert fail with "unsupported Unicode
 * escape sequence" while the caller's own mutation, having no such
 * restriction, still succeeded — an authorized actor suppressing their own
 * audit row). Persistence failures now throw. The mutation does not start
 * unless its attempt is durable, and an external post-effect outcome failure
 * leaves that attempt unresolved for explicit reconciliation.
 */
export async function recordControlEvent(event: ControlEventInput): Promise<void>;
export async function recordControlEvent(
  event: ControlEventInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  // Redaction removes identity; sanitisation removes bytes Postgres cannot store.
  const safeTarget = event.target === null ? null : sanitizeStorageValue(redactText(event.target));
  const safeDetail = sanitizeStorageValue(redactDeep(event.detail));
  const { data, error } = await supabase.rpc('nao_record_control_event', {
    p_operation_id: event.operationId,
    p_action: event.action,
    p_phase: event.phase,
    p_target: safeTarget,
    p_detail: safeDetail,
    p_error_code: event.errorCode,
  });
  if (error || data !== true) throw new Error('control audit persistence failed');
}

export function controlOperationId(req: Request): ReturnType<typeof resolveControlOperationId> {
  return resolveControlOperationId(req.headers.get(CONTROL_OPERATION_HEADER));
}

export async function runAuditedControlMutation<T>(input: {
  operationId: string;
  action: NaoControlAction;
  target?: string | null;
  detail?: Record<string, unknown>;
  mutate: () => Promise<T>;
}): Promise<{ operationId: string; value: T }> {
  return runAuditedControlMutationPure({ ...input, append: recordControlEvent });
}

export type TransactionalControlResult =
  | { ok: true; operationId: string; record: Record<string, unknown> }
  | { ok: false; operationId: string; errorCode: string; status: number };

export async function applyTransactionalControlMutation(input: {
  operationId: string;
  action: Extract<NaoControlAction, 'seeds.add' | 'seeds.toggle' | 'claims.reject' | 'models.cap_override'>;
  target: string;
  detail?: Record<string, unknown>;
  payload: Record<string, unknown>;
}): Promise<TransactionalControlResult> {
  const supabase = await createServerSupabaseClient();
  const stored = prepareControlMutationStorage({
    target: input.target,
    detail: input.detail ?? {},
    payload: input.payload,
  });
  return requireKnownControlRpcCall<TransactionalControlResult>(input.operationId, async () => {
    const { data, error } = await supabase.rpc('nao_apply_control_mutation', {
      p_operation_id: input.operationId,
      p_action: input.action,
      p_target: stored.target,
      p_detail: stored.detail,
      p_payload: stored.payload,
    });
    return { data, error };
  });
}

export function controlAuditErrorResponse(error: NaoControlAuditError): Response {
  const message = error.code === 'audit_attempt_unavailable'
    ? 'control action not started because its audit attempt could not be recorded'
    : 'control action outcome is unresolved; reconcile it by operationId before retrying';
  return new Response(JSON.stringify({ error: message, code: error.code, operationId: error.operationId }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
}

export function controlOutcomeUnknownErrorResponse(error: NaoControlOutcomeUnknownError): Response {
  return new Response(JSON.stringify({
    error: 'control action outcome is unknown; reconcile it by operationId before retrying',
    code: error.code,
    operationId: error.operationId,
  }), {
    status: error.status,
    headers: { 'content-type': 'application/json' },
  });
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
