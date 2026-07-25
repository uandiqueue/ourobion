-- O12 · get_insight_provenance — the per-card provenance read surface for the biotope app
-- (backlog O12: "each card's provenance — rule / edge / claim / citation — exposed so biotope
-- can show 'how this insight was generated'"; consumed by the U7 provenance view via
-- supabase.rpc('get_insight_provenance', { p_card_id })).
--
-- SECURITY INVOKER on purpose: the caller's RLS decides everything. The chain it walks is
-- readable by an authenticated user end-to-end —
--   insight_cards        user-select policy  (auth.uid() = user_id)
--   composed_insights    user-select policy  (auth.uid() = user_id)
--   relationship_claims  authenticated-read  (global population data)
--   edge_verifications   authenticated-read  (global population data)
-- so a user gets full provenance for THEIR cards and an empty (null) result for any card id
-- they do not own — not-found and not-owned are deliberately indistinguishable (no existence
-- leak). Note p_card_id is BIGINT: insight_cards.id is a bigint identity column (the U5 brief
-- sketched uuid; the actual schema wins).
--
-- Edge selection: the card's edge_refs [{edgeId, verifiedAt}] — the edges the card actually
-- cites (monotonic direction-consistent only, per O18). Each ref joins to the composed
-- insight's payload edge entry (composition-time direction / servingBand / edgeScore), to
-- relationship_claims (the full claim: derivation, population, quoteSpans, citations with
-- tiers + optional U2 evidence passages), and to edge_verifications AT THE EXACT verified_at
-- the card cites — the verdict shown is the verification version the card was composed
-- against, not whatever is newest. Paper bib metadata beyond what Citation carries
-- (paperId/title/year/tiers/stance/evidence) lives on the nao side (R2/D1), not in Postgres.
--
-- JSON contract (STABLE — U7 consumes this; a null top-level result = card not visible):
-- {
--   "card":         { "id": bigint, "ruleId": text, "title": text, "body": text,
--                     "producer": "rules"|"edge"|"personal", "category": text,
--                     "severity": text, "generatedAt": timestamptz },
--   "patternKey":   text | null,        -- null when the card has no composed insight
--   "branch":       "agree"|"research-context"|"idiosyncratic"|"contradiction" | null,
--   "completeness": { "score", "daysPresent", "windowDays", "perMetric" } | null,
--   "personal":     { "rho", "nEff", "qValue", "stable" } | null,   -- honest: null when no
--                                                                    -- gate-passing pair backs it
--   "edges": [                          -- [] for the uncited "still researching" personal card
--     { "edgeId": text, "subject": text, "object": text, "relation": text,
--       "direction": "consistent"|"inconsistent"|null,   -- composition-time, from the payload
--       "servingBand": text, "edgeScore": numeric, "verdict": text, "verifiedAt": timestamptz,
--       "derivation": text,             -- synthesis reasoning trace (copy-gated at production)
--       "population": text | null,      -- claimed scope, verbatim
--       "quoteSpans": [ { "paperId", "quote", "locator", "charStart", "charEnd" } ],
--       "citations":  [ { "paperId", "title", "year", "population", "evidenceTier",
--                         "impactTier", "stance", "evidence"?: [{ "text", "locator" }] } ] }
--   ]
-- }

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
            'citations',   coalesce(rc.claim->'citations',  '[]'::jsonb)
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
  'documented in migration 20260724085023 (keep stable; U7 consumes it).';

-- Callable by signed-in users (RLS scopes rows) and the service role; not by anon.
revoke execute on function public.get_insight_provenance(bigint) from public, anon;
grant execute on function public.get_insight_provenance(bigint) to authenticated, service_role;
