---
session: 20260801T145500Z-agent-j-claude-run4-advance-unit-base-post347
agent: agent-j (Claude, orchestrator)
date: 2026-08-01
scope: tools/run4_release_gate.mjs, .github/workflows/ci.yml
---

# Run 4 per-unit landing budget exhausted after #347

## Symptom

Every new PR against `dev-phase2-run4` began failing `Run 4 release evidence`:

```
Error: landing delta has 8858 added lines; cap is 8500
```

PR #349 and #350 both failed on this and on the downstream `Run 4 Gate`, with **all other checks green**.

## Cause

`RUN4_UNIT_BASE_SHA` was still `9867bae` (the #331 merge). The landing gate measures
`RUN4_UNIT_BASE_SHA..HEAD`, so the delta had accumulated across #346, #347 and #348 and crossed
the 8,500-added-line cap. This is the per-unit budget doing its job — it is designed to move every
unit — not a defect in the PRs that tripped it.

Same class of maintenance as #330 / #332 ("advance per-unit base after #329").

## Change

Both constants advanced to `e0c6077dd887fe277a3468130f0c44c909a86875`, the current
`origin/dev-phase2-run4` tip (the #347 merge):

- `tools/run4_release_gate.mjs:122` — `RUN4_UNIT_BASE_SHA`
- `.github/workflows/ci.yml:77` — the workflow's `RUN4_UNIT_BASE_SHA` env var

`RUN4_PRODUCT_BASE_SHA`, `RUN4_MAX_CHANGED_PATHS` (115) and `RUN4_MAX_ADDED_LINES` (8500) are
**unchanged**. The caps were not raised — only the window they are measured over moved, which is
the mechanism's intended use.

## Why this PR passes its own gate

CI reads `.github/workflows/ci.yml` from the PR branch, so the new base value is in effect for this
PR's own landing check. The delta is therefore measured from `e0c6077` rather than `9867bae`, and is
small. Without that property this would be a deadlock.

## Known-remaining, not fixed here

`supabase/deploy-attestation.json` on `dev-phase2-run4` still asserts entrypoint hashes that no
longer match the tree, because #347 changed `supabase/functions/generate-insights/index.ts` and was
merged with the attestation gate red on an explicit owner decision. Regenerating it requires real
`local-functions-serve` evidence (edge-runtime 1.71.0, every route reaching HTTP 401), which needs
Docker — unavailable to every session in this run. **It must be regenerated on a Docker-capable
machine before promotion to `main` is treated as attested.**

## Gates

- `context_sync --check` — passed
- `git diff --check` — clean

CI-config only. No product code, no schema, no provider calls.

memory: the Run 4 per-unit landing cap is measured from a pinned base SHA, so it exhausts silently as
merges accumulate and then fails every subsequent PR at once — when several green PRs start failing
the landing gate together, advance the base before investigating the PRs themselves.

Refs #330, #349, #350
