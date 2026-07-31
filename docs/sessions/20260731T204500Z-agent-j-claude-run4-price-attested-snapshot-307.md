---
title: Run 4 — account an attested model snapshot that has no price row, instead of zeroing it
summary: A live two-paper whole-paper synthesis run spent US$0.055 and recorded US$0.000000, because OpenAI attests a dated snapshot id (gpt-5-2025-08-07) that has no prices[] row while only the configured id (gpt-5) does — making --max-usd decorative; accounting now falls back to the configured node rate and refuses outright if neither is priced.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 — price the attested snapshot (#307)

Issue: #307; branch: `fix/brain/price-attested-snapshot-307`; base and exact head:
`783010e` (`dev-phase2-run4` tip at branch cut, = PR #312 merge line); device: `agent-j`;
agent: `claude` (Opus 5, 1M context).

## Attempted

- The half of #307 task 2 that needs no verifier: whole-paper synthesis against the nao corpus,
  to establish whether the post-#300 path emits claims at all.

## Changed

- `tools/brain-ingest/src/synth/paperRun.ts` — G2 spend accounting now prices the
  provider-**attested** model id when it has a `prices[]` row, else falls back to the **configured**
  node model (`nodes.synthesis.model`), and **throws** if neither is priced rather than continuing an
  unaccountable run.
- `tools/brain-ingest/tests/paperSynth.test.ts` — the batch fixture gains
  `nodes.synthesis.model`, plus a regression test that drives an attested snapshot id absent from
  `prices[]` and asserts the ceiling still fires.

## Decided

- **This was a real fail-open, found by running the thing rather than by reading it.** The live run
  logged `WARNING cannot price 'gpt-5-2025-08-07'` and recorded `US$0.000000` for two calls that
  actually cost **US$0.055093**. `costUsd` throws when a model has no `prices[]` entry, and the
  original code caught that, warned, and left `callUsd = 0`. So `--max-usd` could never fire —
  a **decorative** budget ceiling. This is the second fail-open on the same control in this run (the
  first was `--max-usd -5` parsing as a flag and meaning "no ceiling").
- **The fallback is the configured rate, not zero and not a guess.** `response.model` is the
  provider-attested id, which for OpenAI is a dated snapshot (`gpt-5-2025-08-07`); `prices[]` keys
  the configured id (`gpt-5`). The configured rate is the one that was actually authorised for the
  node, so charging against it is honest. **No pricing was invented** — the fallback reuses the
  existing owner-verified `gpt-5` entry.
- **Refusing beats guessing when neither id is priced.** At that point the run cannot account its own
  spend, and continuing would silently burn budget, so it throws.
- **Split out of the held Agnes PR #313 deliberately.** #313 is blocked (see Left) and this fix is
  independently valuable and independently verifiable, so holding it behind a blocked PR would have
  left a measured money fail-open unlanded.

## Verification — the live run, reported honestly including the zero results

Manifest hydrated **0 → 1,298** records. Corpus: **756 fetched**, **739 with full text > 5,000
chars**.

**Dry run** (`doi:10.3390/nu18091412`, the exact paper #300 measured): whole paper — **59,420
chars**, **24 active metrics**, `FULL PAPER TEXT` present once, and **`depressive` appears 21 times
in the prompt**. Those are precisely the sentences the old `defaultTermsForKeys` window never
showed the model (`comfort` occurs 0 times in that paper). **§A works at the prompt level.**

**Two live `gpt-5` calls, both `0 accepted, 0 rejected`:**

| Paper | Chars | Prompt tok | Completion (reasoning) | Result |
|---|---|---|---|---|
| `doi:10.3390/nu18091412` (review) | 59,420 | 11,841 | 1,040 (1,024) | `{"claims": []}` |
| `doi:10.2147/jpr.s584043` (primary study) | 41,426 | 9,449 | 1,808 (1,792) | `{"claims": []}` |

Both `finish_reason: stop`, both attested `gpt-5-2025-08-07`, `providerAttested: true`. The model
**received the whole paper and deliberated** (1,024 / 1,792 reasoning tokens) and then proposed
nothing. This is a clean empty answer, not a parse failure, not a gate rejection: `adverse-empty`.

**So the honest headline: whole-paper input fixed the READING problem and did NOT by itself produce
claims.** #300's premise — that the prefilter was why two live runs returned `0 accepted, 0
rejected` — is only partly right. The prefilter was real and is fixed; something else also
suppresses emission.

**Diagnosis, with the wrong hypothesis discarded.** My first hypothesis was that `ownFinding: true`
is impossible for a **review** (everything a review reports is cited), which would make reviews
yield zero by construction — and the corpus is review-heavy (**243** review-ish vs **113**
primary-looking of the 739). That hypothesis is **insufficient**: a primary intervention study
returned empty too.

The likelier cause is a **SHAPE MISMATCH**, not a reading or threshold problem:

- The claim contract wants a relationship between **two ACTIVE registry metrics**.
- The 22–24 active metrics are self-tracked user variables: `mood_score`, `gut_comfort_score`,
  `stool_form`, `sleep_duration_min`, `hrv_sdnn_ms`, `urine_colour`, …
- The literature overwhelmingly reports **intervention → outcome** (music → pain/mood/HRV;
  rehydration drink → fatigue; diet → microbiome), not **outcome × outcome**. A paper rarely states
  "mood and sleep duration move together" — it states "our intervention improved both".

A second, smaller factor: six active metrics carry **no `ui.label`** (`resting_hr_bpm`,
`hrv_sdnn_ms`, `sleep_duration_min`, `spo2_pct`, `body_temp_c`, `step_count`) — exactly the wearable
physiology metrics most likely to appear in these papers — so the prompt shows them as bare
snake_case keys with no human-readable gloss.

Neither is fixed by loosening a threshold, exactly as #300 said.

### CORRECTION — the shape-mismatch hypothesis was WRONG, and the real cause was mine

Screening the corpus for papers whose title+abstract name **two or more** active-metric concepts
returned **165 of 739** — so candidates were never scarce, and **neither of my two test papers was
in that set**: I had picked them by topic keyword, not by this signal.

Running one paper from the ranked set (`doi:10.2196/73812`, *Association Between Digital Biomarkers
of Health and Anxiety*) emitted a claim immediately — and it was rejected with:

```
REJECT sleep_duration_min (min)|no_effect|anxiety_score — inactive-metric-key:
  endpoint(s) not an active shared/metrics registry key: sleep_duration_min (min)
```

**The model had appended the unit to the key**, because `metricsBlock()` rendered
`${key}${label}${unit}` — so a metric with a unit and NO `ui.label` collapsed to
`sleep_duration_min (min)`, with nothing but a space and a paren between key and unit. **A real
claim was lost to my own prompt formatting**, and it hit exactly the six unlabelled wearable metrics.

Fixed: the key is now emitted alone and QUOTED before any gloss, with annotations explicitly named
(`"sleep_duration_min"  — unit: min`), plus an instruction never to append a unit or parentheses.
Regression test pins that the corrupted form is unrenderable.

**Re-running the same paper then produced the first accepted claim in the project's history:**

| Field | Value |
|---|---|
| edgeId | `sleep_duration_min\|no_effect\|anxiety_score` |
| claimKind | `correlational`, evidenceTier **3** (corpus classifier, not the model) |
| quote | *"No association between TST and anxiety symptoms was observed"* — verbatim at chars **31460–31520** |
| locator | `Results` (past the 15% intro zone) |
| mechanism span | **absent — correctly** |

Three things worth noting about that result:
- It is a **negative** finding (`no_effect`). The pipeline is not merely confirming what we hoped
  for, and `no_effect` is valuable in its own right — it stops a dead edge being re-proposed.
- The model **omitted the mechanism span rather than inventing one**, which is precisely what §B's
  "omitting is correct and expected; inventing is the worst thing you can do" instruction is for.
  A `no_effect` correlational finding has no pathway to state.
- The gate did its job in both directions: it rejected the malformed endpoint and accepted the clean
  one, with no threshold changed.

**So the corrected diagnosis: the pipeline works. The zero results were (1) paper selection and
(2) a prompt-formatting defect I introduced in #300 — not a shape mismatch, and not a threshold.**
The owner decision I asked for on #307 (options A/B/C/D) is therefore **no longer needed as posed**;
option (C) is simply the right screening signal and it is already viable at 165 candidates.

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck / tests | clean / **458/458** |
| `node tools/context_sync.mjs --check` | passed |
| `git diff --check` | clean |

**Spend this session: 2 calls, US$0.055093** (11,841+9,449 in / 1,040+1,808 out at the verified
`gpt-5` rate). **Running total US$0.099093** against OpenAI US$20. Anthropic and Agnes: **zero
calls**.

## Left

- **#313 is HELD, not merged** — flipping the verifier to Agnes makes `verify` unreachable, because
  Agnes is enforced acceptance-only and the ordinary `verify` CLI attaches no acceptance context.
  Blocker and three options posted on #307; awaiting the owner.
- **The shape mismatch is the real #300 follow-up** and needs an owner decision, since every route to
  fixing it touches an explicit #300 constraint: relax `ownFinding` for reviews, or admit
  intervention→outcome claims, or screen exclusively for papers that correlate two self-tracked
  measures. I did not pick one unilaterally.
- Add `ui.label` for the six wearable metrics — but `shared/metrics/**` is **Session B's territory**.
- `data/corpus/demo-edges/` does not exist yet; #246 hard-requires `verifications.jsonl` there, which
  needs the verifier unblocked first.
- Both MVP goals (task 3) unstarted.

## Blockers

- #313 / verification — see Left and the #307 thread.

memory: none
