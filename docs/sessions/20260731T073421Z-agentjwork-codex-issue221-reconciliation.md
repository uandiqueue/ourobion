---
title: Issue 221 Run 4 base reconciliation
summary: Rebased the U6b wellbeing batch work onto the current Run 4 tip and retained the five-field ordinal rejection fixture coverage.
type: session
scope: m2
status: canonical
updated: 2026-07-31
---

# Issue 221 Run 4 base reconciliation

Issue: #221 · branch: `feat/m2/run4-u6b-batch1-reconcile-221` · base:
`a5d5953b4f6741ca0915a1cf56ef1328046e7f32` (`dev-phase2-run4`)

## Attempted

- Safely removed a redundant in-progress merge whose former `MERGE_HEAD` was already contained in the current Run 4 integration tip.
- Preserved the intended local fixture correction before reconciliation and merged only the verified current `origin/dev-phase2-run4` tip.

## Changed

- Retained the wellbeing local schema fixture proof that every one of the five optional ordinal metrics rejects both `0` and `6`.
- Added `rejected_rows=0` to the fixture's expected output so rejected inserts are explicitly asserted not to persist.

## Decided

- The correction remains fixture-only: it does not alter migrations, product runtime behaviour, or data contracts.
- Runtime database execution remains deferred; this reconciliation used only source, index, and diff checks.

## Verification

- Fetched only `origin/dev-phase2-run4`; both `FETCH_HEAD` and `origin/dev-phase2-run4` resolved to `a5d5953b4f6741ca0915a1cf56ef1328046e7f32`.
- Normal merge completed with no conflicts.
- The saved pre-abort and post-merge binary patches were byte-identical (SHA-256 `A7E37ADD1ED300871BF3825AFE8F81BBA2B0F60D358574B5B9BCBC111F94C4AE`).
- `git diff --check` passed. No Docker, Supabase, Edge Functions, heavy tests, provider calls, push, or hosted mutation occurred.

## Left

- Run the transactional wellbeing fixtures when an isolated local Supabase environment is safely available.
- Complete the remaining #221 wellbeing batches, review, and merge evidence separately.

## Blockers

- None for this fixture-only reconciliation.

memory: none

## Continuation — remote evidence fallback

### Attempted

- Kept the local Docker/Supabase execution deferral intact: the shared host must not create,
  reset, or remove containers for this session.
- Added a narrow, path-scoped GitHub Actions evidence workflow for the unresolved #221 rollback
  fixtures and local four-function attestation evidence.

### Changed

- Added `.github/workflows/run4-u6b-evidence.yml` with a static contract job plus two
  supplemental, no-secret Ubuntu evidence jobs. The rollback job aliases its isolated postgres:17
  service container to `supabase_db_ourobion`, applies only the migration baseline through
  `20260730020000` and runs the unchanged transactional wellbeing and metric-view fixtures.
- The attestation job checks out the event SHA, uses Node 20/Deno 2.8.1/repository-local CLI,
  probes only the four localhost function routes with unauthenticated `{}`, requires the recorded
  401 response hash, generates an attestation into runner temp, validates it with a separate fresh
  graph directory, and uploads a one-day redacted artifact. It retains a hash of the serve log,
  never the raw log; success explicitly stops the server, restores the checked-in manifest, clears
  its trap, and removes the backup.
- Added a static workflow-contract test that pins the migration boundary, container alias, exact
  route set/hash, generator call, separate graph directories, cleanup/redaction ordering, short
  retention, and absence from the frozen aggregate.

### Decided

- This is remote CI evidence only. It neither deploys nor contacts a hosted Supabase URL, uses
  secrets, providers, R2, or a product database, and does not claim hosted deploy parity.
- The generated manifest preserves the existing replay boundary verbatim. It is copied to the
  canonical runner-local location only because the existing verifier has no `--manifest-path`;
  failure cleanup conditionally restores the checked-in manifest.
- The new jobs are supplemental evidence and deliberately are not added to the frozen Run 4
  required-job/aggregate set.

### Left

- Let GitHub Actions execute the remote evidence after review; no local Docker/Supabase execution
  was attempted on the shared host.

### Blockers

- None. Local host execution remains deliberately deferred for shared-container safety.

memory: none

## Continuation — hosted evidence remediation

### Attempted

- Reviewed hosted workflow run `30615883769` after the supplemental workflow contract job passed.
- Kept the remediation runner-only; no shared-host Docker or Supabase process was started.

### Changed

- Changed both unchanged rollback fixture seeds to the portable `auth.users (id, email)` form.
  The baseline bootstrap intentionally supplies only those columns; all assertion and transaction
  rollback behaviour remains unchanged.
- Before the required local function serve command, the attestation job now starts only the
  runner-local postgres and Kong services. It excludes gotrue, realtime, storage-api, imgproxy,
  mailpit, postgrest, postgres-meta, studio, edge-runtime, logflare, vector, and supavisor.
- Added a 120-second fail-closed readiness loop that detects an exited serve process and accepts
  only a local 401 route response. Cleanup stops the runner-local stack with `--no-backup`.
- Successful artifacts retain only SHA-256 files for start, serve, and stop logs, then delete the
  raw logs. Failure prints only sanitized short log tails with JWT-shaped and key/value secret
  forms redacted; raw logs are never uploaded.
- Extended the static workflow contract to pin the portable fixture seeds, minimum exclusions,
  cleanup, readiness failure, and log-deletion safeguards.

### Decided

- The hosted run exposed setup constraints, not proof gaps: it did not bind the local listener and
  its bootstrap auth schema has a deliberately minimal row shape. This remediation does not claim
  a successful replay until a later hosted run passes.

### Left

- Allow a subsequent GitHub Actions run to execute the runner-only remediation and assess its
  generated artifact.

### Blockers

- None locally. Hosted image-pull and function-runtime behaviour remains to be observed remotely.

memory: none
