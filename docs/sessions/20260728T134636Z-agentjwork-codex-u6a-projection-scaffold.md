---
title: U6a primitive daily-projection scaffold
summary: Added an explicit fail-closed registry policy and pure SQL generator scaffold for event and state-band daily projections, without selecting a production policy or changing the landed view migration.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# U6a primitive daily-projection scaffold

Issue: #220

Branch: `feat/m5/u6a-projection-scaffold`

## Attempted

- Defined the registry contract needed before any primitive-homed metric can enter the S2 daily
  projection.
- Proved synthetic event and state policies against the running local Supabase Postgres stack.

## Changed

- Added optional, null-default `dailyProjection` metadata to the TypeScript schema/contract and its
  Dart mirror, with exact parity guards for storage, UTC calendar, existing S2 source tags, reducers,
  and half-open state intervals.
- Made `generateViewSql` accept an injected registry while preserving byte-identical no-argument
  production output. Primitive branches are exact-key and fail closed on missing/incompatible policy,
  reducer/type mismatches, unsafe keys, malformed/non-finite payload shapes, and deprecated metrics.
- Added event count/sum/mean/latest SQL and overlap-collapsed state presence expansion. Latest orders
  by `occurred_at desc, id desc`; state bands use `[started_at, ended_at)` in UTC and open bands stop
  at the current UTC day.
- Made `--write` refuse to overwrite an existing migration. A future production SQL change must first
  point `VIEW_MIGRATION_RELPATH` at a new timestamped, nonexistent migration.
- Added unit/negative coverage plus a reusable local Docker fixture that rolls back all view, row,
  and auth-user changes.

## Decided

- No production metric selects a policy in this unit: all 19 existing metrics retain absent/null
  metadata and the landed `20260715154000` migration remains byte-identical.
- Event `count` ignores payload; payload reducers admit safe numeric JSON only and omit malformed-only
  days rather than emitting null. Count/sum require numeric metrics; mean/latest allow numeric or
  ordinal; state presence requires numeric.
- Projection source is explicit and restricted to the existing S2 vocabulary
  (`self_report|wearable|env|signal`), never inferred from storage or source economy.

## Left

- Selecting policies for actual primitive-homed production metrics and emitting a new forward-only
  migration belongs to the later metric-landing unit.
- The shared-contract PR requires Jayden and Alton reviews.

## Blockers

- None.

memory: none
