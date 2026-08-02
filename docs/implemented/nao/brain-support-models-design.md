---
title: Brain support models — training design (public-data-first)
summary: How the three small biomedical encoders (NLI pre-filter, study-design + venue tiers, relation/direction) could be trained on free public data to offload the two brain LLMs. Written as a pre-training design; its "no model trained" and three-model framings are both superseded — Zebra and Viceroy have since been trained, and the roster is now five models. The numbered engine stages live in insight-engine-architecture.
type: design
scope: nao
status: deferred
updated: 2026-08-02
---
# Brain support models — training design (public-data-first)

> **⚠ Two framings in this document are superseded. Do not cite it for model status.**
>
> 1. **"No model has been trained" is false.** Zebra and Viceroy were trained and evaluated — on
>    local Apple Silicon (`device: mps`, fp32; Zebra in 313 s of wall-clock training), after the
>    requested GPU container did not arrive. See
>    [`docs/development/model-training/README.md`](../../development/model-training/README.md) and the
>    frozen artifacts under `model-training/evidence/`.
> 2. **The "three support models" framing is superseded.** The durable programme is now five —
>    Zebra, Giraffe, Salmon, Viceroy, Leafcutter — of which Zebra and Viceroy have trained
>    checkpoints and the rest remain planned research directions.
>
> Per the Run-4 audit
> ([`documentation-freshness-audit-2026-08-01`](../../development/run4/documentation-freshness-audit-2026-08-01.md)),
> model and evaluation truth is routed through **#277** and is deliberately **not** repaired inside
> this file: the body below is left as the original pre-training design so the reasoning stays
> readable. No performance figure has been imported here. Note also that no checkpoint is validated or
> authorized for product serving — evidence is not serving permission (`AGENTS.md` §3) — and Viceroy
> has one frozen fold-0 holdout rather than completed five-fold cross-validation.

How ourobion could train the three small "self-trained" models that offload work from the two brain
LLMs (synthesis + verifier). This was written as a **design doc ahead of any training run** (see the
correction above; Zebra and Viceroy have since been trained).
It is grounded in **real sample records pulled live on 2026-07-01** from each dataset (schemas, label
sets, and split sizes below are observed, not assumed).

**Scope.** This doc covers only the three support models. How they slot into synthesis/verification is [`brain-synthesis-design.md`](brain-synthesis-design.md); the end-to-end 23-stage insight engine and its inter-stage contracts live in [`insight-engine-architecture`](../shared/insight-engine-architecture.md).

- Product framing + why these models: [pipeline decision](../../memory/0013-brain-pipeline-and-support-models-decision.md)
- The contract fields these models populate/verify: [`brain-synthesis-design.md`](brain-synthesis-design.md) +
  [`../../shared/brain/relationships.ts`](../../../shared/brain/relationships.ts).

> **Licensing:** non-commercial status does not make an unconfirmed licence acceptable. Every training
> source, transform, base model and redistributed artifact needs an explicit recorded licence and
> attribution decision before use. The isolated `zebra-nli-shadow-v0` experiment uses SciFact only
> and excludes HealthVer until reusable permission/licensing is documented. JCR/Impact Factor remains
> dropped (paid Clarivate), with the
> deterministic venue lookup using SJR + OpenAlex instead.

---

## 0 · The shared idea

None of the three trains on ourobion data: the product now has generated relationship claims and
verifications, but it does **not** yet have an approved, independently human-labelled training corpus.
Each model is a **fine-tune of a small biomedical encoder on existing public labelled data**, with an
explicit **label-mapping layer** onto our contract enums. A future approved set of human-adjudicated
ourobion edges may become a **held-out evaluation set first**, and only a separately approved late
fine-tune later. At inference each model **populates or cross-checks a
specific `EdgeVerification` / `Citation` field**, so it removes an LLM call rather than adding one.

| Model | Trains on | Populates / checks | Base encoder |
|---|---|---|---|
| (a) claim-support / NLI | SciFact, HealthVer (+PUBHEALTH noisy, +SciNLI aux) | `EdgeVerification.verdict` (pre-filter) | PubMedBERT / BioLinkBERT / DeBERTa-v3 |
| (b1) study-design | PubMed pub-types, Cochrane Crowd | `Citation.evidenceTier` (1–5) | PubMedBERT |
| (b2) venue weight *(no training)* | OpenAlex Sources + SJR | `Citation.impactTier` | — (lookup) |
| (c) relation / kind / direction | BioRED, ChemProt, SemEval-2010 (+DDI aux) | `relation`, `claimKind`, `directionCheck` | PubMedBERT + entity markers |

