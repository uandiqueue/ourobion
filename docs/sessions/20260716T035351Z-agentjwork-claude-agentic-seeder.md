# Session 20260716T035351Z — agentjwork — claude — agentic-seeder

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U9) · **Branch:**
  `feat/brain/agentic-seeder` (cut from `feat/brain/s6-edge-store-a11-loader`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** brain pipeline — the **agentic seeder** (memory 0013 roster; phase-2-plan
  §"Agentic seeder"; architecture §10.1 pipeline-entry variant). The LLM node that turns the metric
  registry's `derivedFrom[]` + rule-blueprint pairs + static topic anchors into scholarly search
  queries for the ingestion discovery adapters, superseding the static topic list (which stays as
  fallback). Not A1/A2 (gap ledger + term-map pair→query are later stages) — shapes kept compatible.

## Attempted
- New `tools/brain-ingest/src/seeder/` module: deterministic candidate builder → batched LLM
  query generation via `@ourobion/llm-router` (local_agent mailbox) → validated, versioned
  `seed-queries.json` artifact; a `seed-queries` CLI verb; soft wiring so `ingest` consumes the
  artifact when present. Plus a REAL local-agent run fulfilled by this session.

## Changed
- `tools/brain-ingest/src/seeder/` (NEW):
  - `types.ts` — `SeedCandidate` / `SeedQueryArtifact` / structural mirrors of the registry +
    blueprint slices (house pattern: this package does NOT import `shared/`, matching
    `verify/quoteCheck.ts`).
  - `candidates.ts` — PURE `buildCandidates({metrics, blueprints, topics})`: (a) every active
    registry metric with `derivedFrom[]` → one `(derived ← input)` pair per input (direction
    preserved), (b) unordered pairs co-named by a rule blueprint (≥2 metricKeys), (c) the six
    static topics as anchors; dedup by unordered metric-pair (derivedFrom wins) + topic slug;
    stable order (derivedFrom → rule_blueprint by ruleId → static_topic). C9-faithful: the ONLY
    source of pairs.
  - `load.ts` — runtime loaders: registry via dynamic `import()` of `shared/metrics/registry.ts`
    (keeps `shared/` out of this package's static graph + `tsc` include; mirrors
    `tools/metric-view/lib/view.mjs`); blueprints via recursive `fs` read of `data/rules/**`.
  - `prompt.ts` — one batched prompt for the whole candidate list; `PROMPT_VERSION`
    `seeder-2026-07-16.1`; instructs scholarly/MeSH-style phrasing, both directions, JSON-only,
    keys == candidate ids.
  - `validate.ts` — parse (malformed / non-object JSON → throw), REJECT unknown keys (log+drop,
    C9), per-candidate trim + case-insensitive dedupe + cap (`DEFAULT_CAP_PER_CANDIDATE=6`).
  - `artifact.ts` — assemble/write(atomic tmp+rename)/read(tolerant → fallback)/`seedsFromArtifact`
    (one `Seed` per (candidate, query); tags carry metric keys or topic slug). Path
    `data/corpus/seed-queries.json` (already-gitignored run-state dir, same home as manifest/usage).
  - `index.ts` — `enumerateSeederCandidates` + `generateSeedQueries` (injectable router/metrics/
    blueprints/topics/clock for tests) + barrel.
- `tools/brain-ingest/src/cli.ts` — `seed-queries [--dry-run|--candidates-only] [--cap N]` verb
  (candidates-only = deterministic list, no LLM; dry-run = candidates + prompt, no call/write;
  default = route → validate → write).
- `tools/brain-ingest/src/run.ts` — `selectSeeds` now: explicit `--seed` → static topic (wins);
  else artifact present + non-empty → its query-seeds (logged, promptVersion noted); else static
  six (soft fallback).
- `tools/brain-ingest/tests/seeder.test.ts` — 18 tests (enumeration incl. direction/dedup/
  deprecated-skip/stable-order; validation incl. unknown-key rejection/malformed/non-object/cap/
  dedupe/missing; artifact determinism + tolerant-read fallback; `seedsFromArtifact`; mocked-router
  end-to-end; prompt shape; real on-disk loaders).

## Decided
(design-doc-silent points, per session spec)
- **Candidate-source counts (real data):** derivedFrom **8** (stool_variability←stool_form;
  log_completeness←{urine_colour, stool_form, outside_meals, mosquito_bites, energy_score,
  mood_score, gut_comfort_score}), rule_blueprint **0** (all six shipped MVP rules are
  single-metric → no co-named pair; source lights up automatically when a cross-metric blueprint
  lands), static_topic **6** = **14 candidates total**.
- **derivedFrom is used verbatim (C9):** the registry comment states `derivedFrom` "seeds the
  relationship graph", so all 8 are surfaced even though `log_completeness`/`stool_variability` are
  computation/data-quality dependencies rather than classic literature pairs. The LLM phrased those
  honestly as self-report **adherence / completeness** queries (EMA compliance, missing-data,
  diary-completion) — not invented physiology. Curated priors (C9's other allowed source) were NOT
  added: the task's builder lists only (a)/(b)/(c), and adding priors here would be inventing pairs.
- **Batching:** ONE router call for all 14 candidates (well under `maxOutputTokens` 8000) — not 14
  calls. Strict-JSON keyed by candidate id keeps validation/rejection per-candidate.
- **Artifact home:** `data/corpus/seed-queries.json` — the brain-ingest run-state dir (gitignored,
  alongside manifest/usage); a rebuildable projection (two-tier-truth), never committed.
- **ingest wiring stays soft:** absent/empty/malformed/wrong-version artifact → static `seeds.ts`
  fallback; existing `run()` callers (temp corpusDir, no artifact) are unchanged (full suite green).
- **promptVersion:** `seeder-2026-07-16.1` (bump on prompt text change → artifact attributable).
- **Prompt design highlights:** narrow phrasing-only role; "work ONLY with the given candidates,
  keys MUST be exactly the ids"; spell out physiological synonyms not the snake_case key; both
  directions; free-text (not boolean DSL); 3–6 per candidate; JSON-only.

## Real local-agent run (REAL exercise of the route)
- `npx tsx src/cli.ts seed-queries` wrote a `seeder` mailbox request; THIS session fulfilled it
  (atomic tmp+rename response, `model: claude-fable-5`) → `14/14 candidates got queries via
  local_agent; rejected=0`. Representative generated queries:
  - `df:stool_variability__stool_form` → "Bristol Stool Scale day-to-day variability",
    "stool consistency variability healthy adults"
  - `df:log_completeness__energy_score` → "daily energy self-report completion",
    "ecological momentary assessment vitality compliance"
  - `st:dengue_vector` → "dengue Aedes aegypti vector control", "standing water Aedes larval habitat"
  - `st:sleep_hrv` → "sleep heart rate variability", "nocturnal heart rate variability wearable"
- Router ledger line (`data/llm-router/ledger.json`, gitignored) recorded the usage:
  `days["2026-07-16"].seeder = { calls: 1, inputTokens: 720, outputTokens: 1180, usd: 0.01986 }`
  (provisional sonnet-5 pricing; local_agent route).

## Left
- Curated priors + cross-domain candidate pairs — deferred (C9 conservative; needs a cross-metric
  rule blueprint or an authored prior source, out of this session's builder scope).
- `api_worker` route for the seeder — one-line config flip once a key is provisioned (B5); the
  local_agent route is the real path today and was exercised for real.
- CI does not run node tool-package tests (same known gap as brain-ingest/rules) — orchestrator note.

## Blockers
- None. Gate: brain-ingest **286/286** (268 prior + 18 new) + `tsc --noEmit` clean · shared
  `npx tsc --noEmit` clean · `flutter test` **46/46** (generated-plugin churn reverted) ·
  `context_sync --fix-index` + `--check` pass · REAL local-agent run completed with ledger evidence.

memory: none
