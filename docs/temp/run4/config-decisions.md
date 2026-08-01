---
title: Run 4 — Config Decisions
summary: Run 4's C-entries — config values shipped by this run (model ids, provider posture, retention caps) in value shipped · alternatives considered · rationale form. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-08-01
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

- **C15 · The serving gate is SINGLE-PAPER FAITHFULNESS; corroboration / impact tier / evidence tier
  are demoted to metadata (#300 §E)** — **value shipped** (`shared/brain/index.ts`, all named
  constants, no inline literals):

  ```ts
  SINGLE_PAPER_GATE = {
    relevantVerdicts:         ['supported', 'partial'],
    requireQuoteSpansPresent: true,
    requireDirectionMatch:    true,
    requireClaimKindMatch:    true,
    requireEffectSizeMatch:   true,
    confidenceFloors:         EDGE_GATES,          // { high: 0.8, mid: 0.5 } — UNCHANGED NUMBERS
    nonGatingSignals:         ['corroboration', 'evidenceTier', 'impactTier', 'scopeCheck'],
  }
  ```

  `servingBand()` is now a thin reader of the new `singlePaperGate(v)`; `edgeScore()` keeps its
  pre-C15 composite **bit-for-bit** and is a RANK only. The two floors 0.8 / 0.5 are the same
  numbers as before — what changed is that they now floor **`confidence`** instead of the composite
  `confidence × [base + tier + corroboration]`.

  · **THE OWNER'S DECISION, verbatim (2026-08-01):**

  > "If impact tier or paper reliability is blocking, then ignore them, ignore b too, we focus on
  > single paper verification, your evidence cant shown on UI wont even be surfacing so many info"

  ("b" = the verifier's second job — independent retrieval over OTHER papers plus
  corroboration/impact scoring.)

  · **STATED PLAINLY, NOT SOFTENED: a card can now be served on the strength of a SINGLE paper.**
  Nothing in the gate asks whether the wider literature agrees. The only risk-carrier left is
  `EdgeVerification.caveat` (#300 §E, `tools/brain-ingest/src/verify/caveat.ts`) — e.g. "At least one
  other study points the other way." / "Only one other study backed this up." The caveat is now the
  **sole** mechanism surfacing weak corroboration to the user. That is the owner's explicit,
  informed choice, recorded as such.

  · **the defect this fixes.** A live Agnes run produced
  `sleep_duration_min|correlates|hrv_sdnn_ms` where every check against the CITED paper passed
  (`quoteCheck` 2/2 `allPresent`, `directionCheck` match, `claimKindCheck` match, `effectSizeCheck`
  match at 4.4) and only the OTHER-paper signals were thin (`scopeCheck.mismatch: true`,
  `corroboration {supporting: 1, contradicting: 1}`). It scored `hold @ 0.385` and could never be
  served. That contradicted #300 §E, which says low credibility must be **surfaced via a caveat,
  never used to reject**: the composite was converting thin corroboration into a non-serving band —
  a rejection with extra steps — while the caveat field (#348) already said exactly the right thing.

  · **alternatives considered:** (a) **Lower `EDGE_GATES.mid` until those edges clear the composite**
  — rejected; it re-bands *every* edge, keeps corroboration and tier structurally able to withhold a
  card, and buys the demo three cards by moving an uncalibrated number rather than by fixing what
  the number measures. (b) **Zero the `tier` and `corroboration` weights in `EDGE_WEIGHTS`** —
  rejected; arithmetically similar but it would destroy the ranking too (every edge would rank at
  `confidence × 0.6`, so `servableEdges` could no longer order them) and it would delete real
  metadata from the reviewer-facing breakdown instead of demoting it. (c) **Drop the `mid`
  confidence floor as well, so relevance + faithfulness alone serve** — rejected; `confidence` is
  the verifier's judgment about THIS paper, so it is squarely inside single-paper verification and
  is not one of the signals the owner named. It also keeps a floor under the `low-confidence` caveat
  flag. (d) **Treat `effectSizeCheck.matchesClaim: false` as caveat-only rather than a gate** —
  considered seriously, because in all four live records that flag `false` it comes with
  `extractedSize: null` (i.e. "could not extract", which the caveat vocabulary calls
  `effect-size-unconfirmed`), and gating on it converts "we could not check" into a rejection.
  Rejected anyway: the owner named effect size as one of the three cited-paper checks, and a claim
  asserting a magnitude its cited paper does not carry is unfaithful to that paper. It is the
  strictest of the three and the one to revisit first if it proves to over-block. **Consequence, on
  the record:** it is the sole reason `sleep_duration_min|correlates|resting_hr_bpm` and the
  `sleep_duration_min|decreases|resting_hr_bpm` test fixture stay `hold`. (e) **Delete the
  independent-retrieval machinery entirely** — refused; it is demoted, not removed. It still runs,
  still populates `corroboration` / `evidenceTier` / `scopeCheck`, still feeds the caveat, and
  accepted memory 0012's mandatory `independentRetrieval.performed` is untouched (a record without
  it is still forced to `uncertain` by `enforce.ts`, which the gate reads as `irrelevant-verdict`).

  · **rationale:** the gate now asks exactly one question — *does the claim faithfully represent the
  paper it cites?* — and that question is answerable from the record's own single-paper fields: the
  deterministic quote gate (verbatim spans at stated offsets), then direction, claim kind and effect
  size against that paper, with verdict relevance standing in for "the shown evidence does not
  address this claim at all". The demoted signals are all statements about OTHER papers, and the
  repo already has an honest place to put those: the caveat. Two independent literature-facing
  reasons reinforce the split: the composite's additive FORM is contested (Jüni 1999 / Cochrane's
  abandonment of numeric quality scores, already documented on `EDGE_WEIGHTS`), and this pipeline's
  corroboration counts are partly a **lexical-coverage artifact** — retrieval has no synonym map, so
  `resting_hr_bpm` searches "resting"+"hr" and never "heart rate". Gating on a count produced that
  way was gating on an artifact of the retriever.

  · **what still gates, and was deliberately NOT touched:** the deterministic quote gate (verbatim
  at stated offsets, and the O17 schema rule that a servable verdict requires a passing quote
  check), the non-diagnostic copy gate on caveat text, the decorrelation invariant, Agnes
  acceptance-only enforcement, `independentRetrieval.performed` (memory 0012), and the R4-U4 trust
  posture / model-attestation gate. `nonGatingSignals` is documentation-as-data with a test that
  mutates each listed signal and asserts the band does not move, so re-promoting one silently is
  not possible.

  · **provisional.** `EDGE_GATES` remains uncalibrated (RU2f) and is still backlogged for
  calibration against GRADE-rated exemplars — **phase2-research-fixes B7**, ADR-0003 Open-Q 1–2.
