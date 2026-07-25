---
title: "Run-2 U10 — Manual seed-load from nao, seeds-as-data (O14 / demo feature c) + LlmRouter.create() carry-forward"
summary: "The O14 human-added ingestion-seed write path, added AS DATA (never by editing seeds.ts). Migration 20260724152525 adds ingestion_seeds (id identity pk, slug text unique CHECK ^[a-z0-9_]+$, label, query_hint, enabled default true, created_by uuid not null forced to auth.uid() by RLS, created_at) — authenticated SELECT + INSERT + UPDATE(enabled only, via a column-level grant so curation can pause a seed but never rewrite another dev's slug/label/audit), service_role bypass; table comment states the locked O14 semantics (seeds are TOPICS/queries, never metric pairs — C9 stays the only pair source; read fail-soft by the pipeline; static wins on slug collision). brain-ingest gains src/seeder/dbSeeds.ts: fetchDbSeeds (PostgREST read of enabled rows, converts to the static Seed shape, FAIL-SOFT — absent env / unreachable / HTTP error / non-array → undefined + one loud warning, never a throw; mirrors llm-router/src/overrides.ts and sources SUPABASE_URL/SERVICE key from process.env like publish-status.ts), mergeSeeds (static SEEDS + db, dedupe by slug, STATIC wins on collision with a warning) and loadMergedSeeds (the CLI's one call). The merged pool flows everywhere the static list flowed: run.ts selectSeeds gained a `pool` arg (RunOptions.seedPool; default static SEEDS so run() stays hermetic) and the CLI passes the merged pool to ingest/resume AND to the seeder's topic anchors (enumerateSeederCandidates({topics})). Every seed-queries/ingest/resume run prints the header 'topics: N static + M db'. C9 pair-gate UNCHANGED: a db seed becomes an st: anchor with empty metricKeys exactly like a static topic; candidates.ts / validate.ts / postprocess untouched; the LLM still cannot add pairs. Carry-forward (U8/D13): adopted `await LlmRouter.create()` at brain-ingest's three router construction sites (seeder/index.ts generateSeedQueries, synth/index.ts synthesize, cli.ts runVerify) so nao-edited llm_router_cap_overrides now bind real synth/verify/seeder runs — proven live (verifier per_run_token_cap=1 set via nao denied a real verify call before any API request: 'CAP OVERRIDE active — llm_router_cap_overrides'). nao: /api/seeds route (GET catalog = 6 built-ins from INGEST_SEED_TOPICS + db rows; POST add-as-authenticated-user with 409 on built-in-shadow/duplicate; PATCH enable/disable), src/lib/seedsControl.ts (pure: slug derivation, add/toggle body validation, catalog composition with shadowed-by-built-in flagged honestly), SeedsPanel.tsx on /ingest. Baselines: brain-ingest 340→353, nao 74→83, llm-router 71 (untouched). Run-now dropdown left reading the static INGEST_SEED_TOPICS (wiring db seeds in would drag the GH-Actions/R2 contract — the demo's 'pipeline picks it up' proof is the CLI consumption)."
type: session
scope: shared
status: canonical
updated: 2026-07-25
memory: "U10 done: O14 ingestion_seeds (seeds-as-data) — migration 20260724152525 (slug CHECK, created_by=auth.uid(), UPDATE(enabled)-only column grant); brain-ingest seeder/dbSeeds.ts reads enabled seeds fail-soft (mirrors overrides.ts) + mergeSeeds (static wins on slug collision) feeds run.ts selectSeeds(pool) AND seeder topic anchors; CLI prints 'topics: N static + M db'; C9 pair-gate untouched (db seed = st: anchor, empty metricKeys, LLM still can't add pairs). Adopted LlmRouter.create() at brain-ingest's 3 router sites (seeder/synth/verify) so nao cap overrides bind real runs — proven (verifier cap=1 denied a real verify pre-API). nao /api/seeds (GET/POST/PATCH) + SeedsPanel on /ingest. Run-now dropdown left on static topics (db-wiring would drag GH-dispatch). brain-ingest 353, nao 83."
---

# Run-2 U10 · Manual seed-load from nao, seeds-as-data (O14, DEMO-CRITICAL feature c)

