---
title: Phase-2 Run 2.0 — Orchestration Log (SINGLE SOURCE OF TRUTH)
summary: Resumable tracking doc for Run 2.0 (demo-test MVP, backend + frontend). Worklist, per-unit status, ledger, and the ▶ RESUME pointer. A fresh session resumes from THIS doc alone — read top-to-bottom, then continue at ▶ RESUME. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Phase-2 Run 2.0 — Orchestration Log

**Launch prompt:** `docs/temp/phase2-run-2-orchestrator-prompt.md` (committed on this branch).
**Backlog consumed:** `docs/temp/next-build-optimizations.md` (Run-2.0 version, committed on this branch —
NOT the dev-phase2 copy, which predates O9–O20 + the demo target).
**Goal:** working demo-test MVP — main loop 1–5 + features a–d (PART 1 of the launch prompt) on a
simplified (existing-convention) UI. Definition of done = scripted e2e dry-run passes + demo runbook
reproduces from a clean local stack.

## Run invariants (from the launch prompt — binding)

- Branch prefix `feat/phase2-run-2/*`; stacked PR chain off `origin/dev-phase2` @ e185cf0; NEVER merge.
- Run worktree: `C:\project\ourobion-run2` (main checkout is in use on signoff/phase2). If gone, recreate
  off the current chain tip.
- One unit at a time; tracking docs committed BEFORE starting a unit and after finishing it.
- OpenAI-only LLM posture (TEST-MODE decorrelation override; see decisions-signoff.md D2); budget
  ≤ 20 SGD TOTAL OpenAI spend — ledger below tracks it; stop at a unit boundary well short of the cap.
- Orchestrator never edits code; exactly ONE writer subagent at a time; read-only agents fan out freely.
- YOU NEVER SELF-SIGN-OFF — unit-signoff-index.md rows stay `pending` for Jayden.

## ▶ RESUME

**Current state:** U0 done (#123) · U1 done (#124; router OpenAI-only TEST-MODE, caps 1.00 USD/day/
node + 60k tok/run) · U2 done (#125; verifier grounded — evidence-bearing citations, fixture corpus,
CLI retrieve wiring, acceptance (i) green). Local supabase stack UP (API 54321 / DB 54322). Chain
tip: feat/phase2-run-2/u10-seeds-as-data (U10 done, #133 — feature c shipped; cap overrides now
bind real brain-ingest runs). Tracking-doc updates ride the chain tip.
Demo dev user on local stack: u6-demo@ourobion.local — NOTE: `supabase db reset` WIPES auth.users;
recreate via admin API (uid changes each recreation; re-seed data after resets).
**Next action:** U11 is `in-progress`. If resuming mid-U11: audit any uncommitted partial work
against the U11 brief, finish cleanly, redo the FULL gate + live proof (PART R).
BOTH keys present in tools/brain-ingest/.env (gitignored): OPENAI (≤20 SGD) + ANTHROPIC (≤2 SGD,
optional verifier decorrelation — see Budget + D2 AMENDED).

## Worklist (FINAL — from assessment synthesis 2026-07-24)

Status: `queued` / `in-progress` / `done`. Sequencing spine: O15 (U2) before feature b (U9); O16 (U4)
before any card demo (U12); backend seam lands in the same unit as (or before) the UI consuming it.
One writer at a time; each unit stacks on the chain tip.

