// ourobion nao — pure authorization policy (R4-U2).
//
// Zero I/O, zero framework imports (no `next/*`, no `@/*` alias), so this
// module is directly importable by `node --test` with no mocking at all (see
// apps/nao/tests/authz.test.ts). It is the SINGLE source of truth for two
// decisions:
//   1. which nao capability tier a given route requires (ROUTE_POLICY), and
//   2. whether an actual tier satisfies a required one (satisfies()).
// ./authzServer.ts imports ONLY from here for that arithmetic — nothing
// re-derives the rank ordering or the route matrix anywhere else.
//
// Capability tiers are NOT three kinds of person: every nao capability tier is
// the same "ourobion dev" identity (nao_members membership is what grants nao
// access AT ALL — see the R4-U2 design §A.0); the tier only bounds what that
// dev may do inside nao. The tier is resolved from the `nao_members` table via
// the database function `nao_role()` ONLY (./authzServer.ts's
// resolveNaoRole/requireRole) — it is NEVER read from a JWT claim. A claim is
// stale for the whole session TTL and is forgeable in the threat model this
// unit's tests cover (see the forged-`user_role`-claim assertions in
// apps/nao/tests/authz.test.ts).

/** Closed, ranked capability-tier enum — the only three nao roles that exist. */
export type NaoRole = 'viewer' | 'curator' | 'admin';

/** Lowest to highest. A higher tier satisfies a lower requirement (never the reverse). */
export const ROLE_ORDER: readonly NaoRole[] = ['viewer', 'curator', 'admin'];

const RANK: Readonly<Record<NaoRole, number>> = Object.freeze({
  viewer: 0,
  curator: 1,
  admin: 2,
});

/**
 * True iff `actual` is non-null and ranks at or above `required`.
 * Fail closed: `null` (unauthenticated, non-member, suspended, or revoked —
 * ./authzServer.ts collapses all of those to `null`) never satisfies anything,
 * and an unrecognised string can't reach this function at all because `actual`
 * is typed `NaoRole | null`, not `string | null`.
 */
export function satisfies(actual: NaoRole | null, required: NaoRole): boolean {
  if (actual === null) {
    return false;
  }
  return RANK[actual] >= RANK[required];
}

/**
 * The complete route → role matrix, keyed `"${METHOD} ${routePath}"`. This is
 * the ONE declared authorization surface for every nao API route. The
 * source-conformance test in apps/nao/tests/authz.test.ts walks every handler
 * under apps/nao/src/app/(app)/api/** and fails if:
 *   (a) a handler has no entry here,
 *   (b) an entry here has no matching route file/handler (a stale policy), or
 *   (c) a handler's actual `requireRole(...)` argument drifts from its entry.
 * That is what stops a future route from shipping unguarded.
 *
 * COUNT NOTE (verified against the route files themselves, not assumed from
 * the brief): the R4-U2 dispatch brief cites "13 handlers across 10 files".
 * A literal count of exported HTTP-method handlers across the 10 route files
 * is **14**: `seeds/route.ts` exports GET, POST, *and* PATCH as three separate
 * handlers, while the design doc's own per-route table (§B.2) collapses
 * POST+PATCH into a single presentation row ("POST / PATCH") to fit a 13-row
 * table. This matrix lists all 14 real method+path pairs, and the
 * source-conformance test counts 14 discovered handlers, not 13 — see that
 * test's header comment for the same note.
 */
export const ROUTE_POLICY: Readonly<Record<string, NaoRole>> = Object.freeze({
  'GET /api/claims': 'viewer',
  'POST /api/claims/reject': 'curator',
  'GET /api/gaps': 'viewer',
  'GET /api/ingest-control': 'viewer',
  'POST /api/ingest-control': 'admin',
  'POST /api/ingest-control/trigger': 'curator',
  'GET /api/loader': 'viewer',
  'POST /api/loader': 'curator',
  'POST /api/loader/run-pipeline': 'curator',
  'GET /api/models': 'viewer',
  'POST /api/models/caps': 'admin',
  'GET /api/seeds': 'viewer',
  'POST /api/seeds': 'curator',
  'PATCH /api/seeds': 'curator',
});

