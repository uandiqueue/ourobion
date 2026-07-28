// ─── R4-U2 · internal-secret protocol — the one shared, runtime-agnostic verifier ─────────
//
// Replaces the four identical `Authorization !== \`Bearer ${SUPABASE_SERVICE_ROLE_KEY}\``
// comparisons that gated the engine functions before this change
// (compute-baselines:225, evaluate-signals:192, generate-insights:274, run-pipeline:56).
// The service-role key is no longer an authorization input anywhere; it survives only as the
// *database* credential each function hands to `createClient`.
//
// ── Why a hand-rolled constant-time compare ───────────────────────────────────────────────
// NOTE (stated because it is the point of this unit): **no `timingSafeEqual` — and no
// timing-safe comparison of any kind — existed anywhere in this repository before this
// change.** Every secret comparison was a plain `!==`, which short-circuits on the first
// differing byte and therefore leaks a byte-at-a-time oracle.
//
// The obvious fixes were rejected for concrete, checkable reasons:
//   * `jsr:@std/crypto/timing-safe-equal` — `supabase/deno.lock` is validated `--frozen`
//     (`.github/workflows/ci.yml` deno-check runs `deno check --lock ../../deno.lock
//     --frozen`), so ANY new `jsr:`/`npm:` specifier fails CI. The verifier must be
//     dependency-free.
//   * `node:crypto.timingSafeEqual` — would make this module's behaviour depend on the
//     Supabase edge runtime's node-compat surface (Deno 2.1.4, per the attested
//     `compatibleDenoVersion` in supabase/deploy-attestation.json). A needless portability
//     bet for six lines of arithmetic.
//   * Both of those primitives **throw on differing lengths**, which is itself a length
//     oracle. You must pre-hash to a fixed width before calling them anyway — and once both
//     sides are fixed-width digests, an XOR-accumulate over 32 bytes is equivalent.
//
// Pre-hashing buys a property the audited primitives do not: even a *perfect* timing oracle
// against this code leaks bits of `SHA-256(guess)` versus `SHA-256(secret)`, never the secret
// itself, and a 32-byte random secret is not recoverable from its digest.
//
// Honest caveat: JS timing guarantees are best-effort (JIT, GC). The accumulate loop has no
// data-dependent branch and no early exit, which is the achievable bar in this runtime.
//
// ── Portability ───────────────────────────────────────────────────────────────────────────
// Web Crypto (`crypto.subtle.digest`) and `TextEncoder` only, zero imports, no `Deno.*` and
// no `process.*` reference — so exactly this file runs in the Supabase edge runtime, in
// Node 20+/26 (the test suite executes it for real), and on Cloudflare Workers. Each caller
// reads its own environment and passes the values in as parameters; that is what makes the
// verifier testable off-Deno.

/**
 * The dedicated header the internal secret travels in.
 *
 * It is NOT `Authorization`: replacement API keys are opaque values and must be sent only on
 * `apikey`. `supabase/config.toml` disables the platform JWT precheck only for these four
 * internal-secret-gated functions, allowing this verifier to be the first authoritative gate.
 *
 * Lower-case because `Headers.get()` is case-insensitive; the wire form callers send is
 * `X-Ourobion-Internal-Secret`.
 */
export const INTERNAL_SECRET_HEADER = "x-ourobion-internal-secret";

/** The wire-form spelling, for senders that build a plain header object. */
export const INTERNAL_SECRET_HEADER_WIRE = "X-Ourobion-Internal-Secret";

/**
 * 32 random bytes, base64url, unpadded. A fixed shape gives "malformed" a precise, testable
 * meaning and makes it structurally impossible for an accidental `Bearer …`, an empty string,
 * or a stringified `undefined` to reach the comparison.
 */
export const INTERNAL_SECRET_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** SHA-256 output width. Both compared digests are always exactly this long. */
const DIGEST_BYTES = 32;

/** Why a request was denied. Logged server-side only — never returned to the caller. */
export type InternalAuthDenial =
  /** Neither `CURRENT` nor `PREVIOUS` is present and well-formed. Fail CLOSED, not open. */
  | "not_configured"
  /** Header absent, empty, or whitespace-only. */
  | "missing"
  /** Header present but not `^[A-Za-z0-9_-]{43}$` (e.g. a `Bearer …` prefix, wrong length). */
  | "malformed"
  /** Well-formed header, but it matches neither configured secret. */
  | "mismatch";

export type InternalAuthResult =
  | { ok: true; matched: "current" | "previous" }
  | { ok: false; reason: InternalAuthDenial };

/** The rotation pair. `previous` being absent is normal, NOT an error. */
export interface InternalSecretEnv {
  current?: string | null;
  previous?: string | null;
}

/**
 * True iff `v` is a syntactically valid internal secret. Used on both sides of the wire.
 * A type predicate, so callers narrow to `string` without a cast.
 */
export function isWellFormedInternalSecret(v: string | null | undefined): v is string {
  return typeof v === "string" && INTERNAL_SECRET_SHAPE.test(v);
}

/** SHA-256 of the UTF-8 bytes of `value`. */
async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

