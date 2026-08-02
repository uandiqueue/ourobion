---
id: "0002"
title: Shared contract changes normally need two reviewers
summary: Shared-contract changes normally need two team reviewers; when one is genuinely unavailable, Jayden may explicitly authorize an exception as project lead, with the exception recorded in the issue or PR.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-02
---

# Shared contract changes normally need two reviewers

**Rule (from `shared/SHARED-CONTEXT.md`).** The types in `shared/` are the connective tissue every
module boundary crosses (`DailyGutRow`, `DailyPhysioRow`, `DailyEnvRow`, `BaselineSnapshot`,
`InsightCard`, `InsightFiredEvent`, `EngagementState`). **Any change to one of these types requires a
PR with two team reviewers**, and breaking changes require notifying all module owners.

**Availability exception.** The gate must not make the project dependent on a teammate who is busy,
on leave, or otherwise unavailable. In that situation Jayden, as Project Lead & Systems Architect,
may explicitly authorize the contract change himself. The exception and its reason must be recorded
in the issue or PR; it is not an implied bypass available to an agent or another contributor.

**Why.** A silent change to a contract type breaks other people's modules — and potentially production
— because nothing imports across the Dart (app) ↔ TypeScript (backend) seam to catch the drift at
compile time. Human review or Jayden's explicit exception is the authority guard; TS↔Dart parity and
coupling tests are the executable guards (see [../graph/couplings.yaml](../graph/couplings.yaml)).

**How to apply.** Add fields as **optional with a default**; never remove or rename a field without a
migration plan. Keep `shared/types/index.ts` and `shared/types/index.dart` in lockstep. See also
[0003-non-diagnostic-copy](0003-non-diagnostic-copy.md) for the copy-rule contract that crosses the same seam.