Branch `feat/phase2-run-2/u10-seeds-as-data` off `feat/phase2-run-2/u9-claims-human-verdict`
(chain tip 3697967). Backlog O14 (locked — executed, not re-opened): seeds added AS DATA (a table
the pipeline reads), NOT by editing seeds.ts; verifier-gating on resulting edges unchanged; no
LLM-invented seeds — the C9 line holds (the LLM must never add pairs; a seed is a discovery
topic/query only).

## What ships

### 1 · Migration `20260724152525_create_o14_ingestion_seeds.sql`
`ingestion_seeds` (id identity pk, slug text unique CHECK `^[a-z0-9_]+$`, label text not null,
query_hint text null, enabled boolean default true, created_by uuid not null, created_at default
now()). RLS (D3 dev posture): authenticated SELECT + INSERT `with check (created_by = auth.uid())`
(forged-audit guard) + UPDATE. The UPDATE is narrowed to the `enabled` column by a **column-level
grant** (`revoke update … ; grant update (enabled) to authenticated`) — curation can pause a seed
but never rewrite another dev's slug/label/audit trail. No DELETE (disable, don't erase).
service_role bypasses RLS (the pipeline read). Table comment states the locked O14 semantics
verbatim: seeds are TOPICS/queries never metric pairs (C9 stays the only pair source), read
fail-soft, static wins on slug collision.

### 2 · Pipeline consumption — `tools/brain-ingest/src/seeder/dbSeeds.ts`
- `fetchDbSeeds` — PostgREST read of `ingestion_seeds?enabled=eq.true`, converts each row to the
  static `Seed` shape (`topic`=slug, `query`=query_hint||label, `topicTags`=[slug]). **FAIL-SOFT**
  (mirrors `tools/llm-router/src/overrides.ts`): absent SUPABASE_URL/SERVICE key, unreachable
  Supabase, HTTP error, or a non-array body → `undefined` + exactly ONE loud warning; never throws.
  A malformed row (bad slug / empty label) is skipped individually with a warning, not fatal. Env
  sourced from `process.env` like `publish-status.ts` (locally the two values are apps/nao's
  `.dev.vars`).
- `mergeSeeds` — static `SEEDS` + db seeds, deduped by topic slug; **STATIC wins on collision**
  (the shadowing db row dropped with a warning); returns the counts the header prints.
- `loadMergedSeeds` — the CLI's one call.
- Wiring: `run.ts` `selectSeeds` gained a `pool` arg (`RunOptions.seedPool`; default static `SEEDS`
  so `run()` never touches Supabase — hermetic for tests). `cli.ts` passes the merged pool to
  `ingest`/`resume` (a db slug is a valid `--seed` selector) AND to the seeder's topic anchors
  (`enumerateSeederCandidates({ topics })`). Every `seed-queries`/`ingest`/`resume` run prints
  `topics: N static + M db` (`… (db seeds unavailable — static only)` on fail-soft).
- **C9 pair-gate UNCHANGED:** a db seed enters `candidates.ts` as an `st:` anchor with empty
  `metricKeys`, exactly like a static topic. `candidates.ts` (the "ONLY source of pairs" header),
  `validate.ts` (rejects unknown keys), and `synth/postprocess` are all untouched — the LLM still
  cannot add pairs.

### 3 · Carry-forward (U8/D13) — `await LlmRouter.create()` at brain-ingest's router sites
`LlmRouter.create()` (fetches cap overrides fail-soft) was previously only used by the llm-router
CLI; the brain-ingest pipeline still `new LlmRouter()`'d directly, so nao-edited cap overrides did
NOT bind real runs. Adopted `create()` at all three brain-ingest construction sites:
`seeder/index.ts` (generateSeedQueries), `synth/index.ts` (synthesize), `cli.ts` runVerify. Sync
test paths keep injecting a mock `router`, so no test needed awaiting; the `verify.cli.integration`
header comment updated (`new LlmRouter()` → `await LlmRouter.create()`).

### 4 · nao seed-add UI
- `src/lib/seedsControl.ts` — pure: `deriveSeedSlug` (label → CHECK-valid slug), `parseAddSeedBody`
  (label required, slug optional/derived, queryHint optional, table CHECK mirrored),
  `parseToggleSeedBody` (slug + boolean enabled only), `buildSeedCatalog` (built-ins from
  INGEST_SEED_TOPICS first + db rows, `shadowedByBuiltIn` flagged honestly).
