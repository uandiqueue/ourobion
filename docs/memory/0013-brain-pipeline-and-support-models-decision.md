# 0013 — Brain pipeline + support-models decision (the anchor)

**Decision (adopted 2026-07-01).** The brain's build shape and the four small "self-trained" support
models are fixed by the anchor brief
[`../human-briefs/2026-07-01-brain-pipeline-and-training-eval.md`](../temp/human-brief/2026-07-01-brain-pipeline-and-training-eval.md);
this file is the durable pointer. Design detail: [`../nao/BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) +
[`../nao/BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md).

**The roster (minimise the LLM surface; deterministic everywhere it's safe):**
- **Agentic seeder** — reads the metric registry (`derivedFrom[]`) + biotope needs → research queries
  (supersedes the static topic-seed list, which stays as bootstrap/fallback).
- **Ingestion + extract** — deterministic (discover → `paper_uid` dedup → OA-location → fetch → R2;
  JATS/CORE/`unpdf` text). No LLM.
- **Synthesis LLM** (strongest model) → `RelationshipClaim`; deterministic `quoteCheck`; **verifier LLM**
  (a **different model family** — decorrelation) → `EdgeVerification` (graded score, not a yes/no gate).
- **Projection** — a `verified_edges` truth store (Supabase table or R2 JSONL) → deterministic sync →
  **Neo4j projection** (rebuildable; **not** the source of truth).
- **Runtime** — biotope's insights **engine stays deterministic** (what fires + the numbers); a
  haiku-tier **presentation agent** phrases summaries / template copy — grounded, copy-gated, cached,
  degradable. nao adds **human-in-the-loop curation**.

> **Update 2026-07-13:** the Neo4j projection was dropped — the served graph is a relational 1-hop lookup over the Postgres verified_edges view (no graph DB). See docs/shared/INSIGHT-ENGINE-ARCHITECTURE.md §S6.

**The four support models** (fine-tuned on public data — we have no in-house labels yet; label maps +
recipes in BRAIN-MODELS-TRAINING): (a) NLI claim-support → `verdict` pre-filter; (b1) study-design →
`evidenceTier`; (b2) venue lookup → `impactTier` (SJR + OpenAlex, no training; **JCR dropped — paid**);
(c) relation/direction/claim-kind → cross-checks the claim (`directionCheck`, `claimKindCheck`).
`no_effect` has **no public training source** — a known gap (source in-house or leave to the LLM).

**Resolves** BRAIN-DESIGN's open decisions on verifier-model choice and persistence. Extends
[0012](0012-brain-adversarial-edge-verification.md) (adversarial verification); follows
[0001](0001-two-tier-truth.md) (truth vs projection) + [0002](0002-shared-contract-two-reviewers.md)
(shared-contract 2-reviewer rule). Non-commercial demo → dataset licences are not a constraint.

**Execution (2026-07-01 constraints).** Every LLM node supports **two routes** — *local-agent* (host
Opus inside Claude Code, no API/no specialised worker) and *API-worker* (specialised worker via API,
**OpenAI or Anthropic**, model id in config; synthesis + verifier different families). Build the
**LLM-router first**. Support-model **training is deferred until GMI credits + GPU** (no local GPU) —
only the (b2) lookup + the design proceed now. Sequencing:
[`PHASE2-PLAN.md` 2026-07-01 integrated update](../shared/PHASE2-PLAN.md).
