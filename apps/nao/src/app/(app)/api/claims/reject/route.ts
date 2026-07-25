// ourobion nao — human REJECT of a verified edge (O13 / demo feature (b), run-2 U9).
//
// POST { edgeId, reason? } → validate (parseRejectBody) and INSERT an
// edge_human_verdicts row AS THE AUTHENTICATED USER (cookie-bound @supabase/ssr
// client — never the service role): the RLS INSERT policy requires
// created_by = auth.uid(), so the audit column cannot be forged. Dev posture
// per this run's D3 precedent (any authenticated user is one of the two
// ourobion devs).
//
// SEMANTICS (O13 locked): the reject is RECORDED, never a silent edit — the
// verifier's verdict rows are untouched; this row supersedes them FOR SERVING
// only (generate-insights excludes human-rejected edges for NEW cards;
// provenance on already-served cards keeps showing the edge, with the human
// verdict visible). 'reject' is the ONLY action this cycle — no approve, no
// restore/undo (append-only audit; corrections would be new rows in a later
// cycle's semantics).
//
// edge_human_verdicts deliberately has NO foreign key to relationship_claims
// (a loader rebuild must never clobber human truth), so THIS route is the
// existence guard: it 404s when the edgeId is not a known claim.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { parseRejectBody } from '@/lib/claimsControl';

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
  const parsed = parseRejectBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { edgeId, reason } = parsed.value;

  // Existence guard (stands in for the deliberately-absent FK — see header).
  const known = await supabase
    .from('relationship_claims')
    .select('edge_id')
    .eq('edge_id', edgeId)
    .maybeSingle();
  if (known.error) return json({ error: known.error.message }, 500);
  if (known.data === null) return json({ error: `unknown edge: ${edgeId}` }, 404);

  const { data, error } = await supabase
    .from('edge_human_verdicts')
    .insert({
      edge_id: edgeId,
      action: 'reject',
      reason,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, verdict: data });
}
