---
title: Phase-2 Unit Index — status + pointers (review cockpit)
summary: One row per shipped Phase-2 unit — build status, sign-off status, review owner, decision refs (D/C/A), its docs/sessions log, key code paths, and commit/PR. The single navigation map for the sign-off review; complements the sign-off ledger (signoff-instructions.md §6, the authoritative sign-off record) and the orchestration log (build history). Dev aid (docs/temp), not ground truth.
type: process
scope: shared
status: canonical
updated: 2026-07-22
---

# Phase-2 Unit Index — status + pointers

The **navigation map** for the sign-off review: every shipped unit, where its code lives, its session
log, what it decided, and where it stands. The **authoritative sign-off record** is the ledger in
[`signoff-instructions.md`](./signoff-instructions.md) §6; **build history** is
[`orchestration-log.md`](./orchestration-log.md). This doc just ties them together
+ adds the code/log pointers.

Session logs live in `docs/sessions/` (slug shown; all are `2026…Z-agentjwork-claude-<slug>.md`).
Sign-off: ✅ signed · ⬜ pending · ⏸ deferred (stats → methodology register O2). Owner: **J**=Jayden
(agent) · **A**=Alton→**J** (build; Alton out, now Jayden) · **B**=both (shared/, 2-reviewer — needs the
B8 solo-review waiver now that Alton is out).

## Build run (shipped units)

