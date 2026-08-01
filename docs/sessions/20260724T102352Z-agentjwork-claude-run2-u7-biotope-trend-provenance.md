---
title: "Run-2 U7 — biotope demo surfaces: metric trend chart + insight provenance screen (O12 app side)"
summary: "The two DEMO-CRITICAL biotope surfaces for main-loop steps 2 & 5: (1) a Home-tab TRENDS section — metric picker over the user's actual data + a hand-rolled CustomPaint 30-day line chart reading the metric_daily_values view (new MetricSeriesService; pure chart math extracted and unit-tested; refreshes on the existing Home reload-on-focus path); (2) tapping any insight card opens a provenance detail screen driven by U5's get_insight_provenance RPC (new ProvenanceService + pure Dart models mirroring the stable JSON contract), rendering producer/branch/completeness/personal stats and per-edge claim derivation, quote spans and citations — with locked honesty: the uncited case says plainly it has no research link, and every verifier verdict carries the TEST_MODE_LABEL stamp verbatim ('scaffolded + unit-tested…'), pinned by test against tools/llm-router/src/types.ts. No new packages, no schema changes, no re-skin. Live proof on the local stack via the raw supabase Dart client executing the real production parsers: 21-point gut_comfort series (dip visible), 16 picker keys, provenance parsed for card #2, null for a bogus id."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U7 · biotope trend view + insight provenance view (O12 app side, DEMO-CRITICAL)

Branch `feat/phase2-run-2/u7-biotope-trend-provenance` off `feat/phase2-run-2/u6-nao-data-loader`.
Executes the app side of backlog **O12** (locked decisions honored: reuse the existing engine/data —
the `metric_daily_values` view and U5's `get_insight_provenance` RPC are the only read surfaces;
no migrations, no new packages, no re-skin; interim-verifier honesty **D15** enforced in copy).

## What shipped

