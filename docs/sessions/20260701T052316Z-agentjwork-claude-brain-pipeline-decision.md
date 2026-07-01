# Session 20260701T052316Z — agentjwork — claude — brain-pipeline-decision

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** docs/brain-pipeline-decision · **Issue:** —
- **Type:** Docs / decision. Evaluate the proposed multi-agent brain pipeline, design the three
  self-trained support models from real public data, then **promote the result to an adopted decision**
  and reconcile the design docs to it.

## Attempted
Evaluate the user's proposed multi-agent brain pipeline against the current design; determine how the
three "self-trained" models could be trained (verifying dataset access/cost and extracting real sample
records to ground the design, without training anything); then promote the brief to a DECISION and update
every doc whose content now differs from that anchor.

## Changed
- **New anchor brief** `docs/human-briefs/2026-07-01-brain-pipeline-and-training-eval.md` — evaluation of
  the pipeline (over-agentified → 3 LLM roles + agentic seeder + presentation agent; everything else
  deterministic) + the training design for the support models. **Promoted to DECISION** (status line,
  anchor framing, "docs reconciled" list).
- **New** `docs/nao/BRAIN-MODELS-TRAINING.md` — training recipe per model, grounded in real sample records
  pulled live 2026-07-01 (label-mapping tables, dataset load routes, how each model populates/checks a
  contract field). No model trained — design + data-extraction only.
- **New** `docs/memory/0013-brain-pipeline-and-support-models-decision.md` (+ indexed in
  `docs/memory/README.md`) — durable decision record.
- **Reconciled to the anchor:** `BRAIN-DESIGN.md` (open decisions on verifier-model + persistence →
  DECIDED), `BRAIN-INGESTION-DESIGN.md` (agentic seeder supersedes static seed list),
  `NAO-DESIGN.md` (edge-store shape + source-reliability standard defined),
  `biotope/INSIGHTS-ENGINE-DESIGN.md` (§E → presentation agent w/ guardrails),
  `PHASE2-PLAN.md` (W2 rows + Track B → presentation agent + brain-pipeline pointers),
  `AGENTS.md` (§3 doc list surfaces the training doc + the decision).
- **Verified:** `node tools/context_sync.mjs --check` passes (sessions/memory/couplings consistent).

## Decided
- Brain pipeline = **agentic seeder → deterministic ingest/extract → synthesis LLM (strongest) →
  quoteCheck → verifier LLM (different family) → `verified_edges` truth store → Neo4j projection →
  biotope deterministic engine + haiku presentation agent; nao adds human-in-the-loop curation.**
- **Four support models**, all fine-tuned on **public data** (no in-house labels exist): (a) NLI
  claim-support → `verdict`; (b1) study-design → `evidenceTier`; (b2) venue lookup → `impactTier`
  (SJR + OpenAlex, no training); (c) relation/direction/claim-kind → cross-check. `no_effect` has no
  public source (known gap).
- **JCR dropped** (only paid/closed source); non-commercial demo ⇒ dataset licences are not a constraint.
- The brief is the **anchor**; where a design doc disagreed, the design doc was updated to match.

## Left
- Not committed by other workstream: `tools/brain-ingest/src/extract.ts`, `extract.test.ts`,
  `docs/biotope/METRICS-CATALOG.md`, `docs/human-briefs/2026-07-01-metric-catalog-100-promotion.md` are a
  **separate metric-catalog workstream** present in the shared working tree — deliberately **excluded**
  from this PR.
- Building any of this (agentic seeder, support-model training on the GMI credits, Track B edge pipeline)
  is future work; this session only fixed the design + decision.

## Blockers
- None.
