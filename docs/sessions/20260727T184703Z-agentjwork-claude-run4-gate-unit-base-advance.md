---
title: "Run 4 — advance RUN4_UNIT_BASE_SHA so the landing gate measures per-unit work"
summary: "The frozen single base charged every later unit for unrelated integration-branch work; advanced to the current tip and documented the per-unit convention the envelope already describes."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 — advance `RUN4_UNIT_BASE_SHA` so the landing gate measures per-unit work

Issue #171. Branch `ci/run4-gate-unit-base-advance` in an isolated worktree cut from
`origin/dev-phase2-run4` @ `c558c04f1b661a59c8987c96770768eeea46e0cc`.

## Attempted

Unblock the Run 4 landing gate, which had become unsatisfiable for every remaining unit.

## Changed

- `tools/run4_release_gate.mjs` — `RUN4_UNIT_BASE_SHA` advanced `77c98213…` → `c558c04f…`, with a
  comment recording *why it must advance per unit* and retaining both superseded values as provenance.
- `.github/workflows/ci.yml` — the matching `RUN4_UNIT_BASE_SHA` env value (`:77`).
  `run4_release_gate.mjs:288` asserts the two agree, so they must move together. The step *name*
  ("Assert exact landing SHA and U0 unit base") was deliberately left untouched, because
  `REQUIRED_JOB_STEP_SETS` (`:207`) and `exactStep()` (`:287`) match it literally.
- `supabase/deploy-attestation.json` — **regenerated** with
  `node tools/run4_release_gate.mjs record-attestation`, never hand-edited
  (`run4_release_gate.mjs:577` asserts `provenance.unitBaseSha` equals the constant).

Caps unchanged at 115 / 8,500. No job added to or removed from `RUN4_REQUIRED_JOBS`. No product code,
function, or migration touched.

## Decided

- **The caps are a per-unit landing budget, not a whole-run total.** `run-envelope.json` accepts them
  for `RUN4_UNIT_BASE_SHA..HEAD` **only**, and `orchestration-log.md` recorded the prior value as
  "ACCEPTED for U0 only". U0's implementation nevertheless froze one SHA for the whole run, so every
  later unit was charged for everything that landed after it. Advancing per unit restores the
  documented intent instead of raising a limit to paper over it.
- **This was not hypothetical.** R4-U1 (PR #170) failed `Run 4 release evidence` with
  `landing delta has 12957 added lines; cap is 8500`. The model-training MT4 merge (PR #169) had
  advanced the base and alone consumed 50 paths / 7,897 lines of the 115 / 8,500 budget, leaving 603
  lines for any unit. U1's own branch delta was 31 paths / 6,769 lines — inside the cap. The same
  failure class is on record for Run 3 in `docs/temp/run4/README.md` ("MT0 added 59 files / 5,362
  insertions after the candidate baseline and broke U0's evidence and mergeability").
- **Regeneration is provably faithful.** The re-recorded attestation differs by exactly one line —
  `provenance.unitBaseSha`. All four functions' entrypoint, import-map and module-graph hashes, plus
  `configSha256` and `lockSha256`, recomputed byte-identical, confirming no function moved.
- **The existing serve-probe route evidence was reused rather than re-probed.** Nothing about the four
  handlers changed, and the manifest's own `replayBoundary` states CI "does not replay local serve".
  Recorded here so the reuse is visible rather than implied.
- **Advancing the base is precedented**, not novel: `run-envelope.json` → `historicalUnitBaseShas`
  records one prior advance during the Run 3/MT3 consolidation.

## Left

- **`docs/temp/run4/**` tracking documents still name `77c98213…` as the active base**
  (`run-envelope.json:50`, `orchestration-log.md:46,53`, `decisions-signoff.md:19,29`,
  `human-decisions.md:17`). Those are owned by the primary Run 4 orchestrator and were deliberately
  not edited; they need a follow-up note recording the new active base.
- **Each subsequent unit must advance this constant to its own base SHA** and re-record the
  attestation. That now requires `deno` and the Supabase CLI locally at their pinned versions.
- `deno` was absent on this machine (a documented repo gotcha) and was restored at the pinned 2.8.1
  via a `--no-save --no-package-lock` install; `package.json` and `package-lock.json` were verified
  byte-identical by SHA256 before and after.

## Blockers

None. Editing U0's release-gate implementation was explicitly authorised by the owner after R4-U1
reported the cap blocker instead of working around it.

memory: none
