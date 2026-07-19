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

▶ **RESUME AT: F7** — F0 + F1 + F2 + F3 + F4 + F5 + F6 done. Assessment complete; worklist below reflects the A1/A2 reframing
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
| F1 | Correct `\|ρ\|≥0.3` "medium" label → "top-quartile / relatively-large" wording (RU4b) | B | **done** | fixed `phase2-run-config-decisions.md:36` + `config.ts` PAIR_GATES doc-comment; wording/comment only, no behaviour change. Branch `fix/research-fixes/rho-effect-size-label` · PR #101 · issue #100 · commit `f4b5aa5`. (Chain tip superseded by F2.) |
| F2 | Revert C5 medium confidence cutoff **5→7** (code already has 5; U6 regression), or make per-metric (RU5b) | B | **done** | reverted `mediumMinDays` 5→7 at both synced config objects: `compute-baselines/index.ts:34` (NUL-trap file — perl edit, NUL verified surviving on line 129, `wc -c`=**1**) + `generate-insights/evaluators.ts:169` + comments; dev-aid docs updated; per-metric backlogged (B1). `grep mediumMinDays` = only these 2 logic sites, no third copy. Behaviour change proven by ADDED boundary test (6 days→`low`, 7&hist≥14→`high`, 7&hist<14→`medium`); rules **65/65** (was 64), engine-stats **36/36**, context_sync + flutter analyze green. Live proof = node boundary test (Deno producer is the type-checked mirror, CI `deno-check`; stack not stood up). Branch `fix/research-fixes/c5-medium-cutoff-revert` · PR #103 · issue #102 · commit `f37da44`. **Chain tip = this branch.** |
| F3 | Report edgeScore components (confidence · tier · corroboration) alongside the composite; **lift inline weights 0.6/0.25/0.15 → config object** (RU2 guardrail + ADR-0002 mandate) | B | **done** | lifted weights + saturation-3 into `EDGE_WEIGHTS` (`shared/brain/index.ts`); added pure `edgeScoreComponents(v)` as the ONE source of truth `edgeScore` / `servingBand` now read; surfaced the breakdown in the loader per-edge review log (`load_edges.mjs`, non-persisted — persistence backlogged B2). **Composite + serving bands byte-identical for all inputs** — proven by the regression table (`edgeScore` vs the transcribed pre-refactor formula). edge-loader **45/45** (+9), typecheck clean, context_sync + flutter analyze green. Branch `fix/research-fixes/edge-score-components` · PR #105 · issue #104 · commit `704ca89`. **Chain tip = this branch.** |
| F4 | Resolve `deadbandK=1.0` intent mismatch (nudge vs anomaly): D-entry + fire-rate instrumentation; calibration → backlog; ADR-0002 Open-Q2 append (RU3c) | C | **done** | framed the intent question (anomaly alert vs ~1-in-3 daily nudge) as **product-gated** (D3); kept `deadbandK = 1.0` unchanged (per-metric registry field). Shipped pure `fireRate(states)` (`evaluate-signals/stats.ts`) + per-metric fire-rate logging & `fireRates` response field (`index.ts`, measurement-only). Calibration + intent → backlog **B3**; deadbandK re-affirmed in config-decisions **C3**. **ADR-0002 Open-Q2 append NOT applied in-run** — accepted-decision-body immutability guard (`context_sync --check`, pre-push + CI) forbids editing an accepted ADR body (verified empirically); exact append text recorded as amendment intent in **D3**, flagged for shared/ retro-review. engine-stats **38/38** (+2 fireRate: computed k=1.0 fire rate **0.30** on the Gaussian-quantile case); context_sync + flutter analyze green. Branch `feat/research-fixes/deadbandk-intent-instrumentation` · PR #107 · issue #106 · commit `1511fe9`. **Chain tip = this branch.** |
| F5 | Lag path: **add lag 2** to `ALLOWED_LAG_DAYS`; document coincidence-path limitations (lag-7 deseasonalize backlog; no BH multiplicity) — NOT the review's CCF rewrite (see A2) | C | **done** | added lag 2 to `ALLOWED_LAG_DAYS` {1,3,7}→**{1,2,3,7}** (effective grid {0,1,2,3,7}) + load-gate + doc comment with the A2 facts (RU7: gut/DOMS peak near 1–3d). **prewhiten/one-hypothesis rewrite correctly skipped per A2/ADR-0002** — no rank-CCF exists; prewhitening by-design-offline; RU7e multiplicity moot (lag path never enters BH). **Widen-only, no behaviour change:** grep of `data/rules` proved no blueprint auto-expands (both name a single lagDays: 1 / null) → lag 2 inert-until-used. §11 records no grid (not an accepted doc) → no amendment-intent needed; grid amendment = C4 (dev-aid) only. Tests: rules **67/67** (+2: lag-2-accepted/lag-4-rejected gate + lagDays:2 eval). C4 config-decisions, B4 blocked-register. context_sync + flutter analyze green. Branch `feat/research-fixes/lag-grid-add-lag2` · PR #109 · issue #108 · commit `8d258dd`. **Chain tip = this branch.** |
| F6 | Swap Pyper–Peterman → xDF effective-N for co-moving pairs, **behind a config toggle (default P&P)**; ADR-0002 Open-Q1(resolved)+Open-Q8 append; switch → backlog (RU4d) | C | **done** | **shipped the swappable MECHANISM, not a hand-rolled xDF** — `nEffMethod: 'pyper-peterman' \| 'xdf'` toggle on `PAIR_CONFIG` (default `'pyper-peterman'`); `effectiveN` dispatches on it, P&P path **extracted verbatim** to `effectiveNPyperPeterman` (**byte-identical**, regression-proven), `'xdf'` = **INTERIM seam that THROWS** (exact Afyouni equations not accessibly available; unverified science violates honesty invariant → backlog **B5**). engine-stats **41/41** (+3: default==P&P vectors, explicit P&P==default, xdf-throws); typecheck + context_sync + flutter analyze green; **ADR-0002 left byte-unchanged** (Open-Q1 resolved-confirmed + Open-Q8 xDF-seam appends recorded as amendment intent **D4**, retro-review). C6 config-decisions, B5 blocked-register. Branch `feat/research-fixes/neff-method-toggle-xdf-seam` · PR #111 · issue #110 · commit `<pending>`. **Chain tip = this branch.** |
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
| 2026-07-19 | F2 C5 medium cutoff revert 5→7 | `fix/research-fixes/c5-medium-cutoff-revert` · PR #103 · issue #102 | reverted S3 medium confidence cutoff `mediumMinDays` **5→7** (RU5b) at both synced config objects (`compute-baselines/index.ts` — NUL preserved via perl, `wc -c`=1 — + `generate-insights/evaluators.ts`) + comments + dev-aid docs; per-metric backlogged (B1). Behaviour change: 6-day baseline now `low` (was `medium`) — ADDED boundary test; rules **65/65** (+1), engine-stats **36/36**, context_sync + flutter analyze green. Live proof = node boundary test (Deno mirror via CI `deno-check`). **Chain tip = this branch.** |
| 2026-07-19 | F3 edgeScore components + weights→config | `fix/research-fixes/edge-score-components` · PR #105 · issue #104 | lifted the inline `edgeScore` weights 0.6/0.25/0.15 + saturation-3 into `EDGE_WEIGHTS` (`shared/brain/index.ts`, ADR-0002 config-object mandate, RU2b); added pure `edgeScoreComponents(v)` — the ONE source of truth `edgeScore` / `servingBand` now read (no drift possible); surfaced the component breakdown in the loader per-edge review log (`load_edges.mjs`, non-persisted — persistence backlogged **B2**). **Refactor + reporting only: composite score + serving bands byte-identical for all inputs**, proven by the regression table (`edgeScore` vs the transcribed pre-refactor formula) in `edge_score_components.test.ts`. edge-loader **45/45** (+9 new: reconstruction + saturation + EDGE_WEIGHTS-sourcing + regression), typecheck clean, context_sync + flutter analyze (No issues) green; live proof = loader `--check` review log showing composites 0.560/0.900/0.000 unchanged. **Chain tip = this branch.** |
| 2026-07-19 | F5 add lag 2 + document coincidence-path limits | `feat/research-fixes/lag-grid-add-lag2` · PR #109 · issue #108 | added lag 2 to the coincidence lag grid `ALLOWED_LAG_DAYS` {1,3,7}→**{1,2,3,7}** (effective {0,1,2,3,7}; lag 0 = `lagDays: null`) + load-gate reason string + header comment + a doc comment recording the **A2 facts** (boolean baseline conjunction, NOT a rank CCF; physiologically-plausible-not-calibrated; lag-7 weekly-periodicity confound; lags never enter BH/FDR). **Reframed by verify-first A2 — this is NOT the review's prewhiten-before-CCF rewrite:** no rank-CCF exists in the code, so prewhitening is moot AND by-design-offline per accepted ADR-0002, and "treat 4 lags as one hypothesis" (RU7e) is moot as coded (the lag path never calls `benjaminiHochberg`). **Widen-only / no behaviour change** — grep of `data/rules` proved neither shipped coincidence blueprint auto-expands across the set (`hrv_rise_after_sleep_rise`=1, `gut_comfort_mood_comove`=null) → **lag 2 is inert until a rule opts in**. §11 records no lag grid and is not an accepted decision doc → no amendment-intent/retro-review needed (grid amendment = C4 dev-aid only). Bookkeeping: config-decisions **C4**, blocked-register **B4** (lag-7 deseasonalize). Tests: rules **67/67** (+2: `ALLOWED_LAG_DAYS`-exact lag-2-accepted/lag-4-rejected gate test + a `lagDays:2` evaluation test routing `b_metric@2`); typecheck clean; `context_sync --check` + `flutter analyze` (No issues) green; `flutter test` unaffected (no Dart). **Chain tip = this branch.** |
| 2026-07-19 | F4 deadbandK intent + fire-rate instrumentation | `feat/research-fixes/deadbandk-intent-instrumentation` · PR #107 · issue #106 | framed the `deadbandK=1.0` intent (anomaly alert vs ~1-in-3 daily 3-state nudge) as **product-gated**, kept `k=1.0` unchanged (per-metric registry field), and shipped fire-rate instrumentation for later calibration (RU3c). Added pure deterministic `fireRate(states)` (`evaluate-signals/stats.ts`) + per-metric fire-rate logging & `fireRates` response field (`index.ts`, measurement-only — no threshold/classification touched). D3 (intent framing + exact ADR amendment text as *amendment intent*), C3 config-decisions re-affirm, B3 backlog (intent sign-off + calibration data). **ADR-0002 Open-Q2 append NOT applied in-run** — accepted-decision-body immutability guard (`context_sync --check`, pre-push + CI) blocks editing an accepted ADR body (verified: trial append failed the check); amendment recorded in D3 for shared/ retro-review (deviation from brief, substance unchanged). engine-stats **38/38** (+2 fireRate; computed k=1.0 fire rate **0.30** on 20 std-normal quantiles vs an "anomaly" rate ≪ that), typecheck clean; context_sync + flutter analyze (No issues) green. **Chain tip = this branch.** |

