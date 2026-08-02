---
session: 20260802T021047Z-agentjwork-codex-issue-reconciliation
agent: codex
date: 2026-08-02
scope: GitHub issue reconciliation; docs/sessions only
---

# Reconcile stale issue trackers after the main cutover

Session issue: #380. Branch: `chore/issues/reconcile-post-main-cutover`, cut from `main` at
`5a5af7cbd0bff4b8a8d4af12b686f641ab07f4cd` in an isolated worktree.

## Attempted

- Reconcile #300, #179, #240, #246, and #277 against the code and merged-PR ancestry on current
  `main`.
- Close only implementation trackers whose shipped scope was independently visible on `main`.
- Correct stale acceptance blockers without running builds, providers, deployments, or hosted work.

## Changed

- Added an evidence-backed reconciliation comment to all five issues.
- Closed #300: PR #306 and the later caveat/single-paper serving path are merged; unattended cloud
  dispatch and the extracted-blueprint loader gate remain separately tracked by #369 and #371.
- Closed #179: PR #184's atomic loader implementation is merged; the unrun 14+7 acceptance remains
  explicitly open in #246.
- Closed #240: PR #241's artifact/attestation serving path and PR #254's bounded provider safeguards
  are merged; its old corroborated-monotonic acceptance predicate was superseded by #300's later
  single-paper-verification decision.
- Left #246 open and replaced its stale corroboration/monotonic blocker with the current work: align
  the exact positive-control artifact/pair to the current serving contract, then run the full 14+7,
  provenance/reject, B-PL15, retry/idempotency, and teardown evidence.
- Left #277 open: documentation truth is only partially landed and scopes A/B (cued-only rerun and
  independent non-Claude adjudication) remain unperformed, so no correctness claim is licensed.

## Decided

- Issue closure records shipped implementation scope only; it never upgrades missing acceptance
  evidence into a pass.
- Independent retrieval remains useful metadata and caveat context, but is not a serving verdict
  gate after the owner's recorded #300 single-paper decision.
- `main` is the integration authority; no work was based on the retired `dev-phase2-run4` branch.

## Left

- #246 remains the sole tracker for the unrun local 14+7 positive-control acceptance.
- #277 remains open for an owner decision on whether its evaluation/adjudication scopes are still
  worth executing.
- #369 and #371 remain open follow-ons from #300; neither was claimed or changed in this session.

## Blockers

- None for reconciliation. The remaining acceptance and evaluation work is intentionally outside
  this record-only session.

memory: none
