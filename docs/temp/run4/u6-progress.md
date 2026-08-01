---
title: R4-U6 progress ledger
summary: Live orchestration ledger for the small-PR delivery of U6a storage primitives, U6b EASY metrics, and U6c MEDIUM collector families.
type: status
scope: run4
status: draft
updated: 2026-07-30
---

# R4-U6 progress ledger

This ledger records coordination state only. It does not authorize merges, hosted writes, deployment,
or work across the release-blocker session's ownership boundary.

## Live baseline

- Integration branch: `dev-phase2-run4`
- Refreshed integration tip at session start: `900459924bb45fcc883a1a4a86858887931bf7cf`
- Current integration tip after the A5 decision-record merge PR #224: `147a67111acda858aad84e3049ce60616b43db8a`
- Exact integration tip for the A4 local-day decision slice: `ea5fc82a8313c478f838d4d110063a405ed46c83`
- Checked-in landing base: `789e6a0ff8232057402e1d34583647349c85bb89`
- Caps: 115 changed paths / 8,500 added lines; unchanged
- Measured integration delta from the accepted landing base: 25 paths / 6,383 additions
- Subunit issues: U6a #220 · U6b #221 · U6c #222
- Release-gate pointer and blocker PRs remain owned by the separate release session.
- Local Supabase migration/runtime verification: Docker restarted; local stack confirmed running.

## Slice ledger

| Slice | Owner | Model | Branch | PR | State | Landing delta | Blockers / next gate |
|---|---|---|---|---|---|---|---|
| A4 inventory | `u6_a4_inventory` | `gpt-5.6-terra` low | — | — | complete, read-only | — | Found zero currently registered `events`/`state_bands` metrics and missing daily aggregation semantics. |
| A4 semantics review | `u6_a4_semantics_review` | `gpt-5.6-sol` medium | — | — | complete, read-only | — | GO for a policy scaffold; production event/state semantics remain decision-gated. |
| A4-D0 · local-day decision record | `run4_220_local_day_adr_writer` | orchestrator-selected | `docs/run4/local-day-projection-220` | pending | local complete; publication pending | docs only | Owner approval recorded on #220; ADR-0004 fixes `local_day_v1`, raw provenance, one exclusive watermark, explicit reducers, half-open non-overlapping bands, and absent quiet days. |
| A4-S0 · projection-policy scaffold | `u6_a4_scaffold_writer` | `gpt-5.6-sol` medium | `feat/m5/u6a-projection-scaffold` | #229 | merged (`04e9b61`) | feature: 10 paths / +745/-12 | Fail-closed UTC scaffold only; it activates no production primitive metric and does not implement ADR-0004 local-day provenance. |
| A4-1 · S1 provenance/constraints | unassigned | at most `gpt-5.6-sol` medium | pending | pending | decision recorded; implementation pending | pending | First forward slice after ADR-0004: raw local-date/timezone provenance, one exclusive watermark, timezone-split bands, and overlap rejection; no shared contract edit. |
| A4-2 · shared/S2 local-day branch | unassigned | at most `gpt-5.6-sol` medium | pending | pending | blocked on A4-1 | pending | Additive `local_day_v1` TS/Dart/schema parity plus reducer/view generation and runtime proof; preserve `utc`, half-open bands, absent quiet days, and fail-closed provenance. |
| A4-3 · registry/parity activation | unassigned | at most `gpt-5.6-sol` medium | pending | pending | blocked on A4-1/A4-2 and collectors | pending | `shared/` change requires Jayden + Alton on the actual PR. |
| A5 inventory / option extraction | `u6_a5_metric_map` | `gpt-5.6-terra` low | — | — | complete, read-only | — | Confirms A5 is structural and full-row upsert safety is a central compatibility constraint. |
| A5-0 · daily-log options brief | `u6_a5_options_writer` | `gpt-5.6-terra` low | `docs/run4-u6a/daily-log-options` | #224 | merged as `147a671` | 2 paths / 220 additions | Records option 1 for U6b: typed nullable `daily_gut_rows` columns; generalized storage remains deferred. |
| U6b · EASY batches | local slice owners | `gpt-5.6-terra` medium | three local branches below | pending | local complete; publication pending | Publish sequentially from the current tip; U6b-3 requires actual Jayden + Alton PR reviews. |
| U6c · MEDIUM families | unassigned | `gpt-5.6-terra` medium | pending | pending | A4-gated | pending | Excludes A1/A2/A3, CGM, device-only/iOS-only work, and fake collectors. |

## Current findings

### U6b status update (2026-07-29)

The planning rows above are superseded by these locally complete slices; none has a hosted PR.

| Slice | Branch / commit | State | Evidence / next gate |
|---|---|---|---|
| U6b-1 wellbeing schema | `feat/m2/u6b-wellbeing-schema` / `cf33a5d` | local complete; publication pending | 3 paths / +283; full Flutter 346 pass, 26 skip; Docker schema PASS. |
| U6b-2 wellbeing collector | `feat/m2/u6b-wellbeing-collector` / `5f2fb30` | local complete; publication pending | 7 paths / +595/-106; full Flutter 354 pass, 26 skip; accessible five-field optional UI; no `shared/` changes. |
| U6b-3 wellbeing promotion | `feat/m5a/u6b-wellbeing-promotion` / `e0019ae` | local complete; publication pending | 14 paths / +923/-24 (201 generated); metric-view 18; focused guards 27; full Flutter 358 pass, 26 skip; Docker schema + projection PASS; prior landing measurement from `2749381`: 69 paths / 5,541 additions. Re-measure from the live base and obtain actual Jayden + Alton PR reviews. |

- **A5/U6b decision:** deliberately defer a new generalized table. `daily_gut_rows` remains the
  authoritative storage surface for the wellbeing slice.
- GitHub authentication is restored and issue truth has been corrected. The three implementation
  branches remain local-only: no U6b implementation PR, review, hosted write, or deployment exists.
- U6c is stopped and remains out of scope.

- The register's “17 collectible” statement is planning/catalog scope, not current registry state:
  the current integration baseline and #229 each have 19 active registry metrics using
  `daily_gut_rows` or `wearable_daily`; the local U6b promotion tip has 24, with five new
  `daily_gut_rows` keys. That local branch evidence is not a hosted or integrated state.
- `events.value` and `state_bands.value` are deliberately heterogeneous JSON. ADR-0004 now records
  the missing policy: explicit per-metric reducers, additive `local_day_v1`, captured raw provenance,
  one exclusive watermark, half-open non-overlapping bands, and absent quiet days. The policy is
  accepted; the S1 schema and shared/S2 implementation slices are not yet built.
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
- #229 and its release evidence have landed. ADR-0004 is documentation only and does not alter that
  scaffold's module graph, registry contract, migration, or deploy attestation.
- Owner approval closes the A4 policy-decision gate only. S1 provenance/constraints, shared/S2
  parity/generation, and a real collector/metric activation remain separate gated slices.
- Each implementation slice targets `dev-phase2-run4`; serialize publication and merge decisions,
  refresh from the live tip, rerun its own tests and landing measurement, and honor required reviews.