### Trend view (main-loop step 2) — Home tab "TRENDS" section
- `lib/modules/m5a_baselines/impl/metric_series_models.dart` — PURE Dart (no package imports, so
  live-proof scripts can execute it on the plain VM): `MetricDailyPoint` (+ UTC date-only parsing),
  `parseSeriesRows`, `distinctMetricKeys` (PostgREST has no DISTINCT — dedupe client-side, sorted),
  `windowStartDateIso` (30-day window ending the UTC today), `metricDisplayLabel` (key-derived
  picker label; the registry's ui.label is not importable from lib/ — see TODO(D18)).
- `lib/modules/m5a_baselines/impl/metric_series_service.dart` — `MetricSeriesService(client,
  {nowUtc})` (injectable clock, InsightService pattern): `getMetricKeys` / `getSeries` over
  `metric_daily_values` with exactly the brief's chain `.eq(user_id).eq(metric_key).gte(log_date)
  .order(log_date)`; security_invoker view → user's own rows only.
- `lib/modules/m5a_baselines/impl/chart_math.dart` — PURE chart math: `valueBounds`,
  `normalizeValue` (flat series → midline), `dayFraction` (date-proportional x — missing days leave
  honest gaps), `niceStep` (1/2/5 ladder), `niceTicks`, `compactValueLabel`.
- `lib/modules/m5a_baselines/ui/widgets/metric_trend_section.dart` — `MetricTrendSection`
  (+ `TrendCopy` gated strings): metric `DropdownButton` populated from the user's ACTUAL data keys
  (preselects `gut_comfort_score`, the demo hero metric), "Last 30 days" caption, and a
  **hand-rolled `TrendChartPainter` CustomPaint** (no fl_chart — polyline + per-day dots +
  nice-tick gridlines with min/max value labels + first/last date labels). Card container uses the
  existing OurobionColors/manrope card idiom. Injectable service + userId for widget tests.
- Home wiring (`m1_core/ui/screens/home_tab.dart`): TRENDS section between Streak and Titles;
  `HomeTab._load` calls `trendKey.currentState?.reload()`, so the chart refreshes on the EXISTING
  AppShell reload-on-focus path (step 2/4 hygiene — return to Home after running analysis in nao and
  the chart re-fetches; nothing fancier, per brief).

### Provenance view (main-loop step 5) — tap a card → "How this was generated"
- `lib/modules/m5b_insight_engine/impl/provenance_models.dart` — PURE Dart mirrors of the RPC's
  stable JSON contract (migration 20260724085023 header): `InsightProvenance`,
  `ProvenanceCardInfo`, `ProvenanceCompleteness` (incl. perMetric day counts),
  `ProvenancePersonal` (rho/nEff/qValue/stable), `ProvenanceEdge` (every field except edgeId
  nullable — the SQL LEFT-joins claim/verification/payload entry), `ProvenanceQuoteSpan`,
  `ProvenanceCitation` (+ optional `ProvenanceEvidencePassage` list, additive-optional).
- `lib/modules/m5b_insight_engine/impl/provenance_service.dart` — `ProvenanceService.getProvenance
  (cardId)` → `rpc('get_insight_provenance', {p_card_id})`; null = card not visible (not-found and
  not-owned indistinguishable by design; rendered as a plain "nothing to show").
- `lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart` —
  `InsightProvenanceScreen` (+ `ProvenanceCopy` gated strings): card header (category/producer/
  severity chips — severity is neutral styling, never urgency), producer explainer, pattern/branch,
  data coverage ("21 / 28 days with data in the window" + per-metric lines), personal stats in
  observational language ("ρ 0.95 · 27.0 effective days · q 0.004 · stable"), then RESEARCH LINKS:
  - **edges empty → honest plain note** (personal: "This pattern comes from your own data. No
    published research link yet." / rules: "…No research citation is attached.") — NO research
    decoration (O12 locked).
  - per edge: subject · relation · object, direction/serving band/edge score line, **verdict +
    the TEST-MODE stamp** (below), derivation, studied scope, quote spans (quote + paperId/locator),
    citations (title/year · tiers · stance · population + evidence passages when present).
- **TEST-MODE honesty (D15, locked):** `ProvenanceCopy.testModeVerdictLabel` hardcodes the exact
  wording of `TEST_MODE_LABEL` in `tools/llm-router/src/types.ts` ("scaffolded + unit-tested
  (TEST-MODE: single-provider, decorrelation OFF)") with a lockstep comment — no cross-language
  import exists; a test pins the string verbatim. Every rendered verdict carries it.
- Insights tab wiring: whole card tile taps through (`Navigator.push`) + a visible "How this was
  generated ›" affordance line; new string added to `InsightCardCopy.all` (existing gate covers it).
- Module `index.dart` files updated (m5a + m5b export the new impl files).

### Tests (all new strings copy-gated; 111/111 suite green)
- `test/m5a_baselines/chart_math_test.dart` — bounds/normalize/dayFraction/niceStep ladder
  (incl. sub-unit ranges — caught a real bug: the magnitude loop never descended below 1)/
  niceTicks/labels.
- `test/m5a_baselines/metric_series_model_test.dart` — wire-JSON parsing (int→double, UTC date-only),
  dedupe+sort, window math (incl. SGT-offset conversion), display labels.
- `test/m5b_insight_engine/provenance_model_test.dart` — three real fixture shapes (fully-cited
  edge card; honest personal card with edges [] + personal present; plain rules card all-null) +
  left-join tolerance (all-null edge fields).
- Copy gates: `trend_copy_gate_test.dart`, `provenance_copy_gate_test.dart` (validator +
  TEST_MODE_LABEL verbatim pin), mirrors of insight_copy_gate_test.
- Widget tests (the Supabase-init blocker does NOT apply — both new widgets take injectable
  services): `metric_trend_section_widget_test.dart` (render + preselect + empty state + reload
  refetch), `provenance_screen_widget_test.dart` (rules-card honest note with NO verdict text;
  personal-card observational stats; edge-card full chain incl. the TEST-MODE stamp; null → plain
  note). Fakes construct `SupabaseClient(..., authOptions: AuthClientOptions(autoRefreshToken:
  false))` — the default auto-refresh timer trips the test binding's pending-timers invariant.

## Live proof (local stack, actual outputs)

Path taken: **raw supabase Dart client** (package:supabase, the same `SupabaseClient` class the app
services receive) — a throwaway `dart run` script (worktree `.u7-proof/`, deleted after) signed in
as the demo user via password grant and executed the IDENTICAL query chains as the services, then
parsed the live responses with the REAL production parser files (relative-imported — they are
deliberately pure Dart). Demo user u6-demo@ourobion.local (uid 963e80fd-…) — U6's password was not
recorded, so it was reset via the auth admin API (service key; no data touched).

```
signed in as u6-demo@ourobion.local -> 963e80fd-945f-4225-a179-d64d3480e8cd
window start (30d): 2026-06-25
gut_comfort_score series: 21 points
  first: 2026-07-04 value=3.0 source=self_report
  last : 2026-07-24 value=2.0 source=self_report
  last three days (the simulated dip): 2026-07-22=2.0, 2026-07-23=1.0, 2026-07-24=2.0
distinct metric keys in window (16): body_temp_c, energy_score, gut_comfort_score, hrv_sdnn_ms,
  log_completeness, mood_score, mosquito_bites, outside_meals, resting_hr_bpm, sleep_duration_min,
  spo2_pct, step_count, stool_count, stool_form, stool_variability, urine_colour
active cards: #1 energy_trending_down (rules); #2 gut_comfort_trending_down (rules);
  #3 gut_form_stable (rules); #4 hydration_trending_up (rules)
raw RPC json: {"card":{"id":2,"body":"Your gut comfort data shows a declining pattern over the
  past week.","title":"Gut comfort pattern","ruleId":"gut_comfort_trending_down","category":"gut",
  "producer":"rules","severity":"info","generatedAt":"2026-07-24T09:37:53.975+00:00"},"edges":[],
  "branch":null,"personal":null,"patternKey":null,"completeness":null}
parsed InsightProvenance:
  card #2 rule=gut_comfort_trending_down producer=rules category=gut severity=info
  patternKey=null branch=null completeness=null personal=null edges=0
bogus card id 999999 -> null (null = not visible, as designed)
```

Notes: the 21-day series and the day-22/23/24 dip match U6's loader proof exactly. The live DB has
only rules-producer cards (no verified edges / no stable personal signals on the fresh stack), so
the live provenance exercises the honest null-heavy branch; the rich edge/personal branches are
covered by the unit fixtures matching the migration's documented contract.

## Gate summary

- `flutter analyze` — **No issues found** (the worktree needed the gitignored `.env.public` asset
  copied from the main repo to clear a pre-existing environmental asset warning; also note Flutter's
  plugin injection needs symlink creation, which the sandboxed shell cannot do — run unsandboxed).
- `flutter test` — **111/111 pass** (69 pre-existing + 42 new; no regression).
- Generated-plugin EOL churn: confirmed content-empty via `git diff --ignore-cr-at-eol`, discarded
  (`git checkout -- apps/biotope/{linux,macos,windows}`), not committed.
- NUL-byte check on every new/edited file — clean (`git diff --stat` no Bin; perl scan clean).
- Live proof — executed against the real local stack, outputs above.
- `node tools/context_sync.mjs --check` — passed.

## Decisions made autonomously (for review)

- **Chart approach:** hand-rolled CustomPaint (polyline + per-day dots + nice-tick gridlines +
  min/max labels), NO charting package; x axis is date-proportional so missing days show as gaps
  rather than compressing the axis; all math extracted pure into `chart_math.dart`.
- **Placement:** trend view as a Home-tab section (least invasive: reuses the existing card idiom,
  reload-on-focus arrives free via `HomeTab._load`; no 6th tab, placeholders untouched). Provenance
  as a pushed detail screen from the card tile, with a visible "How this was generated ›" line for
  demo discoverability (new string gated via `InsightCardCopy`).
- **Picker default** `gut_comfort_score` (demo hero metric) when present, else first key
  alphabetically; picker labels derived from the key (data, not copy — the registry's ui.label is
  not importable from lib/, TODO(D18)).
- **TEST-MODE label placement:** rendered under EVERY edge verdict on the provenance screen; the
  Dart const lives in `ProvenanceCopy` with a lockstep comment pointing at
  `tools/llm-router/src/types.ts`, pinned verbatim by `provenance_copy_gate_test.dart`. The
  pre-existing card-tile "verified <date>" edge-ref line (U21) was left as-is — out of U7 scope
  (no re-skin); flagged here for the sign-off review since D15 wording arguably owes that line the
  same stamp.
- **Model nullability:** every `ProvenanceEdge` field except `edgeId` is nullable because the RPC
  LEFT-joins claim/verification/payload — parsers must not crash when a cited edge's claim row is
  gone.
- **Fixed a fresh-worktree gap:** copied the gitignored `apps/biotope/.env.public` from the main
  repo (asset declared in pubspec; analyze warns when absent). Not committed (gitignored).
- Widget-test unblocking pattern: new widgets take injectable service/userId; fakes disable GoTrue
  auto-refresh (pending-timers invariant).

memory: Run-2 U7 shipped O12 app side — Home TRENDS section (MetricSeriesService over metric_daily_values + pure chart_math + hand-rolled CustomPaint, reload-on-focus) and a provenance detail screen (ProvenanceService over get_insight_provenance + pure models; edges-empty renders plainly; every verdict carries the TEST_MODE_LABEL mirror pinned by test); widget tests work by injecting services (SupabaseClient with autoRefreshToken:false); flutter needs unsandboxed shell for plugin symlinks and the worktree needs .env.public copied from the main repo.
