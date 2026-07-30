---
title: Run 4 local-day projection architecture decision
summary: Recorded the owner-approved event/state local-day policy as ADR-0004 and reconciled the authoritative S1/S2 and Run 4 documentation without claiming implementation.
type: session
scope: shared
status: canonical
updated: 2026-07-30
---

# Run 4 local-day projection architecture decision

Branch: `docs/run4/local-day-projection-220`

## Attempted

- Started from exact `dev-phase2-run4` tip
  `ea5fc82a8313c478f838d4d110063a405ed46c83` in an isolated worktree.
- Ran the required session-start briefing and read its latest session records plus `docs/INDEX.md`.
- Invoked the existing graphify graph for the S1/S2/local-day documentation relationships. The
  bounded CLI query did not return on this Windows checkout and was terminated after repeated waits;
  used the tracked semantic view plus direct inspection of the routed active docs and merged A4-S0
  contract as the read-only fallback.
- Read issue #220 and confirmed the repository owner's explicit approval of the conservative
  local-day policy before authoring the decision.

## Changed

- Added accepted ADR-0004 with the additive `local_day_v1` calendar while retaining legacy `utc`.
- Reconciled the authoritative insight-engine S1/S2 description and the metrics-registry README.
- Updated the Run 4 U6 ledger and pending-build register to distinguish the accepted decision from
  the still-pending S1, shared/S2, and metric/collector implementation slices.
- Regenerated `docs/INDEX.md` and `docs/shared/decisions/README.md` with
  `context_sync.mjs --fix-index`.

## Decided

- Raw capture owns absolute timestamps plus captured local-date/timezone provenance; current profile
  timezone never rewrites history.
- A timezone change splits an active state into adjacent half-open segments.
- One consistent projection snapshot uses one exclusive S1 watermark across every branch.
- Every metric selects a closed-set reducer explicitly; state overlaps are rejected with no priority
  rule; primitive quiet days are absent rather than fabricated zeroes.
- This documentation PR records architecture only. It does not add schema fields, shared enum values,
  SQL generation, collectors, production metric registrations, hosted writes, or deployments.

## Verification actually run

- `node tools/context_sync.mjs --fix-index` — regenerated the required indexes.
- Exact-parent assertion — PASS (`ea5fc82a8313c478f838d4d110063a405ed46c83`).
- Policy-marker assertion for `utc`, `local_day_v1`, provenance, timezone split, exclusive watermark,
  half-open intervals, overlap rejection, explicit reducer, and absent quiet days — PASS.
- Existing accepted ADR scope assertion (0001–0003 untouched) — PASS.
- Generated index-link assertions — PASS.
- `git diff --check` — PASS.
- `node tools/context_sync.mjs --check` — PASS.

## Left

- Issue #220 remains open. Next is the forward-only S1 provenance/constraint slice, followed by the
  shared/S2 `local_day_v1` parity/generator slice, then a real collector/metric activation with full
  database, product, and device evidence.
- `utc` remains supported; no existing rows or fixtures are silently reinterpreted or backfilled.

## Blockers

- None. The graphify query latency affected only semantic navigation and did not block the direct,
  source-grounded documentation review.

memory: none
