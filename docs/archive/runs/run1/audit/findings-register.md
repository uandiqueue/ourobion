---
title: Phase-2 Audit — Findings Register
summary: The accumulating record of potential issues/bugs/risks found in the Phase-2 build. Appended to after every audit unit (never batched). Record-only — nothing here is fixed. Dev aid (docs/temp), not ground truth. Companion to orchestration-log.md.
type: plan
scope: shared
status: canonical
updated: 2026-07-17
---

> **ARCHIVED 2026-07-26 — historical run record. Do not build from this; kept for provenance.** Current product planning: [Run 3](../../../../temp/run3/README.md).

# Phase-2 Audit — Findings Register

Record-only. Every finding gets an ID, is appended **as it is found** (see the resume protocol in
`orchestration-log.md`), and is **never fixed here**. Dedup by (file, line, summary) on resume.

## Findings

| ID | Sev | Status | Unit | Summary | Location | Confidence |
|----|-----|--------|------|---------|----------|------------|
| A1 | medium | open | AU2 | `partial` verdict is servable but exempt from the independent-retrieval safeguard invariant | shared/brain/relationships.schema.ts:159-165 | suspected from reading |
| A2 | low | open | AU2 | corroboration counts never cross-checked against `independentRetrieval.sources` at schema level | shared/brain/relationships.schema.ts:139-142,167-173 | suspected from reading |
| A3 | low | open | AU2 | quoteCheck permits vacuous pass (`spansTotal=0` ⇒ `allPresent=true`) at schema level | shared/brain/relationships.schema.ts:174-180 | suspected from reading |
| A4 | nit | open | AU2 | validation-strictness inconsistencies: `deprecatedAt` any string, `Citation.title` may be empty, ISO datetimes unchecked | shared/rules/rule.schema.ts:153; shared/brain/relationships.schema.ts:52,98,152 | confirmed by reading |
| A5 | nit | open | AU2 | `Equals<A,B>` mutual-assignability guard is `any`-poisonable and blind to optional-vs-`undefined` drift | shared/rules/_assert.ts:8; shared/brain/relationships.schema.ts:184 | suspected from reading |
| A6 | medium | open | AU2 | `InsightCard` shared contract (TS + Dart) lacks the `producer`/`insight_id`/`edge_refs` columns the DB gained in S8 | shared/types/index.ts:76-91; shared/types/index.dart:300-372 | confirmed by reading |
| A7 | nit | open | AU2 | stale comment: `shared/types/index.ts` says registry `source: 'wearable'` — registry vocabulary is `sensor` | shared/types/index.ts:27-28 | confirmed by reading |
| A8 | low | open | AU2 | copy gate is bare substring matching — benign words ("stillness", "conditioning") trip the forbidden list and silently drop cards at render | shared/constants/copy_guidelines.ts:31-39 (+ .dart mirror) | confirmed by reading |
| A9 | nit | open | AU2 | `CopyRules.getCopyRule` is a TODO stub returning `''` (Dart only, no TS counterpart) | shared/constants/copy_guidelines.dart:30-33 | confirmed by reading |
| A10 | low | open | AU3 | budget ledgers are single-process: concurrent router/ingest instances load counters once and last-writer-wins on persist → spend under-count | tools/llm-router/src/budget.ts:104-126; tools/brain-ingest/src/limits/budget.ts:137-172 | suspected from reading |
| A11 | nit | open | AU3 | llm-router ledger `runs`/`days` maps are never pruned — unbounded file growth | tools/llm-router/src/budget.ts:180-196 | confirmed by reading |
| A12 | low | open | AU3 | decorrelation is enforced on config only — the `local_agent` mailbox route cannot attest which model actually served a request | tools/llm-router/src/config.ts:211-227; tools/llm-router/src/routes/localAgent.ts | suspected from reading |
| A13 | low | open | AU4 | edge-loader orders/dedupes verifications by raw `verifiedAt` string but the DB compares timestamptz — unnormalized ISO forms can misorder supersede or collide on upsert | tools/edge-loader/lib/artifacts.mjs:140,165-170; load_edges.mjs:144,169-172 | suspected from reading |
| A14 | low | open | AU4 | loaders prune to a pure function of the artifact set with no empty-set guard — a missing/empty artifact source silently wipes the whole derived table | tools/rules/load_rules.mjs:74-77; tools/edge-loader/load_edges.mjs:166-177 | confirmed by reading |
| A15 | low | open | AU5 | `derived_metrics` grants users full INSERT/UPDATE/DELETE while its own comment says projection-tier "never hand-edited" — users can self-poison the projection | supabase/migrations/20260715140420:157-174 | confirmed by reading |
| A16 | nit | open | AU5 | `edge_score numeric(4,3)` rounds the stored score — at gate boundaries the stored score can look inconsistent with the (correctly precomputed) `serving_band` | supabase/migrations/20260716031048:64 | confirmed by reading |
| A17 | nit | open | AU5 | missing cheap CHECKs: `composed_insights` period_end ≥ period_start; `personal_signals` rho/ci in [-1,1] | supabase/migrations/20260716050639:24-33; 20260716024400:18-39 | confirmed by reading |
| A18 | medium | open | AU6 | snoozed cards are silently reactivated: the nightly upsert rewrites `status='active'`; only `dismissed` is respected — snooze lasts ≤1 day | supabase/functions/generate-insights/index.ts:412-419,782-791 | confirmed by reading |
| A19 | medium | open | AU6 | stale `personal_signals` rows never expire: evaluate-signals never deletes lost-eligibility pairs and generate-insights reads with no `computed_at` freshness filter | supabase/functions/evaluate-signals/index.ts:273-281; generate-insights/index.ts:266-274 | confirmed by reading |
| A20 | low | open | AU6 | `confidence_sources`/`data_sources` gain values outside the shared contract union: engine appends `'brain'`, S2 view emits `'signal'` — contract says self_report\|wearable\|env only | generate-insights/index.ts:608,689; shared/types/index.ts:73,86 | confirmed by reading |
| A21 | low | open | AU6 | EDGE_CARD copy asserts "Your own recent data shows a matching pattern" even when the agree branch fired without any gate-passing personal signal (D14 allows personal-absent agree) | generate-insights/render.ts:115-121; composer.ts:217-236 | confirmed by reading |
| A22 | nit | open | AU6 | edge-function auth degenerates to the literal `Bearer undefined` when SUPABASE_SERVICE_ROLE_KEY is unset (all three functions) | compute-baselines:162-167; evaluate-signals:141-147; generate-insights:217-221 | confirmed by reading |
| A23 | nit | open | AU6 | lagged-leaf `windowedBaseline` counts total_history_days only over the 28-day fetch slice (undercounts vs S3's full-history semantics — conservative); `relationPhrase` defaults unknown relations to "tends to raise" (currently unreachable); `window_days: 7` inline literal at render | generate-insights/evaluators.ts:216-244; render.ts:132-134; index.ts:480 | confirmed by reading |
| A24 | low | open | AU7 | CI never compiles the Deno handler files (`Deno.serve` index.ts of all 3 edge functions) and never applies/lints the SQL migrations — type/syntax errors there surface only at deploy | .github/workflows/ci.yml (no deno check, no supabase db job) | confirmed by reading |
| A25 | medium | open | AU8 | app renders S8 `relationship` cards as `descriptive`: the module-local category enum predates the migration; producer/edge_refs also unread, so edge cards are visually indistinguishable and uncited in the UI | apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:5,65-71 | confirmed by reading |
| A26 | low | open | AU8 | shared Dart/TS `InsightCard.id` is typed `String` but the DB column is `bigint identity` — the shared mirror's fromJson would throw on any real row; the app ships its own duplicate model instead | shared/types/index.dart:301,335; shared/types/index.ts:77 vs migration 20260515110000:15 | confirmed by reading |
| A27 | low | open | AU8 | card-expiry filters compare `expires_at` against a NAIVE local-time string (`DateTime.now().toIso8601String()`, no zone) → ~8h skew for non-UTC users; watch stream also freezes `now` at subscription | apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:94-100,108-118 | confirmed by reading |

<!-- Per-finding detail below. Template:
### A1 · <one-line summary>
- **Severity:** blocker / high / medium / low / nit
- **Unit:** AU_
- **Location:** file:line (or migration / function name)
- **What's wrong:** …
- **Failure scenario:** concrete inputs/state → wrong output/crash
- **Confidence:** confirmed by running / suspected from reading
- **Cross-ref:** phase2-run-blocked-register B__ (if related) — else "new"
-->

### A1 · `partial` verdict is servable but exempt from the independent-retrieval safeguard
- **Severity:** medium
- **Unit:** AU2
- **Location:** shared/brain/relationships.schema.ts:159-165 (invariant), shared/brain/index.ts:33 (SERVABLE_VERDICTS)
- **What's wrong:** The schema's safeguard invariant (`affirms = supported || contradicted`) requires
  `independentRetrieval.performed === true` only for those two verdicts. But `partial` is in
  `SERVABLE_VERDICTS` (shared/brain/index.ts) — a `partial` verdict with `performed: false` and
  `sources: []` validates cleanly and, with high `confidence`, lands in the `mid`/`high` serving band.
  The relationships.ts comment on `independentRetrieval` says "A grounded verdict requires this" — a
  servable verdict is grounded in spirit. brain-ingest's own `enforce()` forces `uncertain` when no
  retrieval was performed, so the in-repo pipeline is protected — but tools/edge-loader validates
  artifacts through *these shared validators* only, so any artifact line not produced by the in-repo
  verifier (hand-edited, older run, other producer) can ship an ungrounded-but-servable `partial` edge.
- **Failure scenario:** artifact JSONL line: `verdict: "partial"`, `independentRetrieval: {performed:false, sources:[]}`, `corroboration: {supporting:1, contradicting:0}`, `confidence: 0.95`, `evidenceTier: 5` → validateVerification passes → edge-loader loads it → edgeScore ≈ 0.9 → served `high`.
- **Confidence:** suspected from reading (schema + gating code paths read; not executed end-to-end)
- **Cross-ref:** new

### A2 · corroboration counts not cross-checked against retrieved sources at schema level
- **Severity:** low
- **Unit:** AU2
- **Location:** shared/brain/relationships.schema.ts:139-142, 167-173
- **What's wrong:** `corroboration.supporting/contradicting` are free integers; the schema never checks
  them against `independentRetrieval.sources` (count or stances). brain-ingest's `enforce()` re-derives
  corroboration from the retrieved set ("the LLM cannot invent sources"), but that invariant lives only
  in tools/brain-ingest — artifacts entering via edge-loader are only schema-validated, so invented
  corroboration counts survive validation and inflate `edgeScore` (net-corroboration boost, up to +15%).
- **Failure scenario:** verification line with `sources: [one 'mentions' citation]` but `supporting: 3` → passes schema → corroborationBoost saturates → score inflated.
- **Confidence:** suspected from reading
- **Cross-ref:** related to A1 — same "shared schema weaker than brain-ingest enforce()" seam

### A3 · quoteCheck vacuous pass allowed at schema level
- **Severity:** low
- **Unit:** AU2
- **Location:** shared/brain/relationships.schema.ts:174-180
- **What's wrong:** the consistency refinement requires `allPresent === (spansFound === spansTotal)`,
  which makes `spansTotal: 0, spansFound: 0, allPresent: true` valid. brain-ingest's quoteCheck code has
  an explicit "zero spans never pass vacuously" invariant (tested), but the shared schema — the only
  gate on foreign/re-loaded artifacts — permits the vacuous pass. Claims themselves require ≥1 span, so
  this needs a verification whose spansTotal disagrees with its claim; nothing cross-checks that.
- **Failure scenario:** verification with `quoteCheck: {spansFound:0, spansTotal:0, allPresent:true}` on an edge whose claim has 2 spans → validates, loads, and reads as "all quotes verified".
- **Confidence:** suspected from reading
- **Cross-ref:** related to A1/A2 seam
- **Addendum (AU3):** the code and the schema *disagree* on the vacuous case:
  tools/brain-ingest/src/verify/quoteCheck.ts:312 computes `allPresent: spansTotal > 0 && …` (false
  for zero spans — the safe choice), while relationships.schema.ts:178 demands
  `allPresent === (spansFound === spansTotal)` (true for 0===0). A zero-span quoteCheck block produced
  by the in-repo code would be REJECTED by the shared schema, and the block the schema accepts is the
  vacuous-pass one. The two encodings of "never pass vacuously" are mutually inconsistent.

### A4 · validation-strictness inconsistencies (nits)
- **Severity:** nit
- **Unit:** AU2
- **Location:** shared/rules/rule.schema.ts:153 (`deprecatedAt: z.string().nullable()` — any string incl. empty, while effectiveFrom/To get an ISO regex); shared/brain/relationships.schema.ts:52 (`Citation.title: z.string()` — empty allowed, most other strings are `.min(1)`), :98/:152 (`synthesisedAt`/`verifiedAt` only `.min(1)`, no datetime format)
- **What's wrong:** fields documented as "ISO datetime" / meaningful text are barely validated; empty-string `deprecatedAt` satisfies the "set ⟺ deprecated" XOR check while carrying no date.
- **Failure scenario:** blueprint with `status:'deprecated', deprecatedAt:''` — the XOR check tests `!== null`, so the empty string counts as "set" and the blueprint validates with no usable deprecation timestamp.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A5 · AssertExact/Exact guard is weaker than structural identity
- **Severity:** nit
- **Unit:** AU2
- **Location:** shared/rules/_assert.ts:8; shared/brain/relationships.schema.ts:184; (same pattern cited in shared/metrics/registry.schema.ts)
- **What's wrong:** `[A] extends [B] ? [B] extends [A]` is mutual assignability, not identity: `Equals<any, T>` is `true` (if a zod inference ever degrades to `any`, the drift guard silently passes), and optional-property vs `| undefined` drift is invisible. The stricter conditional-generic identity trick would catch both.
- **Failure scenario:** a future zod version/change makes one inferred type `any` → all AssertExact lines stay green while real drift accumulates.
- **Confidence:** suspected from reading
- **Cross-ref:** new

### A6 · InsightCard shared contract missing the S8 producer columns
- **Severity:** medium
- **Unit:** AU2
- **Location:** shared/types/index.ts:76-91 and shared/types/index.dart:300-372 vs supabase/migrations/20260716050639_create_m5b_composed_insights_and_card_producers.sql:57-83
- **What's wrong:** migration 20260716050639 (U12/S8) added `producer` (check: rules|edge|personal),
  `insight_id`, and `edge_refs` to `insight_cards`, and D14 says coincidence/edge cards "carry
  edge_refs + insight_id". The shared TRUTH-tier `InsightCard` contract — both the TS interface and
  the Dart mirror the app actually deserializes with — has none of the three fields; `fromJson`
  silently drops them. Any app-side rendering of citations, producer-aware dedup/dismissal, or
  composed-insight lookups can't happen through the contract; a future writer using `toJson()` would
  also emit rows without `producer`, silently defaulting everything back to 'rules'.
- **Failure scenario:** app fetches an `edge`-producer card → Dart `InsightCard.fromJson` discards
  `producer`+`edge_refs` → card is indistinguishable from a rules card; its citations are unreachable
  client-side even though the row carries them.
- **Confidence:** confirmed by reading (columns present in migration; fields absent in both mirrors)
- **Cross-ref:** D14 documents the columns but records no decision to defer the shared-contract
  update — verify with human whether this was a deliberate deferral (columns are additive-with-default,
  so nothing breaks today)

### A7 · stale comment: registry source vocabulary
- **Severity:** nit
- **Unit:** AU2
- **Location:** shared/types/index.ts:27-28
- **What's wrong:** comment says wearable keys are registry entries with `source: 'wearable'`; the
  registry's `MetricSource` union has no such value — wearable metrics are `source: 'sensor'`.
- **Failure scenario:** none at runtime; misleads a reader grepping for the vocabulary.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A8 · copy gate substring matching: false positives drop legitimate cards
- **Severity:** low
- **Unit:** AU2
- **Location:** shared/constants/copy_guidelines.ts:31-39; shared/constants/copy_guidelines.dart:20-28
- **What's wrong:** `validateCopyString` does `lowerText.includes(word)` over the forbidden list with
  no word boundaries. "stillness" contains "illness"; "conditioning"/"air-conditioned" contain
  "condition"; "mistreatment" contains "treatment". The engine's render-time gate *drops* a card whose
  final copy fails this check (rules test: "render-time copy gate DROPS a card"), so a template or
  filled placeholder using such a word silently ships nothing — no error surfaced to the user.
- **Failure scenario:** a future rule template body "Try short stillness breaks after meals" →
  validateCopyString false → card dropped at render, every day, silently.
- **Confidence:** confirmed by reading (behaviour is deterministic; not run)
- **Cross-ref:** the TS file's own comment acknowledges "'symptom' // context dependent, string
  matching needs care" — the care is not implemented for the remaining five words

### A9 · Dart-only TODO stub `getCopyRule` returns ''
- **Severity:** nit
- **Unit:** AU2
- **Location:** shared/constants/copy_guidelines.dart:30-33
- **What's wrong:** dead placeholder API with a TODO, no TS counterpart, returns empty string —
  a caller would silently get '' instead of a rule.
- **Failure scenario:** none today (no callers found in shared/); trap for future use.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A10 · budget ledgers assume a single writer process
- **Severity:** low
- **Unit:** AU3
- **Location:** tools/llm-router/src/budget.ts:104-126 (load once at construction, whole-file persist);
  tools/brain-ingest/src/limits/budget.ts:137-172 (same pattern)
- **What's wrong:** counters are read from disk only at construction and each `record()`/`charge()`
  rewrites the entire file from in-memory state. Two concurrent instances (two runs the same UTC day,
  or a parallel pipeline stage) never see each other's spend: last writer wins, both under-count, and
  the per-day USD cap can be overrun by up to ~2× per extra concurrent instance. Writes are atomic
  (tmp+rename) so no corruption — but atomicity is not isolation.
- **Failure scenario:** two ingest runs on one machine, same day, both charging OpenAlex — each sees
  only its own `spent`, so combined spend can reach ~2× the $0.95 hard stop before either refuses.
- **Confidence:** suspected from reading (single-process usage may be an operational assumption; the
  5% headroom comment explicitly says it absorbs "in-flight/concurrent calls", which this exceeds)
- **Cross-ref:** new

### A11 · llm-router ledger grows without bound
- **Severity:** nit
- **Unit:** AU3
- **Location:** tools/llm-router/src/budget.ts:180-196
- **What's wrong:** `days` and `runs` maps only ever gain keys; nothing prunes old UTC days or
  finished runs. `state()` also returns ALL runs ever recorded. Cosmetic until the file is months old.
- **Failure scenario:** long-lived repo → ledger.json grows monotonically; every `record()` rewrites
  the whole file, so writes slowly get more expensive.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A12 · mailbox route cannot attest the serving model — decorrelation is config-deep only
- **Severity:** low
- **Unit:** AU3
- **Location:** tools/llm-router/src/config.ts:211-227 (invariant at load); routes/localAgent.ts
  (fulfiller supplies the response file)
- **What's wrong:** the decorrelation invariant (verifier non-Anthropic, different family from
  synthesis) is validated against `router.config.json`'s declared models. All six nodes currently
  route `local_agent`, where an arbitrary out-of-process fulfiller writes the response file; nothing
  verifies the fulfiller actually used the configured model (the response's `model` field is
  self-reported, and a missing model falls back to the request hint). A Claude-based fulfiller
  answering the `verifier` node's requests would silently violate the §10.1 invariant in substance
  while every check stays green.