**Practical data-loading gotcha (observed):** the HF *datasets-server* refuses script-based datasets
(`allenai/scifact`, `ImperialCollegeLondon/health_fact`, `dwadden/healthver_entailment`, `bigbio/biored`
all 500 on the server). For training, load them via the `datasets` library (`trust_remote_code`) or use
the **parquet mirrors** noted per-model below — the field shapes are identical.

---

## 1 · Model (a) — claim-support / NLI

> **Experiment boundary:** the broader candidate recipe below remains roadmap context. The standalone
> [`zebra-nli-shadow-v0` plan](../../development/model-training/zebra-nli-shadow-v0-training-plan.md) trains and
> evaluates one SciFact-only BiomedBERT pilot; HealthVer, PUBHEALTH and SciNLI are not Zebra inputs.

**Task.** Cross-encoder: `[CLS] claim [SEP] evidence-text` → **supported / contradicted / uncertain**
(our `verdict`, collapsed to 3 for the model; `partial`/`unsupported` are recovered downstream from the
graded fields, not this classifier).

**Real data (verified shapes):**

| Dataset | Load via | Shape (observed) | Labels | Sizes (tr/dev/test) |
|---|---|---|---|---|
| **SciFact** (best) | `allenai/scifact_entailment` (parquet, viewer-OK) | `claim`, `title`, `abstract[]` (sentence list), `verdict`, `evidence[]` (rationale idxs) | `SUPPORT`, `CONTRADICT`, `NEI` | 919 / 340 / — |
| **HealthVer** | orig `dwadden/healthver_entailment` (script) or mirror `jpd459/healthver_resplit` | `Claim`, `Question`, `Evidence`, `Label` | `Supports`, `Refutes`, `Neutral` | ~5k / 850 / 840 (orig ~14k) |
| **PUBHEALTH** (noisy, optional) | mirror `Jezzarax/pubhealth-converted` (`pubhealth_source`) | `claim`, `main_text`, `explanation`, `label`, `subjects` | `false`, `mixture`, `true`, `unproven` | 9,804 / 1,223 / 1,231 |
| **SciNLI** (aux only) | `tasksource/scinli` (viewer-OK) | `sentence1`, `sentence2`, `label` | `contrasting`, `reasoning`, `entailment`, `neutral` | 101,412 / 2,000 / 4,000 |

**Label mapping → `verdict`:**

| Source label | → our verdict |
|---|---|
| SciFact `SUPPORT` · HealthVer `Supports` · PUBHEALTH `true` | **supported** |
| SciFact `CONTRADICT` · HealthVer `Refutes` · PUBHEALTH `false` | **contradicted** |
| SciFact `NEI` · HealthVer `Neutral` · PUBHEALTH `mixture`/`unproven` | **uncertain** |
| SciNLI (any) | **not mapped** — use as intermediate-task pretraining only |

**Recipe.**
1. **Warm-start** from an MNLI/ANLI-pretrained checkpoint (NLI transfer is well-established); optionally
   an intermediate fine-tune on **SciNLI** (100k, in-domain scientific discourse) to adapt the encoder.
2. **Fine-tune** on **SciFact ⊕ HealthVer** with the mapping above. Evidence text = for SciFact, the
   cited abstract (join `abstract[]` by `evidence[]` rationale sentences, or use the whole abstract); for
   HealthVer, the `Evidence` field.
3. **PUBHEALTH is optional and noisy** — it mixes political fact-checks with health (a sample claim was
   about the Clinton Foundation), and its evidence is a multi-KB `main_text`. If used, filter to health
   `subjects` and window `main_text`; treat as weak-supervision, not core.
4. **Eval** on held-out SciFact `validation`, then on ourobion edges once they exist.

**Gotchas (observed):** label vocabularies genuinely differ (SciFact 3-way verdict vs SciNLI 4-way
discourse vs PUBHEALTH 4-way veracity) — an explicit mapping layer is mandatory, never a naive merge.
SciFact `NEI` rows have empty `evidence`; the entailment config already provides the claim×abstract join
so you don't have to reconstruct it. PUBHEALTH mirror double-escapes quotes (`"""`) — sanitize.

**In pipeline.** Runs on `(synthesised claim, retrieved evidence)` as a **cheap first-pass verifier** —
`contradicted`/`uncertain` short-circuits before the verifier LLM spends a token; the LLM's independent
retrieval still governs the final graded verdict.

---

## 2 · Model (b) — evidence tier + venue weight

Two halves, deliberately separate (venue prestige ≠ study-design strength — the `impactTier` vs
`evidenceTier` split in the contract).

