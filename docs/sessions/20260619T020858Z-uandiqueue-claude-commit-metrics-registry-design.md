# Session 20260619T020858Z — uandiqueue — claude — commit-metrics-registry-design

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (worked directly, per owner instruction)
- **Type:** Docs (design). Commit the previously-drafted metrics-registry design. No app/backend code.

## Attempted
Owner approved committing `docs/METRICS-REGISTRY-DESIGN.md` (drafted earlier, held uncommitted pending
go-ahead).

## Changed
- Committed **`docs/METRICS-REGISTRY-DESIGN.md`** — the single-source metric registry design
  (`shared/metrics/` code registry + parity/schema guards; add = guard-forced completeness, remove =
  soft-deprecate; fixes the live `DailyPhysioRow` ↔ `compute-baselines` wearable-key drift).
- Indexed it for discoverability: added to the README documentation list and the `STRUCTURE-CONTEXT.md`
  directory tree (next to `INSIGHTS-ENGINE-DESIGN.md`).

## Decided
- Committed as a **design doc**; its one open decision (DQS weights in the registry vs M6 config) is
  recorded in the doc's "Open decisions" and is resolved at implementation, not now.

## Left
- Implementation of `shared/metrics/` not started (would be a 2-reviewer `shared/` PR per the protocol).
- Open decision to confirm before building: **DQS weights in the registry** (recommended) vs separate M6 config.

## Blockers
- None.
