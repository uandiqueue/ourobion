---
title: Run 4 Unit Signoff Index
summary: Candidate unit scope, estimates, dependencies, and human signoff state; none is approved.
type: signoff-index
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Unit Signoff Index

Triplets are low / expected / high. Human signoff is pending for every row.

| Unit | Paths | Added lines | Migration/shared | Tests | Review/dependency | State |
| --- | --- | --- | --- | --- | --- | --- |
| R4-U0 | 12–15 / 17–22 / 25–31 | 550–750 / 950–1,350 / 1,700–2,500 | no migration/shared | 75–150 likely min | release/CI reviewer | LOCKED; BLOCKED: P1 checks unenforced |
| R4-U1 | 6–8 / 9–13 / 14–19 | 300–450 / 600–950 / 1,150–1,800 | no migration/shared | 60–120 likely min | security; only after U0 gate active | LOCKED; BLOCKED: P1 checks unenforced |
| R4-U2 | 28 / 40 / 55 | 1,100 / 1,900 / 3,100 | 2–3 migrations; no shared expected | 25 likely min | security/privacy + RLS; P5/role policy | LOCKED; BLOCKED: P1 checks unenforced |
| R4-U3 | 20 / 31 / 46 | 1,000 / 1,800 / 3,200 | 2–3 migrations; no shared unless provenance promoted | 35 likely min | raw-truth/concurrency + M2/M3; depends U2 | LOCKED; BLOCKED: P1 checks unenforced |
| R4-U4 | 38 / 54 / 74 | 1,600 / 3,000 / 5,000 | 1–2 migrations; definite 5–8 shared paths | 40 likely min | two reviewers | DEFERRED: no available second shared reviewer; no waiver |

All-five union is likely 135–155 paths and 8,250–9,000 lines. Accepted U0–U3 cap is 115/8,500 inclusive of promoted Run 4 docs/tracking. A local fixture-backed paper-to-Biotope slice requires separate sizing and admission only if it fits. A breach returns the unit to pending. No unit is in progress, shipped, or tested.
