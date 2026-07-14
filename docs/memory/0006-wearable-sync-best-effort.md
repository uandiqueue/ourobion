---
id: "0006"
title: Wearable sync is best-effort
summary: Wearable writes use .ignore() and silently no-op on permission/availability failures; never treat a missing wearable_daily row or null field as an error — wearables augment confidence, never gate.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# Wearable sync is best-effort

**Gotcha (M3 wearables).** Wearable sync is intentionally **best-effort** (`.ignore()` on the write):
a permission denial, a missing Health Connect install, or an unavailable signal **silently no-ops**. A
`wearable_daily` row is written **only if at least one signal is available**.

**Why.** Product Principle #3 — *graceful degradation*: wearables and env data are **confidence
multipliers, never hard gates**. The 30-second self-report flow must never block on a wearable.

**How to apply.** Never treat a missing `wearable_daily` row (or any null wearable field) as an error.
M5a baseline logic must treat data sources as pluggable — self-report works alone; wearable/env data
augment confidence when present. Related platform caveat: HRV SDNN is iOS-only
([0004-hrv-sdnn-ios-only](0004-hrv-sdnn-ios-only.md)).
