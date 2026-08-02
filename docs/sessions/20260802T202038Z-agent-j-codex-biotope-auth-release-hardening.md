# Biotope auth and profile release hardening

memory: none

## Attempted

- Reproduced and separated the release authentication failures into immediate session routing,
  missing legacy profile rows, and localhost email-confirmation redirects.
- Coordinated three disjoint implementation reviews in parallel, then integrated and reviewed the
  resulting changes together before running any tests.
- Tried to validate migrations in a disposable PostgreSQL 17 container without resetting the
  existing local Supabase database.

## Changed

- Made the root auth gate route directly from Supabase auth events, preserve restored sessions,
  handle sign-out, and expose recoverable auth/onboarding errors with retry actions.
- Added a package-owned Android callback for email confirmation and passed it explicitly during
  sign-up, with confirmation-aware success copy.
- Made daily logging tolerate a genuinely absent profile while preserving real profile-fetch
  errors, and added an idempotent migration that backfills only missing legacy profile rows.
- Added focused regression coverage for auth transitions, callback wiring, missing-profile logging,
  and backend-error propagation.

## Decided

- Keep existing profile rows byte-for-byte untouched during the backfill; insert only missing rows.
- Treat auth events as authoritative instead of rereading the global session inside a stream
  builder.
- Keep hosted redirect configuration as an explicit release step because application code cannot
  change the Supabase project's URL allowlist.

## Left

- Validate the migration once the local Docker Linux engine is healthy or through the PR migration
  job, then apply it to the hosted demo project.
- Build, install, and verify the combined APK on the attached Android phone, including immediate
  sign-in transition and a synthetic daily log on the authorised test account.
- Configure and verify the hosted email redirect allowlist, publish the branch, and complete the
  linked issues after physical-device acceptance.

## Blockers

- Docker Desktop currently returns HTTP 500 from both local engine contexts; the Supabase Postgres
  port is not reachable. No local database was reset or modified.

## Verification

- Focused Flutter tests: 110 passed.
- `flutter analyze --no-pub`: no issues.
- Full Flutter suite: 839 passed, 26 skipped.
