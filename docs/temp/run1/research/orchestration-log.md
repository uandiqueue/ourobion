---
title: Phase-2 Decisions Research — Orchestration Log
summary: Resumable state of the record-only evidence review of the Phase-2 config/sign-off decisions. Triage, per-decision worklist, ledger, and where a fresh session resumes. Findings accumulate in decisions-evidence-review.md; citations in references.md. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-18
---

# Phase-2 Decisions Research — Orchestration Log

Record-only evidence review: do the empirical/quantitative decisions the Phase-2 run made hold up
against the literature? **Evaluate and cite — never change a decision, config value, or code.**

A fresh session **resumes here**: read this doc top-to-bottom, then jump to the first unit whose
status is `in-progress` (redo it) or, if none, the first `next` unit.

## Resume protocol (this is what makes the run survive a sudden session end)

1. **One unit at a time.** Never start a second before closing the first.
2. **Before starting a unit**, set its status to `in-progress` here and save.
3. **While working a unit**, append its section to `decisions-evidence-review.md` and its sources to
   `references.md` *as you go* — a killed session must lose at most the one in-flight decision.
4. **When a unit is done**, set status `done`, add a ledger row, move the ▶ RESUME pointer, then start
   the next unit.
5. `in-progress` on resume = the previous session died mid-unit; re-run that whole unit and dedup.

## Ground rules

- Decision docs (dev aids) live in `docs/temp/run1/config-decisions.md` (C1–C12) and
  `docs/temp/run1/signoff-decisions.md` (D1–D15). Their scientific ground truth stays in
  `docs/shared/`: ADRs decisions/0001–0003, architecture §11 hyperparameter registry.
- Use the deep-research approach (invoke the `deep-research` skill if available): fan out searches,
  fetch primary/authoritative sources, adversarially sanity-check before citing.
- Data regime to judge methods against: n=1 daily self-tracking — small samples, ordinal/non-normal,
  autocorrelated series.
- **Be honest where no source supports a value** — mark it "engineering judgment, uncited" rather
  than inventing support. Every non-obvious claim carries a citation.

## Worklist

▶ **RESUME AT: — (COMPLETE)** — all empirical units RU2–RU7 + executive summary done 2026-07-18. No
unit remains. Any future work is a top-up pass (e.g. RU5's budget-truncated leads, or the ADR-0002
Open-Q1 P&P formula-constant verification), not a resume.

| # | Unit | Status | Notes |
|---|------|--------|-------|
| RU0 | Bootstrap scaffolding (this log + empty review + references) | **done** | seeded 2026-07-17 |
| RU1 | **Triage** — classify every C1–C12 and D1–D15 as (a) empirical/scientific or (b) process/engineering. Write the triage table into decisions-evidence-review.md. **Then expand the worklist below**: add one RU unit per empirical decision (group tightly-related ones). List (b) items as "no research needed" | **done** | 6 empirical units; 21 items process/no-research (see triage table) |
| RU2 | **C1 + C2 — edge gating & scoring**: `EDGE_GATES` 0.8/0.5; edgeScore weights confidence 0.6 / tier 0.25 / corroboration 0.15, saturation at 3 sources; ADR-0003 OCEBM tier basis; impactTier exclusion | **done** | verdicts: gates arbitrary→calibrate; weights uncited-keep; OCEBM anchor half-supported; saturation-3 convention; impactTier exclusion literature-supported |
| RU3 | **C3 + D5 + D12a — robust anomaly baseline**: median + MAD (σ̂ = MAD/0.6745), deadbandK 1.0, 28d rolling window, baselineMinDays 14 (re-checked post artifact rejection), \|M\|>3.5 artifact rejection, MAD-degeneracy fallback; D11 daily-mean aggregation side note | **done** | median+MAD/0.6745/3.5 supported (3.5 is convention, NOT sim-calibrated); deadbandK=1.0 arbitrary + likely too hot (~32% fire); 28d convention; minDays=14 unsupported; D5 robust-units correct; D11 mean vs median flagged |
| RU4 | **C4 + D12b + D14a — n=1 evaluator gates**: Spearman \|ρ\|≥0.3, BH FDR q≤0.05, Pyper–Peterman N_eff≥10, 60d window, 3 fixed deterministic windows stability; 105-pair BH-per-user-per-run scope; serve gate reuse | **done** | Spearman supported; \|ρ\|≥0.3 mislabeled "medium" (really top-quartile); BH PRDS not assured for 2-sided; P&P biased for co-moving pairs → xDF; 3-window stability not real CV; BH-once-per-run correct unit; P&P formula-constant (Open-Q1) still unresolved |
| RU5 | **C5 — baseline confidence cutoffs** 3/5/14 days (vs deployed 3/7/14) | **done** | 3-day LOW floor literature-supported (steps/cortisol/MVPA); **7→5 medium change is the weaker choice — lit leans 6–7, nothing supports 5**; 14 HIGH conservative convention; ladder should be per-metric. PARTIAL run (12/25 verified, 13 unverified on session limit, 0 refuted) — findings rest on confirmed only |
| RU6 | **C8 — venue impactTier bands**: SJR Q1/Q2, OpenAlex h-index ≥100/≥50, preprint class; JIF rejection | **done** | scientometrics. Clean re-run `wf_08dfe058-deb` 2026-07-18 (25/25 confirmed, 0 refuted). Verdicts: SJR>JIF supported; SJR quartiles standard (boundary-churn uncharacterized); venue h-index valid-but-size/field-biased; **h≥100/≥50 cutoffs arbitrary+uncited, unjustifiable as global integers → field-normalize/percentile**; OpenAlex viable but volatile & "runs hotter" than SJR; **OR-combination = weakest seam (recall-favoring, not principled)**; **JIF-rejection + notability⊥trust = strongest choice, strongly supported**; preprint tier justified as provenance (~90% concordance) |
| RU7 | **C10 — correlation lag windows** {0,1,3,7} days over brain-neighbour pairs | **done** | run wf_e510d832-3e7 (19/25 confirmed, 6 refuted). Verified vs code (`ALLOWED_LAG_DAYS={1,3,7}`+null-lag-0, brain-neighbour scoped). Verdicts: 0–7d span physiologically plausible (gut 1–3d, short exposures 0–7d, DOMS 1–2d) but grid NOT calibrated; **exact {0,1,3,7} + skipping 2/4/5/6 has no lit support (log-spaced heuristic)**; consider adding lag 2 (gut & DOMS peak near 1–3d boundary); 7-day cap truncates cold/slow exposures; **the real risk is statistical — uncorrected autocorrelation → ~30% false positives at ~60d windows; must prewhiten/deseasonalize before CCF**; lag-7 confounded with weekly periodicity; treat 4 lags as ONE hypothesis not 4 FDR entries; brain-neighbour scoping is a genuine mitigation |
| RU-final | **Executive summary** — rank decisions: well-grounded → weakest / most in need of calibration | **done** | 2026-07-18. 3-tier ranking + cross-cutting themes + urgent-order list written into decisions-evidence-review.md. Headline: architecture/exclusions well-grounded, specific numbers mostly uncited; systemic risks = autocorrelation (RU4+RU7) and the between-subjects→within-person transfer gap |

