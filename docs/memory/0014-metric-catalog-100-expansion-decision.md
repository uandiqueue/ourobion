---
id: "0014"
title: Metric-catalog 100-expansion decision
summary: Grow the metric registry from ~19 to 100 metrics in collector-gated waves (W1 self-report → W2 sensor → W3 env/api → W4 wearable/CGM), superseding the original thin-slice plan; the full ~360-metric catalog stays reference, not ship target.
type: memory
status: accepted
decided: 2026-07-01
updated: 2026-08-02
---

# 0014 — Metric-catalog 100-expansion decision

**Decision (adopted 2026-07-01).** Grow the metric registry from the shipped ~19 to **100 metrics**, in
**collector-gated waves** — a deliberate step past phase-2-plan's original "thin slice", which it now
**supersedes**. The full **~360-metric catalog** ([`../biotope/metrics-catalog.md`](../implemented/biotope/metrics-catalog.md))
stays the **reference**, not the ship target. Which 100 + why + by wave are fixed by the anchor brief
(2026-07-01 metric-catalog-100-promotion).

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
seeder + brain). Sequencing (Family A): [`../phase-2-plan.md` 2026-07-01 integrated update](../development/phase-2-plan.md).
