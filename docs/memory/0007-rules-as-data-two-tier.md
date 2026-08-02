---
id: "0007"
title: Verified rules auto-project; humans retain revocation authority
summary: Insight rules are data, not a hardcoded condition array — hand-authored blueprints are git-tracked truth and gated paper-extracted brain artifacts may auto-project into a rebuildable Postgres rules table; human review is an audited revocation layer rather than a pre-publication bottleneck, and serving stays deterministic.
type: memory
status: accepted
decided: 2026-06-09
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T16:51:13Z
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
human-revocation overlay before claiming the loop is end to end.

## The two-tier mechanism

**Decision (Phase 2 plan, 2026-06-09):** insight rules moved from **hardcoded TypeScript**
(`supabase/functions/generate-insights/index.ts`, the `RULES: Rule[]` array with
`condition: (s) => boolean`) to **data**, using the same two-tier pattern as sister repo **NUSPlan**,
adapted to Postgres:

- **TRUTH:** git-tracked JSON rule blueprints at `data/rules/{single,cross}/<category>/<rule_id>.json`,
  one file per rule, validated by a Zod contract in `shared/rules/` (PR-reviewed, human-approved).
- **DERIVED PROJECTION:** a Postgres `rules` table, populated by a loader (`tools/rules/load_rules.mjs`)
  that validates blueprints and upsert/prunes the table. Never hand-edited — fix a blueprint and reload.

**Automated extracted-rule extension (#371, 2026-08-02):** the brain pipeline's
`edges/blueprints.jsonl` is also a rebuildable projection and is never copied into `data/rules/`.
When explicitly supplied to the rules loader, an extracted cross-rule is admitted only if the same
artifact bundle has an active, non-hold independently verified edge for that unordered metric pair.
Malformed provenance/citations hard-fail; incompatible phase/copy, missing or held verification, and
hand-authored id collisions are withheld with audit reasons. Every hand-authored rule remains in the
full rebuild.

This extends the existing two-tier-truth rule ([0001-two-tier-truth](0001-two-tier-truth.md)): `rules`
joins `baseline_snapshots`/`insight_cards` as a rebuildable projection.

## Constraints locked

The analysis **engine is sequenced LAST** (foundations first); the engine is **deterministic — no LLM
in the hot path**; **AI/LLM summarization is a separate, later, additive phase**. LLM use remains
offline/batch: the manual candidate path is human-reviewed, while the brain path is independently
model-verified and then deterministically gated, all with cost discipline. The Phase-2 condition set
is **core only**: `trend` + `threshold` + `correlation` (cross-metric). The `shared/rules` contract is
a cross-language seam → **2-reviewer PR**
([0002-shared-contract-two-reviewers](0002-shared-contract-two-reviewers.md)). All rule copy stays
non-diagnostic ([0003-non-diagnostic-copy](0003-non-diagnostic-copy.md)), enforced at load,
blueprint-guard, and render.

Contract and engine detail lives in
[`rules-engine-design.md`](../implemented/biotope/rules-engine-design.md); plan:
`docs/development/phase-2-plan.md`. Context tool:
[0008-graphify-context-tool](0008-graphify-context-tool.md).
