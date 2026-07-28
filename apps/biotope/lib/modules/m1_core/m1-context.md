# m1-context.md — M1: Core Platform & Compliance
> Module snapshot — session-by-session changes live in `docs/sessions/` (AGENTS.md §7).
> Owner: Jayden (Core & Compliance + database rules; see AGENTS.md §6)
> Phase 1 Stage 1 — MVP

---

## Purpose

Owns authentication, user profiles, granular consent management, PDPA safeguards,
and the app shell including navigation and non-diagnostic copy enforcement.
Provides the stable foundation all other modules build on — every session request
is authenticated through M1, and every user-facing string is governed by M1's copy rules.

Does NOT own: any health metric logic, any insight generation, any engagement rewards.

---

## Public Interface (what other modules may use)

```dart
// Auth
Future<AuthResult> signIn(email, password)
Future<AuthResult> signInWithGoogle()
Future<AuthResult> signInWithApple()
Future<void> signOut()
Future<UserIdentity?> getCurrentUser()
Future<bool> verifyToken(String token)

// Profile
Future<UserProfile> getProfile(String userId)
Future<void> updateProfile(String userId, ProfileUpdate update)

// Consent
Future<ConsentRecord> getConsent(String userId)
Future<void> updateConsent(String userId, ConsentUpdate update)
bool hasConsented(ConsentRecord consent, ConsentScope scope)

// Copy enforcement
bool validateCopyString(String text)       // returns false if diagnostic language detected
String getCopyRule(String ruleKey)          // returns approved phrasing by key
```

---

## Database Tables Owned

- `profiles` — user identity, region, city, device type, wearable toggle
- `consent_records` — granular consent per scope (gut, behaviour, community, wearable)

---

## Current State

| Feature | Status |
|---|---|
| Email auth (Supabase) | ✅ Done |
| Google OAuth | 🔨 Placeholders built |
| Apple Sign-In | 🔨 Placeholders built |
| Profile creation + onboarding | ✅ Done |
| Granular consent screen | ✅ Done |
| Non-diagnostic copy constants | ❌ Not started |
| App shell + navigation scaffold | ✅ AuthGate → consent → profile setup → AppShell tabs |
| PDPA consent copy (Singapore law) | 🔨 Basic consent UI done; legal copy review pending |

---

## Key Decisions Made

- **Supabase Auth** chosen for built-in RLS (Row Level Security) — all health tables
  enforce `user_id = auth.uid()` at DB level, not application level.
- **Granular consent scopes** defined at onboarding: `gut_tracking`, `behaviour_tracking`,
  `wearable_data` (future), `community_aggregation` (future). Each toggle independently.
- **Non-diagnostic language** enforced via a constants file, not ad-hoc. M5b must call
  `validateCopyString()` before persisting any InsightCard body text.
- **PDPA (Singapore)** requires: purpose disclosure, consent before data collection,
  right to withdraw. Consent record is immutable log — each change appends a new row.

---

## Consent Scopes

```dart
enum ConsentScope {
  gutTracking,        // M2 core self-report — required for app to function
  behaviourTracking,  // M2 extended fields (mosquito, food, antibiotics)
  wearableData,       // M3 — DEFINED BUT UNUSED: nothing reads it, and the
                      //   consent screen no longer records it (see below)
  communityData,      // M7 — future, recorded as granted:false at onboarding
}
```

**`wearableData` is not recorded and not enforced.** M3 wearable reading is live
(`WearableService.syncToday` → `wearable_daily`), gated only by the phone's own
health-data permission prompt. The consent screen used to append a
`granted: false` record for this scope while that sync ran, so the record stated the
opposite of the app's behaviour; it now records nothing for the scope and states the
real permission path instead. Giving `wearableData` a control that actually gates
`syncToday` is an open owner decision.

---

## Profile Schema (key fields)

```dart
class UserProfile {
  String userId;
  String displayName;
  String region;          // country name e.g. 'Singapore'
  String city;            // district/city string
  String? email;
  bool wearableOwned;     // toggle only — no integration in MVP
  DateTime createdAt;
  DateTime updatedAt;
}
```

---

## In Progress / Next Tasks

1. ~~Scaffold Flutter app with Supabase client init~~ (Done)
2. ~~Build auth screens (sign in / sign up)~~ (Done)
3. ~~Build consent screen UI with granular toggles~~ (Done)
4. ~~Build profile setup UI (name, country, city, wearable toggle)~~ (Done)
5. ~~Implement app shell navigation (home / log / insights / profile tabs)~~ (Done —
   `AppShell`; the temporary `[DEV]` HomeScreen placeholder has been deleted)
6. Create `shared/constants/copy_guidelines.dart` with all approved strings
7. Review and finalize PDPA consent copy before any release build — the consent screen
   now states plainly that consent choices cannot be changed in-app and that no in-app
   route exists for a data-access/deletion request. Both gaps need a real affordance.

---

## Watch Out / Known Issues

- Apple Sign-In requires paid Apple Developer account — confirm this is available before
  building that flow.
- PDPA consent copy should be reviewed by someone familiar with Singapore data law before
  shipping. Flag if legal review is needed.
- RLS policies on Supabase must be set up before M2 starts writing to any table.
  M1 owns all RLS policy definitions.

---

## Expansion Hints (Do Not Build)

- Phase 1 Stage 2: extend profile to capture device type (Apple/Android) and
  health permission status for wearable integration.
- Phase 1 Stage 3: update consent copy to explain how external open data
  (weather, outbreak) is combined with personal logs.
- Phase 2+: feature flags system — M1 is the right place to host this so
  AI sessions in other modules can check `isFeatureEnabled('cross_metric_insights')`.
