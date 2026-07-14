---
id: "0004"
title: HRV SDNN is iOS-only
summary: hrv_sdnn_ms comes only from Apple HealthKit and stays null on Android (Health Connect exposes RMSSD) by design — treat it as a nullable, platform-dependent signal, never gate on it.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# HRV SDNN is iOS-only

**Gotcha (M3 wearables).** HRV measured as **SDNN** is available only from Apple HealthKit (iOS).
Android Health Connect exposes **RMSSD** only. So `hrv_sdnn_ms` will stay **null on Android** by
design — it is not a bug.

**Why.** The two platforms expose different HRV statistics natively; there is no SDNN field on Health
Connect, and deriving one from RMSSD would not be equivalent.

**How to apply.** Treat `hrv_sdnn_ms` as a nullable, platform-dependent signal in M3 and downstream in
M5a baselines — never gate a feature on it being present. This is one instance of the broader rule that
wearable signals are best-effort and optional ([0006-wearable-sync-best-effort](0006-wearable-sync-best-effort.md)). The shared
`DailyPhysioRow` already keeps all wearable metrics nullable ([0002-shared-contract-two-reviewers](0002-shared-contract-two-reviewers.md)).
