---
title: "Run 4 U3 reconciliation stopped at landing cap"
summary: "Replayed the reviewed U3 lineage onto the current Run 4 integration tip, preserved the merged U1/U2 protections in the only code conflict, and stopped before new work when the accepted landing gate measured 14,063 added lines against the 8,500-line cap."
type: session
scope: shared
status: canonical
updated: 2026-07-29
---

# Run 4 U3 reconciliation stopped at landing cap

Issue #179 / draft PR #184. Isolated branch `fix/db/run4-u3-reconcile-179`, cut from and then
fast-forwarded to current `origin/dev-phase2-run4` at
`6b51a0793d2146f2bccbde4fa7c5751799c184b4`. Nothing was pushed or merged.

## Attempted

- Located the previously reported local rebased head `0b8c280`; it is no longer present in the
  repository object store or reflogs, so the best available reviewed lineage was replayed from PR
  #184: `4e02525`, `c5fb14b`, and `7676702`.
- Resolved the first replay commit's two conflicts: the Nao `run-pipeline` relay and the deployment
  attestation. The relay resolution retained U2's replacement-publishable-key resolver, durable
  attempt/outcome audit, opaque unknown-outcome response, authorization and redaction while also
  retaining U3's request-key validation, stage recording, watermark comparison and worst-wins
  publication fold.
- Preserved the current U1/U4 attestation bytes rather than accepting an obsolete pre-U1 manifest.
  Because U3 changes `generate-insights`, that manifest would need generator-driven re-recording
  before any eventual push; it was deliberately not regenerated after the mandatory cap stop.
- Ran the landing gate immediately after replaying the reviewed U3 lineage, before the LoaderPanel
  repair, HTTP walk, tests, attestation work or any new implementation.

## Changed

Local commits only:

- `ccab9bc` — replay of `4e02525`, with the U1/U2-preserving conflict resolution above.
- `7c46493` — replay of `c5fb14b`, the write-time TOCTOU protection and its proofs.
- `4418fa6` — replay of `7676702`, the two final U3 regression corrections.

The U3 delta relative to current integration is 21 paths under `apps/nao/**`,
`scripts/demo-dryrun-run2.ps1`, `supabase/functions/generate-insights/index.ts`, four additive
migrations, `supabase/tests/u3/**`, and the original U3 session log. No shared contract,
model-training, brain-ingest, hosted state, provider API, Biotope env, release-gate implementation,
workflow or guard was edited by the replay.

## Decided

- The accepted landing base is still `789e6a0ff8232057402e1d34583647349c85bb89`; the current
  integration tip already spends 6,163 added lines of the per-unit budget before U3.
- The gate's exact result on the replayed head is:

  ```text
  43 changed paths
  14,063 added lines
  Error: landing delta has 14063 added lines; cap is 8500
  ```

- This is a hard cap stop, 5,563 lines over. No assertions or proofs were trimmed, the base was not
  advanced, and no gate, workflow, scanner, boundary guard, RLS policy or authorization path was
  weakened.

## Left

- A gate-base advance requires a separate envelope-owned decision and reconciliation round.
- The LoaderPanel target repair was not applied because the gate was measured before new work and
  failed. The known repair remains `LoaderPanel.tsx` plus the existing focused loader guard.
- All required U3/U2/profile-prefs/Nao/Flutter/context/forced-negative checks remain pending on a
  future final combined head; none is reported passing in this session.
- The mandatory 14+7 HTTP walk was not attempted after the cap stop. The prior issue record says the
  five-claim verification artifacts under `data/corpus/demo-edges` are absent and live LLM use is
  forbidden; that prerequisite was not revalidated here.
- The deployment attestation is intentionally stale on this local stopped branch because
  `generate-insights` changed and no generator-driven re-record was attempted after the stop.

## Blockers

- `CAP-BLOCKED`: 14,063 added lines exceeds the accepted 8,500-line cap by 5,563.

memory: none
