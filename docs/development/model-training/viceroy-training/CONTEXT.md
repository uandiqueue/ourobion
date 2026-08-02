# Context — what Viceroy is for, and what it must never become

Written for an agent or engineer running this bundle on a machine that **does not have the
Ourobion repository**. Everything needed to judge the run is here, in
[`LEAKAGE.md`](./LEAKAGE.md), or in [`INTERPRETING-RESULTS.md`](./INTERPRETING-RESULTS.md).

## The product this feeds

Ourobion builds a knowledge graph of relationships between health metrics from scientific papers.
Its pipeline is: retrieve papers → a strong LLM **synthesises** a relationship claim with quoted
evidence → a second, different-family LLM **adversarially verifies** that claim against freshly
retrieved evidence.

The failure mode that matters most on observational literature is **correlation stated as
causation**. Viceroy is a candidate **small encoder** that reads a paper's conclusion sentence and
reports how strong the author's causal language is — a cheap flag saying "this sentence's wording
may outrun its design; a reviewer should look."

## The rescope — read this before anything else

This model was originally planned as `viceroy-claim-kind-v0`, intended to fill
`EdgeVerification.claimKindCheck`. An independent review found the task **mismatched**, the
finding was accepted in full, and the model was renamed to `viceroy-causal-language-risk-v0`.

The mismatch, precisely:

| The contract asks | The corpus labels |
|---|---|
| what the **strongest claim the evidence licenses** is | which **causal language the author used** |

Those are different questions, and no corpus F1 on the second validates the first. A bare
conclusion sentence does not establish whether an observational design justifies its wording, and
it may assert several relationships without identifying which metric pair is being checked.

**What survives the rescope is still valuable**: "flags when a paper's conclusion uses stronger
causal language than its design supports" is a real, demonstrable signal. It simply is not the
contract field.

## The four classes

```
no_relationship       the authors state a studied relationship was NOT found   (1,356 rows)
direct_causal         unhedged causal language                                   (494 rows)
conditional_causal    hedged/conditional causal language                         (213 rows)
correlational         association language                                       (998 rows)
```

These are the corpus's **native** labels, trained as a 4-way head. They are not collapsed before
training: a 4-way head loses nothing and preserves the `no_relationship` signal.

`ClaimKind.mechanistic` is **never predicted**. No public corpus labels conclusion sentences as
mechanistic in the contract's sense, so the model has *no opinion* — an absent `mechanistic`
prediction must never be read as "not mechanistic".

`no_relationship` **never maps to `RelationKind.no_effect`.** Meta-research finds over 80% of
titles misinterpret non-significance as support for the null, so a classifier trained on author
phrasing learns the authors' spin. Absence of evidence and evidence of absence look identical at
the sentence level. Recording that this class is the closest lead anyone has found for `no_effect`
is the contribution; closing the gap needs edge-level annotation, not sentence-level.

Both rules are enforced mechanically by `preflight_check_scope_boundary` in `src/viceroy/data.py`,
not merely documented — the same role the label-blindness signature check plays in the Zebra
bundle.

## Hard boundary: this is non-serving

Whatever the numbers say, this model **does not go into production in this run**. It must not:

- write to any product field, edge score, card, or routing decision;
- populate `claimKindCheck`, or be described as evidence validation;
- short-circuit or replace the verifier LLM;
- be merged with, or share a checkpoint or release prefix with, any other model in the roster
  (the licence isolation in §4.2 of the training plan depends on that separation).

**A documented no-go is a completely valid outcome.** Do not iterate on the recipe to chase a
better score; see "the preregistration rule" below.

## The two design decisions that matter most

### 1. Leakage control, and its honest limit

The Zebra run hit data leakage. This bundle **constructs** leakage-safe folds rather than
asserting after the fact, and it audits what the construction missed.

It also cannot fully succeed, and says so: the released corpus ships **no paper identifier**, so
same-paper sentences cannot be reliably grouped. Read [`LEAKAGE.md`](./LEAKAGE.md) — it has the
measured numbers, two confirmed same-paper pairs that cross fold boundaries undetected, and the
reason the published 0.88 macro-F1 anchor is not comparable to a group-safe score.

### 2. Class imbalance is handled in the loss, and never in the metric

The corpus is ~6.4:1 imbalanced, so a single-class predictor scores **0.443 accuracy**. The loss
is weighted by inverse class frequency, computed from the **training split only** and never tuned.
Accuracy is never reported alone — `viceroy.metrics.accuracy` returns the majority-class baseline
in the same object so the two cannot be separated.

## The preregistration rule

The recipe in `ViceroyConfig` is **fixed in advance**: BiomedBERT base, max_seq_len 256, AdamW,
lr 2e-5, weight decay 0.01, effective batch 16, warmup 10%, grad clip 1.0, 5 epochs, seed 42,
class-weighted loss, 5 grouped folds, grouping threshold 0.80.

**Do not tune it.** No learning-rate search, no epoch hunting, no "just one more run with a
different seed", and — specifically for this bundle — **no adjusting `near_dup_jaccard` after
seeing a score.** The threshold was fixed from a structural sweep before any model was trained
(LEAKAGE.md "Why 0.80"); moving it afterwards would make the split a hyperparameter fitted to the
result. Every leakage knob is part of `config_hash`, so such a change is visible in the artifact.

If a deviation is genuinely forced by the hardware — fp32 instead of BF16 on Apple Silicon — the
code records it in the run artifact rather than applying it silently.

## Data and licensing

- **Yu, Li & Wang (EMNLP 2019)** causal language use in science — 3,061 PubMed conclusion
  sentences, fetched from a **pinned commit** (`7ca243a0…`), not a moving branch.
- **BiomedBERT base** (`microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext`),
  MIT-licensed, ~110M parameters.
- Excluded on purpose: Haber et al. and the distortion corpus (availability/licence unverified),
  BioCause (too small), Causal News Corpus (news domain), any user data, and **any
  LLM-generated claim-kind labels** — this model exists to cross-check the synthesis LLM, so
  training on its output would make the check circular.

There is a **fail-closed licence gate that is stricter than Zebra's**. The corpus repository is
**GPL-3.0**, and whether copyleft on a *data* repository propagates to model weights is legally
unsettled. Nothing runs without a `licence-approval.json` that is `approved` **and** carries a
complete `gpl3_determination` answering four specific questions in writing. That file must be
produced by a human — see `licence-approval.example.json`. **Do not fabricate one.** An
unavailable, contradictory, or negative determination **blocks this model**; it does not proceed
under an assumption.

## What is unverified as of writing

The corpus schema, size, class counts, duplicate structure, and every leakage number in
`LEAKAGE.md` **were** verified against the real distributed file. What has **not** happened: no
training run, no GPU, no Apple Silicon, no real tokenizer. The 160 tests exercise pure-Python
logic offline. The first real run on the target machine is the first contact with reality — treat
surprises as expected, and read [`INTERPRETING-RESULTS.md`](./INTERPRETING-RESULTS.md) before
concluding anything from a number.
