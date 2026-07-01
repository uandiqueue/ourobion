# Session 20260701T064546Z — agentjwork — claude — phase2-plan-rewrite

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (direct, per owner instruction) · **Issue:** —
- **Type:** Docs hygiene. Rewrite `PHASE2-PLAN.md` into one current-voice plan — de-segment it and strip
  the historical artifacts that had accreted across recent decision sessions.

## Attempted
Consolidate `PHASE2-PLAN.md`: the original plan, the inline dated flags, and the bolted-on "2026-07-01
integrated update" section (which introduced a *second*, conflicting track model) into a single coherent
document.

## Changed — `docs/PHASE2-PLAN.md` rewritten
- **Removed the segmentation:** deleted the trailing "2026-07-01 integrated update" section, the separate
  "The flow" + "Schedule (9 weeks)" tables, and all dated archaeology (`(updated 2026-07-01)`,
  `✅ Resolved`, `(Was → Later; see flagged change below)`, `superseded`, `stale snapshot`,
  "contradictions flagged").
- **Unified the two track models** (old Track A/B + 9-week schedule vs the new Family A/B) into **one**
  "Tracks, dependencies & sequencing" section: two parallel tracks (biotope / brain-nao), each with a
  foundation, a dependency + effort table, the two cross-cutting constraints (GMI-deferred training;
  dual-route LLM router), a start-now/next/deferred sequencing, and the merge → stress-test → gate flow.
- **Baked the decisions in as current state** (not as "resolved contradictions"): 100-metric expansion is
  simply the plan; the brain pipeline + support models + presentation agent are folded into W2 + Track B;
  added a **W5 · nao** workstream row.
- Cleaned the metric-platform "Scope" note, Goals, W0–W7, gate, ownership, constraints, and risks to
  single-voice; fixed cross-refs that pointed at the deleted section.
- **Verified:** all referenced design docs exist (no dangling links); `context_sync --check` passes.

## Decided
- The plan authority reads as one current document; superseded stances are removed, not annotated. The
  durable decisions live in their own docs/memory records (0013 brain pipeline, 0014 metric expansion),
  which the plan links to rather than re-litigates.

## Left
- No content dropped — every W-item, the 7 gate criteria, ownership, and risks are preserved, just
  re-voiced. The rigid week-numbered calendar was replaced by dependency-ordered sequencing (the GMI/
  router constraints had already made the fixed calendar stale).

## Blockers
- None.

## Addendum — demo scope: drop PDPA/privacy; expand nao; flag stale artifacts
- **Removed from PHASE2-PLAN** (demo stores everything in Supabase): metric-platform §5 "Privacy scales
  with the sensor surface"; the W0 "Granular consent + on-device processing" + "PDPA consent legal review"
  rows; the W3 env-consent row; "raw sensor data stays on-device" + "PDPA isolation / privacy-safe
  community minimums" from Constraints; softened G4 + gate-6 privacy language. Left a one-line **"Demo
  storage"** deferral note (PDPA + on-device privacy → past the demo / scaling).
- **Reconciled the brain row** with the new pipeline: `verified_edges` → Neo4j projection, bootstrapped
  from `derivedFrom[]`+priors and grown by the synthesis→verification pipeline.
- **Expanded W5 · nao**: v1–v4 phasing + stack + pointers to NAO-DESIGN / BRAIN-DESIGN / BRAIN-INGESTION /
  BRAIN-MODELS-TRAINING / memory 0013.
- **Flagged (not edited) stale artifacts in other docs** for owner decision: INSIGHTS-ENGINE-DESIGN "targets
  Postgres instead of Neo4j" (brain now uses Neo4j); PROJECT-CONTEXT PDPA principle #4 + M1 PDPA ownership
  (diverges from demo scope); the two 2026-06-11 human-brief snapshots (stale); METRICS-CATALOG "privacy
  by design / on-device" reference notes.
