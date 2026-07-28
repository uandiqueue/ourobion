---
title: Run 4 landing-gate unit base advance for the Archive and Scan units
summary: Advanced RUN4_UNIT_BASE_SHA to the post-UI integration tip so the Archive-trends and Scan-motion units have a real landing budget, re-recorded the attestation through the generator, and re-proved the gate fails closed.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 landing-gate unit base advance for the Archive and Scan units

Branch: `ci/run4-unit-base-advance-u9`

Prerequisite for issues #200 (Archive trends) and #201 (Scan motion). No product behaviour changes.

## Attempted

- Measured the remaining landing budget on the current base after #191 and #202 merged.
- Advanced the per-unit base, re-recorded the attestation through the generator, and re-ran the
  gate's positive and injected-negative paths.

## Changed

- `tools/run4_release_gate.mjs` — `RUN4_UNIT_BASE_SHA` advanced from
  `ff0546434f081cadc3e5683217d484f250c19139` to `547280f69fe37fe1c7271ea126002f9ffaadafb9`
  (the tip after PR #191 and PR #202 merged). The superseded value is retained as provenance.
- `.github/workflows/ci.yml` — updated in lockstep.
- `supabase/deploy-attestation.json` — regenerated via `record-attestation`, never hand-edited.

Caps unchanged at 115 paths / 8,500 added lines.

## Decided

- **The U7 base is spent, not wrong.** It did its job for #191 and #202. Against it the integration
  branch now measures **60 paths / 7,981 added lines**, leaving ~55 paths and ~519 lines. That
  shortfall is entirely already-merged work, so the next unit would fail a cap it never consumed —
  the precise failure mode `tools/run4_release_gate.mjs:27-39` documents and instructs advancing for.
- **One advance serves both units.** #200 and #201 are both branched from `547280f`, so a single
  base value is correct for both rather than one advance per unit.
- The attestation regeneration again reproduced every hash byte-identically; the manifest diff is
  exactly one line (`provenance.unitBaseSha`). That is independent evidence the regeneration is
  faithful rather than a rewrite, and that this toolchain still matches CI's.

## Verification actually run

macOS, `deno 2.8.1` (pinned to the CI version), repository-local Supabase CLI `2.81.2`.

- `node --test tools/run4_release_gate.test.mjs` — 9 pass, 0 fail.
- `node tools/run4_release_gate.mjs config` — `run4 config/workflow gate: PASS`.
- `node tools/run4_release_gate.mjs graph-hashes` — reproduced all four functions' hashes exactly.
- Live `supabase functions serve --debug --no-verify-jwt` probe of all four routes — each reached
  its handler and returned HTTP 401 `Unauthorized`, sha256
  `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`. A fresh probe, not a replay.
- `node tools/run4_release_gate.mjs attest` against a freshly regenerated graph directory —
  `run4 local runtime attestation: PASS`.
- Landing positive and injected negatives — recorded on the PR.

## Left

- The base will need advancing again after #200/#201 integrate. That is the designed per-unit
  convention, not a defect.

## Blockers

- None for this unit. `gh pr merge` is refused by the local permission classifier, so a human must
  merge.

memory: none
