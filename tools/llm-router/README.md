# @ourobion/llm-router

Dual-route LLM dispatch for every LLM node in the brain pipeline (agentic seeder, A8 synthesis,
A10 verifier, S8/S9 presentation, A4/A5 extract-assist). Decision anchor:
[`docs/memory/0013-brain-pipeline-and-support-models-decision.md`](../../docs/memory/0013-brain-pipeline-and-support-models-decision.md)
("every LLM node has local-agent and API-worker routes; build the LLM-router first"). Model ids and
budget caps: [`docs/shared/phase2-run-config-decisions.md`](../../docs/shared/phase2-run-config-decisions.md) C6–C7;
node inventory: [`docs/shared/insight-engine-architecture.md`](../../docs/shared/insight-engine-architecture.md) §10.1.

Zero runtime dependencies (native `fetch`, no SDKs). Importing or constructing the router **never
requires an API key** — keys are checked only when an `api_worker`-routed node is actually
dispatched, and a missing key surfaces as a typed `RouterKeyMissingError` naming the env var.

```
npm install        # dev deps only (typescript, tsx, @types/node)
npm run typecheck
npm test           # node --test via tsx, fully offline (mocked fetch, temp dirs)
npx tsx src/cli.ts check-config   # operator report (also: ledger)
```

## The two routes

| Route | What it is | Keys | When |
|---|---|---|---|
| `local_agent` | Filesystem mailbox fulfilled by the **hosting agent session** (e.g. the Claude Code session orchestrating a run) | none | prepopulation / dev runs inside an agent session (§10.1 "off-API terminal rows") |
| `api_worker` | Native-fetch adapters: **Anthropic Messages API** + **OpenAI Chat Completions** | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / (`GOOGLE_API_KEY` reserved — no adapter yet) | metered runtime (CLI on CI, server-side generation) |

The route is **per node in config**, never in node code. The shipped config (Run 2.0 posture)
routes **all six nodes through `api_worker` on OpenAI** — `gpt-5` for synthesis/verifier, `gpt-5-mini`
for the rest — under an explicit **TEST-MODE** block (see below), because `OPENAI_API_KEY` is the
only provisioned key. Flipping a node back to `local_agent` (or another provider) is a one-line
config change.

## How nodes consume it

```ts
import { LlmRouter } from '../llm-router/src/index.js';

const router = new LlmRouter({ runId: 'ingest-2026-07-15' }); // config: tools/llm-router/router.config.json
const res = await router.route({
  nodeId: 'synthesis',              // model/route/token ceiling resolved from config
  system: 'You synthesise RelationshipClaims…',
  prompt: claimBearingSentences,
  expectJson: true,                 // OpenAI: response_format json_object; Anthropic/mailbox: appended instruction
});
res.text; res.usage; res.model; res.route;
```

`route()` = resolve node config → **pre-call budget check** (fail-closed, worst-case estimate) →
dispatch → record actual usage in the ledger. Errors are typed: `RouterConfigError`,
`RouterKeyMissingError` (`.envVar`), `RouterBudgetExceededError` (`.cap: 'day_usd' | 'run_tokens'`),
`RouterHttpError` (`.status`), `RouterTimeoutError` (mailbox).

## Local-agent mailbox — fulfillment contract

An orchestrating agent session must be able to fulfill requests from this section alone.

**Directory.** `router.config.json → localAgent.mailboxDir` (default `data/llm-router/mailbox`,
resolved relative to the repo root; override per-router with `mailboxDir`). The dir is runtime
state (gitignored), never truth. Consumed request/response pairs are **left in place** as an audit
trail of the run.

**1. The router writes `<id>.request.json`** (atomically: `.tmp` + rename). `<id>` is a UUID.

```json
{
  "version": 1,
  "id": "6f0c…",
  "createdAt": "2026-07-15T14:30:00.000Z",
  "nodeId": "synthesis",
  "model": "claude-sonnet-5",
  "system": "optional system prompt",
  "prompt": "the user-turn prompt",
  "maxOutputTokens": 8000,
  "temperature": 0.7,
  "expectJson": true
}
```

