---
title: Zebra Claim-Kind v0 — GMI training plan
summary: Preregistered plan for a causal-language classifier over conclusion sentences that fills EdgeVerification.claimKindCheck, kept as a separate model because its input granularity and GPL-3.0 data licence must not entangle the relation/direction weights. Its no-relationship class is also the only licensed supervision found for the long-standing no_effect gap.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Zebra Claim-Kind v0 — GMI training plan

> **Shared execution substrate.** GMI gates, container/network/secret posture, durable storage, the
> external `ourobion-model-lab` repository shape, and the release/provenance contract are defined once
> in the NLI plan ([`../run3/custom-model-training-plan.md`](../run3/custom-model-training-plan.md) §3,
> §4, §12 — moving to `zebra-nli-shadow-v0-training-plan.md` under #139). Only deltas appear here.
> **`GMI-H7` requires a specifically stricter licence review for this model** (§4.2).

## 1. Decision summary

`zebra-claim-kind-v0` reads a paper's **conclusion sentence** and classifies the strength of causal
language it uses. It fills the second half of model **(c)** from
[memory 0013](../../memory/0013-brain-pipeline-and-support-models-decision.md) — the half deliberately
carved out of
[`zebra-relation-direction-v0-training-plan.md`](./zebra-relation-direction-v0-training-plan.md).

**Why a separate model rather than a third head on the relation encoder.** Three independent reasons,
any one of which would be sufficient:

1. **Different input granularity.** The relation model consumes a passage with two marked entity
   mentions; this one consumes a whole conclusion sentence with no markers. Sharing an encoder would
   force one input convention onto both.
2. **Licence isolation.** The only good training data carries **GPL-3.0**, and the relation model's
   corpora are public-domain/CC-BY. Merging them would entangle a copyleft-adjacent obligation with
   otherwise clean weights for no benefit.
3. It can be built, evaluated, and discarded independently — a `no-go` here does not touch the
   relation/direction result.

Same bounded-pilot terms as every other zebra model: non-serving; no influence on any contract field,
edge score, band, card, routing, or spend; offline-only by the serve-path determinism invariant
([`decisions/0003-paper-reliability.md`](../../shared/decisions/0003-paper-reliability.md)); a
documented `no-go` is a valid completion.

### 1.1 What it would eventually populate

| Contract field | Source |
|---|---|
| `EdgeVerification.claimKindCheck.matchesClaim: boolean` | `shared/brain/relationships.ts:205` |
| `EdgeVerification.claimKindCheck.supportedKind: ClaimKind` | `relationships.ts:205` |
| `RelationshipClaim.claimKind` | `relationships.ts:147` — cross-check only, never authorship |

Pipeline seam: **A10 · Verification with independent retrieval**
([`insight-engine-architecture.md`](../../shared/insight-engine-architecture.md) §A10).

The failure mode this exists to catch is **correlation stated as causation** — the single most damaging
and most common error a synthesis LLM makes on observational literature, and one the contract already
anticipates with a dedicated check block.

## 2. The `mechanistic` gap — stated up front

`ClaimKind` is `'causal' | 'correlational' | 'mechanistic'` (`shared/brain/relationships.ts:48`). The
available supervision covers **two of the three**. There is no public corpus labelling scientific
conclusion sentences as *mechanistic* in our contract's sense.

v0 therefore **never predicts `mechanistic`**. It predicts causal vs correlational vs
no-relationship-asserted, and abstains otherwise; the verifier LLM retains the `mechanistic` call
entirely. Any consumer must treat an absent `mechanistic` prediction as "this model has no opinion",
never as "not mechanistic".

Trying to close this by mapping ChemProt/DrugProt mechanistic relation classes onto `mechanistic` would
be wrong: those are relation-type labels over entity pairs, not claim-strength labels over sentences,
and the granularity mismatch would manufacture a label that means something different from the contract
field. Do not do it.

## 3. The unexpected finding — this model is also the `no_effect` lead

Across the roster, `no_effect` (`RelationKind`, `relationships.ts:39-45`) has been recorded as having
no clean public label, and re-checking confirmed the general picture: every biomedical RE corpus's
`no_relation` means *not annotated*, not *studied and found null*, and BioRED's `novel` flag is
orthogonal. Negation/speculation resources (BioScope, GENIA event modifiers) annotate cues and scopes,
not study outcomes.

**One exception surfaced.** Yu, Li & Wang's causal-language corpus has an explicit **`no relationship`**
class over 1,356 PubMed conclusion sentences — sentences where authors state that a studied
relationship was *not* found. That is much closer to `no_effect` than anything else in the literature,
and it is real human annotation rather than a cue list.

Two cautions keep this a lead rather than a solution:

- It is **claim-level, not edge-level**. "No association was observed" in one paper's conclusion is not
  the same as the graph asserting `no_effect` between two metrics across a body of evidence.
- Meta-research finds the linguistic surface is actively misleading: **over 80% of titles misinterpret
  non-significance as support for the null**
  ([iScience 2024](https://www.cell.com/iscience/fulltext/S2589-0042(24)02903-1)). A classifier trained
  on author phrasing learns the authors' spin. Absence of evidence and evidence of absence look
  identical at the sentence level.

So: v0 trains the `no relationship` class, reports its metrics, and explicitly **does not** authorize
populating `RelationKind.no_effect` from it. Whether that class can ever ground a `no_effect` edge is a
separate scientific question requiring edge-level annotation. Recording the lead is the contribution
here; closing the gap is not.

## 4. Dataset and licence gate

### 4.1 Allowed source

| Source | Size | Labels | Licence |
|---|---|---|---|
| **Yu, Li & Wang (EMNLP 2019)** causal language use in science ([paper](https://aclanthology.org/D19-1473/), [data](https://github.com/junwang4/causal-language-use-in-science)) | 3,061 PubMed conclusion sentences | `no relationship` (1,356) · `direct causal` (494) · `conditional causal` (213) · `correlational` (998) | **GPL-3.0** on the repository |

Reported baseline: BERT at **0.90 accuracy / 0.88 macro-F1** on this dataset — a strong, directly
comparable anchor.

Candidate secondary sources, all **excluded from v0** pending verification:

- **Haber et al., Am J Epidemiol 2022** — causal-strength rating of linking phrases in observational
  health abstracts on a 6-point scale ([AJE](https://academic.oup.com/aje/article/191/12/2084/6655746)).
  Conceptually the best-matched resource in existence for this task; corpus availability and licence
  are **UNVERIFIED**. Chase this at execution — if it is available and licensed, it is worth a v1.
- **Fine-grained distortion corpus** — 1,600 finding↔report pairs annotated for causality, certainty,
  generality, sensationalism ([arXiv 2402.12431](https://arxiv.org/abs/2402.12431)); release
  **UNVERIFIED**.
- **BioCause** — 19 full texts, 851 causal relations
  ([BMC Bioinf](https://bmcbioinformatics.biomedcentral.com/articles/10.1186/1471-2105-14-2)). Too
  small to train on; usable as an eval probe.
- **Causal News Corpus** — 3,559 sentences ([arXiv 2211.12154](https://arxiv.org/abs/2211.12154)); news
  domain, transfer risk, excluded.

### 4.2 The GPL-3.0 question — the gate that decides this model

The dataset repository is GPL-3.0. Whether a copyleft software licence attached to a *data* repository
propagates to model weights trained on it is **legally unsettled**, and this plan does not assert an
answer in either direction.

What the licence reviewer must decide, in writing, before any GPU is provisioned:

1. whether GPL-3.0 on the data repository is intended to cover the annotations as data, or only the
   accompanying code;
2. whether trained weights would be considered a derivative work under that reading;
3. whether Ourobion accepts the resulting obligations for a **non-serving research artifact** that is
   never distributed — which is a materially weaker exposure than shipping it;
4. whether the artifact may ever move to a served or commercial context without re-licensing or
   retraining from a different corpus.

Risk-containment measures, applied regardless of the outcome:

- this model's weights, code, and release prefix stay in a **separate namespace** from every other
  zebra model — no shared checkpoints, no merged artifacts, no joint release manifest;
- the release manifest names the GPL-3.0 dependency explicitly and prominently;
- if the reviewer cannot resolve it, **this model blocks**. It does not proceed under an assumption,
  and it is not quietly folded into the relation/direction model.

Note that Ourobion's non-commercial status does not make an unconfirmed licence acceptable — that rule
is already established in [`brain-support-models-design.md`](../../nao/brain-support-models-design.md).

### 4.3 Other exclusions

- **Ourobion personal data** — none may enter GMI.
- **LLM-generated claim-kind labels**, including A8's own `claimKind` output — this model exists to
  cross-check A8, so training on A8's labels would make the check circular and cap it at A8's accuracy.

### 4.4 Data manifest

Freeze `data-manifest.json` before preprocessing: repository URL, pinned commit, file hashes, retrieval
time, per-class counts, licence text, attribution, and the reviewer's written GPL-3.0 determination.
Training refuses inputs whose hashes differ.

## 5. Label construction

Train on the corpus's **four native classes** — do not collapse them before training; a 4-way head
loses nothing and preserves the `no relationship` signal that §3 depends on. Map at inference:

| Native label | → contract |
|---|---|
| `direct causal` | `ClaimKind.causal` |
| `conditional causal` | `ClaimKind.causal` (record the sub-label; a hedged causal claim is still a causal claim, and the distinction is worth keeping in the logs) |
| `correlational` | `ClaimKind.correlational` |
| `no relationship` | **no `ClaimKind`** — abstain; see §3 |
| — | `ClaimKind.mechanistic` is never predicted (§2) |

Input construction: the conclusion sentence, Unicode/whitespace-normalised without altering scientific
symbols, capped at 256 wordpieces with dynamic padding. No entity markers. Every row carries
`example_id`, source sentence id, PMID where available, native label, mapped label,
preprocessing-version hash, and source hash.

**Class imbalance is real**: 213 `conditional causal` against 1,356 `no relationship` — roughly 6:1.
Use class-weighted loss, report per-class recall, and never report accuracy alone (a majority-class
predictor scores 44%).

## 6. Splits and leakage

The corpus is small, so split discipline matters more than usual, not less.

- **Stratified 5-fold cross-validation by class**, grouped by PMID so no paper's sentences straddle
  folds.
- De-duplicate normalised sentence text before assigning folds — boilerplate conclusion phrasing
  recurs across papers and would otherwise leak.
- Report **cross-validated mean and standard deviation**, not a single split's number. On 3,061
  examples a single split's macro-F1 has a wide confidence interval, and quoting one number would
  overstate precision.
- Hold the in-domain audit set (§7) out entirely; it is never part of cross-validation.

## 7. Frozen Ourobion-domain audit set

The corpus is general biomedical text. Ourobion's claims concern gut, hydration/heat,
wearables/recovery, and environment/vector metrics, and — importantly — much of that literature is
observational, which is exactly where causal overstatement concentrates.

Reuse the shared discipline: ≥120 conclusion sentences from real corpus papers, sampled across the four
domains, dual-labelled blind by two reviewers against the corpus's own published rubric (reuse it
rather than inventing a new one, so labels stay comparable), adjudicated, hashed. Target ≥80
adjudicated, ≥20 per domain. Record raw agreement, Cohen's kappa, both labels, adjudicated label, and
reason codes.

Deliberately **over-sample observational-study conclusions** relative to their natural frequency and
report that enrichment. This is a challenge set for the failure mode we care about, not a prevalence
sample — and it must be labelled as such so nobody reads its class mix as a population estimate.

Without an independent second reviewer, results are **preliminary** and cannot support promotion.

## 8. Preregistered training recipe

| Setting | Value |
|---|---|
| Architecture | BiomedBERT base (MIT, immutable revision pinned) + 4-class linear head |
| Max sequence length | 256 wordpieces, dynamic padding |
| Optimizer / LR / decay | AdamW · `2e-5` · `0.01` |
| Effective batch size | 16 (small corpus) |
| Epochs | 5, early stopping patience 2 on validation macro F1 |
| Warmup / clipping | 10% · 1.0 |
| Precision | BF16; FP32 metric accumulation |
| Imbalance | Class-weighted loss; weights fixed from the training distribution, not tuned |
| Seeds | 17, 42, 73; **42 is the preregistered release candidate** |
| Selection metric | Macro F1, cross-validated |
| Calibration | One scalar temperature on out-of-fold logits only |

### 8.1 Bounded job ledger

| Jobs | Purpose |
|---|---|
| 1 CPU/preflight | Licence determination recorded, hashes, dedup, fold assertions, class counts |
| 1 GPU smoke | 64 examples, one optimizer step, eval + upload round-trip |
| 5 GPU fold jobs | Seed 42, stratified grouped folds |
| 3 GPU final jobs | Seeds 17/42/73 at the fixed epoch count |
| 1 clean GPU rerun | Seed 42 from an empty container/prefix |

Maximum **10 GPU jobs**, sequential, one container. This is the cheapest model in the roster — 3,061
examples is minutes of GPU time.

## 9. Evaluation protocol

Cross-validated on the corpus, then once on the frozen audit set:

- count and class prevalence; confusion matrix; per-class precision/recall/F1; macro F1; balanced
  accuracy. **Never accuracy alone** (§5);
- **the causal↔correlational confusion cell reported on its own**, in both directions. Predicting
  `correlational` when the truth is `causal` is a missed catch; predicting `causal` when the truth is
  `correlational` would make the cross-check *endorse* the exact error it exists to prevent. The second
  is much worse and must be reported separately, not averaged away;
- `no relationship` per-class metrics, reported with the §3 caveat attached in the same table;
- multiclass Brier, 10-bin equal-mass ECE, reliability diagram;
- bootstrap 95% CIs resampled by PMID; cross-validation mean ± sd;
- abstention coverage and selective error at 0.50/0.60/0.70/0.80 — abstention matters more here than
  in the other models, since a cross-check that declines to fire is harmless while a confident wrong
  one is not;
- coded error table: hedged causal read as correlational, conditional causal, statistical-significance
  phrasing, multi-clause conclusions asserting two different relationships, non-significance
  misreported as null.

Baselines:

1. majority class;
2. a deterministic causal-cue-phrase lexicon over the same sentences ("causes", "leads to",
   "associated with", "linked to") — cheap, interpretable, and the thing the model must beat to justify
   its existence;
3. the published BERT result of 0.90 accuracy / 0.88 macro-F1 as the external anchor;
4. frozen A8/A10 `claimKind` outputs on the audit sentences, if comparable ones exist. No new paid calls.

## 10. Completion and outcome gates

Completion mirrors the NLI pilot's §11.1, with the GPL-3.0 determination added as a mandatory recorded
artifact. Outcome label, one of:

- **`no-go`** — does not beat the cue lexicon, or the causal↔correlational boundary is unreliable;
- **`research-complete`** — useful evidence with stated limits;
- **`eligible-for-shadow-review`** — only if the audit set is non-preliminary **and** cross-validated
  macro F1 ≥0.80 (against the 0.88 published anchor) **and** audit-set macro F1 ≥0.65 **and**
  precision on `causal` ≥0.75 — the asymmetric gate from §9 — **and** ECE ≤0.10 **and** it beats the
  cue lexicon by ≥0.15 macro F1 **and** the licence determination permits the intended use.

**Reproducibility rule:** as the NLI plan — identical hashes; macro F1 within 0.01, per-class F1 within
0.02, prediction agreement ≥98%.

## 11. Cost controls

3,061 examples is trivial: single-digit GPU-minutes per job, and the whole ledger fits comfortably in
an hour of H100 time.

- one GPU only; at most **2 GPU-hours** including the clean rerun;
- at most **USD 8 compute** and **USD 12 all-in**;
- auto-pay off; checkpoint upload after every job.

The real costs are the licence review and the human audit labelling. Consider running this model on the
**same container session** as another zebra model to avoid paying provisioning overhead twice — the
job ledgers are independent, but the container need not be, provided artifacts go to separate release
prefixes (§4.2).

## 12. Stop conditions

Everything in the NLI plan's §14, plus:

- **the GPL-3.0 determination is unavailable, contradictory, or negative** — this model blocks;
- someone proposes folding this data or these weights into the relation/direction model to "reuse the
  encoder";
- someone proposes mapping ChemProt/DrugProt classes onto `mechanistic` to fill the enum (§2);
- someone proposes wiring the `no relationship` class to `RelationKind.no_effect` on the strength of
  this pilot alone (§3);
- the first full evaluation has been viewed and a recipe change is proposed solely to raise the score.

## 13. Execution order

1. **T0** — GMI-H1–H8; **the GPL-3.0 determination is recorded in writing** before anything else.
2. **T1** — `ourobion-model-lab` pinned in a separate namespace; unit tests for the label map, the
   abstain-on-`no relationship` rule, and the never-predict-`mechanistic` rule pass.
3. **T2** — download, hash, de-duplicate, build stratified grouped folds, publish class report. CPU only.
4. **T3** — freeze the in-domain audit set via blinded dual review using the corpus's own rubric; hash it.
5. **T4** — GMI smoke: environment recorded, 64-example run, checkpoint round-trip, cost meter verified.
6. **T5** — the preregistered fold and seed jobs only.
7. **T6** — evaluate; metrics, plots, error analysis, model card carrying the licence statement.
8. **T7** — clean rerun, seed 42.
9. **T8** — upload/checksum release to its isolated prefix, record spend, terminate compute, rotate
   credentials, publish evidence artifacts, declare the outcome.

## 14. Deferred beyond v0

- `mechanistic` coverage — no supervision exists (§2);
- grounding `RelationKind.no_effect` — needs edge-level annotation, not sentence-level (§3);
- Haber et al.'s causal-strength scale and the distortion corpus, pending availability/licence;
- a hedging/certainty head — real data exists (BioScope) and the task is cheap, but it duplicates a
  field the synthesis LLM already emits; revisit only if evidence strength becomes a first-class graded
  output (see [`model-roster.md`](./model-roster.md));
- joint training with the relation/direction model — blocked on the licence question regardless of merit;
- any serving, routing, short-circuiting, or contract change.
