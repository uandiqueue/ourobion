---
id: "0003"
title: Non-diagnostic language is mandatory for all user-facing copy
summary: User-facing copy remains observational and non-diagnostic while exposing evidence strength, uncertainty, disagreement, and provenance so users can judge the evidence chain rather than receiving a hidden or inflated conclusion.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-03
---

# Non-diagnostic language is mandatory for all user-facing copy

**Rule (Product Principle #1).** Every user-facing string must use **observational** language. Never
"you may have X" / "condition" / "disease" / "diagnosed" / "treatment"; always "your data shows a
pattern" / "signal" / "observation". ourobion **never diagnoses**.

**Why.** It is the product's top non-negotiable principle and a regulatory/safety boundary — a single
diagnostic-sounding string undermines the whole positioning and could imply medical claims.

**Non-diagnostic does not mean withholding weak evidence.** Ourobion surfaces the evidence chain,
including low confidence, missing corroboration, conflicting findings, narrow populations, and other
caveats. The system must not silently discard an observation merely because it is uncertain, nor
upgrade uncertainty into advice. It shows what was observed, why the system thinks it may matter, and
what remains unproven so the user can make their own judgement.

**How to apply.** The allowed/forbidden word lists live in `shared/constants/copy_guidelines.ts` and
its Dart twin `shared/constants/copy_guidelines.dart` — keep the two in parity. M1 exposes
`validateCopyString(text)` for enforcement; all M5b insight copy and M6 engagement copy must pass it.
Severity labels are `info` / `notice` / `watch` — never "alert" or "warning". This contract crosses
the Dart↔TS seam, so it is guarded by a coupling test (see [../graph/couplings.yaml](../graph/couplings.yaml)) and falls under the
2-reviewer rule ([0002-shared-contract-two-reviewers](0002-shared-contract-two-reviewers.md)).
