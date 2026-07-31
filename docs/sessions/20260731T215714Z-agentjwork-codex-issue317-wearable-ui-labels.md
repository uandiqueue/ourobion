# Issue #317 ? wearable metric UI labels

memory: none

## Attempted

- Read issue #317 and every comment, then followed the owner routing recorded on issue #308.
- Created and claimed the dedicated `fix/metrics/wearable-ui-labels` worktree, caught its stale
  local base before editing, and fast-forwarded it to verified `dev-phase2-run4` head `ad1750b8`.
- Ran the non-diagnostic copy gate, shared Dart/TypeScript analysis, metric-view contract tests,
  Flutter analysis, focused regressions, the full Biotope suite, and Run 4 release-gate tests.

## Changed

- Added registry labels for resting heart rate, HRV SDNN, sleep duration, blood oxygen, body
  temperature, and steps in the TypeScript and Dart mirrors.
- Made `ui.inputType` nullable in the TypeScript type, Zod schema, and Dart contract so sensor
  display metadata does not invent a self-report control.
- Extended the Flutter registry parser and parity guard to compare labels and input types across
  both language mirrors, with exact assertions for all six wearable entries.
- Updated M5a axis expectations and suppressed a case-insensitive duplicate label/unit so Steps
  renders as `Steps`, not `Steps (steps)`.

## Decided

- Kept `ui` non-null for these sensor metrics because the labels are display metadata, while using
  explicit `inputType: null` because no input control exists for passive wearable collection.
- Left metric units and numeric policies unchanged; the task changes names only, apart from the
  additive nullable contract required to represent display-only metadata honestly.
- Treated the owner-authorized product-snapshot literal refresh in
  `tools/run4_release_gate.test.mjs` as the sole exception to the normal tools-tree boundary.

## Left

- Exact final-head commands, hashes, product-union measurement, CI result, merge SHA, and issue
  closure are recorded on issue #317.
- Issue #222 remains the next queued owner task; issue #283 remains conditional on #222 landing.

## Blockers

- The required patch helper could not launch because `codex-windows-sandbox-setup.exe` is absent;
  explicit `git apply` unified diffs were used as the bounded fallback.

## Continuation ? generated deployment attestation

### Attempted

- Followed the owner's refined #317 guard after the first regeneration correctly stopped on two
  additional module-graph changes.
- Reused the already fresh Deno 2.8.1 graph set, then independently regenerated a second graph set
  for manifest verification.

### Changed

- Re-recorded only `supabase/deploy-attestation.json` with Supabase CLI 2.81.2.
- Updated the module-graph hashes for the three functions that import `shared/metrics`:
  `compute-baselines`, `generate-insights`, and `evaluate-signals`.

### Decided

- Carried the existing four 401 route probes forward byte-equivalently without re-probing. The
  registry change affects labels and nullable display metadata, not handler authorization behavior.
- `run-pipeline` stayed unchanged and does not import the registry. Config, lock, every entrypoint
  hash, every import-map hash, local-only scope, hosted-parity false, product-cap acceptance false,
  and the 115 / 8,500 caps also stayed unchanged.

### Verification

- `record-attestation` changed exactly the three authorized module graphs.
- `attest` against a second fresh Deno 2.8.1 graph directory: PASS.
- `git diff --check`: PASS.

### Left

- The earlier #222 next-task note is superseded by the owner's stop direction on #308; no #222
  source or migration remains.
- Commit and push the derived manifest, then require exact-head CI before merging PR #318.