| Unit | Title | O-items | Status |
|------|-------|---------|--------|
| U0 | Run bootstrap: worktree, input docs, tracking docs, PR #123 | — | done |
| U1 | Router OpenAI-only posture: TEST-MODE decorrelation override (labelled), all nodes → gpt-*/o* on api_worker, low C7 caps (C-entry), live smoke call (ledger row) | PART 3, D2 | done |
| U2 | Verifier grounding: evidence-bearing citation type (shared/, B8), fixture corpus file + loader, CLI retrieve wiring, evidence in prompt; ACCEPTANCE (i) integration test on the real CLI seam | O15 | done |
| U3 | Contract hardening: servable band ⇒ quote-check pass (shared/ superRefine, B8; ACCEPTANCE (iii) loader test) + derivation copy-gate at synthesis + load | O17, O20 | done |
| U4 | Card semantics: orientation-aware cards (ACCEPTANCE (ii) 8-vector matrix), research-context/contradiction gap-only (O18 decided), gap_ledger table + composer writes, kill pairEdges fallback (correlates/modulates never decorate) | O16, O18, O9-table | done |
| U5 | Serve-pipeline on-demand trigger (runs compute-baselines → evaluate-signals → generate-insights; note: evaluate-signals has NO cron today), provenance read surface (card→edges→claims/citations view), baseline upsert-and-prune (+O19 test gates) | O12-backend, O19 | done |
| U6 | Simulated-data loader: nao page + API route writing biotope tables (provenance-flagged, incremental by-day) + "Run analysis now" button (calls run-pipeline server-side) + FIRST nao unit adds nao CI job (typecheck+test) | O11 | done |
| U7 | biotope demo surfaces: trend/graph on metric_daily_values, provenance detail view (get_insight_provenance RPC; handles "still researching"), post-trigger refresh | O12-app | done |
| U8 | Model-config + spend boundaries (Supabase read surfaces for router config + ledger; caps-edit write path router honors) + nao panel (feature a) | O10 | done |
| U9 | Claims curation + human REJECT: edge_human_verdicts migration, loader/view overlay (reject supersedes for serving), nao paper→claims page + reject action | O13 | done |
| U10 | Seeds-as-data: seeds table migration, nao seed-add UI, seeder reads table as 4th candidate source (C9 pair-only gate intact) + adopt LlmRouter.create() in brain-ingest (U8 carry-forward) | O14 | done |
| U11 | Gap surfacing: nao ingestion-view of gap_ledger (detection landed in U4); signal-no-edge → gap row → visible in nao | O9 slice | in-progress |
| U12 | E2E demo dry-run: scripted full PART-1 flow (main loop 1–5 + features a–d) on local stack, live OpenAI for the essential proofs (ACCEPTANCE (iv), card copy inspected both orientations) + demo runbook (DoD v+vi) | DoD | queued |

## Test strategy (the BAR, binding on every unit)

- **Unit-green ≠ seam-correct.** Every backend path the demo exercises gets an INTEGRATION test on
  the REAL seam: real CLI entry (U2), real shared-schema load path (U3), real generate-insights
  handler on the local stack (U4/U5), real HTTP trigger (U5), real nao route → DB rows (U6), real
  reject → serving exclusion (U9), real seed row → candidate enumeration via CLI (U10), real
  signal-no-edge → gap row (U11).
- **Mandatory acceptance tests:** (i) U2 — evidence text + provenance in the actual router request
  from the CLI seam (capturing transport is OK; injected `retrieve` + mock router is NOT);
  (ii) U4 — subject-only / object-only / both-consistent / both-inconsistent × increases/decreases;
  (iii) U3 — failed quote check never yields a servable band (loader test); (iv) U12 — one real
  end-to-end main-loop run on simulated data with OpenAI, card copy inspected for both endpoint
  orientations.
- **Handler-layer coverage is net-new by necessity** — the three edge functions have ZERO runtime
  tests today (CI deno-checks types only); U4/U5 establish local-stack invocation tests.
- **LLM spend:** live calls ONLY in U1 (smoke, ~0.1 SGD) and U12 (the e2e proof). Everything else
  runs fixtures or a capturing transport. C7 caps set low in U1.
- **Per-unit gate (PART 6):** flutter analyze + flutter test (when app touched); per-package
  tsc --noEmit + npm test; deno check unavailable locally (memory: validate via
  `supabase functions serve` + HTTP; CI deno-check is the type gate); `supabase db reset` for
  migration units; context_sync --check; the unit's own integration tests.

## Assessment synthesis (verified baseline, 2026-07-24)

Four read-only Explore agents mapped dev-phase2 @ e185cf0. Full reports in the session transcript;
load-bearing facts:

- **Engine:** cron-only (pg_cron→pg_net, service-role header check); **evaluate-signals has NO cron
  schedule and no config.toml entry** — personal_signals never populate on the shipped schedule (the
  U5 trigger runs it explicitly; cron addition left to Jayden — human-decisions H3). Wrong-metric bug
  confirmed at generate-insights/index.ts:693-731 + render.ts EDGE_CARD_TEMPLATE (subject hardcoded)
  + composer.ts:97-98 (single-endpoint ⇒ consistent); NO orientation test exists. research-context
  coincidence cards render today (index.ts:612) and the pairEdges fallback (index.ts:645-648) can
  attach correlates/modulates; gap ledger is entirely absent (composer.ts:253 defers it) — U4 builds
  the table both O18 and O9 need. compute-baselines upserts without pruning; generate-insights unions
  baseline-only users (index.ts:415).
