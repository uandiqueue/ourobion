// ourobion nao — knowledge-gaps read API (O9 demo slice / feature (d), run-2 U11).
//
// GET → the top-demand aggregate rows of the A1 gap_ledger, read AS THE
// AUTHENTICATED USER (cookie-bound @supabase/ssr client — never the service
// role). The migration's RLS SELECT policy already restricts authenticated
// reads to scope='aggregate' rows (§A1 privacy: aggregate demand, NO user
// ids); the query re-asserts that filter as defense in depth. Ordered by
// demand DESC, capped at GAPS_PAGE_SIZE with an exact total so the UI can say
// "showing top N of M" honestly.
//
// READ-ONLY on purpose: this is the detection + surfacing slice only. The
// autonomous gap→research loop (A3 queue, dispatch, auto-research) stays
// gated on B5 + U16 — no write surface exists here.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { GAPS_PAGE_SIZE, shapeGapRows } from '@/lib/gapsControl';
import type { GapLedgerRow } from '@/lib/gapsControl';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { data, error, count } = await supabase
    .from('gap_ledger')
    .select('metric_a, metric_b, status, demand, completeness, lit_candidate, last_status_change', {
      count: 'exact',
    })
    .eq('scope', 'aggregate') // RLS enforces this too — kept explicit
    .order('demand', { ascending: false })
    .order('metric_a', { ascending: true })
    .order('metric_b', { ascending: true })
    .limit(GAPS_PAGE_SIZE);
  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    gaps: shapeGapRows((data ?? []) as GapLedgerRow[]),
    totalCount: count ?? (data ?? []).length,
    pageSize: GAPS_PAGE_SIZE,
  });
}
