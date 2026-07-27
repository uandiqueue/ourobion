---
title: Phase-2 Research-Fixes — Blocked Register
summary: Human-gated / data-blocked items for the remediation run (B-entries). Where it stopped · what is needed · what it gates. Lane-C calibration items whose "right number" needs data we don't have live here as backlog, with the shipped mechanism referenced. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-20
---

> **ARCHIVED 2026-07-26 — historical run record. Do not build from this; kept for provenance.** Current product planning: [Run 3](../../../../temp/run3/README.md).

# Phase-2 Research-Fixes — Blocked Register

Format: **where it stopped · what is needed from Jayden (or what data) · what it gates.** Numbered
`B1, B2, …`; closed items stay in place marked DONE/CLOSED with a resolution note. The run skips these
and keeps building; when one unblocks, the orchestrator picks it up from here.

Lane-C rule: where a "right" value needs data we don't have, the unit ships the **mechanism +
instrumentation** and records the **calibration** here as a backlog item — never a guessed constant.

## Open

- **B1 · Per-metric medium confidence cutoff (from F2 / RU5b)** — *where it stopped:* F2 reverted the
  S3 medium cutoff to the single global `7` in-window days. RU5b's stronger recommendation is to make
  the cutoff **metric-dependent** (the right day-count depends on a metric's within-person variability —
  cortisol slope needs 5–10 days, steps ~3, sleep 6–7), but that is a lane-C *mechanism* change, not a
  value tweak. *What is needed:* per-metric within-person variability / reliability data (day-count for
  target ICC per signal), plus a mechanism to carry a per-metric cutoff (analogous to the per-metric
  `deadbandK` registry field) — neither exists yet. *What it gates:* nothing — the global `7` is a safe
  provisional and blocks no other unit; unblock when per-metric reliability data lands.

- **B2 · Persist the edgeScore component breakdown to the edge read store (from F3 / RU2b)** — *where
  it stopped:* F3 shipped the pure `edgeScoreComponents(v)` and surfaces the breakdown (confidence ·
  tier · corroboration · contributions · multiplier · composite · band) in the loader's per-edge review
  log — the cheap, non-persisted guardrail. Persisting it alongside `edge_score` / `serving_band` in the
  `edge_verifications` projection (so a UI/reviewer reads it from the DB, not just loader stdout) would
  need a **new column / migration on a git-tracked truth-tier contract** (`shared/brain` + the S6 table
  schema), which is a 2-reviewer shared-contract change (docs/memory/0002) — out of lane B's additive/
  non-schema scope. *What is needed:* a shared-contract PR adding the column(s) + migration + the
  ts↔db parity guard, gated on 2-reviewer sign-off; and a decision on whether to store the full
  breakdown or recompute-on-read (it is a pure function of the already-stored `verification` jsonb, so
  recompute-on-read is viable and may make persistence unnecessary). *What it gates:* nothing — the pure
  function + loader review log already satisfy the RU2 guardrail without a truth-tier change; unblock if
  a DB-backed reviewer UI needs the components server-side.

- **B3 · Resolve `deadbandK` intent + calibrate `k` to a target fire rate (from F4 / RU3c)** — *where it
  stopped:* F4 shipped the **mechanism + instrumentation** (the per-metric `deadbandK` registry field
  already exists; F4 added the pure `fireRate(states)` helper in `evaluate-signals/stats.ts`, wired to log
  the per-metric fire rate per run in `evaluate-signals/index.ts` and surfaced as `fireRates` in the
  handler response). It did **not** change `deadbandK` — it stays **1.0 (provisional)** everywhere. *What
  is needed:* **(1) a product decision from Jayden** — is S4's daily 3-state signal an *occasional anomaly
  alert* or a *~1-in-3 daily 3-state nudge*? RU3c shows `k = 1.0` fires ~31.7% of days under a Gaussian
  (more under heavy tails), which contradicts an "anomaly" reading; if "anomaly", `k` likely needs to be
  **> 1.5** (D3). **(2) Real per-metric n=1 fire-rate data** — now gatherable from the `fireRate` logging
  as runs accrue — to calibrate `k` to the chosen target fire rate (ADR-0002 Open-Q2's 0.75–1.5 sweep is
  the starting plan, but may need to extend past 1.5). *What it gates:* nothing — `deadbandK = 1.0` is a
  safe provisional and blocks no other unit; unblock when the intent is signed off AND enough fire-rate
  data has accrued. **Also pending (retro-review):** the ADR-0002 Open-Q2 amendment (exact text in D3) is
  recorded as *amendment intent* rather than applied in-run, because the accepted-decision-body
  immutability guard (`context_sync --check`, pre-push + CI) forbids editing an accepted ADR body — a
  human applies it via the ADR's 2-reviewer / supersede channel.

