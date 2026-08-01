---
title: Agnes explicit free pricing
summary: Added explicit free-versus-metered router pricing and hash-bound zero-dollar acceptance reservations without turning the owner's testing limit into system policy.
type: session
scope: brain
status: canonical
updated: 2026-07-30
---

# Agnes explicit free pricing

Issue: #263 · branch: `fix/llm-router/agnes-free-pricing` · base: `dev-phase2-run4` @ `a1dfd435`

## Attempted

- Replace the rejected fake epsilon-price workaround with an honest exact-zero billing contract for
  the owner-confirmed free Agnes API plan.
- Keep Agnes acceptance-only and unassigned in production.
- Preserve the owner's maximum of 10 Agnes calls as an orchestrator testing limit, not a new
  system/router cap. The earlier direct connectivity smoke remains test call 1 of 10.
- Attempt the required incremental semantic-graph refresh. `graphify update .` produced no output
  and timed out after 60 seconds; no process or tracked graph change remained, so the generated-view
  step was correctly not run.

## Changed

- Added backward-compatible `metered` and explicit `free` price validation. Free rows require exact
  zero input/output rates, `provisional: false`, and non-empty provenance; metered rows retain
  strictly positive rates.
- Added the unassigned `agnes-2.5-flash` free price row with owner-confirmed provenance.
- Bound complete validated price metadata into every new acceptance-journal reservation and hash
  chain. Zero-dollar reservations are accepted only for matching free metadata; legacy positive-cost
  journal lines still replay, while unexplained legacy zero-cost lines fail closed.
- Made both the router facade and API adapter verify the price metadata before fetch.
- Added offline coverage for validation, zero cost, forged provenance, journal lifecycle identity,
  malformed runtime values, legacy replay, and the unchanged production assignment.
- Updated the router reference documentation.

## Decided

- No new global Agnes call limit belongs in runtime code. The owner's 10-call instruction applies to
  this orchestrator's current testing activity only.
- The existing provider-attempt behavior is unchanged.
- The direct smoke test proved connectivity only; it did not exercise the router, journal, R2,
  database, or scientific acceptance flow.
- Session isolation used two ordinary clones and then the primary-checkout exception authorized by
  the owner because the Windows restricted-token wrapper rejected `apply_patch` in every linked and
  ordinary isolated checkout. All pre-existing untracked paths were preserved. Edits used Codex's
  direct apply-patch mode; no PowerShell/Python file-write workaround was used.

## Verification

- Router TypeScript check: clean.
- Full offline router suite: 117 passed, 0 failed.
- `git diff --check`: clean.
- Run 4 landing gate from accepted unit base `6020f444`: 43 paths / 2,780 additions,
  inside 115 / 8,500.
- Independent Sol-high adversarial review: PASS after correcting one stale budget comment; no
  blocking findings.
- No Agnes/provider call was made during implementation or tests; the testing counter remains 1/10.

## Left

- PR CI.
- The broader two-leg scientific acceptance work remains in #240/#233.
- Incremental graph refresh remains pending in an environment where `graphify update` completes.

## Blockers

- None in the implementation. The patch-wrapper defect remains an environment limitation documented
  by the approved checkout exception.

memory: none