| 2026-07-19 | F6 nEffMethod toggle + xDF INTERIM seam | `feat/research-fixes/neff-method-toggle-xdf-seam` · PR #111 · issue #110 | **shipped the swappable mechanism, NOT a hand-rolled xDF** (RU4d/Open-Q8): added `NEffMethod` type + optional `PairConfig.nEffMethod` (`evaluate-signals/stats.ts`) and `nEffMethod: 'pyper-peterman'` on `PAIR_CONFIG` (`config.ts`, default unchanged). `effectiveN` now **dispatches** on the method (absent ⇒ P&P) — the P&P body **extracted verbatim** to `effectiveNPyperPeterman` (**byte-identical**; regression-proven: default reproduces the existing N_eff vectors exactly + explicit `'pyper-peterman'`==default), and `'xdf'` is an **INTERIM seam that THROWS** (exact Afyouni equations not accessibly available + FFT/Tukey-taper complexity + honesty invariant forbids unverified science as functional → **B5**). No P&P math / `maxLagFraction` / `nEffMin` / threshold touched. engine-stats **41/41** (+3), typecheck clean; `context_sync --check` + `flutter analyze` (No issues) green; `flutter test` unaffected (no Dart). **ADR-0002 left byte-unchanged** — Open-Q1 (resolved-confirmed, 2/N Bartlett/P&P) + Open-Q8 (xDF seam shipped, faithful impl pending) appends recorded as **amendment intent (D4)**, flagged for retro-review (accepted-ADR immutability, as F4). Bookkeeping: signoff **D4**, config-decisions **C6**, blocked-register **B5**. **Chain tip = this branch.** |

