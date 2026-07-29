---
title: Run 4 PR 231 Nao design secret fingerprint correction
summary: Refreshed one current-tree gitleaks fingerprint after the Nao design document moved, without changing scanner policy or historical suppression evidence.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 PR 231 Nao design secret fingerprint correction

PR: #231 · branch: `feat/nao-ui/nao-identity`

## Attempted

- Apply the user's explicitly approved focused correction for the failing
  `Secret scan & client-surface leak guard` check on exact PR head
  `22da6c4377e887a7a0edd8fed68f4007f76086ce`.
- Reproduce the repository's pinned gitleaks policy, clean worktree scan, report verification, and
  guard tests before pushing.
- An initial direct `dir .` run in the developer worktree traversed ignored local dependencies:
  182.96 MB and 43 local-artifact findings versus CI's approximately 8.63 MB. That was rejected as
  an invalid parity harness; none of those dependency findings was inspected, waived, or added to
  policy. Validation was restarted in a detached clean worktree at the exact PR head.

## Changed

- Updated only the authored current-tree fingerprint for the illustrative Nao design placeholder:
  `docs/nao/nao-app-design.md:generic-api-key:198` became
  `docs/nao/nao-app-design.md:generic-api-key:224`.
- Preserved the entry's rule, path, approval, justification, and dates byte-for-byte.
- Preserved the historical commit-qualified
  `1a69650eda51a6521c9da35785ca6b029c2479ce:docs/nao/nao-app-design.md:generic-api-key:198`
  entry byte-for-byte.

## Decided

- This is fingerprint maintenance after surrounding prose moved the approved placeholder from line
  198 to line 224. Scanner rules, allowlisted paths, expiry, and approval scope remain unchanged.

## Left

- PR #231 remains open for GitHub Actions to evaluate the new immutable head. This session does not
  merge or manually retry it.

## Blockers

- None.

## Verification

- Node v26.5.0.
- Pinned gitleaks tarball:
  `gitleaks_8.30.1_linux_x64.tar.gz`, SHA256
  `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`;
  extracted binary identity verified as 8.30.1.
- Policy validation: 9/9 entries valid and emitted to a temporary ignore file; the authored
  current-tree entry emitted with line 224 and the historical commit-qualified entry remained at
  line 198.
- Exact CI `gitleaks dir .` command in a fresh detached tree at
  `22da6c4377e887a7a0edd8fed68f4007f76086ce`, overlaid with only these two intended files:
  8,627,279 bytes (8.63 MB) scanned, 0 findings.
- `verify-report --scope worktree`: passed with 0 findings and both required sentinels.
- `node --test tools/secret_scan_guard.test.mjs`: 111/111 passed.
- `node tools/context_sync.mjs --check`: passed.
- `git diff --check`: passed; the real worktree contained only the allowlist edit and this new
  session log.

memory: none