- **Failure scenario:** operator runs one local agent session to drain the whole mailbox → the
  gpt-5-designated verifier requests are answered by the same Anthropic model that did synthesis →
  rubber-stamp risk the invariant exists to prevent, invisible in checkConfig.
- **Confidence:** suspected from reading
- **Cross-ref:** D15 (phase2-run-signoff-decisions) shows awareness: the L6 slice verifier is
  key-blocked and shipped as `INTERIM:pending-real-verifier` with a contract-forced `uncertain` —
  the honest end-state. The gap is structural, not currently exploited.

### A13 · verifiedAt string-vs-timestamptz comparison seam in edge-loader
- **Severity:** low
- **Unit:** AU4
- **Location:** tools/edge-loader/lib/artifacts.mjs:140 (dedup key = raw string), :165-170 (supersede
  ordering = lexicographic string compare); load_edges.mjs:144 (DB conflict key = timestamptz),
  :169-172 (prune matches on `$2::timestamptz[]`)
- **What's wrong:** the shared schema validates `verifiedAt` only as a non-empty string (see A4), and
  the loader's JS layer compares/dedupes raw strings while Postgres normalizes to timestamptz.
  Consequences when producers emit non-normalized ISO forms: (a) two JS-distinct strings for the same
  instant ("…T10:00:00Z" vs "…T10:00:00+00:00") pass JS dedup but collide on the DB `(edge_id,
  verified_at)` key — the upsert makes the last one win silently; (b) lexicographic ordering across
  mixed offsets picks the wrong "newest" verification for the supersede flip and the serving status.
  The in-repo producer emits uniform UTC ISO, so this is latent, not live.