## Notes for the resuming orchestrator

- **Build-agent git discipline (added after F1):** agents must make **additive commits only** — NEVER
  `git commit --amend` or force-push a pushed commit. F1's agent amended + force-pushed on its own PR
  branch `fix/research-fixes/rho-effect-size-label`; the end-state was reviewed and is clean (2 commits,
  4 intended files, value `0.3` untouched), and blast radius was limited to that isolated feature
  branch (never `dev-phase2`/`main`), but every subsequent brief now explicitly forbids amend/force-push.
- **Accepted-ADR appends can't land in-run (discovered in F4) — affects F6/F7/F8.** `context_sync
  --check` (pre-push hook + non-bypassable CI) enforces that *an accepted decision's body is immutable*
  (`tools/context_sync.mjs` `checkEditHonesty`: "supersede it instead of editing"). So the lane-C
  protocol's "append an open-Q note to the accepted ADR" **fails the gate** — even a purely additive
  append. F4 handled it by recording the **exact amendment text as amendment intent in the signoff-
  decisions doc (D3)** and **flagging it for shared/ retro-review** (a human applies it via the ADR's
  2-reviewer / supersede channel). **F6 (ADR-0002 Open-Q1/Open-Q8 append) and F7 (ADR-0003 open-Q append)
  must do the same** — record the append text in D-entries, do NOT edit the accepted ADR body in-run.
  (Raising this as a run-level question for Jayden: either relax the guard to allow appends to an ADR's
  "Open questions / changelog" section, or keep applying amendments via retro-review.)
- Toolchain per shell: `. .\scripts\biotope-env.ps1` (node/flutter not on base PATH). Push from an
  activated PowerShell (pre-push hook needs node). `graphify` is NOT installed on this machine — treat
  it as absent; verify against actual files.
- Gate before every PR: `flutter analyze` + `flutter test` + `node tools/context_sync.mjs --check` +
  every touched package's own suite. Behaviour changes need live proof recorded in the session log.
- Update this log's worklist row + ledger row as part of finishing each unit (same/next commit).
- `deno` is absent locally — edge-function type-checking is the CI `deno-check` job; a first-run type
  failure surfaces on the PR, not locally.
