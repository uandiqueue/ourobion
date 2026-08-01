---
session: 20260802T024500Z-agent-j-claude-run4-advance-unit-base-post362
agent: agent-j (Claude, orchestrator)
date: 2026-08-02
scope: tools/run4_release_gate.mjs, tools/run4_release_gate.test.mjs, .github/workflows/ci.yml
---

# Per-unit landing budget exhausted again, 17 lines over

## Symptom

All five open PRs (#363–#367) failed `Run 4 release evidence` — and its downstream `Run 4 Gate` —
identically, with every other check green:

```
Error: landing delta has 8517 added lines; cap is 8500
```

Five simultaneous failures on unrelated branches is the signature of a shared base, not five
defects. The delta had accumulated across #358, #357, #361 and #362 since the last advance.

## Change

`RUN4_UNIT_BASE_SHA` advanced from `e0c6077` (#347 merge) to
`545c10440acb46a3d836ef84c94e317e8526a3ff` (#362 merge, the current
`origin/dev-phase2-run4` tip):

- `tools/run4_release_gate.mjs:122`
- `.github/workflows/ci.yml:77`
- `tools/run4_release_gate.test.mjs:77` — the one hardcoded literal; every other reference in
  that file uses the constant.

**Caps unchanged.** `RUN4_MAX_CHANGED_PATHS` (115), `RUN4_MAX_ADDED_LINES` (8500) and
`RUN4_PRODUCT_BASE_SHA` are untouched. Only the window they are measured over moves, which is
what the per-unit budget is for.

## Why this PR passes its own gate

CI reads `.github/workflows/ci.yml` from the PR branch, so this PR's landing check uses the new
base and measures a small delta. Without that property the mechanism would deadlock — no PR
could ever advance the base once the cap was reached.

## Note for the five open PRs

They need a CI re-run against the new base once this lands. Their content is unaffected; they
were only ever failing on the shared window.

## Gates

- `context_sync --check` — passed
- `git diff --check` — clean
- `node --test tools/run4_release_gate.test.mjs` — passed

CI-config only. No product code, no schema, no provider calls.

memory: this is the second base exhaustion in one session (#351 was the first, at 8858 lines).
The cap is measured from a pinned SHA, so it drains as merges accumulate and then fails every
open PR at once — when several unrelated green PRs go red on the landing gate together, advance
the base before investigating any of them.

Refs #351, #363, #364, #365, #366, #367