/**
 * Constant-time digest comparison.
 *
 * No `===`, no `!==`, no early `return` inside the loop, no `break`: the loop always runs
 * `DIGEST_BYTES` iterations and folds every byte difference into one accumulator, so the
 * work done is independent of WHERE (or whether) the inputs differ. A length difference is
 * folded in the same way rather than short-circuiting, so length cannot leak either — in
 * practice both arguments are always 32-byte SHA-256 digests, which is precisely why
 * pre-hashing removes the length oracle that `timingSafeEqual` would have introduced.
 *
 * Out-of-range `Uint8Array` reads yield `undefined`; `undefined | 0` is `0`, so the fixed-trip
 * loop stays branch-free even for a hypothetical short input.
 */
export function equalDigests(a: Uint8Array, b: Uint8Array): boolean {
  // Seed the accumulator with any deviation from the expected width, so a non-digest input
  // (including two equal-but-empty arrays) can never compare equal.
  let diff = (a.length ^ DIGEST_BYTES) | (b.length ^ DIGEST_BYTES);
  for (let i = 0; i < DIGEST_BYTES; i++) {
    diff |= (a[i] | 0) ^ (b[i] | 0);
  }
  return diff === 0;
}

/**
 * Verify a presented secret against the configured rotation pair.
 *
 * Fail-closed in every direction:
 *   * header absent / empty / whitespace-only          → `missing`
 *   * header present but wrong shape                   → `malformed`
 *   * neither env value present and well-formed        → `not_configured`  ← never fail-open
 *   * well-formed but matching neither                 → `mismatch`
 *
 * `PREVIOUS` absent is fine — that is the steady state outside a rotation window.
 *
 * Both candidates are always hashed and compared; the result is folded with a
 * non-short-circuiting OR so that "matched CURRENT" and "matched PREVIOUS" do not differ in
 * the number of comparisons performed.
 */
export async function verifyPresentedSecret(
  presented: string | null | undefined,
  env: InternalSecretEnv,
): Promise<InternalAuthResult> {
  const raw = typeof presented === "string" ? presented.trim() : "";
  if (raw.length === 0) return { ok: false, reason: "missing" };
  if (!isWellFormedInternalSecret(raw)) return { ok: false, reason: "malformed" };

  // A configured value that is absent, blank, or malformed is treated as NOT configured, so a
  // truncated or accidentally-quoted deployment secret can never be matched by accident.
  const current = isWellFormedInternalSecret(env.current) ? env.current : null;
  const previous = isWellFormedInternalSecret(env.previous) ? env.previous : null;
  if (current === null && previous === null) return { ok: false, reason: "not_configured" };

  const presentedDigest = await sha256(raw);
  // Hash a fixed-shape non-secret placeholder for an absent slot so the number of digest
  // operations does not depend on whether PREVIOUS is configured.
  const ABSENT = "-".repeat(43);
  const currentMatch = equalDigests(presentedDigest, await sha256(current ?? ABSENT)) &&
    current !== null;
  const previousMatch = equalDigests(presentedDigest, await sha256(previous ?? ABSENT)) &&
    previous !== null;

  if (currentMatch) return { ok: true, matched: "current" };
  if (previousMatch) return { ok: true, matched: "previous" };
  return { ok: false, reason: "mismatch" };
}

/**
 * Request-level verifier — the surface the four edge functions call.
 *
 * Returns a plain boolean per the R4-U2 interface contract §4. It is `async` (i.e.
 * `Promise<boolean>` rather than a bare `boolean`) because the mandated primitive,
 * `crypto.subtle.digest`, is asynchronous in every runtime that provides it; there is no
 * synchronous Web Crypto digest. Callers `await` it.
 *
 * Use `verifyPresentedSecret` directly when you want the denial reason for a server-side log.
 */
export async function verifyInternalSecret(
  req: Request,
  env: InternalSecretEnv,
): Promise<boolean> {
  const result = await verifyPresentedSecret(req.headers.get(INTERNAL_SECRET_HEADER), env);
  return result.ok;
}

/**
 * Request-level verifier that reports WHY it denied, for the server log.
 *
 * The reason must never reach the response body: every failure mode answers with the same
 * 401 and the same bytes (see `UNAUTHORIZED_BODY`), which is what removes the
 * "misconfigured versus wrong secret" oracle.
 */
export async function verifyInternalSecretRequest(
  req: Request,
  env: InternalSecretEnv,
): Promise<InternalAuthResult> {
  return await verifyPresentedSecret(req.headers.get(INTERNAL_SECRET_HEADER), env);
}

/**
 * The single 401 body, byte-identical for every denial reason.
 *
 * Load-bearing twice over:
 *   1. Security — a caller cannot distinguish "no secret configured on the server" from
 *      "wrong secret" from "no header at all".
 *   2. Attestation — `tools/run4_release_gate.mjs` requires the recorded local serve probe to
 *      observe `httpStatus === 401` with `handlerReached === true` on all four routes, and the
 *      recorded `bodySha256` for all four is
 *      d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f =
 *      sha256("Unauthorized"). Changing these 12 bytes moves that hash; returning 500 when no
 *      secret is configured (the local serve probe's own state) would make the attestation
 *      unrecordable and hard-block the unit.
 */
export const UNAUTHORIZED_BODY = "Unauthorized";

/** The one denial response. Constant body, no header echo, no configuration hint. */
export function unauthorizedResponse(): Response {
  return new Response(UNAUTHORIZED_BODY, { status: 401 });
}
