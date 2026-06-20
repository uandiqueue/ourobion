# Session 20260620T161931Z — uandiqueue — claude — phase2-replan-metric-platform

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/phase2-replan-metric-platform (cut from feat/m5a-metrics/registry — stacks on PR #15)
- **Type:** Docs (plan). Replan Phase 2 around a modifiable, multi-source metric platform. No app/backend code.

## Attempted
Owner asked to replan Phase 2 against a draft 360-metric catalog (`metrics_v3.md`, not ground truth):
keep everything already in Phase 2 unless contradictory (flag those), design for metrics at this scale
or larger from five sources (manual / semi-passive / sensor / api / derived), and make metrics
**modifiable** (add/remove without breaking the system).

## Changed
- Rewrote **`docs/PHASE2-PLAN.md`** around a **metric platform**:
  - New "The metric platform" section: 5 source economies; registry as single source of truth;
    **modifiability** (add = one guarded entry, remove = soft-deprecate); **storage by continuity**
    (`daily_log` / `events` / `state_bands` / `signals` / `derived_metrics`, with existing tables as
    first instances); reliability as a first-class weight; granular per-source consent + on-device raw.
  - W0 gains registry v2 + storage primitives + granular consent; W1 gains semi-passive fetch; W2 gains
    the relationship graph (brain) + grounded LLM synthesis + reliability weighting; W3 reframed as the
    first `api`-source build-out; W7 gains a registry/rules version stamp. Gate gains a 7th criterion
    (prove modifiability). Scope explicitly capped to **platform + a thin slice**, not hundreds of metrics.
  - Every prior Phase 2 item retained (verbatim or expanded).

## Decided
- Phase 2 builds the **platform**, not the catalog; the metric list is later research.
- Existing tables (`daily_gut_rows`, `antibiotic_courses`, `wearable_daily`, `baseline_snapshots`)
  become the first instances of the storage primitives — migrate in place, no rewrite.

## Left (flagged to owner — needs confirmation)
- **Stool events:** "timestamped stool events" reclassified from "→ Later" into W1 (the `events`
  primitive is now W0). Full event-granularity richness can still phase.
- **Registry v2 supersedes v1 `source`/`table`:** v1 (PR #15) uses `source: self_report|wearable|env`;
  v2 needs `manual|semi_passive|sensor|api|derived` and decouples `table` (storage follows continuity).
- **DQS becomes tier-aware:** `log_completeness` should count only the daily-core (T1) spine.
- **M2 symptom flags / standing-water** reframed from daily columns to gateway-events / periodic event.
- Possible follow-up: extend `METRICS-REGISTRY-DESIGN.md` with the concrete registry-v2 schema +
  storage topology (a spec for W0 to build against).

## Blockers
- None. Plan doc only; no code/tests touched this session.
