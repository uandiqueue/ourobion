---
title: U6b wellbeing batch 1 reconciliation
summary: Semantically ported the five optional wellbeing metrics onto the exact Run 4 head with fresh migrations, compatibility guards, collection UI, and generated projection SQL.
type: session
scope: m2
status: canonical
updated: 2026-07-31
---

# U6b wellbeing batch 1 reconciliation

Issue: #221 · branch: `feat/m2/run4-u6b-batch1-reconcile-221` · base:
`3557f75c3565055848c2c2c7427ae680a6a4989d` (`dev-phase2-run4`)

## Attempted

- Recover the intent of local-only commits `cf33a5d`, `5f2fb30`, and `e0019ae` without
  cherry-picking their stale pre-Run-4 ancestry.
- Reconcile only wellbeing batch 1: appetite, feeling anxious, mental clarity, focus, and social
  interaction quality, all optional ordinal 1..5 self-report values.
- Execute the transactional local Postgres fixtures after the code gates. The shared Docker
  namespace had no `supabase_db_ourobion` container and retained a stale
  `supabase_vector_ourobion` name collision, so the CLI could not start a new stack without
  removing another session's container state. No container was removed.

## Changed

- Added five nullable `smallint` columns with named 1..5 checks in fresh ordered migrations
  `20260730020001` and `20260730020002`, both later than the exact base's prior maximum
  `20260730020000`.
- Added authenticated legacy-shape INSERT coverage that omits all five columns and asserts NULL,
  plus an authenticated cross-user INSERT rejection proof in the rollback fixture.
- Added optional-with-null TS/Dart row fields, five registry definitions that do not contribute to
  DQS, exact-head guard-support helpers for explicitly marked additive metric migrations, and
  schema/registry parity guards.
- Added the five optional check-in controls to the existing daily log, whole-row payload wiring,
  wellbeing-only save enablement, 44px labelled semantics, and non-diagnostic copy coverage.
- Pointed the metric-view generator and all related fixtures/guards at the fresh migration, then
  regenerated the view SQL from `shared/metrics/registry.ts`; the SQL was not hand-edited.

## Decided

- This is the five-metric wellbeing batch 1 only; it does not generalize all EASY metrics, alter
  the seven-key DQS, backfill old rows, or change existing RLS policies/grants/triggers.
- The issue-specific owner approval in #221 permits Jayden as the sole human reviewer because
  Alton is unavailable. This narrow exception does not change the default two-reviewer rule and
  the shared-contract PR must not merge without Jayden's actual GitHub approval.
- Historical session logs remain append-only and unchanged. #221 remains open for the later
  wellbeing batches and review/merge evidence.

## Verification

- `node --import tsx --test tests/**/*.test.ts` in `tools/metric-view`: 17 passed.
- Focused Flutter schema/registry/widget/copy suite: 14 passed.
- `flutter analyze --no-pub`: clean after the reconciliation corrections.
- Full `flutter test --no-pub`: 417 passed, 26 skipped by design.
- Metric-view generator write + drift check: generated target written, byte-for-byte check passed.
- `git diff --check`: clean before session-log addition.
- Transactional Postgres fixtures: not executed because the shared local Docker namespace could
  not start without deleting a stale container owned by another session; scripts failed before
  applying SQL because `supabase_db_ourobion` did not exist.

## Left

- CI, Jayden's actual GitHub approval under the documented #221 exception, and merge into
  `dev-phase2-run4`.
- Run both rollback fixtures once an isolated or safely reset local Supabase stack is available.
- Keep #221 open after this batch lands; no later EASY/wellbeing batch is claimed here.

## Blockers

- Local-only database execution is deferred by the shared Docker container-name collision above;
  this does not weaken the checked-in authenticated INSERT/RLS fixture or claim that it passed.

memory: none