- **Brain/verifier/router:** O15 fully confirmed — cli.ts:334-353 never sets runOpts.retrieve (zero
  retrieval, yet `performed:true` = grounded-absence), VerifyCitation (verify/types.ts:45-53) has no
  text field (evidence stripped at the TYPE boundary), prompt shows title/ids only (prompt.ts:71-74).
  NO fixture corpus file exists — the RetrieveOptions.corpus seam is fed only by inline test objects.
  Router: all six nodes currently route local_agent (verifier is already gpt-5 but goes through the
  mailbox, not OpenAI); decorrelation enforced at CONFIG LOAD only (config.ts:221-236, two clauses
  incl. verifier!==anthropic — both violated by the OpenAI-only posture → TEST-MODE flag);
  OpenAI adapter exists and works (apiWorker.ts:169-208) but is UNEXERCISED by shipped config.
  Budget ledger solid (budget.ts, file-backed, 0.95 hard-stop). O17 confirmed: no superRefine clause
  ties servable verdicts to quoteCheck (relationships.schema.ts:155-210); only the pipeline's
  pre-LLM reject masks it — not a contract guarantee. O20 confirmed: validateCopyString never called
  on derivation (synthesis or loader). Human-override layer: nothing exists (greenfield). Seeds:
  candidates.ts:60-119 has three sources (registry derivedFrom / blueprints / static topics), C9
  pair-only gate also enforced at postprocess.ts:131-139 — a seeds table is a clean 4th source.
- **nao:** Next.js 15 App Router on OpenNext/CF Workers; Supabase is AUTH-ONLY today — zero DB
  reads/writes; corpus data comes from R2+D1. Existing reusable seams: IngestControlPanel form
  pattern, API-route-handler convention, SubNav tabs, theme.css tokens, GH-Actions dispatch (the
  seed "Run now" already dispatches a fixed list — O14 extends this seam with a table). **nao is NOT
  in CI at all** — U6 adds the job. No claims/evidence/model-config/gap UI exists.
- **biotope:** Insights tab renders insight_cards (extend, don't re-skin; severity parsed but
  unrendered); provenance detail view + any per-day trend are GREENFIELD — no charting package, no
  range query; the canonical chart source is the `metric_daily_values` view (security_invoker).
  App never invokes the engine (cron-only from its POV); realtime watchInsights exists unused.
  Widget tests blocked on Supabase init (placeholder only) — unit-test the pure parts, verify
  screens on the live stack in U12.
- **Design-contract deviation to record:** biotope-nao-link says nao never writes biotope's health
  tables; O11 (Jayden, locked) sanctions the simulated-data loader doing exactly that, dev-only +
  provenance-flagged. Recorded as D3 in decisions-signoff.md; retro-review flag.

## Ledger

| # | Unit | Branch | PR | Gate | OpenAI spend (SGD) | Cumulative spend | Notes |
|---|------|--------|----|------|--------------------|------------------|-------|
| 1 | U0 | feat/phase2-run-2/u0-run-docs | #123 | context_sync green | 0.00 | 0.00 | docs-only bootstrap; inputs carried onto branch |
| 2 | U1 | feat/phase2-run-2/u1-router-openai-posture | #124 | tsc + 56/56 tests + context_sync green | 0.0002 | 0.0002 | live smoke: gpt-5-mini via api_worker, US$0.00015125; gpt-5-family spends ~70 reasoning tokens even on trivial prompts — size maxOutputTokens generously downstream |
| 3 | U2 | feat/phase2-run-2/u2-verifier-grounding | #125 | brain-ingest tsc + 338/338; shared tsc; edge-loader tsc + 45/45; context_sync green | 0.00 | 0.0002 | O15 closed; ACCEPTANCE (i) mutation-checked; shared/ Citation.evidence additive → B8. Anthropic spend to date: 0.00 / 2 SGD |
| 4 | U3 | feat/phase2-run-2/u3-contract-hardening | #126 | shared tsc; edge-loader tsc + 50/50; brain-ingest tsc + 340/340; context_sync green | 0.00 | 0.0002 | O17+O20 closed; ACCEPTANCE (iii) mutation-proven (git-stash mutation, both O17 tests + O20 loader test fail pre-fix); shared/ superRefine clause → B8 |
| 5 | U4 | feat/phase2-run-2/u4-card-semantics-gap-ledger | #127 | rules 82/82 + tsc; db reset clean; LIVE handler proof on local stack; context_sync green | 0.00 | 0.0002 | O16+O18 closed + gap_ledger shipped (§A1 verbatim); reproduced bug input → 0 wrong-metric cards + gap row; demand increment + RLS denial proven live. Deno typecheck deferred to CI (deno absent locally) |

