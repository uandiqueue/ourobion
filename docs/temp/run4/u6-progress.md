---
title: R4-U6 progress ledger
summary: Live orchestration ledger for the small-PR delivery of U6a storage primitives, U6b EASY metrics, and U6c MEDIUM collector families.
type: status
scope: run4
status: draft
updated: 2026-07-28
---

# R4-U6 progress ledger

This ledger records coordination state only. It does not authorize merges, hosted writes, deployment,
or work across the release-blocker session's ownership boundary.

## Live baseline

- Integration branch: `dev-phase2-run4`
- Refreshed integration tip at session start: `900459924bb45fcc883a1a4a86858887931bf7cf`
- Current integration tip after U2 corrections PR #214: `da6b11b5df057fe6b5f5f6dcb14f13343805a94b`
- Checked-in landing base: `2749381a405de882c6d96cdf21a57034e28204ea`
- Caps: 115 changed paths / 8,500 added lines; unchanged
- Measured integration delta from the accepted landing base: 41 paths / 2,878 additions
- Subunit issues: U6a #220 · U6b #221 · U6c #222
- Release-gate pointer and blocker PRs remain owned by the separate release session.
- Local Supabase migration/runtime verification: Docker restarted; local stack confirmed running.

## Slice ledger

| Slice | Owner | Model | Branch | PR | State | Landing delta | Blockers / next gate |
|---|---|---|---|---|---|---|---|
| A4 inventory | `u6_a4_inventory` | `gpt-5.6-terra` low | — | — | complete, read-only | — | Found zero currently registered `events`/`state_bands` metrics and missing daily aggregation semantics. |
| A4 semantics review | `u6_a4_semantics_review` | `gpt-5.6-sol` medium | — | — | complete, read-only | — | GO for a policy scaffold; production event/state semantics remain decision-gated. |
| A4-S0 · projection-policy scaffold | `u6_a4_scaffold_writer` | `gpt-5.6-sol` medium | `feat/m5/u6a-projection-scaffold` | #229 | draft; all non-release CI green; release evidence blocked | feature: 10 paths / +745/-12; landing: 51 paths / 3,623 additions | `shared/metrics/registry.ts` changes the `compute-baselines` module graph, so the frozen deploy attestation must be re-recorded by the separate release owner. Jayden + Alton reviews also remain required. |
| A4-1 · events day-series branch | unassigned | at most `gpt-5.6-sol` medium | pending | pending | policy-gated | pending | JSON payload/count aggregation and calendar policy must be recorded. |
| A4-2 · state-bands day-series branch | unassigned | at most `gpt-5.6-sol` medium | pending | pending | blocked on semantics review | pending | Day boundaries, open bands, overlaps, and stacking order must be explicit. |
| A4-3 · registry/parity activation | unassigned | at most `gpt-5.6-sol` medium | pending | pending | blocked on A4-1/A4-2 and collectors | pending | `shared/` change requires Jayden + Alton on the actual PR. |
| A5 inventory / option extraction | `u6_a5_metric_map` | `gpt-5.6-terra` low | — | — | complete, read-only | — | Confirms A5 is structural and full-row upsert safety is a central compatibility constraint. |
| A5-0 · daily-log options brief | `u6_a5_options_writer` | `gpt-5.6-terra` low | `docs/run4-u6a/daily-log-options` | #224 | open; refreshed to `da6b11`; CI rerun | 2 paths / 207 additions | Documentation only; implementation waits for Jayden's recorded decision. |
| U6b · EASY batches | unassigned | `gpt-5.6-terra` medium | pending | pending | decision-gated | pending | No work before A5 decision; batches target about five metrics and one form section. |
| U6c · MEDIUM families | unassigned | `gpt-5.6-terra` medium | pending | pending | A4-gated | pending | Excludes A1/A2/A3, CGM, device-only/iOS-only work, and fake collectors. |

## Current findings

### U6b status update (2026-07-28)

The planning rows above are superseded by these locally complete slices; none has a hosted PR.

| Slice | Branch / commit | State | Evidence / next gate |
|---|---|---|---|
| U6b-1 wellbeing schema | `feat/m2/u6b-wellbeing-schema` / `cf33a5d` | local complete; auth-blocked | 3 paths / +283; full Flutter 346 pass, 26 skip; Docker schema PASS. |
| U6b-2 wellbeing collector | `feat/m2/u6b-wellbeing-collector` / `5f2fb30` | local complete; auth-blocked | 7 paths / +595/-106; full Flutter 354 pass, 26 skip; accessible five-field optional UI; no `shared/` changes. |
| U6b-3 wellbeing promotion | `feat/m5a/u6b-wellbeing-promotion` / `e0019ae` | local complete; auth-blocked | 14 paths / +923/-24 (201 generated); metric-view 18; focused guards 27; full Flutter 358 pass, 26 skip; Docker schema + projection PASS; landing from `2749381`: 69 paths / 5,541 additions. Actual Jayden + Alton PR reviews required. |

- **A5/U6b decision:** deliberately defer a new generalized table. `daily_gut_rows` remains the
  authoritative storage surface for the wellbeing slice.
- No PRs, pushes, or issue comments were made: the GitHub token is invalid and escalation was
  rejected. Legitimate reauthentication is required before hosted actions can resume.
- U6c is stopped and remains out of scope.

- The register's “17 collectible” statement is planning/catalog scope, not current registry state:
  the current integration baseline and #229 each have 19 active registry metrics using
  `daily_gut_rows` or `wearable_daily`; the local U6b promotion tip has 24, with five new
  `daily_gut_rows` keys. That local branch evidence is not a hosted or integrated state.
- `events.value` and `state_bands.value` are deliberately heterogeneous JSON. The repository has not
  yet recorded how those rows become numeric daily points, so a generic cast would be fail-open.
- The current view generator targets an already-landed migration and hard-fails unhandled active
  numeric/ordinal tables. The scaffold now refuses to overwrite that migration; a later production
  activation must use a new forward-only migration and leave landed migrations untouched.
- A5 cannot be reduced to adding columns casually: the current screen's safe behavior depends on a
  full-row reload/upsert path, while its partial patch path is restricted to the seven T1 DQS keys.

## Human gates

- Jayden's A5 choice is now recorded for U6b: retain `daily_gut_rows` as authoritative and defer a
  generalized table.
- Jayden and Alton must each provide actual PR reviews for U6b-3; chat approval is not a substitute.

- Jayden and Alton must both review every actual PR that changes `shared/metrics/**`.
- The separate release owner must re-record #229's `compute-baselines` deployment graph attestation;
  #229 remains that separate owner's blocker, and its release files are untouched here.
- Agents do not merge. Each implementation slice targets `dev-phase2-run4` and remains for human
  review after its own tests and landing measurement.
