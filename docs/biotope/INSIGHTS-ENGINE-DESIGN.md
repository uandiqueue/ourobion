# Insights Engine — Design (Phase 2, W2 / Track B)

The detailed design for ourobion's **data-driven insights engine**: a PDF → structured-rules → engine
pipeline that replaces the MVP's hardcoded rules. Sequencing, ownership, and the gate live in
[`PHASE2-PLAN.md`](../PHASE2-PLAN.md); this doc is the **contract + step detail**.

## Why

ourobion's MVP analysis is shallow: `supabase/functions/generate-insights/index.ts` evaluates **6
hardcoded TypeScript rules** (`condition: (s: BaselineSnapshot) => boolean`, single-metric only). The
rules are **code, not data**, so adding/editing one means redeploying an edge function, and cross-metric
patterns are impossible. The engine makes rules **reviewable data**, adds **cross-metric** evaluation,
and lets cards explain **why** they fired — all **deterministic**, with no LLM in the hot path.

## The pattern (two-tier truth, adapted to Postgres)

Git-tracked JSON **blueprints** = TRUTH (PR-reviewed, human-approved) → loaded into a **derived,
rebuildable** Postgres `rules` table. Typed model + **Zod** mirror with compile-time drift guards.
Batch **extract** (PDF → JSON via Claude API + human review) → **load/normalize** → **deterministic
engine**; the LLM is confined to the offline extract step with cost discipline. (Pattern borrowed from
sister repo NUSPlan; ourobion targets Postgres instead of Neo4j and uses **no Python**.)

This maps onto ourobion's [two-tier truth](../memory/0001-two-tier-truth.md): `data/rules/**.json` join raw
rows + migrations + `shared/` as TRUTH; the `rules` table joins `baseline_snapshots` + `insight_cards`
as rebuildable PROJECTIONS.

### Condition set — CORE

`trend` + `threshold` + `correlation` cover all 6 current rules plus the cross-metric requirement.
`deviation`/`all`/`any` are deferred until a real rule needs them.

## Steps (engine refactor is LAST)

The engine can't go data-driven until the rule contract exists + is parity-guarded (B1), the `rules`
projection exists (B2), and the loader has populated it (B3) — so **B precedes C**.

### B1. Rule-blueprint contract (TRUTH) — `shared/rules/`

Mirror the types/schema split (`shared/` already depends on `zod@4`). New files: `_assert.ts`
(`Equals`/`AssertExact`), `rule.ts` (hand-authored types), `rule.schema.ts` (Zod mirror + drift guards),
`index.ts`, `README.md`. On-disk truth at repo-root **`data/rules/{single,cross}/<category>/<rule_id>.json`**,
**one file per rule** (surgical, conflict-free diffs).

Blueprint fields: `ruleId` (== `insight_cards.rule_id`, the upsert key), `schemaVersion`, `category`,
`severity`, `enabledPhase`, `metricKeys[]` (1 = single, 2+ = cross), `provenance` {tier, sourceNote,
citation}, `effectiveFrom`/`effectiveTo`, `deprecatedAt`, `condition` (union below), `template`
{title, body} with `{{placeholder}}`s. Non-diagnostic copy enforced by running every template through
`validateCopyString` (`shared/constants/copy_guidelines.ts`).

**Condition union (Zod `discriminatedUnion`, one pure evaluator per type):**
- `{type:"trend", metricKey, equals:"rising|falling|stable", minConfidence}` — replaces the 4 trend rules.
- `{type:"threshold", metricKey, field:"mean|std_dev|min|max", op:"lt|lte|gt|gte|eq", value, minConfidence}` — replaces `gut_form_stable` (std_dev ≤ 1.0) / `gut_form_variable` (std_dev > 2.0).
- `{type:"correlation", metricKeys:[K1,K2], both:[<leaf on K1>,<leaf on K2>], minConfidence}` — the cross-metric primitive (reads two `baseline_snapshots` rows for one user).

`minConfidence` generalizes the scattered `notInsufficient(s)` checks.