- **Failure scenario:** an artifact re-run emits `+08:00`-offset timestamps; a later verification with
  an earlier lexicographic string stays 'active' while the actually-newest one is flipped 'superseded'.
- **Confidence:** suspected from reading
- **Cross-ref:** A4 (no datetime format validation at the contract) is the root enabler

### A14 · full-rebuild prune has no empty-set guard
- **Severity:** low
- **Unit:** AU4
- **Location:** tools/rules/load_rules.mjs:74-77; tools/edge-loader/load_edges.mjs:166-177
- **What's wrong:** both loaders end every non-dry run with "delete everything not in the current
  input set". By design the tables are pure projections (docs/memory/0001) — but there is no guard
  distinguishing "the truth set is legitimately empty" from "the source was mis-pointed/empty by
  accident" (e.g. `--from-dir` at a fresh mirror with a claims.jsonl of zero valid lines, or a
  data/rules/ checkout where the scope dirs are missing — `discoverBlueprintFiles` returns [] rather
  than erroring). A zero-row input silently truncates the production table inside the transaction.
- **Failure scenario:** operator runs `load_edges.mjs --from-dir <wrong dir>` where claims.jsonl
  exists but is empty → 0 rows valid, 0 errors → every claim + verification pruned; app serves
  nothing until the next correct load.
