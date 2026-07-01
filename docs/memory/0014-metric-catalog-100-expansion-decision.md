# 0014 — Metric-catalog 100-expansion decision

**Decision (adopted 2026-07-01).** Grow the metric registry from the shipped ~19 to **100 metrics**, in
**collector-gated waves** — a deliberate step past PHASE2-PLAN's original "thin slice", which it now
**supersedes**. The full **~360-metric catalog** ([`../biotope/METRICS-CATALOG.md`](../biotope/METRICS-CATALOG.md))
stays the **reference**, not the ship target. Which 100 + why + by wave:
[`../human-briefs/2026-07-01-metric-catalog-100-promotion.md`](../human-briefs/2026-07-01-metric-catalog-100-promotion.md).

**Waves (each promotes only when its collector lands, or the guards go red):**
- **W1** self-report expansion (~45 manual) — needs the `events` / `state_bands` storage primitives.
- **W2** phone-sensor signals (both-platform, onto `signals`).
- **W3** environment / `api` source (M4) — keyed on GPS + time.
- **W4** wearable / CGM (M3) — needs a real device.

**Weighting** (manual-forward): ~45 manual · 25 sensor · 12 api · 18 derived. The manual budget stays a
thin ~9-touch daily spine; breadth lives in the free passive/derived layers (the "ignored-indicator"
discovery bet). Every promotion still forces its storage + contract + guards (the metric-platform
invariant), and reliability is promoted alongside each metric.

Follows [0001](0001-two-tier-truth.md) (raw rows are truth); relates to
[0013](0013-brain-pipeline-and-support-models-decision.md) (more registry nodes → more for the agentic
seeder + brain). Sequencing (Family A): [`../PHASE2-PLAN.md` 2026-07-01 integrated update](../PHASE2-PLAN.md).
