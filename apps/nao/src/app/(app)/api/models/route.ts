// ourobion nao — model-config + spend read boundary (O10 / demo feature (a), run-2 U8).
//
// GET → the O10 read surfaces, AS THE AUTHENTICATED USER (cookie-bound @supabase/ssr
// client, anon key + session — authenticated SELECT RLS policies, never the service
// role): llm_router_status (config snapshot), llm_router_spend for the server's UTC
// today (the router ledger keys spend on UTC days), and llm_router_cap_overrides.
//
// The tables are PROJECTIONS of tools/llm-router's router.config.json + budget
// ledger, published by an explicit script (tools/llm-router/scripts/
// publish-status.ts) — nao never reads tools/ files directly (O10 locked). The
// panel shows published_at honestly (stale hint) because freshness is
// publish-driven, not live.
//
// AUTH (R4-U2): requires nao `viewer` via requireRole()/guardRole()
// (apps/nao/src/lib/authzServer.ts). `llm_router_cap_overrides.updated_by` (a
// raw curator uuid) is never selected or returned — explicit column list +
// redactDeep(), layer-1 redaction over the DB-layer column revoke Agent A is
// adding on the same table; this route does not assume that landed.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { guardRole, redactDeep, redactText } from '@/lib/authzServer';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Today in UTC — the router's ledger day key. */
function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const supabase = await createServerSupabaseClient();
  const today = todayUtc();
  try {
    const [status, spend, overrides] = await Promise.all([
      supabase.from('llm_router_status').select('*').order('node'),
      supabase.from('llm_router_spend').select('*').eq('day', today).order('node'),
      // Explicit column list (layer-1 redaction): never select `updated_by` —
      // the curator's raw uuid — even though the DB layer (Agent A) is also
      // revoking table-level SELECT on that column. `select('*')` on this
      // table now fails loudly once that revoke lands, which is the point
      // (see the R4-U2 design §C.1's "important implementation trap").
      supabase
        .from('llm_router_cap_overrides')
        .select('node, per_day_usd_cap, per_run_token_cap, updated_at')
        .order('node'),
    ]);
    for (const res of [status, spend, overrides]) {
      if (res.error) throw new Error(res.error.message);
    }
    return json(
      redactDeep({
        today,
        status: status.data ?? [],
        spend: spend.data ?? [],
        overrides: overrides.data ?? [],
      }),
    );
  } catch (err) {
    // A relayed Postgres message can embed a value (`Key (user_id, …)=(<uuid>, …)`),
    // so every error string leaving a nao route goes through redactText.
    return json({ error: redactText(err instanceof Error ? err.message : String(err)) }, 500);
  }
}
