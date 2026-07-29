---
title: Run 4 Decisions and Signoff
summary: Current acceptance register for Run 4 integration, unit reconciliation, reviewers, provider posture, local exit gates, and cloud stop boundary.
type: decision-register
scope: run4
status: draft
updated: 2026-07-29
---

# Run 4 Decisions and Signoff

| ID | Decision | State / evidence still required |
|---|---|---|
| BRANCH | `dev-phase2-run4` is the only integration target; never `dev-phase2` or `main` | accepted |
| AUTONOMY | Local work and green, independently reviewed merges into `dev-phase2-run4` may proceed without repeated approval | accepted; red/duplicate/stale PRs remain prohibited |
| P1 | Branch may remain unprotected; `Run 4 Gate` is required exact-head evidence, not branch protection | accepted override |
| CAP | Locked core units use 115 paths / 8,500 additions from exact per-unit base | accepted; checked-in base drift must be reconciled before next landing |
| UI CAP | Do not trim canonical full UI merely to fit the original product-unit cap | accepted unit exception; machine envelope/gate still needs explicit reconciliation, never silent bypass |
| P2 | Jayden + Alton are named reviewers for Run 4 shared changes | satisfied; actual PR reviews required |
| P3 | No model training or serving in Run 4 | accepted; historical bundles remain separate/non-serving |
| P5 | Local-only; physical Android and disposable local Supabase reset authorized | accepted |
| P6 | General O29 remains deferred | accepted; bounded issue-189 provider test is complete, not a general unblock |
| U0 | PR #161 merged; base convention #172 merged | delivery merged; status/gate-base reconciliation current session |
| U1 | #180 remediates #170 | one canonical green reconciled PR required; do not land #170 alone |
| U2 | #177 merged; #185/#186 corrections open | combine, rerun 443 auth assertions and current gate |
| U3 | #184 built/open | reconcile unit base, LoaderPanel target, full HTTP 14 + 7-day walk, then current green gate |
| U4 | Scientific semantics/trust | startable after reconciliation; two reviewers; no accepted implementation yet |
| U5 | #176 built/open; #190 evidence stacked | rebase after U3/U4; preserve B-PL22 and one-paper hold honesty |
| U7/UI | #191 is canonical and contains #175 | land only reconciled #191 after shared/U2/Flutter/device evidence |
| EXIT | Both local passes plus final full suite before cloud consideration | pending |
| CLOUD | Hosted writes/deploy/promotion remain outside authorization | stopped by design |

## D-241-NUL-SOURCE-NORMALIZATION

**Choice:** retain the verification dedupe key's runtime NUL separator while representing it in
`artifact.ts` as the ASCII source escape `\0` rather than a raw `0x00` byte.

**Alternatives rejected:** allowing a binary TypeScript source file, which makes ordinary diff and
release-cap tooling treat the file as unparsable; and changing the delimiter semantics, which would
change the existing `(edgeId, verifiedAt)` identity.

**Why:** the escaped literal evaluates to the same NUL character, preserving the loader identity and
raw-retention dedupe behavior while restoring textual source/diff compatibility. A regression test
pins both the runtime character code and the absence of raw NUL bytes in the source file.

## D-241-SOURCE-TEXT-NUMSTAT-RECOVERY

**Choice:** recover a `-\t-\tpath` numstat row only when the current head contains that exact
supported source path as a NUL-free, fatally-valid UTF-8 blob and one path-scoped zero-context
`git diff --text` patch has exact headers, hunks, and line counts.

**Alternatives rejected:** applying `--text` globally, relying on Git attributes, accepting binary
rows by extension alone, or relaxing rename/copy, path-set, MT4, and cap checks.

**Why:** a historical binary base can make Git classify an otherwise textual current source change
as binary even under numstat text mode. This recovery counts only additions proven by the
independently parsed patch; missing, deleted, non-UTF-8, NUL-bearing, ambiguous, mismatched, or
non-source rows remain fail-closed.

**Amendment — adversarial hardening:** recovery now consumes raw patch bytes, validates a safe
repo-relative ASCII path and exact single-file headers, and rejects binary markers, context,
no-newline markers, rename/copy material, malformed or count-mismatched hunks. A raw NUL is
allowed only in a removed historical line; added lines must be NUL-free fatal UTF-8.

