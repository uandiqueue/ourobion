// ourobion nao — "Run analysis" relay (O11/O12 seam, run-2 U6).
//
// POST → invokes the U5 `run-pipeline` edge function (compute-baselines →
// evaluate-signals → generate-insights, internal-secret gated) SERVER-SIDE and relays its
// per-stage summary JSON to the page — REDACTED, never verbatim (see below).
//
// RESPONSE REDACTION (R4-U2 review finding 1 — this was the unit's one live data leak).
// `run-pipeline` nests each stage's body under `stages[].summary` unchanged, and
// `generate-insights` puts RAW auth.users uuids in two of those bodies:
//   cards.droppedAtRender: [{ userId, ruleId, reason }]   (generate-insights/index.ts:487)
//   brainScopeSkips:       [{ userId, ruleId, pair }]     (generate-insights/index.ts:488)
// Both arrays populate on ordinary, expected conditions, so a curator pressing "Run
// analysis" received cross-user identities, per-user metric-pair context, and cohorts of
// size 1. Every one of the three exit paths below now goes through the relay redaction:
//   * the JSON path      → redactRelayBody() — small-cohort collapse (k=5) THEN redactDeep()
//   * the non-JSON `raw` → redactText() (a bare string; only value-shape scrubbing applies)
//   * the caught error   → redactText() over err.message, because a Postgres violation
//                          message embeds the conflicting value, e.g.
//                          `Key (user_id, log_date)=(<uuid>, 2026-07-28) already exists`
// The relay block is delimited by the `relay:begin`/`relay:end` sentinels so
// apps/nao/tests/redact.test.ts can extract THIS source text verbatim and execute it — the
// route's own relay path under test, not a re-implementation of it.
//
// SECRET HANDLING (R4-U2): run-pipeline is gated by the internal-secret protocol, not by the
// service-role key. This route sends two headers with two distinct jobs:
//   apikey                      → the opaque PUBLISHABLE key. Transport only; it grants nothing.
//   X-Ourobion-Internal-Secret  → OUROBION_INTERNAL_SECRET, the ONLY authorization input,
//                                 compared constant-time inside the function against its
//                                 CURRENT/PREVIOUS rotation pair
//                                 (supabase/functions/_shared/internal_auth.ts).
// nao NO LONGER READS SUPABASE_SERVICE_ROLE_KEY anywhere: this route was the last holder of
// that god-mode credential, so a leaked nao request log can no longer contain one, and this
// handler no longer "spends service-role power" at all.
// OUROBION_INTERNAL_SECRET is read from server env only — apps/nao/.env (projected into
// .dev.vars locally by scripts/gen-env.mjs; a Worker secret in prod). It is NEVER
// NEXT_PUBLIC_-prefixed and never reaches the browser: the client only ever sees this route's
// relayed stage summaries.
//
// INBOUND HUMAN AUTHORIZATION (R4-U2 gap fix): the internal-secret protocol above is the
// OUTBOUND machine-to-machine leg to the edge function — it says nothing about which nao user
// may press the button. That is a separate question, answered the same way every other route
// in this unit answers it: `guardRole('curator')` (apps/nao/src/lib/authzServer.ts), matching
// this route's 'POST /api/loader/run-pipeline': 'curator' entry in ./authz.ts's ROUTE_POLICY.
// Without this gate, `supabase.auth.getUser()` alone only proves "some authenticated session
// exists" — including a Biotope-only account with no nao membership at all — which is exactly
// the hole this gate closes.
//
// TRUTHFUL CONTROL AUDIT (R4-U2 correction, issue #182). The relay is an EXTERNAL effect, so it
// cannot share a Postgres transaction with its audit row. Its protocol is therefore durable
// attempt → external effect → terminal outcome, orchestrated by runAuditedControlMutation():
//   * a `pipeline.run`/`attempted` row commits BEFORE the fetch, keyed by the caller's
//     `X-Ourobion-Operation-Id` (or a server-generated one), so a retry cannot double-count
//   * an upstream non-2xx is an AUTHORITATIVE rejection → NaoControlMutationError → `failed`
//   * a lost response (thrown fetch) is NOT `failed`: run-pipeline may have committed before the
//     response vanished, so it stays unresolved and returns the opaque `control_outcome_unknown`
//     503 with the operation id, for reconciliation via nao_unresolved_control_operations
// Three of the catch arms below therefore return FIXED strings plus that operation id — they never
// carry upstream payload or provider text, so the redaction contract above still covers every path
// that relays anything at all.
import {
  NaoControlAuditError,
  NaoControlMutationError,
  NaoControlOutcomeUnknownError,
  controlAuditErrorResponse,
  controlOperationId,
  controlOutcomeUnknownErrorResponse,
  guardRole,
  redactRelayBody,
  redactText,
  runAuditedControlMutation,
} from '@/lib/authzServer';
//
// R4-U3 (O26) — PUBLICATION ORDERING AND THE DERIVED STATUS FOLD.
//
// ORDERING. This relay is reachable only after POST /api/loader's atomic RPC has
// COMMITTED (that route returns a 4xx/5xx and writes nothing otherwise), so no stage
// can ever read a half-loaded day. That guarantee is structural — it comes from the
// order of two calls plus the atomicity of the first — not from anything this file
// checks at runtime.
//
// THE FOLD. `run-pipeline` stops at the first non-ok stage and returns 502 with the
// stages it got, but the writes of the stages that already succeeded stay committed
// (they are rebuildable projections, which is fine). What was missing is that such a
// run must never be DESCRIBED as published. So the relayed body now carries a
// `publication` verdict DERIVED by a worst-wins fold over the observed stage
// outcomes (lib/loaderRuns.ts's foldRunStatus): `failed` outranks `mixed` outranks
// `incomplete` outranks `pending`, and `published` requires all three stages present,
// all ok, and a stable watermark. There is NO stored status column anywhere and no
// code path that assigns one, so conflicting observations cannot collapse via
// last-write-wins.
//
// THE WATERMARK. With an optional `{ requestKey }` in the request body — the key the
// loader run returned — this route calls `nao_loader_record_pipeline(...)` after the
// sequencer returns. That definer function stamps each stage row with the TARGET's
// raw-truth digest as observed at that moment and returns the RUN-SCOPED verdict from
// `nao_loader_status(target, requestKey)` — the caller's own run, not merely the
// target's most recent one — together with the digest it just observed and the run's
// committed `watermark_after`. The comparison has to happen there because that is where
// the target's rows are readable at all (the caller's own client cannot see another
// user's rows, and `nao_loader_watermark` is service_role-only precisely so it cannot
// become an oracle). Those two digests are then fed to the LOCAL fold as well, so its
// watermark term is a real check rather than a permanently-null one, and the two
// verdicts — the local fold over relayed stage outcomes, and the database's fold over
// recorded per-stage digests — are combined WORST-WINS, so a disagreement can only
// resolve pessimistically.
// Without a requestKey no watermark comparison is possible, and the verdict is capped
// at `incomplete` with `watermarkChecked: false`: an unverifiable run is never claimed
// as a publication. Per-user pipeline SCOPING is deliberately not added — the three
// engines take no body and always run over all users (an O12 locked decision,
// supabase/functions/run-pipeline/index.ts:21-24). What is proven here is narrower and
// true: no half-loaded day is visible, and no run whose raw truth moved under it is
// reported as published.
//
// The body is OPTIONAL and unauthenticated callers never reach this code, so
// components/LoaderPanel.tsx may still send a bodyless POST, which truthfully caps the
// publication verdict below `published`; the targeted LoaderPanel repair supplies the key.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PublishableKeyConfigurationError, resolvePublishableKey } from '@/lib/serverKey';
import { LOADER_REQUEST_KEY_RE } from '@/lib/simulatedHealth';
import {
  buildPublicationSummary,
  parseRecordedDigests,
  stagesFromRelayBody,
  statusFromDatabase,
  type ObservedStage,
  type PublicationSummary,
} from '@/lib/loaderRuns';