- **Confidence:** confirmed by reading (behaviour deliberate per docstrings; the missing guard is the
  finding, dry-run does exist as mitigation)
- **Cross-ref:** D13 documents upsert+prune as a decision; it does not address the empty-input case

### A15 · derived_metrics: user CRUD policies contradict the table's own projection-tier framing
- **Severity:** low
- **Unit:** AU5
- **Location:** supabase/migrations/20260715140420_create_continuity_storage_primitives.sql:157-174
- **What's wrong:** the table comment says "Rebuildable projection … never hand-edited, never
  truth-tier", yet the RLS policies grant authenticated users SELECT/INSERT/UPDATE/DELETE on their
  own rows — unlike the sibling projection tables (`personal_signals`, `composed_insights`,
  `baseline_snapshots` pattern: select-only, engine writes as service_role). A user JWT can write
  arbitrary `derived_metrics` rows for itself; anything downstream reading the table trusts
  engine-computed values.
- **Failure scenario:** user calls PostgREST insert on derived_metrics with fabricated values →
  rows are indistinguishable from engine-computed ones.
- **Confidence:** confirmed by reading
- **Cross-ref:** possibly deliberate if client-side derivation (M2-style) is intended to write here —
  verify with human; if so the table comment overstates, if not the policies overgrant

