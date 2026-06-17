# biotope — Next-Phase Direction & Plan

> **See first:** [`PHASE2-GOALS-AND-FEATURES.md`](PHASE2-GOALS-AND-FEATURES.md) (2026-06-11)
> consolidates all goals into the Phase 2 feature list; its **W0 Foundations supersedes the
> "Phase 0" section below**. This doc remains the detailed design for the analysis pipeline (W2).

> The next phase of work: **clear the remaining P1S2 backlog first (Phase 0)**, then build the
> **deep health-metric analysis pipeline** (PDF → structured rules → engine), engine **last**.
>
> **Status:** APPROVED PLAN (planning session, 2026-06-09). **No code shipped yet** — this is the
> roadmap the implementation sessions execute. Tracking issue: **#3**.
> Human-facing summary: [`human-briefs/2026-06-09-next-phase-direction.md`](human-briefs/2026-06-09-next-phase-direction.md).

## Context — why

biotope's "analysis" is only MVP-deep. `supabase/functions/generate-insights/index.ts` evaluates **6
hardcoded TypeScript rules** (`condition: (s: BaselineSnapshot) => boolean`, single-metric only). True
**Phase 2** analysis — cross-metric rules + a real insight engine + explanations — is still Future. The
rules are **code, not data**, so adding/editing a rule means redeploying an edge function, and
cross-metric patterns are impossible.

We will build a **PDF → structured-rules → engine** pipeline modeled on sister repo **NUSPlan**
(`C:\project\NUSPlan`), adopt **graphify** for agent/ingestion context management, and sequence the
**analysis engine LAST**. The **AI/LLM summary** of insights is a still-later phase — the engine runs
fully on **deterministic** rules with no LLM in the hot path.

**"Engine last" means literally last** — there is undone P1S2 work that must be cleared first
(**Phase 0** below). Some of it (the incomplete Dart shared contracts and the placeholder parity guards)
is a *hard prerequisite* for the rules pipeline, which builds on those same contracts + guard patterns.

### Decisions locked (planning session)
- **Condition set = core**: `trend` + `threshold` + `correlation` (covers all 6 current rules + the new
  cross-metric requirement). `deviation`/`all`/`any` deferred until a real rule needs them.
- **Research paper not yet provided** → the `extract` step ships as a runnable-but-unused skeleton.
- **Sequence**: foundations first, **engine last**; AI summary later.
- **aeroplus-datum is not on disk** — only NUSPlan + its `reference_guide.md` (which reads
  aeroplus-datum second-hand). Trust-tier / validity-window / cost-discipline patterns come from there.

## The NUSPlan pattern we replicate (adapted to Postgres, no Python)

Two-tier truth: git-tracked JSON **blueprints** = TRUTH (PR-reviewed, human-approved) → loaded into a
**derived, rebuildable store** (NUSPlan: Neo4j; biotope: a Postgres `rules` table). Typed model + **Zod**
mirror with compile-time drift guards. Batch **extract** (PDF→JSON via Claude API + human review — a
*placeholder* even in NUSPlan) → **ingest/normalize** → **build/load**. **Deterministic engine**; LLM
confined to the offline extract step with cost discipline (cheap-model default, hard budget cap, usage
log). References: `nusplan-2/packages/shared/src/types/requirement.ts`, `.../schemas/requirement.ts`,
`nusplan-2/data/blueprints/`, `nusplan-2/docs/reference_guide.md`, legacy
`NUSPlan-BE/src/services/validator/courseValidator.ts`.

This maps onto biotope's existing **two-tier truth** (AGENTS.md §2): raw rows + migrations + `shared/`
contracts = truth; `baseline_snapshots` + `insight_cards` = rebuildable projections. The new
`data/rules/**.json` blueprints become truth; the new `rules` table becomes another rebuildable
projection.

## Roadmap — sequenced, engine LAST

