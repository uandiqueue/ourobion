---
title: Backend test plan — prove the Phase-2 backend end-to-end without the app
summary: The repeatable verification plan for everything the Phase-2 run built (U0–U28) — per layer, what to assert, the exact commands that drive it, infra needed, and pass/fail criteria, on the local stack with no UI and no LLM keys. Covers what CI cannot; ends with the prioritized run order and the not-testable-now register items.
type: plan
scope: repo
status: draft
updated: 2026-07-18
---

# Backend test plan — prove the Phase-2 backend end-to-end without the app

**Goal.** The UI is not built, and the [Phase-2 audit](../run1/audit/findings-register.md)
was static-only — its "Coverage gaps" section lists exactly what was never executed (migrations
never applied, loaders never run against a DB, edge functions never invoked, network paths
fixture-only). This plan turns those gaps plus the per-unit live proofs already recorded in the
session logs into a **repeatable, no-app backend verification** of everything the run built
([orchestration log](../run1/orchestration-log.md), U0–U18 + R1 + audit-fix U19–U28), on the
local stack, with **no LLM keys**. It deliberately does **not** duplicate
[CI](../../../.github/workflows/ci.yml), which already asserts: context check, flutter
analyze/test, shared `tsc`, the six node-tool suites + `rules`/`view` drift checks, `deno check`
on the 3 handlers, and a shadow migrations-apply on vanilla postgres:17. What CI *cannot* do —
a real supabase stack, RLS role probes, HTTP-invoked functions, loaders against a live DB, seeded
end-to-end correctness — is this plan.

**Shell prelude (every layer):** `. .\scripts\biotope-env.ps1` per PowerShell shell; local stack
via Docker Desktop + `npx supabase start`;
`$env:SUPABASE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'`; service-role key
from `npx supabase status -o env`.

## 1 · DB layer (migrations, RLS, constraints, S2 view)

- **Assert:** all **16** migrations apply clean (count re-verified 2026-07-18; U25's constraint
  migration is the newest); RLS separates roles; U25's named CHECKs reject; the S2 view is correct
  against seeded rows.
- **Drive:** `npx supabase db reset`. Seed with the
  [U7 mechanics](../../sessions/20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md):
  auth user by direct `auth.users` INSERT, then pipe `scripts/seed-test-data.sql` into container
  psql with `-v days=45` (sidesteps the PowerShell-5.1 BOM parse failure).
- **RLS probes** ([U8 SQL pattern](../../sessions/20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md)):
  in psql, `set role authenticated` → `verified_edges` rows visible; `set role anon` → 0 rows;
  per-user projection tables (`baseline_snapshots`, `personal_signals`, `composed_insights`) —
  authenticated selects only own rows, no user write policy (service-role writes), anon sees none.
- **Constraint rejections** (U25, ledger row in the orchestration log): violating inserts fail
  **by constraint name** — `composed_insights_period_order`, `personal_signals` rho/ci_low/ci_high
  ∈ [-1,1] + q_value ∈ [0,1]; `edge_score` stores full precision unrounded (e.g. 0.8555555).
- **View correctness** ([U6 log](../../sessions/20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md)):
  `select count(*) from metric_daily_values` = **metrics × seeded days** (U6: 224 = 16 × 14);
  `security_invoker=true` in `pg_class.reloptions`; a hand-inserted duplicate-day `signals` pair
  surfaces as ONE daily mean row tagged `signal`.
- **Pass:** reset exits 0 with 16 applied; every probe/rejection behaves exactly as above.

## 2 · Contracts (compile-enforced parity)

- **Assert:** the shared TS contracts (zod + `AssertExact`, identity-strength post-U19/A5) compile;
  the Dart mirrors hold.
