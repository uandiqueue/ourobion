---
title: Custom-model roster — what we train, what we don't, and why
summary: The decision register for every custom-model candidate in Ourobion's brain pipeline. Records five planned models, one shipped deterministic lookup, one previously rejected model, and nine researched candidates that should NOT be trained — with the evidence for each negative verdict so they are not re-researched later.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Custom-model roster — what we train, what we don't, and why

Companion to the per-model training plans in this folder. Its job is to make the **negative** decisions
durable: which candidates were investigated, rejected, and why. A roster that lists only what we build
invites the same research to be redone every few months.

Research date for all external claims: **2026-07-26**.

The Zebra NLI plan and all four additional plans now live together in this isolated model-training
folder. None is a Run-3 product unit.

## 1. The roster

| # | Codename | Candidate | Contract field / stage | Verdict | Plan |
|---|---|---|---|---|---|
| (a) | `zebra` | NLI claim/evidence cross-encoder | `EdgeVerification.verdict` · A10 | **TRAIN** — planned | [NLI plan](./zebra-nli-shadow-v0-training-plan.md) |
| (b1) | `giraffe` | Study-design → evidence tier | `Citation.evidenceTier` · A5 | **TRAIN** — best supervision in the roster | [study-design](./giraffe-study-design-v0-training-plan.md) |
| (b2) | — | Venue → impact tier | `Citation.impactTier` | **NO — shipped deterministically** | — |
| (c-i) | `salmon` | Relation type + direction | `directionCheck` · A10/A8 | **TRAIN** — gated on one licence | [relation-direction](./salmon-relation-direction-v0-training-plan.md) |
| (c-ii) | `viceroy` | Claim kind (causal vs correlational) | `claimKindCheck` · A10 | **TRAIN** — gated on GPL-3.0 review | [claim-kind](./viceroy-claim-kind-v0-training-plan.md) |
| (d) | `leafcutter` | Sentence-role tagger | `sentences[].role` · A4 | **TRAIN** — but probably without a GPU | [sentence-role](./leafcutter-sentence-role-v0-training-plan.md) |
| — | — | ML reliability regressor | `edgeScore` | **REJECTED** (pre-existing) | §4 |
| — | — | 9 further candidates | various | **DO NOT TRAIN** | §3 |

Four new plans accompany this document. Combined bounded budget across all four is **≤14 GPU-hours and
≤USD 55 all-in** — and one of them is likely to need no GPU at all. Compute is not the constraint
anywhere in this roster; **licences and human annotation are**.

### 1.1 The codename scheme

Each codename encodes what the model actually discriminates, so the name carries information rather
than being decoration. Pattern: `<codename>-<function>-v<n>`.

| Codename | Why |
|---|---|
| `zebra` | Distinct black-and-white stripes — the stark binary of a supporting vs non-supporting verdict |
| `giraffe` | Height is the whole point: the model ranks papers by how high they sit on the 1–5 evidence ladder |
| `salmon` | Knows upstream from downstream — orientation against a current, i.e. which entity is the subject |
| `viceroy` | The butterfly that mimics the Monarch; correlation dressed as causation is the same look-alike problem |
| `leafcutter` | Cuts a paper into labelled pieces at near-zero marginal cost per piece, at colony-scale throughput |

`zebra` refers **only** to the NLI model. Do not use it as a family prefix for the others.

## 2. What changed as a result of this research

Three findings contradict recipes currently written into active design docs. Each is recorded in the
relevant plan; [`brain-support-models-design.md`](../../implemented/nao/brain-support-models-design.md) should be
corrected under its own change rather than edited here.

