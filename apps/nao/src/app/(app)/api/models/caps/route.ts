// ourobion nao — editable router caps (O10 DEMO EXCEPTION, run-2 U8).
//
// POST → validate { node, perDayUsdCap?, perRunTokenCap? } (null clears an
// override) and UPSERT llm_router_cap_overrides AS THE AUTHENTICATED USER
// (cookie-bound @supabase/ssr client — never the service role): the RLS
// INSERT/UPDATE policies require updated_by = auth.uid(), so the audit column
// cannot be forged. Dev-only posture per this run's D3 precedent (any
// authenticated user is one of the two ourobion devs).
//
// SCOPE (locked): caps ONLY. This is the single write surface the O10 demo
// exception allows — no source toggles, no model-id editing, nothing else.
// Bounds are enforced three times on purpose: here (parseCapsBody), the table
// CHECKs (per_day_usd_cap <= 5.00 / per_run_token_cap <= 200000), and again
// in the router's fail-soft consumer (tools/llm-router/src/overrides.ts).
import { parseCapsBody } from '@/lib/modelsControl';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseCapsBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { node, perDayUsdCap, perRunTokenCap } = parsed.value;
  const { data, error } = await supabase
    .from('llm_router_cap_overrides')
    .upsert(
      {
        node,
        per_day_usd_cap: perDayUsdCap,
        per_run_token_cap: perRunTokenCap,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'node' },
    )
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, override: data });
}
