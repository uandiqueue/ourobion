# The Phase-2 run — the proven instance behind this skill

The worked example this skill's procedures were distilled from. Everything here is
history, not procedure — read it for calibration ("what does a run this size look
like?"), not as instructions.

## What it was

An autonomous multi-unit build/fix run on this repo, 2026-07-15→18. Run slug
`phase2-run`; integration branch `dev-phase2`. Scale:

- **Units U0–U29** (build U0–U18, audit-fix U19–U28, plus U29), a **15-PR stacked
  chain** (#43–#71), one writer at a time.
- A **record-only audit** between build and fix phases (units AU0–AU9, 27 findings
  A1–A27 — see the record-only-audit skill), whose register drove the fix worklist,
  followed by a record-only **evidence review** of the run's decisions (see the
  evidence-review-run skill).
- Tracking docs: `docs/temp/phase2-run-*.md` (orchestration log, blocked register,
  sign-off decisions D1–D20, config decisions C1–C12).

## Named incidents (with their D/B ids)

1. **A15 stayed per D9** — the audit flagged A15, but the behavior was already an
   accepted, documented decision (D9). It was skipped in the fix phase, not re-decided:
   by-design findings in an accepted decision are worklist exclusions, and the fix-unit
   scope (U25) was corrected to say so.
2. **The L6 hold-band card / register B5** — the end-to-end card slice (U13) could not
   get a real verifier verdict (API key human-gated, blocked register entry B5). It
   shipped a `hold`-band card carrying
   `INTERIM:pending-real-verifier (decorrelation-blocked, register B5)` rather than
   faking a verified edge — the honest end-state over demo shine.
3. **The reverse-cascade merge (D20)** — all 15 stacked PRs showed "merged" but only the
   bottom one reached `dev-phase2`; recovery was one tip→integration PR (#72). Full
   incident record: the stacked-pr-chain skill's
   `references/phase2-reverse-cascade.md`.

## Primary records

`docs/temp/run1/orchestration-log.md` (worklist + session ledger),
`docs/temp/run1/signoff-decisions.md`, `docs/temp/run1/blocked-register.md`,
`docs/temp/run1/audit/`, and the per-session logs under `docs/sessions/`.
