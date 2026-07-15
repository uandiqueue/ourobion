---
id: "0002"
title: Shared contract changes need 2 reviewers
summary: Any change to a shared/ contract type crosses the Dart↔TS seam and requires a PR with 2 reviewers; add fields as optional-with-default, never remove/rename without a migration plan.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# Shared contract changes need 2 reviewers

**Rule (from `shared/SHARED-CONTEXT.md`).** The types in `shared/` are the connective tissue every
module boundary crosses (`DailyGutRow`, `DailyPhysioRow`, `DailyEnvRow`, `BaselineSnapshot`,
`InsightCard`, `InsightFiredEvent`, `EngagementState`). **Any change to one of these types requires a
PR with 2 team reviewers**, and breaking changes require notifying all module owners.

**Why.** A silent change to a contract type breaks other people's modules — and potentially production
— because nothing imports across the Dart (app) ↔ TypeScript (backend) seam to catch the drift at
compile time. The two-reviewer gate is the human guard; the TS↔Dart parity guard test is the
executable one (see [../graph/couplings.yaml](../graph/couplings.yaml)).

**How to apply.** Add fields as **optional with a default**; never remove or rename a field without a
migration plan. Keep `shared/types/index.ts` and `shared/types/index.dart` in lockstep. See also
[0003-non-diagnostic-copy](0003-non-diagnostic-copy.md) for the copy-rule contract that crosses the same seam.
