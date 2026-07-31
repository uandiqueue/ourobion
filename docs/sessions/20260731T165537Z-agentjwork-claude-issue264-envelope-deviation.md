---
title: Issue 264 product-envelope deviation record + #222/#283/#275 deferrals
summary: Wrote the owner-approved Run 4 product-envelope deviation record for issue #264 and an explicit deferral record for #222, #283, and #275, without touching code, tests, workflows, or config.
type: session
scope: run4
status: canonical
updated: 2026-08-01
---

# Issue 264 product-envelope deviation record + #222/#283/#275 deferrals

Issue: #264 (deliverable 1) plus #222/#283/#275 (deliverable 2) · branch:
`docs/run4/envelope-deviation-264` · base: `d880ed04091f8aa920294eb70db4a20263ddae4e`
(`origin/dev-phase2-run4`, the PR #270 merge)

This was a docs-only session in its own worktree at `C:\tmp\ourobion-docs-264`, isolated from other
concurrent sessions on `dev-phase2-run4`. No code, test, workflow, or config file was changed.

## Attempted

- Read [issue #264](https://github.com/uandiqueue/ourobion/issues/264) and matched its required
  posture exactly: record the deviation, do not change the cap, do not claim the product cap passed,
  do not authorize promotion.
- Read [issue #222](https://github.com/uandiqueue/ourobion/issues/222),
  [issue #283](https://github.com/uandiqueue/ourobion/issues/283),
  [issue #275](https://github.com/uandiqueue/ourobion/issues/275), and
  [issue/PR #290](https://github.com/uandiqueue/ourobion/issues/290) to confirm the current deferral
  reasons and the base-advance context, rather than inventing them.
- Read `docs/temp/run4/README.md`, `decisions-signoff.md`, `unit-signoff-index.md`,
  `pending-build-register.md`, `run-envelope.json`, `supabase/deploy-attestation.json`, and
  `tools/run4_release_gate.mjs` (comments and constants only) to match house style, front-matter
  shape, and to confirm the existing product-cap accounting (`RUN4_PRODUCT_BASE_SHA`, the 28-path
  MT4 exclusion, the binary allowlist, `productCapAcceptanceClaimed: false`) before writing about it.

## Changed

- Added `docs/temp/run4/product-envelope-deviation-264.md`: records the owner decision (2026-07-30),
  the two given product-union measurements (511 paths / 71,762 added lines at the PR #270 merge
  `d880ed04091f8aa920294eb70db4a20263ddae4e`; 512 paths / 71,839 added lines at the #290 base-advance
  commit), the unchanged 115/8,500 per-unit cap, and the required non-conflation statements from the
  issue (per-unit pass ≠ product-cap pass; cap did not pass and is not raised; no landed functionality
  trimmed; promotion stays deferred/owner-only; `main` untouched; `productCapAcceptanceClaimed` stays
  `false`).
- Added `docs/temp/run4/run4-deferrals.md`: records #222 (gated on the unbuilt A4-1 → A4-2 → A4-3
  chain; ADR-0004 accepted the policy, implementation slices never built), #283 (deferred by explicit
  owner instruction 2026-07-31, blocked behind #222's full completion; no branch/build/deploy/DNS
  change made), and #275 (unstarted; brain synthesis/verification remain CLI-only in
  `tools/brain-ingest`) as explicit "not done and why" records, each with a concrete list of what was
  and was not done.
- Added two pointer rows to the document table in `docs/temp/run4/README.md` for the two new files.
  No other line in that file was touched.

## Decided

- Neither new document reinterprets, edits, or supersedes any existing accepted row in
  `decisions-signoff.md` or `unit-signoff-index.md` — they are additive records that cross-reference
  those files instead of duplicating or restating their content.
- The two product-union measurements are reported as point-in-time evidence at two named heads, not
  averaged, rounded up to look better, or presented as if they were the same policy; the arithmetic
  deltas against the 115/8,500 cap (396/63,262 and 397/63,339 respectively) are simple subtraction
  from the given figures, not a re-derivation of the underlying `git`/attestation measurement.
- The binary-allowlist/MT4-exclusion detail (28 paths, 15 allowlisted binary paths, 837,194 bytes)
  is recorded only for the PR #270 measurement, where it was explicitly given; it is not assumed
  identical at the #290 head in the document text, since that would be an invented rather than a
  measured fact.
- `supabase/deploy-attestation.json` was read but not edited: it is a generated artifact
  (`tools/run4_release_gate.mjs record-attestation`), and it already carries
  `productCapAcceptanceClaimed: false`, consistent with the required posture. This session's job was
  to explain that flag in a durable doc, not to regenerate or alter the artifact itself.
- #222/#283/#275 are recorded strictly as "not delivered, here is why" — no partial-completion or
  near-term-completion claim was added for any of the three, since none has landed evidence in Run 4.

## Left

- The actual promotion decision from `dev-phase2-run4` to `dev-phase2` remains fully deferred and
  owner-only; this session did not touch that boundary and made no PR.
- A4-1/A4-2/A4-3 (blocking #222), the biotope-web build/deploy for #283, and the nao operator surface
  for #275 remain entirely unbuilt; nothing in this session moves any of them forward technically.
- `node tools/context_sync.mjs --fix-index` was not run because this session added no
  `docs/memory/` or `docs/shared/decisions/` entries for `--fix-index` to regenerate; `--check` (run
  below) covers the enforced session/link requirements for this push.

## Blockers

- None. This was a pure docs-authoring session with no Docker, Supabase, Flutter, or provider calls.

## Verification

- `node tools/context_sync.mjs --check` run from the worktree root after committing; see the commit
  history for the pass confirming session coverage, memory-index integrity, and coupling references.
- No `git push`, PR, or merge was performed, per the task's hard constraint; all work is committed
  locally on `docs/run4/envelope-deviation-264` for the user to push/merge themselves.

memory: none
