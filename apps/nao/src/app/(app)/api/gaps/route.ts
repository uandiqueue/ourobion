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
//
// AUTH (R4-U2): requires nao `viewer` via requireRole()/guardRole()
// (apps/nao/src/lib/authzServer.ts). Small-cohort suppression (k=5,
// suppressSmallCohort) is applied to the displayed rows as layer-1 defense in
// depth over the DB-layer `demand >= 5` restrictive policy Agent A is adding
// on the same table.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { guardRole, redactText } from '@/lib/authzServer';
import { suppressSmallCohort } from '@/lib/authz';
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
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const supabase = await createServerSupabaseClient();
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
  if (error) return json({ error: redactText(error.message) }, 500);

  // Layer-1 small-cohort suppression (k=5) over the DISPLAYED rows, defense in
  // depth over the RLS floor Agent A is adding on the same table — this route
  // does not assume the DB-layer restrictive policy landed. `totalCount`
  // stays the honest exact count from the query (pre-suppression) so "showing
  // top N of M" keeps meaning "of the aggregate rows that exist", not "of the
  // rows we chose to show".
  const rows = suppressSmallCohort((data ?? []) as GapLedgerRow[]);

  return json({
    ok: true,
    gaps: shapeGapRows(rows),
    totalCount: count ?? (data ?? []).length,
    pageSize: GAPS_PAGE_SIZE,
  });
}
