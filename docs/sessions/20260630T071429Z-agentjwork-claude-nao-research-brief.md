# Session 20260630T071429Z — agentjwork — claude — nao-research-brief

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/nao-research-brief (cut from dev-phase2) · **Issue:** #31
- **Type:** Docs. Preserve the nao architecture research brief in the repo.

## Attempted
The nao architecture research/options brief existed only as an untracked file in a working checkout
(not in any branch/PR). Commit it so it's preserved.

## Changed
- Added **`docs/human-briefs/2026-06-30-nao-architecture-research.md`** — dated stakeholder brief: a
  verdict-by-decision evaluation of the nao stack (keep / refine / reconsider) against researched
  mid-2026 alternatives (OpenNext/Workers, R2 native binding, D1+FTS5, edge JWKS auth, JSON-artifact-vs-
  Neo4j, Sigma.js), plus three end-goal plans (fastest / lowest-ops / future-proof) and sources.

## Decided
- Keep it as a dated brief in `docs/human-briefs/` (not the constant-layer design doc); `NAO-DESIGN.md`
  holds the committed design, the brief is the research snapshot behind it.

## Left
- Fold the brief's accepted refinements (OpenNext/Workers, R2 binding, D1/FTS5, JWKS auth, Sigma.js,
  Neo4j-as-projection on Aura-Free+keep-alive) into `NAO-DESIGN.md` when scaffolding `apps/nao`.

## Blockers
- None.
