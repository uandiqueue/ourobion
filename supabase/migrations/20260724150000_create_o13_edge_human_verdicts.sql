-- O13 · edge_human_verdicts — the ADDITIVE human-verdict layer over the S6 edge read store
-- (backlog O13 / demo feature (b), run-2 U9; docs/temp/next-build-optimizations.md §O13, locked).
--
-- Two-tier truth, with a twist the S6 tables don't have: relationship_claims /
-- edge_verifications are DERIVED projections of the R2 edge artifacts (rebuilt by
-- tools/edge-loader, never hand-edited), but THIS table is TRUTH for human decisions —
-- human curation is not derivable from any artifact, so a projection rebuild must never
-- clobber it (nao-app-design). That is why there is deliberately NO foreign key to
-- relationship_claims: the loader's full-rebuild prune deletes and re-inserts claim rows,
-- and an FK (cascade or restrict) would either erase human verdicts or block the loader.
-- The /api/claims/reject route checks edge existence at write time instead.
--
-- Semantics (locked — do NOT re-decide):
--   * The override is RECORDED, never a silent edit: the verifier's verdict rows stay
--     byte-identical; this table sits ON TOP (the adversarial verifier is not weakened).
--   * Only 'reject' exists this cycle. Absence of any row = the verifier default stands
--     (interim until B5). REJECT supersedes the verifier FOR SERVING only — provenance
--     reads keep showing rejected edges honestly (see the overlay migration).
--   * Append-only audit: no UPDATE/DELETE policies; the newest row per edge wins. An
--     un-reject/'restore' action is intentionally NOT modelled (carried forward).
--
-- RLS: dev posture per this run's D3 precedent (any authenticated user is one of the two
-- ourobion devs) — authenticated SELECT + INSERT, with created_by forced to auth.uid() so
-- the audit column cannot be forged. service_role bypasses RLS (no write policy needed).

create table if not exists public.edge_human_verdicts (
  id          bigint generated always as identity primary key,
  edge_id     text not null,               -- relationKey(subject, relation, object); no FK on purpose (see header)
  action      text not null check (action in ('reject')),
  reason      text null,                   -- optional free-text justification
  created_by  uuid not null,               -- auth.uid() of the curating human (RLS-enforced)
  created_at  timestamptz not null default now()
);

comment on table public.edge_human_verdicts is
  'O13 additive human-verdict layer over edge_verifications/verified_edges. TRUTH for human '
  'decisions (not a projection — a loader rebuild must never clobber it, hence no FK). '
  'Append-only audit: latest row per edge wins; only ''reject'' exists this cycle; absence of '
  'a row = the verifier default stands. Reject supersedes the verifier FOR SERVING only — '
  'provenance stays honest.';
comment on column public.edge_human_verdicts.edge_id is
  'relationKey(subject, relation, object) — matches relationship_claims.edge_id, without an FK '
  'so the loader''s full-rebuild prune can never cascade-delete a human decision.';
comment on column public.edge_human_verdicts.created_by is
  'The curating human (auth.uid()); the INSERT policy forces it, so the audit trail cannot be forged.';

-- Latest-verdict-per-edge lookup (the overlay view's lateral join).
create index if not exists edge_human_verdicts_edge_id_created_at_idx
  on public.edge_human_verdicts (edge_id, created_at desc, id desc);

alter table public.edge_human_verdicts enable row level security;

create policy "Authenticated users can read edge human verdicts"
  on public.edge_human_verdicts for select
  to authenticated
  using (true);

create policy "Authenticated users can record edge human verdicts"
  on public.edge_human_verdicts for insert
  to authenticated
  with check (created_by = auth.uid());

-- No UPDATE/DELETE policies on purpose: append-only audit; corrections are new rows.