| Step | Workstream | Key outputs | Notes |
|---|---|---|---|
| **0** | clear the P1S2 backlog (the "everything else") | see Phase 0 below | hard prereqs ⊂ this; engine cannot start until done |
| **A** | graphify adoption (**DONE 2026-06-17**) | `docs/memory/0008-*`; `docs/graph/README.md`; `scripts/graphify-build.ps1`; `graphify-out/` (gitignored) | installed + indexing; not on engine's critical path |
| **B1** | rule-blueprint contract (types + Zod + AssertExact) | `shared/rules/**` | **`shared/` ⇒ 2-reviewer PR** (memory 0002) |
| **B2** | `rules` table migration (projection) | `supabase/migrations/…_create_rules.sql` | rebuildable; mirrors `insight_cards` CHECK sets |
| **B3** | loader (validate blueprints → upsert `rules`) | `tools/rules/load_rules.mjs` | Node; transactional upsert+prune; no LLM |
| **B4** | extract step (PDF→candidate JSON, LLM-fenced) | `tools/rules/extract/**` + `catalog.yaml` | **skeleton only** until paper arrives |
| **B5** | guard tests + couplings edges | `tests/rules/**`, `src/test/guards/**`, `couplings.yaml` | enforce blueprint↔table↔contract↔copy parity |
| **C** | engine refactor (data-driven, cross-metric) | `supabase/functions/generate-insights/` → `evaluators.ts` / `render.ts` / `index.ts` | **LAST**; deterministic |
| **D** | end-to-end verification | runbook | local Supabase → `insight_cards` populate |
| **E** | (LATER, out of scope) AI-summary additive layer | — | consumes engine output; deterministic generation unchanged |

