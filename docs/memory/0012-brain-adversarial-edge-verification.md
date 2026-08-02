---
id: "0012"
title: Brain synthesis and verification use different provider families
summary: Every brain edge is synthesised and then checked adversarially by an LLM from a different provider family with independent retrieval; the router refuses same-family pairing and grounding failures resolve to uncertain.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-03
---

# Brain synthesis and verification use different provider families

The brain uses two LLM passes. Synthesis proposes a `RelationshipClaim`; an independent verifier
checks it adversarially against freshly retrieved evidence and emits `EdgeVerification`.

The verifier must resolve to a **different provider family** from synthesis. The router refuses to
start when the families match or cannot be resolved, and there is no test-mode or warning-only escape
hatch. This is a structural reliability property: provider diversity matters because the second pass
should not inherit the first model's training and platform blind spots. It is not a call-volume claim
or a permanent endorsement of any named vendor.

Contract invariants require independent retrieval for a decisive verdict, a passing deterministic
quote check, and direction fidelity. Missing grounding resolves to `uncertain` rather than approval.
The verdict answers whether the claim faithfully represents its cited paper; wider-literature
agreement, evidence tier, and venue context inform the caveat but do not vote on that single-paper
fidelity question.

Claims and machine verifications are rebuildable projections; explicit human verdicts are truth with
an audit trail. See [`brain-synthesis-design.md`](../implemented/nao/brain-synthesis-design.md) and the
enforced router configuration under `tools/llm-router/`.
