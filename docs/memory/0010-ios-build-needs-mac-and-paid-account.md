---
id: "0010"
title: iOS and HealthKit require Apple hardware and provisioning
summary: Native iOS builds require macOS and Xcode, while meaningful HealthKit validation requires a physical iPhone and the appropriate paid Apple programme; Android remains the cross-platform development path.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T22:08:41Z
---

# iOS and HealthKit require Apple hardware and provisioning

The iOS target can only be built with macOS and Xcode. Meaningful Apple Health/HealthKit validation
also requires a physical iPhone and the appropriate paid Apple Developer Program membership for
entitlement provisioning. Apple Sign In similarly requires provider-side Apple credentials.

Android and Health Connect remain the accessible cross-platform development path when Apple hardware
or provisioning is unavailable. External programme pricing must be checked when budgeting rather
than frozen in memory. Related: [0004](0004-hrv-sdnn-ios-only.md) and
[0006](0006-wearable-sync-best-effort.md).
