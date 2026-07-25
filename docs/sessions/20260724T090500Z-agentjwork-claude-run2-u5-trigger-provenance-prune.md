---
title: "Run-2 U5 — run-pipeline trigger (O12-backend), insight provenance RPC (O12), baseline upsert-and-prune (O19)"
summary: "New service-role-gated run-pipeline edge function sequences compute-baselines → evaluate-signals → generate-insights on demand (evaluate-signals finally gets its missing config.toml entry — no cron, H3 stays Jayden's); get_insight_provenance(bigint) SECURITY INVOKER RPC walks card → composed insight → cited edges → claim (derivation/quoteSpans/citations+evidence) + verification verdict under the caller's RLS; compute-baselines now prunes snapshots absent from the current projection (pure lifecycle helper mirroring evaluate-signals', A14 empty-input guard) and generate-insights rejects snapshots older than SNAPSHOT_FRESHNESS_DAYS. All three O19 test-gate scenarios in node tests + full live-stack proof."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U5 · Serve-pipeline trigger + provenance read + baseline prune (O12-backend + O19)

Branch `feat/phase2-run-2/u5-trigger-provenance-prune` off `feat/phase2-run-2/u4-card-semantics-gap-ledger`.
Backlog items executed as locked: **O12-backend** (on-demand trigger + provenance read; engine reused,
never rebuilt) and **O19** (baseline projection lifecycle: upsert-and-prune + freshness defense).

## What changed

### O12-backend — `run-pipeline` on-demand trigger
- New `supabase/functions/run-pipeline/index.ts` (+ `deno.json`): service-role gated by exact header
  compare (identical to the three siblings, incl. the A22 unset-env guard), sequences
  compute-baselines → evaluate-signals → generate-insights via HTTP (`${SUPABASE_URL}/functions/v1/...`,
  service-role header forwarded), collecting per-stage `{stage, status, ok, summary}` where `summary`
  is the stage's JSON verbatim. A stage failure (non-2xx or unreachable, status 0) STOPS the sequence
  and returns `502 {ok:false, failedStage, stages}` — partial results reported honestly. Response
  contract documented in the function header (nao's U6/U8 server route + demo runbook consume it).
- **No `{user_id}` passthrough**: verified none of the three engine functions parses a request body —
  per-user scoping does not exist, and adding it to the engines is out of scope (O12 locked decision).
  The trigger always runs the full pipeline, exactly like the crons.
- `supabase/config.toml`: **`[functions.evaluate-signals]` entry added** (it was the one engine
  function with neither a cron nor a config declaration — verified baseline) plus
  `[functions.run-pipeline]`, both mirroring the siblings (`verify_jwt = true`, own import map).
  **No cron added anywhere** — whether evaluate-signals gets a schedule is human decision H3 (Jayden).

### O12 — `get_insight_provenance(p_card_id bigint)` read surface
- New migration `supabase/migrations/20260724085023_create_o12_insight_provenance_rpc.sql`:
  SECURITY INVOKER, STABLE, `language sql`, `set search_path = public`. The caller's RLS applies at
  every hop: insight_cards (user-select) → composed_insights (user-select) → relationship_claims +
  edge_verifications (authenticated-read). A card the caller cannot see returns **null** — not-found
  and not-owned indistinguishable (no existence leak). EXECUTE revoked from public/anon, granted to
  authenticated + service_role.
- **`p_card_id` is `bigint`, not the brief's sketched `uuid`** — `insight_cards.id` is a bigint
  identity column; the actual schema wins (recorded divergence).
- Edge selection: the card's `edge_refs` (the edges the card actually cites — monotonic
  direction-consistent only, per O18), each joined to the composed payload's edge entry
  (composition-time `direction`/`servingBand`/`edgeScore`), to `relationship_claims.claim`
  (derivation, population, quoteSpans, full citations incl. tiers + U2 evidence passages), and to
  `edge_verifications` at the **exact cited `verified_at`** (the verdict the card was composed
  against, not whatever is newest). Paper bib metadata beyond Citation's fields lives nao-side (R2/D1).
- JSON contract (STABLE — the U7 biotope provenance view consumes it; full commented grammar in the
  migration header):
  `{card {id, ruleId, title, body, producer, category, severity, generatedAt}, patternKey, branch,
  completeness {score, daysPresent, windowDays, perMetric}, personal {rho, nEff, qValue, stable}|null,
  edges [{edgeId, subject, object, relation, direction, servingBand, edgeScore, verdict, verifiedAt,
  derivation, population, quoteSpans [...], citations [...]}]}`.
  The "still researching" personal card is honest by construction: `edges: []` (edge_refs is `[]` by
  CHECK), `personal` present; rule-producer trend/threshold cards (insight_id null) get null
  branch/completeness/personal and `edges: []`.

### O19 — baseline_snapshots upsert-and-prune + freshness defense
- New `supabase/functions/compute-baselines/lifecycle.ts` — the PURE half (dependency-free,
  Deno-free, tsx-importable), mirroring `evaluate-signals/lifecycle.ts` exactly: `snapshotKey`
  (space-delimited, the `pairEligibilityKey` convention) + `computeStaleSnapshots(current, existing)`
  → stale metric keys per user.
