-- R4-U4 / O27 · artifact trust posture, model attestation, and revision-bound expert
-- disposition (register row B-BR7). ADDITIVE ONLY — every column below is nullable, every view
-- change appends columns at the end, no existing CHECK / column / policy is edited.
--
-- WHY: shared/brain/relationships.ts (ArtifactRef, ModelAttestation) and shared/brain/
-- provenance.ts (trustFailures, resolveDisposition) are the TS-side truth for two axes that must
-- survive unbroken from a stored artifact to a rendered card:
--   1. TRUST POSTURE — was this record loaded from a frozen fixture or a live provider run, what
--      exact artifact bytes does it come from (revision + content hash), and did the provider
--      itself RETURN a model identity (attestation) rather than merely echo router config (B-BR1).
--   2. B-BR7 — an expert's recorded disposition toward an edge must bind to the ARTIFACT the
--      expert actually looked at, not to the relation key alone. A relation-key-only verdict
--      silently carries over to a rebuilt or re-synthesised claim the expert never saw — the
--      claim can change (new sources, a corrected effect size, a flipped direction) while the
--      verdict rubber-stamps the new bytes as if the expert reviewed them. That is how a stale
--      approval poisons a future claim. Binding the verdict to (artifact_revision,
--      artifact_content_hash) means a rebuild that changes the claim retires the disposition
--      instead of inheriting it — shared/brain/provenance.ts resolveDisposition() is the TS-side
--      twin of the SQL implemented here: fail closed, a mismatch resolves to 'pending' /
--      'stale-revision', never to a carried-over 'accepted'.
--
-- NULL DISCIPLINE: every column added here is nullable because every pre-U4 row in
-- relationship_claims / edge_verifications / edge_human_verdicts predates these fields and must
-- keep loading. NULL is NOT "fine" — it means UNTRUSTED / UNBOUND. shared/brain/provenance.ts
-- trustFailures() treats a missing artifact ref or attestation as a hard block on any path that
-- requires trust (never a soft default), and this migration's view makes the same call for the
-- human-verdict binding (human_verdict_applies below). The serving gate lives in application
-- code (trustFailures / resolveDisposition), not in a DB CHECK — a NULL artifact_posture on a
-- fixture-era row must remain insertable; only the *interpretation* is strict.
--
-- SCOPE: this migration does NOT touch tools/edge-loader (it does not yet populate these
-- columns — that is a follow-on unit), does NOT touch generate-insights (its verified_edges
-- fetch already excludes human_verdict = 'reject' unconditionally, independent of staleness —
-- see part 4's comment for why that already satisfies B-BR7's "reject stays conservative"
-- rule), and does NOT re-decide any edge_human_verdicts semantics locked by
-- 20260724150000_create_o13_edge_human_verdicts.sql (only 'reject' exists; no 'accept'/'restore'
-- is added here).

-- ═══════════════════════════════════════════════════════════════
-- 1. relationship_claims — which artifact this claim came from
-- ═══════════════════════════════════════════════════════════════

alter table public.relationship_claims
  add column artifact_revision      text,
  add column artifact_content_hash  text,
  add column artifact_posture       text;

alter table public.relationship_claims
  add constraint relationship_claims_artifact_posture_valid
    check (artifact_posture is null or artifact_posture in ('fixture', 'live')),
  add constraint relationship_claims_artifact_content_hash_format
    check (artifact_content_hash is null or artifact_content_hash ~ '^sha256:[0-9a-f]{64}$');

comment on column public.relationship_claims.artifact_revision is
  'R4-U4/O27: revision id of the artifact bundle this claim was loaded from (shared/brain '
  'ArtifactRef.revision). NULL on every pre-U4 row — NULL means UNTRUSTED, not "fine": '
  'shared/brain/provenance.ts trustFailures() blocks a record with no artifact ref on any path '
  'requiring trust. Populated by a follow-on tools/edge-loader change, not by this migration.';
comment on column public.relationship_claims.artifact_content_hash is
  'R4-U4/O27: content-addressed hash of this claim''s exact artifact bytes (ArtifactRef.'
  'contentHash), format sha256:<64 lowercase hex>. A rebuild that changes the claim yields a '
  'different hash, which is exactly what unbinds a stale B-BR7 expert verdict (see part 4). '
  'NULL means UNTRUSTED — never treated as "unchanged since forever".';
