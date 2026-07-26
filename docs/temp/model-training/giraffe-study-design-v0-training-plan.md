---
title: Giraffe Study-Design v0 — GMI training plan
summary: Preregistered plan for training and evaluating a five-class study-design classifier that fills Citation.evidenceTier, using self-derived MEDLINE labels and an independent CC-BY gold evaluation set. Corrects the earlier recipe's two false assumptions — that PublicationType can express cohort/cross-sectional tiers, and that Cochrane Crowd is reusable.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Giraffe Study-Design v0 — GMI training plan

> **Shared execution substrate.** GMI gates, container/network/secret posture, durable storage, the
> external `ourobion-model-lab` repository shape, and the release/provenance contract are defined once
> in the NLI plan ([`../run3/custom-model-training-plan.md`](../run3/custom-model-training-plan.md) §3,
> §4, §12 — moving to `zebra-nli-shadow-v0-training-plan.md` under #139). Only deltas appear here.
> `GMI-H7` must be re-approved for this model's licence manifest, which is different.

## 1. Decision summary

`giraffe-study-design-v0` maps a paper's text to `EvidenceTier` — `1 | 2 | 3 | 4 | 5`
(`shared/brain/relationships.ts:64`), the study-design strength of a supporting source. It implements
model **(b1)** from [memory 0013](../../memory/0013-brain-pipeline-and-support-models-decision.md).

Of the four models in that roster, this one has the **best supervision available**: its labels come from
decades of human MEDLINE indexing rather than from an LLM or a small hand-annotated set. It is the
strongest candidate to actually work.

Same bounded-pilot terms as the other models in this roster: non-serving, no influence on any contract field,
edge score, card, or routing; a documented `no-go` is a valid completion; and because serve-time is a
pure read over precomputed columns
([`decisions/0003-paper-reliability.md`](../../shared/decisions/0003-paper-reliability.md)), it could
only ever run offline.

### 1.1 What it would eventually populate

| Contract field | Source |
|---|---|
| `Citation.evidenceTier: 1\|2\|3\|4\|5` | `shared/brain/relationships.ts:106` |
| `EdgeVerification.evidenceTier` | `relationships.ts:213` |

Pipeline seam: **A5 · Evidence tiering**
([`insight-engine-architecture.md`](../../shared/insight-engine-architecture.md) §A5).

**The model does not replace the rules.** A5 is specified as RULES first — `workType: review` → tier-5
candidate, plus a keyword registry over methods/abstract ("randomized"→4, "cohort"→3,
"cross-sectional"→2, "in vitro"→1) — with an LLM assist only on the inconclusive residue, and tier 2 as
a conservative floor on failure. §10.2 of the same document is explicit: *"keep RULES as the first
pass, model only for the inconclusive residue."* This model is a candidate replacement for **the Haiku
assist on the residue**, not for the rules. Evaluation must therefore report performance on the residue
slice separately from overall accuracy (§9).

## 2. Corrections to the existing design doc

[`brain-support-models-design.md` §2](../../nao/brain-support-models-design.md) specifies this model's
data. Three of its assumptions do not survive checking, and this plan does not inherit them. The source
doc should be corrected under its own change.

**(a) PublicationType cannot express tiers 1, 2, or 3.** The existing label map assigns cohort →
tier 3 and cross-sectional → tier 2 from `<PublicationType>`. MEDLINE has **no** "Cohort Study" or
"Cross-Sectional Study" publication type. Those concepts exist only as MeSH *subject headings*
([Cohort Studies D015331](https://meshb.nlm.nih.gov/record/ui?ui=D015331),
[Cross-Sectional Studies D003430](https://meshb.nlm.nih.gov/record/ui?ui=D003430)). Tier 1
(animal/in-vitro) likewise has no PT — it is signalled by the `Animals` check tag in the absence of
`Humans`. Only tiers 4 and 5 are genuinely PT-derived. This is the single biggest label-construction
problem in the model and §5 rebuilds the map around it.

**(b) Cochrane Crowd is not reusable.** The existing doc proposes it for a binary RCT gate. Its terms
grant a royalty-free licence for **personal use only**, and the underlying records are Embase-derived
with restricted redistribution. It is excluded (§4.2). The 7.3%-positive imbalance figure it contributed
is still a useful planning input, but the data itself cannot be used.

**(c) The indexing-quality worry is smaller than feared, in the place that matters.** NLM moved to
automated indexing in 2022 but **retains human quality assurance specifically on Systematic Review,
Meta-Analysis, and clinical trials**
([NLM Automated Indexing FAQs](https://support.nlm.nih.gov/knowledgebase/article/KA-05326/en-us)) —
i.e. exactly tiers 4 and 5. The lag problem (below) is real; a blanket "post-2022 labels are degraded"
claim is not.

## 3. Fixed pilot contract

| Decision | v0 choice |
|---|---|
| Task | Single-label 5-class classification: paper text → `EvidenceTier` 1–5 |
| Base encoder | `microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext` (MIT), immutable revision pinned |
| Training data | Self-derived from the MEDLINE annual baseline FTP; PMIDs + labels are the artifact, **not** abstract text |
| Gold evaluation | StudyTypeTeller (CC-BY 4.0), 2,645 human-labelled abstracts, collapsed 14→5 tiers |
| Excluded | MultiTagger-v2, Cochrane Crowd, Trialstreamer, CENTRAL, ICTRP, EBM-NLP, PubMed 200k RCT (§4.2) |
| Sampling | ~15–20k per tier, ~60–100k total, stratified |
| Model selection | Fixed recipe, preselected seed `42` |
| Compute | One self-managed GMI GPU container; one GPU |
| Code location | Separate private `ourobion-model-lab`; **no Python enters this repository** |
| Runtime posture | Non-serving, unconditionally |

## 4. Dataset and licence gate

### 4.1 Allowed sources

| Source | Access | Size | Licence posture |
|---|---|---|---|
| **MEDLINE annual baseline** | [ftp.ncbi.nlm.nih.gov/pubmed/baseline](https://ftp.ncbi.nlm.nih.gov/pubmed/baseline) + updatefiles | full snapshot, ~38M records | NLM terms in the [baseline README](https://ftp.ncbi.nlm.nih.gov/pubmed/baseline/README.txt): no charges/fees/royalties, must acknowledge NLM, must keep current or disclose staleness. No registration |
| **StudyTypeTeller** | [repo](https://github.com/Ineichen-Group/StudyTypeTeller) | 2,645 abstracts, 14 study types, κ=0.71 | **CC-BY 4.0** ([paper](https://www.cambridge.org/core/journals/research-synthesis-methods/article/studytypetellerlarge-language-models-to-automatically-classify-research-study-types-for-systematic-reviews/C50EB049FFE2D4367763814311C67B83)) |

Prefer the **baseline FTP over E-utilities**: no rate limits, no key, one clear terms document, and a
single citable snapshot date. (E-utilities allow 3 req/s, or 10 with a key
([policy](https://www.ncbi.nlm.nih.gov/books/NBK25497/)) — workable, but a worse provenance story.)

**Abstract-text caveat, and why the artifact is PMIDs.** NLM states that *some abstracts may be
protected by copyright* and disclaims authority to grant permission
([PubMed help](https://pubmed.ncbi.nlm.nih.gov/help/#download-pubmed-data)). Therefore: abstract text
stays in private object storage as working data and is never committed or redistributed. The
redistributable derived artifact is **`(PMID, tier, label-provenance)` triples**, which are facts about
records, plus the code that rebuilds the text from the baseline.

### 4.2 Explicit exclusions

- **MultiTagger-v2** — 1.25M titles+abstracts labelled with 59 PTs is exactly the right data at the
  right scale ([repo](https://github.com/ScienceNLP-Lab/MultiTagger-v2/tree/main/AMIA)), but the
  repository **declares no licence**. Excluded. Re-deriving the same labels from MEDLINE ourselves is
  cheap and has a clean provenance chain.
- **Cochrane Crowd** — personal-use-only terms (§2b).
- **Trialstreamer** ([Zenodo 4066403](https://zenodo.org/records/4066403)) — CC0, but its RCT/PICO
  labels are **model output (silver)**. Training on them would distil another team's classifier and
  inherit its errors while calling the result human-labelled. Excluded from training; permissible later
  as a comparator only.
- **Cochrane CENTRAL** (proprietary/subscription; AI-training authorization unverified) and **WHO
  ICTRP** (non-commercial, and it holds trial registrations, not abstracts).
- **PubMed 200k RCT** and **CSAbstruct** — despite the name, these are *sentence-level rhetorical role*
  datasets (BACKGROUND/METHOD/RESULT/…), not document-level study design. Wrong task. Noted because the
  name invites exactly this mistake. (They are, however, relevant to a different model — see
  [`leafcutter-sentence-role-v0-training-plan.md`](./leafcutter-sentence-role-v0-training-plan.md).)
- **EBM-NLP** — PICO span NER, wrong task, and no declared licence.
- **Ourobion personal data** and **LLM-generated tier labels** — excluded from train, validation, and
  evaluation. In particular, A5's existing Haiku assist output must not become training data: the model
  is meant to *replace* that assist, so training on it would cap the model at the assist's accuracy and
  make the comparison circular.

### 4.3 Data manifest

Freeze `data-manifest.json` before preprocessing: baseline snapshot date and file hashes, the exact
query/filter expressions, retrieval time, per-tier counts, licences, attribution text, and the
allow/deny decision. Training refuses inputs whose hashes differ.

## 5. Label construction (rebuilt)

Publication Types supply tiers 4–5; MeSH headings and check tags supply 1–3.

| Tier | Rule | Field type |
|---|---|---|
| **5** | PT `D017418` Meta-Analysis ∪ PT `D000078182` Systematic Review | PublicationType |
| **4** | PT `D016449` Randomized Controlled Trial | PublicationType |
| **3** | MeSH `D015331` Cohort Studies ∪ `D018424` Longitudinal Studies ∪ `D003967` Prospective Studies, **with** the `Humans` check tag | MeSH heading |
| **2** | MeSH `D003430` Cross-Sectional Studies with `Humans`, minus any tier-3 term | MeSH heading |
| **1** | `Animals` check tag **without** `Humans`, or in-vitro headings | Check tag |

Resolution and hygiene rules:

- **Multi-label → max tier.** Records routinely carry several PTs (MultiTagger-v2 models the PT space
  as inherently multi-label with 59 classes). A paper tagged both Meta-Analysis and RCT is tier 5.
- **Never use `D016032` "Randomized Controlled Trials as Topic."** It is a subject heading for
  commentary *about* RCTs; filtering on it poisons tier 4 with editorials. Use the PT field only.
- **Drop `D016428` "Journal Article"** and other near-universal PTs as stopwords.
- **Exclude** records with no abstract, non-English records, and anything indexed in the **last 12
  months** — PT/MeSH assignment lags, taking ~90 days to reach 75% completeness
  ([indexing delay study](https://www.medrxiv.org/content/10.1101/2020.10.01.20205476v1.full.pdf)).
  Never sample by recency.
- **Stratify** to ~15–20k per tier. Tiers 2 and 3 dominate the raw distribution; undersample them.
- Every row carries `pmid`, tier, the exact rule that fired, source field type, snapshot date, and a
  preprocessing-version hash. No row exists without label provenance.

**Honest limitation to state in the model card.** Tiers 4–5 come from a curated, QA'd PublicationType
field; tiers 1–3 come from MeSH headings and check tags, which describe subject matter rather than
asserting the study's design. A record about a cohort may carry `Cohort Studies` without being one.
Tier 1–3 labels are therefore **weaker supervision than tier 4–5 labels**, and per-tier metrics — not
the macro average — are what tell you whether they hold up.

## 6. The train/serve input mismatch (must be measured, not assumed away)

Training inputs are **title + abstract**, because that is what MEDLINE gives. A5's serving input is
**methods text + `workType`** on a `StructuredPaper`, and the corpus includes OA/preprint PDFs that
were never MEDLINE-indexed at all. Three distinct shifts:

1. **field shift** — title+abstract vs methods section;
2. **register shift** — MEDLINE-indexed abstracts are copy-edited and often structurally headed;
   bioRxiv/medRxiv text is not;
3. **population shift** — the training pool is by construction the indexed subset.

v0 handles this by measuring it rather than pretending it away:

- train on title+abstract (the only labelled view available);
- build **three evaluation views** of the same held-out papers where the text permits: title+abstract,
  methods-section-only, and full-text-first-2000-characters;
- hold out a **preprint slice** (papers with no MEDLINE PT, tier-labelled by hand as part of the audit
  set) and report it separately.

If methods-only accuracy collapses relative to abstract accuracy, the honest conclusion is that the
model serves A5's actual input poorly — regardless of how good the headline number looks. Record that
as a first-class result, not a footnote.

## 7. Frozen evaluation sets

**Gold set (primary).** StudyTypeTeller's 2,645 CC-BY human-annotated abstracts, collapsed from its 14
study types to our 5 tiers. Freeze the collapse map **before** looking at any prediction, and publish
it — the mapping is a judgement call and must not be tuned to results. This set is the one that
matters: it breaks the circularity of training on MEDLINE's indexing and testing on the same.

**Held-out MEDLINE split (secondary).** A PMID-disjoint sample from the same construction. It measures
"did we learn the indexing rules", which is a weaker question, and its numbers will be higher. Report
both; lead with the gold set.

**Ourobion-domain audit slice.** Per the shared discipline, ≥60 papers drawn from the actual corpus
across gut / hydration-heat / wearables-recovery / environment-vector, dual-labelled blind by two
reviewers against a published tier rubric, adjudicated, hashed. Include the preprint slice here (§6).
Without an independent second reviewer, results are **preliminary** and cannot support promotion.

## 8. Splits and leakage

- Split by **PMID**, disjointly; assert zero intersection.
- Assert no PMID from StudyTypeTeller appears anywhere in training — it is drawn from PubMed, so
  collision is likely, and this is the leak that would silently invalidate the headline number. Record
  the collision count removed.
- De-duplicate near-identical abstracts (errata, reprints, multi-journal republication) by normalised
  text hash before splitting.

## 9. Preregistered training recipe

| Setting | Value |
|---|---|
| Architecture | BiomedBERT base + 5-class linear head |
| Max sequence length | 512 wordpieces, **dynamic padding** (title+abstract is typically 200–350 tokens) |
| Optimizer / LR / decay | AdamW · `2e-5` · `0.01` |
| Effective batch size | 32 |
| Epochs | 3 |
| Warmup / clipping | 10% · 1.0 |
| Precision | BF16; FP32 metric accumulation |
| Imbalance | Stratified sampling at construction (§5) + class-weighted loss; report both, tune neither |
| Seeds | 17, 42, 73; **42 is the preregistered release candidate** |
| Selection metric | Macro F1 on the validation split |
| Calibration | One scalar temperature fitted on out-of-fold validation logits only |
| Second encoder | One run with `michiyasunaga/BioLinkBERT-base` (Apache-2.0) as a robustness check, **not** as a selection candidate |

### 9.1 Bounded job ledger

| Jobs | Purpose |
|---|---|
| 1 CPU/preflight | Licence, baseline hashes, label-rule report, per-tier counts, PMID leak check vs StudyTypeTeller |
| 1 GPU smoke | 64 examples, one optimizer step, eval + artifact upload round-trip |
| 3 GPU main jobs | Seeds 17/42/73, fixed recipe |
| 1 GPU encoder check | BioLinkBERT-base, seed 42 |
| 1 GPU ablation | Title-only input, seed 42 — quantifies how much the abstract actually contributes |
| 1 clean GPU rerun | Seed 42 from an empty container/prefix |

Maximum **7 GPU jobs**, sequential, one container.

## 10. Evaluation protocol

On the gold set, the held-out MEDLINE split, each of the three input views (§6), and the audit slice:

- count and class prevalence; confusion matrix; per-tier precision/recall/F1; macro F1; balanced accuracy;
- **tier-2-vs-tier-3 confusion reported on its own** — cross-sectional vs cohort is the hard boundary
  and the one that drags macro F1 down. A headline macro F1 that hides a collapsed 2/3 boundary is a
  misleading result;
- **residue-slice performance** — accuracy restricted to papers where A5's deterministic rules are
  inconclusive, since that is the only slice the model would actually serve (§1.1);
- adjacent-error rate (off-by-one tier) reported separately from distant errors — confusing tier 4 with
  5 is far less harmful than confusing 1 with 5;
- multiclass Brier, 10-bin equal-mass ECE, reliability diagram;
- bootstrap 95% CIs resampled by paper;
- abstention coverage and selective error at 0.50/0.60/0.70/0.80;
- latency, throughput, peak GPU memory, wall-clock, GPU-hours.

Baselines:

1. majority class;
2. **A5's existing deterministic keyword rules**, run over the same evaluation sets — the model must
   beat the rules it would supplement, or it has no reason to exist;
3. title-only ablation;
4. the frozen Haiku-assist outputs on the same papers, if any exist. No new paid calls.

### 10.1 Published anchors

| Task | Result |
|---|---|
| 14-class study type, SciBERT | **F1 0.80–0.84**; GPT-4-turbo 0.645; GPT-3.5 0.540 ([StudyTypeTeller](https://www.cambridge.org/core/journals/research-synthesis-methods/article/studytypetellerlarge-language-models-to-automatically-classify-research-study-types-for-systematic-reviews/C50EB049FFE2D4367763814311C67B83)) |
| 59-label multi-label PT, PubMedBERT | macro-F1 **0.681**, macro-AUC 0.973 ([AMIA 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12099436/)) |
| Binary RCT, Cochrane classifier | ≥98.5% recall at threshold 0.244 ([NICE ATRS](https://www.gov.uk/algorithmic-transparency-records/nice-cochrane-randomised-controlled-trials-rct-classifier)) |
| Animal vs other, binary | F1 up to 0.99 |

Note the shape of this table: near-0.99 numbers exist **only** for easy binary splits. A 5-class tier
task landing at macro-F1 0.72–0.80 is a good result. **≥0.85 should be treated as suspicious** and
checked for leakage or for tiers 1/4/5 dominating the mix.

## 11. Completion and outcome gates

Completion mirrors the NLI pilot's §11.1. Outcome label, one of:

- **`no-go`** — does not beat the deterministic rules, or the 2/3 boundary collapses;
- **`research-complete`** — useful evidence with stated limits;
- **`eligible-for-shadow-review`** — only if the audit slice is non-preliminary **and** gold-set macro
  F1 ≥0.72 **and** it beats the A5 rules baseline by ≥0.10 macro F1 on the residue slice **and** every
  tier's recall ≥0.55 **and** tier-2-vs-3 F1 ≥0.50 **and** ECE ≤0.10 **and** methods-view accuracy is
  within 0.10 of abstract-view accuracy (§6).

That last condition is the one most likely to fail, and it is the one that determines whether the model
is usable at A5 at all.

**Reproducibility rule:** as the NLI plan — identical input/config/code/environment hashes; macro F1
within 0.01, per-class F1 within 0.02, prediction agreement ≥98%.

## 12. Cost controls

Compute is genuinely a non-issue here. At ~700–1,200 seq/s for a 110M encoder on an H100 with dynamic
padding, 100k examples × 3 epochs is well under half a GPU-hour; even 1M × 3 on a 340M encoder stays
under five. (Extrapolated from [NGC BERT PyTorch](https://github.com/NVIDIA/DeepLearningExamples/blob/master/PyTorch/LanguageModeling/BERT/README.md)
A100 figures — **unverified as direct H100 measurements**, so treat as planning estimates.)

- one GPU only; at most **4 GPU-hours** including the clean rerun;
- at most **USD 15 compute** and **USD 20 all-in**;
- auto-pay off; checkpoint upload after every job.

**Size this pilot around label quality, not GPU cost.** The expensive resources are the baseline
download/parse (CPU + disk) and the human audit labelling.

## 13. Stop conditions

Everything in the NLI plan's §14, plus:

- StudyTypeTeller PMIDs are found in training and cannot be cleanly removed;
- the tier-1/2/3 MeSH-derived labels prove so noisy on the gold set that only 4/5 are learnable — stop
  and report a two-tier finding honestly rather than quietly redefining the task;
- someone proposes training on Trialstreamer silver labels, MultiTagger-v2, or A5's Haiku output to
  raise the score;
- someone proposes dropping the tier-2/3 boundary from reported metrics;
- the first full evaluation has been viewed and a recipe change is proposed solely to raise the score.

## 14. Execution order

1. **T0** — GMI-H1–H8; **GMI-H7 re-approved** for the MEDLINE + StudyTypeTeller manifest.
2. **T1** — `ourobion-model-lab` pinned; unit tests for the label rules, the max-tier resolution, the
   D016449/D016032 guard, and the StudyTypeTeller collapse map pass.
3. **T2** — download and hash the baseline, apply label rules, stratify, assert PMID disjointness and
   the StudyTypeTeller leak check, publish the class/provenance report. **CPU only.**
4. **T3** — freeze the StudyTypeTeller collapse map and the in-domain audit slice (incl. preprints);
   hash both.
5. **T4** — GMI smoke: environment recorded, 64-example run, checkpoint round-trip, cost meter verified.
6. **T5** — the preregistered seed, encoder-check, and ablation jobs only.
7. **T6** — evaluate all views and sets; metrics, plots, error analysis, model card.
8. **T7** — clean rerun, seed 42.
9. **T8** — upload/checksum release, record spend, terminate compute, rotate credentials, publish
   evidence artifacts, declare the outcome.

## 15. Deferred beyond v0

- replacing A5's deterministic rules rather than supplementing their residue;
- risk-of-bias scoring — a separate capability, deliberately out of scope
  (see [`model-roster.md`](./model-roster.md));
- a large-encoder run, or any encoder search beyond the single BioLinkBERT robustness check;
- training on Ourobion papers, A5 assist output, or human verdicts;
- multi-label tier output, tier confidence surfaced to users, and any serving, routing, or
  contract change.
