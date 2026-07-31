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

## Continuation — rollback fixture privilege remediation

### Attempted

- Reviewed the latest hosted rollback failure: the wellbeing fixture reached `set local role
  authenticated` but its first owner-row insert was denied before RLS policy evaluation.
- Kept the change isolated to the disposable CI postgres service; no product migration, policy,
  or shared-host database action was changed.

### Changed

- Added a post-baseline runner-only grant step for the existing authenticated role: schema usage,
  daily-gut select/insert, daily-gut identity-sequence usage, and select-only access to the
  metric-view projection and its RLS-protected source relations.
- The authenticated role remains NOLOGIN and without BYPASSRLS. Existing `auth.uid()` policies
  remain the authority for own-row allow/other-row denial, so the fixture now reaches the policy
  assertions it was written to prove.
- Extended the static contract to pin the grant scope and forbid RLS disable/BYPASSRLS wording.

### Decided

- The root cause is a deliberate gap in the vanilla `ci/migrations-bootstrap.sql`: it creates the
  Supabase-shaped role and policy expressions but intentionally grants no public product-table
  privileges. PostgreSQL rejects table access before applying RLS; granting only the fixture's
  required operations restores the intended RLS test semantics without changing product schema.

### Left

- Let the next hosted evidence run execute the rollback fixtures with the runner-only grants.

### Blockers

- None locally. The resulting transactional proof remains pending its next hosted execution.

memory: none

## Continuation — per-unit landing base advance

### Attempted

- Audited the hosted release-gate failure against the prior `6020f444` unit boundary: it measured
  cumulative integration history rather than only the #221 landing.

### Changed

- Advanced `RUN4_UNIT_BASE_SHA` and the parsed CI workflow environment to the exact current
  dev-phase2-run4 integration parent `42ae771c4809fe8f314fbf38dca89d60a809dedb`.
- Added a release-gate test that pins that approved unit base.

### Decided

- Retain the accepted 115-path / 8,500-added-line caps. The evidence work was 23 paths / 1,602
  additions against the new parent; including this three-path base-advance remediation, the complete
  branch working-tree delta is 26 paths / 1,694 additions. Do not remove accepted paths merely to
  compensate for unrelated, already-integrated history.

### Left

- Re-record `supabase/deploy-attestation.json` with the existing attestation generator after fresh
  hosted graph recomputation and route probes. The checked-in derived manifest intentionally remains
  unchanged and stale to this newly advanced base until that evidence exists.

### Blockers

- None locally. Hosted regeneration is still required before the final release-gate attestation can
  validate the new provenance.

memory: none

## Continuation — metric fixture dependency remediation

### Attempted

- Reviewed the completed hosted rollback job: the wellbeing fixture passed with the runner-only RLS
  grants, while the metric projection fixture failed before SQL execution because
  `tools/metric-view/lib/view.mjs` could not resolve its `tsx` package.

### Changed

- Added pinned Node 20 setup with npm cache and a repository-root `npm ci` before either rollback
  fixture. This supplies the lockfile-pinned `tsx` dependency in the isolated GitHub runner only.
- Extended the static workflow contract to require that setup and installation precede both fixture
  commands.

### Decided

- Do not add database grants or alter product schema/policies: the hosted wellbeing pass confirms
  the prior RLS remediation. The remaining failure is solely a missing repository-local Node tool.

### Left

- Re-run the hosted rollback evidence and then regenerate derived attestation evidence after fresh
  graphs and route probes.

### Blockers

- None locally. Dependency installation is deliberately hosted-only for this disposable runner.

memory: none

## Continuation — metric-view package ownership correction

### Attempted

- Reviewed the next hosted rollback log after root `npm ci`: the metric fixture still failed to
  resolve `tsx`, confirming the tool is not owned by the root package.
- Compared the fixture import with the existing node-tools CI matrix and the metric-view package
  manifest/lockfile.

### Changed

- Replaced the root installation with the exact package-local `npm ci` in `tools/metric-view`, and
  bound the setup-node npm cache to `tools/metric-view/package-lock.json`.
- Tightened the static contract to require the metric-view lockfile, working directory, and install
  before both rollback fixtures.

### Decided

- `tsx` is a lockfile-pinned dependency of `tools/metric-view`; use its existing CI package boundary.
  Do not add a global/ad-hoc install, database grant, or product code change.

### Left

- Re-run the hosted rollback evidence, then regenerate derived attestation evidence after fresh
  graphs and route probes.

### Blockers

- None locally. Package installation remains deliberately hosted-only for this disposable runner.

memory: none

## Continuation — metric-view runtime contract alignment

### Attempted

- Reviewed the next hosted rollback log after the package-local install: dependency installation and
  the wellbeing fixture passed, but the metric fixture hit Node 20 `ERR_REQUIRE_CYCLE_MODULE` while
  `tsx` imported the shared metrics registry.
- Compared that route with the existing passing node-tools metric-view CI job.

### Changed

- Aligned the disposable rollback runner with the existing metric-view runtime contract: Node 26,
  npm caching for both `shared` and `tools/metric-view` lockfiles, then `npm ci` in `shared` before
  the package-local metric-view install.
- Extended the static contract to pin Node version, both lockfiles, and the shared-before-metric
  installation ordering.

### Decided

- Keep the existing fixture and loader code unchanged. The shared TypeScript registry import is
  already covered by the passing node-tools contract; this runner must reproduce that environment.

### Left

- Re-run the hosted rollback evidence, then regenerate derived attestation evidence after fresh
  graphs and route probes.

### Blockers

- None locally. These package installs intentionally remain hosted-only for the disposable runner.

memory: none

## Continuation — final hosted evidence and generated attestation

### Attempted

- Ran the supplemental workflow at the exact synthetic merge of integration parent `42ae771c` and
  branch head `4fdec599` (`f547ccdc`). Both transactional fixtures passed and rolled back; the four
  configured handlers each reached the local function runtime and returned the expected normalized
  unauthenticated denial.
- Downloaded the one-day evidence artifact and independently recomputed every SHA-256 sidecar.
- Generated two distinct frozen Deno 2.8.1 graph sets on Windows from the same source and lockfile.

### Changed

- Re-recorded `supabase/deploy-attestation.json` with the repository generator, the first independent
  Windows graph set, the pinned Supabase CLI 2.81.2, and checksum-verified route evidence.
- Recorded the exact whole-product snapshot as `461` paths / `64,536` additions; the release-gate
  test keeps that over-cap measurement explicit and non-gating.

### Decided

- The Windows-generated manifest is byte-for-byte identical to the hosted generator output
  (`d2daa2c7b1aa4d19bd37a6c8178784959d5a09814da5c49af80c406f40c25b30`). The second fresh
  Windows graph directory passed `run4_release_gate.mjs attest`.
- Keep `productCapAcceptanceClaimed: false` and `hostedDeployParityClaimed: false`. The owner-approved
  Run 4 product-envelope deviation is recorded honestly; it does not change the strict 115-path /
  8,500-addition per-unit gate or claim hosted deploy parity.

### Left

- Let exact-head CI recompute the final product snapshot, attestation graphs, full code suites, and
  aggregate Run 4 gate before merge.

### Blockers

- None.

memory: none
