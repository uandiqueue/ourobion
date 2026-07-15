# Session 20260715T152517Z — agentjwork — claude — rules-as-data

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U5) · **Branch:**
  `feat/m5b-rules/rules-as-data` (cut from `feat/brain/quotecheck-venue-lookup`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** rules-engine Track B (B1–B3 + B5 of `docs/biotope/rules-engine-design.md`, executing
  memory 0007) — rules move from hardcoded TS to git-tracked JSON blueprints (TRUTH) loaded into a
  rebuildable Postgres `rules` table. The engine refactor that CONSUMES the table (step C) is a
  later session; `generate-insights` is untouched.

## Attempted
- Ship the full rules-as-data substrate: the `shared/rules` blueprint contract (B1), the 6 MVP
  rules faithfully ported to `data/rules/**` blueprints (B2 files), the `rules` projection table
  migration (B2 table), the deterministic loader with dry-run/check modes (B3), and the
  database-free blueprint guards + couplings registration (B5) — with the real load run against
  local supabase.

## Changed
- `shared/rules/` (NEW TRUTH-tier contract surface — **2-reviewer PR flag**, memory 0002):
  `rule.ts` (hand-authored types), `rule.schema.ts` (zod mirror + AssertExact drift guards +
  structural invariants + the copy/placeholder gate), `_assert.ts` (Equals/AssertExact),
  `index.ts` (accessors: `conditionMetricKeys`, `isInForce`, `blueprintRelPath`, …), `README.md`
  (owns the shape). Condition AST per the design doc: `trend` / `threshold` / `coincidence`
  discriminated union (details under Decided). `shared/tsconfig.json` include gains
  `rules/**/*.ts` so the CI shared typecheck covers it.
- `data/rules/single/<category>/<rule_id>.json` — the 6 MVP rules ported faithfully (same
  conditions, thresholds, copy, severity `info`): `hydration_trending_up`,
  `hydration_trending_down` (trend on `urine_colour`), `gut_form_stable` (std_dev ≤ 1.0),
  `gut_form_variable` (std_dev > 2.0) (threshold on `stool_form`), `energy_trending_down`
  (`energy_score`), `gut_comfort_trending_down` (`gut_comfort_score`); `notInsufficient(s)` →
  `minConfidence: "low"` everywhere. `data/rules/cross/README.md` stub (first cross rule lands
  with the engine session, which ships its evaluator).
- `supabase/migrations/20260715151252_create_m5b_rules_table.sql` — the derived-projection `rules`
  table (COMMENT marks it a projection): design-doc columns (`rule_id` pk, `schema_version`,
  `metric_keys text[]`, `condition_type` + `condition_params jsonb`, `title_template`,
  `body_template`, `severity`/`category` CHECKs character-identical to `insight_cards`',
  `enabled_phase`, `provenance_tier`, `source_citation jsonb`, `effective_from/to date`,
  `deprecated_at timestamptz`, `loaded_at`, `content_hash`) plus `scope`/`status`/`cooldown_days`/
  `expiry_days` (see Decided); partial index `where deprecated_at is null`; RLS on, no user/anon
  policy.
- `tools/rules/` (NEW package, house `tools/` style): `load_rules.mjs` (CLI: validate → flatten +
  sha256 content-hash → transactional upsert on `(rule_id)` + prune; `--dry-run` / `--check`
  validate without DB; `SUPABASE_DB_URL` env), `lib/blueprints.mjs` (the pure pipeline: discovery,
  zod validation, path/registry/copy enforcement, self-emptying QUARANTINE (empty), canonical
  hash, flatten), `package.json`/`tsconfig.json` (pg + tsx; node:test + typecheck scripts).
- `tools/rules/tests/` — 23 tests (22 pass + 1 planned-skip): `rule_blueprint.test.ts` (the B5
  database-free gate: schema + copy + registry keys + path/uniqueness + rejection paths + the
  cross/coincidence shape), `rules_table_schema.test.ts` (flattened row ⇄ migration column parity +
  every CHECK set ⇄ contract enum), `load_rules.test.ts` (determinism, canonical hash, faithful
  flatten, hard-fail paths on scratch trees), `engine_condition_coverage.test.ts` (runnable skipped
  placeholder until engine step C).
- `apps/biotope/test/guards/rules_table_contract_test.dart` — Dart guard required by design §B5:
  `rules` vs `insight_cards` category/severity CHECK literals character-identical + severity ==
  copy-guidelines ladder (3 tests; flutter suite now 43).
- `docs/graph/couplings.yaml` — 5 new edges: rules-blueprint-to-schema,
  rules-templates-to-copy-guidelines, rules-schema-to-rules-table,
  rules-table-to-insight-cards-parity (all active), rules-blueprint-to-engine-coverage (planned).
- Root `package.json` — `rules:load`, `rules:check`, `rules:test` scripts (design §B3).

## Decided
(every design-doc-silent point, recorded per session spec)
- **Condition AST details:** leaves exactly as design §B1; `coincidence` additionally carries
  `lagDays: number|null` (session spec asked for lag windows for cross rules; the design doc is
  silent) — null = same window, the only mode current 7-day snapshots support; lagged evaluation
  is deferred to windowed baselines in the engine refactor. `minConfidence` is `low|medium|high`
  (a floor; `insufficient` would be vacuous). Leaf `both[i]` must test `metricKeys[i]`, keys
  distinct, blueprint metricKeys == condition metricKeys — schema invariants.
- **Blueprint fields beyond the design list:** `scope: single|cross` and `status:
  active|deprecated` made explicit (session spec named them; registry house style keeps `status`
  alongside `deprecatedAt`, invariant-linked), plus `cooldownDays` (null = MVP behaviour, no
  cooldown) and `expiryDays` (7 on all ports — the MVP's hardcoded 7-day `expires_at`). All four
  flattened into table columns so the engine session reads them without a contract change.
- **Faithful-port calls:** severity `info` (the MVP hardcodes it), `enabledPhase:
  "phase1_stage1"` (matches the cards' `phase_generated`), provenance `hand_authored` with a
  sourceNote naming the ported rule; `provenance.tier` vocabulary is
  `hand_authored|extracted` (B4 candidates become `extracted` on promotion).
- **`source_citation jsonb`** stores `{ sourceNote, citation }` (the design names the column but
  not its shape).
- **RLS:** design doc actually specifies it (no user/anon policy; loader writes + engine reads as
  service_role) — followed as written, so the session spec's "if silent" fallback wasn't needed.
- **Loader:** kept at the design's exact path/language (`tools/rules/load_rules.mjs`, Node .mjs)
  with `SUPABASE_DB_URL` direct-pg (design §B3) rather than URL+key; it registers the tsx ESM
  loader (`tsx/esm/api`) to import the TS contract directly — no build step, one source of truth.
  Gotcha: shared/ compiles CJS, so `export * from` barrel re-exports aren't visible through the
  ESM interop — the loader imports `rule.schema.ts` directly.
- **Guard placement:** node tests live in `tools/rules/tests/` (the design's repo-root `tests/`
  placeholder was removed in a prior session; brain-ingest precedent). **CI does NOT run node
  tool-package tests** (ci.yml = context / flutter / shared-tsc only, same gap as brain-ingest) —
  noted for the orchestrator; the Dart parity guard DOES run in CI via `flutter test`.
- **B5's `engine_condition_coverage` guard** ships as a runnable skipped placeholder with a
  `status: planned` coupling (couplings.yaml convention) — there is no evaluator surface until
  engine step C.

## Left
- **B4 extract skeleton** (`tools/rules/extract/`) — not in this session's change list; waits on
  the research paper (design "Open items" #1) and the claude-api model/pricing check at build time.
- Engine refactor (step C / U12): consume the `rules` table, evaluators + render + vendored Deno
  copy-guard, first cross blueprint, and flipping the coverage guard + coupling to active.
- CI job for node tool-package tests (`npm run rules:test`) — decision for the orchestrator;
  would also cover brain-ingest.
- `docs/INDEX.md`/`docs/memory/README.md` regenerated via `--fix-index` (no doc-tree changes
  beyond the session log).

## Blockers
- None. Gate: loader `--dry-run` ✓; real load against local supabase (`npx supabase db reset`
  applied all 10 migrations cleanly, then `npm run rules:load`) → **6 rows in `rules`**, verified
  by direct query (RLS on, 0 policies), second load idempotent (6 rows, 0 pruned) ·
  `tools/rules` tests 22 pass / 1 planned-skip + `tsc --noEmit` clean · shared `npx tsc --noEmit`
  clean (now includes shared/rules) · `flutter analyze` clean · `flutter test` 43/43 (40 + 3 new
  guard tests; generated-file churn reverted) · `context_sync --fix-index` + `--check` pass.

memory: none