export const dynamic = 'force-dynamic';

/**
 * Wire spelling of the internal-secret header, and its shape (32 random bytes, base64url).
 * Single source of truth: `INTERNAL_SECRET_HEADER_WIRE` / `INTERNAL_SECRET_SHAPE` in
 * supabase/functions/_shared/internal_auth.ts. That module cannot be imported here — it lives
 * outside the Next app root and targets the Deno edge runtime — so these two literals are
 * mirrored, and the shape is checked locally so a truncated secret fails with a clear
 * server-side error instead of an opaque 401 from the edge function.
 */
const INTERNAL_SECRET_HEADER = 'X-Ourobion-Internal-Secret';
const INTERNAL_SECRET_SHAPE = /^[A-Za-z0-9_-]{43}$/;

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Supabase project URL for the functions endpoint (server env first, public mirror ok
 * — the URL is public).
 *
 * NO HOSTED ENDPOINT IS EVER ACCEPTED FROM A REQUEST. The upstream URL comes from
 * SERVER ENV ONLY: there is no host literal in this file, and nothing in the request
 * body or query string can influence where this route sends the internal secret. A
 * body-derived URL would turn this handler into a secret-exfiltration primitive for
 * any authenticated curator.
 */
function supabaseUrl(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

/** Optional request body. Every field is optional; an absent/unparsable body is `{}`. */
interface PipelineRequestBody {
  /**
   * The loader run this pipeline invocation belongs to — the `requestKey` POST
   * /api/loader returned. Scoping the run is what makes the watermark comparison, and
   * therefore a `published` verdict, possible at all.
   */
  requestKey?: string;
}

/**
 * Record the observed stage outcomes against the loader run and return the DATABASE's
 * derived verdict, or null.
 *
 * NEVER throws and never fails the relay: an unrecordable outcome must degrade to "not
 * checked" (which caps the verdict below `published`), not to a 500 over a pipeline run
 * that may well have succeeded. The stage rows are the audit trail; the verdict is
 * derived from them on every read and stored nowhere.
 */
async function recordStages(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  requestKey: string | null,
  stages: readonly ObservedStage[],
): Promise<unknown> {
  if (requestKey === null || stages.length === 0) return null;
  try {
    const call = await supabase.rpc('nao_loader_record_pipeline', {
      p_request_key: requestKey,
      p_stages: stages.map((stage) => ({
        stage: stage.stage,
        httpStatus: stage.httpStatus,
        ok: stage.ok,
      })),
    });
    return call.error ? null : call.data;
  } catch {
    return null;
  }
}

/** Attach the derived verdict to a relayed stage envelope; leave any other body alone. */
function withPublication(body: unknown, publication: PublicationSummary): unknown {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!Array.isArray((body as Record<string, unknown>).stages)) return body;
  return { ...(body as Record<string, unknown>), publication };
}
export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  // Optional body, parsed AFTER the gate (R4-U2 finding 6: validating before
  // authorizing handed a non-member a schema oracle). A bodyless POST — what
  // LoaderPanel sends — is `{}`, not an error.
  let body: PipelineRequestBody = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as PipelineRequestBody;
    }
  } catch {
    body = {};
  }
  const requestKey = typeof body.requestKey === 'string' ? body.requestKey : null;
  if (requestKey !== null && !LOADER_REQUEST_KEY_RE.test(requestKey)) {
    return respond(
      { error: 'requestKey must be 16-128 characters, using only letters, digits, and . _ : -' },
      400,
    );
  }

  const url = supabaseUrl();
  if (!url) {
    return respond({ error: 'server misconfiguration: SUPABASE_URL unavailable' }, 500);
  }
  const internalSecret = process.env.OUROBION_INTERNAL_SECRET;
  if (!internalSecret || !INTERNAL_SECRET_SHAPE.test(internalSecret)) {
    return respond(
      {
        error:
          'OUROBION_INTERNAL_SECRET is missing or malformed on the server — add it to ' +
          'apps/nao/.env (dev) or the Worker secrets (prod). It must be 32 random bytes as ' +
          'base64url (43 chars) and must never be NEXT_PUBLIC_.',
      },
      501,
    );
  }
  let publishableKey: string;
  try {
    publishableKey = resolvePublishableKey(process.env, {
      allowLegacyLocalCli: true,
      supabaseUrl: url,
    }).value;
  } catch (error) {
    return respond(
      {
        error:
          error instanceof PublishableKeyConfigurationError
            ? 'server misconfiguration: Supabase publishable key unavailable'
            : 'server misconfiguration: Supabase key resolution failed',
      },
      501,
    );
  }

  const operation = controlOperationId(req);
  if (!operation.ok) return respond({ error: operation.error }, 400);

  const supabase = await createServerSupabaseClient();

  /**
   * The relay block below is EXTRACTED VERBATIM AND EXECUTED by
   * apps/nao/tests/redact.test.ts, which compiles it with a fixed parameter list
   * (fetch, json, redactRelayBody, redactText, url, anonKey, internalSecret,
   * INTERNAL_SECRET_HEADER). It must therefore reference NOTHING outside that list —
   * which is why the publication fold lives HERE, in the `json` the block closes
   * over, rather than inside the block. The block itself is unchanged, byte for
   * byte, so the four route-relay redaction tests keep exercising the real thing.
   *
   * Recording the stages AFTER the sequencer returns is why this is async. The stage
   * envelope's HTTP status (200 / 502) is relayed unchanged: the verdict is added to
   * the BODY, it does not rewrite `run-pipeline`'s own semantics.
   */
  const json = async (payload: unknown, status = 200): Promise<Response> => {
    // Recorded first, because recording is what OBSERVES the target's watermark: the
    // definer stamps each stage row with the digest it reads at that moment and hands
    // both that digest and the run's committed `watermark_after` back. Without a
    // requestKey there is no run to record against and both stay null, which caps the
    // verdict at `incomplete` with `watermarkChecked: false` — never `published`.
    const relayed = stagesFromRelayBody(payload, null);
    const recorded = await recordStages(supabase, requestKey, relayed);
    const digests = parseRecordedDigests(recorded);
    // Re-attribute the observed digest to the stages, so the LOCAL fold has a real
    // watermark term instead of a permanently-null one. The database's own fold (over
    // per-stage digests, which is strictly finer) is combined worst-wins below, so the
    // two derivations can only ever resolve pessimistically.
    const observed =
      digests.observed === null ? relayed : stagesFromRelayBody(payload, digests.observed);
    const publication = buildPublicationSummary({
      stages: observed,
      expectedDigest: digests.expected,
      databaseStatus: statusFromDatabase(recorded),
    });
    return respond(withPublication(payload, publication), status);
  };

  // ── relay:begin — extracted verbatim and EXECUTED by apps/nao/tests/redact.test.ts ──
  try {
    const audited = await runAuditedControlMutation({
      operationId: operation.operationId,
      action: 'pipeline.run',
      target: 'run-pipeline',
      mutate: async () => {
        const res = await fetch(`${url}/functions/v1/run-pipeline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Opaque replacement publishable keys are not JWTs: they travel ONLY on `apikey`.
            // No `Authorization` header is sent: `verify_jwt` is disabled for the four
            // internal-secret-gated engine functions (project function config), so a bearer would
            // add nothing and an opaque `sb_publishable_*` key is not a valid JWT anyway.
            apikey: publishableKey,
            // The only authorization input. Compared constant-time inside run-pipeline.
            [INTERNAL_SECRET_HEADER]: internalSecret,
          },
          body: '{}',
        });
        const text = await res.text();
        if (!res.ok) {
          throw new NaoControlMutationError('pipeline_failed', 'analysis pipeline failed', res.status);
        }
        return { res, text };
      },
    });
    const { res, text } = audited.value;
    // Relay run-pipeline's 200/502 semantics unchanged, its PAYLOAD redacted (see header).
    try {
      return json(redactRelayBody(JSON.parse(text)), res.status);
    } catch {
      return json(
        { ok: false, status: res.status, raw: redactText(text.slice(0, 2000)) },
        res.ok ? 502 : res.status,
      );
    }
  } catch (err) {
    if (err instanceof NaoControlAuditError) return controlAuditErrorResponse(err);
    if (err instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(err);
    if (err instanceof NaoControlMutationError) {
      return json({ error: redactText(err.message), code: err.auditCode, operationId: operation.operationId }, err.status);
    }
    return json({ error: redactText(err instanceof Error ? err.message : String(err)) }, 502);
  }
  // ── relay:end ──
}