### (b1) Study-design classifier → `evidenceTier` (1–5) — trainable

**Task.** `title + abstract` → design tier. **Self-labelled from PubMed**: the `<PublicationType>` list
in each record *is* the label (verified live — an RCT record carries `Randomized Controlled Trial`
(UI D016449); a review carries `Systematic Review` (D000078182) + `Meta-Analysis` (D017418)).

**Label mapping → `evidenceTier`:**

| PubMed PublicationType | → evidenceTier |
|---|---|
| Meta-Analysis, Systematic Review | **5** |
| Randomized Controlled Trial (D016449) | **4** |
| Cohort / longitudinal (Comparative Study, Multicenter Study, Observational Study w/ follow-up) | **3** |
| Cross-sectional / Observational Study (D064888) | **2** |
| in-vitro / mechanistic / animal (no human-clinical PT) | **1** |

**Data acquisition (free, no key needed; key raises rate to 10 req/s):** per class, `esearch` with a
`"<type>"[Publication Type]` filter to build a labelled seed set (e.g. `randomized controlled
trial[Publication Type]` → thousands), then `efetch …&retmode=xml` for `title + abstract`. Add
`&tool=ourobion&email=…`. Supplement with the **Cochrane Crowd RCT set** (~280,620 title+abstract records
labelled RCT/not-RCT, ~7% positive) for a strong **binary RCT gate**.

**Gotchas (observed):** exclude `Journal Article` (D016428, near-universal noise). **Disambiguate**
`Randomized Controlled Trial` (D016449, an actual RCT) from `Randomized Controlled Trials as Topic`
(D016032, a review *about* RCTs) — they look similar and mean opposite things for the tier. PublicationType
is human-indexed and lags, so train on well-indexed older papers (fine) and expect very new papers to lack
it at inference (fall back to the LLM/abstract text). Cochrane's binary set is ~7% positive — handle the
imbalance (class weights / resampling); their validation applies a 400-char min-abstract filter, replicate
it for comparable eval.

**Base/recipe.** PubMedBERT, either a single multi-class head or a **hierarchy** (Cochrane binary
RCT-gate → multi-class design on the rest). Eval on held-out PubMed + a manually-checked slice.

### (b2) Venue weight → `impactTier` — **no training, deterministic lookup**

OpenAlex **Source** object by ISSN (`/sources/issn:<issn_l>`) exposes `summary_stats.h_index`,
`summary_stats["2yr_mean_citedness"]` (an impact-factor-like number), `is_core`, `is_in_doaj`,
`works_count`; combine with **SJR** quartile. Verified live: work/source lookups return **HTTP 200 with no
API key and `X-RateLimit-Cost-USD: 0`**. Map to bands: `high` / `moderate` / `low` / `preprint` via
thresholds. Cache per-ISSN.

**Gotchas (observed):** trust `primary_location.source.type` + `issn_l`, **not** the work-level `type`
(a journal article showed `type:"book-chapter"` — work-type labels are noisy). OpenAlex now emits
USD-denominated rate headers (`X-RateLimit-*-USD`, budget `$0.1`/window shown) — single lookups are free,
but send `mailto=` and watch the headers for bulk; the CC0 snapshot is the free bulk fallback.

---

## 3 · Model (c) — relation / claim-kind / direction

**Task.** Given the sentence/span with the two metric mentions marked (`[E1]…[/E1] [E2]…[/E2]`), predict
our `relation` (6-way) + `claimKind` (3-way) + **direction** (which entity is subject). Standard
biomedical RE with entity-marker tokens.

**Real data (verified shapes):**

| Dataset | Load via | Direction encoding (observed) | Native labels | Sizes |
|---|---|---|---|---|
| **BioRED** | `gyorilab/biored_original` (has `novel`) / `wcole3/biored-parquet` (bigbio_kb) | arg1→arg2 order; polarity in the type | Association, Positive_Correlation, Negative_Correlation, Bind, Conversion, Cotreatment, Comparison, Drug_Interaction | 400 / 100 / 100 docs |
| **ChemProt** | `bigbio/chemprot` (`chemprot_full_source` = CPR codes; `_bigbio_kb` = names) | arg order; direction in the CPR class | CPR:0–10 (eval subset CPR:3,4,5,6,9 = Up/Down-regulator, Agonist, Antagonist, Substrate) | 1020 / 612 / 800 docs |
| **SemEval-2010 Task 8** (best for direction) | `SemEvalWorkshop/sem_eval_2010_task_8` | **direction baked into label** `(e1,e2)`/`(e2,e1)` | 9 types × 2 dirs + Other (incl. **Cause-Effect**) | 8000 / — / 2717 |
| **DDI 2013** (aux) | `bigbio/ddi_corpus` | arg order (semantically unordered) | ADVISE, EFFECT, INT, MECHANISM | 714 / — / 303 docs |