| 6 | U5 | feat/phase2-run-2/u5-trigger-provenance-prune | #128 | engine-stats 49/49 + tsc; rules 82/82 + tsc; db reset clean; LIVE 3-stage pipeline + authed provenance JSON + prune/freshness/A14 proofs; context_sync green | 0.00 | 0.0002 | O12-backend+O19 closed; run-pipeline + get_insight_provenance(bigint) shipped; SNAPSHOT_FRESHNESS_DAYS=7; evaluate-signals config.toml entry added (cron still H3) |
| 7 | U6 | feat/phase2-run-2/u6-nao-data-loader | #129 | nao tsc + 54/54; db reset clean; LIVE loader→rules-cards→backfill→11-patterns proof; context_sync green | 0.00 | 0.0002 | O11 closed; /loader page + routes + nao CI job; data_origin migration; auth-test stub repair in-commit; harness classifier warning reviewed (transient stage-2 error; actions in-brief) |
| 8 | U7 | feat/phase2-run-2/u7-biotope-trend-provenance | #130 | flutter analyze clean + 111/111; context_sync green | 0.00 | 0.0002 | O12-app closed — MAIN LOOP 1–5 FULLY BUILT; CustomPaint trend on Home tab; provenance screen with TEST-MODE stamp under every edge verdict; live series+RPC proof via raw Dart client |
| 9 | U8 | feat/phase2-run-2/u8-model-config-spend | #131 | llm-router tsc + 71/71; nao tsc + 63/63; db reset clean; LIVE publish→panel→cap-edit→effective-cap+fail-soft proofs; context_sync green | 0.00 | 0.0002 | O10 closed (feature a); boundaries as rebuildable projections; O10(c) ingestion boundary deliberately deferred (Overview covers demo). First U8 attempt died on transient ENOTFOUND pre-write; clean re-run |
| 10 | U9 | feat/phase2-run-2/u9-claims-human-verdict | #132 | edge-loader tsc + 56/56; nao tsc + 74/74; db reset clean; LIVE 6-step reject proof incl. real loader path + before/after serving exclusion + rebuild-doesn't-clobber; context_sync green | 0.00 | 0.0002 | O13 closed (feature b). LIMIT HALT mid-unit (session cap, reset 21:20 MYT); second agent audited inherited work per PART R, found+fixed a real containment-serialization bug, redid full gate+proof. No shared/ change (no B8). No GIN (seq scan 0.085ms measured) |
| 11 | U10 | feat/phase2-run-2/u10-seeds-as-data | #133 | brain-ingest tsc + 353/353; nao tsc + 83/83; db reset clean; LIVE seed-add→catalog→CLI-merge→fail-soft + cap-override-blocks-real-verify proofs; context_sync green | 0.00 | 0.0002 | O14 closed (feature c) + U8 carry-forward done (create() adopted in verify/seeder/synth — override denied a real verify pre-API-call). C9 gate pinned by tests (byte-identity + header pin). Run-now dropdown stays static (GH dispatch contract not dragged in) |

**Carry-forwards (not lost, owned later):** `contradiction` → shared/brain `needsReview()` edge-flag
not wired (U4 report; candidate for U9's serving-layer work or a backlog note at run end).
run-pipeline stage summaries scale with users×metrics (fine at demo scale — flagged in its header
for U6/U8 consumers). run-pipeline mid-sequence-failure path (502 + partial stages) not forced
live — exercise or note in U12 runbook. **LlmRouter.create() (the override-aware entry) is NOT yet
adopted by pipeline callers** (brain-ingest constructs the router directly) — cap overrides don't
bind real verify runs until adopted; U10 (which owns brain-ingest CLI changes) adopts it.

## Budget

- Cap: **20 SGD** total OpenAI. Spent: **0.0002 SGD**.
- **Anthropic (added by Jayden 2026-07-24, post-launch): cap 2 SGD, spent 0.00.** Optional — verifier
  decorrelation only (see launch prompt PART 0/PART 3 amendments + D2 AMENDED). Likely decision
  point: U12 e2e. Track any Anthropic spend as its own ledger note per row.
- Policy: fixtures/offline first; live calls only for the essential e2e proofs (mandatory acceptance
  test (iv) + the U12 dry-run; small calibration calls if a unit's integration test truly needs one).
- Router C7 caps set low in U1 (value recorded as a C-entry when set).

## Assessment (baseline) — pending

4 read-only Explore agents dispatched 2026-07-24 (engine/serve, brain/verifier/router, nao, biotope).
Synthesis lands here in the next commit; worklist finalized from it.
