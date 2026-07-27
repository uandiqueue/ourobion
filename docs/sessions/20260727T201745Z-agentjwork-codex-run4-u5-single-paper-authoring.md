---
title: "Run 4 U5 — local single-paper authoring evidence"
summary: "Local-only U5 execution recorded through M1; M2 remains blocked by the separately owned U2 edge-runtime mount."
type: session
scope: run4-u5
status: canonical
updated: 2026-07-28
---

# Run 4 U5 — local single-paper authoring

Issue: #167
Branch/worktree: `feat/brain/run4-u5-single-paper-authoring` in `C:\project\ourobion-run4-u5-167`
Base: `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`

## Attempted

- Ran the local-only U5 canonical real-paper path for DOI `10.1016/j.isci.2026.116224`, including exact DOI and quote checks, canonical-ID/artifact/DB binding repairs, and the frozen demo-edge path.
- Exercised the local harness after hardening its ANSI reset-success check, inherited Nao public Supabase environment, and fail-closed API redirect handling.
- Kept all work local: no provider or hosted calls, `/model-training`, shared-contract, UI, or merge work.

## Changed

- Canonical DB run `d3c2020a` records one U5 edge as `uncertain` / `hold`, with zero servable edges.
- Latest harness pass reached S0–S8 and M1: 5 claims / 4 verified edges and 14 simulated provenance-stamped gut rows plus 14 wearable rows for the demo user.
- The focused checks were green: 364/364, 61/61, TypeScript typecheck, PowerShell parser validation, and context checks (session coverage was previously skipped where no new session log existed).
- Run 4 docs retain the cap/U1 disposition and record that Alton and Jayden unblock U4 implementation, while both actual shared-contract PR reviews and separate cap admission remain required.

## Decided

- M2's `401` is not a U5 code failure: the active local edge-runtime is mounted from the separately owned U2 worktree and enforces U2 internal auth before the U5/base route. Compared local service-role keys agree.
- M2 wrote zero baseline snapshots, signals, insight cards, or composed insights; no scientific validation or full health/insight acceptance is claimed.

## Left

- Re-run the downstream full pipeline only after stable U2 reconciliation, then obtain health/insight evidence.
- Prepare the draft PR and CI evidence after the local blocker and applicable unit/cap conditions are resolved; merge remains later work.

## Blockers

- The U2-owned active edge-runtime mount is the current execution blocker; do not restart or rebind it from this unit.
- U4 implementation is unblocked, but its cap review/admission and the two actual shared-contract PR reviews remain mandatory; this does not authorize U6.

memory: none