- `model` is a **hint** (the config's model for this node). The fulfilling session answers with
  whatever model it is actually running and should report that in the response's `model`.
- `system`, `temperature`, `expectJson` are present only when set.
- When `expectJson` is true, reply with **a single valid JSON object and nothing else** in `text`
  (no prose, no code fences).
- Honour `maxOutputTokens` approximately — the router budgets against it.

**2. The fulfiller answers the prompt and writes `<id>.response.json`.** Write to a temporary name
in the same dir, then rename — the router must never read a half-written file. (The poller also
tolerates unparsable JSON by treating it as not-ready, but atomic rename is the contract.)

Success:

```json
{
  "id": "6f0c…",
  "status": "ok",
  "text": "the model's reply",
  "model": "claude-fable-5",
  "usage": { "inputTokens": 1234, "outputTokens": 567 }
}
```

Failure:

```json
{ "id": "6f0c…", "status": "error", "error": "human-readable reason" }
```

- `id` must echo the request id (a mismatched id is ignored and polling continues).
- `model` and `usage` are optional: agent sessions have no token meter. When `usage` is absent the
  router estimates (~4 chars/token) so budget accounting still moves.
- `status: "error"` rejects the caller's `route()` with the reason.

**3. The router polls** every `pollIntervalMs` (default 500ms) until `timeoutMs` (default 300000ms
= 5 min), then throws a typed `RouterTimeoutError`. Unanswered request files stay behind so a late
fulfiller — or a human — can inspect them.

**Fulfiller loop sketch:** watch the dir for `*.request.json` without a matching `*.response.json`,
answer each prompt (respecting `system`/`expectJson`/`maxOutputTokens`), write the response
atomically, repeat.

## API-worker route

- **Anthropic** — `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`,
  `x-api-key` from `ANTHROPIC_API_KEY`. `expectJson` is enforced via an appended system instruction
  (no JSON-mode switch needed for these nodes). NOTE: current Anthropic models
  (`claude-sonnet-5`) reject non-default sampling params — leave `temperature` unset for them.
- **OpenAI** — `POST https://api.openai.com/v1/chat/completions`, Bearer `OPENAI_API_KEY`,
  `max_completion_tokens` (the current parameter; plain `max_tokens` is rejected by gpt-5-family
  models), `response_format: {type:"json_object"}` when `expectJson`. **Chat Completions was chosen
  over the newer Responses API** deliberately: it is the stable, exhaustively documented surface and
  the router only needs single-turn text/JSON; swapping later is contained to
  `src/routes/apiWorker.ts`.
- **Google** — reserved in the provider registry (`GOOGLE_API_KEY`) so a Gemini-family verifier is
  a valid *config*, but no adapter is implemented yet (C6's provisional verifier is gpt-5-family).
  Dispatching a google-family model through `api_worker` throws a clear `RouterConfigError`.
- **Retry** — exponential backoff on 429/5xx (default 3 attempts, 500ms base, doubling); other
  non-2xx fail immediately. `fetch`/`sleep`/`env` are injectable, so everything is testable offline.

## Config reference (`router.config.json`)

```jsonc
{
  "version": 1,
  "testMode": {                 // OPTIONAL — downgrades decorrelation violations to warnings (see above)
    "reason": "non-empty justification (REQUIRED when the block is present)"
  },
  "nodes": {                    // all six node ids REQUIRED; models per C6 (Run 2.0: all OpenAI)
    "synthesis": { "model": "gpt-5", "route": "api_worker", "maxOutputTokens": 8000 }
    // seeder, verifier, phrasing_card, report_narrative, extract_assist …
  },
  "providers": [                // model-id prefix → vendor family + key env var (first match wins)
    { "prefix": "claude-", "family": "anthropic", "envKey": "ANTHROPIC_API_KEY" },
    { "prefix": "gpt-",    "family": "openai",    "envKey": "OPENAI_API_KEY" },
    { "prefix": "gemini-", "family": "google",    "envKey": "GOOGLE_API_KEY" }
  ],
  "prices": {                   // USD per 1M tokens — ALL PROVISIONAL (C7), used only for budget accounting
    "claude-sonnet-5":  { "inputUsdPerMTok": 3.0,  "outputUsdPerMTok": 15.0, "provisional": true },
    "claude-haiku-4-5": { "inputUsdPerMTok": 1.0,  "outputUsdPerMTok": 5.0,  "provisional": true },
    "gpt-5":            { "inputUsdPerMTok": 1.25, "outputUsdPerMTok": 10.0, "provisional": true },
    "gpt-5-mini":       { "inputUsdPerMTok": 0.25, "outputUsdPerMTok": 2.0,  "provisional": true }
  },
  "budget": {                   // C7 caps — set LOW for Run 2.0 (whole-run budget ≈ US$14.7 / 20 SGD)
    "perRunOutputTokens": 60000,    // output tokens per run (runId)
    "perDayUsdPerNode": 1.0,        // USD per UTC day per node/stage
    "hardStopFraction": 0.95,       // refuse the call that would cross this line
    "ledgerPath": "data/llm-router/ledger.json",  // repo-root-relative unless absolute
    "retentionDays": 30             // optional (default 30): ledger entries older than this are pruned
  },
  "localAgent": {
    "mailboxDir": "data/llm-router/mailbox",      // repo-root-relative unless absolute
    "timeoutMs": 300000,
    "pollIntervalMs": 500
  }
}
```

**Validation fails loudly at load** (`RouterConfigError`): shape, six nodes present, every node
model prefix-resolves to a family and has a price row, budget sanity — and the **decorrelation
invariant**:

> `family(nodes.synthesis.model) !== family(nodes.verifier.model)` **and**
> `family(nodes.verifier.model) !== 'anthropic'`

A same-family verifier shares the synthesizer's blind spots (memory 0013 / brain-synthesis-design);
per architecture §10.1 the verifier is non-Anthropic. No violating config can be constructed —
**except under TEST-MODE**:

### TEST-MODE (`testMode` block)

```jsonc
"testMode": { "reason": "why decorrelation is deliberately off (REQUIRED, non-empty)" }
```

Presence of this block downgrades the two decorrelation clauses from hard load failures to a
**loud warning naming the violated invariant** (everything else still fails hard). It exists for
the Run 2.0 single-provider posture: only `OPENAI_API_KEY` is provisioned, so synthesis and
verifier share a family and verifier verdicts are *not* independently verified. While it is set:

- config load / `check-config` warn and report `decorrelation.ok: false` + the test-mode state;
- every `route()` result carries `testMode: { reason, label }`, where `label` is the exported
  constant `TEST_MODE_LABEL` — exactly
  `scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)` — which downstream
  units MUST stamp on verifier verdicts / UI / logs.

Delete the block (and restore a second provider) to re-arm the hard invariant; without the flag,
validation behaves exactly as before.

## Budget / ledger

Two caps, both hard-stopped at 95% (mirrors `tools/brain-ingest/src/limits/budget.ts` semantics):
per-day **per-node** USD ($1, Run 2.0 low posture) and per-run output tokens (60k). The gate is **pre-call and
fail-closed**: worst-case estimate = prompt-length input (~4 chars/token) + the call's full output
ceiling; the call is refused before dispatch when the projection lands at or beyond the hard-stop
line, and actual usage is recorded after. The ledger is a small JSON file (atomic tmp+rename
writes, crash-tolerant reads); prices come from the config table and are **provisional** — the
sonnet-5 sticker ($3/$15) is used rather than its time-boxed intro pricing, and the gpt-5 row is a
placeholder pending the real verifier key (B5).

**Lifecycle (audit A11).** Day and run entries whose UTC day is older than `budget.retentionDays`
(optional, default 30) are pruned on every ledger load and persist, so the file — and the `ledger`
CLI/`state()` run listing — stays bounded. Runs carry no completion marker, so a run counts as
completed once its `startedAt` day ages out of the window. The on-disk format is unchanged
(version 1): an old ledger file loads fine and simply gets pruned.

**Concurrency (audit A10).** `record()` re-reads the on-disk ledger and merges it with in-memory
state before persisting (element-wise max — since every instance persists after each record, the
file supersets its own past writes, so max yields the union of every writer's spend without
double-counting; runs union with max tokens + earliest start). Two concurrent processes therefore
no longer drop each other's spend. Residuals, deliberately accepted: (a) two writers inside the
same read→rename window can drop at most **one call's** usage, and (b) a process's **pre-call
gate** reads the ledger as of its own last `record()`, so it can be up to one call behind another
writer — both are exactly the in-flight overlap the 5% hard-stop headroom exists to absorb. No
cross-process file lock is attempted. The run-token cap merges cleanly (run counters only grow),
so **no single-writer assumption remains** for either cap.

## CLI

```
npx tsx src/cli.ts check-config   # nodes/models/families/routes, decorrelation verdict, keys y/n, caps
npx tsx src/cli.ts ledger         # today's per-node spend + per-run output tokens
```

`check-config` exit codes: `0` valid · `1` invalid config (incl. decorrelation violations) ·
`2` valid but an `api_worker`-routed node is missing its provider key (blocked-on-key, B5).

## Live smoke script (costs money)

`scripts/smoke-openai.ts` is a **manual, run-once** proof of the real OpenAI api_worker path. It is
NOT part of `npm test` and **spends real USD** (well under $0.01/run): it loads `OPENAI_API_KEY`
from `tools/brain-ingest/.env`, routes one tiny request through `phrasing_card` (gpt-5-mini), and
prints the router result plus the ledger entry it recorded.

```
cd tools/llm-router && npx tsx scripts/smoke-openai.ts
```

## Testing

`npm test` — 56 tests, fully offline: config validation incl. every decorrelation failure mode
and the TEST-MODE downgrade contract (single-provider hard-fails without the flag, warns with it,
`reason` required, results carry `TEST_MODE_LABEL`);
both adapters against mocked fetch (wire shapes, 429 backoff, 5xx exhaustion, non-retryable 400,
key-missing before any network); mailbox round-trip with the response written by the test playing
the fulfilling agent (timeout, error responses, half-written-JSON tolerance); both budget hard
stops, persistence, UTC-day reset, retention pruning (boundary day kept, old-format file loads,
`retentionDays` override), and interleaved two-writer merges (summed totals, hard stops on merged
spend); facade dispatch on both routes + `checkConfig`.