1. **BioRED does not encode direction.** The design doc says direction comes from "arg1→arg2 order".
   The BioRED overview states the opposite: *"since the BioRED relations are nondirectional, we
   eliminated the distinction between subject and object"*
   ([overview](https://pmc.ncbi.nlm.nih.gov/articles/PMC11306928/)). Direction supervision requires the
   2025 **BioREDirect** enrichment ([repo](https://github.com/ncbi-nlp/BioREDirect)) — whose data
   licence is unverified and is now the single gating item for that model.
2. **PublicationType cannot express tiers 1–3.** MEDLINE has no "Cohort Study" or "Cross-Sectional
   Study" publication type; those are MeSH *subject headings*, and tier 1 is signalled by check tags.
   The existing tier map is unbuildable as written; the study-design plan rebuilds it.
3. **Cochrane Crowd is personal-use only.** Proposed in the design doc as the RCT gate; its terms do
   not permit this use. Excluded.

A fourth finding is additive rather than corrective: the `no_effect` gap, long recorded as unsourced,
has exactly one licensed lead — see §5.

## 3. Researched and rejected

Nine candidates were investigated on the question "would a small trained encoder beat the alternative?"
All nine came back no. Ordered by how plausible they initially seemed.

**Evidence retrieval + reranking — use off-the-shelf.** Zero-shot open rerankers already exceed what
could be trained on the ~1–5k pairs Ourobion could realistically label. `ncbi/MedCPT`
([HF](https://huggingface.co/ncbi/MedCPT-Cross-Encoder)) is **public domain** — the cleanest licence
encountered anywhere in this research — and sets SOTA on several BEIR biomedical tasks;
`BAAI/bge-reranker-v2-m3` (Apache-2.0) is a strong second stage over BM25. Fine-tuning would also drag
in MS MARCO, which is **non-commercial research only**.

**Rationale / evidence-sentence selection — subsumed by the NLI model.** Identical input shape (claim ×
sentence → supports?). The field reached this conclusion itself: MultiVerS/LongChecker deliberately
collapsed rationale selection into the label-prediction model. Score each sentence with the NLI
cross-encoder and take the argmax.

**Quote / grounding verification — deterministic plus the NLI model.** Split the task honestly: "does
the span appear in the source" is string matching with Unicode/whitespace normalisation and never
warrants a model; "does the span support the claim" is the NLI model. If an independent third opinion
is ever wanted, `lytang/MiniCheck-Flan-T5-Large` is **MIT** and <1B params. Avoid
`Bespoke-MiniCheck-7B` — non-commercial.

**Entity normalisation / metric linking — a dictionary wins.** With ~100 registry entries, a curated
alias table plus embedding nearest-neighbour beats anything trained and is debuggable. The UMLS route
is actively costly: NLM requires a signed licence, prohibits redistributing the Metathesaurus or
subsets, and **requires an annual usage report**. scispaCy's UMLS linker and MetaMap both pull that
obligation in. If colloquial mentions ("gut comfort") miss, embed aliases with `SapBERT` (MIT).

**PICO / population + sample-size extraction — off-the-shelf exists.** Trialstreamer already ships
trained PICO models with a CC-BY-4.0 Zenodo release. Sample size is a regex. EBM-NLP has **no licence
file** on its public repository — do not assume permissive.

**Risk-of-bias classification — out of scope.** The study-design tier already captures most of the RoB
signal Ourobion acts on, and
[`decisions/0003-paper-reliability.md`](../decisions/0003-paper-reliability.md) already
states that any RoB classifier would be a *new non-TS sidecar*, that rules + LLM assist suffice, and
that it must never be imported into the serve path. RobotReviewer is **GPL-3.0** (copyleft — a
distribution constraint).

**Spin / overstatement detection — data too small.** The only labelled resource is 663
press-release/abstract pairs ([arXiv 2108.13493](https://arxiv.org/pdf/2108.13493)), and the wrong
domain. DeSpin is a rule-based prototype. Not trainable at that scale.

**Retraction / predatory-venue screening — a database join.** Retraction Watch data via Crossref; an
API lookup, not a model.

**Hedging / certainty classification — the only close call.** Real labelled data exists (BioScope,
>20k sentences, academic use) and the task is cheap. It is rejected for v0 only because it duplicates a
field the synthesis LLM already emits, and because the hedge axis is already contested inside our own
contract (`role='hedge'` vs `assertion='hedged'` — see the
[sentence-role plan](./leafcutter-sentence-role-v0-training-plan.md) §4). Revisit **only** if evidence
strength becomes a first-class graded output rather than a byproduct.

## 4. Previously rejected, still rejected

[`decisions/0003-paper-reliability.md`](../decisions/0003-paper-reliability.md) ("Option D")
rejected an **ML-learned reliability regressor** predicting paper/edge trust directly from features:
no labelled trust corpus exists, it is opaque and non-reproducible, and it risks smuggling
citation/venue features back into a score that deliberately separates them. Nothing in this research
changes that. It is recorded here so the idea is not revived as "a small model could just learn the
score".

## 5. The `no_effect` gap — status: still open, but with a lead

`RelationKind` includes `no_effect` (`shared/brain/relationships.ts:39-45`) and nothing populates it.
Re-checking confirmed why:

- every biomedical RE corpus's `no_relation` means **not annotated**, not *studied and found null* —
  training on it would be a category error;
- BioRED's `novel` flag is novel-vs-background knowledge, orthogonal;
- BioScope and GENIA event modifiers annotate negation/speculation **cues and scopes**, not outcomes.

**The one lead:** Yu, Li & Wang's causal-language corpus carries an explicit `no relationship` class
over 1,356 human-labelled PubMed conclusion sentences. It is folded into the
[claim-kind plan](./viceroy-claim-kind-v0-training-plan.md), which trains and measures it but explicitly
does **not** authorize populating `no_effect` from it — the class is claim-level while `no_effect` is
edge-level, and meta-research finds **>80% of titles misinterpret non-significance as support for the
null** ([iScience 2024](https://www.cell.com/iscience/fulltext/S2589-0042(24)02903-1)), meaning a
sentence-level classifier learns authors' spin as readily as their results.

Closing this gap properly needs **edge-level annotation that does not exist**. Until then `no_effect`
stays LLM-assigned or unpopulated, and no model should claim to cover it.

## 6. Licence red flags

The recurring constraint across this entire roster. Ourobion's rule already stands: non-commercial
status does not make an unconfirmed licence acceptable.

| Asset | Issue |
|---|---|
| **BioREDirect** data | Licence **unverified**; gates the only direction supervision available |
| **Yu et al. causal-language** data | **GPL-3.0**; propagation to weights is legally unsettled |
| **MultiTagger-v2** (1.25M PT-labelled abstracts) | **No licence declared** — right data, unusable |
| **Cochrane Crowd** | Personal use only |
| **MS MARCO** | Non-commercial research only; taints reranker fine-tunes transitively |
| **SciFact** | CC BY-NC 2.0 — fine now, blocks commercialisation |
| **UMLS** | Signed licence, no redistribution, annual usage report |
| **EBM-NLP** | No licence file found |
| **SemEval-2010 Task 8** | HF card declares none |
| **PubMed 200k RCT** | Declares none; defers to NLM |
| **MEDLINE abstracts** | NLM disclaims copyright authority — keep PMIDs+labels as the artifact, not text |
| **`allenai/scibert_scivocab_uncased`** | **No licence on the weights** despite Apache-2.0 code — avoid for anything shipped |
| **RobotReviewer** | GPL-3.0 copyleft |
| **Bespoke-MiniCheck-7B** | Non-commercial |

Clean, no encumbrance: `ncbi/MedCPT-*` (public domain), `microsoft/BiomedNLP-BiomedBERT-*` (MIT),
`michiyasunaga/BioLinkBERT-*` (Apache-2.0), `BAAI/bge-reranker-v2-m3` (Apache-2.0), `SapBERT` (MIT),
`MiniCheck-Flan-T5-Large` (MIT), DrugProt (CC-BY-4.0), ChemProt (Public Domain Mark), BioRED (US
Government work), StudyTypeTeller (CC-BY-4.0).

## 7. Suggested order, if these are ever executed

Not a commitment — each model is independently gated and any of them may end in a documented `no-go`.

1. **Sentence-role (d)** — cheapest, likely zero GPU, and immediately reduces recurring Haiku spend.
   Its result is also independent of every licence question.
2. **Study-design (b1)** — best supervision, clean licences, and it strengthens `evidenceTier`, which
   already feeds the edge score today.
3. **NLI (a)** — already planned; the largest single piece of work.
4. **Relation/direction (c-i)** — only after BioREDirect's licence is resolved.
5. **Claim-kind (c-ii)** — only after the GPL-3.0 determination.

Models 2–5 can share one GMI container session to avoid paying provisioning overhead repeatedly,
provided each writes to its own release prefix and the claim-kind artifacts stay in an isolated
namespace.

## 8. Standing boundaries

These hold for every model in this roster, without exception:

- **Non-serving.** No trained model influences `RelationshipClaim`, `EdgeVerification`, edge score or
  band, `verified_edges`, cards, UI, verifier routing, or spend. Integration is always a separate,
  later decision with its own review.
- **Offline only.** Serve-time is a pure weighted read over precomputed columns
  ([`decisions/0003-paper-reliability.md`](../decisions/0003-paper-reliability.md)); no model
  may enter the serve path.
- **Python is isolated to `model-training/`.** Training/evaluation/export code lives in this
  repository's dedicated `model-training/` workspace (task-fit polyglot rule, see
  [`AGENTS.md`](../../../AGENTS.md) §1/§4 and [`code-build-decisions.md`](./code-build-decisions.md)
  D1–D2); it is never imported by `apps/`, `supabase/`, `shared/`, or `tools/`, and no training is
  executed inside this repository's CI. Raw datasets, checkpoints, and weights are still never
  committed. The one product-runtime exception remains an **ONNX** artifact for the sentence-role
  tagger, which the TypeScript ingest CLI can execute without a Python dependency.
- **No user data leaves Ourobion.** No `daily_gut_rows`, wearable/environment rows, user UUIDs, cards,
  Supabase exports, or production telemetry may enter any training environment.
- **A `no-go` is a completed experiment**, not a failure to be tuned away.