**B1 is a new `shared/` contract surface → 2-reviewer PR** (AGENTS.md §3 / [memory 0002](../memory/0002-shared-contract-two-reviewers.md)).

### B2. `rules` table (DERIVED PROJECTION) — new migration

Columns: `rule_id pk`, `schema_version`, `metric_keys text[]`, `condition_type text`,
`condition_params jsonb`, `title_template`, `body_template`, `severity`, `category`, `enabled_phase`,
`provenance_tier`, `effective_from date`, `effective_to date`, `deprecated_at timestamptz`,
`source_citation jsonb`, `loaded_at`, `content_hash`. `category`/`severity` CHECKs **character-identical**
to `insight_cards`'. RLS on, **no user/anon policy** (loader writes as service_role, engine reads as
service_role — mirrors `baseline_snapshots`). Partial index `where deprecated_at is null`. **No
`insight_cards` migration** — it already has `rule_id`, `contributing_metrics[]`, `confidence_sources[]`,
`phase_generated`, severity. Engine read filter: `enabled_phase = $active and deprecated_at is null and
(effective_from is null or <= today) and (effective_to is null or >= today)`.

### B3. Loader — `tools/rules/load_rules.mjs` (Node, repo-root `tools/`)

Read `data/rules/**.json` → `safeParse` against `rule.schema.ts` (self-emptying QUARANTINE allowed for
seed warts) → copy-guard every template → `content_hash` (`node:crypto`) → flatten condition →
**transactional** upsert `on conflict (rule_id)` + delete rows whose blueprint is gone (full-rebuild
projection). Connect via `SUPABASE_DB_URL` (direct `pg`). Add `rules:load` to root `package.json`.
Batch, deterministic, **no LLM**.

### B4. Extract — `tools/rules/extract/` (ONLY LLM stage; offline/batch; **skeleton until a paper arrives**)

`index.mjs` CLI: paper PDF → *candidate* rule JSON (condition + non-diagnostic templates + citation to
section/page) into `data/rules/_candidates/` for **human review** (candidates are NOT loadable until a
human promotes them into `data/rules/{single,cross}/…` — the human-in-the-loop gate). `catalog.yaml`
source manifest (paperId, title, trust tier, path/URL). **Cost discipline in code:** cheap-model default,
hard `OUROBION_EXTRACT_BUDGET_USD` abort, append model+tokens+cost to
`data/rules/_candidates/usage.jsonl`. **Confirm model id + pricing against the live Claude API reference
at build time (use the `claude-api` skill) — never hardcode from memory.**

### B5. Guards + couplings

- `tests/rules/rule_blueprint.test.ts` (Node `node:test`): valid JSON parses against `rule.schema.ts` +
  QUARANTINE + every template passes `validateCopyString`.
- `tests/rules/engine_condition_coverage.test.ts`: every `condition_type` used by a blueprint has an
  evaluator branch (prevents an unevaluatable rule).
- `apps/biotope/test/guards/rules_table_contract_test.dart`: asserts the `rules` migration's `category`/`severity`
  CHECK sets are identical to `insight_cards`'.
- Add edges to `docs/graph/couplings.yaml` (each names a guard file; `context_sync.mjs --check` fails if
  missing): blueprint↔schema, schema↔rules-table, rules-table↔insight_cards parity, templates↔copy
  guidelines, blueprint↔engine condition coverage.

### C. Engine refactor (LAST) — `supabase/functions/generate-insights/`

Refactor from hardcoded `RULES: Rule[]` to load `rules` rows and evaluate generic pure evaluators,
**including cross-metric** (multiple `baseline_snapshots` per user). Split the Deno function:
- `evaluators.ts` — **pure, no IO**: one evaluator per `condition_type`; takes params + one user's
  `Map<metricKey, BaselineSnapshot>` → boolean. `minConfidence` replaces `notInsufficient(s)`.
- `render.ts` — **pure**: fill `title_template`/`body_template`, then a **vendored** Deno copy-guard
  (`FORBIDDEN_WORDS` copied across the runtime seam, kept in sync by a couplings guard). Drop + log any
  card that fails (defense in depth; B3/B5 already block bad templates at load).