**Ordering rationale:** the engine can't go data-driven until the rule contract exists + is
parity-guarded (B1), the `rules` projection exists (B2), and the loader has populated it (B3) — so **B
precedes C**. A (graphify) is the context substrate the pipeline authors use and is **now done**
(installed + indexing, off the engine's critical path). E (LLM summary) is deferred and additive — the
engine ships fully functional without it.

### Phase 0. Clear first — the "everything else" (precedes A–C)
Undone P1S2 work to clear before the analysis engine. **Hard prerequisites** for the rules pipeline are
marked ⛔ (the pipeline builds on the same contracts + guard patterns); the rest is general backlog.

- ⛔ **Complete the Dart shared contracts** — `shared/types/index.dart` currently has only `DailyGutRow`
  (missing `fromJson`/`toJson`); `BaselineSnapshot`, `InsightCard`, `InsightFiredEvent`,
  `EngagementState`, `DailyPhysioRow`, `DailyEnvRow` are `TODO`. Also `shared/constants/copy_guidelines.dart`
  `getCopyRule()` is a stub. (`shared/` ⇒ 2-reviewer PR.)
- ⛔ **Make the 3 placeholder guard tests real** — `src/test/guards/{shared_types_parity,
  copy_guidelines_parity,daily_gut_row_schema}_test.dart` are skipped `status: planned`; promote the
  matching `docs/graph/couplings.yaml` edges `planned → active`.
- ⛔ **M3 end-to-end device test** — real HealthKit → `wearable_daily` (wearable confidence feeds the
  Phase-2 cross-metric rules).
- **M1:** app-shell tab navigation (replace the `[DEV]` `home_screen.dart` placeholder); PDPA consent
  legal-copy review.
- **M2:** extract inline DQS/save logic into `normaliser.dart` + `logging_controller.dart`
  (testability); build standing-water weekly audit, symptom-flags multi-select, antibiotic-course
  tracker + `antibiotic_service.dart`; add focused DQS/normalise/upsert tests.
- **M6:** surface `dqs_7day_avg` + `longest_streak` in the UI.

**Deferred by design — NOT prerequisites, leave as-is:** M4 `env_daily` + module (P1S3); M7 community
(Phase 3); Google/Apple OAuth (awaits Supabase dashboard config); the deferred structural import-graph
(`docs/graph/README.md` — still deferred; graphify is the **complementary semantic** graph, not a
substitute for it); the Gemini session-start hook.

> Each backlog item should become its own issue + session when picked up — Phase 0 is the *clear-list*,
> not one mega-task. The analysis pipeline (A–E) starts once the ⛔ hard prerequisites are green.

### A. graphify (ADOPTED — installed + indexing, 2026-06-17)
graphify (github.com/safishamsi/graphify, PyPI `graphifyy`) is a **semantic knowledge-graph** skill,
**complementary** to the structural import-graph that `docs/graph/README.md` marks DEFERRED. Decision +
verified coverage in [`memory/0008-graphify-context-tool.md`](memory/0008-graphify-context-tool.md):
index **biotope's own repo** as the primary graph (agent context-overload, role a); index the
**research-paper corpus as a separate graph** (ingestion context, role b) once it arrives; **never index
NUSPlan** (read-once reference — indexing pollutes biotope's graph).

**As adopted (vs the original design sketch):**
- Installed **project-bounded** (venv in `..\biotope-toolchain\graphify-venv`, never global); rebuild via
  **`scripts/graphify-build.ps1`**. graphify's native `install` (edits `CLAUDE.md` + adds a hook) was
  **not** run — `CLAUDE.md` stays a thin pointer; usage is documented in AGENTS.md §8 + `docs/graph/README.md`.
- Artifacts at repo-root **`graphify-out/`** (graphify's native dir), **gitignored** — this
  **supersedes the planned `docs/graph/generated/` path** (0.8.40 hard-defaults to `graphify-out/`).
  Promote `graph.json` to committed + add a regenerate/diff check to `tools/context_sync.mjs --check`
  once a path-normalizer (port NUSPlan `tools/normalize_deps_graph.mjs`) makes it diff cleanly cross-machine.
- AST extraction is fully local (Dart + TS + more, no key). The cross-language **semantic pass needs no
  API key** — invoked inside Claude Code it uses the host session model (resolves open-decision #1's key
  concern for this step).

### B1. Rule-blueprint contract (TRUTH) — `shared/rules/`
Mirror NUSPlan's types/schema split (`shared/` already depends on `zod@4`). New files: `_assert.ts`
(`Equals`/`AssertExact`), `rule.ts` (hand-authored types), `rule.schema.ts` (Zod mirror + drift guards),
`index.ts`, `README.md`. On-disk truth at repo-root **`data/rules/{single,cross}/<category>/<rule_id>.json`**,
**one file per rule** (surgical, conflict-free diffs).

Blueprint fields: `ruleId` (== `insight_cards.rule_id`, the upsert key), `schemaVersion`, `category`,
`severity`, `enabledPhase`, `metricKeys[]` (1 = single, 2+ = cross), `provenance` {tier, sourceNote,
citation}, `effectiveFrom`/`effectiveTo`, `deprecatedAt`, `condition` (union below), `template`
{title, body} with `{{placeholder}}`s. Non-diagnostic copy enforced by running every template through
`validateCopyString` (`shared/constants/copy_guidelines.ts`).

**Condition union — CORE set (Zod `discriminatedUnion`, one pure evaluator per type):**
- `{type:"trend", metricKey, equals:"rising|falling|stable", minConfidence}` — replaces the 4 trend rules.
- `{type:"threshold", metricKey, field:"mean|std_dev|min|max", op:"lt|lte|gt|gte|eq", value, minConfidence}` — replaces `gut_form_stable` (std_dev ≤ 1.0) / `gut_form_variable` (std_dev > 2.0).
- `{type:"correlation", metricKeys:[K1,K2], both:[<leaf on K1>,<leaf on K2>], minConfidence}` — the cross-metric primitive (reads two `baseline_snapshots` rows for one user).

`minConfidence` generalizes the scattered `notInsufficient(s)` checks. `deviation`/`all`/`any` are
deferred.

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
biotope's analog of NUSPlan's `build`, targeting Postgres: read `data/rules/**.json` → `safeParse`
against `rule.schema.ts` (self-emptying QUARANTINE allowed for seed warts) → copy-guard every template
→ `content_hash` (`node:crypto`) → flatten condition → **transactional** upsert `on conflict (rule_id)` +
delete rows whose blueprint is gone (full-rebuild projection). Connect via `SUPABASE_DB_URL` (direct
`pg`). Add `rules:load` to root `package.json`. Batch, deterministic, **no LLM**.

### B4. Extract — `tools/rules/extract/` (ONLY LLM stage; offline/batch; **skeleton this phase**)
`index.mjs` CLI: paper PDF → *candidate* rule JSON (condition + non-diagnostic templates + citation to
section/page) into `data/rules/_candidates/` for **human review** (candidates are NOT loadable until a
human promotes them into `data/rules/{single,cross}/…` — the human-in-the-loop gate). `catalog.yaml`
source manifest (paperId, title, trust tier, path/URL). **Cost discipline in code:** cheap-model default,
hard `BIOTOPE_EXTRACT_BUDGET_USD` abort, append model+tokens+cost to
`data/rules/_candidates/usage.jsonl`. **Confirm model id + pricing against the live Claude API reference
at build time (use the `claude-api` skill) — never hardcode from memory.** Ships runnable-but-unused
(no paper yet).

### B5. Guards + couplings
- `tests/rules/rule_blueprint.test.ts` (Node, `node:test` — no new dep): valid JSON parses against
  `rule.schema.ts` + QUARANTINE + every template passes `validateCopyString`.
- `tests/rules/engine_condition_coverage.test.ts`: every `condition_type` used by a blueprint has an
  evaluator branch (prevents an unevaluatable rule).
- `src/test/guards/rules_table_contract_test.dart`: asserts the `rules` migration's `category`/`severity`
  CHECK sets are identical to `insight_cards`'.
- Add edges to `docs/graph/couplings.yaml` (each names a guard file; `context_sync.mjs --check` fails if
  missing): blueprint↔schema, schema↔rules-table, rules-table↔insight_cards parity, templates↔copy
  guidelines, blueprint↔engine condition coverage. `status: planned` → promote to `active` when filled.

**B1 is a new `shared/` contract surface → 2-reviewer PR** (AGENTS.md §3 / memory 0002).

### C. Engine refactor (LAST) — `supabase/functions/generate-insights/`
Refactor from hardcoded `RULES: Rule[]` to load `rules` rows and evaluate generic pure evaluators,
**including cross-metric** (multiple `baseline_snapshots` per user). Split the Deno function:
- `evaluators.ts` — **pure, no IO**: one evaluator per `condition_type`; takes params + one user's
  `Map<metricKey, BaselineSnapshot>` → boolean. `minConfidence` replaces `notInsufficient(s)`.
- `render.ts` — **pure**: fill `title_template`/`body_template`, then a **vendored** Deno copy-guard
  (`FORBIDDEN_WORDS` copied across the runtime seam, kept in sync by a couplings guard). Drop + log any
  card that fails (defense in depth; B3/B5 already block bad templates at load).
- `index.ts` — IO shell: keep baselines + dismissed-card fetches, **add the in-force `rules` fetch**,
  build per-user metric map (already present), gate by `metric_keys ⊆ available`, evaluate, skip
  dismissed, render+guard, upsert. Preserve `(user_id, rule_id)` upsert, `CONFIDENCE_SCORE`, 7-day
  `expires_at`, `phase_generated`.

**Deterministic** — evaluators are pure functions of (params, snapshot map); no network/LLM. Tests:
`evaluators.test.ts` golden fixtures per type + cross-metric (`deno test`).

### D. Verification (when implemented)
`npx supabase start` → `db reset` → `npm run rules:test` → `npm run rules:load` (verify `rules`, incl. a
2-metric `correlation` row) → seed `baseline_snapshots` tripping a single + a cross rule →
`deno test supabase/functions/generate-insights/` → `functions serve` + service-role curl → confirm
`insight_cards` populate (cross card has 2 `contributing_metrics`) → dismiss + re-invoke → not
regenerated → `flutter analyze` + `flutter test` + `node tools/context_sync.mjs --check`.

### E. (LATER, out of scope) AI-summary additive layer
A separate batch/edge step could read already-generated deterministic `insight_cards` and emit an
optional NL weekly summary (cheap model, budgeted, usage-logged — same discipline as B4). It consumes
engine output and changes nothing about deterministic generation. Named only so the engine's interfaces
leave room.

## Determinism + non-diagnostic, end to end
- **Deterministic:** the only LLM is the offline `extract` CLI (B4), human-reviewed before reaching
  `data/rules`. Loader + engine are pure batch code; evaluators are pure functions.
- **Non-diagnostic:** copy lives only in templates, checked at load (B3), at the blueprint guard (B5),
  and at render (C) — three gates, same `FORBIDDEN_WORDS`, with a couplings guard keeping the
  Deno-vendored list synced to the shared one.
- **Two-tier truth:** `data/rules/**.json` + raw rows + migrations are TRUTH; `rules` + `insight_cards`
  are rebuildable PROJECTIONS. To change a card, fix a blueprint or raw row and re-run — never hand-edit.

## Open decisions to confirm before/at implementation
1. **Research-paper PDF** — needed to author real rules; B4 skeleton waits on it.
2. ~~**graphify** committed-vs-gitignored~~ **RESOLVED (2026-06-17): gitignored** (`graphify-out/`) until
   a path-normalizer makes `graph.json` diff cleanly cross-machine, then promote. See memory 0008.
3. **`shared/rules` Dart parity** — recommend **TS-only** (app renders `insight_cards`, already a shared
   contract; no need to render raw rule metadata). Confirm.
4. **`rules` reload trigger** — recommend CI-on-`data/rules`-change + manual; **no cron**.
5. **Node test runner** — recommend `node:test` (no new dep) over `vitest`.

## Critical existing files (integration surface)
- `supabase/functions/generate-insights/index.ts` — the hardcoded `RULES` array to make data-driven (C).
- `supabase/functions/compute-baselines/index.ts` + `migrations/20260515100000_create_m5a_baseline_snapshots.sql` — M5a, **unchanged**.
- `migrations/20260515110000_create_m5b_insight_cards.sql` — the `category`/`severity`/`rule_id` sets the new `rules` table mirrors.
- `shared/types/index.ts`, `shared/constants/copy_guidelines.{ts,dart}` — contracts + the non-diagnostic gate reused at load/render.
- `docs/graph/couplings.yaml`, `src/test/guards/` — where new parity guards register (`context_sync.mjs --check` enforces them).