/**
 * Look up the required role for a method+path pair. `undefined` = unknown
 * route — callers must treat that as fail-closed (deny), never as "no gate
 * needed".
 */
export function requiredRoleFor(method: string, routePath: string): NaoRole | undefined {
  return ROUTE_POLICY[`${method.toUpperCase()} ${routePath}`];
}

// ---------------------------------------------------------------------------
// Redaction — pure, deny-by-shape, zero I/O.
//
// Lives here (not in authzServer.ts) so it is directly importable by
// `node --test` with no mocking. authzServer.ts re-exports `redactDeep`
// unchanged so that module still satisfies the R4-U2 interface contract's
// server-module surface (`export function redactDeep<T>(value: T): T`) —
// see authzServer.ts's header comment for why the split exists.
// ---------------------------------------------------------------------------

/**
 * Canonical 8-4-4-4-12 UUID, case-insensitive, ANCHORED — the WHOLE-VALUE test.
 * Used where the question is "is this entire value an identifier?" (cohort
 * counting, callers that classify a field). It deliberately does NOT match a
 * uuid embedded in a sentence — see {@link UUID_SCAN_RE} for that.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The same shape, UNANCHORED and global — the SCANNING variant used to scrub an
 * identifier out of free text.
 *
 * Why both exist (R4-U2 review finding 4): every payload this module protects
 * carries free text — a relayed `reason` string like
 * `O16 orientation violation dropped: <uuid>:<ruleId>`, or a Postgres violation
 * message like `Key (user_id, log_date)=(<uuid>, 2026-07-28) already exists`.
 * An anchored-only test cannot see either, so a whole-value check alone is not
 * "deny by shape" for strings. Values are therefore scrubbed with this variant
 * and CLASSIFIED with the anchored one.
 */
const UUID_SCAN_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Email addresses embedded in a value. Staff identity leaks this way, not as a
 * uuid: `ingest-control`'s control document stamps `updatedBy` with
 * `session.user.email` (see src/lib/ingestControl.ts), so the value-shape rule
 * has to cover an address as well as a uuid.
 */
const EMAIL_SCAN_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export const REDACTED = '[redacted]';

/**
 * Scrub identity out of a STRING value: every uuid-shaped and every
 * email-shaped substring becomes {@link REDACTED}, wherever it sits. A value
 * that IS just a uuid therefore becomes exactly `REDACTED`, and a uuid inside a
 * sentence is replaced in place with the surrounding words kept (they are the
 * operator-useful part).
 *
 * This is the only string-redaction primitive: {@link redactDeep} applies it to
 * every string it walks, and the relay route applies it directly to the two
 * places a payload is a bare string rather than an object — the non-JSON `raw`
 * fallback and a caught `err.message`.
 */
export function redactText(value: string): string {
  return value.replace(UUID_SCAN_RE, REDACTED).replace(EMAIL_SCAN_RE, REDACTED);
}

/**
 * Keys dropped at ANY depth: the identity columns that leak today
 * (created_by/updated_by/invited_by), `user_id` and other identity-shaped keys
 * named in the R4-U2 contract, and secret-shaped keys (so a relayed
 * edge-function payload or a stray header echo can never carry one through).
 *
 * Written in snake_case for readability ONLY. Matching is
 * separator-insensitive as well as case-insensitive (see {@link isDenyKey}), so
 * ONE entry here covers `user_id`, `userId`, `USER_ID`, `user-id` and
 * `User Id` alike. That normalisation is load-bearing, not cosmetic: the
 * repo's own payloads are camelCase on BOTH sides of this boundary — the edge
 * functions return `brainScopeSkips: [{ userId, ... }]` and
 * `cards.droppedAtRender: [{ userId, ... }]`
 * (supabase/functions/generate-insights/index.ts), and the route layer stamps
 * `updatedBy` (src/lib/ingestControl.ts). A plain lowercased set-membership
 * test (`'userId'.toLowerCase() === 'userid' !== 'user_id'`) matched NEITHER,
 * which is exactly how the R4-U2 review's high finding stayed open: the key
 * denylist looked complete and covered none of the keys that actually leak.
 */
