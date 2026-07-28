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
import { PublishableKeyConfigurationError, resolvePublishableKey } from '@/lib/serverKey';

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Supabase project URL for the functions endpoint (server env first, public mirror ok — the URL is public). */
function supabaseUrl(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  const url = supabaseUrl();
  if (!url) {
    return json({ error: 'server misconfiguration: SUPABASE_URL unavailable' }, 500);
  }
  const internalSecret = process.env.OUROBION_INTERNAL_SECRET;
  if (!internalSecret || !INTERNAL_SECRET_SHAPE.test(internalSecret)) {
    return json(
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
    return json(
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
  if (!operation.ok) return json({ error: operation.error }, 400);

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
            // internal-secret-gated engine functions (supabase/config.toml), so a bearer would
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
