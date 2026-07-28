-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- get_knowledge_base_stats — real counts for the Home "Knowledge base" row
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
--   The Home tab's knowledge-base row was a hardcoded three-line ticker rotating every five
--   seconds (home_tab.dart `_tickerLines`). It implied live indexing activity that was not
--   happening: no paper count, no ingest state, nothing behind it. That is exactly the kind of
--   fake control the run's rules forbid, so the row now reads real numbers or says nothing.
--
-- WHAT "STUDIES" MEANS HERE
--   There is no papers table. Paper identity lives inside `relationship_claims.claim`, in
--   `citations[].paperId` — "DOI when available, else a stable internal corpus id"
--   (shared/brain/relationships.ts Citation). So the honest count of indexed studies is the number
--   of DISTINCT paperIds across every claim's citations, not a row count of claims. One paper
--   commonly supports several edges; counting claims would inflate it.
--
-- HONEST WHEN SMALL
--   This returns whatever is actually there, including zero. The single-paper Run 4 corpus really
--   does mean "1 study indexed", and the UI must be able to say that rather than round it up.
--
-- SECURITY INVOKER, deliberately
--   `relationship_claims` has RLS on plus an authenticated SELECT policy (migration
--   20260716031048). Invoker therefore reads exactly what the caller may already read — no new
--   surface, no privilege escalation, and no way to use this as an oracle for rows the caller
--   could not otherwise select. A definer function here would grant strictly more than needed.
--
-- TWO-TIER TRUTH
--   Every table read here is a DERIVED PROJECTION rebuilt by tools/edge-loader (memory 0001).
--   This function only reads; it never writes, and it must never be used to repair a projection.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.get_knowledge_base_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    -- Distinct papers across all claim citations. `jsonb_array_elements` on a missing or
    -- non-array `citations` would error, so guard the type: a malformed claim contributes
    -- nothing rather than failing the whole row.
    'studiesIndexed', (
      select count(distinct src.paper_id)
      from public.relationship_claims c
      cross join lateral (
        select nullif(elem ->> 'paperId', '') as paper_id
        from jsonb_array_elements(
               case when jsonb_typeof(c.claim -> 'citations') = 'array'
                    then c.claim -> 'citations'
                    else '[]'::jsonb end
             ) as elem
      ) src
      where src.paper_id is not null
    ),

    -- Relationships that currently have an active verification. Distinct from studies: an edge
    -- is a claim ABOUT papers, not a paper.
    'edgesVerified', (select count(*) from public.verified_edges),

    -- Newest load timestamp, so the UI can say when this was last refreshed instead of implying
    -- continuous live activity. Null when nothing has ever been loaded.
    'lastIndexedAt', (select max(loaded_at) from public.relationship_claims)
  );
$$;

comment on function public.get_knowledge_base_stats is
  'Real counts for the Home knowledge-base row: distinct citations[].paperId across all claims '
  '(studies), count of verified_edges (relationships), and max(relationship_claims.loaded_at). '
  'security invoker — relationship_claims already has an authenticated read policy, so this adds '
  'no readable surface. Returns honest zeros/nulls on an empty corpus; the UI must render those '
  'truthfully rather than hiding them behind a placeholder ticker.';

grant execute on function public.get_knowledge_base_stats() to authenticated, service_role;