comment on column public.relationship_claims.artifact_posture is
  'R4-U4/O27: ''fixture'' (no provider was called) or ''live'' (a live provider run produced '
  'this claim) — shared/brain ArtifactPosture. Disclosed on every card derived from this record '
  '(B-UI9). NULL means UNTRUSTED: trustFailures() fails closed on a missing posture exactly as '
  'on a missing revision/hash, it does not default to treating an unlabelled row as safe.';

-- ═══════════════════════════════════════════════════════════════
-- 2. edge_verifications — same artifact-trust columns, plus what the PROVIDER returned
-- ═══════════════════════════════════════════════════════════════

alter table public.edge_verifications
  add column artifact_revision           text,
  add column artifact_content_hash       text,
  add column artifact_posture            text,
  add column attestation_returned_model   text,
  add column attestation_returned_version text,
  add column attestation_family           text,
  add column attestation_decorrelated     boolean,
  add column attestation_attested         boolean;

alter table public.edge_verifications
  add constraint edge_verifications_artifact_posture_valid
    check (artifact_posture is null or artifact_posture in ('fixture', 'live')),
  add constraint edge_verifications_artifact_content_hash_format
    check (artifact_content_hash is null or artifact_content_hash ~ '^sha256:[0-9a-f]{64}$');

comment on column public.edge_verifications.artifact_revision is
  'R4-U4/O27: revision id of the artifact bundle this verification was loaded from '
  '(shared/brain ArtifactRef.revision). See relationship_claims.artifact_revision for the NULL '
  '= UNTRUSTED discipline — it applies identically here.';
comment on column public.edge_verifications.artifact_content_hash is
  'R4-U4/O27: content-addressed hash of this verification''s exact artifact bytes (ArtifactRef.'
  'contentHash), format sha256:<64 lowercase hex>. NULL means UNTRUSTED, per the same rule as '
  'relationship_claims.artifact_content_hash.';
