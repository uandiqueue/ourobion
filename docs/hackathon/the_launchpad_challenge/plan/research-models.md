---
title: Reliability by layers — the decorrelated verifier and the research models
summary: Why Ourobion runs synthesis and verification on different vendor families, what the Zebra and Viceroy research checkpoints measured, and why neither is wired into the product.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

## Part 1: The Swiss-Cheese Argument

Ourobion's reliability architecture is built on the Swiss-cheese model of accident causation. As James Reason writes in *Human Error* (Cambridge University Press, 1990), and more accessibly in "Human error: models and management" (*BMJ* 2000;320:768–770, https://doi.org/10.1136/bmj.320.7237.768): many layers of defence exist, none trusted alone, arranged so that a single mistake does not reach the user. Each layer has holes; the point is that the holes do not line up.

The empirical basis for this design comes from the owner's earlier AI-collaborated research project (https://github.com/uandiqueue/resurrecting-genomic-fossils/tree/main/reliability), which documented 98 findings across a synthesis and verification pipeline. The sharpest lesson: every in-project check—audit skills, independent re-runs, even adversarial AI subagents—ran on the *same family* of model. They shared blind spots. A same-family self-check can wave through an error it is itself prone to. One error class survived three rounds of same-family fixing; each time, it was an outside model on a different platform that caught what in-family checks missed. This is not decoration; it is the reason the invariant exists.

Ourobion encodes that lesson structurally. The config gate enforces this:

```
Decorrelation: OK — synthesis=openai, verifier=agnes (independent families enforced)
```

- **Synthesis** runs on gpt-5 (OpenAI family), chosen for capability.
- **Verifier** runs on agnes-2.5-flash (Agnes family), a different platform trained on different data, with different internal weights.
- The synthesis verifier does not inherit the synthesiser's blind spots.
- This is an enforced invariant, not a habit or a prompt instruction. The `testMode` escape hatch that could once downgrade this has been removed. There is no config path that disables decorrelation. It fails closed.

Additional layers exist below this: deterministic safeguards (a quote gate, a non-diagnostic copy gate, a serving-band gate), and a grounding invariant. A supported or contradicted verdict requires the verifier to have done its own fresh retrieval. Without fresh grounding, the verdict can only be "uncertain."

### Where the layering deliberately stops

One boundary belongs here rather than in a footnote, because it is the honest limit of the design.

**A card can be served on the strength of a single paper.** The serving gate asks whether a claim is
faithful to *the paper it cites* — are the quotes real, is the scope right, does the effect size
match. It does not ask whether the wider literature agrees.

Cross-paper corroboration, study-design tier and venue impact tier are all still computed, stored and
used to *rank* edges. What they can no longer do is withhold a card. That change was made after a live
run produced edges where every check against the cited paper passed and only the other-paper signals
were thin — the composite score banded them "hold", which amounted to a rejection with extra steps.

The risk this creates is real: a faithfully-reported claim from one paper may still be a claim the
field as a whole does not support. The mechanism carrying that risk to the user is the verification
**caveat**, and it is the only one. This was an explicit, recorded owner decision rather than an
oversight, and it is written down here for the same reason it is written down in the repository.

What did *not* change: retrieval is still mandatory for an affirmative verdict to exist at all. It was
demoted as a scoring input, not removed as a precondition — `enforce.ts` still forces `uncertain` when
retrieval was not performed. Nor did the deterministic quote gate move; it remains a required member
of the serving gate.

## Part 2: The Research Models

Both models are fine-tuned from Microsoft BiomedNLP-BiomedBERT (base model licence: MIT). They were trained on 2026-07-28, each approximately 438 MB in size, and stored on private Cloudflare R2 with byte-for-byte verified upload.

**Where they trained.** An H100 container was requested from GMI Cloud on 27 July and did not arrive within the challenge window; the sponsor credit also covered CPU and hosted inference rather than a custom training job. Both models therefore trained on local Apple Silicon (`device: mps`, fp32) — Zebra in 313 s of wall-clock training. This is not incidental: it bounds model size and training length, and it is the direct reason Viceroy carries one frozen holdout instead of completed cross-validation. Recorded in [`docs/memory/0024`](../../../memory/0024-training-compute-is-local.md).

### Zebra v1

Zebra performs three-way claim/evidence classification: supported / contradicted / insufficient_evidence.

| Metric | Value | Preregistered Gate | Status |
|--------|-------|-------------------|--------|
| Macro F1 | 0.5991 ± 0.0081 (across 3 seeds) | ≥ 0.70 | **FAILED** |
| ECE | 0.0491 | ≤ 0.10 | PASSED |
| Contradiction Recall | 0.4670 mean (+0.38 vs unweighted baseline); 0.4348 at the minimum seed | ≥ 0.60 (per-class minimum) | **FAILED** |

Training data: SciFact, 1,007 rows, licence CC BY-NC 2.0.

Zebra is a documented partial negative result. Its macro F1 fell short of its preregistered target. Its per-class contradiction recall, while improved over baseline, did not meet the minimum threshold when measured across seeds. This is the intended behaviour: a model was trained, measured against its own preregistered criteria, found below the bar, and not shipped.

### Viceroy v0

Viceroy performs four-way classification of author-stated causal language: no_relationship / direct_causal / conditional_causal / correlational.

| Metric | Value | Notes |
|--------|-------|-------|
| Macro F1 | 0.8656 | 95% CI [0.8327, 0.8958] |
| Balanced Accuracy | 0.8868 | — |
| ECE | 0.0919 | — |
| Macro F1, cue-lexicon baseline | 0.5068 | the simple comparison Viceroy had to beat; delta +0.3588 |
| Dangerous Error Rate (correlational misread as causal) | 4.52% | vs 13.57% for cue-lexicon baseline |

Training data: Yu, Li & Wang causal-language corpus (EMNLP 2019), 3,059 rows, licence GPL-3.0.

Important limitations must be stated explicitly: The evaluation used one frozen holdout only, not a completed cross-validation. Same-paper leakage is uncontrolled (45 residual similar pairs cross folds). There has been no independent audit. The GPL-3.0 licence's propagation to trained weights is legally unsettled—which is itself a reason the model is not shipped.

### Disagreement Pilot

On 2026-07-31, both models were compared against Claude Haiku 4.5 on 96 real ingested papers:

| Model | Disagreement Rate | Cohen's Kappa |
|-------|------------------|---------------|
| Zebra | 42.7% | 0.236 |
| Viceroy | 47.9% | 0.205 |

These results are unadjudicated, and there is no ground truth for this corpus. They measure *disagreement*, not correctness. The evidence—predictions, label keys, and scripts—is committed in the repo under `model-training/experiments/`.

## Part 3: Why They Are Not Wired In

Both models carry the acceptance flags `validated=false`, `serving_ready=false`, and `public_weights_cleared=false`. This separation is enforced in code, not merely intended:

- Model-training code may never be imported by the apps, the database functions, the shared contracts, or the ingestion tools.
- The Zebra runner deliberately stops at its native three-way label space and refuses to map onto the product's five-way verdict space. That mapping is a scientific decision that belongs to a reviewed serving gate with its own evidence. If the mapping lived in the runner, adding Zebra to the product would be one import away, and the `validated=false` flag would be protecting nothing.

The argument is plain: a model was trained, measured, found below its own preregistered bar, and not shipped—with the refusal enforced structurally. That is a layer honestly measured and correctly not yet relied upon. It is the intended behaviour of the system, not a gap in it.
