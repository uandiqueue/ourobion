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
// AUTH — service-role gated by exact header compare, identical to the three siblings: the
// caller (nao's server route U6/U8, the demo runbook, or an admin curl) sends
// `Authorization: Bearer <service-role-key>`. That same header is forwarded to each stage,
// which applies the same compare.
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

/** The serve pipeline, in dependency order (§S3 → §S4/S5 → §S7/S8). */
const PIPELINE_STAGES = ["compute-baselines", "evaluate-signals", "generate-insights"] as const

interface StageResult {
  stage: string
  status: number
  ok: boolean
  summary: unknown
}

Deno.serve(async (req) => {
  // A22: without this guard an unset env var degenerates the expected header to the literal
  // string "Bearer undefined" — fail loudly (500, secret never echoed) before any compare.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set — refusing to serve")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: service-role key unavailable" }),
      { status: 500 },
    )
  }

  // Only nao's server route / the demo runbook / an admin curl may trigger the pipeline.
  const auth = req.headers.get("Authorization")
  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) {
    console.error("SUPABASE_URL is not set — refusing to serve")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: functions URL unavailable" }),
      { status: 500 },
    )
  }

  const stages: StageResult[] = []
  for (const stage of PIPELINE_STAGES) {
    let result: StageResult
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${stage}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: "{}",
      })
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
