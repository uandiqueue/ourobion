---
title: Single-paper verdicts (#300 §E) — the verifier stops asking whether OTHER studies agree
summary: PR #350 demoted corroboration from the serving band but not from the verdict, so a faithful single-paper claim still came back `unsupported` (conf 0.92) with the caveat "The other studies found did not back this up". The verdict now answers one question — is this claim a faithful reading of the ONE paper it cites — enforced by the quote gate plus `directionCheck` plus a causal-inflation check. Corroboration, impact tier, venue prestige and evidence tier are still computed and stored but cannot move the verdict; they reach the user only through `caveat`. Independent retrieval stays mandatory.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Single-paper verdicts (#300 §E) — corroboration stops steering the verdict

Issue: #300 (§E); branch: `fix/brain/single-paper-verdict-300`; branch cut at `e0c6077`, then
**rebased onto `f132cc1`** (`origin/dev-phase2-run4`) when that branch advanced mid-session with
#349/#350/#351/#352 — no conflicts, zero file overlap with #350. Device: `agent-j`; agent: `claude`
(Opus 5, 1M context). Isolated git worktree; the main checkout was not touched (read-only).

Territory: `tools/brain-ingest/src/verify/{prompt,enforce,caveat,verifier}.ts`,
`shared/brain/relationships.schema.ts`, `tools/brain-ingest/tests/verify.test.ts`,
`docs/nao/brain-synthesis-design.md`, `docs/memory/0012`, this log.

## Confirmed, before changing anything

- **PR #350 is still OPEN, not merged.** The dispatch brief allowed for either. `git grep
  singlePaperGate origin/dev-phase2-run4` found nothing: `#350`
  (`fix/brain/single-paper-serving-gate-300`) had base `dev-phase2-run4` and `mergedAt: null`. **It
  merged mid-session** (`3a31174`), so this work was rebased onto `f132cc1` and now sits directly on
  top of `singlePaperGate`. Nothing here touches the serving band; the two halves compose, and after
  the rebase that composition is verified rather than assumed (edge-loader 75/75, rules 172/172).
- **The verdict was corroboration-driven in three places, not one.** The brief named the prompt and
  `enforce.ts`. There was a third, and it was the binding one: the shared contract's `superRefine`
  in `relationships.schema.ts` refused to *store* a `supported`/`partial` record with
  `corroboration.supporting < 1`. Changing only the prompt and enforcement would have produced a
  `schema-invalid` rejection and the same `uncertain` fallback — a no-op dressed as a fix.
- **The cited paper was never shown to the verifier at all.** `retrieveForClaim` echo-excludes the
  claim's own citations by design, and `buildVerifierPrompt` rendered *only* the retrieved sources.
  So the model was being asked for `directionCheck` / `claimKindCheck` / `effectSizeCheck`
  "about the claim" while looking exclusively at *other people's* papers. Single-paper fidelity was
  not merely mis-weighted; it was **unaskable**. That is the root of the measured defect, and it is
  why this change is not a threshold tweak.
- **The deterministic quote gate is what makes it askable.** A9 (`quoteCheck`) already proves every
  quote span is present character-for-character in the cited paper *before* any spend, and
  `verifyClaim` returns early when it is not. So on the path where the prompt is built, the claim's
  own quotes are verified excerpts of the cited paper — trustworthy enough to be the verdict's basis
  without adding a single new trust assumption.
- **The consequence was a BLANKET `false` on every fidelity field — measured in the raw bodies.**
  All eight records in `data/corpus/edges/verifications.jsonl` carry
  `directionCheck.matchesClaim: false`, `claimKindCheck.matchesClaim: false` **and**
  `effectSizeCheck.matchesClaim: false`, several at `confidence: 0.95`. The raw reply
  (`verification-raw.jsonl`) shows why, and it is not carelessness: with `sourceStances: []` the model
  had nothing external to compare against, so "false everywhere" was the *coherent* answer to the
  question the old prompt actually asked. It also emitted `"supportedKind": null` and
  `"evidenceTier": 0`, both outside the contract. **This matters beyond the verdict**: those three
  fields are exactly what #350's `singlePaperGate` serves on, so a blanket `false` holds the edge at
  `hold` even once the verdict is approving. Fixing the verdict without making those fields
  answerable would have produced a correct verdict that still never renders a card.

## Changed

### `verify/prompt.ts` — `VERIFIER_PROMPT_VERSION` `verifier-2026-08-01.1` → `verifier-2026-08-01.2`

- New **`CITED PAPER — its own words. THE ONLY BASIS FOR YOUR VERDICT`** block, built from the
  claim's own `quoteSpans` grouped per cited paper, with that citation's title / year / tier /
  studied population for context.
- `buildVerifierPrompt` takes the A9 `quoteCheck` block as an optional third argument. When it
  passed, the block states the quotes were "verified present verbatim in this paper, at the offsets
  shown, by a deterministic check that ran BEFORE this call" — a **fact on that path**, not a
  promise. Without a passing block the wording degrades to "as recorded on the claim; not confirmed
  present by this call", so the prompt never asserts a check that did not run. Asserted both ways.
- The retrieved sources are relabelled **`OTHER STUDIES … CAVEAT CONTEXT ONLY, not the verdict`**,
  and the rules say so three times over: they do not decide the verdict; never answer `unsupported`
  because other studies did not back the claim up; never answer it because none were found.
- Zero retrieved sources no longer instructs `uncertain`. It now reads as what it is — a fact about
  the literature search, not about the claim — with an explicit "it cannot make the claim
  unsupported. Name it in `caveat`".
- Still refute-first, with the adversary **re-pointed**: hunt for the claim overstating its *own*
  paper (direction flipped, association written as a cause, effect overstated, population
  overgeneralised, metrics the quoted words never measure).
- `evidenceTier` was **removed from the reply contract**. The model may no longer state a study-design
  tier at all (see enforcement 7) — which also disposes of the observed out-of-contract
  `"evidenceTier": 0`.
- **The check blocks are declared answerable with zero other studies**, because the measured failure
  above was a blanket `false`: the notes now say to read each block off the cited quotes, that
  `supportedKind` is always one of the three words (never `null`), that a claim stating no effect
  size **cannot mismatch one** (`matchesClaim: true`, `extractedSize: null`; `false` is reserved for a
  claim asserting a size the paper does not carry), and — explicitly — that "answering `false` to
  every check because nothing external was found is a WRONG answer". This is the one edit here aimed
  at `singlePaperGate`'s inputs rather than at the verdict, and it is a disambiguation of a field the
  model was answering incoherently, not a relaxation of the gate.
- The claim block now carries the synthesizer's `derivation`, so "how it read the paper" is
  refutable rather than invisible.

### `verify/enforce.ts` — fidelity replaces corroboration

`enforceVerification`'s verdict section contains **no reference to `supporting` or `contradicting`**.
Those are still re-derived from the stances the model assigned to the sources *we* retrieved (it
still cannot invent one), still stored on the record, still feed `edgeScore` and the caveat — they
just have no path to the verdict. In their place:

- **(2a) quote gate** — an approving verdict requires `allPresent && spansFound >= 1`. The pipeline
  already refuses to spend on a failing gate and the contract already refuses to store one; the
  rejection is now labelled *here* so the reason is legible in the run log rather than surfacing as
  a generic `schema-invalid`.
- **(2b) direction** — an approving verdict with `directionCheck.matchesClaim === false` is
  self-contradictory (the claim reads its paper backwards) and is rejected.
- **(2c) causal inflation** — `claimKindInflated(claimed, supported)`: a `causal` claim licensed only
  as `correlational`/`mechanistic` is rejected. Deliberately **one-directional**: a claim that
  *understates* its paper (`correlational` over causal-strength evidence) is faithful and stays
  approvable, with the mismatch named in the caveat.
- **(3) `contradicted`** now requires `directionCheck.matchesClaim === false` — it means *the cited
  paper reports the opposite*, not that a retrieved stranger disagreed. This is the half the brief
  did not name but the instruction requires: leaving `contradicted` as a headcount of refuting
  sources would have kept external evidence able to kill a claim, i.e. corroboration still steering
  the verdict, just in the negative direction.
- **(7) `evidenceTier` is structural**: strongest retrieved *supporting* source's tier, else the
  strongest tier among the claim's **own citations**. `asEvidenceTier(reply.evidenceTier)` is gone.
  This matters beyond tidiness — the caveat's design-strength flags read this field, so it had to
  stop being a number the model asserted before those flags could be widened (below).

### `verify/caveat.ts` — `citedPaperAssessed`

The quality-of-backing flags (population, claim kind, direction, effect size, design strength) were
gated on `supporting >= 1`, which was right when only other papers could back a claim. Under
single-paper verdicts it would have **hidden the very limitations the verdict was reasoned over**: a
`supported` claim with a population mismatch would have surfaced only "the other studies found did
not back this up" and silently dropped the mismatch. New optional input `citedPaperAssessed` (true
when the cited paper's verbatim quotes were shown and the quote gate passed) opens that gate. It
defaults to **false**, so the two producers where no model read the paper — `buildQuoteOnlyRecord`
and `buildFallbackUncertain` — keep claiming nothing about backing.

### `shared/brain/relationships.schema.ts` — the contract invariant

- `supported`/`partial` requires `corroboration.supporting >= 1` → **requires
  `directionCheck.matchesClaim === true`**.
- `contradicted` requires `corroboration.contradicting >= 1` → **requires
  `directionCheck.matchesClaim === false`**.

The contract now binds a verdict to the field that expresses **fidelity**, not to a headcount, and it
is still a real invariant: a record that approves a claim while recording that its direction does not
match cannot be stored. Everything else in the `superRefine` is untouched — including the two
upper-bound checks that stop the LLM inventing corroboration (`supporting` may not exceed the
retrieved supporting/mixed sources), the copy gate on `caveat`, the quoteCheck arithmetic, the
servable-verdict-needs-a-passing-quote-check rule, and the grounding safeguard.

## Decided

- **Corroboration cannot steer the verdict — the guarantee, and how it is bounded.** Three
  independent layers had to agree, and now do: the prompt tells the model the other studies are
  caveat context; `enforceVerification`'s verdict block never reads `supporting`/`contradicting`;
  and the contract no longer conditions any verdict on them. A test pins the property directly:
  the *same* reply enforced against retrieval with 0 supporting and against retrieval with
  1 supporting + 1 refuting yields the **same verdict**, with the corroboration difference showing
  up only in `corroboration` and in the caveat text.
- **What did NOT change, deliberately.** `independentRetrieval.performed` is still required for
  every servable verdict (the operative clause of accepted memory 0012) — retrieval still runs, it
  just no longer votes. The deterministic quote gate is unchanged and now *also* enforced explicitly
  for approving verdicts. The non-diagnostic copy gate, the decorrelation invariant, and Agnes
  acceptance-only enforcement were not touched.
- **Not every verdict approves.** Three rejections are pinned by test: a missing quote, a flipped
  direction (and it is not rescued by two supporting sources), and an association dressed as
  causation. `unsupported` keeps its meaning — the cited paper does not address this claim.
- **Memory 0012 amended, not silently contradicted.** Its "≥1 corroborating source" clause is now
  marked superseded by the owner instruction, with the measured defect recorded and `updated:`
  bumped. `context_sync`'s immutability check covers `docs/shared/decisions/` only, so a memory
  record is editable with an `updated:` bump — but the amendment is written as an amendment, dated
  and attributed, not as a rewrite of history.

## Left

- **Worked example — `stool_form|correlates|mood_score`, the clearest instance of the bug.** The
  claim is `correlational`, `effect: none stated`, 2 quote spans, ONE cited paper
  (`doi:10.1007/s11845-026-04396-x`), population "adults with epilepsy (PWE)".
  - **Before:** retrieval echo-excludes that paper, so the verifier judged from other papers only.
    Nothing was marked `supports` ⇒ `unsupported` ("The other studies found did not back this up").
    And had the model said `supported` anyway, `enforceVerification` rejected it ("0 supporting
    sources after stance re-derivation") ⇒ retry ⇒ `buildFallbackUncertain` ⇒ `uncertain`. Either
    path ends at `singlePaperGate` → `irrelevant-verdict` → band `hold` → **no card**.
  - **After:** the paper's 2 A9-verified quotes are the prompt's primary block. `correlational` makes
    causal inflation impossible by construction (`claimKindInflated` requires a `causal` claim), so if
    the direction is the one that paper reports the verdict is `supported`/`partial`, corroboration
    `{supporting: 0}` is still stored, and the caveat becomes *"The other studies found did not back
    this up."* (or *"No other studies were found to check this against."* when the search returned
    nothing) — the same sentence as before, now attached to an **approving** verdict instead of
    replacing it. At the observed confidence (0.92) `singlePaperGate` bands it `high`.
  - **The remaining dependency is the reply's own fidelity fields**, not corroboration: the gate also
    requires `claimKindCheck.matchesClaim` and `effectSizeCheck.matchesClaim`. Those were `false` on
    every record of the old run for the reason recorded above, which is precisely what the prompt
    disambiguation targets. **This is a re-verification, not a backfill**: the 14 stored verdicts do
    not change until `verify` is re-run against the new `verifier-2026-08-01.2` prompt.
- **`effectSizeCheck.matchesClaim` is the likeliest remaining reason a card still holds, and it is
  #350's gate, not enforcement.** `SINGLE_PAPER_GATE.requireEffectSizeMatch` is unconditional, while
  this change deliberately does NOT reject on an effect-size mismatch (an unstated size is a caveat —
  `effect-size-unconfirmed` — not an unfaithful reading). So a claim asserting no effect size whose
  verifier answers `false` will be `supported`-with-caveat and still held at `hold`. Mitigated here by
  the prompt notes; if it recurs, the honest fix is for #350's owner to make
  `requireEffectSizeMatch` conditional on the claim actually asserting a size. **Flagged, not
  silently worked around** — I did not touch the gate.
- **`VERDICT_LABELS` copy is now imprecise for two verdicts** (`shared/brain/trust_labels.ts` +
  its `.dart` mirror): `unsupported` reads "No supporting sources found" and `contradicted` reads
  "Sources point the other way", both of which describe corroboration rather than the cited paper.
  Not changed here: it is an O38 parity-guarded vocabulary whose Dart half is not covered by this
  task's gates, and both strings only appear for non-servable verdicts on reviewer/provenance
  surfaces. **Flagged, not fixed** — it should ride with a change that runs the Dart gate.
- **Retrieval still has no synonym map** (`resting_hr_bpm` searches "resting"+"hr", never "heart
  rate"). Now much less consequential — a lexical miss produces a caveat, not a rejection — but the
  caveat is still a statement about what the *pipeline* found, not about what the literature holds.
- **`graphify update .` was not run.** `graphify-out/` is machine-local and does not exist in this
  isolated worktree, and regenerating `docs/graph/semantic-graph.md` from an absent graph would have
  written a lossy stub over a tracked file. Owed on the next session in the main checkout.
- **Shared-contract two-reviewer process (decision 0002)** applies to
  `shared/brain/relationships.schema.ts`. No PR was opened per the brief, so that review is owed
  before promotion.

memory: 0012 amended (not superseded) — its "`supported`/`partial` need ≥1 corroborating source"
clause is retired by owner instruction 2026-08-01 ("we focus on single paper verification" / "Why
still checking other studies?"). The verifier verdict now answers only whether a claim is a faithful
reading of the ONE paper it cites, enforced by the quote gate + `directionCheck` + a causal-inflation
check in `verify/enforce.ts` and by fidelity invariants in `relationships.schema.ts`; corroboration,
impact tier, venue prestige and evidence tier are still computed and stored but reach the user only
through `caveat`. `independentRetrieval.performed` stays mandatory — retrieval runs, it no longer
votes. Durable lesson: the verdict was unaskable before this, because the cited paper was never in
the prompt — echo control excluded it and only retrieved sources were rendered, so every
"fidelity" check the schema asked for was being answered from other people's papers.