comment on column public.edge_verifications.artifact_posture is
  'R4-U4/O27: ''fixture'' or ''live'' — see relationship_claims.artifact_posture. A claim/'
  'verification posture MISMATCH (a live verification of a fixture claim, or the reverse) is a '
  'mixed-provenance record; shared/brain/provenance.ts provenanceGaps() flags it as '
  '''posture-mismatch''. NULL means UNTRUSTED.';
comment on column public.edge_verifications.attestation_returned_model is
  'R4-U4/O27: the model identity the PROVIDER returned on the response (shared/brain '
  'ModelAttestation.returnedModel) — distinct from verifier_model-style CONFIGURED ids captured '
  'in the verification jsonb, which are router config, not attestation. B-BR1: only a '
  'provider-RETURNED identity may set attestation_attested = true. NULL means no attestation was '
  'captured, which is the pre-U4 default and is UNTRUSTED for any path requiring attestation.';
comment on column public.edge_verifications.attestation_returned_version is
  'R4-U4/O27: provider-returned version / snapshot id (ModelAttestation.returnedVersion), or '
  'NULL when the provider exposes none at all (a genuine "no version" — distinguished from '
  '"attestation not captured" only by attestation_returned_model also being NULL).';
comment on column public.edge_verifications.attestation_family is
  'R4-U4/O27: provider family this verification ran on (ModelAttestation.family) — the unit the '
  'O7/B-BR2 decorrelation invariant compares against the synthesising family for the same edge.';
comment on column public.edge_verifications.attestation_decorrelated is
  'R4-U4/O27: true iff this verification''s provider family differs from the synthesising '
  'family for the same edge (ModelAttestation.decorrelated). shared/brain/provenance.ts '
  'trustFailures() requires this true in production (inert in Run 4 — no production serving is '
  'authorized yet, but the gate is written ahead of the path per that file''s header).';
comment on column public.edge_verifications.attestation_attested is
  'R4-U4/O27: true ONLY for a provider-returned identity (ModelAttestation.attested) — a '
  'configured id copied from router config is NOT attestation (B-BR1). NULL/false both fail '
  'trustFailures()''s ''missing-attestation'' / ''unattested-model'' checks; only true passes.';

-- ═══════════════════════════════════════════════════════════════
-- 3. edge_human_verdicts — B-BR7: bind the verdict to the ARTIFACT, not the edge_id alone
--
-- Additive only — the existing `action` CHECK (in ('reject')) is untouched and no 'accept' /
-- 'restore' action is added: 20260724150000_create_o13_edge_human_verdicts.sql's header locks
-- that decision explicitly ("An un-reject/'restore' action is intentionally NOT modelled") and
-- this migration does not re-decide it. What changes is WHAT the recorded verdict is bound to.
-- ═══════════════════════════════════════════════════════════════

alter table public.edge_human_verdicts
  add column artifact_revision      text,
  add column artifact_content_hash  text;

alter table public.edge_human_verdicts
  add constraint edge_human_verdicts_artifact_content_hash_format
    check (artifact_content_hash is null or artifact_content_hash ~ '^sha256:[0-9a-f]{64}$');

comment on column public.edge_human_verdicts.artifact_revision is
  'R4-U4/O27 (B-BR7): the artifact_revision of the relationship_claims row the curator was '
  'looking at when this verdict was recorded (shared/brain provenance.ts ExpertVerdictRecord.'
  'artifactRevision). NULL on every pre-U4 row — an unbound legacy verdict, per the view logic '
  'in part 4, never resolves as applying to a claim that now carries a revision (fail closed, '
  'same direction as resolveDisposition()''s current === undefined case).';
comment on column public.edge_human_verdicts.artifact_content_hash is
  'R4-U4/O27 (B-BR7): content hash of the EXACT claim bytes the curator judged '
  '(ExpertVerdictRecord.artifactContentHash), format sha256:<64 lowercase hex>. Binding to the '
  'hash (not just the revision) means even a same-revision edit to this one claim retires the '
  'verdict: a relation-key-only or revision-only match would let a rebuilt claim the expert '
  'never saw silently inherit an old disposition, which is precisely the poisoning this column '
  'exists to prevent.';

-- edge_human_verdicts had its table-level SELECT privilege revoked and replaced with an
-- explicit column grant in 20260728010002_nao_redaction_grants.sql (identity-column
-- redaction — see that migration's part 3.2). A table-level REVOKE means new columns are NOT
-- automatically visible to `authenticated`; without this grant the security_invoker view below
-- would raise "permission denied for column" the moment it selects these two columns for an
-- authenticated caller. relationship_claims and edge_verifications never had their table-level
-- SELECT revoked, so their new columns need no equivalent grant — they inherit the existing
-- open `to authenticated using (true)` read policy's table-level privilege automatically.
grant select (artifact_revision, artifact_content_hash)
  on public.edge_human_verdicts to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. verified_edges — expose the new artifact/attestation columns + B-BR7 revision binding
--
-- `create or replace view` is ILLEGAL here: the old view selected `c.*`, and relationship_claims
-- now has three MORE columns than it did when that `c.*` was written, which would insert them in
-- the MIDDLE of the result (between loaded_at and v.verified_at) rather than appending — exactly
-- the reordering CREATE OR REPLACE VIEW forbids for existing output columns anyway. So: drop and
-- recreate with an EXPLICIT column list, preserving the existing 15 columns' names AND ORDER
-- first (the same order `c.*, v.verified_at, ..., human_verdict, human_verdict_at` produced),
-- then appending the new ones. No other view or function depends on verified_edges (grepped
-- supabase/migrations/**: only this file and the two migrations that defined it reference the
-- name; get_insight_provenance reads relationship_claims / edge_verifications /
-- edge_human_verdicts directly, not through this view), so nothing else needs recreating.
--
-- relationship_claims and edge_verifications both gained THEIR OWN artifact_revision /
-- artifact_content_hash / artifact_posture columns (parts 1-2) with identical names, which would
-- collide if selected unqualified in the same view — so they are aliased claim_artifact_* and
-- verification_artifact_*, matching shared/brain/provenance.ts ProvenanceChain's claimArtifact /
-- verificationArtifact split (and its posture-mismatch check between the two).
--
-- human_verdict / human_verdict_at: UNCHANGED meaning, still the newest edge_human_verdicts row
-- per edge regardless of artifact binding — existing tests and the O13 serving filter pin these.
--
-- human_verdict_applies (NEW): true only when the newest verdict row's artifact_revision AND
-- artifact_content_hash both equal the CLAIM's current artifact_revision / artifact_content_hash
-- (c.*, not v.* — B-BR7 binds a verdict to the claim bytes the curator reviewed, and the claim,
-- not the verification, is what gets re-synthesised). NULL when there is no verdict row at all
-- (mirrors human_verdict being NULL in that case); false whenever either side is missing its
-- artifact binding OR the two disagree — never true by default. This is the SQL twin of
-- shared/brain/provenance.ts resolveDisposition(): a record === null verdict has nothing to
-- apply; a non-null verdict against a mismatched or absent artifact ref resolves to
-- 'stale-revision', not to a carried-over acceptance.
--
-- SERVING RULE (documented here, enforced in supabase/functions/generate-insights/index.ts,
-- unchanged by this migration): a 'reject' keeps excluding the edge from NEW cards even when
-- stale (human_verdict_applies = false) — rejection is the conservative direction, so staleness
-- never RE-ADMITS a previously-rejected edge. generate-insights already filters purely on
-- `human_verdict <> 'reject'` with no staleness check, which already has this effect; this
-- migration does not add a staleness escape hatch to that filter. The column this migration
-- actually guards against is the one that does NOT exist yet: were an 'accept' action ever added
-- (out of scope here — locked against by part 3's header), a stale accept must NEVER be read as
-- approval — approval is never inherited across a revision change. human_verdict_applies is the
-- primitive a future accept-serving path would consult; today, with only 'reject' modelled,
-- it is additive documentation/provenance surface, not yet load-bearing for serving.
-- ═══════════════════════════════════════════════════════════════

drop view if exists public.verified_edges;

create view public.verified_edges
  with (security_invoker = true) as
  select distinct on (c.edge_id)
         -- ── existing columns, byte-identical names and order to the O13 recreation ──
         c.edge_id, c.subject, c.object, c.relation, c.claim, c.prompt_version,
         c.synthesised_at, c.loaded_at,
         v.verified_at, v.verification, v.verdict, v.edge_score, v.serving_band,
         hv.action as human_verdict, hv.created_at as human_verdict_at,
         -- ── R4-U4/O27: appended artifact trust + attestation columns ──
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
         -- ── R4-U4/O27 (B-BR7): revision-bound human disposition ──
         hv.artifact_revision      as human_verdict_artifact_revision,
         hv.artifact_content_hash  as human_verdict_artifact_content_hash,
         case
           when hv.action is null then null
           when hv.artifact_revision is null or hv.artifact_content_hash is null then false
           when c.artifact_revision is null or c.artifact_content_hash is null then false
           else hv.artifact_revision = c.artifact_revision
                and hv.artifact_content_hash = c.artifact_content_hash
         end as human_verdict_applies
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
  'Newest active verification per edge, with precomputed edge_score / serving_band (§S6). '
  'S7 / A1 read this; serving_band = hold rows are visible but must never be surfaced '
  '(shared/brain isServable). O13: human_verdict / human_verdict_at carry the newest '
  'edge_human_verdicts row — human_verdict = ''reject'' supersedes the verifier FOR SERVING '
  '(generate-insights excludes such rows for new cards); null = no human action, verifier '
  'default stands. Provenance reads keep rejected edges visible (honest history). R4-U4/O27: '
  'claim_artifact_* / verification_artifact_* / attestation_* expose the artifact trust posture '
  'shared/brain/provenance.ts trustFailures() gates on (NULL = untrusted, never "fine"). '
  'human_verdict_artifact_revision / human_verdict_artifact_content_hash / '
  'human_verdict_applies implement B-BR7: applies is true only when the newest verdict''s '
  'artifact binding matches the claim''s CURRENT artifact_revision/artifact_content_hash — a '
  'stale verdict (rebuilt claim, different bytes) never applies. Reject stays conservative '
  '(excludes new cards regardless of staleness, enforced in generate-insights, unchanged here); '
  'approval is never inherited across a revision change — the SQL twin of '
  'shared/brain/provenance.ts resolveDisposition().';
