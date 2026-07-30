# @ourobion/llm-router

Config-driven LLM dispatch for the six brain-pipeline nodes. The router enforces provider-family
decorrelation, budget caps, model-identity provenance, and raw response retention. It has no runtime
dependencies: provider calls use native `fetch`, while tests use mocked fetch and temporary files.

The checked-in [`router.config.json`](./router.config.json) remains the production authority. Its
assignments are unchanged: OpenAI `gpt-5` synthesis, Anthropic `claude-sonnet-5` verification, and
OpenAI `gpt-5-mini` for the other four nodes. Agnes is registered but assigned to no production
node; it is available only through the bounded acceptance seam below.

```powershell
npm run typecheck
npm test
npx tsx src/cli.ts check-config
npx tsx src/cli.ts ledger
```

## Routes and providers

Each node selects one route in config:

- `local_agent`: a keyless filesystem mailbox under `data/llm-router/mailbox`.
- `api_worker`: a native-fetch adapter selected by the model prefix.

Implemented API adapters:

- Anthropic Messages: `POST https://api.anthropic.com/v1/messages`, `x-api-key`,
  `anthropic-version: 2023-06-01`.
- OpenAI Chat Completions: `POST https://api.openai.com/v1/chat/completions`, Bearer auth,
  `max_completion_tokens`, and JSON response format when requested.
- Agnes Chat Completions: `POST https://apihub.agnes-ai.com/v1/chat/completions`, Bearer auth,
  OpenAI-compatible messages, and `max_tokens`. This adapter is acceptance-only and never probes
  `GET /models`.

Google model prefixes remain valid configuration vocabulary, but no Google adapter is implemented.
Missing provider keys fail before fetch with `RouterKeyMissingError`.

`api_worker` retries ambiguous transport failures, 429, 5xx, and successful non-JSON responses with
exponential backoff. Other 4xx responses fail immediately. Provider response bodies are retained by
default with a byte cap, full-body SHA-256, and an explicit truncation flag.

## How nodes consume it

```ts
import { LlmRouter } from '../llm-router/src/index.js';

const router = new LlmRouter({ runId: 'ingest-2026-07-15' });
const response = await router.route({
  nodeId: 'synthesis',
  system: 'You synthesise RelationshipClaims…',
  prompt: claimBearingSentences,
  expectJson: true,
});
```

The router resolves model/route/token limits from config, performs the pre-call budget check,
dispatches, records actual usage, and returns text, usage, model identity, route, and provider raw
evidence when applicable. Errors are typed: `RouterConfigError`, `RouterKeyMissingError`,
`RouterBudgetExceededError`, `RouterHttpError`, and `RouterTimeoutError`.

## Config reference

All six node entries are required. Provider prefixes map models to families and key environment
variables; every assigned model needs a positive price row. Injected config objects are cloned and
validated exactly like the checked-in file.

```jsonc
{
  "version": 1,
  "nodes": {
    "synthesis": { "model": "gpt-5", "route": "api_worker", "maxOutputTokens": 8000 },
    "verifier": { "model": "claude-sonnet-5", "route": "api_worker", "maxOutputTokens": 8000 }
    // seeder, phrasing_card, report_narrative, extract_assist are also required
  },
  "providers": [
    { "prefix": "claude-", "family": "anthropic", "envKey": "ANTHROPIC_API_KEY" },
    { "prefix": "gpt-", "family": "openai", "envKey": "OPENAI_API_KEY" },
    { "prefix": "agnes-", "family": "agnes", "envKey": "AGNES_API_KEY" }
  ],
  "prices": {
    "claude-sonnet-5": {
      "inputUsdPerMTok": 3,
      "outputUsdPerMTok": 15,
      "provisional": true
    }
  },
  "budget": {
    "perRunOutputTokens": 60000,
    "perDayUsdPerNode": 1,
    "hardStopFraction": 0.95,
    "ledgerPath": "data/llm-router/ledger.json",
    "retentionDays": 30
  },
  "localAgent": {
    "mailboxDir": "data/llm-router/mailbox",
    "timeoutMs": 300000,
    "pollIntervalMs": 500
  },
  "acceptance": {
    "journalPath": "data/llm-router/acceptance-attempts.jsonl"
  }
}
```

Validation rejects malformed shapes, missing/unknown nodes, unmapped models, missing/invalid price
rows, unsafe caps/paths, legacy `testMode`, and same-family synthesis/verifier assignments.

## Decorrelation and identity

Config validation always requires the synthesis and verifier models to resolve to different vendor
families. A legacy `testMode` block is rejected; there is no downgrade path.

Provider-returned model ids are distinct from configured model echoes. Only ids parsed from a
provider response may set `providerAttested: true`. The router fills the configured family and the
verifier-versus-synthesis decorrelation result without promoting an unattested identity.

## Bounded two-leg acceptance

The owner-authorised acceptance seam is compiled policy, not a general provider switch:

- only Anthropic synthesis and Agnes verification are accepted;
- one canonical `JSON.stringify([{role,content}, ...])` message array (including roles and injected JSON
  instructions/separators) drives the 24,000-byte cap, journal hash, and conservative one-token-per-byte
  reservation; model and `max_tokens` are routing controls, not model input;
