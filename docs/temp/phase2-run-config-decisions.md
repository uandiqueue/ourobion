---
title: Phase-2 Run — Config Decisions (hyperparameters, thresholds, model ids)
summary: Every hard-coded hyperparameter, threshold, and rule the run ships that feeds downstream calculation or the engine/LLM — value, alternatives considered, rationale, and calibration status. The run-time companion to the architecture's §11 hyperparameter registry.
type: plan
scope: shared
status: canonical
updated: 2026-07-15
---

# Phase-2 Run — Config Decisions

Every entry: **value shipped · alternatives considered · rationale**. All values are
**provisional-until-calibrated** (next-steps backlog item 6) unless marked otherwise; each must live in
a config object, never an inline literal (ADR-0002 mandate). Cross-reference: architecture §11.

## Brain / edge gating (shipped pre-run in `shared/brain/index.ts`; ratified as-is)

- **C1 · `EDGE_GATES`** — `high: 0.8`, `mid: 0.5`. Alternatives: 0.9/0.6 (starves serving on a young
  corpus), single gate (loses the mid "research-context" band). Rationale: three serving bands with a
  conservative top band; dummy pending calibration on real verified edges.
- **C2 · `edgeScore` weights** — confidence 0.6 / evidence-tier 0.25 / corroboration 0.15; corroboration
  saturates at 3 net independent sources. Alternatives: equal thirds (overweights tier on sparse
  metadata); ADR-0003's OCEBM non-linear tier lookup + independent-root clustering (adopted direction,
  lands with A10 data). Rationale: verifier confidence is the only instrument-tested axis today.
  `impactTier` stays **excluded** from edgeScore (notability ≠ trust — ADR-0003 invariant).

## Engine statistics (to ship with U6/U7)

- **C3 · S4 anomaly definition (per ADR-0002, supersedes doc dummies)** — robust baseline: median +
  MAD (σ̂ = MAD/0.6745), deadband `deadbandK = 1.0`·σ̂, rolling window 28 days, `baselineMinDays = 14`,
  artifact rejection |M| > 3.5, MAD-degeneracy fallback. Alternatives: mean/SD + 0.5σ deadband (the
  architecture doc's original — rejected by accepted ADR-0002; outlier-fragile on n=1 daily data).
- **C4 · S5 n=1 evaluator gates** — Spearman |ρ| ≥ 0.3, BH FDR q ≤ 0.05, Pyper–Peterman N_eff ≥ 10,
  window 60 days, stability = 3 fixed deterministic windows. Alternatives: q ≤ 0.10 (ADR-0002 allows
  loosening only if card volume starves), Pearson (rejected — non-normal ordinal data). Rationale:
  Cohen-medium effect floor + FDR control keeps n=1 "personal signals" honest.
- **C5 · S3 baseline confidence cutoffs** — **3 / 5 / 14 days** (low/med/high), per the architecture
  DDL. Note: current deployed code uses 3/**7**/14; U6 adopts 3/5/14. Alternative: keep 7 (no basis
  either way; the doc value wins until calibration says otherwise).

## LLM router (to ship with U3)

- **C6 · Model ids per node** — synthesis (A8) `claude-sonnet-5`; cheap tier (A4 role-tags, A5 tiering,
  S8 card phrasing) `claude-haiku-4-5`; report narrative (S9) `claude-sonnet-5`; **verifier (A10)
  non-Anthropic by invariant** — provisional `gpt-5` family via OpenAI, **exact id + key needs Jayden
  (register B5)**. Alternatives: Gemini-tier verifier (equally valid; pick whichever key you provision);
  Opus-tier synthesis (costlier, no measured quality need yet). All ids live in router config, never in
  node code. **Shipped (U3):** `tools/llm-router/router.config.json`; all six nodes default to the
  keyless `local_agent` route until keys land (register B5); provisional price table (sonnet $3/$15,
  haiku $1/$5, gpt-5 $1.25/$10 placeholder) marked provisional in config.
- **C7 · LLM budget caps** — per-run token cap 200k output-tokens and per-day spend cap US$5 per
  pipeline stage, 95% hard-stop (mirrors `tools/brain-ingest` `limits/budget.ts` semantics);
  verification triage: full independent-retrieval verification only for high-impact or low-corroboration
  edges, quoteCheck-only otherwise (designed in synthesis doc). Alternatives: uncapped (rejected —
  headless pipeline), per-edge cap (finer but premature). Raise deliberately when real runs start.
  **Shipped (U3):** per-day USD cap interpreted **per-node**; per-run token cap survives midnight
  rollover; 95% hard-stop → typed `RouterBudgetExceededError`.

## Support models / venue weighting (to ship with U4)

- **C8 · b2 impactTier bands (provisional)** — `high`: SJR Q1 **or** OpenAlex h-index ≥ 100;
  `moderate`: Q2 **or** h-index ≥ 50; `low`: everything else with a resolvable venue; `preprint`:
  unreviewed servers. Per-ISSN cache. Alternatives: 2yr-mean-citedness bands (kept as tiebreak input);
  JCR Impact Factor (rejected — paid, and IF-vs-trust is empirically weak per ADR-0003). Explicitly
  uncalibrated — flag any surprises.

## Seeding, waves, correlation scope

- **C9 · Brain seeding threshold** — seed edges only from registry `derivedFrom[]` + curated priors;
  no speculative LLM-invented seed edges (plan risk note: overgreedy graph ⇒ spurious correlations).
  Alternative: LLM brainstormed seed set (rejected until the verifier runs for real).
- **C10 · Correlation lag windows** (cross-metric rules, U12) — provisional lag set {0, 1, 3, 7} days,
  evaluated only over brain-neighbour pairs. Alternatives: continuous lag scan (n=1 data can't support
  it); {0,1} only (misses gut-transit and env-exposure delays, the product's headline pairings).
- **C11 · Metric-wave sizing** — Wave 1 target ~45 self-report metrics (per memory 0014), promoted only
  with its collector; spine stays ~9 daily manual touches; registry ceiling 100 this phase. Not a new
  choice — restated from the accepted decision so wave sessions don't re-derive it.
- **C12 · DQS weights** (shipped) — 7 T1 daily-core metrics, weights sum to 100, tier-aware (events /
  periods / passive never penalize completeness). Ratified as-is.
