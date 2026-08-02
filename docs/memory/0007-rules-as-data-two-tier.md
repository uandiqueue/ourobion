---
id: "0007"
title: Verified rules auto-project; humans retain revocation authority
summary: A generated rule that clears structural, evidence, verifier, and copy gates is automatically projected into the rules database; human review is an audited revocation or deprecation layer, not a mandatory pre-publication bottleneck.
type: memory
status: accepted
decided: 2026-06-09
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:21:34Z
---

# Verified rules auto-project; humans retain revocation authority

Ourobion's rules are data rather than an accumulating hardcoded condition array. Two production
paths share one contract:

- human-authored blueprints are versioned source;
- research-derived blueprints are generated alongside evidence claims and may enter the rule
  projection automatically only after their structural, metric, provenance, evidence/verifier, and
  non-diagnostic-copy gates pass.

Passing those gates is the automatic promotion boundary. A human does not need to pre-approve every
rule before it reaches the database; requiring that would prevent the research system from scaling.
The deterministic engine evaluates only active, in-force rules.

Human curation remains authoritative after projection. An authorized reviewer may revoke or
deprecate a rule when its evidence, interpretation, safety, or usefulness is challenged. That human
decision is truth, must be audited, and must survive regeneration of the machine projection. A loader
must never reactivate a human-revoked rule merely because the generated blueprint still exists.

This is the required architecture, not proof that every current workflow step is connected. The
current implementation must be checked for both automatic verified-blueprint loading and a durable
human-revocation overlay before claiming the loop is end to end. Contract and engine detail lives in
[`rules-engine-design.md`](../implemented/biotope/rules-engine-design.md).
