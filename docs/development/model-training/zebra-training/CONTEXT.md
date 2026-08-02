# Context — what Zebra is for, and what it must never become

Written for an agent or engineer running this bundle on a machine that **does not have the Ourobion
repository**. Everything needed to judge the run is here or in
[`INTERPRETING-RESULTS.md`](./INTERPRETING-RESULTS.md).

## The product this feeds

Ourobion builds a knowledge graph of relationships between health metrics from scientific papers. Its
pipeline is: retrieve papers → a strong LLM **synthesises** a relationship claim with quoted evidence →
a second, different-family LLM **adversarially verifies** that claim against freshly retrieved
evidence.

Both LLM stages are expensive and fallible. Zebra is a candidate **small encoder** that would sit
beside the verifier as a cheap second opinion on one narrow question:

> Given a claim and some retrieved evidence, does the evidence support it, contradict it, or is there
> insufficient evidence to say?

Two motivations, in the project's own priority order:

1. **A second-source signal** that can disagree with the LLM verifier and flag a claim for attention.
2. Eventually, **token reduction** — but only once reliability is demonstrated. This is explicitly
   *not* the near-term goal, so do not optimise for throughput at the cost of trustworthy numbers.

## The three classes, and why the third is named oddly

```
supported              the evidence backs the claim
contradicted           the evidence points the other way
insufficient_evidence  neither can be concluded from what was retrieved
```

`insufficient_evidence` is **deliberate and load-bearing — do not rename it to `uncertain`.**

The product contract distinguishes two states that look similar and are not: `unsupported` means "no
evidence was found either way — absence, not contradiction", while `uncertain` means "could not be
grounded at all, e.g. retrieval failed". SciFact's `NEI` label is cleanly *neither* of those. So the
class is **model-native**: it describes what the training data recorded, and it fills no contract field
directly. A later verifier roll-up may consume it as one input among several.

If you find yourself mapping this class onto a product state, stop — that mapping is not authorised and
was explicitly rejected during review.

## Hard boundary: this is non-serving

Whatever the numbers say, this model **does not go into production in this run**. It must not:

- write to any product field, edge score, card, or routing decision;
- short-circuit or replace the verifier LLM;
- be described as validated, servable, or as evidence that the knowledge graph is scientifically sound.

**A documented no-go is a completely valid outcome.** The experiment is designed so that "this doesn't
work well enough" is a real, reportable result — not a failure to be tuned away. Do not iterate on the
recipe to chase a better score; see "the preregistration rule" below.

## The one design decision that matters most

An earlier version of this plan built the evidence window **differently depending on the label**: gold
rationale sentences for `supported`/`contradicted` rows, and retrieval-selected sentences for `NEI`
rows.

That is fatal. The classifier can learn *the input-selection policy* instead of entailment — "this
window looks like a gold rationale, so it must be supported" — and at inference time there are no gold
rationales at all. Any score produced that way is inflated and meaningless.

So the bundle enforces **one label-blind pipeline for every class**. The evidence selector
`select_evidence_sentences(claim_text, abstract_sentences, config)` takes three positional parameters
and no `**kwargs`, and `config` is a frozen dataset-wide object with no per-row field — it *cannot*
carry a label even in principle. The label is attached afterwards, by a separate function.

Gold rationales survive only as a clearly named **`oracle-evidence` secondary analysis**, off by
default. Reporting oracle numbers as the headline result would reintroduce exactly the defect this
design removes.

## The preregistration rule

The recipe in `ZebraConfig` is **fixed in advance**: BiomedBERT base, max_seq_len 384, AdamW, lr 2e-5,
weight decay 0.01, effective batch 32, warmup 10%, grad clip 1.0, 5 epochs, seed 42.

**Do not tune it.** No learning-rate search, no epoch hunting, no "just one more run with a different
seed". The value of a preregistered experiment comes precisely from not having selected the recipe
against the result. If a deviation is genuinely forced by the hardware — for instance fp32 instead of
BF16 on Apple Silicon — the code records it in the run artifact rather than applying it silently.

Seeing a disappointing number and changing the recipe is the single easiest way to make this whole
exercise worthless.

## Data and licensing

- **SciFact** via the pinned AllenAI entailment transform (`allenai/scifact_entailment`) — 919 train /
  340 dev rows. Public research dataset.
- **BiomedBERT base** (`microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext`), MIT-licensed,
  ~110M parameters, `pytorch_model.bin` is 420 MB.
- Excluded on purpose: HealthVer, PUBHEALTH, SciNLI, any user data, any synthetic or LLM-generated
  labels, and any relabelling of arbitrary non-gold pairs.

There is a **fail-closed licence gate**: nothing runs without a `licence-approval.json` whose `status`
is `approved`. That file must be produced by a human — see `licence-approval.example.json`. **Do not
fabricate one.** The gate exists because the transform's card carries a non-commercial restriction that
a person has to consciously accept.

## What is unverified as of writing

This bundle has never touched the network, real SciFact, a real tokenizer, or Apple Silicon. Its 82
tests exercise pure-Python logic and a toy tokenizer offline. The first real run on this machine is the
first contact with reality — treat surprises as expected, and read
[`INTERPRETING-RESULTS.md`](./INTERPRETING-RESULTS.md) before concluding anything from a number.
