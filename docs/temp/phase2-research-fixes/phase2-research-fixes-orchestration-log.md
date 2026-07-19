---
title: Phase-2 Research-Fixes — Orchestration Log
summary: Resumable state of the REMEDIATION run that applies the Phase-2 decisions evidence review (docs/temp/phase2-research/decisions-evidence-review.md) to the code. Worklist, per-unit lane classification (A verify-first / B safe-fix / C method-change), dependency spine, ledger, and the RESUME pointer. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

# Phase-2 Research-Fixes — Orchestration Log

The resume point for the remediation run that turns the **evidence-review verdicts** into code/doc
changes. Read this top-to-bottom, then the blocked register, then continue at the first `next` unit.

**Source of work:** `docs/temp/phase2-research/decisions-evidence-review.md` (Executive summary +
"Most urgent, in priority order"). Ground truth the verdicts are about: `docs/shared/decisions/0002`,
`0003`, `docs/shared/insight-engine-architecture.md` §11. **Separate track — do NOT touch:**
`docs/temp/phase2-audit/` (audit-driven fixes).

## ⚠ Read-this-first

- **Merging is human-gated.** Jayden merges PRs into `dev-phase2` in order. This run NEVER merges and
  never touches `main`. PRs are stacked on the chain tip and left open.
- **Lane discipline (the crux).** Every unit is classified into one lane; the lane decides what the
  unit is allowed to do:
  - **(A) VERIFY-FIRST** — read/research only; output a findings note + either "no change needed" or a
    follow-up fix unit. Gate the real fixes; do these earliest.
  - **(B) SAFE FIX NOW** — cheap, low-risk; does not rewrite accepted science. Label/wording/config
    corrections and code hygiene (values in config objects, never inline).
  - **(C) METHOD / SCIENCE CHANGE** — needs design + human sign-off. Do NOT silently rewrite an
    accepted ADR or a §11 value. Write a design note (change + citation + the ADR/§11 text that must
    change), implement the **mechanism behind config**, FLAG for shared/ retro-review + an ADR
    **open-questions/changelog append** (never overwrite accepted rationale). Where the "right" number
    needs data we don't have, ship mechanism + instrumentation and record the calibration as a
    **blocked/backlog** item — never a guessed constant.
- Tier 1 (keep — well-grounded) and Tier 2 (keep provisionally) are **skipped**, except a verdict's
  specific cheap guardrail (e.g. "report components alongside the composite" → F3).

## Baseline — what was already shipped at run start (do not rebuild)

- Phase-2 build run U0–U29 shipped as a merged stacked chain into `dev-phase2` (tip `1d678cc`).
- The evidence review itself (RU2–RU7 + executive summary) is COMPLETE and record-only; this run
  consumes it, does not redo it.
- All Phase-2 config values already ship **behind config objects** per ADR-0002's mandate (verify
  per-file before assuming; a value found inline is itself a finding).

## Worklist