- **Drive:** `npx tsc --noEmit` in `shared/`; `flutter test` in `apps/biotope` (the
  `metrics-registry-*` guards, TS↔Dart registry parity, U28's copy-gate lockstep vectors).
- **Pass:** tsc silent; flutter **66/66** (post-U28 count).

## 3 · Tools packages (suites + drift checks)

- **Drive:** `npm test` in the six packages; then `npm run view:check` + `npm run rules:check`
  (DB-free drift guards, root package.json scripts).
- **Pass (counts re-verified green 2026-07-18):** brain-ingest **323** · llm-router **48** ·
  rules **64** · edge-loader **36** · engine-stats **36** · metric-view **5**; both drift checks 0-diff.
- **Known gaps the suites do NOT close** (audit "Coverage gaps"): brain-ingest/llm-router network
  paths are fixture-only (no API keys/R2 in tests); A22's explicit-500 branch is unreachable
  locally (supabase always injects the service-role env); `deno check` first runs for real in CI
  (deno absent on dev machines — U27 caveat).

## 4 · Engine functions (serve + HTTP on seeded data)

- **Drive:** after §1 seeding, `npx supabase functions serve`, then service-role POSTs in order
  (exact curl in the [runbook](../../shared/insight-slice-demo-runbook.md) §6):
  `compute-baselines` → `evaluate-signals` → `generate-insights`.
- **Assert (each proven live once — U6/U7/U12/U22 logs — now the repeatable pass/fail bar):**
  - **Baselines** (U6): `{ok, users:1, snapshots:16}`; confidence tiers live: 4 seeded days →
    `low`, 5 → `medium` (history <14), 14 → `high` (C5 3/5/14 cutoffs).
  - **Signals** (U7): shaped outlier fires `up` (U7: modified z = 8.77 ≫ deadband 1.0);
    short-history metric emits `neutral` + `suppressed: insufficient-baseline` and gets **no**
    `personal_signals` rows; artifact/deadband boundaries covered by engine-stats vectors.
  - **personal_signals gates** (U7): injected correlated pair passes all serve gates
    (ρ≈0.96, N_eff≈35 < n=45 — autocorrelation penalty visible, q=0.000, stable=t); BH refuses
    the next-best random pairs (q 0.071/0.946 > 0.05) across the pair family.
  - **Pruning** ([U22](../../sessions/20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md)):
    null out one metric's recent days → re-run reports `rowsPruned` (U22: 120→105, 15 pruned) and
    the pruned pair is no longer consumed (re-run of generate-insights recreates no card).
  - **Cards** ([U12 evidence (a)–(f)](../../sessions/20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md)):
    zero hardcoded rules (cards only from `rules` rows); cross card fires through a servable brain
    edge with populated `edge_refs` + `insight_id`; **copy gates both live** — a `disease`-word
    throwaway rule skipped at load, an unresolved-placeholder rule dropped at render, no card row
    for either; **dismissal sticks** (status + `generated_at` unchanged on re-run); **snooze
    survives regeneration** (U22: `snoozedSkipped` counted, status stays `snoozed`);
    **idempotency** — re-run upserts the same card set, `composed_insights` count stable.
- **Pass:** every response field and SQL after-state matches the cited log values on freshly
  shaped seed data.

## 5 · Brain pipeline (fixtures → claims → gate → loader → servable edges)

- **Drive:** in `tools/brain-ingest`: `npx tsx src/cli.ts synthesize --pair <a>,<b> --paper <id>
  --terms "…"` — **keyless** via the local-agent route; the orchestrating session fulfils the
  mailbox request per the fulfillment contract in `tools/llm-router/README.md` (write
  `<id>.response.json` beside the request). A9 quoteCheck gates the claim (U10 live proof:
  verbatim-quote claim accepted, paraphrased causal overstatement rejected). Venue lookup (b2)
  runs offline against its fixtures (brain-ingest suite). Then
  `node tools/edge-loader/load_edges.mjs --from-dir <edges-dir>` (fixture dir:
  `tools/edge-loader/tests/fixtures/edges/`).
- **Assert:** loader validates via the real `shared/brain` schema and precomputes score/band —
  fixture set proves every band (0.900/high, 0.560/mid, 0/hold, superseded 0.765,
  claim-without-verification absent from `verified_edges`); idempotent re-run (U8: identical
  content checksum); **U24 empty-guard** — empty input dir → exit 1 and tables untouched;
  `--allow-empty` → tables legitimately emptied; mixed-offset `verifiedAt` dedups/supersedes
  correctly (canonical UTC).
- **Pass:** `verified_edges` serves exactly the expected band per edge; the empty-dir run leaves
  row counts unchanged.

## 6 · End-to-end (the L6 runbook as a scripted backend check)

The [insight-slice demo runbook](../../shared/insight-slice-demo-runbook.md) is the sequence;
run it start-to-finish as one scripted check: db reset → seeder (mailbox-fulfilled) → synthesize →
interim verify → `edges:load` → `rules:load` (8 blueprints) → shaped 60-day seed → the three
function POSTs → SQL assertions. Expected stage outputs (all in the runbook): edge loads at
`hold @ 0.000` with the INTERIM verifier marker; cross rule reported under `brainScopeSkips`;
`personal_signals` ρ=1.0 / N_eff≈37 / q=0 / stable=t; `cards {personal: 1}` — the honest uncited
"still researching" card; the §S8 source-panel dataset (2 verbatim quotes + offsets + derivation +
population) queryable from the edge tables. **Post-B5-key rerun** (the upgrade path, runbook final
section): flip `verifier` → `api_worker`, `npx tsx src/cli.ts verify --edge …` → real verdict →
loader flips band `hold` → `mid`/`high` → branch upgrades `idiosyncratic` → `research-context`
(this symmetric `correlates` pair tops out there by design), the cross rule fires, and the source
panel lights up **from the card's** `edge_refs`.

## 7 · NOT testable now ([blocked register](../run1/blocked-register.md))

- **Real A10 verifier** — B5 (non-Anthropic key); first real runs must also check the A12
  local-agent attestation seam (model field is fulfiller-self-reported — note under B5).
- **nao go-live** — B2 (Cloudflare), B3 (Worker secrets + login user), B4 (Actions secrets).
- **Hosted nightly engine (pg_cron)** — B9 (dashboard config values before prod `db push`).
- **Real-device Android** — B10; **iOS** — memory 0010 (needs Mac + paid account).
- **SJR quartile sharpening** — B11 (dataset/licensing call; OpenAlex-only banding works).
- **CI on dev-phase2 itself** — B13: until recovery PR #72 merges, `dev-phase2` lacks U1–U28, so
  green CI there proves nothing about the chain; run this plan on the chain tip.

## Priority order (fastest / most-foundational first) + infra

| # | Step | Needs | ~Time |
|---|------|-------|-------|
| 1 | shared `tsc` + six suites + drift checks (§2, §3) | node only | ~3 min |
| 2 | `flutter test` 66/66 (§2) | flutter | ~2 min |
| 3 | `db reset` — 16 migrations (§1) | Docker + supabase | ~2 min |
| 4 | view count + RLS + constraint probes (§1) | psql (container) | ~5 min |
| 5 | functions serve + 3 POSTs on shaped seed (§4) | stack + seed | ~20–30 min |
| 6 | brain fixtures → loader → servability + empty-guard (§5) | stack | ~10 min |
| 7 | full L6 e2e incl. mailbox-fulfilled synthesis (§6) | stack + R2 `.env` | ~45–60 min |

**Infra prerequisites:** PowerShell toolchain activation per shell (`. .\scripts\biotope-env.ps1`);
Docker Desktop + local Supabase (`npx supabase start`); `tools/brain-ingest/.env` with R2
credentials **only** for the real-corpus steps of §5/§6 (fixture paths need none); **no LLM keys
for anything above** — the local-agent route is keyless by design; service-role key + DB URL as in
the shell prelude.