### A16 · edge_score column precision can visually contradict serving_band at gate boundaries
- **Severity:** nit
- **Unit:** AU5
- **Location:** supabase/migrations/20260716031048_create_brain_edge_read_store.sql:64
- **What's wrong:** `numeric(4,3)` rounds the loader's float (e.g. 0.7996 → 0.800) while
  `serving_band` was precomputed on the unrounded value ('mid'). A stored row can read
  score=0.800/band=mid against EDGE_GATES.high=0.8. Band is authoritative by design; display-only.
- **Failure scenario:** an operator/reviewer reads the row and assumes gating is buggy.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A17 · missing cheap CHECK constraints on S5/S7 tables
- **Severity:** nit
- **Unit:** AU5
- **Location:** supabase/migrations/20260716050639:24-33 (composed_insights — no
  `period_end >= period_start`); 20260716024400:18-39 (personal_signals — no range CHECK on
  rho/ci_low/ci_high ∈ [-1,1] or q_value ∈ [0,1])
- **What's wrong:** sibling tables encode analogous invariants as CHECKs (state_bands band ordering,
  edge_verifications score range); these don't. Engine is the only writer, so the risk is a silent
  engine bug landing impossible rows rather than user input.
- **Failure scenario:** an evaluate-signals regression emits rho=2.0 → row lands and serves.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A18 · snoozed cards silently reactivated by the nightly upsert
- **Severity:** medium
- **Unit:** AU6
- **Location:** supabase/functions/generate-insights/index.ts:412-419 (pushCard skips only
  `dismissed`), :782-791 (upsert on user_id,rule_id rewrites all columns incl. `status: 'active'`)
