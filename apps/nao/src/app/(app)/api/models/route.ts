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
import { createServerSupabaseClient } from '@/lib/supabase-server';

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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const today = todayUtc();
  try {
    const [status, spend, overrides] = await Promise.all([
      supabase.from('llm_router_status').select('*').order('node'),
      supabase.from('llm_router_spend').select('*').eq('day', today).order('node'),
      supabase.from('llm_router_cap_overrides').select('*').order('node'),
    ]);
    for (const res of [status, spend, overrides]) {
      if (res.error) throw new Error(res.error.message);
    }
    return json({
      today,
      status: status.data ?? [],
      spend: spend.data ?? [],
      overrides: overrides.data ?? [],
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
