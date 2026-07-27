---
title: Run 4 — scope authority and candidate units
summary: Run 4 is a product build run with the full local test suite available (real Android device plus live local nao) and no model training in scope. Frames eight candidate units against Jayden's six priorities, absorbs Run 3's unbuilt O24-O29, and records the preconditions and structural dependencies that must be settled before any unit is locked.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 — scope authority and candidate units

**Candidate scope. Nothing is locked.** Run 4 begins when Jayden locks a subset and accepts a cap
baseline.

## What Run 4 is

A **product build run**, distinguished from every previous run by one thing: **the full local test suite
is finally available.** A real Android device exists for on-device testing, and local nao runs live.
Work that was previously unverifiable — accessibility traversal, the nao login click-path, seeded
run-now behaviour, real-device wearable datatypes — can now actually be exercised.

**Model training is out of scope entirely.** It lives in [`../model-training/`](../model-training/)
with its own units, budget and gates. Run 4 may *consume* a frozen artifact from that workstream but
never waits on it. The Zebra build log moved out of this folder accordingly.

**Run 4 absorbs Run 3.** O24–O29 were never built — `dev-phase2-run3` carries only planning docs and
the model-training substrate. Rather than run two tranches against one branch, Run 3's unbuilt items
fold in here as U1/U2/U4/U5. **Run 3 should be marked superseded** when Run 4 locks.

## Jayden's six priorities → units

| # | Priority | Unit |
|---|---|---|
| 1 | Auth split: dev vs user; dev reaches nao; nao shows ingestion + biotope data | **U0** |
| 2 | All pending Run-3 optimisations | **U1, U2, U4, U5** |
| 3 | Full single-paper ingestion, no empty checkpoints, LLM stand-ins for custom models | **U3** |
| 4 | biotope metrics inclusion — EASY + MEDIUM | **U6** |
| 5 | biotope UX revamp | **U7** |
| 6 | As much of the register as fits | **U8** |

## Preconditions — settle before locking

| ID | What | Why it blocks |
|---|---|---|
| **P1** | **Turn on required status checks** on `dev-phase2-run3` and its successor | Audit A1: every working branch is `protected: false` with no `required_status_checks`. CI is advisory, so "green" gates nothing. Minutes to fix, and the cheapest risk reduction available |
| **P2** | **Resolve B8** — a second `shared/` reviewer, or a recorded solo-review waiver | Run 4 changes `shared/` in **at least three units**: auth roles (U0), the metrics registry (U6), provenance fields (U4). Unresolved, it blocks over half the run |
| **P4** | State one cap-baseline rule and derive Run 4's caps | Audit A3: Run 3's baseline was silently consumed by an out-of-scope merge. Do not inherit an ambiguous rule |
| **P6** | Decide the provider posture | U3 and O29 pull in opposite directions — see the conflict under U3 |
| **P7** | *(new)* Give model-training its own integration base | Five model PRs still point at the product branch and will repeat the Run-3 collision |

## Candidate units

### U0 · Auth: dev/user split, nao RBAC, key rotation — *priority 1*
Absorbs `B-SEC1`, `B-SEC2` and Run 3's **O25**, which is the same surface.

Separate biotope auth into **dev** and **user**; a dev identity reaches nao; nao surfaces ingestion
state **and** biotope data so the UI populates for dev testing. Revoke the legacy `service_role` Bearer
path and rotate to named server keys.

Greenfield warning: `nao_members` and `app_metadata.nao_role` do not exist, `middleware.ts` currently
reads *"v1: any authenticated user passes"*, and **zero** RLS policies across 23 migrations reference
viewer/curator/admin. Keep O25's strong acceptance criterion — a negative matrix across roles ×
surfaces, where *a UI hide/show test alone does not pass*. Touches `shared/` → **P2**.

### U1 · CI and release gate — *Run-3 O24 carryover*
Rework rather than merge PR #144. The audit found the gate **fails open**: the SHA assertion has no
reachable failure path, the Deno coverage guard silently drops TOML-legal `[functions.x] # comment` and
`[functions."x"]` declarations, and it cannot distinguish a live `deno-check` from an `if: false` one.
Pair with **P1**, without which none of it is enforced.

### U2 · Raw-truth-safe demo loading and retry-safe pipeline — *O26*
`B-DATA1`, `B-DATA2`. `pipeline_runs` does not exist; single-flight, watermark and idempotency-key are
all greenfield. Its nine enumerated test scenarios make it the best-specified carryover.

### U3 · Single-paper end-to-end ingestion with LLM stand-ins — *priority 3*
Closes register **section C**. One real paper, start to finish, with **no empty checkpoints**: each
planned custom-model slot filled by a cheap lightweight OpenAI call, or by the deterministic path where
one already exists (`impactTier` is already OpenAlex + SJR and needs nothing).