- `index.ts` — IO shell: keep baselines + dismissed-card fetches, **add the in-force `rules` fetch**,
  build per-user metric map, gate by `metric_keys ⊆ available`, evaluate, skip dismissed, render+guard,
  upsert. Preserve `(user_id, rule_id)` upsert, `CONFIDENCE_SCORE`, 7-day `expires_at`, `phase_generated`.

**Deterministic** — evaluators are pure functions of (params, snapshot map); no network/LLM. Tests:
`evaluators.test.ts` golden fixtures per type + cross-metric (`deno test`).

### D. Verification

`npx supabase start` → `db reset` → `npm run rules:test` → `npm run rules:load` (verify `rules`, incl. a
2-metric `correlation` row) → seed `baseline_snapshots` tripping a single + a cross rule →
`deno test supabase/functions/generate-insights/` → `functions serve` + service-role curl → confirm
`insight_cards` populate (cross card has 2 `contributing_metrics`) → dismiss + re-invoke → not
regenerated → `flutter analyze` + `flutter test` + `node tools/context_sync.mjs --check`.

### E. (Later, additive) Presentation agent — the runtime NL layer

Per the [pipeline decision](../human-briefs/2026-07-01-brain-pipeline-and-training-eval.md), the runtime
NL layer is a **presentation agent** (haiku-tier): it reads already-generated deterministic
`insight_cards` / trend packages + the retrieved brain subgraph and emits curated summaries + template
copy. It is **grounded** (introduces no relationship or number not in its input), **copy-gated** (runs
`validateCopyString` at render), **cached + fire-triggered** (generate on insight-fire, not per render —
cheap model, budgeted, usage-logged, same discipline as B4), and **degradable** (falls back to
deterministic templated copy). It consumes engine output and changes nothing about deterministic
generation — the engine stays the authority for *what is true and the numbers*; the agent only phrases
*how it reads*.

## Determinism + non-diagnostic, end to end

- **Deterministic:** the only LLM is the offline `extract` CLI (B4), human-reviewed before reaching
  `data/rules`. Loader + engine are pure batch code; evaluators are pure functions.
- **Non-diagnostic:** copy lives only in templates, checked at load (B3), at the blueprint guard (B5),
  and at render (C) — three gates, same `FORBIDDEN_WORDS`, with a couplings guard keeping the
  Deno-vendored list synced to the shared one.
- **Two-tier truth:** `data/rules/**.json` + raw rows + migrations are TRUTH; `rules` + `insight_cards`
  are rebuildable PROJECTIONS. To change a card, fix a blueprint or raw row and re-run — never hand-edit.

## Open items (confirm at implementation)

1. **Research-paper PDF** — needed to author real rules; the B4 skeleton waits on it. Hand-author the
   first blueprints if it hasn't arrived.
2. **`shared/rules` Dart parity** — recommend **TS-only** (the app renders `insight_cards`, already a
   shared contract; no need to render raw rule metadata).
3. **`rules` reload trigger** — recommend CI-on-`data/rules`-change + manual; **no cron**.
4. **Node test runner** — recommend `node:test` (no new dep) over `vitest`.

## Critical existing files (integration surface)

- `supabase/functions/generate-insights/index.ts` — the hardcoded `RULES` array to make data-driven (C).
- `supabase/functions/compute-baselines/index.ts` + `migrations/20260515100000_create_m5a_baseline_snapshots.sql` — M5a, **unchanged**.
- `migrations/20260515110000_create_m5b_insight_cards.sql` — the `category`/`severity`/`rule_id` sets the new `rules` table mirrors.
- `shared/types/index.ts`, `shared/constants/copy_guidelines.{ts,dart}` — contracts + the non-diagnostic gate reused at load/render.
- `docs/graph/couplings.yaml`, `apps/biotope/test/guards/` — where new parity guards register (`context_sync.mjs --check` enforces them).
