---
session: 20260802T033000Z-agent-j-claude-load-extracted-blueprints
agent: agent-j (Claude Opus 5, worktree)
date: 2026-08-02
scope: data/rules/cross/**
---

# The 12 extracted rule blueprints finally reach `data/rules/`

## Gap

Issue #300 §D says the `s` model emits rule blueprints stamped `provenance.tier: 'extracted'` with a
`citation`, riding "the same Zod gate, the same loader, the same engine — a new producer, not an
architectural change". The producer works. **The loading never happened.**

`data/corpus/edges/blueprints.jsonl` (gitignored, machine-local) holds 12 extracted blueprints from
real papers. `data/rules/` held only the 8 hand-authored ones, so the hosted `rules` table held 8
`hand_authored` rows and zero `extracted` rows. Rule coverage — not evidence — is why the demo user
has 56 insight cards with exactly one research-linked.

## Change

All **12 of 12** blueprints emitted **verbatim** under `data/rules/<scope>/<category>/<ruleId>.json`
— 7 `cross/descriptive/`, 4 `cross/gut/`, 1 `cross/behaviour/`. Nothing else touched.

Fidelity is machine-checked, not asserted: each emitted file's `canonicalJson()` is identical to the
producer record's, so no field was added, removed, reordered, or reworded. Only JSON pretty-printing
(2-space, LF) differs from the JSONL line. Every `provenance.tier: "extracted"` and every
`provenance.citation` `{paperId, locator}` survives into the flattened row.

**Zero dropped.** All 12 clear the Zod contract, the non-diagnostic copy gate (`validateCopyString`),
the registry-key check, and rule-id uniqueness. No blueprint touches the barred `log_completeness`.
The 9 metric keys used — `sleep_duration_min`, `hrv_sdnn_ms`, `resting_hr_bpm`, `spo2_pct`,
`stool_form`, `stool_count`, `anxiety_score`, `mood_score`, `symptom_flags` — all resolve in
`shared/metrics/registry.ts`.

No rule-id collides with the 8 hand-authored ones, so the loader's post-upsert prune has nothing to
delete. Dry-run validates **20 = 8 + 12**, with all 8 existing ids present (`energy_trending_down`,
`gut_comfort_mood_comove`, `gut_comfort_trending_down`, `gut_form_stable`, `gut_form_variable`,
`hrv_rise_after_sleep_rise`, `hydration_trending_down`, `hydration_trending_up`).

## Two producer defects found — the rules load but do not yet fire

Measured against the engine, not inferred. Both are in the producer's output or its prompt; per the
"do not repair content" rule neither was edited here.

**1 · `enabledPhase: "phase_2"` makes all 12 inert (blocking).** `ACTIVE_PHASES` in
`supabase/functions/generate-insights/index.ts:131` is `{"phase1_stage1", "phase2_engine"}`. The
line-536 gate `if (!ACTIVE_PHASES.has(rule.enabled_phase)) continue` therefore skips **every one of
the 12**. The literal comes from the producer prompt
(`tools/brain-ingest/src/synth/paperPrompt.ts:163`), not from any paper, so the correct fix is
engine-side and needs no blueprint edit: add `"phase_2"` to `ACTIVE_PHASES` (and redeploy the
function), or align the prompt on `phase2_engine` and re-run the producer. Until then, loading these
rows changes nothing a user sees.

**2 · Two templates use placeholders the engine never supplies.** Rule cards are rendered with
exactly `{metric_a_label, metric_b_label, lag_days}` (index.ts:960). `longer_sleep_lower_rhr` uses
`{{sleep_duration_min}}`/`{{resting_hr_bpm}}` and `resting_hr_and_anxiety_move_together` uses
`{{resting_hr_bpm}}`/`{{anxiety_score}}`; a `renderCard` probe drops both with
`{"reason":"unresolved-placeholder"}`. They are well-formed snake_case, so the Zod contract accepts
them — the failure is downstream and fail-safe (card dropped and logged), which is why they were
emitted rather than excluded. Four other templates leak raw metric keys into prose
(`"your sleep_duration_min was lower"`); ugly, gate-passing, not fixed here.

## Coverage

Eleven distinct metric pairs across the 12 rules (`sleep_duration_min + resting_hr_bpm` is covered
twice, in mirror directions, by `short_sleep_higher_resting_hr` and `longer_sleep_lower_rhr`). Every
pair has a corresponding claim in `data/corpus/edges/claims.jsonl`, which is the same synthesis run
that produced the blueprints. `sleep_duration_and_hrv_sdnn_move_together` overlaps the hand-authored
`hrv_rise_after_sleep_rise` on `sleep_duration_min + hrv_sdnn_ms` (same direction, lag `null` vs
`1`) — distinct rule ids, so both load; they may both fire on the same pair.

The hosted set of 11 servable edges could not be enumerated from the repo: the local corpus
artifacts predate PR #355 and carry 8 verifications, all `uncertain`, hence zero servable. Whether
each new rule pairs with a servable edge must be checked against the hosted table at load time.

## Gates

- `node tools/rules/load_rules.mjs --dry-run` — `✓ 20 blueprint(s) valid`, all 8 pre-existing ids present
- `npm --prefix tools/rules test` — 179/179 pass (baseline was unrunnable: `node_modules` absent in a
  fresh worktree; `tools/rules`, root, and `shared` all need `npm ci`)
- `node tools/context_sync.mjs --check` — passed
- `git diff --check` — clean

Files only. The loader was never run against the database, and Docker was not started.

memory: `data/corpus/` is gitignored, so the producer's `blueprints.jsonl` exists only in the main
checkout and is invisible from a worktree — read it by absolute path. A blueprint can pass the Zod
contract, the copy gate and the registry check and still be unreachable: `enabledPhase` is validated
only as snake_case, while the engine gates on membership in `ACTIVE_PHASES`, and template
placeholders are validated only as well-formed, while the renderer drops any name outside
`{metric_a_label, metric_b_label, lag_days}`. Check both against the engine before calling a
blueprint loadable.

Refs #300
