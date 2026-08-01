---
title: Run 4 PR 231 Nao identity reconciliation
summary: Reconciled the Nao identity branch with the current Run 4 integration tip, preserved the hardened release gate, and extended its narrow binary accounting to the immutable product-union measurement.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 PR 231 Nao identity reconciliation

PR: #231 · branch: `feat/nao-ui/nao-identity` · base: `dev-phase2-run4`

## Attempted

- Merge exact integration tip `04e9b61faa73d45581cbde4d347d37a57889cc1a` normally into exact
  branch head `aa677cc4cde7c26151cb11bc4382bbfd1748cea2`, without rebasing,
  cherry-picking, squashing, or weakening the Run 4 release boundary.
- Preserve every current integration/stage-3 release-gate invariant while retaining #231's narrow
  binary exception for the Nao identity kit.
- Re-run the release, product-cap, runtime-attestation, and Nao gates on the reconciled tree.

## Changed

- The normal merge auto-resolved `docs/temp/run4/pending-build-register.md` and
  `tools/run4_release_gate.mjs`; a separate read-only review approved both results unchanged.
- Resolved the only textual conflict, `tools/run4_release_gate.test.mjs`, as an exact union:
  all integration MT4/product-cap, frozen-workflow, exact-12-job, architecture, and secret-scan
  tests remain; the complete #231 allowlisted-binary test and its 24-path / 2,000,000-byte imports
  remain.
- Extended `productLandingDelta` to account for the same exact allowlisted binaries as the
  per-unit landing gate. Binary paths still count as changed paths and add zero lines; non-deleted
  blobs are measured at the immutable head; deletions measure zero bytes; non-allowlisted,
  unmeasurable, over-path-cap, and over-byte-cap inputs fail closed.
- Added real-git-delegating synthetic negative tests for each of those product-union failure modes
  and exposed auditable `allowlistedBinaryPaths` / `allowlistedBinaryBytes` totals.

## Decided

- Added `D-231-PRODUCT-BINARY-ACCOUNTING` to
  `docs/temp/run4/decisions-signoff.md`: the immutable product union reuses the already-reviewed
  exact allowlist and fixed caps. Neither blanket binary acceptance nor blanket binary rejection
  is an honest measurement of the approved identity assets.

## Left

- PR #231 remains open for the orchestrator; this session does not merge it into
  `dev-phase2-run4`.
- Product-cap measurement remains record-only by design. On the reconciled pre-commit tree it
  reports 205 paths / 23,897 added lines, 28 exact MT4 exclusions, and 15 allowlisted binary paths /
  837,194 bytes, so `withinCap` is honestly false.

## Blockers

- None.

## Verification

- Node v26.5.0.
- `node --test tools/run4_release_gate.test.mjs`: 14/14 passed.
- `node tools/run4_release_gate.mjs product-cap`: completed with the record-only result above.
- `node tools/run4_release_gate.mjs config`: passed.
- Fresh frozen module graphs in `/tmp/run4-231-graphs.79b2TE` with Deno 2.8.1, followed by
  `attest` with repository-local Supabase CLI 2.81.2: passed.
- `npm run typecheck` in `apps/nao`: clean.
- `npm test` in `apps/nao`: 245 total, 244 passed, 0 failed, 1 skipped.
- `node tools/context_sync.mjs --check`: passed.
- `git diff --check` and `git diff --cached --check`: passed; no unstaged, unmerged, or untracked
  churn remained before the merge commit.

memory: none
