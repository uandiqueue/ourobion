# Session 20260719T161537Z — agentjwork — claude — research-fixes-composite-calibration

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable, build) · **Branch:**
  `docs/research-fixes/composite-gates-weights-calibration` (off chain tip
  `origin/docs/research-fixes/impacttier-heuristic-limits`, PR #113) · **Issue/PR:** see footer
- **Type:** unit **F8** — the **LAST** unit of the phase2-research-fixes remediation run — **lane C
  (method/science change)**, but **provisional-marking comments + backlog/bookkeeping ONLY, NO scoring
  change**. The cheap code guardrail (report components alongside the composite) already shipped in **F3**;
  ADR-0003 already documents the calibration plan (Open-Q 1–2); F8 records that the calibration is tracked
  and marks the gate/weight numbers provisional at the code site.

## Attempted
- Read `decisions-evidence-review.md` **§RU2** verdicts **a/b/f** — **RU2a** (the additive composite-score
  *form itself* is literature-**hostile**: Jüni 1999 — the "high-quality" trial subset flips with the quality
  scale chosen → Cochrane abandoned numeric quality scores for domain-by-domain judgment; GRADE is not an
  additive formula), **RU2b** (weights 0.60/0.25/0.15 are **engineering judgment, uncited** — no literature
  supports these or any composite weights), **RU2f** (gates 0.8/0.5 have no published basis and, on an
  uncalibrated `edgeScore`, have **no operational meaning beyond rank order** — contrast Knowledge Vault's
  Platt-calibrated 0.9/0.7 gates).
- Read `phase2-research-fixes-findings.md` + the F3 ledger / config-decisions **C2** to see exactly what the
  components guardrail shipped in F3 — `EDGE_WEIGHTS` config object + pure `edgeScoreComponents()` reporting
  the parts (confidence · tier · corroboration) alongside the composite — so F8 does NOT duplicate it.
- Read `shared/brain/index.ts` (`EDGE_GATES` 0.8/0.5, `EDGE_WEIGHTS` from F3, `edgeScore`/`servingBand`/
  `edgeScoreComponents`) and `docs/shared/decisions/0003-paper-reliability.md` §4 (gates by exemplar
  behaviour) + Open-Q 1–2 (the accepted calibration plan) — for the amendment-intent text (did NOT edit it;
  it is `status: accepted`).

## Changed (committed)
- **`shared/brain/index.ts`** — **comments only, NO value / formula / gate / weight changed.**
  (a) `EDGE_GATES` doc block + inline `high`/`mid` comments: marked the gates **0.8/0.5 provisional &
  uncalibrated** — until calibrated against a GRADE-rated exemplar set (ADR-0003 Open-Q 1–2), `high`/`mid`
  are **rank-order UX bands, not truth claims**; gates on an uncalibrated score have **no operational meaning
  beyond rank order** (RU2f; the Knowledge-Vault Platt-calibration contrast + Jüni scale-dependence);
  calibration backlogged **B7**. (b) `EDGE_WEIGHTS` doc block: added the **RU2a** note that the additive
  composite *form itself* is literature-contested (Jüni 1999 → Cochrane domain-wise judgment; GRADE not
  additive), that F3's `edgeScoreComponents()` reporting is the **domain-wise-transparency guardrail** (first
  step of the mitigation), and that the remedy is ADR-0003 Open-Q 1–2 (fit weights against GRADE-rated
  Cochrane exemplars; weigh replacing the additive form with domain-wise reporting) — calibration backlogged
  **B7**. The existing F3 "uncited (RU2b)" provisional language was kept and NOT duplicated.
- **Bookkeeping (dev-aid docs, docs/temp):** blocked-register **B7** (calibrate `EDGE_GATES`/`EDGE_WEIGHTS`
  against a GRADE-rated Cochrane exemplar set + weigh replacing the additive form with domain-wise reporting;
  needs the GRADE-rated exemplar dataset we don't have; gates nothing — bands usable as rank-order
  provisionals); config-decisions **C1** (gates 0.8/0.5 + weights 0.6/0.25/0.15 re-affirmed UNCHANGED,
  provisional-uncalibrated; F3 shipped the components guardrail; calibration backlogged B7; no value changed);
  signoff **D5** (RU2a,b,f *corroborate* ADR-0003 Open-Q 1–2 — amendment intent recorded, NOT applied to the
  accepted ADR; ADR-0003 byte-unchanged); orchestration **F8 row → done** + ledger row + ▶ RESUME →
  **— (COMPLETE)** + new chain tip.

