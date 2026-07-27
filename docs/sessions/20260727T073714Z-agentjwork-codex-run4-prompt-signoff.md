---
title: Run 4 prompt review, correction, and technical sign-off
summary: Independently confirmed Claude's Run 3 stop/do-not-merge verdict, corrected five material Run 4 assumptions, promoted the pending-build register into docs/temp/run4, and signed a dormant preflight-gated Run 4 prompt without executing it.
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Run 4 prompt review, correction, and technical sign-off

Issue: [#150](https://github.com/uandiqueue/ourobion/issues/150)
Branch/worktree: `docs/run4-remediation-signoff-150` in `C:\project\ourobion-run4-150`
Task claim: `run4-remediation-prompt-signoff` / `codex` / `agentjwork`

## Attempted

- Started a new isolated session at Jayden's clarification, ran the context briefing, read the latest
  Run 3/Run 4/model-training sessions, and routed the review through the tracked semantic graph because
  the isolated worktree had no machine-local `graphify-out/`.
- Compared Claude's `docs/temp/run4/` audit with the current Run 3 plans, pending register, PR #144
  implementation branch, repository contracts, and local integration state at `fef311f`.
- Rechecked live GitHub state: PR #144 remained open with head `5eebddd` and stale base `9b41f4a`;
  `dev-phase2-run3` and `dev-phase2` were unprotected with no required checks; the only active ruleset
  targeted `main` and had no required-status rule.
- Reproduced the current merge conflict in `.github/workflows/ci.yml`, verified the MT0 landing delta
  (59 files / 5,362 additions after the candidate Run 3 base), and inspected the fail-open TOML regex
  and incomplete matrix assertions directly.
- Checked current official Supabase guidance before accepting the deploy-path claim. The docs confirm
  per-function `deno.json` is the recommended deployment configuration, but do not prove this repo's
  lock-v5 shape is honored identically by each pinned CLI bundling mode.
- Did not execute Run 4, change hosted settings, close PR #144, call a provider, deploy, train a model,
  or modify product/runtime code.

## Changed

- Added `docs/temp/run4/orchestrator-prompt.md`: technically signed, paste-ready, and explicitly
  dormant. It authorizes preflight only after an explicit start, then stops for human acceptance before
  any implementation.
- Promoted the living gap superset to `docs/temp/run4/pending-build-register.md`; preserved O24-O29 as
  unfinished, added O31-O40 rows, and left a historical pointer at the Run 3 path.
- Updated the Run 4 cockpit and scope with the independent confirmation, corrected preconditions, and
  a maximum five-unit priority tranche: release gate → mechanical boundaries → authorization/key
  boundary → raw-truth/retry safety → scientific semantics.
- Added a provenance note to Claude's audit so its line-number locations are understood against audit
  commit `c731238` after the live register moved.
- Marked the Run 3 cockpit/scope/prompt as closing historical drafts and explicitly non-launchable;
  linked them forward to Run 4.
- Added this one session record.

## Decided

- **Agree with Claude's core verdict:** do not merge PR #144; close Run 3 without an accepted unit and
  rebuild useful O24 intent on a fresh Run 4 base.
- Corrected the Run 4 proposal before sign-off:
  1. no solo-review waiver may be inferred for `shared/`;
  2. caps use a fresh immutable base and final landing-delta semantics, not retroactive exclusions;
  3. deploy/lock parity is an evidence question, not the unsupported assertion that deploy never reads
     the lock;
  4. `TEST_MODE_LABEL` crosses TS/Dart through generation or a parity guard;
  5. O28/O29 and maintenance candidates are deferred by default rather than rolling all candidates
     into one run.
- Run 4's recommended maximum is R4-U0-R4-U4, conditional on preflight. Preflight may shrink the list;
  it may not add work.
- The technical sign-off covers prompt quality only. Human setup, exact base/caps, branch protection,
  reviewer identity, credentials/resources, merges, provider calls, hosted writes, and start authority
  remain human-owned.

## Left

- Run 4 is not started. The new prompt remains `DORMANT` until Jayden explicitly says to start it.
- P1-P7 remain unresolved external/decision gates; branch protection and required checks were inspected
  but not changed.
- PR #144 remains open for Jayden/orchestrator to close as superseded; no GitHub PR state was mutated.
- O28, O29, O37, O39, the remaining O40 ADR work, and all other pending-register rows remain deferred.
- MT1-MT5 remain a separate model-training workstream and were not moved onto the Run 4 product branch.

## Blockers

- None for the requested review, prompt sign-off, or register promotion.
- Implementation is intentionally blocked by the explicit start sentinel and mandatory preflight/human
  checkpoint.

memory: none
