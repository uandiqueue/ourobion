---
title: Next Steps & Roadmap
summary: The single next-steps home — the current top priority, near-term work by area (insight engine, biotope UI, nao go-live), and the backlog. Each item points to its ground-truth doc. Start here to see what to do next; scope/sequencing detail lives in phase-2-plan.md.
type: plan
scope: repo
status: canonical
updated: 2026-07-16
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

2. **Insight engine — continue the long-shot implementation of the plan.** Build-order graph in
   [`insight-engine-architecture.md`](./insight-engine-architecture.md) §9. **L0–L6 are shipped** (the
   Phase-2 run U1–U13): L0 contract extension, storage/router/quoteCheck primitives, rules-as-data (U5),
   baselines v2 + S2/S3 (U6), S4/S5 signals+evaluator (U7), S6 edge store + A11 loader (U8), the agentic
   seeder (U9), the real A8 synthesis run (U10), the A10 verifier scaffold (U11), the S7 composer + S8
   card producer (U12), and the **L6 one-card end-to-end slice** (U13) — one pair
   (`gut_comfort_score × mood_score`) wired claim→card with its source-panel dataset. Reproduce it via
   [`insight-slice-demo-runbook.md`](./insight-slice-demo-runbook.md); run history lives in
   [`docs/sessions/`](../sessions/).
   **Remaining:** L7 (S9 report + surfaced_cards; A1 ledger + A3 transport + A12 coverage), L8 (the full
   gap→queue→dispatch→new-edge loop), the A4–A7 structure/tiering/mention/gate stages, the U1 real
   applicability grader, and — gating a real verifier verdict on the L6 edge — the non-Anthropic
   verifier key ([memory 0016](../memory/0016-insight-engine-l6-one-card-slice.md); L6 ships an interim key-blocked-honest
   verification). Calibration is item 6.

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
