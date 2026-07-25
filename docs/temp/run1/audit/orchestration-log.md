---
title: Phase-2 Audit — Orchestration Log
summary: Resumable state of the record-only audit of the Phase-2 build. Worklist, per-unit status, ledger, and where a fresh session resumes. Findings accumulate in findings-register.md. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-17
---

# Phase-2 Audit — Orchestration Log

Record-only audit of the completed Phase-2 build (units U0–U18). **Find and record potential
issues/bugs/risks — never fix anything.** No code edits, no migrations, no "quick fixes."

A fresh session **resumes here**: read this doc top-to-bottom, then jump to the first unit whose
status is `in-progress` (redo it — it was interrupted) or, if none, the first `next` unit.

## Resume protocol (this is what makes the run survive a sudden session end)

1. **One unit at a time.** Never start a second unit before closing the first.
2. **Before starting a unit**, set its status to `in-progress` here and save.
3. **While working a unit**, append findings to `findings-register.md` *as you find them* —
   do not hold them in your head to write "at the end." A killed session must lose at most the
   one in-flight unit.
4. **When a unit is done**, set its status to `done`, add a ledger row (what you ran, what you
   found), and move the ▶ RESUME pointer to the next unit. Then and only then start the next unit.
5. `in-progress` on resume means the previous session died mid-unit — re-run that whole unit; the
   register may hold partial/duplicate findings, so dedup by (file, line, summary).

## Ground rules

- Toolchain (Windows/PowerShell): `. .\scripts\biotope-env.ps1` first (node/flutter not on base PATH).
  `node tools/context_sync.mjs --check` is read-only and fine; **never** run `--fix-index`.
- Run docs (dev aids, not ground truth) live in `docs/temp/phase2-run-*.md`. Ground-truth specs to
  audit *against* stay in `docs/shared/` (insight-engine-architecture.md, decisions/0001–0003).
- A documented decision (see phase2-run-config/signoff-decisions) is **not** a bug — flag only if
  code contradicts its own stated decision. Known blockers (phase2-run-blocked-register) are not
  new bugs — cross-reference, don't re-report.
- For navigation use `graphify query "<q>"` / `graphify explain "<concept>"` before raw browsing.

## Worklist (status: done / in-progress / next / queued / blocked)

▶ **RESUME AT: — (run complete — all units AU0–AU9 done, 2026-07-17)**

| # | Unit | Status | Notes |
|---|------|--------|-------|
| AU0 | Bootstrap scaffolding (this log + empty findings register) | **done** | seeded by orchestrating session 2026-07-17 |
| AU1 | **Gate run** — `flutter analyze`, `flutter test`, `context_sync --check`; per node package `tsc --noEmit` + `npm test` (llm-router, brain-ingest, rules, metric-view, edge-loader, engine-stats). Record raw pass/fail + exact output of any failure | **done** | ALL PASS — analyze clean, flutter test 48/48, context_sync ok, 6/6 pkgs tsc clean + 468 tests green |
| AU2 | **shared/ contracts** — shared/brain, shared/metrics, shared/rules: zod/AssertExact drift, nullability, contract-vs-code mismatch | **done** | 9 findings (A1–A9): 2 medium (A1 partial-verdict safeguard gap, A6 InsightCard missing S8 columns), 3 low, 4 nit; 3 by-design notes |
| AU3 | **tools/llm-router + tools/brain-ingest** — routing/family-decorrelation, budget caps, quoteCheck/venue logic | **done** | 3 findings (A10–A12, all low/nit) + A3 addendum (code/schema disagree on vacuous quoteCheck); core logic is solid |
| AU4 | **tools/rules + metric-view + edge-loader + engine-stats** — loaders, view generation, edge score/band precompute, stats | **done** | 2 findings (A13 timestamp seam, A14 no empty-set prune guard, both low). engine-stats is a test-only pkg over the engine's stats — logic itself audited in AU6 |
| AU5 | **DB migrations** — events/state_bands/signals/derived_metrics, personal_signals, S6 edge tables, rules table, metric_daily_values view: RLS, constraints, PKs, types | **done** | 3 findings: A15 (derived_metrics user-CRUD vs projection framing, low), A16/A17 (nits). RLS/PKs/CHECKs otherwise coherent; view migration is generated + drift-guarded so audited via AU4 |
| AU6 | **Engine functions** — compute-baselines, evaluate-signals, generate-insights (composer + card producer): stats/threshold logic vs the cited decisions, branch disjointness, copy gates | **done** | 6 findings: A18 (snooze reactivated, med), A19 (stale personal_signals, med), A20/A21 (low), A22/A23 (nit). Stats core faithful to ADR-0002/C3-C5; branch table matches D14; copy gates correctly dual-layer |
| AU7 | **CI** — ci.yml node tool-suite matrix: offline-safety, drift guards, missing checks | **done** | 1 finding (A24: Deno handlers + migrations never compiled/applied in CI). Matrix itself offline-safe; drift guards wired for rules + metric-view; edge-loader exclusion documented |
| AU8 | **Integration seams** — where U0–U18 code meets the pre-existing baseline (pipeline, nao, MVP app/serve loop): contract mismatch, data-shape assumptions | **done** | 3 findings: A25 (app mislabels relationship cards, med), A26 (shared InsightCard.id type wrong vs DB), A27 (naive-local-time expiry filter). App never reads the new phase-2 tables — serve seam is insight_cards only |
| AU9 | **Synthesis** — dedup register, rank severities, write the top-concerns summary + coverage gaps | **done** | register deduped (27 unique findings, no dup by file/line/summary); summary + coverage gaps written into the register; 0 blocker / 0 high / 5 med / 13 low / 9 nit |

