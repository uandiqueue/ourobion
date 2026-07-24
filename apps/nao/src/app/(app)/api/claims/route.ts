// ourobion nao — claims + verdicts read surface (O13 / demo feature (b), run-2 U9).
//
// GET [?paper=<paperUid>] → the curation read, AS THE AUTHENTICATED USER
// (cookie-bound @supabase/ssr client, authenticated SELECT RLS — never the
// service role): relationship_claims (optionally filtered to claims whose
// citations include the paper, via jsonb containment on claim->'citations')
// joined to the verified_edges view (newest active verification + the O13
// human_verdict columns). Claims without a verification stay visible —
// honestly unverified, nothing servable.
//
// Both sources are DERIVED projections of the R2 edge artifacts (rebuilt by
// tools/edge-loader); nao only reads them. The human layer is read from the
// view (latest edge_human_verdicts row per edge).
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  citationsContainsValue,
  mergeClaimsWithVerdicts,
  type ClaimRow,
  type VerifiedEdgeRow,
} from '@/lib/claimsControl';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const paper = new URL(req.url).searchParams.get('paper');

  try {
    let claimsQuery = supabase
      .from('relationship_claims')
      .select('edge_id, subject, object, relation, claim, synthesised_at')
      .order('edge_id', { ascending: true });
    if (paper !== null && paper.trim() !== '') {
      // claim->'citations' @> '[{"paperId": <uid>}]' — seq scan at demo scale (no GIN
      // index yet; see claimsControl.citationsContainsValue).
      claimsQuery = claimsQuery.contains('claim->citations', citationsContainsValue(paper.trim()));
    }
    const claims = await claimsQuery;
    if (claims.error) throw new Error(claims.error.message);
    const claimRows = (claims.data ?? []) as ClaimRow[];

    let edgeRows: VerifiedEdgeRow[] = [];
    if (claimRows.length > 0) {
      const edges = await supabase
        .from('verified_edges')
        .select('edge_id, verdict, serving_band, edge_score, verified_at, human_verdict, human_verdict_at')
        .in(
          'edge_id',
          claimRows.map((c) => c.edge_id),
        );
      if (edges.error) throw new Error(edges.error.message);
      edgeRows = (edges.data ?? []) as VerifiedEdgeRow[];
    }

    return json({ paper: paper ?? null, claims: mergeClaimsWithVerdicts(claimRows, edgeRows) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
