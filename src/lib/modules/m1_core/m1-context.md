# m1-context.md — M1: Core Platform & Compliance
> Updated at end of every AI session.
> Owner: [ASSIGN]
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
| Email auth (Supabase) | ❌ Not started |
| Google OAuth | ❌ Not started |
| Apple Sign-In | ❌ Not started |
| Profile creation + onboarding | ❌ Not started |
| Granular consent screen | ❌ Not started |
| Non-diagnostic copy constants | ❌ Not started |
| App shell + navigation scaffold | ❌ Not started |
| PDPA consent copy (MY law) | ❌ Not started |

---

## Key Decisions Made

- **Supabase Auth** chosen for built-in RLS (Row Level Security) — all health tables
  enforce `user_id = auth.uid()` at DB level, not application level.
- **Granular consent scopes** defined at onboarding: `gut_tracking`, `behaviour_tracking`,
  `wearable_data` (future), `community_aggregation` (future). Each toggle independently.
- **Non-diagnostic language** enforced via a constants file, not ad-hoc. M5b must call
  `validateCopyString()` before persisting any InsightCard body text.
- **PDPA (Malaysia)** requires: purpose disclosure, consent before data collection,
  right to withdraw. Consent record is immutable log — each change appends a new row.

---

## Consent Scopes

```dart
enum ConsentScope {
  gutTracking,        // M2 core self-report — required for app to function
  behaviourTracking,  // M2 extended fields (mosquito, food, antibiotics)
  wearableData,       // M3 — future, shown greyed out in MVP with "coming soon"
  communityData,      // M7 — future, not shown in MVP UI
}
```

---

## Profile Schema (key fields)

```dart
class UserProfile {
  String userId;
  String displayName;
  String region;          // MY state code e.g. 'MY-14' (Kuala Lumpur)
  String city;            // district/city string
  String? email;
  bool wearableOwned;     // toggle only — no integration in MVP
  DateTime createdAt;
  DateTime updatedAt;
}
```

---

## In Progress / Next Tasks

1. Scaffold Flutter app with Supabase client init
2. Build auth screens (sign in / sign up / onboarding flow)
3. Build consent screen with granular toggles + PDPA copy
4. Build profile setup (name, region, city, wearable toggle)
5. Implement app shell navigation (home / log / insights / profile tabs)
6. Create `shared/constants/copy_guidelines.dart` with all approved strings

---

## Watch Out / Known Issues

- Apple Sign-In requires paid Apple Developer account — confirm this is available before
  building that flow.
- PDPA consent copy should be reviewed by someone familiar with Malaysian data law before
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