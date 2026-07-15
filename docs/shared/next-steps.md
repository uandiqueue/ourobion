---
title: Next Steps & Roadmap
summary: The single next-steps home — the current top priority, near-term work by area (insight engine, biotope UI, nao go-live), and the backlog. Each item points to its ground-truth doc. Start here to see what to do next; scope/sequencing detail lives in phase-2-plan.md.
type: plan
scope: repo
status: canonical
updated: 2026-07-15
---

# Next Steps & Roadmap

The one place to see **what to do next** across the repo. This is a roadmap of concrete moves, each
linked to the ground-truth doc that specifies it. For full Phase 2 scope, tracks, and the Phase 2→3
gate, see [`phase-2-plan.md`](./phase-2-plan.md).

## Immediate (do next)

1. **Fold `dev-phase2` → `main`** (`git merge --no-ff`, preserve history). This registers
   `brain-ingest.yml`'s `workflow_dispatch` on the **default branch** so nao's "Run now" ingestion
   trigger stops 404-ing and actually starts runs, and it lands the whole consolidation on `main`.
   Current top priority. **Pending an explicit go — do not merge to `main` without it.**

## Near-term by area

2. **Insight engine — run the long-shot implementation of the plan.** Implement the 23-stage
   architecture in [`insight-engine-architecture.md`](./insight-engine-architecture.md) following its
   build-order dependency graph (§9): L0 the contract-extension PR first, then up through the one-card
   end-to-end slice (L6), then the full loop (L8). This is the flagship build.

3. **biotope UI — develop the app UI using the AI-generated starter assets** in the
   [ai-assets subsystem](../biotope/ui/ai-assets/) (asset paths resolve via the
   `BiotopeGeneratedAssets` Dart index) plus the ourobion-biotope logo kit. Refine and add more assets
   as the UI needs them; the ai-assets subsystem holds the prompts / manifest / review workflow.

4. **nao ingestion go-live checklist** (after the main fold). Confirm the nao Worker secrets
   `GH_ACTIONS_TOKEN` + `GH_REPO` are set; add the optional `S2_API_KEY` / `LENS_API_KEY` repo secrets
   for fuller source coverage; then run one dispatch end-to-end and confirm a run completes. Pipeline
   detail: [`nao/brain-ingestion-design.md`](../nao/brain-ingestion-design.md),
   [`nao/nao-app-design.md`](../nao/nao-app-design.md).

## Backlog

5. **Brain support models** — the deferred public-data training (GMI GPU), per
   [`nao/brain-support-models-design.md`](../nao/brain-support-models-design.md). Blocked on GMI credits;
   the b2 venue lookup needs no training and can ship anytime.

6. **Hyperparameter calibration** — the provisional constants enumerated in the architecture's
   hyperparameter registry ([§11](./insight-engine-architecture.md)): `edgeScore` weights, `EDGE_GATES`,
   and the S4/S5 thresholds. All are declared-provisional dummies until calibrated.

7. **Hackathon** — the Priority-0 eval artifacts (baseline-vs-verifier catch-rate, cost/latency curve,
   one observed refusal) per [`hackathon/hackathon-direction.md`](./hackathon/hackathon-direction.md);
   confirm the "living apps = trajectory, not headline" framing.