- **What's wrong:** insight_cards allows users to set status `snoozed` (migration
  20260515110000 comment: "Users may update their own card status (snoozed / dismissed)"). The
  engine's dedup/skip logic checks only `dismissed`; a still-firing rule's card is re-upserted
  with `status='active'` on the next nightly run, so a snooze survives at most one day. Dismissal
  works; snooze is effectively decorative.
- **Failure scenario:** user snoozes a daily-firing hydration card at 22:00; the 02:00 cron
  regenerates it active; the card is back by morning.
- **Confidence:** confirmed by reading
- **Cross-ref:** likely MVP-inherited (pre-phase-2 migration); D14 defers cooldown (all null) but
  says nothing about snooze — verify intended snooze semantics with human

### A19 · stale personal_signals rows feed the composer indefinitely
- **Severity:** medium
- **Unit:** AU6
- **Location:** supabase/functions/evaluate-signals/index.ts:273-281 (upsert only, never delete);
  supabase/functions/generate-insights/index.ts:266-274 (reads all rows, no computed_at filter)
- **What's wrong:** §S5's "too few joint days → no row" is honored only for pairs never written.
  A pair that once passed (row upserted) and later loses eligibility (metric drops below the
  14-day floor, or joint days fall under 10) keeps its LAST row forever — computed_at is stored
  but nobody reads it. The composer treats that row as current for gate-passing, contradiction,
  agree-triangulation, and idiosyncratic cards.
- **Failure scenario:** user wears a tracker for two months (stable rho=0.6 row lands), then
  stops. Months later, any fired pattern on that pair still produces "still researching"
  idiosyncratic cards citing the stale correlation.
- **Confidence:** confirmed by reading
- **Cross-ref:** new — related in spirit to A14 (projections that only ever gain rows)

### A20 · source vocabularies drift past the shared contract union
- **Severity:** low
- **Unit:** AU6
- **Location:** generate-insights/index.ts:608,689 (appends `'brain'` to confidence_sources);
  tools/metric-view/lib/view.mjs:88 (signals branch emits source `'signal'`); shared/types/index.ts:73
  (`BaselineSnapshot.data_sources: ('self_report'|'wearable'|'env')[]`), :86 (same union on
  `InsightCard.confidence_sources`)
- **What's wrong:** no DB CHECK constrains the arrays, so rows land fine, but the TRUTH-tier TS
  contract enumerates three values while the engine now writes `'brain'` and the S2 view will emit
  `'signal'` for any signals-stored metric. Typed consumers narrowing on the union will
  mis-handle the new values.
- **Failure scenario:** app code `switch`ing on confidence_sources treats 'brain' as unreachable.
- **Confidence:** confirmed by reading
- **Cross-ref:** same family as A6 (contract lagging the S7/S8 build)

### A21 · agree-branch edge card overstates personal corroboration
- **Severity:** low
- **Unit:** AU6
- **Location:** generate-insights/render.ts:115-121 (EDGE_CARD_TEMPLATE body); composer.ts:217-236
  (agree fires with personal absent or non-gate-passing)