| Unit | Sign-off | Owner | Decisions | Session-log slug | Key code paths | commit / PR |
|------|----------|-------|-----------|------------------|----------------|-------------|
| **U1** · L0 contract | ✅✅ **cleared** | B | D5, D8 | `l0-contract-extension` | `shared/brain/relationships{.ts,.schema.ts}`, `shared/metrics/registry{.ts,.dart,.schema.ts}` | `b774229` / #45 |
| **U2** · storage primitives | ✅ A · ⬜ J (shared cosign) | A→J + B | D9 (RLS→O4) | `storage-primitives` | `supabase/migrations/20260715140420_*continuity_storage_primitives.sql`; `shared/metrics` MetricTable | `23f6947` / #47 |
| **U3** · LLM router | ✅ J (provisional) | J | C6, C7 (→O7/O8) | `brain-llm-router` | `tools/llm-router/` (`router.config.json`, `src/config.ts`, `src/budget.ts`, `src/routes/`) | `a419d8e` / #49 |
| **U4** · quoteCheck + venue | ✅ A | A (C8 ⏸) | C8 ⏸ | `quotecheck-venue-lookup` | `tools/brain-ingest/src/verify/quoteCheck.ts`; `tools/brain-ingest/src/venue/` | `389074f` / #51 |
| **U5** · rules-as-data | ⬜ B | B | D10 | `rules-as-data` | `shared/rules/`; `data/rules/{single,cross}/`; `tools/rules/load_rules.mjs`; rules-table migration | `e8e4a06` / #53 |
| **U6** · S2 view + S3 baseline | ⬜ J (eng; C5 ⏸) | A→J | D11; C5 ⏸ | `s2-view-s3-baseline-v2` | `tools/metric-view/`; `supabase/functions/compute-baselines/` | `cfcf257` / #55 |
| **U7** · S4 signals + S5 evaluator | ⬜ J (eng; C3/C4 ⏸) | A→J | D12; C3/C4 ⏸ | `s4-signals-s5-evaluator` | `supabase/functions/evaluate-signals/` (`stats.ts`, `config.ts`, `index.ts`); personal_signals migration | `97dbd40` / #57 |
| **U8** · S6 edge store + loader | ⬜ B | B | D13 | `s6-edge-store-a11-loader` | `supabase/migrations/*brain_edge_read_store*`; `tools/edge-loader/` | `b5b0115` / #59 |
| **U9** · agentic seeder | ✅ J (+O9) | J | C9 | `agentic-seeder` | `tools/brain-ingest/src/seeder/` (`candidates.ts`, `prompt.ts`, `artifact.ts`); `seeds.ts` | `f13d359` / #61 |
| **U10** · A8 synthesis | ⬜ J (in review) | J | prompt (`prompt.ts`) | `a8-synthesis` | `tools/brain-ingest/src/synth/` (`prompt.ts`, `index.ts`, `passages.ts`, `postprocess.ts`) | `138fea4` / #63 |
| **U11** · A10 verifier scaffold | ⬜ J (⚠ B5-blocked) | J | D4 | `a10-verifier-scaffold` | `tools/brain-ingest/src/verify/` (verifier + retrieval); router `verifier` node | `106e120` / #65 |
| **U12** · S7/S8 engine | ⬜ J (eng) | A→J | D14 | `s7-composer-s8-cards` | `supabase/functions/generate-insights/` (`composer.ts`, `evaluators.ts`, `render.ts`, `index.ts`) | `a9204ee` / #67 |
| **U13** · L6 one-card slice | ⬜ J | J | D15 | `l6-one-card-slice` | `docs/shared/insight-slice-demo-runbook.md`; end-to-end slice data | `8b33dc2` / #69 |
| **U18** · CI node-suites | ⬜ J (eng) | A→J | (D10 flag) | `ci-node-tool-suites` | `.github/workflows/ci.yml` | `00bd131` / (on #69) |
| **U19** · shared/brain safeguard | ⬜ B | B | D16 (A1–A5) | `u19-brain-safeguard-hardening` | `shared/brain/relationships.schema.ts`, `index.ts`; `shared/rules/_assert.ts` | #75 (i#74) |
| **U20** · InsightCard contract | ⬜ B | B | D18 (A6/A7/A20/A26) | `u20-insight-card-catchup` | `shared/types/index.ts`, `index.dart` | #77 (i#76) |
| **U21** · app serve seam | ⬜ J (eng) | A→J | D18 app half; A25/A27 | `u21-relationship-cards-utc-expiry` | `apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart` | #81 (i#80) |
| **U22** · engine lifecycle | ⬜ J (eng) | A→J | D17 (A18/A19) | `u22-snooze-stale-signals` | `supabase/functions/evaluate-signals/lifecycle.ts`, `index.ts`; `generate-insights/index.ts` | #79 (i#78) |
| **U24** · loader hardening | ⬜ J (eng) | A→J | A13/A14 | `u24-loader-hardening` | `tools/edge-loader/`; `tools/rules/load_rules.mjs` | #83 (i#82) |
| **U25** · DB constraint hygiene | ⬜ J (eng) | A→J | D19 (A16/A17) | `u25-db-constraint-hygiene` | `supabase/migrations/` (new additive CHECK migration) | #85 (i#84) |
| **U26** · budget-ledger lifecycle | ⬜ J (eng) | A→J | A10/A11 | `u26-budget-ledger-lifecycle` | `tools/llm-router/src/budget.ts`; `tools/brain-ingest/src/limits/budget.ts` | #87 (i#86) |
| **U27** · CI deno + migrations | ⬜ J (eng) | A→J | A24 | `u27-ci-deno-migrations` | `.github/workflows/ci.yml`; `ci/migrations-bootstrap.sql`; `ci/pg-extension-stubs/` | #89 (i#88) |
| **U28** · nit sweep | ⬜ B (copy-gate) / J | A + B | A8/A9/A21/A22/A23 | `u28-nit-sweep` | `shared/constants/copy_guidelines.{ts,dart}`; `generate-insights/render.ts`, `composer.ts`; 3 handlers | #91 (i#90) |
| **U29** · deno client types | ⬜ J (eng) | A→J | (U27 follow-up) | `u29-deno-client-types` | `supabase/functions/*/index.ts` (`makeClient`); jsr pin | #95 (i#94) |

*(U0 orchestration bootstrap #43 and R1 chain-recovery are bookkeeping, not sign-off units. U14–U17 = stretch, never shipped.)*

## Audit run (one acceptance review)

| Item | Sign-off | Owner | Pointers |
|------|----------|-------|----------|
| A1–A27 findings register (dispositions) | ⬜ B | B | `docs/temp/run1/audit/findings-register.md` + `audit/orchestration-log.md` — 26 fixed via U19–U28; A15→O4; A-D1/2/3 by-design; honesty A1(D16)/A12(B5) are J's |

## Research-fixes run — ⏸ deferred (all statistical)

| Units | Sign-off | Pointers |
|-------|----------|----------|
| F1–F8 (label, cutoff, edge-weights, deadbandK, lag, xDF, impactTier, gates) | ⏸ deferred → **O2** | `docs/temp/run1/research-fixes/` (signoff/config/blocked/findings); session logs `2026071{9,20}…research-fixes-*` |

## Jayden's active queue (Alton out)

Agent lane **U10, U11, U13** → engine **U6, U7, U12** → audit-fix cluster **U18, U21, U22, U24, U25, U26,
U27, U29** → shared/ **U2-cosign, U5, U8, U19, U20, U28** (needs the B8 solo-review waiver) → audit acceptance.
Deferred (not now): F1–F8 + C3/C4/C5/C8 + U1's `deadbandK` value.
