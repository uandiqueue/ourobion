---
title: Run 4 U6 metric-expansion orchestration
summary: Sliced U6 around storage truth, published a fail-closed A4 scaffold and A5 options brief, and recorded the human gates that prevent fabricated metric semantics.
type: session
scope: run4
status: canonical
updated: 2026-07-28
---

# Run 4 U6 metric-expansion orchestration

Issues: #220, #221, #222

Branch: `chore/run4-u6/orchestration`

## Attempted

- Reconciled the 100-metric plan against the current registry, migrations, collectors, S2 view,
  and live integration/PR state.
- Decomposed U6 into A4 storage visibility, A5 daily-log design, EASY self-report batches, and
  MEDIUM collector families under the landing caps and two-reviewer rule.
- Used the restored local Supabase Docker stack for transactional runtime proof; no hosted database
  read/write, deployment, secret change, or provider call was made.

## Changed

- Opened U6a/U6b/U6c coordination issues #220/#221/#222 and maintained
  `docs/temp/run4/u6-progress.md` as the live slice ledger.
- Published A5-0 options brief PR #224 without selecting or implementing a schema.
- Reviewed A4-S0 draft PR #229: optional/null-default `dailyProjection` parity contract, exact-key
  fail-closed SQL generation, overwrite refusal for landed migrations, negative fixtures, and a
  local transaction/rollback harness. No production policy, metric, migration, or collector was
  activated.
- Added the U6 execution rows to `pending-build-register.md` instead of deleting or falsely closing
  A4/A5.

## Decided

- The register's “17 collectible” statement is planning/catalog scope, not current implementation:
  all 19 registered metrics are still homed on `daily_gut_rows` or `wearable_daily`, and zero are
  homed on `events` or `state_bands`.
- A generic event JSON cast/count or state-span expansion would invent scientific/product semantics.
  A4 therefore advances only through a fail-closed per-metric policy seam until Jayden records the
  calendar/reducer/interval decisions and real collectors select policies.
- A5 remains a human storage decision. U6b does not add columns or forms before that decision.
- `shared/metrics/**` PR #229 remains draft and needs actual Jayden + Alton reviews. Agents do not
  merge.

## Left

- Jayden: select the A5 daily-log design and record A4 calendar/reducer/interval/open-band policy on
  #220.
- Humans: review and merge or revise #224; Jayden and Alton must both review #229 before it can land.
- After those gates, split U6b into roughly five-metric form batches (#221) and U6c by real collector
  family (#222). A1/A2/A3, CGM, fake collectors, hosted promotion, and device-unproven work remain
  out of scope.

## Blockers

- A4 production activation is blocked on recorded semantics plus real metric collectors.
- A5 implementation and U6b are blocked on Jayden's recorded storage choice.
- PR #229 is additionally blocked on the two named `shared/` reviews.

memory: none
