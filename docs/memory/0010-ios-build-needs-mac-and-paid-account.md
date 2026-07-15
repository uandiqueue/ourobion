---
id: "0010"
title: iOS builds need a Mac; HealthKit needs a paid Apple account + real device
summary: iOS cannot be built on Windows (do daily work on Android emulator); HealthKit + Apple Sign In need the paid Apple Developer Program ($99/yr) plus a real iPhone, so treat iOS as a Mac/cloud-CI task.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# iOS builds need a Mac; HealthKit needs a paid Apple account + real device

**Constraint (dev environment).** The iOS target exists and is configured — `apps/biotope/ios/` is present
with HealthKit wired (`Runner.entitlements` has `com.apple.developer.healthkit`; `Info.plist` has the
`NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` strings). But **iOS cannot be built
or run on Windows** — Apple's toolchain is macOS + Xcode only. On the Windows-native dev box, do all
day-to-day work on the **Android emulator**; treat iOS as a Mac / cloud-CI task (a Mac, or
macOS GitHub Actions / Codemagic runners).

**Costs that are real.**
- **Apple Developer Program — US$99/year** is required to provision the **HealthKit** entitlement, test
  on a **physical iPhone**, and ship to the App Store. HealthKit can't be exercised meaningfully in the
  iOS Simulator anyway, so testing Apple Health genuinely needs a Mac **+** an iPhone **+** the paid
  program.
- **Apple Sign In** (OAuth) also requires the paid program to create the credential.
- Free by contrast: all **Android** testing (incl. Health Connect, the M3 Android path), local
  Supabase, email/password auth, and Google OAuth credentials.

**How to apply.** This is why M3's "end-to-end wearable test on real device" stays pending on a
Windows-only setup. Related: HRV SDNN is iOS-only ([0004-hrv-sdnn-ios-only](0004-hrv-sdnn-ios-only.md)); wearable sync is
best-effort ([0006-wearable-sync-best-effort](0006-wearable-sync-best-effort.md)); local auth options ([0011-local-supabase-auth-email-only](0011-local-supabase-auth-email-only.md)).
