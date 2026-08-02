# Biotope auth and profile release hardening

memory: none

## Attempted

- Reproduced and separated the release authentication failures into immediate session routing,
  missing legacy profile rows, and localhost email-confirmation redirects.
- Coordinated three disjoint implementation reviews in parallel, then integrated and reviewed the
  resulting changes together before running any tests.
- Tried to validate migrations in a disposable PostgreSQL 17 container without resetting the
  existing local Supabase database.
- Installed the combined release APK and used physical-device acceptance to uncover two narrower
  session gaps: first sign-in for a fresh account and a cached session whose hosted user is deleted.

## Changed

- Made the root auth gate route directly from Supabase auth events, preserve restored sessions,
  handle sign-out, and expose recoverable auth/onboarding errors with retry actions.
- Added a direct session-backed password-sign-in handoff so the UI does not wait for GoTrue's later
  stream event, plus hosted-user validation before onboarding and after a real app resume.
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
- Require a real password session for sign-in success; treat hosted Auth 401/403/404 as definite
  invalidation while leaving transport/server failures retryable.
- Keep hosted redirect configuration as an explicit release step because application code cannot
  change the Supabase project's URL allowlist.

## Left

- Rebuild and install the auth follow-up, then repeat fresh-account first sign-in and deleted-user
  recovery on the attached Android phone.
- Configure and verify the hosted email redirect allowlist; already-sent localhost confirmation
  emails must be replaced with freshly generated links.
- Record the idempotent backfill in hosted migration history through a later normal `db push` when
  the Postgres wire path is available.

## Blockers

- Docker Desktop currently returns HTTP 500 from both local engine contexts; the Supabase Postgres
  port is not reachable. No local database was reset or modified.
- Hosted URL configuration requires the Supabase dashboard because the available CLI push would
  also apply unrelated local-auth defaults.

## Verification

- Focused Flutter tests: 110 passed.
- `flutter analyze --no-pub`: no issues.
- Full Flutter suite: 839 passed, 26 skipped.
- GitHub Actions: Flutter and PostgreSQL 17 shadow migration jobs passed with the rest of CI green.
- Guarded APK from `f8008f636823903f84db4157ca7e3ae62f8a7a42`: 91,012,212 bytes; SHA-256
  `a85e51becec42cd069e0c1ebd02313c745ad06d5aacf6365766b4c8254be6739`; hosted backend, release
  Internet permission, and APK Signature Scheme v2 verified.
- Existing-account physical sign-in left the sign-in page without relaunch; fresh-account
  acceptance then exposed the narrower async handoff gap fixed in the follow-up.
- Jayden's legacy user had no profile but its UI log persisted a hosted `daily_gut_rows` row for
  2026-08-03 at 50.00 completeness.
- Hosted backfill checked 4 auth users, inserted exactly 2 missing profiles, updated no existing
  profiles, and left 0 missing.
- Follow-up focused auth tests: 11 passed; analysis clean; full Flutter suite: 841 passed, 26 skipped.
