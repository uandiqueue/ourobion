---
title: Refresh Run 4 U3 pretrust unit base CI provenance
summary: Merged the accepted U3 integration head into the existing #245 branch without changing release-gate, configuration, or attestation semantics, then re-ran the unchanged local evidence gates.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Refresh Run 4 U3 pretrust unit base CI provenance

Issue: #244. Branch: `ci/run4-u3-pretrust-unit-base`.

## Attempted

- Refreshed the existing #245 branch against the current accepted `dev-phase2-run4` head so GitHub can create a synthetic merge with current base/head parents.
- Re-ran the unchanged release landing, parsed configuration, local-only attestation, and context gates.

## Changed

- Merged `be113edbbb5e5efa7687c24ca329ab213fdac338` into the existing #245 branch. No release-gate source, CI semantics, configuration, or attestation evidence was edited.

## Decided

- The prior release-evidence failure was stale synthetic-merge provenance only. This refresh relies on a new GitHub event rather than weakening or editing the gate.

## Left

- Obtain the fresh GitHub Actions evidence for #245; merge authority remains with the Run 4 orchestrator only after all required checks are green.

## Blockers

- None locally.

## Verification

- `node --test tools/run4_release_gate.test.mjs` — 14 passed, 0 failed.
- `node tools/run4_release_gate.mjs landing --base 38205d2532ef528ab3752d9013d457c2ee994314 --head HEAD --max-paths 115 --max-added 8500` — PASS: 4 paths, 48 added lines.
- `node tools/run4_release_gate.mjs config` — PASS.
- `node tools/run4_release_gate.mjs attest` with fresh Deno module graphs — PASS.
- `node tools/context_sync.mjs --check` — rerun after this log before push.

memory: none
