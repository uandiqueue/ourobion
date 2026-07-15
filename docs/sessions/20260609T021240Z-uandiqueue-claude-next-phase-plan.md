# Session 20260609T021240Z — uandiqueue — claude — next-phase-plan

> Session log format (use for every session): **Attempted / Changed / Decided / Left / Blockers**.
> A session's FIRST step is to read the latest few files in this directory to resume context, then run
> `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (phase-2 integration line; dev-alton fast-forwarded to it)
- **Type:** PLANNING SESSION — plan + docs only, **no implementation code**.
- **Goal:** Plan biotope's Phase 2 deep health-metric analysis: a PDF→structured-rules→engine pipeline
  modeled on sister repo NUSPlan, with graphify for context management, **engine sequenced LAST** and
  AI summary deferred to a later phase. Tracking issue #3.

## Attempted
Design (not build) the analysis pipeline. Followed the new-session protocol (session-start briefing,
read latest sessions, opened issue #3, created the isolated worktree). Researched **graphify**
(github.com/safishamsi/graphify — a knowledge-graph skill for AI assistants). Studied **NUSPlan**
(`C:\project\NUSPlan`, local) ingestion method and mapped biotope's existing M5a/M5b analysis stack via
Explore + Plan agents. Produced an approved plan, persisted as repo docs.

## Changed (docs only — NO pipeline code)
- **`docs/NEXT-PHASE-PLAN.md`** (new) — next-phase direction (Phase 0 backlog + analysis pipeline): two-tier rule blueprints
  (`data/rules/**.json` truth) → `rules` Postgres table (projection) → loader → extract skeleton →
  guards → data-driven engine refactor; sequenced **engine last**; core condition set
  (trend/threshold/correlation); deterministic, non-diagnostic.
- **`docs/human-briefs/`** (new folder) — `README.md` + `2026-06-09-next-phase-direction.md` (plain-language
  stakeholder brief of the plan).
- **`docs/memory/0007-rules-as-data-two-tier.md`**, **`docs/memory/0008-graphify-context-tool.md`** (new)
  — durable decisions; indexed in `docs/memory/README.md`.
- **`AGENTS.md`** / **`README.md`** doc lists — link the plan + human-briefs folder for discoverability.
- This session log.

## Decided
- **Replicate NUSPlan's two-tier pattern** (git-JSON blueprints = truth → derived rebuildable store),
  adapted to **Postgres** (a `rules` table, not Neo4j); **no Python** (Node/Deno/TS only).
- **Engine LAST**, foundations first; **AI/LLM summary is a later, additive phase** (deterministic engine
  has no LLM in the hot path; LLM only in the offline, human-reviewed `extract` step with cost discipline).
- **Condition set = core**: `trend` + `threshold` + `correlation` (cross-metric). `deviation`/`all`/`any`
  deferred.
- **This session is plan-only** — no migrations, `shared/` contracts, `tools/`, or `supabase/functions`
  changes. Implementation happens in later sessions per the roadmap.
- graphify: **design-only this phase**; index biotope repo (+ paper corpus separately later), never
  NUSPlan; gitignore graph artifacts until a path-normalizer exists ([[0008-graphify-context-tool]]).

## Left (future implementation sessions, in order)
- **A** graphify adoption (install + build graph) · **B1–B5** rule contract + `rules` table + loader +
  extract skeleton + guards · **C** engine refactor (data-driven, cross-metric) · **D** e2e verification ·
  **E** (later) AI-summary layer. See `docs/NEXT-PHASE-PLAN.md`.
- Rename issue #3 + this branch to reflect plan-only before first push; open PR into `dev-alton`.

## Blockers / notes
- **Research-paper PDF not provided** — the `extract` step is planned as a runnable-but-unused skeleton
  until it arrives. **aeroplus-datum is not on disk** (only NUSPlan + its `reference_guide.md`, which
  reads aeroplus-datum second-hand) — trust-tier/validity/cost patterns are taken from there.
- New `shared/rules` contract (B1) will require a **2-reviewer PR** (memory 0002) when implemented.

## Addendum — scope generalized + Phase 0 added (same session)
Owner feedback resolved two things:
1. **Plan missed the "everything else."** Added a **Phase 0 — clear first** section to
   `docs/NEXT-PHASE-PLAN.md`: the undone P1S2 work that precedes the engine. **Hard prerequisites** for
   the rules pipeline = the incomplete Dart shared contracts (`shared/types/index.dart` has only
   `DailyGutRow`; rest TODO) + the 3 placeholder parity guards (`src/test/guards/*`, `couplings.yaml`
   all `status: planned`) + the M3 end-to-end device test. General backlog = M1 app-shell/PDPA copy,
   M2 DQS-logic extraction + standing-water/symptom-flags/antibiotic flows, M6 `dqs_7day_avg`/
   `longest_streak` display. Deferred-by-design (not prereqs) = M4 `env_daily`/module, M7, Google/Apple
   OAuth, the structural import-graph, the Gemini session hook.
2. **Generalized naming** `m5-analysis-pipeline` → **`next-phase`**: branch `docs/next-phase-plan`,
   issue #3 retitled, docs → `NEXT-PHASE-PLAN.md` + `human-briefs/2026-06-09-next-phase-direction.md`.
   Worktree dir renamed to `biotope-wt-next-phase`. **Branch is `dev-phase2`** (convention:
   `dev-<name>`, matching `dev-phase1`) — the phase-2 integration line; the plan is its first commit and
   **`dev-alton` is fast-forwarded to it** (no PR).
