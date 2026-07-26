---
title: docs/memory — durable cross-device memory index
summary: Index of the one-fact-per-file durable memory notes (architectural decisions, domain gotchas, schema rationale) that travel across machines and agent CLIs; context_sync.mjs --check keeps this index and the fact files in lockstep.
type: index
scope: repo
status: canonical
updated: 2026-07-13
---
# docs/memory — durable, cross-device memory

One durable fact per file (architectural decisions, domain gotchas, schema rationale), git-tracked so
it travels across machines and agent CLIs — the in-repo equivalent of device-local `~/.claude` /
`~/.gemini` memory, which does **not** travel.

These facts are **decomposed from the CONSTANT-LAYER docs** (`docs/project-context.md`,
`docs/biotope/architecture-context.md`, `shared/SHARED-CONTEXT.md`) and from session learnings — they are
quick-reference pointers, not a replacement for those source docs.

> **Enforcement:** `node tools/context_sync.mjs --check` (run by the pre-push hook + CI) fails on a
> dangling link here or an unindexed `*.md` in this directory. Keep this index and the files in
> lockstep — add a line here whenever you add a fact file.

## Index

<!-- BEGIN GENERATED -->
- [Two-tier truth](0001-two-tier-truth.md) — Raw rows + migrations + shared contracts are truth; baselines/insights/engagement are rebuildable projections — fix the input and re-run, never hand-edit derived tables.
- [Shared contract changes need 2 reviewers](0002-shared-contract-two-reviewers.md) — Any change to a shared/ contract type crosses the Dart↔TS seam and requires a PR with 2 reviewers; add fields as optional-with-default, never remove/rename without a migration plan.
- [Non-diagnostic language is mandatory for all user-facing copy](0003-non-diagnostic-copy.md) — Every user-facing string must be observational (signal/pattern/observation, never diagnose); enforce with validateCopyString and the copy_guidelines TS/Dart parity lists; severity is info/notice/watch.
- [HRV SDNN is iOS-only](0004-hrv-sdnn-ios-only.md) — hrv_sdnn_ms comes only from Apple HealthKit and stays null on Android (Health Connect exposes RMSSD) by design — treat it as a nullable, platform-dependent signal, never gate on it.
- [pg_cron migrations need app config set in the Supabase dashboard first](0005-pgcron-config-prereqs.md) — Before pushing pg_cron migrations to production, set app.supabase_url and app.service_role_key in the Supabase dashboard or the scheduled jobs are created but fail silently at run time.
- [Wearable sync is best-effort](0006-wearable-sync-best-effort.md) — Wearable writes use .ignore() and silently no-op on permission/availability failures; never treat a missing wearable_daily row or null field as an error — wearables augment confidence, never gate.
- [Analysis rules become data, via a two-tier blueprint→table pattern](0007-rules-as-data-two-tier.md) — Insight rules move from hardcoded TS to git-tracked JSON blueprints (truth, Zod-validated) loaded into a rebuildable Postgres rules table; engine is sequenced last and deterministic, LLM summarization is a later additive phase.
- [graphify is the semantic context tool; complementary to the deferred structural graph](0008-graphify-context-tool.md) — graphify indexes repo + paper corpus into a gitignored graphify-out/ subgraph (project-bounded venv, Claude Code hook pre-wired) to fight context overload; it is a rebuildable projection and complements — never replaces — the deferred structural import-graph or couplings.yaml.
- [Local test data seeding (don't log for a week by hand)](0009-local-test-data-seeding.md) — Inject backdated rows keyed on log_date via scripts/seed-test-data.ps1 then rebuild projections (compute-baselines before generate-insights) so the UI renders "weeks in" instantly; target user must already exist (RLS on auth.uid).
- [iOS builds need a Mac; HealthKit needs a paid Apple account + real device](0010-ios-build-needs-mac-and-paid-account.md) — iOS cannot be built on Windows (do daily work on Android emulator); HealthKit + Apple Sign In need the paid Apple Developer Program ($99/yr) plus a real iPhone, so treat iOS as a Mac/cloud-CI task.
- [Local Supabase auth: email/password works; OAuth needs a hosted project](0011-local-supabase-auth-email-only.md) — Against local Docker Supabase only email/password auth works (instant signup, no confirmation); test Google/Apple OAuth against a hosted project instead; local DB state persists across stop/start unless db reset or --no-backup.
- [The brain verifies synthesised edges with a second, grounded, adversarial LLM](0012-brain-adversarial-edge-verification.md) — Every brain edge is synthesised then re-checked by an independent, adversarial verifier LLM against freshly-retrieved evidence; schema invariants force grounding (no retrieval ⇒ uncertain) and emit a graded trust score, not a yes/no gate.
- [Brain pipeline + support-models decision (the anchor)](0013-brain-pipeline-and-support-models-decision.md) — Fixes the brain build shape — agentic seeder → deterministic ingest → synthesis LLM + different-family verifier + 4 small support models → verified_edges truth store (relational 1-hop, Neo4j dropped) → runtime presentation agent; every LLM node has local-agent and API-worker routes.
- [Metric-catalog 100-expansion decision](0014-metric-catalog-100-expansion-decision.md) — Grow the metric registry from ~19 to 100 metrics in collector-gated waves (W1 self-report → W2 sensor → W3 env/api → W4 wearable/CGM), superseding the original thin-slice plan; the full ~360-metric catalog stays reference, not ship target.
- [Docs taxonomy and enforcement](0015-docs-taxonomy-and-enforcement.md) — The docs tree has a fixed taxonomy (shared/nao/biotope/memory/sessions/graph, temp=in-building, archive=frozen/superseded), a kebab + type-suffix + front-matter naming rule, docs/INDEX.md as the enforced map, and context_sync.mjs --check enforces front-matter, supersede reciprocity, index freshness, and archive-containment.
- [Insight engine L6 one-card slice shipped (interim-verifier caveat)](0016-insight-engine-l6-one-card-slice.md) — The insight engine's L6 one-card end-to-end slice is proven on the local stack — one pair (gut_comfort_score × mood_score) driven claim→card with its §S8 source-panel dataset — but the A10 verifier verdict is an interim, key-blocked-honest `uncertain` (real deterministic halves, no real decorrelated verdict), so the edge is held and the card is the honest `personal`/`idiosyncratic` variant, not `agree`.
- [Three support-model dataset assumptions are wrong (BioRED direction, PublicationType tiers, Cochrane Crowd)](0017-support-model-dataset-corrections.md) — Verified against primary sources — BioRED relations are non-directional (direction needs the BioREDirect enrichment, licence unverified); MEDLINE PublicationType cannot express evidenceTier 1-3 (cohort/cross-sectional are MeSH headings, tier 1 is a check tag); and Cochrane Crowd is licensed for personal use only. brain-support-models-design.md still states all three incorrectly.
<!-- END GENERATED -->
