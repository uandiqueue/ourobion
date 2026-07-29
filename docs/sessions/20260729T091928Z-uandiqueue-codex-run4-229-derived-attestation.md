---
title: Regenerate Run 4 #229 derived deployment attestation
summary: Recomputed the full local-only U6a attestation from fresh Deno graphs and four live unauthenticated handler probes after shared metric-registry imports invalidated three recorded graph hashes.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Regenerate Run 4 #229 derived deployment attestation

Issue: #229

Branch: `feat/m5/u6a-projection-scaffold`

## Attempted

- Reproduce the Run 4 local-only release-gate attestation on the exact `df500e7` head without
  starting, stopping, resetting, or mutating the local Supabase data stack.
- Obtain fresh handler-level evidence for `compute-baselines`, `evaluate-signals`,
  `generate-insights`, and `run-pipeline`, then regenerate the derived manifest exclusively through
  `tools/run4_release_gate.mjs`.

## Changed

- Regenerated `supabase/deploy-attestation.json` with fresh Deno module-graph evidence:
  `compute-baselines` `65972cc03bf18d6a36db84bbfaf997af47c4add64a976b440ad7445e6134a2ff` →
  `946f4710444d74631299092ae9628e0f3c3b360af5c15a0a36cbb0f8050a36a9`;
  `generate-insights` `e2f4b4aeabfcfe0ee811c93df00efe04fbd9886b9a6c245493871a18244ff932` →
  `15e1317b76020a76945ec34637052b06da5a7ccbb58bb3bfc5cbbe3d87a73fce`; and
  `evaluate-signals` `ba4317d455f5d9968ce8f3366e3c69b00f58aee50253cc48b75553c6514b98df` →
  `ac8a0e2336d29a0ef3bdad4ece7dc62cbb33c229ba6a691ed7c09ce52f9a969a`.
- `run-pipeline` remains graph-identical at
  `60515bda161b45836acf4f5dccf4cca2df3fd654f0ceebca70274caf59178dcf`; every entrypoint,
  import-map, config, lockfile, and recorded tool-version hash remains unchanged.

## Decided

- The previous local-attest success report was incomplete: its stale manifest did not reflect the
  shared `shared/metrics/registry.ts` import drift in the three affected function graphs. This
  generator-produced update corrects that false local-attest conclusion; it makes no hosted deploy
  or hosted-parity claim.
- The running Docker stack used the legacy local `biotope` project namespace while the checked-out
  source config names `ourobion`. A detached, byte-equivalent temporary worktree changed only
  `project_id` to `biotope` to serve the exact functions. The old exited
  `supabase_edge_runtime_biotope` was temporarily held under a unique name, the new transient
  runtime was bound read-only to the shim, and the original name/network/alias was restored after
  cleanup. The clean shim was removed.
- Each unauthenticated `{}` POST to `/functions/v1/compute-baselines`,
  `/functions/v1/evaluate-signals`, `/functions/v1/generate-insights`, and
  `/functions/v1/run-pipeline` reached the configured handler and returned HTTP `401`, exact body
  `Unauthorized`, SHA-256
  `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`.

## Left

- PR #229 remains open for its normal CI/check lifecycle; no checks were manually retried and no
  merge was performed.
- Existing ignored local artifacts and pre-existing untracked `attest-graphs/` / `graphs/` remain
  untouched.

## Blockers

- None. The temporary Docker namespace mismatch was resolved and restored without touching owner
  containers, raw data, hosted services, providers, R2, or model actions.

## Verification

- `node tools/run4_release_gate.mjs record-attestation` (Node 26.5.0, repository Supabase CLI
  2.81.2, fresh graph directory): PASS.
- `node tools/run4_release_gate.mjs attest` (Node 26.5.0, Deno 2.8.1, repository Supabase CLI
  2.81.2, distinct fresh graph directory): PASS.
- Full Flutter and shared-contract suites had already passed at exact parent `df500e7`; this
  derived-only update changes no source, so they were not rerun.

memory: none
