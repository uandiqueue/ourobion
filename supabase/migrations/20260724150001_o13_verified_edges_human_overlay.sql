-- O13 · serving overlay — verified_edges exposes the latest human verdict; provenance shows it
-- (run-2 U9; companion to 20260724150000_create_o13_edge_human_verdicts.sql).
--
-- REJECT supersedes the verifier FOR SERVING without editing the projection: the S6 tables and
-- the loader are untouched; the view (a read surface, not stored truth) gains two ADDITIVE
-- columns at the end — `human_verdict` ('reject' | null) and `human_verdict_at` — from the
-- newest edge_human_verdicts row per edge. Existing columns are byte-identical to the A16
-- recreation (tools/edge-loader/tests pin the S6/A16 blocks to each other; a new test pins this
-- block's added semantics), so CREATE OR REPLACE is legal (columns appended at the end only).
--
-- Consumers:
--   * SERVING (new cards): generate-insights excludes human_verdict = 'reject' in its
--     verified_edges fetch — a rejected edge can never be cited by a NEW card.
--   * PROVENANCE (existing cards): get_insight_provenance does NOT hide rejected edges — an
--     already-served card keeps its cited edge visible (honest history), now with
--     `humanVerdict` / `humanVerdictAt` in each edges[] entry (additive JSON keys; the U7
--     biotope consumer ignores unknown keys).
--
-- security_invoker stands: edge_human_verdicts has an authenticated SELECT policy, so the
-- same callers who could read the view before can read the new columns.

create or replace view public.verified_edges
  with (security_invoker = true) as
  select distinct on (c.edge_id)
         c.*, v.verified_at, v.verification, v.verdict, v.edge_score, v.serving_band,
         hv.action as human_verdict, hv.created_at as human_verdict_at
  from public.relationship_claims c
  join public.edge_verifications v using (edge_id)
  left join lateral (
    select h.action, h.created_at
    from public.edge_human_verdicts h
    where h.edge_id = c.edge_id
    order by h.created_at desc, h.id desc
    limit 1
  ) hv on true
  where v.status = 'active'
  order by c.edge_id, v.verified_at desc;

comment on view public.verified_edges is
  'Newest active verification per edge, with precomputed edge_score / serving_band (§S6). '
  'S7 / A1 read this; serving_band = hold rows are visible but must never be surfaced '
  '(shared/brain isServable). O13: human_verdict / human_verdict_at carry the newest '
  'edge_human_verdicts row — human_verdict = ''reject'' supersedes the verifier FOR SERVING '
  '(generate-insights excludes such rows for new cards); null = no human action, verifier '
  'default stands. Provenance reads keep rejected edges visible (honest history).';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- get_insight_provenance: SHOW the human verdict on existing cards (never hide the edge).
-- Full-body CREATE OR REPLACE of the O12 function (migration 20260724085023) — the ONLY change
-- is the hv lateral join + the additive 'humanVerdict' / 'humanVerdictAt' keys in each edges[]
-- entry (live status, NOT pinned to the card's cited verified_at: a human decision made after
-- the card served is exactly what the reader should see). JSON contract stays additive-stable;
-- everything else is byte-identical to the O12 original — see that migration's header for the
-- full contract documentation.

create or replace function public.get_insight_provenance(p_card_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'card', jsonb_build_object(
      'id',          c.id,
      'ruleId',      c.rule_id,
      'title',       c.title,
      'body',        c.body,
      'producer',    c.producer,
      'category',    c.category,
      'severity',    c.severity,
      'generatedAt', c.generated_at
    ),
    'patternKey',   i.payload->>'patternKey',
    'branch',       i.branch,
    'completeness', i.payload->'completeness',
    'personal',     i.payload->'personal',
    'edges', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'edgeId',      ref.value->>'edgeId',
            'subject',     rc.subject,
            'object',      rc.object,
            'relation',    rc.relation,
            'direction',   pe.entry->'direction',
            'servingBand', coalesce(pe.entry->>'servingBand', ev.serving_band),
            'edgeScore',   coalesce(pe.entry->'edgeScore', to_jsonb(ev.edge_score)),
            'verdict',     ev.verdict,
            'verifiedAt',  ref.value->>'verifiedAt',
            'derivation',  rc.claim->>'derivation',
            'population',  rc.claim->'population',
            'quoteSpans',  coalesce(rc.claim->'quoteSpans', '[]'::jsonb),
            'citations',   coalesce(rc.claim->'citations',  '[]'::jsonb),
            'humanVerdict',   hv.action,
            'humanVerdictAt', hv.created_at
          )
          order by ref.ordinality
        )
        from jsonb_array_elements(c.edge_refs) with ordinality as ref(value, ordinality)
        left join public.relationship_claims rc
          on rc.edge_id = ref.value->>'edgeId'
        left join public.edge_verifications ev
          on ev.edge_id = ref.value->>'edgeId'
         and ev.verified_at = (ref.value->>'verifiedAt')::timestamptz
        left join lateral (
          select e.entry
          from jsonb_array_elements(coalesce(i.payload->'edges', '[]'::jsonb)) as e(entry)
          where e.entry->>'edgeId' = ref.value->>'edgeId'
          limit 1
        ) pe on true
        left join lateral (
          select h.action, h.created_at
          from public.edge_human_verdicts h
          where h.edge_id = ref.value->>'edgeId'
          order by h.created_at desc, h.id desc
          limit 1
        ) hv on true
      ),
      '[]'::jsonb
    )
  )
  from public.insight_cards c
  left join public.composed_insights i on i.insight_id = c.insight_id
  where c.id = p_card_id
$$;

comment on function public.get_insight_provenance(bigint) is
  'O12 per-card provenance read: card -> composed insight (branch/completeness/personal) -> '
  'cited edges (edge_refs) -> claim (derivation/population/quoteSpans/citations incl. evidence '
  'passages) + the verification verdict at the cited verified_at. SECURITY INVOKER: the '
  'caller''s RLS applies — null result for any card the caller cannot see. JSON contract '
  'documented in migration 20260724085023 (keep stable; U7 consumes it). O13 additive: each '
  'edges[] entry carries humanVerdict/humanVerdictAt (live latest edge_human_verdicts row) — '
  'rejected edges stay VISIBLE here (honest history); only NEW-card serving excludes them.';
