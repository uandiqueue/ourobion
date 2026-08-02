---
id: "0006"
title: Wearable sync is best-effort
summary: Wearables are optional confidence inputs, never product gates; missing rows or nullable platform-specific fields represent unavailable data rather than a user or pipeline failure.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Wearable sync is best-effort

Wearable data augments confidence; it never gates the core self-report loop or the user's access to
the product. Permission denial, unavailable platform APIs, unsupported metrics, and missing daily
rows are expected states rather than failures.

Every downstream reader must tolerate an absent wearable row and nullable fields. Never block
logging, baseline computation, or insight generation on a wearable. The implementation may later
report sync status more explicitly, but it must preserve this graceful-degradation rule. Related:
[HRV SDNN is iOS-only](0004-hrv-sdnn-ios-only.md).