- **B4 · Deseasonalize day-of-week before trusting lag-7 coincidences (from F5 / RU7f / A2 R2)** — *where
  it stopped:* F5 added lag 2 to the coincidence grid and documented the coincidence-path limitations, but
  did **not** touch the lag-7 window. A `coincidence` rule at `lagDays: 7` compares two baseline fires
  exactly 7 days apart, which **aligns with weekly calendar rhythm** — a lag-7 coincidence can reflect a
  day-of-week periodicity (e.g. weekend behaviour) rather than a real 7-day physiological horizon (the
  RU7f weekly-periodicity confound, narrowed by A2 to the boolean-conjunction surface — weaker than for a
  rank CCF, but still live). *What is needed:* a **day-of-week deseasonalize step** applied to the series
  before the lagged windowed-baseline recomputation (`windowedBaseline` in `generate-insights/
  evaluators.ts`), plus **real n=1 data** to confirm the confound bites in practice. Note serve-time
  prewhitening/deseasonalizing is **by-design offline per ADR-0002** — so any such step belongs in the
  offline-authoring pipeline, not the deterministic serve path; this backlog item is where that decision
  would be revisited if lag-7 coincidences prove unreliable. *What it gates:* nothing — the lag-7 window
  stays available and is a documented-limitation, not a bug; no shipped blueprint currently uses lag 7
  (both shipped coincidence rules are lag 1 / lag 0). Unblock when a lag-7 rule is authored AND real data
  shows the weekly confound matters.

- **B5 · Implement + verify the faithful cross-correlation-aware xDF effective-N, then calibrate the
  P&P→xDF switch (from F6 / RU4d / ADR-0002 Open-Q8)** — *where it stopped:* F6 shipped the **swappable
  mechanism** — a `nEffMethod: 'pyper-peterman' | 'xdf'` toggle on `PAIR_CONFIG` with `effectiveN`
  dispatching on it (P&P default, byte-identical; extracted `effectiveNPyperPeterman` helper). The `'xdf'`
  branch is an **INTERIM seam that throws** — no unverified science runs. It did **not** implement xDF.
  *Why not in-run:* the **exact Afyouni–Smith–Nichols (2019) xDF equations are not obtainable from an
  accessible source** (primary paper + preprint paywalled; only the algorithm shape is public), and a
  faithful xDF needs FFT-based auto/cross-correlation + Tukey-taper/adaptive-truncation regularization +
  verification against reference vectors — shipping an unverified hand-roll as functional would violate this
  run's honesty invariant (D4). *What is needed (port recipe):* (1) port `xDF.m` / `AC_fft.m` / `xC_fft.m`
  from the open reference repo `github.com/asoroosh/xDF`; (2) write a **deterministic TS port** and **verify
  it against reference vectors generated from the MATLAB/Octave reference** (fixed seeds, tabulated N_eff to
  tolerance); (3) choose + record the **regularization** (Tukey taper M≈√T, or adaptive truncation); (4)
  flip `PAIR_CONFIG.nEffMethod` to `'xdf'` (or make it per-run) and **calibrate the P&P→xDF switch on real
  co-moving-pair n=1 data**. *What it gates:* nothing — `nEffMethod = 'pyper-peterman'` is the safe,
  behaviour-unchanged default and blocks no other unit; the co-moving-pair bias (RU4d) is a documented
  method limitation, not a serve-path bug. The `effectiveN` throw message references this **B5**. **Also
  pending (retro-review):** the ADR-0002 Open-Q1 (resolved-confirmed, 2/N Bartlett/P&P) and Open-Q8 (xDF
  seam shipped, faithful impl pending) appends are recorded as *amendment intent* in **D4** rather than
  applied in-run (accepted-decision-body immutability guard); a human applies them via the ADR's 2-reviewer
  / supersede channel.

