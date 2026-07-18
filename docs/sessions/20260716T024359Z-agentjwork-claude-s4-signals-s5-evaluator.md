# Session 20260716T024359Z — agentjwork — claude — s4-signals-s5-evaluator

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U7) · **Branch:**
  `feat/m5a-engine/s4-signals-s5-evaluator` (cut from `dev-phase2`) · **Issue:** run chain
  (orchestrator opens PR)
- **Type:** insight-engine serve path, stages S4 + S5 of
  `docs/shared/insight-engine-architecture.md` **as superseded by ADR-0002**
  (`docs/shared/decisions/0002-anomaly-definition.md` wins on every conflict): S4 robust
  3-state signal + pattern firing, S5 D2 n=1 pairwise evaluator, constants per
  `docs/shared/phase2-run-config-decisions.md` C3/C4. Salvage session — a previous attempt
  died minutes in, leaving two untracked drafts (`evaluate-signals/stats.ts` + the
  personal_signals migration) that were reviewed critically, not assumed.

## Attempted
- Review/fix/rewrite the two dead-attempt leftovers; build the `evaluate-signals` edge
  function (S4 + S5 in one deterministic pass), the `personal_signals` migration, a node-side
  test home for the stats core, guards, and a full live exercise against the local stack.

## Changed
- `supabase/functions/evaluate-signals/stats.ts` — **KEPT the leftover with 3 amendments**
  (verdict: the draft was already correct and well-shaped — median/MAD/modified-z per
  Iglewicz–Hoaglin, tie-corrected Spearman via Pearson-on-average-ranks, Pyper–Peterman with
  N/(N−j) bias correction + canonical (2/N) rendering + [2, N] clamp, correct BH step-up,
  Numerical-Recipes incomplete beta for Student-t p). Amendments: (1) `classifyDaily` now
  re-checks `baselineMinDays` AFTER artifact rejection (14 raw days with artifacts among
  them is not 14 clean days — judgment call, ADR silent); (2) added the missing ADR-0002
  stability gate `signStability()` — ρ recomputed on 3 FIXED stepped sub-windows, sign
  consistency required, deterministic by construction (Invariant 1); (3) `PairConfig`
  extended with `stabilityRuns` / `stabilityStepDays` / `minJointDays`.
- `supabase/functions/evaluate-signals/config.ts` (NEW) — C3/C4 as named config objects,
  zero inline literals: `SIGNAL_CONFIG` {windowDays 28, baselineMinDays 14, artifactZMax 3.5,
  minDistinctValues 3}, `PAIR_CONFIG` {maxLagFraction 0.2, stabilityRuns 3,
  stabilityStepDays 10, minJointDays 10}, `PAIR_WINDOW_DAYS` 60, `PAIR_MIN_METRIC_DAYS` 14,
  `PAIR_GATES` {rhoMin 0.3, qMax 0.05, nEffMin 10}. Deno-free so node tests import it.
- `supabase/functions/evaluate-signals/index.ts` (NEW) — S4: per (user, metric-with-a-value-
  today), median/MAD baseline over the 28 days ENDING YESTERDAY (window excludes the
  evaluated day), artifact-reject, per-metric `deadbandK` from registry `signal.deadbandK`
  (keys derived `m.status === "active" && m.baselineApplicable && m.signal !== null` — U6's
  compute-baselines mechanism), 3-state classify; non-neutral → `FiredPattern[]` in the
  response. S5: 60-day calendar-aligned series, eligible = ≥14 non-null days, all eligible
  pairs (lexicographic a < b), `evaluatePair` + `signStability`, BH per user per run,
  upsert `personal_signals`; pairs with joint days < 10 get NO row (§S5 failure mode).
  Reads only `metric_daily_values` (paginated, stable order); `baseline_snapshots` read only
  to attach `baselineConfidence` to MetricSignal (reporting — the ADR guard, not S3
  confidence, decides firing). Auth + response conventions match compute-baselines.
- `supabase/migrations/20260716024400_create_m5a_personal_signals.sql` — **leftover FIXED,
  renamed** from `20260715160500` (ships today): dropped the redundant `user_id` index (the
  PK `(user_id, metric_a, metric_b)` already leads on user_id — unlike baseline_snapshots,
  whose PK is a surrogate id), added a `runs_observed` comment marking it informational
  (ADR-0002 moved stability WITHIN a run; the architecture's "last 3 runs" sketch predates
  it), added the no-row-vs-flat failure-mode note. DDL otherwise per §S5: pair PK +
  lexicographic CHECK, window/n_days/n_eff/rho/ci/q_value/stable/computed_at, projection-tier
  COMMENT, RLS per-user select, service-role writes (no write policy — baselines precedent).
- `tools/engine-stats/` (NEW package, tools/metric-view pattern): package.json / tsconfig /
  `tests/s4_signal.test.ts` (11 tests) + `tests/s5_pairwise.test.ts` (19 tests). **Mechanism:
  the tests import the function-dir `stats.ts`/`config.ts` directly via relative path +
  `node --import tsx --test`** — the stats core is dependency-free and Deno-free by
  construction, so one source file serves Deno and node with no mirror. Vectors: Spearman
  0.8 hand case + tie case (ρ = √0.1) + monotone-transform invariance; BH on the
  R-verifiable example p.adjust(c(.005,.009,.05,.1,.2,.3),"BH") → (.027,.027,.1,.15,.24,.3)
  with shuffled input proving order preservation; N_eff hand-computed N*=2 on a perfectly
  autocorrelated alternating pair + clamp-at-N + autocorrelated-ramp < N; MAD degeneracy
  (MAD=0 and 2-distinct-values); artifact boundary |M| = 3.5 KEPT (strictly >) / above
  dropped; deadband boundary NEUTRAL (≤) / just past fires; 13 days emits nothing;
  post-rejection erosion below 14 emits nothing; stability stable/sign-flip/sparse. 30/30.
