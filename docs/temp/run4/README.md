---
title: Run 4 — planning cockpit
summary: Entry point for Run 4, a product build run with the full local test suite available (real Android device plus live local nao) and no model training in scope. Absorbs Run 3's unbuilt O24-O29, frames eight candidate units against six priorities, and records the preconditions that must be settled before locking.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 — planning cockpit

Run 4 has **not** started and its scope is **not locked**.

## Documents

| Document | Role |
|---|---|
| [`next-build-optimizations.md`](./next-build-optimizations.md) | **Scope authority** — the eight candidate units, preconditions, sequencing, sizing warning |
| [`pending-build-register.md`](./pending-build-register.md) | **Gap superset** — every open item, sections A–J, original IDs preserved |
| [`run3-audit-findings.md`](./run3-audit-findings.md) | The independent audit that produced findings A1–A21 and preconditions P1–P6 |

## What makes Run 4 different

**The full local test suite is finally available.** A real Android device exists and local nao runs
live. That is the defining change: work which was previously unverifiable can now actually be
exercised — TalkBack accessibility traversal, the nao `/login` click-path, seeded run-now behaviour,
real-device wearable datatypes. Several register rows move from *blocked* to *doable* on that basis
alone.

**No model training.** It lives in [`../model-training/`](../model-training/) with its own units,
budget and gates. Run 4 may consume a frozen artifact from it but never waits on it.

**Run 4 absorbs Run 3.** O24–O29 were never built; `dev-phase2-run3` carries only planning docs and the
model-training substrate. Run 3's unbuilt items fold in here rather than competing for the same branch.
Mark Run 3 superseded when Run 4 locks.

## The six priorities

1. **Auth split** — biotope dev vs user; dev reaches nao; nao shows ingestion + biotope data so the UI
   populates for dev testing → **U0**
2. **Pending Run-3 optimisations** → **U1, U2, U4, U5**
3. **Full single-paper ingestion, no empty checkpoints**, custom models stood in for by a cheap
   lightweight OpenAI model → **U3**, closing register section C
4. **biotope metrics, EASY + MEDIUM** (~50) → **U6**
5. **biotope UX revamp** → **U7**
6. **As much of the register as fits** → **U8**

## Four things to decide before locking

1. **Turn on required status checks** (P1). Every working branch is `protected: false` with no
   `required_status_checks`, so CI is advisory and a red PR can merge. Minutes to fix, and it is the
   cheapest risk reduction available anywhere in this plan.
2. **Resolve the `shared/` two-reviewer gate** (P2). Run 4 changes `shared/` in at least three units —
   auth roles, the metrics registry, provenance fields. Unresolved, it blocks over half the run.
3. **Settle the provider posture** (P6). `testMode` is ON with all six nodes on OpenAI because only one
   key is provisioned, so U3's stand-in run and O29's decorrelation invariant cannot both be satisfied.
   Recommended: U3 proves pipeline completeness only.
4. **Derive real caps** (P4). See the sizing warning below.

## Two dependencies that are easy to miss

**Priority 4 is not a metric-authoring unit.** EASY metrics need `register A5` (generalise `daily_log`)
and MEDIUM metrics need `register A4` (extend `metric_daily_values`). Both are structural schema work
owned by `B-PL6`/O5. Sizing U6 without them under-scopes it by the entire storage-primitive workstream —
hence the recommended U6a/U6b/U6c split.

**Priority 3's stand-ins are LLM calls, not models.** They reduce no tokens and prove no model works.
Their only job is that the pipeline has no empty checkpoints on one real paper, and every output must
say so via an `INTERIM:` provenance marker.

## Sizing warning

This is **larger than Run 3, whose scope was already 1.7–2.1× over its file cap**. Eight units, three
substantially greenfield, plus a UX revamp — plausibly **150–250 changed files** on Run-3 calibration.

Either derive caps from unit estimates before locking, or sequence explicitly and accept that later
units roll into Run 5. Recommended order:

**U0 → U3 → U1 → U6a → U6b → U5 → U4 → U7 → U6c → U8**

U0 first, because dev access is what makes everything else testable. U3 early, because a complete
pipeline on one real paper is the highest-value demonstrable outcome and is nearly independent of the
rest.

Do not treat this folder as authorising work. Lock a subset first.