▶ **RESUME AT: F2** — F0 + F1 done. Assessment complete; worklist below reflects the A1/A2 reframing
(see `phase2-research-fixes-findings.md`). **A1: no change needed** (coded N_eff is the canonical 2/N
Bartlett/P&P form; Open-Q1 resolved-confirmed). **A2: the review's "prewhiten-before-CCF" premise does
not match the code — there is NO rank-CCF; prewhitening is by-design offline per ADR-0002** — so F5
collapses to "add lag 2 + document limitations." **F1 (chain tip = `fix/research-fixes/rho-effect-size-label`,
PR #101 · issue #100):** corrected the `|ρ|≥0.3` "medium" mislabel → "conservative ~top-quartile / relatively-large"
in `phase2-run-config-decisions.md:36` + `evaluate-signals/config.ts` PAIR_GATES doc-comment (RU4b);
wording/comment only, no behaviour change.

| # | Unit | Lane | Status | Notes |
|---|------|------|--------|-------|
| F0 | Run scaffolding + lane-A findings (A1 P&P formula-constant · A2 prewhiten/CCF) | A | **done** | A1 no-change (canonical 2/N confirmed); A2 premise-mismatch (no CCF) → reshapes F5/F6 |
| F1 | Correct `\|ρ\|≥0.3` "medium" label → "top-quartile / relatively-large" wording (RU4b) | B | **done** | fixed `phase2-run-config-decisions.md:36` + `config.ts` PAIR_GATES doc-comment; wording/comment only, no behaviour change. Branch `fix/research-fixes/rho-effect-size-label` · PR #101 · issue #100 · commit `f4b5aa5`. **Chain tip = this branch.** |
| F2 | Revert C5 medium confidence cutoff **5→7** (code already has 5; U6 regression), or make per-metric (RU5b) | B | queued | 2 synced config objects: `compute-baselines/index.ts:34` (UTF-16!) + `generate-insights/evaluators.ts:165`; behaviour change → test + live proof |
| F3 | Report edgeScore components (confidence · tier · corroboration) alongside the composite; **lift inline weights 0.6/0.25/0.15 → config object** (RU2 guardrail + ADR-0002 mandate) | B | queued | component reporting is net-new; weights inline at `shared/brain/index.ts:46`; gates already config |
| F4 | Resolve `deadbandK=1.0` intent mismatch (nudge vs anomaly): D-entry + fire-rate instrumentation; calibration → backlog; ADR-0002 Open-Q2 append (RU3c) | C | queued | mechanism (per-metric registry field) already exists; keep 1.0 until calibrated — no guessed constant |
| F5 | Lag path: **add lag 2** to `ALLOWED_LAG_DAYS`; document coincidence-path limitations (lag-7 deseasonalize backlog; no BH multiplicity) — NOT the review's CCF rewrite (see A2) | C | queued | reframed by A2; prewhitening by-design-offline per ADR-0002 = skip |
| F6 | Swap Pyper–Peterman → xDF effective-N for co-moving pairs, **behind a config toggle (default P&P)**; ADR-0002 Open-Q1(resolved)+Open-Q8 append; switch → backlog (RU4d) | C | queued | the real autocorrelation residual from A2; xDF impl marked provisional/INTERIM until verified+calibrated |
| F7 | h-index 100/50 + OR-combination: document as recall-favouring notability heuristic; ADR-0003 open-Q append; field-normalization → backlog (RU6d,f) | C | queued | 100/50 already config (`IMPACT_BANDS_C8`); no field-norm infra; notability⊥trust intact — bounded risk, low/no new code |
| F8 | Composite gates 0.8/0.5 + weights calibration: confirm ADR-0003 Open-Q1-2 backlog + point to F3 guardrail (RU2a,b,f) | C | queued | already by-design provisional in ADR-0003; mostly backlog pointer, no guessed constant |

### Dependency spine

```
F0 (A1, A2 findings)  ──gates──►  F6 (xDF, from A1)   and   F5 (prewhiten, from A2)
F1, F2, F3  — independent, cheap (lane B), do right after F0
F4 (deadbandK) — independent (lane C)
F7 (h-index/OR) — independent (lane C)
F8 (composite calibration) — independent (lane C); F3 is its cheap-guardrail sibling
```

Sequencing (single writer, stacked chain): F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8. Priority order
follows the review's "Most urgent" list (A1, A2, deadbandK, label+cutoff fixes, xDF) — reordered into
the chain so cheap lane-B fixes land before the heavier lane-C design units.

## Session ledger

| When (UTC) | Unit | Branch / PR | Outcome |
|---|---|---|---|
| 2026-07-19 | F0 setup + lane-A | `docs/research-fixes/run-scaffolding` · PR #99 · issue #98 | run created; A1 no-change, A2 premise-mismatch; docs-only, context_sync green. |
| 2026-07-19 | F1 label fix | `fix/research-fixes/rho-effect-size-label` · PR #101 · issue #100 | corrected `\|ρ\|≥0.3` "medium" mislabel → conservative ~top-quartile/relatively-large (RU4b) at `phase2-run-config-decisions.md:36` + `config.ts` PAIR_GATES comment; wording/comment only, no behaviour change; context_sync + engine-stats typecheck/36 tests + flutter analyze all green. **Chain tip = this branch.** |

## Notes for the resuming orchestrator

- Toolchain per shell: `. .\scripts\biotope-env.ps1` (node/flutter not on base PATH). Push from an
  activated PowerShell (pre-push hook needs node). `graphify` is NOT installed on this machine — treat
  it as absent; verify against actual files.
- Gate before every PR: `flutter analyze` + `flutter test` + `node tools/context_sync.mjs --check` +
  every touched package's own suite. Behaviour changes need live proof recorded in the session log.
- Update this log's worklist row + ledger row as part of finishing each unit (same/next commit).
- `deno` is absent locally — edge-function type-checking is the CI `deno-check` job; a first-run type
  failure surfaces on the PR, not locally.