## Decided
- **Comments + bookkeeping only, no scoring change (the whole F8 scope).** RU2a,b,f do not call for a value
  change — they call for the numbers to be *marked provisional* and the calibration *tracked*. The value fix
  (fit weights + set gates against GRADE-rated Cochrane exemplars) needs a gold exemplar dataset this repo
  does not have → backlog **B7**, never a guessed constant (lane-C rule).
- **Did NOT re-implement the F3 guardrail.** The `EDGE_WEIGHTS` config object + `edgeScoreComponents()`
  component reporting — the Cochrane-style domain-wise-transparency step RU2a implies — already shipped in F3;
  F8 only *points at* it from the new comments.
- **RU2a,b,f corroborate ADR-0003's *existing* Open-Q 1–2 (no new open question).** Unlike D3/D4 (which added
  ADR appends), the ADR-0003 calibration plan already says every weight and gate is provisional-pending-
  calibration and that gates on an uncalibrated score need the exemplar set. The review's contribution is the
  *external* literature backing (Jüni/Cochrane; the composite-form hostility; the Platt-calibration contrast)
  + the **form-replacement** angle. Recorded as amendment intent in **D5**; ADR-0003 left byte-unchanged (the
  `context_sync --check` accepted-body immutability guard forbids editing it in-run, as in F4/F6).

## Left (worklist — run COMPLETE)
- **All F0–F8 done.** F8 is the last unit; the orchestration log ▶ RESUME pointer is moved to
  **— (COMPLETE)**.
- **B7** (calibrate gates/weights against a GRADE-rated Cochrane exemplar set + weigh the additive-form
  replacement) — backlog; needs the GRADE-rated exemplar dataset; gates nothing. Joins the open backlog
  register (B1–B7) the run hands off.

## Blockers
- **None for F8's shippables.** The calibration is deliberately backlogged (B7) — the expected lane-C end
  state (mark the constant provisional at the code site + backlog the data-gated calibration, never a guessed
  constant), not a blocker.
- **Gate results:** `node tools/context_sync.mjs --check` **passed** (no accepted-doc body edited; ADR-0003
  `git hash-object` identical before/after = `34f37f4…`); `npm --prefix tools/edge-loader run typecheck`
  (tsc --noEmit) **clean**; `npm --prefix tools/edge-loader test` **45/45 pass — UNCHANGED from F3's 45**
  (comments/docs only, no behaviour change — the live proof: the regression tests asserting `edgeScore` /
  `servingBand` are byte-identical to the pre-refactor formula and that the gates/serving-band range are
  unchanged all pass); `flutter analyze` (apps/biotope) **No issues found**; `flutter test` **not run** (no
  Dart/asset touched → unaffected). No generated-plugin churn (git status = only the intended files).

memory: F8 closes the phase2-research-fixes run — all F0–F8 shipped as a stacked human-gated PR chain
(#99→…→this PR) off `dev-phase2`; nothing merged (Jayden merges in order). The run hands off open backlog
**B1–B7** (all data-/product-gated calibrations, each gating nothing) + amendment-intent **D3/D4/D5** for
ADR-0002/0003 retro-review (accepted-ADR bodies left byte-unchanged; the `context_sync --check` immutability
guard blocks in-run appends). Reusable pattern (F8): lane-C "an accepted uncalibrated constant is
literature-contested but calibration needs a gold dataset we don't have" → **mark it provisional at the code
site (comments), point at the already-shipped cheap guardrail, and backlog the calibration** (no scoring
change, no guessed constant); if the finding *corroborates* an existing ADR open question rather than adding
one, say so in the amendment intent instead of inventing a new open-Q.

---
Issue: #114 · PR: #115 (base `docs/research-fixes/impacttier-heuristic-limits`) · commit `<pending>` (comments + bookkeeping).
Part of #98. **Run COMPLETE — last unit.**
