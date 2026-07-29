---
title: Run 4 — Config Decisions
summary: Run 4's C-entries — config values shipped by this run (model ids, provider posture, retention caps) in value shipped · alternatives considered · rationale form. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-29
---

# Run 4 — Config Decisions

Entry format: **value shipped · alternatives considered · rationale.** All values are
provisional-until-calibrated unless marked otherwise, and every value lives in a config object, never
an inline literal (ADR-0002 mandate). Companion to `docs/shared/insight-engine-architecture.md` §11.

These are *this run's* C-entries. The Phase-2 build run's originals (C1–C12) are archived at
[`docs/archive/runs/run1/config-decisions.md`](../../archive/runs/run1/config-decisions.md) and
[`docs/archive/runs/run1/research-fixes/config-decisions.md`](../../archive/runs/run1/research-fixes/config-decisions.md)
— context only, not ground truth here. Numbering continues from C12.

## Decisions

- **C13 · Provider posture per node — OpenAI everywhere, Anthropic verifier (R4-U3)** —
  **value shipped** (`tools/llm-router/router.config.json`):

  | node | model | family | route |
  |---|---|---|---|
  | `seeder` | `gpt-5-mini` | openai | api_worker |
  | `synthesis` | `gpt-5` | openai | api_worker |
  | **`verifier`** | **`claude-sonnet-5`** | **anthropic** | api_worker |
  | `phrasing_card` | `gpt-5-mini` | openai | api_worker |
  | `report_narrative` | `gpt-5-mini` | openai | api_worker |
  | `extract_assist` | `gpt-5-mini` | openai | api_worker |

  Each node keeps its existing `route` and `maxOutputTokens` — this decision changes the verifier's
  model only. All six models already carry `prices[]` rows (`gpt-5` $1.25/$10, `gpt-5-mini` $0.25/$2,
  `claude-sonnet-5` $3/$15, all flagged `provisional`), so **no new price entries were required**.

  · **alternatives considered:** (a) **Agnes AI as verifier** — the intended endpoint and the one this
  posture is a stand-in for; rejected *for this window only* because the Agnes account is low on
  credit. (b) **Gemini verifier** (`gemini-*`) — equally decorrelated and equally valid under the
  invariant, but `routes/apiWorker.ts` has no Google adapter yet, so it would have meant writing one
  before a verifier call could be made. (c) **Keep the Run 2.0 single-provider all-OpenAI posture**
  under `testMode` — rejected outright: that block existed only to switch the decorrelation invariant
  off, which makes every verifier verdict a same-family self-check that cannot honestly be recorded as
  independently verified. (d) **Anthropic for synthesis too** — rejected; it would re-correlate the
  pair from the other side and burn the scarcer Anthropic budget on the highest-volume node.

  · **rationale:** the decorrelation invariant (memory 0012 / 0013, architecture §10.1) requires only
  that `family(verifier) !== family(synthesis)`; *which* vendor sits on either side is free. OpenAI
  carries the volume (synthesis and all four support nodes) because that is where the run's credit is;
  Anthropic serves the single lowest-volume, highest-stakes node, which is exactly where an
  independent second opinion is worth paying for.

  · **SCOPE — this is a hackathon-demo posture, not a permanent architecture decision.** It is scoped
  to the demo window and holds only while it lasts. **Agnes AI is the intended verifier** once its
  credit allows; swapping it in is a one-line change to `nodes.verifier.model` plus a `providers[]`
  prefix entry, and the invariant will keep enforcing independence either way. Nothing in the code
  depends on the verifier being Anthropic specifically — the vendor-blacklist check that used to
  assume otherwise was removed by this same unit (see below).

  · **enforcement change shipped alongside it:** `tools/llm-router/src/config.ts` previously carried
  `if (verifierFamily === 'anthropic') violated(...)` — a hardcoded vendor blacklist standing in for
  the invariant. It rejected this very (openai, anthropic) pairing while catching nothing the pairwise
  comparison misses. Replaced with a genuine `family(verifier) !== family(synthesis)` comparison that
  hard-fails (`RouterConfigError`), fails closed when either family cannot be resolved, and has **no
  override** — the `testMode` block is deleted, and a config still carrying one is refused rather than
  ignored.

- **C14 · Raw provider-body retention cap — 256 KiB, retained by default (R4-U3)** — **value
  shipped:** `DEFAULT_RAW_BODY_CAP_BYTES = 262144` (`tools/llm-router/src/types.ts`), retention
  **ON by default** for every `api_worker` call (`ApiWorkerOptions.retainRawBody` defaults true), raw
  bodies persisted to `<edges-dir>/verification-raw.jsonl` beside `verifications.jsonl` and joined on
  the loader's own `(edgeId, verifiedAt)` identity · **alternatives considered:** (a) **no cap** —
  rejected, one pathological body could bloat the on-disk artifact unboundedly; (b) **a smaller cap
  (e.g. 32 KiB)** — rejected, it would truncate ordinary verifier responses and make truncation the
  norm rather than the exception; (c) **opt-in retention** — rejected, the defect being fixed is that
  evidence was lost by default, so "forgot to enable it" must not be a way to lose it again;
  (d) **storing the body as a field on `EdgeVerification`** — rejected, that record is ingested into
  `edge_verifications`, which the serving path reads to compose user-facing cards; unreviewed provider
  text must not enter a table that feeds user-facing output, and widening the shared contract would
  also require the two-reviewer `shared/` process · **rationale:** 256 KiB comfortably holds a full
  verifier response (a few thousand output tokens of JSON plus provider metadata is well under
  100 KiB) while bounding the worst case. Truncation is **never silent**: each record carries
  `truncated`, the `capBytes` that cut it, the original `bytes`, and a `sha256` over the **full,
  untruncated** body, so a cut copy still identifies exactly which response it came from.
