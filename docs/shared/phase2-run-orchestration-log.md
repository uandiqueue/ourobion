---
title: Phase-2 Run — Orchestration Log
summary: Resumable state of the automated Phase-2 build run — what shipped, what is in flight, the sequenced worklist with per-unit briefs, and where a fresh session should resume. Companion docs — blocked register, sign-off decisions, config decisions (phase2-run-*).
type: plan
scope: shared
status: canonical
updated: 2026-07-15
---

# Phase-2 Run — Orchestration Log

The resumable state of the automated Phase-2 build run started 2026-07-15 (orchestrator: Claude Code,
device agentjwork). **A fresh session resumes here**: read this doc top-to-bottom, then the
[blocked register](./phase2-run-blocked-register.md), then continue at the first `next` unit.

Run protocol (per Jayden's instructions + AGENTS.md §7, with one waiver):
- One unit of work = one session issue + one branch cut from `dev-phase2` + one `docs/sessions/` log.
- **No worktrees** — Jayden waived them for this solo run; sessions run sequentially in the main checkout.
- Testing gate before any PR: `flutter analyze` + `flutter test` + `node tools/context_sync.mjs --check`
  green (plus the touched package's own suite: `tsc --noEmit`, `npm test` in `tools/brain-ingest`, nao checks).
- Session branches form a **stacked chain** (each cut from the previous session's tip) with one PR per
  session; Jayden merges in order — see [sign-off decision D1 (amended)](./phase2-run-signoff-decisions.md).
  **Never `main`** (the fold is human-gated).
- Blocked-on-human ⇒ record in the register, skip, keep building what's unblocked.

## Baseline (assessed 2026-07-15, dev-phase2 @ bd6f09d)

Already shipped — do not rebuild:
- **Registry v2** (`shared/metrics/`): 19 metrics, all v2 dimensions (`tier`, `continuity`, 5-source
  `source`, `reliability`, `derivedFrom`, `availability`, `preferredSource`), zod + AssertExact, 6 active
  `metrics-registry-*` guards. No version stamp (W7, backlog).
- **Brain contract** (`shared/brain/`): `RelationshipClaim` / `EdgeVerification` / `VerifiedEdge` +
  zod validators + gating fns (`edgeScore`, `servingBand`, `EDGE_GATES`). TS-only (Dart mirror deferred
  by design).
- **Ingestion pipeline** (`tools/brain-ingest/`): discover→dedup→OA-locate→retrieve→extract→store(R2),
  169 tests, run live (~750+ full-text papers in R2 across 6 static seed topics).
- **nao v1** (`apps/nao/`): corpus dashboard + ingest control plane coded; go-live blocked on humans
  (register B1–B4).
- **MVP serve path**: `compute-baselines` (registry-driven, S3-v1), `generate-insights` (6 hardcoded
  rules — the thing W2 replaces), M1/M2/M5a/M5b/M6 app loop, seeder script.
- Tests green at baseline: `flutter analyze` clean, `flutter test` 35/35, `context_sync --check` pass.

Authoritative specs the build follows: `docs/shared/insight-engine-architecture.md` (23 stages, build
levels L0–L8, §S6 edge DDL, §10.1 node inventory, §11 hyperparameters) · `docs/biotope/rules-engine-design.md`
(B1–B5 rules-as-data, §E presentation agent) · ADRs `docs/shared/decisions/0001..0003` (citation
extraction; anomaly definition — **supersedes S4/S5 dummy thresholds**; paper reliability) ·
`docs/nao/brain-synthesis-design.md` + memory 0013 (router shape, family decorrelation).

## Worklist (sequenced; status: done / in-flight / next / queued / blocked / stretch)

| # | Unit | Status | Notes |
|---|---|---|---|
| U0 | Orchestration bootstrap (these 4 docs) | **done** | issue #42 · PR #43 |
| U1 | **L0 contract extension** — `Citation.population`, `QuoteSpan.charStart/charEnd`, `RelationshipClaim.derivation` (+ zod mirrors, AssertExact) in `shared/brain/`; `signal: { deadbandK }` on `MetricDefinition` (TS+Dart, ADR-0002 semantics — see decision D5) | **done** | Commit `b774229`; 35/35 tests, tsc clean. shared/ ⇒ retro-review flag. Architecture doc still says `deadbandSigma` in §S4/§7 — reconcile in U7 |
| U2 | **Storage primitives** — migrations for `events`, `state_bands`, `signals`, `derived_metrics` (+RLS, legacy tables become first instances in place); extend `metrics_registry_schema_test.dart` table→migration map + couplings edge | next | Track A critical path |
| U3 | **LLM router** — dual-route (local-agent / api-worker), Anthropic+OpenAI adapters, model ids + caps from config, synthesis↔verifier family-decorrelation assertion; fixture-mockable, tested | next | Track B foundation; model ids in [config decisions](./phase2-run-config-decisions.md) C6–C7 |
| U4 | **Deterministic quick wins** — A9 quoteCheck (literal-presence gate) + b2 venue lookup (OpenAlex ISSN + SJR → impactTier, cached) | queued | No deps; can slot anywhere |
| U5 | **Rules-as-data** — `shared/rules/` contract (+zod), `data/rules/{single,cross}/`, `rules` table migration, loader `tools/rules/load_rules.mjs`, copy-gate at load, guards + couplings | queued | Replaces the 6 hardcoded rules at U12 |
| U6 | **S2 + S3** — `metric_daily_values` unpivot view (registry-generated, `tools/gen-metric-view.mjs`) + baseline v2 (`window_days`, `total_history_days`, confidence cutoffs per C5) in `compute-baselines` | queued | Right column start; needs U1 |
| U7 | **S4 + S5** — 3-state signal firing (robust median/MAD per ADR-0002) + n=1 evaluator (Spearman ρ, N_eff, BH q) + `personal_signals` migration | queued | Needs U6 |
| U8 | **S6 edge store + A11 loader** — `relationship_claims` / `edge_verifications` / `verified_edges` migrations (DDL in architecture §S6) + R2→Postgres loader precomputing score/band via `shared/brain` | queued | Needs U1 |
| U9 | **Agentic seeder** — registry `derivedFrom[]` + insight needs → research queries; `seeds.ts` stays fallback | queued | Needs U3 |
| U10 | **A8 synthesis** — claim-bearing text → `RelationshipClaim` via router (local-agent route runs keyless in-session) → R2 `edges/claims.jsonl` | queued | Needs U3; real corpus run via local-agent route |
| U11 | **A10 verifier scaffold** — adversarial refute-first verifier via router, fixture-tested; **real runs blocked** on non-Anthropic API key (register B5) | queued | Needs U3+U4 |
| U12 | **S7 + S8 engine refactor** — `generate-insights` → composer (4-branch classify, completeness) + card producer (rules from `rules` table, copy-gate at load+render, U1 applicability stub returning `unknown`, template fallback phrasing) | queued | Needs U5–U8; the flagship refactor |
| U13 | **L6 one-card end-to-end slice** — one pair through seeder→synthesis→quoteCheck→(mock verify)→loader→composer→card on seeded data; prove the workflow end-to-end | queued | The run's finish line |
| U14 | Metric **Wave 1** (self-report ~45) onto the primitives | stretch | After U2; collector = M2 forms |
| U15 | A4 extract v2 (offsets) · A4b citation parse · A2 terms.ts · A6 mentions/co-occurrence · A7 assertion gate | stretch | Left column depth |
| U16 | S9 report composer · A1 gap ledger · A3 transport · A12 coverage (L7/L8) | stretch | |
| U17 | nao v2 graph + evidence panel | stretch | Needs U8 servable edges |

Dependency spine: U1 → {U6→U7, U8}; U3 → {U9, U10, U11}; U5+U7+U8 → U12 → U13. U2 unblocks U14
and the primitives-backed instances but nothing in U6–U13 hard-depends on it (engine reads existing
tables + the S2 view) — it stays early because it's Track A's longest pole.

## Session ledger

| When (UTC) | Unit | Branch / PR | Outcome |
|---|---|---|---|
| 2026-07-15 | Assessment (4 Explore agents) | — | Baseline above; no code changes |
| 2026-07-15 | U0 bootstrap | `docs/orchestration/phase2-run-tracking` / PR #43 | done; awaiting review/merge |
| 2026-07-15 | U1 L0 contract extension | `feat/shared/l0-contract-extension` (stacked on U0) | done; **shared/ retro-review** |

## Notes for the resuming orchestrator

- Activate the toolchain per shell first: `. .\scripts\biotope-env.ps1` (PowerShell) — `node`/`flutter`
  are not on the base PATH.
- Run `node tools/context_sync.mjs --fix-index` before every push; the check gate fails on stale indexes.
- Every session log needs a `memory:` line (`memory: none` or `memory: added NNNN`).
- Flag discrepancy found at assessment: session log `20260713T033718Z` claims the `dev-phase2 → main`
  fold happened; **it did not** (`main` is at the initial commit, 134 behind). The fold remains
  human-gated — see register B1.