export const DENY_KEYS: readonly string[] = [
  'created_by',
  'updated_by',
  'invited_by',
  'user_id',
  'actor',
  'actor_user_id',
  'sub',
  'email',
  'authorization',
  'apikey',
  'secret',
  'token',
  'key',
  'x-ourobion-internal-secret',
];

/**
 * Fold a key to its canonical form: lower-case, with every separator and
 * non-alphanumeric character removed. `user_id`, `userId`, `USER_ID`,
 * `user-id` and `User Id` all fold to `userid`.
 *
 * It is a full-token fold, NOT a substring match, so `metricKeys` does not
 * collide with the `key` entry and `userIds` does not collide with `user_id` —
 * a new key still has to BE one of the denied names, spelled in any convention.
 */
export function canonicalDenyKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const DENY_KEY_SET = new Set(DENY_KEYS.map(canonicalDenyKey));

/** True iff `key` is a denied key in ANY case/separator convention. */
export function isDenyKey(key: string): boolean {
  return DENY_KEY_SET.has(canonicalDenyKey(key));
}

const DEFAULT_MAX_DEPTH = 12;

/**
 * Deep-clone `value`, dropping any key in {@link DENY_KEYS} (in any case or
 * separator convention — see {@link isDenyKey}) at any depth, and scrubbing
 * every uuid-shaped or email-shaped substring out of every STRING VALUE
 * ({@link redactText}) — regardless of what key it's under, so an identity
 * value surviving under an unanticipated key name is still caught. Arrays are
 * walked element-wise. This is deliberately "deny by shape" rather than an
 * allowlist per response type, so it keeps holding when a relayed payload's
 * shape changes (e.g. a future pipeline-stage summary that starts including a
 * user list) without needing to be re-taught that shape.
 *
 * `maxDepth` bounds recursion against pathological/cyclic-looking input; a
 * value beyond it is replaced with {@link REDACTED} rather than thrown on,
 * since this runs on the response-serialisation path and must never 500.
 */
export function redactDeep<T>(value: T, maxDepth: number = DEFAULT_MAX_DEPTH): T {
  return redactAny(value, maxDepth) as T;
}

function redactAny(value: unknown, depth: number): unknown {
  if (depth < 0) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    // Unanchored scan, not a whole-value test: an identifier embedded in a
    // relayed `reason` or a Postgres violation message must go too (see
    // UUID_SCAN_RE's comment for why the anchored form is not enough).
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAny(item, depth - 1));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isDenyKey(k)) {
        continue;
      }
      out[k] = redactAny(v, depth - 1);
    }
    return out;
  }
  return value;
}

/**
 * Small-cohort suppression threshold — k = 5. The conventional minimum cell
 * size for de-identified aggregates (US NCHS/CDC and UK ONS suppression
 * rules both floor at 5; Singapore PDPC anonymisation guidance recommends
 * k >= 5), and small enough not to empty a two-dev demo cohort's panel while
 * still removing single-user and pair inference outright. See the R4-U2
 * design doc §C.3 for the full justification and the honest limit (this is a
 * fire-count floor, not true k-anonymity, since gap_ledger.demand carries no
 * distinct-user count).
 */
export const SMALL_COHORT_MIN = 5;

/** Drop any row whose `demand` count is below `k` (default {@link SMALL_COHORT_MIN}). */
export function suppressSmallCohort<T extends { demand: number }>(
  rows: readonly T[],
  k: number = SMALL_COHORT_MIN,
): T[] {
  return rows.filter((row) => row.demand >= k);
}

// ---------------------------------------------------------------------------
// Relay redaction — the shape the run-pipeline relay returns to the browser.
// ---------------------------------------------------------------------------

/** The marker that replaces a suppressed per-user array. Never carries a row. */
export interface SuppressedCohort {
  suppressed: 'small-cohort';
  rows: number;
  cohortBelow: number;
}

