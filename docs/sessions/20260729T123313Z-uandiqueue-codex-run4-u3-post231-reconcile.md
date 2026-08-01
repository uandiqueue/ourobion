---
title: Reconcile Run 4 U3 after PR 231
summary: Merged the post-231 integration line into U3 and regenerated the derived local-only deployment attestation from fresh handler probes.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Reconcile Run 4 U3 after PR 231

Issue: #179 · canonical PR: #184

## Attempted

- Reconcile U3 with the exact post-#243 integration tip without rebasing or weakening the Run 4 gates.

## Changed

- Normal-merged `8ae57d2` into the U3 lineage; the only conflict was the rebuildable deployment attestation.
- Re-recorded that manifest through the checked-in generator after fresh local 401 probes of all four functions.

## Decided

- The product-cap result remains a recorded, non-acceptance measurement; no product-envelope decision was made here.

## Left

- Keep #179 and #184 open until the remaining U3 acceptance evidence and review/merge process complete.

## Blockers

- None.

## Verification

- The merged delta before this log measured 32 paths / 8,306 additions against `425b6ff`; the final head is remeasured by the release gate.

memory: none
