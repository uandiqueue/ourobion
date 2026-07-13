# 0007 — Analysis rules become data, via a two-tier blueprint→table pattern

**Decision (Phase 2 plan, 2026-06-09):** ourobion's insight rules move from **hardcoded TypeScript**
(`supabase/functions/generate-insights/index.ts`, the `RULES: Rule[]` array with
`condition: (s) => boolean`) to **data**, using the same two-tier pattern as sister repo **NUSPlan**,
adapted to Postgres:

- **TRUTH:** git-tracked JSON rule blueprints at `data/rules/{single,cross}/<category>/<rule_id>.json`,
  one file per rule, validated by a Zod contract in `shared/rules/` (PR-reviewed, human-approved).
- **DERIVED PROJECTION:** a Postgres `rules` table, populated by a loader (`tools/rules/load_rules.mjs`)
  that validates blueprints and upsert/prunes the table. Never hand-edited — fix a blueprint and reload.

This extends the existing two-tier-truth rule ([0001-two-tier-truth](0001-two-tier-truth.md)): `rules` joins
`baseline_snapshots`/`insight_cards` as a rebuildable projection.

**Constraints locked:** the analysis **engine is sequenced LAST** (foundations first); the engine is
**deterministic — no LLM in the hot path**; **AI/LLM summarization is a separate, later, additive phase**.
The only LLM use is an offline, human-reviewed `extract` step (PDF research paper → candidate rules) with
cost discipline. Phase-2 condition set is **core only**: `trend` + `threshold` + `correlation`
(cross-metric). The `shared/rules` contract is a cross-language seam → **2-reviewer PR**
([0002-shared-contract-two-reviewers](0002-shared-contract-two-reviewers.md)). All rule copy stays non-diagnostic
([0003-non-diagnostic-copy](0003-non-diagnostic-copy.md)), enforced at load, blueprint-guard, and render.

Engine design: `docs/biotope/rules-engine-design.md`; plan: `docs/phase-2-plan.md`. Context tool: [0008-graphify-context-tool](0008-graphify-context-tool.md).