**Second amendment — final review correction:** every hunk header is now rejected before parsing
when it contains a raw NUL, closing the optional-suffix regex path while preserving the sole
removed-body exception. The release suite now executes the complete positive and adversarial matrix,
including both landing and product-cap wiring; the earlier one-positive/two-negative test did not
substantiate the prior session's broader coverage claim.

## Historical provenance

The original envelope/bootstrap SHA remains
`854aa471970b61afdc59205ded0b1c8a9ab3f270`. Earlier U0 bases
`837b7e690f92dc1669428a2476c9d8d0456020e8` and
`77c98213e23ad56ae37c86201b39ef4e7543a543` remain historical evidence. PR #172 advanced the
machine base to `c558c04f1b661a59c8987c96770768eeea46e0cc`; integration later advanced through U2 merge
`ad8ef178053c7e6514283f19ee7a4f3f0829dc0c`. Do not call any historical base the active next-unit
base without checking the current machine files and integration tip.

## Signoff rule

`merged` is delivery state, not final signoff. `done` requires current integration ancestry, required
checks on the actual head, independent review, applicable human reviews, executed acceptance evidence,
and reconciled tracking. The authoritative working disposition is
[`continuation-status.md`](./continuation-status.md).

## D-229-REVIEW-DEVIATION — owner-authorized shared-metric review interpretation

**Choice.** Count Alton/`altogennn`'s explicit `approve` intent in the GitHub review submitted as
`COMMENTED`, alongside uandiqueue's formal `APPROVED` review, for PR #229's shared-metrics change.
The review permalink is
https://github.com/uandiqueue/ourobion/pull/229#pullrequestreview-4798922803. `COMMENTED` is not a
formal GitHub approval. This is a documented, owner-authorized deviation from
[`docs/memory/0002-shared-contract-two-reviewers.md`](../../memory/0002-shared-contract-two-reviewers.md),
not a reinterpretation of that rule.

**Alternatives rejected.** Require Alton to submit a second formal `APPROVED` review before any
progress on #229; rejected because the owner explicitly chose to accept the unambiguous review intent
while recording the exception. Treat `COMMENTED` as equivalent to `APPROVED` generally; rejected
because GitHub distinguishes the states and the two-review rule remains the normal requirement.

**Why.** The owner made a specific, auditable exception for this PR. Recording the state difference
and its authorization preserves both the shared-contract safeguard and an accurate signoff record.

## D-215-ISSUE-RETENTION — follow-on work keeps the issue live

**Choice.** Keep issue #215 open. PR #216 is merged, but #215 remains the live tracker for the
pending private-R2 upload/pointer replacement and licence-blocked distribution. This corrects the
stale resume instruction that implied #215 should be closed; its deliberate retention is recorded at
https://github.com/uandiqueue/ourobion/issues/215#issuecomment-5111946241.

**Alternatives rejected.** Close #215 because #216 merged; rejected because the merged PR did not
complete the private-R2 upload/pointer replacement or resolve the distribution licence block. Leave
the stale handoff uncorrected; rejected because it risks prematurely closing live follow-on work.

**Why.** Issue state must describe remaining work, not merely the merge state of one delivery PR.

## D-231-PRODUCT-BINARY-ACCOUNTING — narrow binary accounting applies to the product union

**Choice.** Apply the same exact identity-kit allowlist and the existing 24-path / 2,000,000-byte
caps to binary rows in the immutable product-union measurement. Allowlisted binaries remain changed
paths, contribute zero added lines, and are reported with path and byte totals; deleted allowlisted
paths measure zero bytes, while every other blob must be measured at the immutable head.

**Alternatives rejected.** Accept binary rows generally; rejected because it would make arbitrary
compiled or unreviewable content invisible to the line budget. Reject every binary row in the
product union; rejected because it makes the explicitly approved Nao identity assets structurally
unmeasurable even though the narrower landing gate already accounts for them under fixed caps.

**Why.** The product union and per-unit landing are two views of the same changed paths. Reusing the
same reviewed allowlist and caps keeps their accounting consistent without widening accepted paths:
non-allowlisted, over-cap, or unmeasurable binary content still fails closed.
