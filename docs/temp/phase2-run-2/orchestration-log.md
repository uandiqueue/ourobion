---
title: Phase-2 Run 2.0 — Orchestration Log (SINGLE SOURCE OF TRUTH)
summary: Resumable tracking doc for Run 2.0 (demo-test MVP, backend + frontend). Worklist, per-unit status, ledger, and the ▶ RESUME pointer. A fresh session resumes from THIS doc alone — read top-to-bottom, then continue at ▶ RESUME. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Phase-2 Run 2.0 — Orchestration Log

**Launch prompt:** `docs/temp/phase2-run-2-orchestrator-prompt.md` (committed on this branch).
**Backlog consumed:** `docs/temp/next-build-optimizations.md` (Run-2.0 version, committed on this branch —
NOT the dev-phase2 copy, which predates O9–O20 + the demo target).
**Goal:** working demo-test MVP — main loop 1–5 + features a–d (PART 1 of the launch prompt) on a
simplified (existing-convention) UI. Definition of done = scripted e2e dry-run passes + demo runbook
reproduces from a clean local stack.

## Run invariants (from the launch prompt — binding)

- Branch prefix `feat/phase2-run-2/*`; stacked PR chain off `origin/dev-phase2` @ e185cf0; NEVER merge.
- Run worktree: `C:\project\ourobion-run2` (main checkout is in use on signoff/phase2). If gone, recreate
  off the current chain tip.
- One unit at a time; tracking docs committed BEFORE starting a unit and after finishing it.
- OpenAI-only LLM posture (TEST-MODE decorrelation override; see decisions-signoff.md D2); budget
  ≤ 20 SGD TOTAL OpenAI spend — ledger below tracks it; stop at a unit boundary well short of the cap.
- Orchestrator never edits code; exactly ONE writer subagent at a time; read-only agents fan out freely.
- YOU NEVER SELF-SIGN-OFF — unit-signoff-index.md rows stay `pending` for Jayden.

## ▶ RESUME

**Current state:** U0 (bootstrap) `in-progress` — tracking docs created; assessment agents running;
supabase stack starting. Worklist below is DRAFT until assessment synthesis lands (next commit).
**Next action:** finish U0 (commit + push + PR), then write the final worklist from assessment results,
then start U1.

## Worklist (DRAFT — pending assessment synthesis)

Status: `queued` / `in-progress` / `done`. Sequencing spine: backend path before consuming UI; O16
before any card demo; O15 before feature b. Unit boundaries will be finalized after the 4 assessment
agents report; the O-item → unit mapping below is the planning skeleton.

| Unit | Working title | O-items | Status |
|------|---------------|---------|--------|
| U0 | Run bootstrap: worktree, input docs, tracking docs, PR | — | in-progress |
| U1 | Local stack + fixtures + test-mode wiring (supabase env, OpenAI-only router TEST-MODE flag, fixture corpus) | O15-prereq, PART 3 | queued |
| U2 | Orientation-aware cards (wrong-metric fix) + research-context gap-only | O16, O18 | queued |
| U3 | Servable-band quote-check invariant (shared/, B8 flag) + derivation copy-gate | O17, O20 | queued |
| U4 | Verifier grounding: evidence-bearing citations + fixture retrieval in CLI verify | O15 | queued |
| U5 | Simulated health-data loader: backend write path + nao UI (incremental by-day) | O11 | queued |
| U6 | Serve-pipeline on-demand trigger + provenance read + baseline prune | O12, O19 | queued |
| U7 | biotope: trend/graph view + insight cards + provenance ("how generated") view | O12 (app side) | queued |
| U8 | Model-config read boundary + editable caps + spend-vs-budget nao panel | O10 (feature a) | queued |
| U9 | Claims curation + human REJECT override (supersedes verifier for serving) | O13 (feature b) | queued |
| U10 | Seeds-as-data + nao seed-load UI | O14 (feature c) | queued |
| U11 | Gap detection + ledger + nao surfacing during ingestion | O9 slice (feature d) | queued |
| U12 | E2E demo dry-run (main loop 1–5 + a–d) + demo runbook | DoD (v)+(vi) | queued |

## Ledger

| # | Unit | Branch | PR | Gate | OpenAI spend (SGD) | Cumulative spend | Notes |
|---|------|--------|----|------|--------------------|------------------|-------|
| — | — | — | — | — | 0.00 | 0.00 | run started 2026-07-24; no LLM calls yet |

## Budget

- Cap: **20 SGD** total OpenAI. Spent: **0.00 SGD**.
- Policy: fixtures/offline first; live calls only for the essential e2e proofs (mandatory acceptance
  test (iv) + the U12 dry-run; small calibration calls if a unit's integration test truly needs one).
- Router C7 caps set low in U1 (value recorded as a C-entry when set).

## Assessment (baseline) — pending

4 read-only Explore agents dispatched 2026-07-24 (engine/serve, brain/verifier/router, nao, biotope).
Synthesis lands here in the next commit; worklist finalized from it.
