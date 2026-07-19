---
title: Phase-2 Research-Fixes — Sign-off Decisions
summary: Judgment calls made during the remediation run (D-entries). Choice · alternatives rejected (with why) · AMENDED lines appended, never rewritten. Lane-C method changes that flag an ADR amendment record the amendment intent here. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

# Phase-2 Research-Fixes — Sign-off Decisions

Entry format: **Choice · Alternatives rejected (with why) ·** optional dated **AMENDED** lines
(appended — the original stays visible). Anything a human might reasonably have decided differently
gets a D-entry; later units cite D-refs instead of re-arguing. Numeric values go in the config-decisions
doc (C-entries), not here.

## Decisions

### D1 · Run structure — stacked session-PR chain off `dev-phase2`, human-gated merge
**Choice:** Each remediation unit is a session branch cut from the chain tip (first unit off
`dev-phase2`), one commit, one PR stacked on its predecessor, left open for Jayden to merge in order.
This run never merges and never touches `main`.
**Alternatives rejected:** self-merge (merging is human-gated on this repo — not ours to do);
one big branch (loses per-unit reviewability and the lane-classification audit trail).

### D2 · Lane classification governs unit scope
**Choice:** Every verdict is assigned a lane (A verify-first / B safe-fix / C method-change) and the
lane bounds what the unit may do — B never rewrites accepted science; C never ships a guessed constant
and always appends (never overwrites) the accepted ADR rationale.
**Alternatives rejected:** treating every verdict as a fix-now (would silently rewrite accepted ADRs
and §11 values — explicitly forbidden by the run brief); treating every verdict as design-only (would
skip the cheap, unambiguous label/config corrections the review calls out).

