---
title: Session — Run 2.0 U1 router OpenAI-only posture (TEST-MODE)
summary: Added an explicit testMode flag to the llm-router config that downgrades the synthesis↔verifier decorrelation invariant from hard load failure to a loud warning (reason required, TEST_MODE_LABEL stamped on every route() result), pointed all six nodes at OpenAI via api_worker (gpt-5 heavy / gpt-5-mini cheap), set C7 caps low (US$1/day/node, 60k output tokens/run), and proved the live path with one gpt-5-mini smoke call (US$0.00015125).
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Session: Run 2.0 · U1 router OpenAI-only posture (TEST-MODE decorrelation override)

- **When:** 2026-07-24 (UTC 07:14). **Agent:** Claude (U1 build agent, Run 2.0). **Branch:** feat/phase2-run-2/u1-router-openai-posture (off feat/phase2-run-2/u0-run-docs).

## What happened

Executed Jayden's already-made decision: single-provider (OpenAI) posture for Run 2.0, with the
decorrelation invariant explicitly and loudly switched off via config, never silently.

1. **TEST-MODE flag** — `testMode: { reason }` block in `router.config.json`:
   - `tools/llm-router/src/config.ts`: `TestModeConfig` type; `validateConfig(raw, { warn? })`
     validates the block (non-empty `reason` REQUIRED, else `RouterConfigError`); when present, the
     two decorrelation clauses (`family(synthesis) !== family(verifier)`,
     `family(verifier) !== 'anthropic'`) are downgraded from hard failure to a warning naming the
     violated invariant. Without the flag, behaviour is byte-identical to before (hard fail —
     proven by tests).
   - `tools/llm-router/src/types.ts`: exported constant `TEST_MODE_LABEL` with the exact wording
     `scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)`; `TestModeState`
     (`{ reason, label }`); optional `LlmResponse.testMode`.
   - `tools/llm-router/src/router.ts`: every `route()` result carries `testMode` when the config
     has the block (`LlmRouter.testModeState()`); `checkConfig` report gains `testMode` and an
     honest `decorrelation.ok: boolean` (false only reachable under TEST-MODE).
   - `tools/llm-router/src/cli.ts`: `check-config` prints the TEST-MODE state and the
     violated-but-allowed decorrelation verdict.
2. **All six nodes → OpenAI on api_worker** (`router.config.json`): synthesis + verifier `gpt-5`;
   seeder, phrasing_card, extract_assist, report_narrative `gpt-5-mini`. Added price row
   `gpt-5-mini: { inputUsdPerMTok: 0.25, outputUsdPerMTok: 2.0, provisional: true }` (OpenAI list
   price, matching the existing gpt-5 row pattern).
3. **C7 caps LOW** (run budget 20 SGD ≈ US$14.7): `perDayUsdPerNode` 5.0 → **1.0**,
   `perRunOutputTokens` 200000 → **60000**, `hardStopFraction` kept 0.95.
4. **Tests** (`tests/testMode.test.ts`, 8 new; `tests/config.test.ts` shipped-config test updated
   to the new posture): single-provider hard-fails without the flag (both clauses), passes with a
   warning under `testMode {reason}`, `reason` required (missing/empty/whitespace/non-object all
   rejected), both clauses warn on an all-Anthropic config, flag-on-but-decorrelated emits no
   warning, integration test drives all six node ids through a capturing stub fetch (OpenAI URL +
   Bearer key + configured model + max_completion_tokens asserted per node, ledger spend recorded),
   and results carry/omit `testMode` metadata correctly. Total suite: 56 tests.
5. **Live smoke** (`scripts/smoke-openai.ts`, manual-only, documented as costing money): loads
   OPENAI_API_KEY from `tools/brain-ingest/.env`, one real call on phrasing_card/gpt-5-mini.
   Included `scripts/` in tsconfig so it typechecks.

## Gate

- `tools/llm-router`: `npm run typecheck` (tsc --noEmit) — PASS.
- `tools/llm-router`: `npm test` — **56/56 pass** (was 48 baseline; all pre-existing tests still green).
- Repo root: `node tools/context_sync.mjs --check` — PASS.
- NUL-byte check on all touched files — clean; no `Bin` entries in `git diff --stat`.

## Smoke result (the one live LLM call of this unit)

- Request: `phrasing_card` → `Reply with the single word: ok`, maxOutputTokens 512.
- Response: `text: "ok"`, `model: gpt-5-mini-2025-08-07`, usage 13 input / 74 output tokens
  (74 = reasoning + visible tokens; gpt-5-family reasoning counts against completion tokens),
  `route: api_worker`, `testMode.label` carried.
- Ledger entry (`data/llm-router/ledger.json`, day 2026-07-24, phrasing_card):
  `calls=1 in=13 out=74 usd=0.00015125`. **Actual cost: US$0.00015125.**

## Decisions taken inside the unit's mandate

- `gpt-5-mini` price row set to 0.25 / 2.0 USD/MTok (provisional) — OpenAI list price.
- Warning sink is injectable (`validateConfig(raw, { warn })`, default `console.warn`) so tests
  capture warnings without stdout scraping.
- `CheckConfigReport.decorrelation.ok` widened `true` → `boolean` (false only under TEST-MODE);
  only consumer is the router CLI, updated in the same commit.
- Smoke script is `.ts` under `scripts/` (tsx-run, typechecked, excluded from the test glob).
- Kept the now-unused claude-* price rows and anthropic/google provider entries so re-arming
  decorrelation later is a config-only change.

memory: The llm-router now has an explicit `testMode {reason}` config flag that downgrades decorrelation violations to loud warnings and stamps every result with TEST_MODE_LABEL — Run 2.0 runs all six nodes on OpenAI api_worker (gpt-5/gpt-5-mini) under US$1/day/node + 60k-token/run caps, and the live OpenAI path is proven (one smoke call, US$0.00015125).