- **What's wrong:** the shipped copy says "Your own recent data shows a matching pattern", but per
  D14 the agree branch requires only a direction-consistent monotonic edge — the personal signal
  may be absent or fail its serve gate. When only metric_a fired an S4 signal (metric_b unobserved
  today, edgeDirectionConsistent's single-endpoint case counts as consistent), the pairwise
  "matching pattern" claim has no data behind it. Tension with the D15 honesty posture.
- **Failure scenario:** user's resting HR fires 'up'; sleep unlogged today; no personal_signals row
  for the pair → agree card claims their own data matches the research pattern.
- **Confidence:** confirmed by reading
- **Cross-ref:** D14 (branch disjointness decision documents the branch logic, not the copy claim)

### A22 · edge-function auth degenerates when the service-role env var is unset
- **Severity:** nit
- **Unit:** AU6
- **Location:** compute-baselines/index.ts:162-167; evaluate-signals/index.ts:141-147;
  generate-insights/index.ts:217-221
- **What's wrong:** `auth !== \`Bearer ${serviceRoleKey}\`` — with the env var missing, the
  expected value is the literal string "Bearer undefined", which an unauthenticated caller can
  send. Supabase always injects the var in practice, and createClient would then fail, so impact
  is theoretical; an explicit `if (!serviceRoleKey) return 500` would close it.
- **Failure scenario:** self-hosted deployment without the env var + an attacker sending
  `Authorization: Bearer undefined` reaches the handler body.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A23 · minor engine drift nits
- **Severity:** nit
- **Unit:** AU6
- **Location:** generate-insights/evaluators.ts:216-244; render.ts:132-134; index.ts:471-481
- **What's wrong:** (a) `windowedBaseline`'s total_history_days counts only the 28-day fetched
  slice, undercounting S3's "all days ever" semantics for lagged-leaf confidence (conservative
  direction — 'high' needs ≥14 within ~21-27 visible days); (b) `relationPhrase` maps every
  non-'decreases' relation to "tends to raise" — currently unreachable for non-monotonic edges but
  a trap; (c) trend/threshold render passes inline `window_days: 7` instead of the snapshot's
  `window_days` column (baseline v2 added the column; the engine doesn't select it).
- **Failure scenario:** none live; each is a latent drift point.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

### A24 · CI blind spots: Deno handlers and migrations
- **Severity:** low
- **Unit:** AU7
- **Location:** .github/workflows/ci.yml
- **What's wrong:** the pure engine modules (stats/config/composer/evaluators/render) get
  typechecked transitively — tools/engine-stats and tools/rules tests import them and each
  package's `npm run typecheck` follows the imports. But the three `index.ts` handler shells
  (`jsr:` imports, `Deno.serve`, the fetch/upsert orchestration — including generate-insights'
  33KB handler) are imported by nothing CI compiles, and no `deno check` step exists. Likewise no
  job applies or lints supabase/migrations (only the metric-view SQL is drift-checked as text).
  A type error in a handler or a syntax error in a migration reaches deploy time undetected.
- **Failure scenario:** a refactor renames a composer export; every CI job stays green; the
  generate-insights deploy fails (or worse, the cron starts 500ing silently).
- **Confidence:** confirmed by reading
- **Cross-ref:** new. Offline-safety of the matrix itself is good (no secrets, injectable fetch);
  edge-loader's --check exclusion is documented in-file (by design)

### A25 · app mislabels the new relationship cards and cannot surface their citations
- **Severity:** medium
- **Unit:** AU8
- **Location:** apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:5
  (`enum InsightCategory` — no `relationship`), :65-71 (`_parseCategory` falls through to
  `descriptive`); the select reads no producer/insight_id/edge_refs columns
- **What's wrong:** the U12 engine ships `category: 'relationship'` cards (edge + personal
  producers) and the DB CHECK allows them, but the app's own card model predates S8: an unknown
  category silently becomes `descriptive`, and producer/edge_refs are never selected. The flagship
  phase-2 output — cited, research-linked cards — renders in the app as a plain descriptive card
  with no citation affordance and no way to distinguish "research-linked" from "still researching".
- **Failure scenario:** the L6 demo card (personal producer) shows in the Insights tab grouped/
  iconed as `descriptive`; a future agree card shows identically, its citations unreachable.
- **Confidence:** confirmed by reading
- **Cross-ref:** the live-app face of A6/A20; D14/D15 record the engine side but no app-side
  deferral decision was found — verify with human whether app UI for relationship cards is a
  planned later unit

### A26 · shared InsightCard.id type is wrong against the real table
- **Severity:** low
- **Unit:** AU8
- **Location:** shared/types/index.dart:301 (`final String id`), :335 (`json['id'] as String` —
  throws on int); shared/types/index.ts:77 (`id: string`); migration 20260515110000:15
  (`id bigint generated always as identity`)
- **What's wrong:** the TRUTH-tier shared contract types the card id as a string; the table's id
  is bigint. The shared Dart mirror's `fromJson` would crash on any real row — which is likely why
  the app module carries its own duplicate `InsightCard` (int id) instead of importing the shared
  one. Two Dart card models now exist; the shared one is dead weight that actively misleads.
- **Failure scenario:** any new consumer trusting shared/types crashes on first fetch.
- **Confidence:** confirmed by reading
- **Cross-ref:** compounds A6 (the shared card contract is stale in both fields and types)

### A27 · card-expiry filtering uses naive local time
- **Severity:** low
- **Unit:** AU8
- **Location:** apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:94-100
  (getInsights), :108-118 (watchInsights)
- **What's wrong:** `DateTime.now().toIso8601String()` produces a zone-less local timestamp (e.g.
  `2026-07-17T10:00:00` in SGT) that PostgREST compares against a timestamptz — interpreted as
  UTC, so for a UTC+8 user the filter runs 8 hours in the future and cards are hidden up to 8h
  before their real expiry. `watchInsights` additionally captures `now` once at subscription, so a
  long-lived stream never advances its expiry cutoff (cards linger client-side until re-subscribe
  — the opposite skew).
- **Failure scenario:** SGT evening: a card expiring at 03:00 UTC next day disappears from
  getInsights at 19:00 local although it is still valid.
- **Confidence:** confirmed by reading
- **Cross-ref:** new

## Not bugs — by design (verify with human)

_Deliberate documented decisions the code honors; listed so a reviewer can confirm intent._

