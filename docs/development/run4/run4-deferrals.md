---
title: Run 4 deferral record — #222, #283, #275
summary: Records that three surfaces (R4-U6c metric collector families, biotope-as-web hosting, and a nao operator UI for brain synthesis/verification) are explicitly deferred and not delivered in Run 4 as of 2026-08-01, with reasons.
type: decision-register
scope: run4
status: accepted
updated: 2026-08-01
---

# Run 4 deferral record — #222, #283, #275

This document is a **"not done and why" record**, not a completion claim. Each item below is
explicitly out of Run 4's delivered scope as of 2026-08-01. None of the work described as blocking or
unstarted should be read as complete, in progress, or planned for imminent completion within Run 4.

## #222 — R4-U6c MEDIUM metric collector families

**Status: deferred, gated on the unbuilt A4 chain.**

[Issue #222](https://github.com/uandiqueue/ourobion/issues/222) owns R4-U6c from
[`next-build-optimizations.md`](./next-build-optimizations.md) §3b and
[`pending-build-register.md`](./pending-build-register.md) §A — approximately 35 MEDIUM metrics,
sliced by collector family and further split at review-size limits. It explicitly excludes
`env_daily`, `derived_metrics`, static/T5 storage, CGM, hosted writes, deployment, and model training.

**Why it is deferred.** #222 depends on the A4 chain, none of which is built yet:

1. **A4-1** — S1 raw local-date/timezone provenance, one exclusive watermark, timezone-split bands,
   overlap rejection.
2. **A4-2** — shared/S2 additive `local_day_v1` TS/Dart/schema parity plus reducer/view generation.
3. **A4-3** — registry/parity activation, which itself needs both Jayden and Alton on the actual PR
   (a `shared/` contract change, per the two-reviewer rule in
   [`docs/memory/0002-shared-contract-two-reviewers.md`](../../memory/0002-shared-contract-two-reviewers.md)).

[ADR-0004](../decisions/0004-local-day-projection.md) (*Local-Day Projection for Event and
State Primitives*, accepted 2026-07-30) **accepted the policy** for A4-1/A4-2 — the additive
`local_day_v1` calendar, raw timezone provenance, per-metric reducers, one exclusive watermark, and
half-open non-overlapping bands. **The implementation slices were never built.** The merged A4-S0
scaffold (PR #229) proves a fail-closed UTC projection shape only; it activates no production metric.
Per [`pending-build-register.md`](./pending-build-register.md) §A, A4-1/A4-2 remain "policy accepted;
implementation pending" and A4-3 remains "collector-gated." U6c (#222) itself is recorded there as
"stopped / out of current scope... do not resume without separate scope, A4 semantics, real collectors
and device evidence; no placeholder or fake collector work."

**What this means concretely:** zero of the ~35 MEDIUM metrics in #222's scope are collectible today.
No collector code, no view extension, and no registry activation for this family exists on
`dev-phase2-run4`.

## #283 — Host biotope as a Flutter web app at biotope.ourobion.com

**Status: deferred by explicit owner instruction (2026-07-31), blocked behind #222.**

[Issue #283](https://github.com/uandiqueue/ourobion/issues/283) is filed as **"DEFERRED — DO NOT
START"** in its own title and body. The owner instruction recorded on the issue (2026-07-31) is that
this is deferred until #222 is done — i.e., until the biotope app itself is complete, not merely until
#222's PR opens. The issue also records the real dependency chain: #222 is itself gated on the A4
chain above (verified unmet against `dev-phase2-run4 @ 42ae771` at the time #283 was filed), so #283
unblocks only after A4 → #222 → the app itself is complete.

**Why it is deferred.** Per the owner instruction on the issue, no session should pick this up until
that chain clears. This record exists to confirm that instruction was honored during Run 4, not to
argue for an earlier start.

**What was and was not done:**

- No branch was created for #283.
- No build (`flutter build web` or otherwise) was attempted.
- No deploy occurred.
- No DNS change was made for `biotope.ourobion.com`.
- The one genuine technical blocker the issue itself identifies — the `health` plugin import in
  `apps/biotope/lib/modules/m3_passive_health/impl/wearable_service.dart` having no browser
  equivalent, and the absence of any `kIsWeb` guard in the app — remains unaddressed and unverified
  (the issue itself flags `flutter build web` as the decisive, not-yet-run test).

## #275 — nao operator UI to trigger bounded brain synthesis + verification after ingestion

**Status: unstarted feature surface.**

[Issue #275](https://github.com/uandiqueue/ourobion/issues/275) asks for an authenticated nao operator
surface to trigger bounded synthesis (A8) and verification (A10) runs after ingestion, scoped to an
explicit pair/edge selection, with cost/cap shown before the run, a required human-supplied artifact
revision, attempt-journal integration, and router-acceptance/decorrelation constraints preserved.

**Why it is not done.** No implementation exists for this surface in Run 4. Brain synthesis (A8) and
verification (A10) remain **CLI-only** in `tools/brain-ingest` (`brain-ingest synthesize`,
`brain-ingest verify`) — exactly the gap the issue describes: nao today can inspect claims
(`ClaimsPanel`, `lib/claimsControl.ts`), human-reject them, run the engine
(`api/loader/run-pipeline` → `compute-baselines → evaluate-signals → generate-insights`), and view
gaps/models/seeds, but it cannot **create** a synthesis or verification run. Producing new verified
edges still requires a local shell against `tools/brain-ingest`.

**What was and was not done:**

- No nao route, page, or component was added for triggering synthesis or verification.
- No change was made to the router-acceptance path (`tools/llm-router/src/router.ts`,
  `routes/apiWorker.ts`), the budget/cap machinery (`budget.ts`, `attemptJournal.ts`), or the
  decorrelation invariant — all remain exactly as they were, still enforced only through the existing
  CLI path.
- The acceptance criteria in the issue (operator trigger, cost/cap display, required artifact
  revision with no default, attempt-journal integration, honest failure surfacing, and the three
  named test categories) are all still open; none has partial UI evidence to point to.

## Summary table

| Issue | What was asked for | What actually shipped in Run 4 | Blocking reason |
|---|---|---|---|
| #222 | ~35 MEDIUM metric collector families | Nothing — zero collectors, no view extension, no registry activation | A4-1 → A4-2 → A4-3 chain unbuilt; A4-3 additionally needs Jayden + Alton on the shared-contract PR |
| #283 | biotope Flutter web build hosted at biotope.ourobion.com | Nothing — no branch, build, deploy, or DNS change | Explicit owner deferral (2026-07-31), blocked behind #222 being fully complete |
| #275 | nao operator UI for bounded synthesis + verification | Nothing — feature is CLI-only in `tools/brain-ingest`, unchanged | Unstarted; no dependency was worked toward it in Run 4 |

None of these three should be read as partially delivered, in progress, or close to done based on
anything landed in Run 4. They are recorded here so a later session (or the owner) does not have to
re-derive "why hasn't this shipped" from scratch.
