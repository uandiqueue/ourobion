-- #345 B1 / #300 §E · carry verifier caveats through both serving read surfaces.
--
-- `edge_verifications.caveat` was added in 20260801010000, after the current
-- `verified_edges` view and `get_insight_provenance` RPC were defined. This migration keeps every
-- existing column/key stable and adds only:
--   1. verified_edges.caveat, so generate-insights can preserve the qualification on a card;
--   2. edges[].caveat in the provenance RPC, preferring the composition-time edge_refs copy and
--      falling back to the exact verification version for cards created before #345.
--
-- No rows are backfilled or hand-edited. Caveat text remains a truth-tier verifier output and is
-- rendered verbatim; the TypeScript contract/load gate owns non-diagnostic copy validation.

create or replace view public.verified_edges
  with (security_invoker = true) as
  select distinct on (c.edge_id)
         c.edge_id, c.subject, c.object, c.relation, c.claim, c.prompt_version,
         c.synthesised_at, c.loaded_at,
         v.verified_at, v.verification, v.verdict, v.edge_score, v.serving_band,
         hv.action as human_verdict, hv.created_at as human_verdict_at,
         c.artifact_revision      as claim_artifact_revision,
         c.artifact_content_hash  as claim_artifact_content_hash,
         c.artifact_posture       as claim_artifact_posture,
         v.artifact_revision      as verification_artifact_revision,
         v.artifact_content_hash  as verification_artifact_content_hash,
         v.artifact_posture       as verification_artifact_posture,
         v.attestation_returned_model,
         v.attestation_returned_version,
         v.attestation_family,
         v.attestation_decorrelated,
         v.attestation_attested,
         hv.artifact_revision      as human_verdict_artifact_revision,
         hv.artifact_content_hash  as human_verdict_artifact_content_hash,
         case
           when hv.action is null then null
           when hv.artifact_revision is null or hv.artifact_content_hash is null then false
           when c.artifact_revision is null or c.artifact_content_hash is null then false
           else hv.artifact_revision = c.artifact_revision
                and hv.artifact_content_hash = c.artifact_content_hash
         end as human_verdict_applies,
         v.caveat
  from public.relationship_claims c
  join public.edge_verifications v using (edge_id)
  left join lateral (
    select h.action, h.created_at, h.artifact_revision, h.artifact_content_hash
    from public.edge_human_verdicts h
    where h.edge_id = c.edge_id
    order by h.created_at desc, h.id desc
    limit 1
  ) hv on true
  where v.status = 'active'
  order by c.edge_id, v.verified_at desc;

comment on view public.verified_edges is
  'Newest active verification per edge, with precomputed edge_score / serving_band (§S6), '
  'human disposition and revision binding (O13/R4-U4), artifact/attestation trust posture, and '
  '#300 §E caveat. Caveat is verifier-authored qualification surfaced verbatim; NULL retains the '
  'semantics documented on edge_verifications.caveat.';

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
            'caveat',      coalesce(ref.value->'caveat', to_jsonb(ev.caveat)),
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
  'O12 per-card provenance read, with O13 live human disposition and #345 additive caveat '
  'surface. edges[].caveat preserves the composition-time edge_refs value, falling back to the '
  'exact edge_verifications row for pre-#345 cards. Evidence and caveat text are returned verbatim; '
  'SECURITY INVOKER keeps caller RLS in force.';