- **A-D1 (AU2):** `rules` contract is TS-only, no Dart mirror — documented in shared/rules/rule.ts
  header ("TS-only by design", rules-engine-design Open items #2). Honored: app renders only
  `insight_cards`.
- **A-D2 (AU2):** brain contract TS-first with no Dart mirror / DB guard "until the app renders edges"
  — documented in shared/brain/relationships.ts header. Consistent with current code.
- **A-D3 (AU2):** registry-key membership deliberately NOT a zod invariant (schema stays
  self-contained; loader + guards enforce it) — documented in rule.schema.ts header. Verified: loader
  tests cover the hard-fail ("an unknown registry metric key hard-fails the load").

## Coverage gaps (not exercised)

_Checks that needed infra/keys not available this run — record what, and what it would take._

- **Migrations never applied** — no Docker/local Supabase stack was started, so the 15 migration
  files were audited by reading only. Applying them in order against a fresh `npx supabase start`
  (or a CI shadow-DB job — see A24) would confirm ordering, constraint-name assumptions
  (insight_cards category-check drop), and view validity.
- **Loaders not run against a DB** — `load_rules.mjs` / `load_edges.mjs` were audited as code +
  their offline test suites; the transactional upsert+prune paths never touched a live database.
  Needs SUPABASE_DB_URL (local stack).
- **Edge functions never invoked** — compute-baselines / evaluate-signals / generate-insights were
  not deployed or curl-executed (needs the local stack + service-role key). The pure cores are
  test-covered; the fetch/upsert shells (incl. every PostgREST query shape) ran only in reading.
- **brain-ingest network paths not exercised** — all sources (arXiv, OpenAlex, CORE, Europe PMC,
  NCBI, Crossref, S2, Unpaywall), R2 storage, and the Playwright capture path were audited via
  their offline fixture tests only; no API keys/credentials were used.
- **llm-router live dispatch not exercised** — no ANTHROPIC/OPENAI/GOOGLE keys; api_worker adapters
  and the mailbox flow were audited via mocked tests (which are extensive).
- **Flutter app not launched** — `flutter analyze`/`flutter test` ran (AU1 gates); no emulator run,
  so A25/A27 behaviours were confirmed from code, not observed on-screen.
- **registry.ts ↔ registry.dart field-level parity** trusted to the passing
  metrics-registry-ts-dart-parity guard test (spot-checked keys + order only).

## Summary (written last, in AU9)

**What ran:** AU1 gates all green — `flutter analyze` clean, `flutter test` 48/48,
`context_sync --check` consistent, and all six node packages tsc-clean with 468/468 tests passing.
AU2–AU8 were read-audits of the shared contracts, both tool pipelines, the four loaders/generators,
six phase-2 migrations, the three engine functions, CI, and the app serve seam. **27 findings
(A1–A27): 0 blockers, 0 high, 5 medium (A1, A6, A18, A19, A25), 13 low, 9 nit.** Nothing found contradicts the AU1 green
baseline — the mediums are seam/lifecycle gaps the test suites don't reach, not broken logic.

**Top 5 concerns (all medium):**
1. **A19 — stale `personal_signals` never expire.** Once a pair row lands it feeds gating,
   contradiction, and "still researching" cards forever; nothing reads `computed_at`. The
   only-ever-gains-rows failure mode also afflicts the loaders (A14).
2. **A18 — snooze is decorative.** The nightly upsert rewrites `status='active'`; only dismissal
   sticks. User intent is silently overridden within a day.
3. **A25 — the app can't render what phase 2 built.** `relationship` cards fall back to
   `descriptive`, and producer/edge_refs are never read — the cited-card value proposition is
   invisible at the UI seam (root cause shared with A6/A26: the shared InsightCard contract is
   stale in fields AND types).
4. **A1 (+A2/A3) — the shared-schema safeguard seam.** `partial` is servable yet exempt from the
   independent-retrieval invariant, and corroboration/quoteCheck consistency is enforced only in
   brain-ingest's `enforce()` — edge-loader validates foreign artifacts with the weaker shared
   schema alone, so a crafted artifact line can reach the `high` serving band ungrounded.
5. **A6 — TRUTH-tier contract drift.** `InsightCard` (TS + Dart) lacks the three S8 producer
   columns; `data_sources`/`confidence_sources` unions lag the engine's actual vocabulary (A20).
   The contracts the repo calls truth no longer describe the rows being written.

**Cross-cutting observations:** (a) projections that only gain rows — personal_signals (A19),
router ledger (A11) — vs loaders that prune to empty with no guard (A14): lifecycle semantics
deserve one deliberate pass; (b) the "shared schema is the only gate on foreign inputs" seam
(A1/A2/A3/A13) is the brain pipeline's trust boundary and is weaker than the in-repo producer's
own checks; (c) contract-vs-reality drift concentrated on the app-facing card surface
(A6/A20/A25/A26) — everything engine-side is guard-coupled, the app-side contract is not.

**Coverage:** static audit only beyond the AU1 gates — see "Coverage gaps" above for what a live
stack would additionally confirm.
