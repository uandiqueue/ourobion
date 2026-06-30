# Session 20260629T152720Z — agentjwork — claude — docs-feature-folders

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/feature-folders (cut from dev-phase2) · **Issue:** #25
- **Type:** Docs refactor. Restructure `docs/` into per-feature folders (`docs/nao/` = the brain, `docs/biotope/` = the app) and fix every relative markdown link that the move breaks.

## Attempted
Owner asked to (1) `git mv` six design docs into two new per-feature folders preserving history,
(2) repair all outbound relative links in the moved docs, (3) repoint every live file that linked to
an old path, (4) update the `docs/` tree in `STRUCTURE-CONTEXT.md`, and (5) verify zero broken links /
zero lingering old paths / `context_sync --check` passing.

## Changed
- **Moves (history-preserving `git mv`):**
  - `docs/BRAIN-DESIGN.md` → `docs/nao/BRAIN-DESIGN.md`
  - `docs/BRAIN-INGESTION-DESIGN.md` → `docs/nao/BRAIN-INGESTION-DESIGN.md`
  - `docs/ARCHITECTURE-CONTEXT.md` → `docs/biotope/ARCHITECTURE-CONTEXT.md`
  - `docs/INSIGHTS-ENGINE-DESIGN.md` → `docs/biotope/INSIGHTS-ENGINE-DESIGN.md`
  - `docs/METRICS-REGISTRY-DESIGN.md` → `docs/biotope/METRICS-REGISTRY-DESIGN.md`
  - `docs/ui-context/` → `docs/biotope/ui-context/` (whole folder incl. `UI-DESIGN-CONTEXT.md` + `auth-screen.html`)
- **Link surgery in the 6 moved docs:** outbound relative links to repo-root-outside-docs gained one
  `../` (e.g. `../shared/brain/` → `../../shared/brain/`, `../AGENTS.md` → `../../AGENTS.md`); links to
  docs-root-stayers gained one `../` (e.g. `memory/0001-...` → `../memory/0001-...`, `PHASE2-PLAN.md`
  → `../PHASE2-PLAN.md`, `graph/couplings.yaml` → `../graph/couplings.yaml`); same-folder links left
  bare (BRAIN-INGESTION → BRAIN-DESIGN within `docs/nao/`); images/mockups inside the moved `ui-context/`
  unchanged.
- **Repointed live references to new paths** in: `AGENTS.md`, `README.md`, `shared/SHARED-CONTEXT.md`,
  `shared/brain/README.md`, `shared/metrics/README.md`, `docs/PHASE2-PLAN.md`, `docs/PROJECT-CONTEXT.md`,
  `docs/dev-workflow.md`, `docs/AGENT-PROTOCOL.md`, `docs/STRUCTURE-CONTEXT.md`, `docs/graph/couplings.yaml`,
  `docs/graph/README.md`, `docs/memory/README.md`, `docs/memory/0012-brain-adversarial-edge-verification.md`,
  `docs/memory/0007-rules-as-data-two-tier.md`. (`CLAUDE.md`, `GEMINI.md`, `tools/context_sync.mjs`,
  `.github/ISSUE_TEMPLATE/feature_request.yml` had no references.)
- **`docs/STRUCTURE-CONTEXT.md`:** rewrote the `docs/` tree to show `nao/` and `biotope/` subtrees with
  their contents; updated the `brain-ingest` comment to the new `docs/nao/BRAIN-INGESTION-DESIGN.md` path.

## Decided
- Per-feature doc folders: `nao/` = the brain, `biotope/` = the app. Cross-cutting infra
  (`PHASE2-PLAN`, `AGENT-PROTOCOL`, `PROJECT-CONTEXT`, `STRUCTURE-CONTEXT`, `dev-workflow`,
  `commit-conventions`, and `sessions/` `memory/` `graph/` `human-briefs/`) stays at `docs/` root.
- Frozen historical records under `docs/sessions/` and `docs/human-briefs/` were left untouched — their
  now-stale links are deliberately not rewritten.

## Left
- Nothing outstanding. Commit + PR is the owner's follow-up (this session did not commit).

## Blockers
- None.