- **B6 · Replace the global 100/50 h-index cutoffs with a field-normalized / percentile rule + reconsider
  the SJR∨h OR-combination (from F7 / RU6d, RU6f)** — *where it stopped:* F7 **documented** the current
  heuristic's limitations at the code site (`tools/brain-ingest/src/venue/banding.ts`: strengthened comments
  on `IMPACT_BANDS_C8` and `bandImpactTier`) and left every value + the OR logic + tier order UNCHANGED. The
  global integers `highHIndexMin: 100` / `moderateHIndexMin: 50` are uncited and unjustifiable as global
  integers — journal/venue h is field- and size-dependent and not cross-field comparable (RU6d) — and the
  `SJR-quartile ∨ h-index` combination mixes non-commensurable metrics on non-commensurable databases with
  the more-permissive (hotter OpenAlex h) leg winning (RU6f). *What is needed:* **per-field reference data /
  per-field percentile distributions** (e.g. h-index or a field-normalized indicator's percentile within a
  Scopus/OpenAlex subject category) to define bands as *percentile-within-field* instead of raw global
  integers, OR adopt a **field-normalized indicator (SNIP or Journal Citation Indicator / JCI)** whose value
  is already cross-field comparable; then decide whether the two legs still combine (and if so AND vs OR).
  The three **fetched-but-unused** OpenAlex signals already on `VenueInfo` — `twoYrMeanCitedness`, `isCore`,
  `worksCount` (`tools/brain-ingest/src/venue/openalexSources.ts`) — are candidate inputs to a
  field-normalized / size-aware banding mechanism (none is wired into banding today; wiring them is exactly
  this backlogged mechanism, out of F7's docs-only scope). *What it gates:* **nothing** — `impactTier` is
  notability-only (feeds discovery/ranking, never trust; excluded from edgeScore/reliability and the UX
  applicability axis — RU6g/ADR-0003 §5), so the failure mode is bounded (occasionally over-ranking
  large/high-volume venues) and the current bands are a safe provisional. Unblock when per-field reference
  data / percentiles land.

- **B7 · Calibrate `EDGE_GATES` (0.8/0.5) + `EDGE_WEIGHTS` (0.6/0.25/0.15) against a GRADE-rated Cochrane
  exemplar set, and weigh replacing the additive composite FORM with domain-wise reporting (from F8 /
  RU2a,b,f)** — *where it stopped:* F8 **marked the numbers provisional at the code site** (comments on
  `EDGE_GATES` and `EDGE_WEIGHTS` in `shared/brain/index.ts`) and confirmed the calibration is tracked;
  it changed **no value and no formula**. The cheap guardrail already shipped in **F3** — the
  `EDGE_WEIGHTS` config object + `edgeScoreComponents()` reporting the parts (confidence · tier ·
  corroboration) alongside the composite, which is the Cochrane-style domain-wise-transparency step
  RU2a implies. *What is needed:* **(1) a small gold set of claims already GRADE-rated (High/Moderate/
  Low/Very-low) in published Cochrane reviews** — data this repo does not have — to *fit the weight
  vector* so `edgeScore` bins reproduce the human GRADE band (ordinal agreement / weighted κ), then
  *set the gates* against that set so the ADR-0003 §4 exemplar property holds (a clean tier-4/low-RoB/
  ≥1-corroboration RCT clears `high`; a single tier-2 cross-sectional does not) — **ADR-0003 Open-Q 1–2**,
  the accepted calibration plan. **(2) A design decision on the composite FORM itself:** the literature
  is actively *hostile* to additive quality scores (Jüni 1999: "high-quality" subset flips with scale
  choice → Cochrane abandoned numeric quality scores for domain-by-domain judgment; GRADE has no
  additive formula — RU2a), so calibration should also weigh whether the additive form should be
  *replaced* by domain-wise reporting rather than merely re-weighted (F3's `edgeScoreComponents()` is the
  first step of that path). *What it gates:* **nothing** — the gates/weights are safe provisionals and
  the bands are usable as **rank-order UX provisionals** (not truth claims) meanwhile; unblock when the
  GRADE-rated exemplar dataset lands (or the A10 verifier-confidence calibration curves become available).
  **Also pending (retro-review):** RU2a,b,f *corroborate* ADR-0003's existing Open-Q 1–2 rather than
  adding new open questions — recorded as amendment intent in **D5** (ADR-0003 is `status: accepted`; its
  body is immutable under `context_sync --check`, same constraint as D3/D4), NOT applied to the ADR in-run.

## Closed

_(none yet.)_
