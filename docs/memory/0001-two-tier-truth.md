# Two-tier truth

**Decision (recorded 2026-06-08).** biotope has a **source-of-truth tier** and a **derived tier**, and
they must be treated differently.

- **Truth (git-tracked or user-authored, not reconstructable):** Supabase **migrations**
  (`supabase/migrations/`), the **raw logged rows** users enter (`daily_gut_rows`,
  `antibiotic_courses`, later `wearable_daily` / `env_daily`), and the **shared contracts** in
  `shared/`.
- **Derived projection (rebuildable, never hand-edit):** `baseline_snapshots` (rebuilt by
  `compute-baselines`), `insight_cards` (rebuilt by `generate-insights`), `engagement_state` (rebuilt
  by M6 from raw completeness).

**Why.** PROJECT-CONTEXT states it outright: *"store all raw daily rows, never derive-only. Raw data
is the asset."* The descriptive insights are only as trustworthy as the raw inputs, and they must be
regenerable when rules change — so the raw rows + migrations are the asset, and everything computed
from them is a disposable projection.

**How to apply.** To change a derived value, fix the **input** (a raw row, a migration, or the
edge-function logic) and re-run the job. **Never hand-edit `baseline_snapshots` / `insight_cards` /
`engagement_state` in the database** — the next job run overwrites them. Same idea applies to
`docs/graph/`: the curated graph is truth; any future auto-generated graph is a rebuildable projection
(see [../graph/README.md](../graph/README.md)).
