---
title: "Run-2 U6 — simulated health-data loader in nao (O11) + run-analysis trigger + nao CI job"
summary: "nao gets a /loader page + /api/loader route pair: a pure deterministic generator (shared latent 'wellness' factor + recent-dip shift) writes provenance-flagged simulated rows into biotope's daily_gut_rows/wearable_daily AS THE AUTHENTICATED USER (cookie-bound ssr client, RLS-enforced, idempotent upserts on the natural keys), and /api/loader/run-pipeline relays the U5 run-pipeline edge function server-side (service-role key stays in server env). One additive migration gives daily_gut_rows a nullable data_origin provenance column (wearable_daily reuses its existing source column). apps/nao enters CI for the first time (typecheck + node:test). Live proof on the local stack: 14-day load → 4 rule cards; +7 incremental (history backfill) → 11 fired S4 patterns incl. gut_comfort down z=-2.02 and 110 gap-ledger pair rows."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U6 · Simulated health-data loader in nao (O11, DEMO-CRITICAL) + nao CI job

Branch `feat/phase2-run-2/u6-nao-data-loader` off `feat/phase2-run-2/u5-trigger-provenance-prune`.
Executes backlog **O11** (locked decisions honored: reuse the existing registry tables, provenance-flag
simulated rows, dev-only posture) under the **D3**-recorded design-contract deviation (nao writes
biotope's per-user health tables via Supabase for this demo — recorded, retro-review pending).

## What shipped

### Generator (pure, deterministic) — `apps/nao/src/lib/simulatedHealth.ts`
- `generateSimulatedDays({startDate, days, seed, scenario, anchorDate})`: per-day rows for BOTH
  truth tables. Correlation backbone = a shared per-day latent "wellness" factor driving
  gut_comfort/mood/energy/sleep/HRV together (measured r(gut_comfort, mood) ≈ 0.5–0.7 post-rounding);
  scenario `recent-dip` (default) shifts the DIP_DAYS=3 days ending at `anchorDate` (the route passes
  today) down hard enough to leave the S4 deadband and flip S3 7-day trends to falling; `steady` has
  no dip. Deterministic per (seed, scenario, anchorDate, date) — hash-keyed mulberry32, no state —
  so overlapping loads produce byte-identical rows and re-loads are idempotent. Ordinal noise is
  deliberately generous so the 28-day baseline's MAD never degenerates (ADR-0002 suppression).
- `planLoadRange(existing, days, today)` — the "N more days" continuation math: first load ends
  TODAY (the engine evaluates today; without today's value nothing can fire); later loads fill
  forward from maxDate+1 to today first, then BACKFILL history before minDate. Never a day after
  today. (Backfill decision recorded below.)
- `validateLoaderBody` — days integer 1–60, seed ≤64 chars, scenario enum.

### Provenance (O11 locked: simulated rows clearly distinguishable)
- `wearable_daily`: EXISTING `source` column → `'simulated:run2-demo'`.
- `daily_gut_rows`: had no provenance column → NEW additive migration
  `supabase/migrations/20260724120000_add_daily_gut_rows_data_origin.sql` adds nullable
  `data_origin text` (+ column comment; NULL = real data; no default/backfill/RLS change).
  The daily-gut-row-to-schema and metrics-registry-to-schema Dart guards parse the ORIGINAL
  20260513 migration file only — verified: no biotope change needed, guards untouched.

### nao routes + page
- `POST/GET apps/nao/src/app/(app)/api/loader/route.ts` — GET returns the signed-in user's loaded
  range per table + server today (UTC); POST validates, plans, generates and UPSERTS
  (`onConflict user_id,log_date` / `user_id,date`) via the COOKIE-BOUND @supabase/ssr client —
  anon key + user session, never the service role; Postgres RLS scopes every write to the user.
- `POST apps/nao/src/app/(app)/api/loader/run-pipeline/route.ts` — server-side relay of the U5
  `run-pipeline` edge function; `SUPABASE_SERVICE_ROLE_KEY` read from server env only
  (apps/nao/.env → gen-env → .dev.vars; never NEXT_PUBLIC, never sent to the browser); relays the
  per-stage summary JSON verbatim (200/502 semantics preserved). Gateway fix: the local Kong
  requires an `apikey` header alongside the Authorization bearer — both sent.
- `apps/nao/src/app/(app)/loader/page.tsx` + `src/components/LoaderPanel.tsx` — "Data Loader"
  SubNav tab; IngestControlPanel's busy/error/fetch conventions + existing ingest/theme CSS
  (functional-not-pretty per O11). Shows current range, N-days form (placeholder default 14 first /
  7 increment), scenario + seed inputs, Run-analysis button with per-stage summary list + raw JSON.

### nao CI job (first nao code unit adds it) — `.github/workflows/ci.yml`
- New `nao` job mirroring node-tools style: node 26 + npm cache on apps/nao/package-lock.json →
  `npm ci` → `npm run typecheck` → `npm test`. Deliberately NO build step (OpenNext needs CF
  bindings CI doesn't have). Header job list updated (six → seven).
- `apps/nao/package.json` gains `"test": "node --experimental-test-module-mocks --test
  \"tests/**/*.test.ts\""` (mock.module is still flag-gated on Node 26).

### Tests — `apps/nao/tests/simulatedHealth.test.ts` (14 new; suite 54/54)
Determinism (same inputs byte-identical; different seed diverges; overlapping batches stitch),
correlated-shift shape (dip deltas ≥1 point / ≥50 min sleep / ≥8 ms HRV; steady has no shift;
r(gut,mood) > 0.3 over 120 days), CHECK-constraint safety across 120 days, provenance on EVERY row
(both tables), continuation math (first-load-ends-today, forward fill, overflow→backfill, clamp),
validation rejects/accepts.

**Pre-existing repair (in-scope: the new CI job must be green):** `tests/auth.test.ts` was stale —
its jose stubs predate auth.ts's `role !== 'authenticated'` defense-in-depth check and mock.module
needs the experimental flag; nao was never in CI so nobody saw it. Mechanical fix: stub payloads now
carry `role: 'authenticated'`; run instructions updated. No src/ change.

## Live proof (local stack, actual outputs)

Setup: fresh `npx supabase db reset` (all migrations incl. the new one), rule blueprints loaded via
`tools/rules npm run load` (8 rules — the rules table is derived data and empty after reset), dev
user created via the auth admin API: `u6-demo@ourobion.local` → uid
`963e80fd-945f-4225-a179-d64d3480e8cd`. `npm run dev` (:3000). Routes driven by fetch with the real
password-grant session projected into the @supabase/ssr cookie (`sb-127-auth-token`, base64url JSON)
— middleware ES256/JWKS verification passes against the local stack.

**1 · First load (POST /api/loader, defaults):**
```json
{"ok":true,"loadedDays":14,"forwardDays":14,"backfillDays":0,
 "segments":[{"startDate":"2026-07-11","days":14}],"seed":"run2-demo","scenario":"recent-dip",
 "range":{"minDate":"2026-07-11","maxDate":"2026-07-24","days":14},"today":"2026-07-24"}
```

**2 · SQL verification (rows + provenance + view):** daily_gut_rows 14/14 rows
`data_origin='simulated:run2-demo'`; wearable_daily 14/14 rows `source='simulated:run2-demo'`;
`metric_daily_values` shows all 16 metric keys × 14 days for the user. Dip visible: last 3 days
gut/mood/energy = (2,2,2), (1,2,2), (2,3,3) vs 4–5 baseline.

**3 · Run analysis #1 (POST /api/loader/run-pipeline) — cards from the loaded data:**
```json
{"ok":true,"stages":[
 {"stage":"compute-baselines","ok":true,"summary":{"ok":true,"users":1,"snapshots":16,"snapshotsPruned":0}},
 {"stage":"evaluate-signals","ok":true,"summary":{"ok":true,"day":"2026-07-24","users":1,
   "metricSignals":[16× state neutral, suppressed insufficient-baseline (13 < 14 baseline days — honest)],
   "personalSignals":{"pairsEvaluated":120,"rowsUpserted":120,"rowsPruned":0}}},
 {"stage":"generate-insights","ok":true,"summary":{"ok":true,"users":1,"rules":{"loaded":8},
   "cards":{"upserted":4,"byProducer":{"rules":4,"edge":0,"personal":0}}}}]}
```
insight_cards for the user: `energy_trending_down`, `gut_comfort_trending_down`, `gut_form_stable`,
`hydration_trending_up` — all producer `rules`, all generated from the simulated series.

**4 · Incremental +7 (main-loop step 3) — POST /api/loader again, defaults:**
```json
{"ok":true,"loadedDays":7,"forwardDays":0,"backfillDays":7,
 "segments":[{"startDate":"2026-07-04","days":7}],
 "range":{"minDate":"2026-07-04","maxDate":"2026-07-24","days":21}}
```
GET /api/loader confirms both tables now span 2026-07-04 → 2026-07-24 (21 days).

**5 · Run analysis #2 — S4 now fires on the strengthened baseline (20 ≥ 14 days):**
11 firedPatterns incl. `gut_comfort_score down z=-2.0235`, `mood_score down z=-2.0235`,
`sleep_duration_min down z=-1.5906`, `hrv_sdnn_ms down z=-1.0245`, `urine_colour up z=2.0235`;
personal_signals rich and correlated (e.g. hrv|sleep ρ=0.948 q=1e-5, gut_comfort|mood ρ=0.8395
q=0.00025 — stable=f, the 3-window stability gate needs a longer history than 21 days: honest);
generate-insights: `firedPatterns:11, cards:{upserted:4, rules:4}, gapLedger:{pairsTouched:110,
demandByStatus:{"personal-null":110}}` + brainScopeSkips for both cross rules (no verified edges on
the fresh DB → C10 scoping correctly skips; fired-signal patterns route to the gap ledger, not
fabricated cards — O16/O18 held).

## Gate summary

- apps/nao `npm run typecheck` (tsc --noEmit) — clean.
- apps/nao `npm test` — **54/54 pass** (40 pre-existing incl. 2 repaired stale auth tests + 14 new).
- `npx supabase db reset` — clean; new migration `20260724120000_add_daily_gut_rows_data_origin`
  applied; column + comment verified in psql.
- flutter analyze/test — NOT run: no biotope change (guards parse the original migration file only;
  verified by reading daily_gut_row_schema_test.dart / metrics_registry_schema_test.dart).
- Live proof — executed against the real local stack, outputs above.
- `node tools/context_sync.mjs --check` — passed.
- NUL-byte check on every new/edited file — clean (`git diff --stat` shows no Bin).

## Decisions made autonomously (for review)

- **Backfill semantics for "N more days":** first load ends today (else the evaluated day has no
  value and nothing can ever fire); when the range already reaches today, increments extend history
  BACKWARD (forward first when real days have passed). This is the only shape that satisfies both
  O11's "incrementally by day, up to today" and a single-sitting demo of main-loop steps 1→4;
  backfill genuinely strengthens the next run (S4 un-suppresses, pair windows fill).
- **Dip anchored to today** (not batch end): the recent days are always the anomalous ones, matching
  the demo narrative; previously loaded days are never rewritten (upsert only touches planned days).
- Defaults: 14 first / 7 increment / max 60; seed `run2-demo`; scenarios `recent-dip`/`steady`.
- Route names `/api/loader` + `/api/loader/run-pipeline`; tab label "Data Loader".
- Local-stack setup for the proof: rules table loaded via the sanctioned tools/rules loader
  (derived data, empty after reset); no verified_edges hand-seeded — the edge/personal card paths
  stay honestly empty and the gap ledger shows the demand instead.
- Repaired the stale nao auth tests (above) rather than excluding them from the new CI job.

memory: Run-2 U6 shipped O11 — nao /loader writes provenance-flagged simulated days (daily_gut_rows.data_origin new additive column; wearable_daily.source reused) as the RLS-scoped user, /api/loader/run-pipeline relays U5's trigger (service key server-side; local Kong also needs apikey header), continuation = forward-to-today then history backfill, nao joined CI (typecheck + node:test, no build).