- `apps/biotope/test/guards/metrics_registry_signals_test.dart` (NEW guard, 3 tests):
  evaluate-signals imports the registry, derives keys + deadbandK from it, reads only the
  S2 view, no hardcoded metric literals — the baselines-guard clone for the signal path.
- `docs/graph/couplings.yaml` — 3 new active couplings: `metrics-registry-to-signals`,
  `adr-0002-s4-signal-stats`, `adr-0002-s5-evaluator-stats` (real guard paths above).
- `docs/shared/insight-engine-architecture.md` — one bracketed note at the §S4 heading
  (mean/SD + deadbandSigma 0.5 + missing guard are superseded by ADR-0002; shipped registry
  field is `signal.deadbandK`); front-matter `updated:` bumped.
- Root `package.json` — `stats:test` script.

## Decided
- **FiredPattern persistence: NONE — returned in the response JSON.** §S4 is explicit
  ("Store: none — recomputable from S2; transport = pure function called in-process by S7's
  generation job"), so the fired-pattern store is the function response; S7 will call the
  S4 pass in-process when it lands. No new table invented.
- **Interim pair scope (recorded):** all baselineApplicable × baselineApplicable active
  pairs where EACH metric has ≥ `PAIR_MIN_METRIC_DAYS` = 14 (reusing C3's baselineMinDays)
  non-null days in the 60-day window; joint days < 10 → no row. Brain-neighbour pruning +
  lag windows arrive in U12 (C10). Live run: 16 metrics − 1 short-history = 15 eligible →
  C(15,2) = 105 pairs, exactly as expected.
- **Stability geometry:** 3 runs × 10-day step over the 60-day series → three fixed 40-day
  windows at offsets 0/10/20. ADR-0002 leaves geometry to calibration (open-Q7); values live
  in PAIR_CONFIG, code takes any run count/step. `stable` = sign consistency AND
  |ρ| ≥ 0.3 (full-window ρ), per the migration's column comment.
- **S4 baseline window excludes the evaluated day** (median/MAD over [d−28, d−1]) — today's
  own value must not shift the baseline it is judged against.
- **S3 `baselineConfidence` is observability, not gate:** ADR-0002's own
  baselineMinDays-on-28-day-window guard decides suppression; the S3 confidence (7-day
  coverage semantics) rides along on MetricSignal for S7. Where the two disagree the ADR
  wins (the session's stated conflict rule).
- **`minDistinctValues` = 3** for the MAD-degeneracy guard (ADR open-Q9 unresolved; 2
  distinct values make MAD a step function, not a scale estimate). Provisional, in config.
- **Leftover verdicts:** stats.ts KEPT (amended ×3, above); migration FIXED + renamed
  (index removed, comments added); everything else (config/index/tests/guards) written new.
- **Seeder invocation:** piped `scripts/seed-test-data.sql` straight into container psql
  with `-v days=45` instead of the `.ps1` runner — sidesteps the known PowerShell-5.1 BOM
  parse failure entirely (U6 ran a BOM'd copy; direct SQL piping is simpler and leaves no
  copy). Auth user created by direct `auth.users` INSERT (U6 mechanism, headless session).

## Left
- S7 composer consumes `FiredPattern[]` in-process + reads `personal_signals` — later session.
- No cron schedule for evaluate-signals yet (architecture: S5 weekly cron; S4 in-process
  under S7's job) — schedule lands with the S7 wiring session, deliberately not now.
- U12: brain-neighbour pair pruning + C10 lag windows replace the interim all-pairs scope.
- ADR-0002 open action item stands: verify the Pyper–Peterman denominator constant against
  the primary PDF before production calibration (shipped: canonical 2/N rendering).
- CI still doesn't run node tool-package tests (`stats:test` joins `view:test`/`rules:test`
  in that gap — same orchestrator decision as U5/U6); the couplings guards + pre-push cover.
- `evaluate-signals` validated by live edge-runtime execution, not `deno check` (deno absent
  on this machine — same caveat as U6).

## Blockers
- None. Gate: `tools/engine-stats` **30/30** + `tsc --noEmit` clean · shared
  `npx tsc --noEmit` clean · `flutter analyze` clean · `flutter test` **46/46** (43 + 3 new
  guard tests) · `npx supabase db reset` — all 13 migrations apply (personal_signals incl.) ·
  **functional (really run, local stack):** SQL-created auth user + 45 seeded days; shaped
  scenarios (hrv_sdnn_ms tied monotonically to sleep_duration_min; stool_count nulled to a
  10-day history; today's mosquito_bites = 15 vs 0–3 baseline); `npx supabase functions
  serve` + POST → compute-baselines `{ok, users:1, snapshots:16}`, then evaluate-signals →
  `{ok, day 2026-07-16, users 1, 16 metricSignals, 3 firedPatterns, 105 pairs evaluated,
  105 upserted}`. Evidence: mosquito_bites fired `up` with modified z = 8.77 (plus two
  honest random fires at 2.02/2.79 — expected ~1-in-3 per metric at deadbandK 1.0);
  stool_count emitted `neutral` + `suppressed: insufficient-baseline` + zScore null AND has
  0 personal_signals rows; the injected pair landed ρ = 0.9624, N_eff = 34.89 (< 45 — the
  autocorrelation penalty working), q = 0.00000, CI [0.926, 0.981], stable = true — passes
  every serve gate; the two next-best random pairs got stable = true but q = 0.071 / 0.946 —
  BH correctly refusing them at q ≤ 0.05 across the 105-pair family ·
  `context_sync --fix-index` + `--check` pass.

memory: none
