# Leakage — what this bundle controls, and what it cannot

Read this before quoting any number from this bundle. Every figure below was **measured** against
the real corpus on 2026-07-27, not estimated.

The short version:

> Exact-duplicate and boilerplate leakage are **solved**. Same-paper leakage is **not solved, and
> cannot be solved from the released file**, because it ships no paper identifier. Results
> therefore carry an unquantified optimistic bias. Say so when reporting them.

## Why this document exists

The Zebra run hit data leakage. Two lessons generalise, and neither is "add another assertion":

1. **An assertion at the end of a pipeline cannot produce a usable split.** Zebra's splits module
   assigns folds by size balance only, then asserts that no claim, abstract, component, or exact
   text spans a boundary — so the assertion is the first thing that knows about a constraint the
   assigner never tried to satisfy. This bundle inverts the order: folds are *constructed* so the
   invariants hold, and the assertions are a double-check on the construction.
2. **An inherited split is someone else's judgement about leakage, not yours.** Zebra took the
   corpus's official train/dev split as given. This bundle builds its own folds over the whole
   corpus.

## The measured problem

The training plan says to group folds "by PMID so no paper's sentences straddle folds".

**The released labelled corpus has no PMID.**

| Fact | Measured value |
|---|---|
| Rows in `pubmed_causal_language_use.csv` | 3,061 |
| Columns | exactly two: `sentence`, `label` |
| Paper identifier | **none** |

The same repository's *unlabelled* sample file (`sample_new_sentences.csv`) does carry a `pmid`
column — so the authors had paper ids and did not publish them alongside the labels.

And same-paper sentences are demonstrably present. One identified paper contributes three distinct
conclusion sentences about sugar-sweetened beverages, fruit juice, and their substitution. Under
this bundle's own split they land in **three different folds** — because their pairwise Jaccard
similarity is **0.22–0.24**, nowhere near any threshold that could separate them from ordinary
topical overlap.

For the record: the upstream repository's `main.py` uses
`StratifiedKFold(n_splits=K, shuffle=True, random_state=0)` over sentences — **no grouping at
all**. The published **0.90 accuracy / 0.88 macro-F1** anchor is therefore a row-level number.
A group-safe score from this bundle is expected to be lower, and that gap is a finding, not a
regression.

## What the bundle does

Groups are built by union-find over three kinds of evidence that two rows share provenance:

| Evidence | Applies under | Effect |
|---|---|---|
| exact normalized text (`dedup_key`) | every policy, including `row` | identical sentences can never separate |
| lexical near-duplication ≥ `near_dup_jaccard` | `surrogate` (default), `pmid` | the surrogate for the missing paper id |
| PMID | `pmid` only | fails closed if absent or partial |

Then whole groups are assigned to folds by a stratified greedy heuristic minimising per-class
imbalance — deterministic, no RNG, no seed.

### Measured result on the real corpus (defaults: 5 folds, jaccard 0.80)

| Quantity | Value |
|---|---|
| Rows loaded | 3,061 |
| Rows dropped (one sentence carrying two different labels) | 2 |
| Rows kept | 3,059 |
| Exact-duplicate rows collapsed | 8 |
| Near-duplicate links formed | 7 |
| Provenance groups | 3,044 (11 multi-row; largest 5) |
| Fold class balance | within **1 row** per class across all five folds |
| Residual pairs ≥ 0.60 crossing a fold boundary | **45** |
| Pairs ≥ 0.80 crossing a fold boundary | **0** (non-zero would be a bug, not a data property) |

All 45 residual pairs are citation or registration boilerplate — "This trial was registered at
clinicaltrials.gov as NCT…", "Cite this article: Bone Joint J 2017;99-B:225-30.",
"LEVEL OF EVIDENCE: Therapeutic, III." These are mostly *different* papers that happen to share a
template, so grouping them harder would over-merge, not improve anything.

## What it does not catch — the honest limit

The surrogate finds near-*duplicates*. Same-paper conclusion sentences are not duplicates: they
are topically related and lexically diverse. Measured examples that **cross fold boundaries
undetected**:

| Jaccard | Folds | The pair |
|---|---|---|
| 0.58 | 0 / 4 | "RELEVANCE TO CLINICAL PRACTICE: Medical staff should realise that the level of self-acceptance among women with breast cancer…" ↔ "This study demonstrates that the level of self-acceptance among women with breast cancer in China…" |
| 0.22–0.24 | 2 / 3 / 4 | the three sugar-sweetened-beverage sentences described above |

Both are unambiguously same-paper. Neither is reachable by thresholding, and the band they sit in
is crowded: **590 pairs** at 0.25–0.40 and **79 pairs** at 0.40–0.60 already cross folds, the
overwhelming majority of which are unrelated papers sharing subject matter. Lowering the threshold
to catch the real ones would merge hundreds of unrelated sentences and destroy the split.

**So: residual same-paper leakage exists, is not measurable without paper ids, and biases results
optimistically by an unknown amount.** That sentence belongs in any write-up.

### Why 0.80

Measured sweep on the real corpus:

| `near_dup_jaccard` | Groups | Near-dup links | Largest group |
|---|---|---|---|
| 0.60 | 3,021 | 30 | 7 |
| 0.70 | 3,032 | 19 | 6 |
| 0.80 **(preregistered)** | 3,044 | 7 | 5 |
| 0.90 | 3,050 | 1 | 2 |
| 1.00 (exact only) | 3,051 | 0 | 2 |

0.80 removes near-exact repeats without merging distinct papers that share a citation template.
It was chosen from this structural sweep, **not tuned against a score** — no model had been
trained when it was fixed. Changing it changes `config_hash`, so two runs at different thresholds
can never be silently compared.

## The real fix, if this model is ever taken further

Recover the PMIDs. The sentences come from PubMed abstracts and the upstream authors clearly had
the ids; exact-sentence search against the PubMed API would recover most of them. With real paper
ids, `group_policy="pmid"` already works in this bundle and the surrogate becomes unnecessary.

Until then, `group_policy="pmid"` **fails closed** rather than silently degrading — a
`GroupPolicyError` naming the missing column, not a quiet fallback to row-level splitting.

## What to report

Not "the split is leakage-free". Report this instead:

- exact-duplicate and boilerplate leakage controlled; 0 pairs ≥ 0.80 cross a fold;
- 45 residual pairs at 0.60–0.80 cross folds, all citation/registration boilerplate;
- **same-paper leakage is uncontrolled** because the corpus ships no paper id, with the two
  confirmed examples above as evidence that it is real rather than theoretical;
- the published 0.88 macro-F1 anchor is row-level and **not comparable** to a group-safe number.

Run `python -m viceroy.cli splits` to regenerate every number here for the corpus actually on
disk; it writes `outputs/split-artifact.json` and prints the audit **without training anything**.
