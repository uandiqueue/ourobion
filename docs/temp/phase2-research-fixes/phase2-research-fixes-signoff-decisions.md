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
