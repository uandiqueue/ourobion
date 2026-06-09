# docs/memory — durable, cross-device memory

One durable fact per file (architectural decisions, domain gotchas, schema rationale), git-tracked so
it travels across machines and agent CLIs — the in-repo equivalent of device-local `~/.claude` /
`~/.gemini` memory, which does **not** travel.

These facts are **decomposed from the CONSTANT-LAYER docs** (`docs/PROJECT-CONTEXT.md`,
`docs/ARCHITECTURE-CONTEXT.md`, `shared/SHARED-CONTEXT.md`) and from session learnings — they are
quick-reference pointers, not a replacement for those source docs.

> **Enforcement:** `node tools/context_sync.mjs --check` (run by the pre-push hook + CI) fails on a
> dangling link here or an unindexed `*.md` in this directory. Keep this index and the files in
> lockstep — add a line here whenever you add a fact file.

## Index

- [0001 — Two-tier truth](0001-two-tier-truth.md) — raw rows + migrations are truth; baselines/insights/engagement are rebuildable projections.
- [0002 — Shared contract changes need 2 reviewers](0002-shared-contract-two-reviewers.md) — `shared/` types are the cross-language seam.
- [0003 — Non-diagnostic copy is mandatory](0003-non-diagnostic-copy.md) — observational language only; enforced via copy_guidelines.
- [0004 — HRV SDNN is iOS-only](0004-hrv-sdnn-ios-only.md) — `hrv_sdnn_ms` stays null on Android by design.
- [0005 — pg_cron config prereqs](0005-pgcron-config-prereqs.md) — set `app.supabase_url` + `app.service_role_key` before applying cron migrations.
- [0006 — Wearable sync is best-effort](0006-wearable-sync-best-effort.md) — missing wearable data silently no-ops; never a hard gate.
- [0007 — Analysis rules become data (two-tier)](0007-rules-as-data-two-tier.md) — rules move from hardcoded TS to git-JSON blueprints → a `rules` table; engine last, AI summary later.
- [0008 — graphify is the context tool](0008-graphify-context-tool.md) — semantic knowledge-graph skill for context/ingestion; complementary to the deferred structural graph.