/**
 * Distinct identity values in an array of per-entity rows, or `null` when the
 * array carries no identity at all (so it is not a cohort and must be left
 * alone). "Identity" is a denied KEY (`userId`, `user_id`, `created_by`, …) or
 * a whole-value uuid under any key.
 *
 * Counted on the RAW array, BEFORE {@link redactDeep} strips those keys — the
 * count is only computable while the identities are still there.
 */
function identityCohortSize(arr: readonly unknown[]): number | null {
  const ids = new Set<string>();
  let sawIdentity = false;
  for (const el of arr) {
    if (el === null || typeof el !== 'object' || Array.isArray(el)) continue;
    for (const [key, v] of Object.entries(el as Record<string, unknown>)) {
      const identityKey = isDenyKey(key);
      const identityValue = typeof v === 'string' && UUID_RE.test(v);
      if (!identityKey && !identityValue) continue;
      sawIdentity = true;
      if (typeof v === 'string') ids.add(v);
    }
  }
  return sawIdentity ? ids.size : null;
}

function collapseAny(value: unknown, k: number, depth: number): unknown {
  if (depth < 0) return REDACTED;
  if (Array.isArray(value)) {
    const cohort = identityCohortSize(value);
    if (cohort !== null && cohort < k) {
      // Stays an ARRAY so the console's `stages[].summary` rendering and any
      // `.map()` over it keep working; it just carries a count instead of rows.
      const marker: SuppressedCohort = {
        suppressed: 'small-cohort',
        rows: value.length,
        cohortBelow: k,
      };
      return [marker];
    }
    return value.map((item) => collapseAny(item, k, depth - 1));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = collapseAny(v, k, depth - 1);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Storage sanitisation (R4-U2 re-review finding N1) — the systemic fix.
//
// `redactDeep`/`redactText` remove IDENTITY; they say nothing about whether a
// string is safe to INSERT. Two call sites turned out to be asymmetric: a
// `paused`/`seed` value that fails a Postgres write in the six other control
// actions failed SYMMETRICALLY (the mutation itself also errored), but
// `ingest_control.patch` (R2 effect) and `loader.simulate` (numeric rows) do
// NOT round-trip the raw string through Postgres for their own write — only
// `recordControlEvent`'s audit insert does. A NUL byte (U+0000) in either
// value therefore let the mutation SUCCEED while the audit `jsonb` insert
// failed with "unsupported Unicode escape sequence" — an authorized actor
// suppressing their own audit row on two of eight control actions.
//
// Layer 2 (ingestControl.ts's validatePatchBody, simulatedHealth.ts's seed
// charset check) closes the two known instances. This layer closes the
// CLASS: nothing handed to {@link recordControlEvent} — however it got past
// every upstream validator, today or in a future action nobody has written
// yet — can make the audit insert itself fail, because no character that
// Postgres `text`/`jsonb` rejects (NUL foremost; also a lone UTF-16
// surrogate, which cannot be encoded as UTF-8) survives into the inserted
// row. Applied AFTER redactDeep/redactText so redaction still happens first;
// recursive over nested strings, object keys, and array elements, matching
// redactDeep's own walk.
// ---------------------------------------------------------------------------

/**
 * Control characters Postgres `text`/`jsonb` cannot hold, or that are simply
 * unprintable garbage in an audit log. Horizontal tab, newline and carriage
 * return are excluded — they are ordinary, JSON-safe whitespace a real
 * note/reason string may legitimately contain (see redact.test.ts's
 * Postgres-violation-message fixtures, which embed a literal newline).
 * U+0000 (NUL) is the one that actually caused the incident: Postgres's
 * `text` type cannot represent a NUL byte at all, and a NUL escape inside a
 * `jsonb` value is rejected with "unsupported Unicode escape sequence"
 * specifically (not a generic parse error).
 */
function isUnsafeControlChar(code: number): boolean {
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f
  );
}

/** Fast-path pre-check so the common case (no unsafe byte at all) allocates nothing. */
function hasUnsafeStorageChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (isUnsafeControlChar(code) || (code >= 0xd800 && code <= 0xdfff)) {
      return true;
    }
  }
  return false;
}