- every possible POST is reserved before dispatch in an append-only, hash-chained JSONL journal;
- the router alone owns `data/llm-router/acceptance-attempts.jsonl`; path overrides, traversal, tracked
  paths, symlink/junction aliases, and non-ordinary journal/lock files are refused;
- an adjacent exclusive lock serializes replay, cap check, append, and fsync across processes;
- transport, schema, and enforcement retries reuse one bounded SHA-256 id derived from the real pair/edge;
- Anthropic permits at most three POST starts per logical call; Agnes permits ten. Both caps span run ids;
- one journal has a global US$5 reservation ceiling, which a new run id cannot reset;
- prices must be authoritative (`provisional: false`) before an acceptance call can start;
- missing/mismatched identity, missing/truncated raw evidence, unknown outcomes, corrupt/unreadable
  journals, and malformed/future/live locks all fail closed.

A reservation counts in full after a crash. The journal provides conservative append-and-fsync
accounting; it does not claim stronger filesystem power-loss atomicity.

Every synthesis provider attempt retains pair-scoped returned identity and raw evidence in the
local-only `edges/synthesis-raw.jsonl` sidecar, including valid adverse/empty, parse-error, and
terminal enforcement-rejected results. Verification uses
`edges/verification-raw.jsonl`. Neither sidecar is uploaded by the R2 artifact writers or read by
the serving edge-loader.

## Budget ledgers

Ordinary routing enforces per-day, per-node USD caps and per-run output-token caps before dispatch,
using a worst-case estimate. Actual provider usage is recorded after completion. Only `ENOENT`
initializes a clean ledger; malformed, unsupported, or unreadable historical state fails closed so
past spend cannot silently reset.

The acceptance journal is the stronger cross-process reservation authority for the bounded two-leg
run. It is separate from the ordinary usage ledger because it accounts before each potentially
billable POST, including ambiguous/crashed attempts.

Ordinary-ledger lifecycle remains bounded: UTC day and run entries older than
`budget.retentionDays` (default 30) are pruned on load/persist. Concurrent writers re-read and
merge monotonically increasing counters before atomic temp-file rename. The residual one-call
read/rename overlap is covered by the configured hard-stop headroom; the acceptance journal uses
its stronger exclusive-lock protocol instead.

## Local-agent mailbox

The mailbox directory comes from `localAgent.mailboxDir` (repo-relative unless absolute) and is
gitignored runtime state. Consumed request/response pairs remain as a run audit trail.

The router atomically writes `<id>.request.json`:

```json
{
  "version": 1,
  "id": "request-id",
  "createdAt": "2026-07-15T14:30:00.000Z",
  "nodeId": "synthesis",
  "model": "configured model hint",
  "system": "optional system prompt",
  "prompt": "the user-turn prompt",
  "maxOutputTokens": 8000,
  "expectJson": true
}
```

The fulfiller should treat `model` as a hint, respect the JSON/output instructions, and atomically
write `<id>.response.json` through a temporary file and rename. Successful responses use:

```json
{
  "id": "request-id",
  "status": "ok",
  "text": "model output",
  "model": "actual model when known",
  "usage": { "inputTokens": 123, "outputTokens": 45 }
}
```

`model` and `usage` are optional. Missing usage is estimated so budget accounting advances.
Failure responses use `{"id":"request-id","status":"error","error":"reason"}`. A mismatched id is
ignored, half-written/unparseable JSON is treated as not ready, and polling continues every
`pollIntervalMs` until `timeoutMs`, then throws `RouterTimeoutError`. Unanswered requests stay
for inspection. Mailbox output is never provider-attested and has no raw provider body.

A fulfiller loop watches for request files without matching response files, answers each prompt,
writes the response atomically, and repeats.

## CLI

```powershell
npx tsx src/cli.ts check-config
npx tsx src/cli.ts ledger
```

`check-config` reports models, families, routes, decorrelation, key presence, and effective caps.
Exit codes are 0 for valid, 1 for invalid config, and 2 when valid API-routed nodes are blocked on a
missing key. `ledger` reports current per-node/day spend and per-run output tokens.

## Live smoke script (costs money)

`scripts/smoke-openai.ts` is a manual, run-once proof of the real OpenAI route. It is not part of
tests and spends real USD. It loads `OPENAI_API_KEY` from the brain-ingest environment, sends one
small `phrasing_card` request, and prints the router result plus ledger entry:

```powershell
cd tools/llm-router
npx tsx scripts/smoke-openai.ts
```

Do not run the smoke script as part of offline verification or acceptance plumbing work.

## Tests

The 113-test router suite is fully offline. It covers adapter wire contracts, retry behavior,
identity/raw retention, decorrelation, budgets, mailbox routing, and the acceptance facade. Journal
tests include a real nine-child-process barrier proving exactly three starts under contention,
a six-child distinct-id race at the global cap, crash/stale-lock recovery, nonce replacement,
malformed/future/live locks, path-alias rejection, corrupt/truncated/tampered/unreadable history,
ambiguous/stream-read outcomes, redaction, terminal lifecycle conflicts, and fsync failure.