Every stand-in output carries an `INTERIM:` provenance marker. **A stand-in is an LLM call, not a
custom model** — it reduces no tokens and proves no model works. Its single job is to show the pipeline
completes end to end on real input.

> **Conflict to settle (P6).** `router.config.json` runs `testMode` ON with all six nodes on OpenAI,
> because only `OPENAI_API_KEY` is provisioned — the synthesis↔verifier decorrelation invariant is
> deliberately off. U3 therefore **cannot** simultaneously satisfy `B-BR1`/`B-BR2`. Recommended: accept
> that U3 proves *pipeline completeness only*, and leave decorrelation to O29. If a second family is
> wanted cheaply, GMI serverless inference is OpenAI-compatible and is **not** behind the container
> entitlement that is currently delayed.

### U4 · Scientific provenance semantics — *O27*
`B-UI3`, `B-UI9`, `B-SCI1`, and the safe-vocabulary half of `B-SCI2`; the calibration half is blocked
on `B-PL3`/O2 and stays out. Removes the global TEST-MODE notice, which must be sequenced against U3
since `testMode` is still ON. Touches `shared/` → **P2**. Also resolve
`decisions/0003-paper-reliability.md`, which says `accepted` in front-matter and *"Status: Proposed"* in
its body while accepted ADR bodies are frozen — supersede it, since U4 renders user-facing copy off its
semantics.

### U5 · Accessible client insight/provenance UI — *O28*
`B-UI10`, `B-UI11`. **Materially de-risked** — the manual TalkBack traversal that previously had no
owner is now possible on the real device.

Still true: `apps/biotope` has **zero** golden tests and no `flutter_test_config.dart`, so
Windows-authored goldens will not byte-match `ubuntu-latest`. Either scope the comparator and font
loader explicitly, or use widget + semantics assertions instead. Goldens were the largest single driver
of Run 3's projected file-count overrun — each image is a countable changed file.

### U6 · biotope metrics — EASY + MEDIUM — *priority 4*
~15 EASY + ~35 MEDIUM ≈ **50 metrics**.

> **This is not a metric-authoring unit.** It is blocked on two structural gaps: **`register A5`**
> (generalise `daily_log`, or every EASY metric keeps riding the gut table) and **`register A4`**
> (extend `metric_daily_values`, or events/state_bands stay dashboard-invisible). Both belong to
> `B-PL6`/O5. Sizing U6 without them under-scopes it by the entire storage-primitive workstream.
> Touches `shared/metrics` → **P2**.

Recommend splitting: **U6a** storage primitives (`A4`+`A5`), **U6b** EASY, **U6c** MEDIUM.

### U7 · biotope UX revamp — *priority 5*
`B-UI1`, the porcelain-luxury re-skin, excluded from Runs 2 and 3 as needing human supervision — now
viable with a device in hand. `B-UI2` formal user testing also becomes possible, though it needs a
protocol, not just hardware. Sequence **after** U5 so accessibility work is not redone.

### U8 · Register sweep — *priority 6*
Cheap, high-value rows now that the device and live nao exist: `B-UI5` (login click-path), `B-UI6`
(run-now seeds), `B-PL8` (`shared/brain` typecheck target), `B-R1-4` (register hygiene), and the
unowned `B-BR10` (`contradiction` → `needsReview()`). Strong audit candidates too: **O31** mechanical
cap enforcement in CI, **O35** import-boundary linting, **O36** secret scanning.

## Explicitly out of scope

- **All model training** — separate workstream.
- `register A1`/`A2`/`A3` and the CHALLENGING metric bucket; `B-PL3`/O2 and everything blocked on it
  (`B-R1-3`, the `B-SCI2` calibration half); `B-COST1`; `B-UI7` production/OpenNext deployment;
  `B-PL9` iOS; CGM hardware.
- Any claim of production readiness or scientific validation.

## Honest sizing warning

**This is a larger run than Run 3, and Run 3's scope was already 1.7–2.1× over its file cap.** Eight
units, three of them substantially greenfield (U0, U2, U6), plus a UX revamp. On Run-3 calibration this
plausibly lands at **150–250 changed files**.

Do not set an 85-file cap and hope. Either derive caps from unit estimates before locking, or sequence
explicitly and accept that later units roll into Run 5. Recommended must-have order:

**U0 → U3 → U1 → U6a → U6b → U5 → U4 → U7 → U6c → U8**

U0 first, because dev access is what makes everything else testable. U3 early, because a complete
pipeline on one real paper is the highest-value demonstrable outcome and is nearly independent of the
rest.

## Retained from the earlier draft

The ten audit-derived optimisation items **O31–O40** (mechanical cap enforcement, required-check
recording, fail-open guard fix, deploy-path attestation, import-boundary linting, secret scanning,
golden determinism, `TEST_MODE_LABEL` promotion, dependency update channel, doc-status hygiene) remain
valid and are candidates for U1 and U8. Their full definitions are in
[`run3-audit-findings.md`](./run3-audit-findings.md) and the register.
