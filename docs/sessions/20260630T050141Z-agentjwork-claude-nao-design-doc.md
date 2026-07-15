# Session 20260630T050141Z — agentjwork — claude — nao-design-doc

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/nao-design-doc (cut from dev-phase2) · **Issue:** #27
- **Type:** Docs. Promote the nao evaluation/plan into a durable design doc.

## Attempted
Write `docs/nao/NAO-DESIGN.md` from the agreed nao plan (the brain-inspection product surface).

## Changed
- **`docs/nao/NAO-DESIGN.md`** (new) — durable design doc following the `BRAIN-INGESTION-DESIGN.md`
  pattern: the three capability pillars (query+viz / secondary ingestion / LLM), two-tier placement,
  architecture (`apps/nao/` Next.js on Cloudflare Pages, server-side secrets, `shared/brain` reuse),
  Supabase Auth + roles, the v1→v4 phasing, the evidence/quality model (reuse the `shared/brain`
  contract — `QuoteSpan`/`Citation`/`evidenceTier`/`servingBand`/etc.), the bio-neo-mythical visual
  design, build map, v1 verification, and deferred/open items.
- **`AGENTS.md`** §3 — added a "Per-feature design docs" pointer (docs/nao incl. NAO-DESIGN, docs/biotope).

## Decided
- nao = biotope's dark, expert, graph-centric sibling; **v1 = corpus dashboard** (R2-backed) since the
  brain has no edges yet (synthesis/verification pipeline is unbuilt — the real critical path).
- **Supabase Auth** (roles in-app); **Neo4j is a derived projection** of a truth-tier `verified_edges`
  store (human curation + LLM, `provenance`-tagged) — preserves two-tier truth.
- Evidence/quality markers reuse the existing brain contract; source-reliability standard extends `impactTier`.

## Left
- Promote to actual build: scaffold `apps/nao/` (Next.js + Supabase auth + R2-backed corpus dashboard).
- v2+ (graph/evidence/ingestion/LLM) gated on the brain synthesis+verification pipeline (Track B).

## Blockers
- None.
