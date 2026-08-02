---
id: "0020"
title: Five-model research programme is non-serving by default
summary: Ourobion's custom-model programme contains Zebra, Giraffe, Salmon, Viceroy, and Leafcutter; each has a narrow research task, and no checkpoint may influence product output without separate validation, licensing, and serving approval.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Five-model research programme is non-serving by default

The durable roster contains five separately evaluated research directions:

| Codename | Narrow research task |
|---|---|
| **Zebra** | Claim/evidence natural-language inference. |
| **Giraffe** | Study-design and evidence-tier classification. |
| **Salmon** | Biomedical relation type and direction, with abstention where the source cannot support direction. |
| **Viceroy** | Causal-language-risk classification; it does not directly populate the product's `claimKindCheck`. |
| **Leafcutter** | Scientific sentence-role classification. |

This is a research programme, not a claim that five product models are deployed or even trainable as
originally proposed. Each model keeps its native label space, dataset licence, leakage controls,
evaluation design, and promotion decision separate. A strong score does not authorize serving.

All training/evaluation/export code stays inside `model-training/`; no product surface may import it.
No checkpoint or prediction may influence `RelationshipClaim`, `EdgeVerification`, edge scores,
cards, Supabase, Nao, or Biotope without a separate reviewed product decision, suitable adjudicated
evaluation, and model-specific licence/release clearance. Current run status and results belong in
[`model-training/evidence/`](../../model-training/evidence/) rather than memory. The roster authority is
[`model-roster.md`](../development/model-training/model-roster.md).