## Per-decision output structure (RU2…)

Each researched decision produces a section in `decisions-evidence-review.md` with:
- Restatement of the choice + the run's stated rationale/alternatives.
- **Method soundness** for the n=1 regime, with methodological citations (robust stats & MAD,
  Benjamini–Hochberg FDR, Spearman effect-size conventions, effective sample size for autocorrelated
  series, scientometrics on SJR vs Journal Impact Factor, OCEBM/GRADE evidence hierarchy).
- **Value defensibility:** "supported by literature" vs "reasonable convention" vs "arbitrary — needs
  calibration data".
- **Verdict:** keep as baseline / adjust (suggest range) / needs empirical calibration before trust.
- 1–3 full citations (author, title, venue, year, URL/DOI) mirrored into `references.md`.

## Session ledger

| When (UTC) | Unit | Decisions covered | Outcome |
|---|---|---|---|
| 2026-07-17 | RU0 bootstrap | — | scaffolding created |
| 2026-07-17 | RU1 triage | all C1–C12, D1–D15 classified | 6 empirical units queued (RU2–RU7): C1+C2, C3+D5+D12a, C4+D12b+D14a, C5, C8, C10; 21 items process/no-research |
| 2026-07-17 | RU2 | C1, C2 (+ADR-0003) | 18 refs added; composite-form literature hostile (Jüni 1999, Cochrane); weights/gates/saturation-3 uncited (gates need calibration); impactTier exclusion strongly supported; deep-research run: 23 sources, 21/25 claims confirmed |
| 2026-07-17 | RU3 | C3, D5, D12a (+D11 side note) | 11 refs added; median+MAD/0.6745/3.5 textbook-supported; deadbandK=1.0 arbitrary + intent mismatch (~32% Gaussian fire vs "anomaly"); 28d window convention, minDays=14 unsupported; D5 robust-units vindicated; D11 mean→robust-detector seam flagged. Run resumed from wf_d8797fbd-644 (empty 1st finish); 21 sources, 21/25 confirmed, 4 refuted (incl. the 3.5-sim-calibration & 21-day-HRV claims) |
| 2026-07-17 | RU4 | C4, D12b, D14a (+D11 none) | 9 refs added; Spearman supported; \|ρ\|≥0.3 conservative (top-quartile) not "medium" — label fix; BH PRDS unproven for 2-sided/shared-metric (BY fallback ready); P&P biased for co-moving pairs → recommend xDF (Open-Q8), N_eff≥10 uncited, P&P formula-constant Open-Q1 STILL unresolved/blocking; 3-window stability ≠ CV; BH-once-per-run = correct family unit; D14a inherits C4. Run wf_00f27499-a9c: 23/25 confirmed, 2 refuted (Pearson-disqualified, Kendall-for-small-n) |
| 2026-07-18 | RU5 | C5 | 5 refs added; 3-day LOW floor supported; **medium 7→5 change is weakly-grounded — lit favors 6–7, no support for 5**; 14 HIGH conservative convention; recommend per-metric cutoffs. Run wf_663d829a-e54 PARTIAL (session limit hit mid-verify): 12/25 confirmed, 0 refuted, 13 unverified-on-budget. Written from confirmed claims only; unverified leads (14d EMA, PMID 9989370 sleep 5-vs-7) noted for future top-up |
| 2026-07-18 | RU-final | — (synthesis) | Executive summary written: Tier-1 well-grounded (impactTier-exclusion/JIF-rejection strongest; robust MAD; Spearman; SJR>JIF; 3-day floor; BH-per-run + brain-neighbour scoping), Tier-2 conventions, Tier-3 weakest (autocorrelation handling #1, deadbandK, P&P/xDF, |ρ|≥0.3 label, C5 7→5, h-index 100/50, OR-combo, composite gates/weights). Cross-cutting: autocorrelation + transfer-gap are the systemic issues; architecture right, magic-numbers unproven. Review COMPLETE |
| 2026-07-18 | RU7 | C10 | 12 refs added; run wf_e510d832-3e7 (19/25 confirmed, 6 refuted — rigorous). 0–7d span physiologically plausible (gut 1–3d, exposures 0–7d DLNM, DOMS 1–2d); exact {0,1,3,7}/skip-2 uncited log-spaced heuristic; **dominant risk is statistical: uncorrected autocorrelation → ~31% FP (AR=0.8, n=50), still inflated at n≈40–60 → prewhiten/deseasonalize before CCF**; lag-7 ↔ weekly periodicity; 4 lags = 1 hypothesis (not 4 FDR entries); brain-neighbour scoping mitigates. Refuted & excluded: orocecal 3.75h, pollen ≤60h/0–4d, exercise→HRV 1-day, DLM df L+1−p |
| 2026-07-18 | RU6 | C8 | 22 refs added; clean re-run wf_08dfe058-deb after 2 prior transient failures (25/25 confirmed, 0 refuted). SJR>JIF & JIF-rejection/notability⊥trust separation strongly supported (Seglen/Larivière/Zhang-Rousseau-Sivertsen/DORA + Fang-Casadevall & Brembs retraction↔rank); SJR quartiles standard but Q1/Q2 boundary churn uncharacterized; venue h-index valid notability metric (Braun 2006) but size/field-biased (Schubert-Glänzel; Bihari); **100/50 cutoffs arbitrary & uncited, unjustifiable as global integers given field-incomparability — recommend field-normalization/percentile**; OpenAlex viable but maintainer-flagged volatile & runs hotter than SJR; **OR-combination is the weakest seam — recall-favoring heuristic, not principled**; preprint tier justified as provenance (concordance ~90–98%, quote-extracted). §f/§h quote-extracted (below 25-verify budget), flagged |

## Notes for the resuming researcher

- Do not edit the decision docs, the ADRs, or any code. The only files you write are this log,
  `decisions-evidence-review.md`, and `references.md`. Do not commit or push.
- **Skill added 2026-07-18:** `.claude/skills/evidence-review-run/SKILL.md` — captures this run's
  repeatable procedure (RU-unit resume protocol, deep-research-per-unit method, verify-shipped-values-
  first, honesty conventions, and the deep-research harness failure-recovery gotchas). Sibling to the
  existing `record-only-audit` skill.

### Progress note (updated 2026-07-17, resume pointer now at RU4)

- **RU2 and RU3 are fully committed** to `decisions-evidence-review.md` (+ refs) — do not redo them.
  (RU3's original run `wf_d8797fbd-644` finished the first time with an *empty* output; it was resumed
  from cache and completed cleanly — noted here in case that empty file is still on disk.)
- Pattern that worked for RU2/RU3: one `deep-research` Workflow per unit with a tightly-scoped
  multi-part question; verify shipped values against ADR/code before writing verdicts; when a workflow
  reports an empty result, resume via `{scriptPath, resumeFromRunId}` before re-running from scratch.
- **RU4 (next)** covers C4 + D12b + D14a — the n=1 evaluator gates (Spearman |ρ|≥0.3, BH q≤0.05,
  Pyper–Peterman N_eff≥10, 60d window, 3-window stability) + the 105-pair BH-per-run scope + the serve
  gate's reuse of those thresholds. ADR-0002 §S5 is the ground-truth source and is already densely
  cited (incl. an open item to verify the Pyper–Peterman denominator constant against the primary PDF —
  worth resolving in RU4).