/**
 * Strip every NUL/unsafe-control-character and every LONE (unpaired) UTF-16
 * surrogate from a string, so the result is always safe to store as Postgres
 * `text` or inside a `jsonb` value. A valid surrogate PAIR (an actual
 * non-BMP character, e.g. an emoji) passes through untouched — only a
 * surrogate appearing without its partner, which cannot be encoded as UTF-8
 * at all, is dropped.
 *
 * Dropped rather than escaped/replaced: this feeds a database WRITE, not a
 * display surface, so introducing a substitute character (which could itself
 * collide with something meaningful) is worse than removing the
 * un-storable byte outright. Values here have already been through
 * {@link redactText} for identity — this pass only removes bytes the
 * database itself cannot hold.
 */
export function sanitizeStorageText(value: string): string {
  if (!hasUnsafeStorageChar(value)) {
    return value; // fast path: the overwhelming majority of values need no work
  }
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (isUnsafeControlChar(code)) {
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i += 1;
        continue;
      }
      continue; // lone high surrogate — dropped
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue; // lone low surrogate (its high half, if any, was already consumed above)
    }
    out += value[i];
  }
  return out;
}

function sanitizeAny(value: unknown, depth: number): unknown {
  if (depth < 0) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return sanitizeStorageText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAny(item, depth - 1));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[sanitizeStorageText(k)] = sanitizeAny(v, depth - 1);
    }
    return out;
  }
  return value;
}

/**
 * Deep-clone `value`, applying {@link sanitizeStorageText} to every string —
 * including object keys and array elements, at any depth — so the result can
 * never fail a Postgres `text`/`jsonb` insert on character-set grounds. Run
 * For an audit/response surface, compose this AFTER
 * {@link redactDeep}/{@link redactText}. For business truth, use it alone:
 * this function knows nothing about identity or secrets, only about which
 * bytes the database can store, and deliberately preserves ordinary content.
 */
export function sanitizeStorageValue<T>(value: T, maxDepth: number = DEFAULT_MAX_DEPTH): T {
  return sanitizeAny(value, maxDepth) as T;
}

/**
 * Prepare the two different trust surfaces of a transactional control RPC.
 * Business target/payload values keep legitimate identity-shaped text and
 * deny-key-shaped fields; only the audit detail is redacted before storage.
 */
export function prepareControlMutationStorage(input: {
  target: string;
  detail: Record<string, unknown>;
  payload: Record<string, unknown>;
}): {
  target: string;
  detail: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  return {
    target: sanitizeStorageValue(input.target),
    detail: sanitizeStorageValue(redactDeep(input.detail)),
    payload: sanitizeStorageValue(input.payload),
  };
}

/**
 * The ONE transform applied to an edge-function body before it is relayed to
 * the browser (see api/loader/run-pipeline/route.ts).
 *
 * Two passes, in this order, because the second destroys the input the first
 * needs:
 *   1. SMALL-COHORT COLLAPSE — any array of per-user rows whose DISTINCT
 *      identity count is below `k` (default {@link SMALL_COHORT_MIN} = 5) is
 *      replaced by a single {@link SuppressedCohort} marker. This is the half
 *      that key-dropping alone cannot do: stripping `userId` from
 *      `brainScopeSkips: [{ userId, ruleId, pair }]` still leaves a cohort of
 *      one whose metric pair is named, which is per-user processing context.
 *   2. {@link redactDeep} — drops identity/secret KEYS at any depth and scrubs
 *      uuid/email-shaped substrings out of every remaining string value
 *      (including free-text `reason`s and relayed Postgres messages).
 *
 * Deny-by-shape throughout: nothing here is taught the name of a stage or of a
 * field, so a future stage summary that starts carrying users is covered on the
 * day it ships rather than on the day someone remembers to update this.
 */
export function redactRelayBody<T>(
  value: T,
  k: number = SMALL_COHORT_MIN,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): T {
  return redactDeep(collapseAny(value, k, maxDepth), maxDepth) as T;
}
