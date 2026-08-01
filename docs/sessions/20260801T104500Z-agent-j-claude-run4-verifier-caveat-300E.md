---
title: Verifier approve-with-caveat (#300 §E) — populate `caveat`, narrow where `uncertain` is produced
summary: A live Agnes run wrote 7 verifications that were all `uncertain` with no `caveat` key at all, starving the DB column PR #338 added. Added verify/caveat.ts (limitation flags derived from the enforced record, model wording accepted only when it names a fired flag), populated `caveat` on all three record producers, rewrote the verifier prompt to ask for approve-with-caveat instead of "default to uncertain when unsure", and projected the column in edge-loader. No guard, threshold or schema invariant was weakened; the zero-retrieval case still resolves to `uncertain` by design.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Verifier approve-with-caveat (#300 §E)

Issue: #300 (§E); branch: `fix/brain/verifier-caveat-verdicts-300`; base and exact head at branch
cut: `bb2002f` (`origin/dev-phase2-run4`); device: `agent-j`; agent: `claude` (Opus 5, 1M context).
Isolated git worktree; the main checkout was not touched.

Territory: `tools/brain-ingest/verify/**`, `tools/edge-loader/**`, this log.

## Attempted

Fix the defect diagnosed from the live run: verdicts collapsing to `uncertain` and `caveat` never
being populated, which starves both `edge_verifications.caveat` (PR #338) and the app UI (#347).

## Confirmed, before changing anything

The dispatch brief asked for the mechanism to be confirmed rather than assumed. Reading the seven
records in `data/corpus/edges/verifications.jsonl` against the code:

- **The `caveat` gap is total.** No producer in the repo ever wrote the key. `enforceVerification`,
  `buildQuoteOnlyRecord` and `buildFallbackUncertain` each hand-built a `VerifyRecord` literal and
  none of them mentioned `caveat`; the brain-ingest structural mirror of the contract
  (`verify/types.ts`) did not carry the field either. The column, the contract field and the UI
  were all waiting on a producer that did not exist.
- **The collapse to `uncertain` was NOT a corroboration threshold.** The brief's hypothesis was a
  threshold of 2. There is no such threshold in the verdict path — `triage.lowCorroborationThreshold`
  (2) only decides *which spend rung* a claim gets, never a verdict. What actually happened:
  `independentRetrieval` shows `{performed: true, sources: []}` on six of the seven records, i.e.
  the verifier's own retrieval ranked over an **empty corpus**, because the run was invoked without
  `--corpus`. The CLI already warns about exactly this ("ZERO sources retrieved for every claim").
  With zero sources the prompt instructed the model to answer `uncertain`, and it did — including
  at `confidence: 0.95`, which is a *confident* "cannot tell", not a broken confidence value.
- **The old prompt made this worse than it needed to be.** Beyond the zero-source rule it also said
  "Default to `uncertain` when unsure", with no route for "supported, but thinly". Every
  qualification the verifier could have expressed had exactly one place to go: `uncertain`.

## Changed

### `tools/brain-ingest/src/verify/caveat.ts` (new)

The caveat derivation, with its honesty contract stated at the top of the file:

- `firedCaveatFlags(input)` — twelve named limitations, each a **pure read of a field the record
  already carries after enforcement** (`corroboration` re-derived from the stances we retrieved,
  `evidenceTier` from the strongest supporting source, the retrieval *we* performed). A caveat can
  therefore never assert something the record does not itself evidence.
- Quality-of-backing flags (tier, population, direction, effect size, claim kind) are **gated on
  `supporting >= 1`**. With zero supporting sources those checks are the model's ungrounded opinion;
  the honest statement is the absence, and "the backing is weak" would be inventing backing.
- `composeCaveat` — severity-ordered, capped at 2 sentences (`MAX_CAVEAT_SENTENCES`). The cap keeps
  a *prefix* of the severity order, so what is dropped is always strictly less severe.
- **No flag fired ⇒ `null`.** Never a reassuring sentence. The UI renders a caveat as a real
  qualification, so a caveat that says nothing is worse than none.
- `chooseCaveat` — the model's own words are **preferred but not trusted**. Its text is kept only
  when (a) a flag actually fired, (b) the text is non-empty and ≤300 chars, (c) it passes the shared
  copy gate, and (d) it **lexically corroborates at least one fired flag**. Otherwise the derived
  sentence is used. No copy validator injected ⇒ fail-closed to derived.
- **Residual limitation, documented in the file rather than hidden:** (d) proves the model named a
  limitation that fired; it does not prove it named *only* those. A sentence that correctly says
  "only one study backed this up" and adds an unmeasured clause would pass. Closing that needs
  entailment checking, not string matching. The bound that does hold: a caveat naming nothing we
  measured is always replaced by one that does.

### `verify/enforce.ts`

- `ParsedVerifierReply` gained `caveat: string | null` (parsed defensively like every other field).
- `enforceVerification` computes the caveat from the **enforced** facts and writes it into the
  record **before** the artifact ref is built, so the content hash covers it (asserted by a test).
- `EnforceContext.validateCopy?: CopyValidator` — the copy gate is applied to model wording *here*
  rather than only at the contract. At the contract a bad adjective fails the **whole record** and
  burns a retry; here it costs only the phrasing.
- `buildQuoteOnlyRecord` emits a derived caveat (no provider spoke on that rung).

### `verify/verifier.ts`

- `buildFallbackUncertain` emits a **derived-only** caveat. Deliberate: that record exists *because*
  the reply could not be enforced, so reusing its caveat would be salvaging phrasing from the one
  answer we refused to trust.
- `verifyClaim` loads the shared copy gate lazily, on the first enforced reply only, so the
  triage-only / dry-run / quoteCheck-only rungs never pay for the dynamic import.
- Run log now prints the caveat alongside the verdict.

### `verify/prompt.ts` — `VERIFIER_PROMPT_VERSION` `verifier-2026-07-24.1` → `verifier-2026-08-01.1`

Replaced "Default to `uncertain` when unsure" with §E's approve-with-caveat policy, and gave the
non-approving verdicts their actual meanings: `unsupported` = the shown evidence does not address
the claim (irrelevance), `contradicted` = it argues against, `uncertain` = nothing retrieved or the
passages genuinely cannot settle it. Added `caveat` to the reply contract with an explicit
instruction not to invent one and not to write a generic reassurance.

### `tools/edge-loader/` — the other half of the starvation

`edge_verifications.caveat` has existed since the #336 migration with **nothing writing it**: the
loader's `VERIFICATION_COLUMNS` and `joinEdges` row never mentioned it, so even a populated artifact
would have left the column NULL and the card blank. Added `caveat` to both, projected verbatim
(`v.caveat ?? null`, no composition or defaulting — only the producer knows what fired), plus a
coupling-guard unit in `edge_table_schema.test.ts` so the column and the loader row cannot drift
apart again silently.

## Decided

- **No guard, threshold or invariant was weakened, and none needed to be.** The mechanical floor is
  untouched: no independent retrieval ⇒ forced `uncertain`; `supported`/`partial` still require ≥1
  source the model marked "supports", re-derived from the set *we* retrieved; `contradicted` still
  requires a refuting source; the quote gate still runs before any spend; the shared zod superRefine
  is unchanged; Agnes acceptance-only enforcement is untouched. The four `enforce:` rejection units
  still pass unmodified. The narrowing of `uncertain` is entirely **prompt-level** — the prompt can
  ask for a verdict, it cannot grant one.
- **`LOW_CONFIDENCE_CAVEAT_THRESHOLD` (0.5) is not a gate.** It is the only new number, and no
  verdict, spend or serving decision reads it. It decides whether one extra sentence appears.
- **The caveat is a report ON the record, never an input to it.** No caveat influences a verdict and
  no verdict is chosen to obtain a caveat.

## Left

- **The zero-retrieval case still resolves to `uncertain`, by design — and this is the live run's
  actual shape.** §E also asks that mandatory independent retrieval be dropped. It was *not* dropped,
  for the same reason the previous session declined to: "every SERVABLE verdict requires
  `independentRetrieval.performed`" is the operative content of **accepted memory 0012**, and
  removing it is an amendment to an accepted decision, not an implementation detail. Doing it to
  make the demo's records approve would be precisely the guard-weakening the brief forbids. So an
  approving verdict remains reachable only with retrieved supporting evidence; what changed is that
  the ungrounded record now *says* "No other studies were found to check this against." instead of
  standing mute behind `uncertain`. **Amendment intent restated, not applied.**
- **Consequence for the demo, stated plainly: re-running `verify` without `--corpus` will still
  produce `uncertain` records** — now each carrying a caveat naming the missing corroboration. To
  get approve-with-caveat verdicts the run needs `--corpus` (e.g.
  `tools/brain-ingest/fixtures/verify-corpus.jsonl`) so retrieval has something to rank.
- **Retrieval still has no synonym map** (`resting_hr_bpm` searches "resting"+"hr", never "heart
  rate"). Untouched here. It means a thin-corroboration caveat can be a lexical-coverage artifact
  rather than a fact about the literature — the caveat is honest about what the *pipeline* found,
  which is not the same claim as what the literature holds.
- The existing seven records in `data/corpus/edges/verifications.jsonl` were **not** rewritten. They
  predate caveats, the artifacts are append-only, and back-filling a caveat onto them would assert a
  limitation nobody measured at the time.

## Gates

- `tools/brain-ingest`: `tsc --noEmit` clean; **510/510** tests pass (`--test-concurrency=1`, the
  repo-approved mitigation for the Windows `spawn UNKNOWN` ceiling).
- `tools/edge-loader`: **70/70** tests pass, including the new caveat coupling guard.
- `shared/brain` was not modified (the contract already had `caveat` from PR #338), so no shared
  suite was touched; its zod gate is exercised for real by the brain-ingest units.
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.

## Blockers

None for what landed. Dropping mandatory independent retrieval stays blocked on an owner decision to
amend accepted memory 0012.

memory: #300 §E verifier caveat — `caveat` now populated by all three record producers from
limitation flags read off the ENFORCED record (verify/caveat.ts); model wording kept only when it
lexically names a fired flag, else derived, else null; prompt bumped to `verifier-2026-08-01.1` and
now asks for `partial` + caveat instead of "default to uncertain"; edge-loader projects the column
(it had existed since #336 with nothing writing it). NO guard/threshold weakened — the live run's
all-`uncertain` output was an empty-corpus run (no `--corpus`), not a threshold, and the
zero-retrieval case still resolves to `uncertain` because dropping mandatory independent retrieval
is an amendment to accepted memory 0012 that only the owner can make.
