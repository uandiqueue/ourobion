# Session 20260701T061754Z — agentjwork — claude — phase2-integrated-plan-update

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/brain-pipeline-decision (PR #37) · **Issue:** —
- **Type:** Docs / plan. Fold the brain-pipeline decision + metric-catalog 100-expansion + two new
  constraints into the plan authority (`PHASE2-PLAN.md`); flag contradictions. Stacked onto PR #37.

## Attempted
Update the integrated plan (`PHASE2-PLAN.md`) with the two work-track families (biotope + brain/nao),
their dependencies + effort tiers, and two newly-surfaced constraints (no GMI/GPU yet → training
deferred; every LLM node needs a dual local-agent/API-worker route across OpenAI + Anthropic). Reflect
the constraints into the decision anchor + memory 0013. Flag where prior plans/briefs are superseded.

## Changed
- **`docs/PHASE2-PLAN.md`** — new **§"2026-07-01 integrated update"**: two independent track families
  (A = biotope app/metrics/insights; B = brain/nao) with deps + effort tiers, the two critical paths
  (A0 storage primitives; B0 LLM-router → B4 edges), a constraint-aware sequencing, and a
  **contradictions-flagged** list. Added two bullets to *Constraints* (no-GPU/GMI; dual-route LLMs) and
  a **⚠️ under-revision** flag on the thin-slice *Risk* (contradicted by the 100-metric brief).
- **Anchor brief** (`human-briefs/2026-07-01-...`) + **`docs/memory/0013`** — added the **execution
  constraints** note (dual-route LLM-router first; training deferred until GMI/GPU; b2 lookup ships now).

## Decided
- **NEW constraint 1:** support-model **training deferred** until GMI credits + GPU (local box can't
  fine-tune). Design + data-prep only for now; (b2) venue lookup still ships (no training).
- **NEW constraint 2:** every LLM node = **two routes** — local-agent (host Opus, no API) vs API-worker
  (specialised, **OpenAI or Anthropic**, model id in config; synth/verifier different families). Build
  the **LLM-router (B0) first**, before the LLM-heavy tracks.
- **Sequencing:** start A0 + B0 + B1 + A5 + b2 in parallel; B4 LLM runs after B0; B2 training waits for GMI.

## Left / flagged contradictions
- **Thin-slice vs 100 metrics** — `PHASE2-PLAN` thin-slice guidance vs the metric-catalog 100-expansion
  brief: **unresolved, owner call required** (the brief's "Decisions needed #2"). A1–A4 treated as
  *proposed*, not committed.
- **"Train (a)/(c) now"** in the anchor's original sequencing is **superseded** by constraint 1.
- The **2026-06-11 integrated-plan brief** is a stale snapshot; the new PHASE2-PLAN section is current.
- **Shared working tree:** the metric-catalog workstream's `tools/brain-ingest/src/extract.ts` +
  `extract.test.ts` + `METRICS-CATALOG.md` + `2026-07-01-metric-catalog-100-promotion.md` are present
  uncommitted — **excluded** from this commit (theirs to land).
- This work was authored on `dev-phase2`'s tree by accident (PR #37 unmerged), then **consolidated onto
  the PR #37 branch** so the plan's links to the brief/memory-0013/training-doc resolve.

## Blockers
- None. (Merge order: PR #37 carries all of this into `dev-phase2`.)
