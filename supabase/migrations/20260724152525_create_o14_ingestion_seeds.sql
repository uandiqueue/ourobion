-- O14 · ingestion_seeds — human-added ingestion seeds, AS DATA (backlog O14 / demo feature (c),
-- run-2 U10; docs/temp/next-build-optimizations.md §O14, locked).
--
-- Seeds are TOPICS/queries the brain-ingest pipeline reads at run time — the human-added
-- complement to C9's predetermined seeds (code: tools/brain-ingest/src/seeds.ts, which this
-- table deliberately does NOT edit) and the future gap-driven loop (O9). Locked semantics:
--   * Seeds are added AS DATA (this table), never by editing seeds.ts.
--   * A seed is a discovery TOPIC anchor only — NEVER a metric pair. The C9 candidate list
--     (tools/brain-ingest/src/seeder/candidates.ts) stays the ONLY source of pairs; the LLM
--     still cannot add pairs; verifier-gating on resulting edges is unchanged.
--   * The pipeline consumes this table FAIL-SOFT (tools/brain-ingest/src/seeder/dbSeeds.ts):
--     absent env / unreachable Supabase → static topics only + one loud warning. On a slug
--     collision with a static topic, the STATIC seed wins (code is the bootstrap truth).
--
-- RLS: dev posture per this run's D3 precedent (any authenticated user is one of the two
-- ourobion devs) — authenticated SELECT + INSERT (created_by forced to auth.uid() so the audit
-- column cannot be forged) + UPDATE of the `enabled` column ONLY (column-level grant: curation
-- can pause a seed but never rewrite another dev's slug/label/audit trail). service_role
-- bypasses RLS (the pipeline's read uses it).

create table if not exists public.ingestion_seeds (
  id          bigint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9_]+$'),
  label       text not null,
  query_hint  text null,          -- optional free-text search query; label is the fallback query
  enabled     boolean not null default true,
  created_by  uuid not null,      -- auth.uid() of the adding human (RLS-enforced)
  created_at  timestamptz not null default now()
);

comment on table public.ingestion_seeds is
  'O14 human-added ingestion seeds (seeds-as-data) — complements C9 predetermined seeds (code) '
  'and the future gap-driven loop (O9). Seeds are TOPICS/queries, never metric pairs (C9 stays '
  'the only pair source; verifier-gating on resulting edges unchanged). Read fail-soft by '
  'tools/brain-ingest/src/seeder/dbSeeds.ts; static seeds.ts wins on slug collision.';
comment on column public.ingestion_seeds.slug is
  'Stable topic slug (^[a-z0-9_]+$) — becomes Seed.topic / PaperRecord.topicTags in the pipeline; '
  'must not collide with a static seeds.ts topic (static wins if it does).';
comment on column public.ingestion_seeds.query_hint is
  'Optional free-text discovery query; when null the label is used as the query.';
comment on column public.ingestion_seeds.created_by is
  'The adding human (auth.uid()); the INSERT policy forces it, so the audit trail cannot be forged.';

alter table public.ingestion_seeds enable row level security;

create policy "Authenticated users can read ingestion seeds"
  on public.ingestion_seeds for select
  to authenticated
  using (true);

create policy "Authenticated users can add ingestion seeds"
  on public.ingestion_seeds for insert
  to authenticated
  with check (created_by = auth.uid());

-- Enable/disable only: the RLS policy row-permits the update; the column-level grant below
-- restricts WHICH columns an authenticated user may set (enabled only). No DELETE policy —
-- disable, don't erase (audit stays).
create policy "Authenticated users can toggle ingestion seeds"
  on public.ingestion_seeds for update
  to authenticated
  using (true)
  with check (true);

revoke update on public.ingestion_seeds from authenticated, anon;
grant update (enabled) on public.ingestion_seeds to authenticated;