- `compute-baselines/index.ts`: after the upsert, existing (user, metric) rows absent from the
  current projection are deleted per user in chunks of 50 (`PRUNE_DELETE_CHUNK`). Snapshot rows are
  now typed (`SnapshotRow`) so the prune reads their identity. Response gains `snapshotsPruned`.
  **The intentional `\x00` map-key separator (series grouping) is untouched — byte-verified: exactly
  one NUL in the file, on the grouping line.**
- **Successful-empty-input policy (A14 mirrored, recorded):** a FAILED S2 fetch never reaches the
  prune (handler already returned 500), so the prune input is always a successful read — but a
  successful read of ZERO rows is still treated as suspect (a mass raw wipe is indistinguishable at
  that seam from a broken view/filter) and the prune is SKIPPED rather than wiping the table. Bounded
  cost: snapshots surviving a skipped prune stop being refreshed, so the freshness filter excludes
  them anyway.
- `generate-insights/index.ts`: **`SNAPSHOT_FRESHNESS_DAYS = 7`** (named config, ADR-0002 style —
  one baseline window; provisional) — the baselines fetch gains `.gte("computed_at", cutoff)`. This
  is the O19 defense-in-depth ("reject snapshots older than the current successful baseline run")
  as a small WHERE; the §S7 union line (`series-having ∪ snapshot-having users`) is UNCHANGED in
  shape — stale-snapshot-only users simply drop out of it naturally.

### Tests
- `tools/engine-stats/tests/s3_baseline_lifecycle.test.ts` (new, 8 tests): the three **mandatory
  O19 gate scenarios** — last-row deletion, metric deprecation (pruned for every user), partial user
  loss (only the lost metric pruned; other users untouched) — plus key injectivity, no-loss ⇒ empty
  map, user-loses-everything, empty-existing, and the empty-current case (handler guards it, A14).

## Live proof (local stack, actual outputs)

Seed (scratchpad `u5-seed.sql` → `docker exec -i supabase_db_ourobion psql`): user
`eead53ee-49f3-4a0a-88a0-b6e7b193fd9d` (created via auth admin API, password sign-in) with 45 days of
correlated sleep+hrv wearable data (pseudo-noise `(4i mod 11)`, ρ≈1) + today sleep 520 / hrv 60 (both
fire "up"); one edge `sleep_duration_min|increases|hrv_sdnn_ms` (high band, 0.9, verdict supported,
full claim with quoteSpans/derivation/citation incl. an evidence passage).

**1 · `run-pipeline` (service-role POST) — all three stages in sequence, one call:**

```json
{"ok":true,"stages":[
 {"stage":"compute-baselines","status":200,"ok":true,"summary":{"ok":true,"users":1,"snapshots":2,"snapshotsPruned":0}},
 {"stage":"evaluate-signals","status":200,"ok":true,"summary":{"ok":true,"day":"2026-07-24","users":1,
   "metricSignals":[{"metricKey":"hrv_sdnn_ms","state":"up","zScore":2.6231,...},{"metricKey":"sleep_duration_min","state":"up","zScore":7.8692,...}],
   "personalSignals":{"pairsEvaluated":1,"rowsUpserted":1,"rowsPruned":0},...}},
 {"stage":"generate-insights","status":200,"ok":true,"summary":{"ok":true,"users":1,"firedPatterns":2,
   "insights":{"upserted":2,"byBranch":{"agree":2,...}},
   "cards":{"upserted":1,"byProducer":{"rules":0,"edge":1,"personal":0},...},
   "gapLedger":{"pairsTouched":1,"demandByStatus":{"personal-signal-no-edge":1}},...}}]}
```

personal_signals **populate for the first time in the serve path** (evaluate-signals previously had
no cron AND no config entry — it never ran). The hrv object-only signal correctly routed to a gap
event, not a card (O16 held).

**2 · `get_insight_provenance` as the AUTHENTICATED user** (password JWT via
`/auth/v1/token`, NOT service role) for card id 1
(`edge:sleep_duration_min|increases|hrv_sdnn_ms`) — condensed; every field verbatim from the run:

```json
{"card":{"id":1,"ruleId":"edge:sleep_duration_min|increases|hrv_sdnn_ms","producer":"edge",
  "category":"relationship","severity":"info","title":"Research-linked pattern: sleep duration min and hrv sdnn ms",
  "body":"Your sleep duration min data shifted upward today, and published research reports that sleep duration min tends to raise hrv sdnn ms. Your own recent data shows a matching pattern — worth watching, not a verdict.",
  "generatedAt":"2026-07-24T08:56:47.455+00:00"},
 "patternKey":"signal:sleep_duration_min:up","branch":"agree",
 "completeness":{"score":1,"daysPresent":28,"windowDays":28,"perMetric":{"hrv_sdnn_ms":28,"sleep_duration_min":28}},
 "personal":{"rho":1,"nEff":27.46,"qValue":0,"stable":true},
 "edges":[{"edgeId":"sleep_duration_min|increases|hrv_sdnn_ms","subject":"sleep_duration_min","object":"hrv_sdnn_ms",
   "relation":"increases","direction":"consistent","servingBand":"high","edgeScore":0.9,
   "verdict":"supported","verifiedAt":"2026-07-21T00:00:00+00:00",
   "derivation":"The cited trial reports longer sleep periods preceding higher SDNN readings; the direction stated by the source is carried over without extrapolation.",
   "population":"healthy adults 18-40",
   "quoteSpans":[{"paperId":"10.5555/u5.demo.1","quote":"Extended sleep duration was followed by higher next-morning SDNN across the extension arm.","locator":"Results, para 2","charStart":1200,"charEnd":1293}],
   "citations":[{"paperId":"10.5555/u5.demo.1","title":"Sleep extension and vagally mediated heart rate variability","year":2024,
     "population":"healthy adults, n=58","evidenceTier":2,"impactTier":"moderate","stance":"supports",
     "evidence":[{"text":"Extended sleep duration was followed by higher next-morning SDNN across the extension arm.","locator":"chars:1200-1293"}]}]}]}
```

Negative checks: anon call → `42501 permission denied for function get_insight_provenance`;
authenticated call with an unknown card id → `null`.

**3 · O19 prune, partial user loss, end-to-end:** `update wearable_daily set hrv_sdnn_ms = null`
(sleep kept) → re-invoke run-pipeline →
`compute-baselines: {"users":1,"snapshots":1,"snapshotsPruned":1}`; table then holds ONLY the
sleep_duration_min snapshot (SQL shown in-session); evaluate-signals pruned the now-ineligible pair
(`rowsPruned:1`, personal_signals count 0 — established A19 behavior confirmed alongside).

**4 · Freshness filter:** snapshot aged to `computed_at = now() - 10 days` + all raw rows deleted →
generate-insights reports `users=0` (the stale-snapshot-only user drops out; pre-U5 it would have
been 1).

**5 · A14 guard:** compute-baselines invoked against an EMPTY S2 read →
`{"ok":true,"users":0,"snapshots":0,"snapshotsPruned":0}` and the surviving snapshot row NOT wiped
(count 1 after).

**6 · Auth:** run-pipeline with the anon key → `401 Unauthorized`.

## Gate summary

- `tools/engine-stats` `npm test` — **49/49 pass** (41 baseline + 8 new O19 lifecycle vectors);
  `npm run typecheck` clean. (`npm ci` was needed first — the worktree had no node_modules there.)
- `tools/rules` `npm test` — **82/82 pass** (no regression); `npm run typecheck` clean.
- `npx supabase db reset` — clean; both new-to-this-chain migrations applied
  (`20260724085023_create_o12_insight_provenance_rpc.sql`, then U4's `20260724090000` gap ledger).
- Live integration proof — executed, outputs above.
- Flutter guards: `metrics_registry_baselines_test.dart` reads `compute-baselines/index.ts` at test
  time — verified my edits keep every assertion true (registry import, `m.baselineApplicable`,
  `metric_daily_values` reads, no wide-table reads, no hardcoded metric-key literals in the added
  code). No guard enumerates config.toml, the functions directory, or the migrations directory —
  no guard update, no flutter run needed.
- `node tools/context_sync.mjs --check` — passed.
- `deno` absent locally (known): run-pipeline/index.ts types are CI's deno-check gate; behavior
  validated live (served + invoked repeatedly).

## Divergences / judgment calls (recorded)

- **RPC arg type `bigint`, not the brief's `uuid`** — `insight_cards.id` is a bigint identity
  column; the schema wins.
- **No `{user_id}` passthrough on run-pipeline** — none of the sibling functions parses a request
  body (verified); scope discipline forbids adding per-user scoping to them.
- **Empty-input prune policy** — successful-but-zero-row S2 read SKIPS the prune (suspect-input
  posture, A14 mirrored); "ran fine, zero rows for a subset" prunes normally. A genuine full wipe
  leaves rows that stop refreshing and fall to the freshness filter — deletion-by-two-steps rather
  than a single risky wipe.
- **`SNAPSHOT_FRESHNESS_DAYS = 7`** — one full baseline window; beyond it the snapshot describes a
  stats window that has entirely rolled past. Implemented as the cheap `.gte(computed_at)` filter
  (feasible without touching the union line), so nothing is carried forward.
- **Provenance verdict pinned to the cited `verified_at`** (edge_verifications at that exact
  version), not the newest — the card's provenance shows what it was composed against.
- **run-pipeline summaries verbatim** — evaluate-signals' response scales with users×metrics; fine
  at demo scale, flagged in the function header for the U6/U8 consumer.

memory: Run-2 U5 shipped O12-backend+O19 — run-pipeline sequences the three engine functions
(evaluate-signals now has its config.toml entry, still no cron/H3); get_insight_provenance(bigint)
is the U7-facing per-card provenance contract (SECURITY INVOKER, caller RLS); compute-baselines now
upsert-and-prunes snapshots (pure lifecycle helper + A14 guard) and generate-insights filters
snapshots older than SNAPSHOT_FRESHNESS_DAYS=7.
