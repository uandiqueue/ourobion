# Session 20260718T051721Z — agentjwork — claude — u25-db-constraint-hygiene

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U25) · **Branch:**
  `fix/db/constraint-hygiene` (cut from the chain tip
  `fix/loaders/empty-guard-timestamp-normalize`) · **Issue:** #84 · **PR:** #85 (stacked)
- **Type:** audit-fix unit U25 — **DB constraint hygiene**, findings A17 (nit) + A16 (nit) from
  `docs/temp/phase2-audit/audit-findings-register.md`, shipped as ONE new additive migration per
  sign-off decision D19 (shipped migrations are append-only even while unreleased). A15
  (`derived_metrics` RLS breadth) is explicitly OUT of this unit — documented by-design per D9,
  awaiting Jayden.

## Attempted
- A17: add the cheap CHECKs the S5/S7 tables were missing while their siblings encode analogous
  invariants; A16: stop `edge_verifications.edge_score numeric(4,3)` from rounding the loader's
  float into visually contradicting the `serving_band` that was gated on the unrounded value.

## Changed (committed)
- `supabase/migrations/20260718051721_constraint_hygiene_checks_and_edge_score_precision.sql`
  (NEW — the only migration; shipped files untouched per D19):
  - **A17, composed_insights:** `composed_insights_period_order` — `check (period_end >= period_start)`.
  - **A17, personal_signals:** `personal_signals_rho_range` / `_ci_low_range` / `_ci_high_range`
    (`between -1 and 1`) + `personal_signals_q_value_range` (`between 0 and 1`). All explicitly
    named per house style (`personal_signals_pair_order` / `insight_cards_personal_uncited`
    precedent). `ci_low`/`ci_high` are nullable (CI not computable when n_eff too small) — SQL
    CHECKs pass on NULL, so the "no CI" state stays representable; `rho`/`q_value` are `not null`
    so their CHECKs always bind.
  - **A16, edge_verifications:** `edge_score` widened `numeric(4,3)` → unconstrained `numeric`
    (the D11 `baseline_snapshots` widening precedent). Postgres refuses to alter a column a view
    depends on, so `verified_edges` is dropped and recreated **character-identical** around the
    ALTER (view + its comment). The `[0,1]` range CHECK from the create-table migration survives
    the type change untouched. Column comment extended with the A16 rationale.
- `tools/edge-loader/tests/edge_table_schema.test.ts` (+1 guard test): the view definition now
  exists in TWO migration files — the new test pins the hygiene migration's `verified_edges`
  block character-identical (CRLF-normalized) to the S6 original and asserts the
  `alter column edge_score type numeric;` line, so the serving semantics can never fork between
  the create and the amendment.
- `docs/temp/phase2-run-orchestration-log.md`: U25 row → done, ledger row appended.

## Decided / judgment calls
- **`between` syntax for the ranges** (vs the create-table migration's `>= and <=` spelling on
  edge_score) — same semantics, reads as the invariant; constraint NAMES are the API surface the
  rejections speak, and those follow house style.
- **No `ci_low <= ci_high` cross-column CHECK** — the register asks for the [-1,1] ranges only;
  staying scoped to the audit finding (D19 units fix what the register records, not more).
- **View recreated in-migration, byte-identical** — the alternative (`alter view` doesn't exist
  for column-type rebinds; leaving the view unrecreated fails the ALTER outright). The drop is
  safe mid-migration: recreation happens in the same transaction, and the guard test now holds
  the two definitions together.
- **Existing rounded rows are NOT rewritten by the migration** — the tables are a derived
  projection (docs/memory/0001); the loader's next full rebuild repopulates the scores unrounded,
  which the live re-load proved (see below).
- **Architecture doc's §S6 DDL sketch (`numeric(4,3)`) left as-is** — it documents the shipped
  create-table migration; the amendment is register/decision-traced. Flagged here for the doc's
  next reconciliation pass.

## Live proof (fresh `npx supabase db reset` — all 16 migrations applied clean, incl. the new one)
- **Schema:** `information_schema.columns` → `edge_score | numeric | (no precision/scale)`;
  `pg_constraint` lists all 5 new named CHECKs + the surviving `edge_verifications_edge_score_check`.
- **A17 rejections (each by name):**
  - `rho = 1.5` → `ERROR: … violates check constraint "personal_signals_rho_range"`
  - `q_value = 2` → `… violates check constraint "personal_signals_q_value_range"`
  - `ci_low = -1.2` → `… violates check constraint "personal_signals_ci_low_range"`
  - `period_end 2026-07-03 < period_start 2026-07-10` → `… violates check constraint
    "composed_insights_period_order"`
  - Valid rows land: `rho=0.6` with NULL CIs inserted fine (null-tolerance proven); valid period
    inserted fine. All proof rows (incl. the scratch auth user) deleted after.
- **A16 unrounded storage:** direct insert `edge_score = 0.8555555` → `returning` shows
  `0.8555555` (was: rounded to 0.856); `verified_edges` serves the same unrounded value with its
  band.
- **Loader round-trip:** fixture load via `load_edges.mjs --from-dir` → the raw JS double stores
  exactly: `sleep_duration_min|decreases|resting_hr_bpm → 0.5599999999999999 / mid` (pre-A16 the
  column stored `0.560`). The loader never rounded in JS (`brain.edgeScore(v)` passed through),
  so nothing upstream changes. Immediate re-run: `pruned 0 claim(s) + 0 verification(s)` —
  idempotency holds with the widened column (upsert key is `(edge_id, verified_at)`, score-blind).

## Gate results (all green)
- `tools/edge-loader`: **36/36** (was 35; +1 view-identity guard), `tsc --noEmit` clean.
- Dart guards: `rules_table_contract_test.dart` + both brain guards green inside the suite.
- `flutter analyze` — no issues; `flutter test` — **62/62**.
- `node tools/context_sync.mjs --check` — consistent.

## Left / follow-ups (not this unit)
- A15 (`derived_metrics` full-CRUD RLS vs select-only siblings) — by-design per D9, Jayden may
  still flag the precedent conflict; deliberately not re-decided here.
- `insight_cards.confidence_score numeric(4,3)` has the same precision shape but no precomputed
  band to contradict — no finding, left alone.
- `docs/shared/insight-engine-architecture.md` §S6 sketch still shows `numeric(4,3)` — reconcile
  at the doc's next `updated:` bump.

## Blockers
- None.

memory: none