- `src/app/(app)/api/seeds/route.ts` — GET (authenticated catalog read), POST (INSERT as the user;
  409 on a built-in-shadow slug or a duplicate), PATCH (enable/disable a db seed).
- `src/components/SeedsPanel.tsx` on `/ingest` — catalog list (built-in badge / enabled-disabled
  badge / shadowed badge), Add-seed form (live slug preview), enable/disable toggles.
- **Run-now dropdown left reading the static INGEST_SEED_TOPICS** — see Decisions.
- No shared/ changes.

### 5 · Tests
- `tools/brain-ingest/tests/dbSeeds.test.ts` (13): shape conversion + query_hint fallback,
  enabled-only filter + service key on the wire, malformed-row skip, FAIL-SOFT (absent env / HTTP
  error / non-array / thrown fetch → undefined + one warning each), merge (append, static-wins,
  unavailable, db-vs-db dedupe), loadMergedSeeds both paths.
- `tools/brain-ingest/tests/seeder.test.ts` (+3, **C9 gate**): a db topic anchors exactly like a
  static topic (st: source, empty metricKeys) with the pair-bearing candidates BYTE-IDENTICAL
  with/without it; an LLM response smuggling a `df:`/`rb:` key for the new topic is rejected; the
  candidates.ts "ONLY source of pairs" + "LLM must not add pairs" header invariant is pinned
  verbatim (CRLF-normalised so autocrlf can't defeat it).
- `apps/nao/tests/seedsControl.test.ts` (9): slug derivation (+ always-CHECK-valid property),
  add/toggle body validation, catalog composition + shadow flag, INGEST_SEED_TOPICS coupling.

## Live proof (local stack, actual outputs)

Setup: `npx supabase db reset` (O14 migration applied clean), demo user `u10-demo@ourobion.local`
→ uid `3e63ec8e-e8a9-4972-88f9-9073f7504276`, `npm run dev -p 3010`, routes driven with the real
password-grant session projected into the `sb-127-auth-token` cookie (U6/U9's proven approach).
Zero LLM spend throughout.

**(a) Seed add → catalog (authenticated):**
- `GET /api/seeds` before → the six built-ins only (`gut_microbiome … environmental_health`,
  `builtIn:true`).
- `POST /api/seeds {label:"Magnesium and sleep quality", queryHint:"magnesium supplementation
  sleep quality RCT"}` → 200, slug auto-derived `magnesium_and_sleep_quality`,
  `created_by:"3e63ec8e-…"` (RLS-forced). Re-`GET` → the db seed appears alongside the built-ins
  (`builtIn:false`, `createdAt` set).
- Guards: `POST {label:"hydration"}` → 409 (built-in slug); duplicate POST → 409; `{label:"!!!"}`
  → 400; `PATCH {slug, enabled:false/true}` → 200 (toggle); unauthenticated GET/POST → 307 to
  sign-in (middleware). `/ingest` authenticated → 200, page contains "Seeds" + "seed catalog".

**(b) CLI merged-topics + anchoring (supabase env set, offline):**
`brain-ingest seed-queries --candidates-only` →
```
topics: 6 static + 1 db
candidates: 17 (derivedFrom=8 rule_blueprint=2 static_topic=7)
  …
  [static_topic] st:magnesium_and_sleep_quality — Domain literature for "magnesium_and_sleep_quality" (magnesium supplementation sleep quality RCT)
```
The db seed anchors as a `static_topic` (empty metricKeys); `derivedFrom=8 rule_blueprint=2` are
the real registry pairs, unchanged by the seed.

**(c) Fail-soft (no supabase env):** same command →
```
brain-ingest db-seeds: boundary not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absent from env) — running on STATIC seed topics only. Any seeds added in nao are NOT part of this run.
topics: 6 static + 0 db (db seeds unavailable — static only)
candidates: 16 (derivedFrom=8 rule_blueprint=2 static_topic=6)
```
The magnesium anchor is gone; one loud warning; static-only.

**(d) create() adoption binds nao cap overrides to a real brain-ingest run:** set verifier
`per_run_token_cap=1` via `POST /api/models/caps` (authenticated, updated_by forced), then
`brain-ingest verify --from-claims fixtures/verify-claims.jsonl --corpus fixtures/verify-corpus.jsonl`
(supabase env set; dummy OPENAI key that is never called) →
```
verify: gut_comfort_score|correlates|mood_score — full (…); retrieved 4 source(s)
error: llm-router budget: run '…' would cross the 95% hard stop of the 1-output-token per-run cap (CAP OVERRIDE active — llm_router_cap_overrides) (already 0 tokens, this call may add 8000). Call denied.
```
The override set in nao was fetched by `LlmRouter.create()` at brain-ingest's `runVerify` site,
bound into the ledger, and **denied the call before any API request** — the exact bug the
carry-forward closes. Override cleared afterwards.

## Gates

- `tools/brain-ingest`: `npm run typecheck` clean; `npm test` **353/353** (baseline 340 + 13).
- `apps/nao`: `npm run typecheck` clean; `npm test` **83/83** (baseline 74 + 9).
- `tools/llm-router`: **untouched** (no src change; brain-ingest only *calls* the existing
  `create()`) — baseline 71 not re-run per the "if touched" gate.
- `npx supabase db reset`: clean with the new migration (`Applying … 20260724152525 … Finished`).
- `node tools/context_sync.mjs --check`: passed.
- NUL-byte scan of all new/changed files: clean; `git diff --cached --stat` shows no "Bin".

## Decisions made autonomously

- **Run-now dropdown left on the static INGEST_SEED_TOPICS.** Wiring db seeds into "Run now" drags
  the R2 control doc + GH-Actions dispatch contract in (the trigger POSTs a `seed` GH-Actions
  input); the brief says SKIP and note it if so. The demo's "pipeline picks it up" proof is the
  **CLI consumption** (b), which is complete. Not wired.
- **UPDATE limited to `enabled` via a column-level grant** (the "if easy" option). Chosen because a
  Postgres column grant is exactly the right primitive — the RLS row policy permits the update, the
  grant restricts *which* column, so a db seed can be paused but its slug/label/created_by are
  immutable from the client.
- **Merge semantics: STATIC wins on slug collision**, with the shadowed db row dropped + warned in
  the pipeline and flagged `shadowedByBuiltIn` in the nao catalog (honest). The POST route also
  refuses a built-in-shadow slug up front (409) so a user never silently adds an ignored seed. Db
  seeds also dedupe against each other by slug (first row wins; enabled ordered by created_at).
- **`run()` stays hermetic:** the Supabase fetch lives in the CLI, not `run()`/`selectSeeds`
  (`seedPool` defaults to static `SEEDS`), so every existing `run()`/seeder unit test is unaffected
  and no test hits the network.

## Not verified / carried forward

- **GH-Actions dispatch for db seeds:** intentionally NOT wired (see Decisions) — the Run-now
  dropdown remains static-topic-only.
- **A full end-to-end ingest over a db seed** (discovery actually fetching papers for the new
  topic) was not run — it needs live discovery-adapter network calls and R2; the CLI candidate/
  anchor path (b) is the offline proof that the merged topic reaches the seeder, and `selectSeeds`
  feeds the same pool to discovery.
- **`tools/llm-router` tests** not re-run (untouched; brain-ingest only calls the existing
  `create()`); its typecheck passes transitively via brain-ingest's typecheck.
- **deno-check** of edge functions: n/a (no edge-function change this unit).

memory: U10 done: O14 ingestion_seeds seeds-as-data (migration 20260724152525, slug CHECK, created_by=auth.uid(), UPDATE(enabled)-only column grant); brain-ingest seeder/dbSeeds.ts fail-soft read + mergeSeeds (static wins on slug collision) → run.ts selectSeeds(pool) + seeder topic anchors; CLI prints "topics: N static + M db"; C9 pair-gate untouched (db seed = st: anchor, LLM still can't add pairs). Adopted LlmRouter.create() at brain-ingest's 3 router sites — nao cap overrides now bind real runs (proven: verifier cap=1 denied a real verify pre-API). nao /api/seeds GET/POST/PATCH + SeedsPanel on /ingest. Run-now dropdown left static (db-wiring drags GH-dispatch). brain-ingest 353, nao 83.