### D3 · `deadbandK = 1.0` intent mismatch — instrument now, k is product-gated (F4, lane C, RU3c)
**The question (product decision, needs Jayden's sign-off):** is S4's daily 3-state signal meant to be
an **occasional anomaly alert** or a **~1-in-3 daily 3-state nudge**? `deadbandK = 1.0` (robust-σ̂
units) means `neutral := |x − median| ≤ 1.0·σ̂`, so under a Gaussian only ~68.3% of days are neutral and
S4 **fires ~31.7% of days (~15.9% up / ~15.9% down); under heavier tails it fires *more***
(evidence-review `decisions-evidence-review.md` §RU3c; ground truth = ADR-0002 §S4 + Open-Q2). A ~32%
fire rate is defensible ONLY for the "nudge" reading; if the intent is "anomaly", `k = 1.0` is far too
tight and `k` should be substantially larger (**likely > 1.5**). **The number is arbitrary and the
intent is a product call — F4 did NOT choose `k`.**
**Choice (what F4 shipped):** keep `deadbandK = 1.0` (provisional) unchanged everywhere, and ship the
**mechanism + instrumentation** to make the intent resolvable on data instead of by guess: a pure,
deterministic `fireRate(states)` helper (`evaluate-signals/stats.ts`) wired to log the per-metric fire
rate for each run (`evaluate-signals/index.ts`, measurement-only — no threshold or classification
touched, also surfaced in the handler response as `fireRates`). Calibration of `k` to a *target fire
rate* on real n=1 traces is backlogged (blocked-register **B3**); resolving the intent is human-gated.
**Alternatives rejected:** picking a new `k` (e.g. 1.5) now — forbidden (lane C ships no guessed
constant, and the target depends on the unresolved intent + real fire-rate data); silently rewriting
the accepted ADR-0002 rationale — forbidden (append-only).
**ADR-0002 amendment intent (the exact text that must change if the intent is resolved as "anomaly" —
flagged for retro-review; NOT applied in-run, see the note below):**
- **§S4, the `deadbandK = 1.0` deadband line (~line 88):** the "firing ~1 day in 3" parenthetical must
  be reconciled with the intent — if "anomaly", `deadbandK` must rise (likely > 1.5) so the fire rate
  matches an anomaly target; if "nudge", the ~1-in-3 rate should be stated as *intended*, not incidental.
- **Open question 2 (~line 136):** append a dated note (verbatim below) recording RU3c's ~31.7% Gaussian
  fire rate (more under heavy tails), that this contradicts an "anomaly" reading, that calibration should
  target a *fire rate* and may need `k > 1.5`, that the `fireRate` instrumentation now exists to gather
  the data, and that intent resolution is pending product sign-off. The append text:
  > **AMENDED 2026-07-19 (evidence-review RU3c · phase2-research-fixes F4 / D3 — retro-review needed):**
  > the evidence review confirms `deadbandK = 1.0` leaves only ~68.3% of days neutral and **fires ~31.7%
  > of days under a Gaussian (~15.9% up / ~15.9% down), more under heavier tails** — a rate that
  > *contradicts* an "occasional anomaly alert" reading and is defensible only if the intended product
  > behaviour is a ~1-in-3 daily 3-state nudge. **Resolving that intent is a product decision pending
  > Jayden's sign-off; the run did not choose `k`.** `deadbandK` stays **1.0 (provisional)** until then.
  > Calibration should target a *fire rate* (not merely sweep a range) and may need **k > 1.5** if the
  > intent is "anomaly". A deterministic `fireRate(states)` instrumentation helper
  > (`evaluate-signals/stats.ts`, logged per metric per run by `index.ts`) now exists to accrue the real
  > n=1 fire-rate data this calibration needs. *(Additive open-question note; the accepted S4 rationale
  > above is unchanged.)*
- **Why the append is recorded here, not applied to the ADR in-run:** ADR-0002 is `status: accepted`, and
  `context_sync --check` (pre-push hook + non-bypassable CI) enforces that *an accepted decision's body is
  immutable* (`tools/context_sync.mjs` `checkEditHonesty`) — I verified this empirically (a trial ADR
  append failed the check with "an accepted decision's body is immutable — supersede it instead of
  editing"). So even an additive open-Q append cannot land in-run without failing the gate. Per this
  doc's own charter ("Lane-C method changes that flag an ADR amendment record the amendment intent here")
  the amendment intent is recorded above and **flagged for shared/ retro-review**: a human applies the
  Open-Q2 append (and, if resolved, the §S4 change) through the ADR's 2-reviewer / supersede channel.
  **Deviation from the F4 brief** (which asked for the append to be applied to ADR-0002 directly): the
  brief's premise that the append could land while `context_sync` stays green does not hold against the
  immutability guard; nothing about the substance changes — same append text, same retro-review flag —
  only the mechanism (recorded-as-intent for human application vs applied-in-run).

### D4 · Pyper–Peterman → xDF effective-N — ship the swappable seam, do NOT hand-roll xDF in-run (F6, lane C, RU4d)
**The finding (RU4d, applied not re-derived):** the Pyper–Peterman/Bartlett effective-N depends only on
**each series' OWN** autocorrelation (`Σ ρ_XX·ρ_YY`) and is "substantially biased by non-zero
**cross-correlation**" — yet the S5 detector *selects pairs precisely because they co-move*, i.e. the exact
non-zero-cross-correlation failure regime. The cross-correlation-aware **xDF** (Afyouni–Smith–Nichols 2019;
ADR-0002 Open-Q8 candidate) is the principled fix (`decisions-evidence-review.md` §RU4d). Note the separate
formula-constant worry is already resolved: verify-first **A1** confirmed the coded estimator is the
canonical **2/N** Bartlett/Bayley–Hammersley/Pyper–Peterman form with the N/(N−j) correction (Open-Q1
resolved-confirmed; `phase2-research-fixes-findings.md` §A1) — so F6 changes **nothing** about the P&P math.
**Choice — why xDF is NOT hand-rolled in this run:** (1) the **exact Afyouni xDF equations are not
obtainable from an accessible source** — the primary paper and the preprint are paywalled; only the
algorithm *shape* is public. (2) A faithful xDF needs **FFT-based auto/cross-correlation** + a
**regularization** step (Tukey taper at M≈√T, or adaptive truncation) + **verification against reference
vectors**. (3) This run's **honesty invariant forbids shipping unverified science as functional** — an
unverified hand-rolled xDF presented as a working estimator would violate it. So F6 ships the **mechanism,
not the science**.
**What F6 shipped:** a `nEffMethod: 'pyper-peterman' | 'xdf'` toggle on the S5 pair config (`NEffMethod`
type + optional `PairConfig.nEffMethod` in `evaluate-signals/stats.ts`; value `'pyper-peterman'` in
`PAIR_CONFIG`, `config.ts`). `effectiveN` now **dispatches** on the method (defaulting to `'pyper-peterman'`
when absent, so every existing caller/fixture is unaffected): the P&P path is **extracted verbatim** into a
named `effectiveNPyperPeterman(a,b,cfg)` helper — **byte-identical result** (regression-proven in
`s5_pairwise.test.ts`: default reproduces the existing N_eff vectors exactly, and explicit
`'pyper-peterman'` equals the default); the `'xdf'` branch is an **explicitly-INTERIM seam that THROWS**
(`"nEffMethod 'xdf' not yet implemented — faithful Afyouni xDF port + reference-vector verification pending
(phase2-research-fixes B5). Cross-correlation-aware effective-N is the principled fix for co-moving pairs
(RU4d/Open-Q8) but must not ship unverified."`). A throwing seam is deliberate: the dispatch/mechanism is
swappable, but no unverified numeric runs.
**Alternatives rejected:** hand-rolling an xDF numeric now (forbidden — inaccessible exact equations +
unverified science violates the honesty invariant); a silent `'xdf' → P&P` fallback (rejected — would
masquerade an unimplemented method as working); leaving P&P as the only path with no seam (rejected — RU4d
is a real co-moving-pair bias and the mechanism should exist and be swappable now, port later).
**Backlog port recipe (→ B5):** port `xDF.m` / `AC_fft.m` / `xC_fft.m` from the open reference repo
`github.com/asoroosh/xDF`; write a **deterministic TS port** and verify it against **reference vectors
generated from the MATLAB/Octave reference** (fixed seeds, tabulated N_eff outputs checked to tolerance);
choose the **regularization** (Tukey taper M≈√T, or adaptive truncation) and record the choice; then flip
`PAIR_CONFIG.nEffMethod` to `'xdf'` (or make it per-run) and **calibrate the P&P→xDF switch on real
co-moving-pair n=1 data**.
**ADR-0002 amendment intent (recorded NOT applied — flagged for shared/ retro-review; ADR-0002 is
`status: accepted` and its body is immutable under `context_sync --check`, same constraint as D3). Verbatim
would-be appends to ADR-0002 "Open questions / calibration plan":**
- **Open question 1 (the P&P formula-constant verification, ~line 135) → resolved-confirmed:**
  > **AMENDED 2026-07-19 (evidence-review RU4d / verify-first A1 · phase2-research-fixes F6/A1 — retro-review
  > needed):** RESOLVED-CONFIRMED. The coded S5 effective-N is the canonical Bartlett/Bayley–Hammersley/
  > Pyper–Peterman form — leading coefficient **2/N** (not `1 + 4Σ/N`, which double-counts the symmetric lag
  > sum and is **not** what the code uses), the **N/(N−j)** small-sample bias correction on each sample
  > autocorrelation, and the lag sum truncated at **⌊N/5⌋** (`maxLagFraction = 0.2`). The primary Pyper–
  > Peterman PDF is paywalled, but the verdict rests on the unambiguous underlying Bartlett result. The N/5
  > truncation is a P&P-supported window choice (a config knob), not a unique "correct" constant. *(Additive
  > resolution note; the accepted S5 rationale above is unchanged.)*
- **Open question 8 (candidate xDF substitution, ~line 142) → seam shipped, faithful impl pending:**
  > **AMENDED 2026-07-19 (evidence-review RU4d · phase2-research-fixes F6 — retro-review needed):** The
  > Pyper–Peterman/Bartlett estimator depends only on each series' OWN autocorrelation (`Σ ρ_XX·ρ_YY`) and is
  > "substantially biased by non-zero cross-correlation" — the exact regime this detector operates in, since
  > it selects pairs BECAUSE they co-move (RU4d). The cross-correlation-aware **xDF (Afyouni–Smith–Nichols
  > 2019)** is the principled fix. F6 shipped a **swappable seam**: `PAIR_CONFIG.nEffMethod` toggles
  > `'pyper-peterman'` (default, unchanged) vs `'xdf'`; the `'xdf'` branch is an **INTERIM seam that throws**
  > until a faithful port is verified against reference vectors, because the exact Afyouni equations are not
  > accessibly available and an unverified hand-roll would violate the run's honesty invariant. **Faithful
  > xDF port + reference-vector verification + P&P→xDF switch calibration are backlogged (phase2-research-
  > fixes B5).** *(Additive open-question note; the accepted P&P choice above is unchanged.)*
- **Confirmation:** ADR-0002 (`docs/shared/decisions/0002-anomaly-definition.md`) was **left byte-unchanged
  in-run** — `git status` shows it unmodified and `context_sync --check` passed; the two appends above are
  recorded here as amendment intent for a human to apply via the ADR's 2-reviewer / supersede channel.
**Deviation from the F6 brief:** the brief asked for the Open-Q1/Open-Q8 appends; per the accepted-ADR
immutability guard (discovered in F4/D3) they are recorded as amendment intent here rather than applied to
the ADR body — same append text, same retro-review flag, only the mechanism differs.
