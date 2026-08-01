# Session 20260715T143750Z — agentjwork — claude — brain-llm-router

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U3) · **Branch:**
  `feat/brain/llm-router` (cut from `feat/db-storage/continuity-primitives`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** Track B foundation — the dual-route LLM router every brain-pipeline LLM node dispatches
  through (memory 0013 "build the LLM-router first"; architecture §10.1; phase2-run-config C6–C7).

## Attempted
- Ship `tools/llm-router/` as a zero-runtime-dep package (native fetch, no SDKs) mirroring the
  brain-ingest layout: core types for the six LLM nodes, validated config with the vendor-family
  decorrelation invariant, an API-worker route (Anthropic + OpenAI adapters, mocked-fetch-testable),
  a keyless local-agent filesystem-mailbox route, a dual-cap budget ledger, a router facade +
  `checkConfig`, a tiny CLI, tests at brain-ingest density, and a README carrying the full mailbox
  fulfillment contract; run the full gate.

## Changed
- `tools/llm-router/package.json`, `tsconfig.json` — mirrors brain-ingest (Node ≥26, ESM/NodeNext,
  `typecheck`/`test`/`start` scripts, `node --test` via tsx; dev deps only: typescript/tsx/@types/node).
- `tools/llm-router/router.config.json` — checked-in config: six nodes (`seeder`, `synthesis`,
  `verifier`, `phrasing_card`, `report_narrative`, `extract_assist`) with C6 model ids
  (synthesis/report `claude-sonnet-5`, cheap tier `claude-haiku-4-5`, verifier provisional `gpt-5`),
  provider prefix→family registry (anthropic/openai/google + key env vars), provisional price table,
  C7 budget caps (200k output tokens/run, US$5/day/node, 0.95 hard stop), local-agent mailbox
  defaults. All nodes shipped on the `local_agent` route (no keys on this machine — B5).
- `tools/llm-router/src/types.ts` — `LlmNodeId`/`RouteKind`/`VendorFamily`/`LlmRequest`/`LlmResponse`
  /`LlmUsage` + `estimateTokens` (~4 chars/token fallback accounting).
- `tools/llm-router/src/errors.ts` — typed `RouterConfigError`, `RouterKeyMissingError` (`.envVar`),
  `RouterBudgetExceededError` (`.cap`), `RouterHttpError` (`.status`), `RouterTimeoutError`.
- `tools/llm-router/src/config.ts` — plain-TS (zod-free, house style) load+validate, fail-loud;
  enforces the decorrelation invariant (`family(synthesis) !== family(verifier)` AND verifier
  non-Anthropic), prefix→family resolution, per-model price coverage, budget sanity; repo-root-
  relative path resolution (no hardcoded absolute paths).
- `tools/llm-router/src/routes/apiWorker.ts` — native-fetch adapters: Anthropic Messages API
  (`anthropic-version: 2023-06-01`, `x-api-key`) and OpenAI Chat Completions (Bearer,
  `max_completion_tokens`, `response_format: json_object` for `expectJson`); exponential backoff on
  429/5xx, immediate fail otherwise; injectable fetch/env/sleep; missing key ⇒ typed
  `RouterKeyMissingError` before any network; google family ⇒ clear "no adapter yet" error.
- `tools/llm-router/src/routes/localAgent.ts` — the keyless filesystem mailbox: atomic
  `<id>.request.json` write, poll for `<id>.response.json` with configurable timeout/interval,
  half-written-JSON tolerance, id-echo check, usage estimation when the fulfiller reports none,
  files left in place as audit trail.
- `tools/llm-router/src/budget.ts` — dual-cap ledger (per-day per-node USD + per-run output tokens),
  pre-call fail-closed check at 95% with worst-case estimates, actuals recorded post-call; atomic
  JSON persistence, crash-tolerant load, UTC-day windows (mirrors brain-ingest budget semantics).
- `tools/llm-router/src/router.ts` — `LlmRouter.route()` facade (resolve → budget check → dispatch →
  record) + `checkConfig()` operator report (models/families/routes, decorrelation verdict, key
  presence y/n, budget state); constructing a router never needs a key.
- `tools/llm-router/src/cli.ts` — `check-config` (exit 0 ok / 1 invalid config / 2 blocked-on-key)
  and `ledger` verbs; `src/index.ts` barrel for `tools/brain-*` importers.
- `tools/llm-router/tests/` — 42 tests, fully offline: config validation incl. all decorrelation
  failure modes; both adapters against mocked fetch (wire shape, 429 backoff, 5xx exhaustion,
  non-retryable 400, key-missing with zero fetch calls); mailbox round-trip with the test playing
  the fulfilling agent (+ timeout, error response, partial-JSON, id-mismatch); budget hard stops,
  persistence, day rollover; facade dispatch on both routes, pre-dispatch budget denial, per-request
  ceiling override, `checkConfig` report. `tests/helpers.ts` shared factory.
- `tools/llm-router/README.md` — routes, the full mailbox fulfillment contract (implementable from
  the README alone), config reference, budget semantics, CLI, consumption example.
- `.gitignore` — `data/llm-router/` (ledger + mailbox runtime state; rebuildable, never truth).

## Decided
- **OpenAI endpoint: Chat Completions (`/v1/chat/completions`), not the Responses API** — the
  stable, exhaustively documented surface; the router only needs single-turn text/JSON. Uses
  `max_completion_tokens` (gpt-5-family rejects plain `max_tokens`). Swap is contained to
  `routes/apiWorker.ts` if Responses becomes necessary.
- **Shipped default route = `local_agent` for all six nodes.** No API keys exist on this machine
  (B5) and memory 0013's prepopulation mode is agent-session-hosted; api_worker is a per-node config
  flip once keys land. `check-config` exit code 2 makes the blocked-on-key state visible without
  failing config validation.
- **Price table (all `provisional: true`):** `claude-sonnet-5` $3/$15 per MTok (sticker, NOT the
  time-boxed intro $2/$10 — budget conservatively), `claude-haiku-4-5` $1/$5, `gpt-5` $1.25/$10
  (placeholder for the pending non-Anthropic verifier key). Used only for ledger accounting.
- **Mailbox protocol shape:** JSON file pairs `<id>.request.json` / `<id>.response.json` in one
  flat dir; atomic tmp+rename writes on both sides (poller additionally tolerates unparsable JSON as
  not-ready); `model` in the request is a hint, the fulfiller reports what it used; `usage` optional
  (estimated at ~4 chars/token when absent so budget accounting still moves); consumed files left in
  place as the run's audit trail; unanswered requests survive a timeout for late fulfillment.
- **Budget semantics:** per-day USD cap is **per node** ("US$5/day/stage" per C7), per-run token cap
  keys on a caller-supplied `runId` and deliberately survives UTC-midnight (a run isn't a day). The
  gate is pre-call and fail-closed with a worst-case estimate (prompt-length input + full
  maxOutputTokens), mirroring brain-ingest's `wouldExceed95` "stop before crossing" semantics.
- **`expectJson` mapping:** OpenAI → `response_format: {type:"json_object"}`; Anthropic + mailbox →
  appended "single valid JSON object" instruction (no structured-output schemas needed yet; docs
  were silent on this — recorded here).
- **Google family is config-valid but adapter-less:** the prefix registry accepts `gemini-*` (so a
  Gemini verifier remains a valid alternative per C6) but api_worker dispatch throws a clear
  RouterConfigError until an adapter is written.
- **CI untouched:** `.github/workflows/ci.yml`'s typescript job covers `shared/` only —
  brain-ingest's typecheck/test is NOT wired into CI, so llm-router follows the same pattern (per
  session spec: mirror only if brain-ingest is wired).

## Left
- Google/Gemini adapter (only needed if the verifier key lands as Gemini instead of gpt-5-family).
- No node consumer yet — the seeder/synthesis/verifier sessions (U5+) are the first importers; the
  barrel `src/index.ts` is their entry point.
- Live-provider verification of both adapters (no keys — see Blockers); wire shapes are asserted
  against mocked fetch only.
- Prices + caps uncalibrated (C7: "raise deliberately when real runs start").

## Blockers
- **No API keys on this machine (register B5):** the api_worker route is fully implemented and
  tested against mocked HTTP but untested against live Anthropic/OpenAI endpoints; the verifier's
  exact non-Anthropic model id + key still needs Jayden (C6). Surfaced downstream as typed
  `RouterKeyMissingError` and `check-config` exit code 2.
- Gate: `npm test` 42/42 + `npm run typecheck` clean in `tools/llm-router/` · `npx tsc --noEmit`
  (shared/) clean · `flutter analyze` clean · `flutter test` 40/40 (generated-file churn reverted) ·
  `context_sync --fix-index` + `--check` pass.

memory: none
