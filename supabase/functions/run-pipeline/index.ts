/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

// ─── O12-backend · run-pipeline — the on-demand serve-pipeline trigger ─────────────────────
//
// Invokes the three engine functions IN SEQUENCE over HTTP (same-stack functions URL derived
// from SUPABASE_URL): compute-baselines → evaluate-signals → generate-insights, so baselines,
// signals and CARDS appear right after a data load instead of waiting for the nightly crons
// (backlog O12; demo main-loop steps 2/4/5). It adds NO cron of its own (H3 — whether
// evaluate-signals gets a nightly schedule is Jayden's call) and changes nothing about the
// engine: it is a sequencer only.
//
// AUTH (R4-U2) — the internal-secret protocol, identical to the three siblings: the caller
// (nao's server route, the demo runbook, or an admin curl) sends the dedicated header
// `X-Ourobion-Internal-Secret: <secret>`, compared CONSTANT-TIME against the
// OUROBION_INTERNAL_SECRET_CURRENT / _PREVIOUS rotation pair by
// ../_shared/internal_auth.ts. The service-role key is NO LONGER an authorization input and
// no longer travels in any request — this function does not read it at all any more.
// The opaque publishable API key travels only on `apikey`; the same two credentials are
// forwarded to each stage. `Authorization` is intentionally absent.
//
// REQUEST:  POST, body ignored (send `{}`). No per-user scoping: the sibling functions parse
// no request body (verified U5) — the pipeline always runs over all users, exactly like the
// crons. Adding per-user scoping to the engines is out of scope (O12 locked decision: reuse
// the existing engine functions, do not rebuild).
//
// RESPONSE (keep this shape stable — nao's server route consumes it):
//   200  { ok: true,  stages: [ {stage, status, ok: true,  summary}, ... x3 ] }
//   502  { ok: false, failedStage: "<stage>", stages: [ ...stages run so far ] }
// `summary` is the stage's own JSON response VERBATIM (compute-baselines: {ok, users,
// snapshots, snapshotsPruned}; evaluate-signals: {ok, day, users, metricSignals,
// firedPatterns, personalSignals, fireRates}; generate-insights: {ok, day, users, rules,
// firedPatterns, insights, cards, gapLedger, brainScopeSkips}). A stage failure (non-2xx or
// unreachable) STOPS the sequence — downstream stages would read the failed stage's stale
// output — and reports the partial results honestly.

import {
  isWellFormedInternalSecret,
  unauthorizedResponse,
  verifyInternalSecretRequest,
} from "../_shared/internal_auth.ts"
import { fetchEngineStage } from "../_shared/engine_request.ts"
import { readServerKeyEnv, resolveServerKey, ServerKeyConfigurationError } from "../_shared/server_keys.ts"

/** The serve pipeline, in dependency order (§S3 → §S4/S5 → §S7/S8). */
const PIPELINE_STAGES = ["compute-baselines", "evaluate-signals", "generate-insights"] as const

interface StageResult {
  stage: string
  status: number
  ok: boolean
  summary: unknown
}

Deno.serve(async (req) => {
  // ── AUTHORIZATION FIRST (R4-U2) ─────────────────────────────────────────────────────────
  // Before ANY configuration guard, deliberately. Every denial — missing header, blank or
  // whitespace-only header, malformed header, wrong secret, and "no secret configured at
  // all" — answers with the SAME 401 and the SAME body bytes, and never 500. Two reasons:
  //   1. It removes an oracle that would otherwise tell an unauthenticated caller whether
  //      the deployment is misconfigured or their secret is merely wrong.
  //   2. tools/run4_release_gate.mjs requires the recorded local `functions serve` probe to
  //      observe 401 with handlerReached === true on all four routes. That probe has no
  //      internal secret configured, so a 500 on missing config would make the deploy
  //      attestation unrecordable and hard-block the unit.
  // This inverts the old order (service-key 500 guard, then a non-constant-time `!==`
  // compare). The A22 concern that motivated that 500 guard — an unset env degenerating the
  // expected header to the literal "Bearer undefined" — is structurally gone: the shape
  // validator rejects absent/blank/malformed values on BOTH sides before any comparison.
  const verdict = await verifyInternalSecretRequest(req, {
    current: Deno.env.get("OUROBION_INTERNAL_SECRET_CURRENT"),
    previous: Deno.env.get("OUROBION_INTERNAL_SECRET_PREVIOUS"),
  })
  if (!verdict.ok) {
    console.error(`internal auth denied: ${verdict.reason}`) // reason only — never a value
    return unauthorizedResponse()
  }

  // ── Configuration guards — reachable only by an AUTHORIZED caller, so a 500 here leaks
  // nothing about deployment state to an anonymous prober.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) {
    console.error("SUPABASE_URL is not set — refusing to serve")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: functions URL unavailable" }),
      { status: 500 },
    )
  }

  // Fan-out credentials. The opaque publishable key is transport-only and MUST appear only
  // on `apikey`; internal-secret verification remains the first and authoritative gate.
  let publishableKey: string
  try {
    const env = readServerKeyEnv("publishable")
    publishableKey = resolveServerKey(env, "publishable", {
      allowLegacyLocalCli: true,
      supabaseUrl: env.SUPABASE_URL,
    }).value
  } catch (error) {
    console.error("Supabase publishable-key configuration unavailable", error instanceof ServerKeyConfigurationError ? error.message : error)
    return new Response(
      JSON.stringify({ error: "server misconfiguration: stage credentials unavailable" }),
      { status: 500 },
    )
  }
  const configuredCurrent = Deno.env.get("OUROBION_INTERNAL_SECRET_CURRENT")
  const configuredPrevious = Deno.env.get("OUROBION_INTERNAL_SECRET_PREVIOUS")
  const outboundSecret = isWellFormedInternalSecret(configuredCurrent)
    ? configuredCurrent
    : configuredPrevious
  if (!isWellFormedInternalSecret(outboundSecret)) {
    console.error("run-pipeline: internal secret unavailable for fan-out")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: stage credentials unavailable" }),
      { status: 500 },
    )
  }

  const stages: StageResult[] = []
  for (const stage of PIPELINE_STAGES) {
    let result: StageResult
    try {
      const res = await fetchEngineStage(fetch, supabaseUrl, stage, publishableKey, outboundSecret)
      // A stage's failure body may be JSON ({error}) or plain text — report whatever it said.
      const text = await res.text()
      let summary: unknown
      try {
        summary = JSON.parse(text)
      } catch {
        summary = { raw: text }
      }
      result = { stage, status: res.status, ok: res.ok, summary }
    } catch (e) {
      // Network-level failure (stage unreachable) — status 0 marks "no HTTP response at all".
      result = { stage, status: 0, ok: false, summary: { error: (e as Error).message } }
    }
    stages.push(result)
    if (!result.ok) {
      console.error(`run-pipeline: stage ${stage} failed (status ${result.status}) — stopping`)
      return new Response(
        JSON.stringify({ ok: false, failedStage: stage, stages }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  return new Response(
    JSON.stringify({ ok: true, stages }),
    { headers: { "Content-Type": "application/json" } },
  )
})
