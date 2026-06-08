# Non-diagnostic language is mandatory for all user-facing copy

**Rule (Product Principle #1).** Every user-facing string must use **observational** language. Never
"you may have X" / "condition" / "disease" / "diagnosed" / "treatment"; always "your data shows a
pattern" / "signal" / "observation". biotope **never diagnoses**.

**Why.** It is the product's top non-negotiable principle and a regulatory/safety boundary — a single
diagnostic-sounding string undermines the whole positioning and could imply medical claims.

**How to apply.** The allowed/forbidden word lists live in `shared/constants/copy_guidelines.ts` and
its Dart twin `shared/constants/copy_guidelines.dart` — keep the two in parity. M1 exposes
`validateCopyString(text)` for enforcement; all M5b insight copy and M6 engagement copy must pass it.
Severity labels are `info` / `notice` / `watch` — never "alert" or "warning". This contract crosses
the Dart↔TS seam, so it is guarded by a coupling test (see [[../graph/couplings]]) and falls under the
2-reviewer rule ([[0002-shared-contract-two-reviewers]]).
