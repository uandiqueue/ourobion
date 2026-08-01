# Session 20260716T050639Z — agentjwork — claude — s7-composer-s8-cards

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U12) · **Branch:**
  `feat/m5b-engine/s7-composer-s8-cards` (cut from `feat/brain/a10-verifier-scaffold`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** the flagship insights-engine refactor — `generate-insights` goes from 6 hardcoded
  rules to the data-driven S7 composer + S8 card producer
  (`docs/shared/insight-engine-architecture.md` §S7/§S8; `docs/biotope/rules-engine-design.md`
  §C/§D) over the shipped substrate: `rules` table (U5), baselines v2 (U6), evaluate-signals
  S4/S5 (U7), `verified_edges` (U8). Cross-metric rules brain-scoped per
  `docs/shared/phase2-run-config-decisions.md` C10.

## Attempted
- One migration (composed_insights + the insight_cards producer columns), the full
  generate-insights rewrite (evaluators / composer / render / IO shell), the first cross-metric
  coincidence blueprint, guard updates (incl. making the planned engine-coverage guard real),
  and a full live end-to-end with SQL evidence (a)–(f).

## Changed
- `supabase/migrations/20260716050639_create_m5b_composed_insights_and_card_producers.sql`
  (NEW) — §S7 `composed_insights` (insight_id PK = deterministic sha-256, branch CHECK over the
  4 branches, full-payload jsonb, RLS per-user select / service-role writes) + §S8
  `insight_cards` amendments, all additive with defaults so existing rows stay valid:
  `producer` ('rules'|'edge'|'personal', default 'rules'), `insight_id` FK, `edge_refs jsonb
  default '[]'`, category CHECK re-declared + 'relationship', and the personal⇒uncited CHECK
  (`producer <> 'personal' or edge_refs = '[]'::jsonb`).
- `supabase/functions/generate-insights/evaluators.ts` (NEW, Deno-free pure) — one evaluator
  per condition type (`EVALUATORS` = the coverage-guard surface): trend / threshold (5 ops,
  null field never fires) / coincidence (conjunction; `getBaseline(metric, lag)` injection;
  rule-level minConfidence binds BOTH snapshots); `ALLOWED_LAG_DAYS` = C10 {1,3,7} (0 ≡ null —
  the blueprint schema forbids 0); `windowedBaseline()` — compute-baselines' exact math
  (mean / population std / half-split 0.5·sd trend / C5 3-5-14 confidence) over a 7-day window
  ending an arbitrary day, so lagged leaves evaluate real windowed stats (the deferral recorded
  on `CoincidenceCondition.lagDays` lands here). History for confidence never peeks past the
  window end.
- `supabase/functions/generate-insights/composer.ts` (NEW, Deno-free pure) — S7:
  `classifyPattern` (truth table below), monotonic-only direction (`increases|decreases` set
  direction; `modulates|correlates` attach context-only, `direction: null`), personal serve
  gate (q ≤ 0.05 ∧ N_eff ≥ 10 ∧ stable, gates injected from evaluate-signals' `PAIR_GATES`),
  `completenessScore` (DQS-weight-normalised day coverage from S2 raw), U1 stub
  `gradeApplicability() → 'unknown'` (typed seam, rationale null), `insightId` = sha-256(user,
  patternKey, edgeId|'none', periodStart) via WebCrypto (Deno + node ≥20).
- `supabase/functions/generate-insights/render.ts` (NEW, Deno-free pure) — S8: `{{snake}}`
  template fill, RENDER-TIME `validateCopyString` gate on the FINAL filled text (imported
  straight from `shared/constants/copy_guidelines.ts` — no vendored word list, so the render
  gate can never drift), unresolved-placeholder ⇒ drop; producer namespaces
  (`edge:'||edge_id`, `personal:'||a||'|'||b`); the deterministic EDGE/PERSONAL card templates
  (the SHIPPED path; the §S8 phrasing LLM stays unwired — template is the authority and its
  future fallback).
- `supabase/functions/generate-insights/index.ts` (REWRITE) — the 6 hardcoded rules are GONE.
  IO shell: loads in-force `rules` rows (phase / effective / deprecated filters), LOAD-TIME
  gate re-validates every template + evaluator existence + C10 lag (belt over the loader's
  braces; skip + log); recomputes S4 FiredPatterns IN-PROCESS by importing
  `../evaluate-signals/stats.ts` + `config.ts` (Deno-free shared modules — no HTTP call, no
  fired-pattern store, per §S4 "pure function called in-process"); evaluates single rules on
  S3 snapshots and coincidence rules gated to brain-neighbour pairs (servable `verified_edges`
  1-hop on the pair, else skipped + reported); composes insights for coincidence fires + S4
  signal patterns (1-hop servable edges, personal_signals, branch, completeness) into
  `composed_insights` (idempotent insert); produces cards for the three namespaces with
  dismissal respected, per-rule `expiry_days` honored (composer cards: 7-day provisional),
  in-batch dedupe then `(user_id, rule_id)` upsert. Response reports loads/skips/fires/
  branches/producer counts/render drops — the live-evidence surface.
- `data/rules/cross/behaviour/hrv_rise_after_sleep_rise.json` (NEW) — the first cross-metric
  blueprint: coincidence over (hrv_sdnn_ms, sleep_duration_min), leaf0 hrv trend rising
  (current window), leaf1 sleep trend rising lagged 1 day (C10 set; HRV responds to sleep on a
  next-day horizon), templates with `{{metric_a_label}}/{{metric_b_label}}/{{lag_days}}`
  placeholders, copy-gate clean. Pair chosen because the U8 fixture edge
  `sleep_duration_min|increases|hrv_sdnn_ms` (0.900/high) serves it.
- `tools/rules/tests/engine_condition_coverage.test.ts` — the planned guard made REAL
  (couplings edge flipped active): every blueprint condition type incl. coincidence leaves has
  an EVALUATORS branch; corpus exercises trend+threshold+coincidence; shipped lags ∈ C10;
  golden vectors per evaluator + the windowed-baseline math (no-peek-past-window-end).
- `tools/rules/tests/engine_composer_render.test.ts` (NEW) — S7 branch truth-table vectors,
  monotonic-only direction, personal serve gate, U1 stub, completeness (incl. all-zero-weight
  fallback), deterministic insightId, render gate drops (copy-gate + unresolved placeholder),
  shipped templates render clean, namespace stability.
- `tools/rules/tests/engine_cards_schema.test.ts` (NEW guard: engine-producers-to-cards-schema)
  — migration CHECKs held character-for-character to the engine constants (producer set,
  category = blueprint set + 'relationship', branch vocabulary, personal⇒uncited CHECK,
  edge_refs default / insight_id FK).
- `apps/biotope/test/guards/metrics_registry_engine_test.dart` — anchors updated faithfully
  for the data-driven engine (3 tests): NO hardcoded metric-key literals / RULES array in any
  engine file; engine imports the registry and reads rules / baseline_snapshots /
  verified_edges / personal_signals / metric_daily_values and writes composed_insights /
  insight_cards; every data/rules blueprint metric key is an active registry metric (the
  rule↔registry coupling now binds the blueprints).
- `apps/biotope/test/guards/rules_table_contract_test.dart` — category parity updated to the
  §S8 superset semantics: cards CHECK (in the new migration) == rules CHECK verbatim +
  `'relationship'`; severity stays character-identical.
- `docs/graph/couplings.yaml` — engine-coverage edge planned→active; metrics-registry-to-engine
  + rules-table-to-insight-cards-parity `why` rewritten for the new semantics; NEW
  `engine-producers-to-cards-schema` coupling (real guard path).
- `tools/brain-ingest/tests/seeder.test.ts` — one assertion updated faithfully: the seeder now
  rightly enumerates 1 `rule_blueprint` pair candidate (the new cross rule) where the comment
  previously asserted "all shipped MVP rules are single-metric" (0).

## Decided
- **FiredPattern consumption mechanism: direct shared-module import.** generate-insights
  imports `../evaluate-signals/stats.ts` (classifyDaily) + `config.ts` (SIGNAL_CONFIG,
  PAIR_GATES) and recomputes S4 in-process over metric_daily_values — chosen over HTTP-calling
  evaluate-signals (both files are Deno-free/dependency-free by construction; no network hop,
  no double-fetch, §S4's "in-process pure function" verbatim).
- **Branch truth table AS IMPLEMENTED** (the doc's four rules overlap on personal-null; made
  disjoint + exhaustive, first match wins):
  1. any servable monotonic edge whose GATE-PASSING personal signal has the opposite sign →
     `contradiction`; 2. any monotonic direction-consistent edge (personal absent /
     non-gate-passing / consistent) → `agree`; 3. any servable edge at all (context-only or
     direction-inconsistent, no personal contradiction) → `research-context`; 4. no edge +
     gate-passing personal pair → `idiosyncratic`; 5. neither → no insight (gap fuel).
     A non-gate-passing personal row is treated as ABSENT everywhere.
- **Direction consistency:** both endpoints observed → co-movement must match relation sign
  (increases=same, decreases=opposite); only one endpoint observed → no contradiction is
  observable → 'consistent' (recorded judgment call). Context-only relations: direction null.
- **Completeness formula:** score = Σ_m ŵ_m · min(daysPresent(m), W)/W over the pattern's
  contributing metrics, W = 28 (the S4 window, one window for all pattern kinds), ŵ = registry
  `dqs.weight` normalised across the contributing metrics; ALL-ZERO weights (wearables carry
  dqs 0) fall back to equal weights so wearable pairs aren't scored 0/NaN; top-level
  daysPresent = the min across metrics (conservative). Computed from S2 raw day-counts.
- **Template-fallback posture: the deterministic template IS the shipped path.** No LLM call
  anywhere in this function; the §S8 phrasing_card router node stays unwired this session. When
  the Haiku phrasing layer lands it is optional, cached, and copy-gated at render — these
  templates remain its fallback and its grounding bound.
- **Producer vocabulary per the architecture doc** ('rules'|'edge'|'personal') — the session
  spec's "('rule'|'relationship'|'personal')" defers to the doc ("per doc"); 'relationship' is
  the composer cards' CATEGORY, not a producer.
- **Coincidence rule cards stay in the 'rules' producer namespace** (rule_id = blueprint id)
  but carry `edge_refs` (the brain-scoping edges) + `insight_id` (their classified insight);
  they surface only on `agree`/`research-context` branches — a `contradiction` (user's own
  stable signal opposing the edge) suppresses the card and records the insight. Single-metric
  rule cards remain the untouched IED producer: edge_refs [], insight_id null.
- **Category CHECK superset, not identical:** insight_cards gains 'relationship'; the `rules`
  table CHECK deliberately stays the narrower blueprint set (the rules producer can never
  write 'relationship'); the parity guard now asserts cards == rules + 'relationship' verbatim.
- **ACTIVE_PHASES = {'phase1_stage1', 'phase2_engine'}** — the 6 ported blueprints keep their
  MVP phase; new engine-era rules (the cross rule) use 'phase2_engine', which also stamps
  composer cards' phase_generated.
- **C10 lag encoding:** blueprint schema forbids lagDays 0 (null = same window), so the engine
  accepts null|{1,3,7}; anything else is skipped at load + logged, never mis-evaluated.
- **Load-time vs render-time copy gates, both live:** load-time re-validates raw templates
  (hand-edited projection rows can't reach evaluation); render-time validates the FINAL filled
  copy and also drops unresolved placeholders — proven live with two throwaway rules (below).
- **insight_cards upsert refreshes snoozed → active on refire (MVP behavior preserved); only
  dismissal is protected.** Cooldown (`cooldown_days`) not implemented — every shipped
  blueprint has null; deferred until a rule uses it.
- **Composer card confidence_score:** edge cards = the top edge's edge_score; personal cards =
  min(1, |rho|); rule cards keep the MVP CONFIDENCE_SCORE ladder (cross rules use the scoping
  edge's score). confidence_sources gains 'brain' on edge-joined cards.

## Left
- Gap-ledger events for research-context/contradiction/idiosyncratic (A1) — the branches are
  recorded in composed_insights; the ledger write lands with A1/A3.
- S8 phrasing LLM (cached Haiku layer) + S9 report composer + U1 real grader
  (applicability_grades table) — later sessions; the payload already carries the 'unknown'
  applicability seam per citation.
- evaluate-signals' interim all-pairs S5 scope: brain-neighbour pruning of the PAIR FAMILY
  (C10's other half) is still pending there; this session brain-scoped the coincidence RULES.
- No cron schedule change; generate-insights keeps its existing scheduled invocation.
- CI still doesn't run node tool-package tests (standing orchestrator decision); couplings
  guards + pre-push cover.
- Engine validated by live edge-runtime execution, not `deno check` (deno absent — U6/U7
  caveat). The pure modules ARE node-typechecked via tools/rules `tsc --noEmit`.

## Blockers
- None. Gate: tools/rules **50/50** (engine coverage + composer/render + cards schema + prior
  29) + `tsc --noEmit` clean · brain-ingest **320/320** (1 seeder count updated for the new
  cross blueprint) · edge-loader **21/21** · engine-stats **30/30** · metric-view **5/5** ·
  shared `npx tsc --noEmit` clean · `flutter analyze` clean · `flutter test` **48/48** (46 + 2
  net new guard tests) · `npx supabase db reset` — all 15 migrations apply ·
  `context_sync --fix-index` + `--check` pass.

  **Live end-to-end (really run, local stack):** db reset → SQL auth user → seeder 45 days →
  shaped scenarios (sleep wobble+final ramp with hrv = 40 + 0.1·sleep → S5 row ρ=0.9981,
  N_eff=17.14, q=0.00000, stable=t; mood := energy over 45 days with a joint crash to 1 today
  → ρ=1.0000, N_eff=35.02, q=0, stable=t; urine_colour 2→8 across the 7-day window) →
  `rules:load` (7 blueprints incl. the cross rule) → `edges:load` U8 fixtures (3 servable) →
  `functions serve` → compute-baselines `{users:1, snapshots:16}` → evaluate-signals (6 S4
  fires; 120 pairs upserted) → generate-insights:
  `{rules loaded 8 of 9, firedPatterns 7, insights 5 (agree 3 / research-context 1 /
  idiosyncratic 1), cards 6 (rules 4 / edge 1 / personal 1)}`. Evidence:
  - (a) single-metric cards from blueprints only: hydration_trending_up, energy_trending_down,
    gut_form_stable — producer 'rules', edge_refs []; case-sensitive grep over
    generate-insights/*.ts finds ZERO hardcoded rules arrays / metric-key literals / MVP copy.
  - (b) cross card `hrv_rise_after_sleep_rise`: fired through the brain edge —
    edge_refs `[{"edgeId":"sleep_duration_min|increases|hrv_sdnn_ms","verifiedAt":"2026-07-12"}]`,
    insight branch `agree` with personal ρ 0.9981 attached, completeness 1, payload edge shows
    direction 'consistent', servingBand 'high', applicability `[{score:'unknown'}]` (U1 stub).
    Plus the composer's own cited card `edge:sleep_duration_min|increases|hrv_sdnn_ms`
    (producer 'edge', category 'relationship') from the sleep/hrv S4 patterns; resting_hr up
    vs the `decreases` edge classified `research-context` — recorded, NOT surfaced (no card).
  - (c) personal card `personal:energy_score|mood_score` — producer 'personal', edge_refs [],
    "unverified personal observation … still researching" copy, idiosyncratic insight ρ=1.
  - (d) copy gates, both live via throwaway rules injected straight into the `rules` table
    (bypassing the loader on purpose; deleted after): `throwaway_bad_copy` ("…disease…") →
    skippedAtLoad "template fails validateCopyString (load-time copy gate)";
    `throwaway_bad_placeholder` (`{{unknown_thing}}`) → fired, then droppedAtRender
    `unresolved-placeholder` — no card row for either.
  - (e) dismissal respected: dismissed the cross card → re-run → status stays 'dismissed',
    generated_at unchanged (05:28:49 vs others refreshed 05:30:04), dismissedSkipped=1.
  - (f) upsert stability: re-run → 6 cards / 6 distinct (user_id, rule_id), composed_insights
    stays 5 (idempotent insert), both endpoint patterns collapse onto one 'edge:' card by
    construction.

memory: none
