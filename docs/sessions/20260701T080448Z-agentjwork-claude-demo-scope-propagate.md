# Session 20260701T080448Z — agentjwork — claude — demo-scope-propagate

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (direct, per owner instruction) · **Issue:** —
- **Type:** Docs. Propagate **demo scope** to the remaining flagged artifacts across the constant-layer +
  reference docs (owner: "update all to demo scope").

## Attempted
Apply the demo-scope decision (all user data in Supabase; PDPA + privacy hardening deferred; brain uses
Neo4j) to every doc that still carried the old stance, and mark stale snapshots superseded.

## Changed
- **`PROJECT-CONTEXT.md`** — principle #4 (PDPA) + #5 (privacy-safe community) reworded to **deferred past
  the demo / aggregates-only**; M1 ownership row drops "PDPA consent copy" (deferred).
- **`biotope/INSIGHTS-ENGINE-DESIGN.md`** — fixed the "Postgres instead of Neo4j" line: the **rules
  engine** is Postgres; the **brain graph is a separate Neo4j projection** (→ BRAIN-DESIGN).
- **`biotope/METRICS-CATALOG.md`** — "Privacy by design" implementation note → **deferred past the demo**
  (demo stores all in Supabase).
- **`PHASE2-PLAN.md`** — softened the W4 "Global aggregates" row to "aggregates only, no individual rows".
- **Superseded snapshots** — added ⛔ banners to `human-briefs/2026-06-11-phase2-goals-and-features.md` and
  `…-phase2-integrated-plan.md` pointing at the current `PHASE2-PLAN.md`.
- **Verified:** remaining PDPA/privacy/on-device hits are now either demo-scoped/deferred, aggregate-only,
  a benign sensor fact (audio never stored raw), or historical session logs.

## Decided
- Demo scope is now consistent across the constant layer: **all user data in Supabase; PDPA, granular
  consent, and on-device raw-signal processing are deferred to post-demo / scaling.**
- Session logs left as-is (historical records).

## Left / not touched
- `METRICS-CATALOG` per-sensor "never store raw audio" (E-12) — a technical fact, not a scope choice.
- The 2026-06-11 brief *bodies* — left as dated snapshots under their new superseded banners.

## Blockers
- None.