## Session ledger

| When (UTC) | Unit | What ran / covered | Outcome |
|---|---|---|---|
| 2026-07-17 | AU0 bootstrap | — | scaffolding created |
| 2026-07-17 | AU1 gate run | `flutter analyze` (No issues, 69.5s); `flutter test` (48/48 pass); `node tools/context_sync.mjs --check` (consistent); per-pkg `npx tsc --noEmit` + `npm test` for llm-router (42), brain-ingest (320), rules (50), metric-view (5), edge-loader (21), engine-stats (30) | **all green** — 0 tsc errors, 0 test failures across 468 node tests + 48 flutter tests; no findings recorded |
| 2026-07-17 | AU2 shared contracts | read shared/{brain,rules,metrics,constants,types} TS+Dart+zod in full; cross-checked vs migration 20260716050639, D13/D14 signoff decisions, registry.dart key order | A1–A9 recorded: safeguard invariant skips servable `partial` (A1, med); InsightCard contract lacks producer/insight_id/edge_refs (A6, med); copy-gate substring false positives (A8); schema-vs-enforce() seam (A2/A3); nits A4/A5/A7/A9; by-design A-D1..3 |
| 2026-07-17 | AU3 llm-router + brain-ingest | read in full: router budget.ts/config.ts/router.ts + router.config.json; brain-ingest limits/budget.ts, verify/{quoteCheck,enforce,retrieval,triage}.ts, venue/banding.ts | A10 (ledger concurrency under-count), A11 (unbounded ledger), A12 (mailbox model-attestation gap vs decorrelation), A3 addendum (quoteCheck vacuous-case code/schema disagreement); enforce/retrieval/triage/banding logic matches the cited decisions |
| 2026-07-17 | AU4 loaders/generators | read in full: edge-loader lib/artifacts.mjs + load_edges.mjs, rules lib/blueprints.mjs + load_rules.mjs, metric-view lib/view.mjs; noted engine-stats = test-only harness importing engine stats (defer logic to AU6) | A13 (verifiedAt string-vs-timestamptz seam), A14 (prune-to-empty footgun); loaders otherwise deterministic + transactional as documented; edge-loader confirms the A1/A2/A3 shared-schema seam is the only gate on foreign artifacts |
| 2026-07-17 | AU5 migrations | read the 6 phase-2 migrations in full (continuity primitives, rules, personal_signals, brain edge store, composed_insights+producers, baseline v2 alter); checked RLS policy shapes vs sibling precedents, CHECK sets vs contract enums, PK/FK/index choices; verified insight_cards category-check drop targets the auto-generated constraint name | A15 (derived_metrics user CRUD contradicts own projection-tier comment), A16 (edge_score rounding vs band), A17 (missing cheap CHECKs) |
| 2026-07-17 | AU6 engine functions | read in full: evaluate-signals stats.ts/config.ts/index.ts, generate-insights composer.ts/evaluators.ts/render.ts/index.ts, compute-baselines index.ts + insight_cards migration; verified stats vs ADR-0002 (MAD/deadband/N_eff/BH/Fisher/stability), C3/C4/C5 constants, D14 branch disjointness, C10 lag set, dual copy gates, producer namespaces | A18 (snooze reactivation), A19 (stale personal_signals), A20 (source-vocab contract drift), A21 (agree-copy overstatement), A22/A23 (nits) |
| 2026-07-17 | AU7 CI | read .github/workflows/ci.yml in full; traced which TS files each job actually compiles (transitive typecheck via tool-package tests vs the uncompiled Deno handler shells) | A24 (CI blind spots: handler index.ts files + migrations); offline-safety and drift-guard wiring verified sound |
| 2026-07-17 | AU8 integration seams | grepped apps/biotope/lib for every phase-2 table/type touchpoint; read m5b insight_service.dart in full; confirmed the app reads ONLY insight_cards (none of verified_edges / composed_insights / personal_signals / continuity primitives) | A25 (relationship→descriptive mislabel + citations unreachable), A26 (shared InsightCard.id String vs bigint — shared Dart mirror would crash; app keeps a duplicate model), A27 (naive local-time expiry filter, frozen `now` in the watch stream) |
| 2026-07-17 | AU9 synthesis | deduped the register (all 27 IDs distinct by file/line/summary), tallied severities, wrote the top-5-concerns summary + cross-cutting observations + 7 coverage-gap entries into findings-register.md | **run complete** — 27 findings, 5 medium (A1, A6, A18, A19, A25), no blocker/high; static-audit-only caveat recorded |
| 2026-07-19 | skill capture (post-run) | distilled this run's methodology into a Claude skill: **added** `.claude/skills/record-only-audit/` (SKILL.md + references/finding-hotspots.md); **edited** `.claude/skills/orchestrate-build-run/` (SKILL.md member-skills line + references/tracking-docs.md) to cross-link it | audit protocol + finding-hotspot lenses now durable outside docs/temp; no code touched |

## Notes for the resuming auditor

- If a live check needs infra you don't have (Docker DB, API keys), record it under "Coverage
  gaps" in the register as "not exercised" — never guess a pass.
- Do not commit, push, or edit any code / run docs. The only files you write are this log and
  `findings-register.md`.
