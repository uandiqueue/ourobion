---
id: "0013"
title: Brain build, persistence, rule promotion, and serving boundaries
summary: The brain separates deterministic ingestion, different-family synthesis and verification, canonical R2 artifacts, automatic verified-rule and edge projections, human revocation truth, deterministic serving, and isolated research models.
type: memory
status: unverified
decided: 2026-07-01
updated: 2026-08-03
---

# Brain build, persistence, rule promotion, and serving boundaries

The brain separates build-time evidence work from product-time serving:

1. Discovery, deduplication, retrieval, extraction, quote matching, scoring, and loading are
   deterministic wherever possible.
2. A synthesis LLM proposes a `RelationshipClaim`; a different-provider-family verifier performs the
   adversarial `EdgeVerification` described in [0012](0012-brain-adversarial-edge-verification.md).
3. Canonical corpus metadata, binaries, claims, verifications, and generated rule-blueprint artifacts
   live in Cloudflare R2 under their contracts. Deterministic loaders project them into Supabase
   relational edge and rule tables. There is no graph-database dependency.
4. A generated rule may be projected automatically after its structural, evidence/verifier, metric,
   provenance, and copy gates pass. Human pre-approval is not required for every rule. Authorized
   human revocation or deprecation is separate truth, is audited, and must survive projection rebuilds;
   see [0007](0007-rules-as-data-two-tier.md).
5. Biotope decides what fires through deterministic personal-signal and rule evaluation. A verified
   population edge alone is not permission to show a card; the matching rule, personal pattern,
   applicability, and serving gates still matter.
6. Nao provides inspection and authorized human curation. Machine claims, verifications, and generated
   rule content are rebuildable; human verdicts and revocations are truth.
7. Custom checkpoints are isolated research artifacts. They cannot short-circuit the verifier or
   enter product serving without a separate reviewed decision; see
   [0020](0020-five-custom-model-research-programme.md).

This records the intended architecture, not a claim that every current workflow connection is
complete. Exact providers, model identifiers, prompt versions, counts, checkpoint status, and run
routes belong to configuration and measured evidence. Design detail lives in
[`brain-synthesis-design.md`](../implemented/nao/brain-synthesis-design.md).
