---
title: Run 4 — D3-a Agnes code fences, D2 mechanism-vs-limitation, D1-a blueprint yield, and the logicalCallId collision
summary: Fixed four defects found by running the post-#300 flow live — Agnes wraps valid JSON in a markdown fence so 14 verdicts were discarded on formatting; mechanism spans were labelled from an under-specified prompt so limitations passed as biology; the blueprint ask yielded 1 per 15 papers against a needed 3-5; and the verifier logicalCallId keyed on edgeId alone so two papers supporting one edge aborted the run.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — four defects from the live flow test (#307)

Issue: #307; branch: `feat/brain/flowtest-300-batch`; base and exact head at cut:
`57cf3bd` (the PR #313 merge); device: `agent-j`; agent: `claude` (Opus 5, 1M context).

Owner decisions taken on the issue: **D1-a**, **D2** (revised — see below), **D3-a**,
**D4** = two cards quoting both papers, **D5** = yes. Authorised: **A1, A2, A4, A5**.

## Attempted

- Act on the four defects the 16-paper live batch surfaced, all of which were found by *running* the
  pipeline rather than reading it.

## Changed

### D3-a · Agnes returns JSON inside a markdown code fence

`enforce.ts` gained `stripJsonCodeFence()`, applied before `JSON.parse`. Agnes returns:

```
"\n\n```json\n{ \"verdict\": \"uncertain\", … }\n```"
```

so `JSON.parse` choked on the backticks and **all 14 live verifier calls** were recorded as
`unparseable reply`, burning two attempts each and falling back to `uncertain`.

**Agnes was correct the whole time.** Its own `reasoning_content`:

> *"…the rules state: 'if no sources were retrieved at all → the verdict can only be uncertain.'
> Since no evidence sources were provided, I must answer uncertain with an empty sourceStances array."*

It followed the contract including the fail-closed grounding rule. We were discarding correct
verdicts over a wrapper.

Deliberately **conservative**: it unwraps a fence and nothing else. It does **not** hunt for the
first `{` in arbitrary prose, which would start salvaging JSON out of commentary and quietly accept
genuinely malformed replies. Verified against the **actual captured body** — real reply parses,
plain JSON still parses, `not json at all` and ```` ```fenced garbage``` ```` both still fail closed.

### D2 · Mechanism spans that were actually limitations

Two of four emitted spans quoted *"This lack of association may be due to the limited variability in
sleep quality in this population and the small sample size."* — verbatim, so the quote gate passed
it, labelled `mechanism:`. On a card that tells a reader their body works a certain way when the
paper only said its own sample was too small.

- `paperPrompt.ts` — defines mechanism vs limitation, carries **both real sentences as worked
  examples**, states a `no_effect` claim takes **no** mechanism span, and requires an explicit
  `mechanismIsPathway: true` declaration.
- `paperPostprocess.ts` — the `mechanism:` label is applied **only** on that declaration. An
  undeclared span is **demoted** to plain evidence: quote retained at exact offsets, we simply stop
  asserting it is the mechanism.

### D1-a · Blueprint yield

`paperPrompt.ts` — the blueprint ask was rewritten. Three things were wrong, all ours: it opened
with "OPTIONALLY"; it said "weekly self-tracked data", which reads as excluding session-scale
findings (most HR/HRV work) when the user logs these metrics **daily** so any co-movement shows up
across a week; and it never said a blueprint is what becomes a **card**, so the model had no way to
know it was the load-bearing output.

`PAPER_PROMPT_VERSION` bumped `…2026-08-01.1` → `.2`.

### The verifier `logicalCallId` collision — four coupling sites

`verifierLogicalCallId()` exported from `verifier.ts`, deriving from **edgeId + promptVersion +
sorted paperIds** rather than edgeId alone, and now used by all four sites that previously
duplicated the formula:

| Site | Was |
|---|---|
| `verifier.ts` router call | inline `logicalCallIdSha256('verifier', claim.edgeId)` |
| `verify.test.ts` assertion | a **copy of the formula** |
| `liveAcceptance.ts` drift check | a second copy |
| `liveAcceptance.ts` verification-leg `validateJournal` | a **fourth** copy |

### The run-summary accounting gap

A real run printed `2 synthesised, 0 already done, 0 not reached (of 3 requested)` — 2+0+0 ≠ 3,
because a **failed** paper was counted in none of the buckets. `papersFailed` added to
`BatchBudgetReport`; the CLI prints all four buckets, warns if they do not sum to
`papersRequested`, and lists each failure with its detail.

## Decided

- **The mechanism judgement belongs to the MODEL, not to a phrase blocklist — and the owner was
  right to push back on my first answer.** I proposed a deterministic filter on limitation language
  and argued against trusting the model because it got 2 of 4 spans wrong. Both parts were wrong:
  1. **The model was never asked.** The prompt said "the sentence explaining WHY the relationship
     holds" and never said a methodological caveat disqualifies. For a `no_effect` claim that
     instruction has **no referent at all** — there is no relationship — so the model reached for the
     nearest sentence explaining the absence. It answered the question actually put to it. This was a
     prompt-specification failure, not a model-judgement failure.
  2. **A blocklist is the wrong instrument.** `"may be due to"` occurs in genuine hedged mechanisms
     as readily as in limitations, so no phrase list separates them. The general rule I had inverted:
     **deterministic gates belong on facts with ground truth** (is this quote verbatim at these
     offsets, is this key in the registry); **judgements belong to the model.**
- **The verifier is the second slice of the Swiss-cheese model, and my first design ignored it.**
  The verifier exists precisely to catch synthesis hallucination, and the decorrelation invariant
  guarantees it is a **different vendor family** so its holes do not align. "Synthesis declares +
  demote if undeclared" is one slice plus a keyword list. Layer 2 — a `mechanismCheck` axis on
  `EdgeVerification`, decided by the different-family verifier alongside the existing
  `directionCheck`/`claimKindCheck`/`scopeCheck`/`effectSizeCheck` — is **specified on the issue and
  deliberately not implemented here**: it touches `shared/brain`, the verifier prompt and
  enforcement, and deserves its own PR. `isPathway: false` must strip the label **without** rejecting
  the claim, the same principle as a rejected blueprint not costing a good edge.
- **Demotion, not rejection, is the fail-closed default** for an undeclared span. The failure mode
  becomes under-claiming rather than mislabelling, and that holds regardless of how well either
  layer performs.
- **One derivation, four call sites, no shared helper** is why a one-line collision fix became a
  four-site change. Extracting the helper was the fix; patching site 1 and moving on would have left
  three copies to drift.

## Verification

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck / tests | clean / **463/463** |
| `tools/llm-router` tests | **121/121** |
| `shared` `npx tsc --noEmit` | clean |
| `context_sync --check` / `git diff --check` | passed / clean |

**Measured, live:**

- **D1-a works.** `doi:10.1371/journal.pdig.0001284`: **2 claims / 0 blueprints → 2 claims / 2
  blueprints**. One blueprint per directional claim, up from zero.
- **My first D1-a test was a badly designed experiment.** I ran the strengthened prompt on 5 papers
  that produce **no claims**, and a blueprint hangs off a claim — so it measured nothing. US$0.157
  spent learning my selection was wrong, not that the fix was.
- **Revised A3 projection, from measured rates:** 0.6 claims/paper × ~60% directional × ~1
  blueprint per directional claim ≈ **0.4 blueprints/paper**, so 50 cards ≈ **125 papers ≈ US$6.25**
  — well inside the US$20 ceiling, against my earlier US$37 estimate. Honest range **US$6–10**; the
  blueprint rate rests on one paper's before/after, so re-measure after ~30 papers rather than
  committing to 125 blind.
- **`data/corpus/demo-edges/verifications.jsonl` now exists** — #246's hard requirement — written by
  a single-claim run after the batch had aborted before the write path.
- The copy gate fired **twice** across these runs, rejecting derivations with diagnostic language.
  Losing those claims is the correct trade.

**Spend: US$1.118 OpenAI** (of US$20) · **Anthropic 0** (do-not-use honoured) · **Agnes 18 of 50**,
US$0 (free plan). A2 used 2 Agnes calls as authorised.

## Left

- **Layer 2 of D2** — the verifier-side `mechanismCheck`. Specified on #307, not implemented.
- **A5** — the product-snapshot pin removal (owner-authorised, option 1).
- **A4 / D5** — MVP goal 1: ≥20 seed topics + bounded ingestion.
- **A3** — the full batch, once the ~US$6–10 number is accepted.
- The `uncertain` verdict from A2 is honest, not a defect: the run had no `--corpus`, so retrieval
  returned zero sources and the schema correctly forbids a grounded verdict. Future batches must
  pass a corpus.

## Blockers

- None.

memory: none
