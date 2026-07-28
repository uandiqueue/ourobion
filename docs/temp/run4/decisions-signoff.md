---
title: Run 4 Decisions and Signoff
summary: Current acceptance register for Run 4 integration, unit reconciliation, reviewers, provider posture, local exit gates, and cloud stop boundary.
type: decision-register
scope: run4
status: draft
updated: 2026-07-28
---

# Run 4 Decisions and Signoff

| ID | Decision | State / evidence still required |
|---|---|---|
| BRANCH | `dev-phase2-run4` is the only integration target; never `dev-phase2` or `main` | accepted |
| AUTONOMY | Local work and green, independently reviewed merges into `dev-phase2-run4` may proceed without repeated approval | accepted; red/duplicate/stale PRs remain prohibited |
| P1 | Branch may remain unprotected; `Run 4 Gate` is required exact-head evidence, not branch protection | accepted override |
| CAP | Locked core units use 115 paths / 8,500 additions from exact per-unit base | accepted; checked-in base drift must be reconciled before next landing |
| UI CAP | Do not trim canonical full UI merely to fit the original product-unit cap | accepted unit exception; machine envelope/gate still needs explicit reconciliation, never silent bypass |
| P2 | Jayden + Alton are named reviewers for Run 4 shared changes | satisfied; actual PR reviews required |
| P3 | No model training or serving in Run 4 | accepted; historical bundles remain separate/non-serving |
| P5 | Local-only; physical Android and disposable local Supabase reset authorized | accepted |
| P6 | General O29 remains deferred | accepted; bounded issue-189 provider test is complete, not a general unblock |
| U0 | PR #161 merged; base convention #172 merged | delivery merged; status/gate-base reconciliation current session |
| U1 | #180 remediates #170 | one canonical green reconciled PR required; do not land #170 alone |
| U2 | #177 merged; #185/#186 corrections open | combine, rerun 443 auth assertions and current gate |
| U3 | #184 built/open | reconcile unit base, LoaderPanel target, full HTTP 14 + 7-day walk, then current green gate |
| U4 | Scientific semantics/trust | startable after reconciliation; two reviewers; no accepted implementation yet |
| U5 | #176 built/open; #190 evidence stacked | rebase after U3/U4; preserve B-PL22 and one-paper hold honesty |
| U7/UI | #191 is canonical and contains #175 | land only reconciled #191 after shared/U2/Flutter/device evidence |
| EXIT | Both local passes plus final full suite before cloud consideration | pending |
| CLOUD | Hosted writes/deploy/promotion remain outside authorization | stopped by design |

## Historical provenance

The original envelope/bootstrap SHA remains
`854aa471970b61afdc59205ded0b1c8a9ab3f270`. Earlier U0 bases
`837b7e690f92dc1669428a2476c9d8d0456020e8` and
`77c98213e23ad56ae37c86201b39ef4e7543a543` remain historical evidence. PR #172 advanced the
machine base to `c558c04f1b661a59c8987c96770768eeea46e0cc`; integration later advanced through U2 merge
`ad8ef178053c7e6514283f19ee7a4f3f0829dc0c`. Do not call any historical base the active next-unit
base without checking the current machine files and integration tip.

## Signoff rule

`merged` is delivery state, not final signoff. `done` requires current integration ancestry, required
checks on the actual head, independent review, applicable human reviews, executed acceptance evidence,
and reconciled tracking. The authoritative working disposition is
[`continuation-status.md`](./continuation-status.md).