**Label mapping → our enums:**

| Source label | → `relation` | → `claimKind` |
|---|---|---|
| BioRED `Positive_Correlation` · ChemProt `Upregulator` (CPR:3) | **increases** | correlational / mechanistic* |
| BioRED `Negative_Correlation` · ChemProt `Downregulator` (CPR:4) | **decreases** | correlational / mechanistic* |
| BioRED `Association` | **correlates** | correlational |
| BioRED `Bind`/`Conversion`/`Cotreatment` · ChemProt `Agonist`/`Antagonist`/`Substrate` · DDI `MECHANISM` | **modulates** | mechanistic |
| BioRED `Drug_Interaction` · DDI `INT` | **confounds** | mechanistic |
| SemEval `Cause-Effect(*)` | — (direction signal) | **causal** |
| SemEval other + `Other` | negatives | — (causal-vs-not + direction pretraining) |

\* polarity from a *correlation* label → correlational; from a *regulation* label → mechanistic/causal.

**Recipe.** PubMedBERT with inserted entity-marker tokens (the standard RE setup that also gives you
direction from marker order). Train BioRED ⊕ ChemProt for the biomedical relation/polarity labels; add
**SemEval** for explicit **direction** + **causal-vs-correlational** supervision (general-domain, so use
it as an auxiliary/pretraining signal, not the primary biomedical labels). De-dup BioRED to concept-level
`(norm-arg1, norm-arg2, type)` — the bigbio_kb view explodes one logical relation into many mention pairs
(one doc had 107 relation rows).

**Gap (observed):** **`no_effect`** (a studied null result) has **no clean public label** in any of
these — none of the four datasets carries it. Source it later from our own edges, from PubMed "no
association"/null-result mining, or leave it to the LLM. Flag it; don't pretend the trained model covers
it.

**In pipeline.** Runs on the span the synthesis LLM cited → predicts relation/kind/direction and
**cross-checks** the LLM's claim, feeding `directionCheck.matchesClaim`, `claimKindCheck.supportedKind`,
and a sanity check on `relation` — deterministic corroboration of the most damaging failure modes
(direction flip, correlation-stated-as-causation).

---

## 4 · Sequencing & honest limits

1. The isolated model-training workstream trains only **(a)** as the non-serving
   `zebra-nli-shadow-v0` SciFact pilot. It is not a Run-3 unit. Model (c) stays deferred.
2. **(b2)** already ships as a lookup (no training). **(b1)** and (c) remain later work.
3. When the pipeline produces independently human-labelled `(claim, quote, verdict)` tuples, use them
   first as a **held-out eval set**, not automatic training labels; only a later approved phase may
   fine-tune on them.
4. When sufficient reviewed labels exist, consider a late fine-tune and separately decide whether to
   run (a) in shadow. Zebra scores never short-circuit the verifier unless a later product decision,
   safety review, and serving contract explicitly authorize that change.

**Limits to keep visible:** (1) domain gap — SciFact/BioRED skew to biomedical abstracts; our
hydration/vector/environment metric pairs are under-represented, so the late in-house fine-tune matters.
(2) `no_effect` is unsourced (above). (3) study-design labels lag for brand-new papers. (4) these models
**assist** the two brain LLMs; they don't replace the independent-retrieval + adversarial verification that
makes an edge servable.

## 5 · Candidate data sources (availability observed 2026-07-01; licences rechecked per run)

SciFact `allenai/scifact_entailment` / `bigbio/scifact` · HealthVer `dwadden/healthver_entailment`
(mirror `jpd459/healthver_resplit`) · PUBHEALTH `ImperialCollegeLondon/health_fact` (mirror
`Jezzarax/pubhealth-converted`) · SciNLI `tasksource/scinli` · BioRED `gyorilab/biored_original` /
`wcole3/biored-parquet` · ChemProt `bigbio/chemprot` · DDI `bigbio/ddi_corpus` · SemEval-2010
`SemEvalWorkshop/sem_eval_2010_task_8` · PubMed E-utilities (esearch/efetch) · Cochrane Crowd
(crowd.cochrane.org/DownloadData.php) · OpenAlex `/works`, `/sources` · SJR (scimagojr.com) · encoders:
`microsoft/BiomedNLP-BiomedBERT-*` (MIT), `michiyasunaga/BioLinkBERT-base` (Apache-2.0),
`microsoft/deberta-v3-base` (MIT).
