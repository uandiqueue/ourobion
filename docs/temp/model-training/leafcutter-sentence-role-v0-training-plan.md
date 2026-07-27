---
title: Leafcutter Sentence-Role v0 — training plan (mostly not a GMI job)
summary: Preregistered plan for the A4 sentence-role tagger that replaces the Haiku cold-start classifier, trained public-data-first on PubMed 200k RCT and exported to ONNX so the TypeScript ingest CLI can run it. Unlike the other models in this roster this one is a cost/latency distillation, needs little or no GPU, and must be judged on cost-per-paper as much as on F1.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Leafcutter Sentence-Role v0 — training plan (mostly not a GMI job)

> **Shared execution substrate.** If a GPU is used at all, the GMI gates, container posture, storage,
> in-repo `model-training/` workspace, and release rules in the NLI plan
> ([`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) §3, §4, §12) apply unchanged. **Read §3 of this plan
> first: the recommended path provisions no GPU at all**, and the GMI gates are then moot.

## 1. Decision summary

`leafcutter-sentence-role-v0` classifies each sentence of a structured paper into
`'finding' | 'method' | 'background' | 'hedge' | 'other'`, filling
`StructuredPaper.sentences[].role` at **A4 · Structure**
([`insight-engine-architecture.md`](../../shared/insight-engine-architecture.md) §A4).

This model is **not** part of the memory-0013 support-model roster. It comes from the insight-engine
architecture's own deferred-models table, which names the cold-start substitute (Claude Haiku 4.5) and
the swap plan: *"distil into a small TS-runnable classifier (logistic over n-grams or ONNX minilm) once
≥5k labelled sentences accumulate."*

It differs from every other model in this roster in three ways that change how it should be planned:

1. **It is a cost/latency distillation, not a capability model.** Haiku already does this acceptably.
   The model's job is to do the same thing for near-zero marginal cost on every future paper.
2. **It must run inside the TypeScript ingest CLI**, so the deliverable is an **ONNX artifact**, not a
   safetensors checkpoint. Ourobion's serving/runtime path stays Python-free — only an ONNX artifact
   ships there. The training code itself now lives in this repository's isolated `model-training/`
   workspace (task-fit polyglot rule; see [`AGENTS.md`](../../../AGENTS.md) §1/§4 and
   [`code-build-decisions.md`](./code-build-decisions.md) D1), not an external repository.
3. **It is not obviously a GPU job.** The architecture's own suggestion — logistic regression over
   n-grams — trains on a laptop CPU in seconds.

Because `role` drives the A6 co-occurrence index (pairs are counted only over `role='finding'`
sentences, the high-precision leg) and feeds which sentences reach A8 synthesis, a regression here
propagates quietly into candidate enumeration. That argues for care in evaluation, not for a bigger model.

## 2. Why LLM labels are permitted here, when they are forbidden elsewhere

Every other plan in this roster bans LLM-generated training labels. This one **explicitly allows** them as a
later stage, and the distinction is not a loophole:

- For NLI verdicts, study-design tiers, or claim-kind, training on the LLM's own labels would be
  **circular** — the model exists to check or replace a judgement, so inheriting that judgement caps it
  at the teacher's accuracy and destroys the comparison's meaning.
- For sentence roles, the LLM is not being checked. It is being **replaced on cost grounds** for a task
  it already performs well enough. Matching the teacher *is* success. This is ordinary distillation.

The honesty requirement is to say which one you are doing. A distilled tagger must never be described
as independent evidence about sentence roles; it is a compression of Haiku's behaviour.

## 3. Recommended path: public data first, no GPU

The architecture's swap plan waits for ≥5k in-house labelled sentences. That gate is unnecessary,
because a large public corpus for almost this exact task already exists.

**Stage A — public-data baseline (no GPU, do this first).**
[PubMed 200k RCT](https://github.com/Franck-Dernoncourt/pubmed-rct) provides ~200k abstracts and
**2.3M sentences** labelled `BACKGROUND / OBJECTIVE / METHODS / RESULTS / CONCLUSIONS`. Those labels are
derived from structured-abstract headings — human-written, not model-generated — and map onto four of
our five roles (§5).

Train two baselines and compare honestly:

| Candidate | Where it trains | Artifact |
|---|---|---|
| TF-IDF n-gram logistic regression | CPU, seconds | pure-TS reimplementation or ONNX |
| 6-layer MiniLM-class encoder, 128 tokens | CPU-feasible; ~1 GPU-hour makes it comfortable | ONNX |

If the logistic baseline lands within a few points of the encoder, **ship the logistic model and
provision no GPU**. A linear model over n-grams is inspectable, trivially fast in Node, has no runtime
dependency worth the name, and its failure modes are legible. That is a better engineering outcome than
a marginally better ONNX transformer, and this plan states that preference in advance so a small F1
delta cannot be used to justify the heavier artifact after the fact.

**Stage B — in-house adaptation (only if Stage A underperforms on real corpus text).** Fine-tune on
accumulated Haiku labels over `structured/` artifacts, per §2. Requires ≥5k labelled sentences with a
recorded `structureVersion`.

## 4. The `hedge` problem — a contract question, not a modelling one

Our five roles are not five rhetorical roles. Four of them —
`finding`/`method`/`background`/`other` — describe **what a sentence is doing**. `hedge` describes
**how confidently it says it**, which is an orthogonal axis. A sentence can be a hedged finding.

This collides with the contract itself: the same `sentences[]` element already carries
`assertion: 'asserted' | 'negated' | 'hedged'`, filled separately at A7
([`insight-engine-architecture.md`](../../shared/insight-engine-architecture.md) §A4 output shape). So
"hedged" is representable **twice**, in two fields, with no stated precedence — and a hedged finding
forces the tagger to discard either the role or the hedge.

v0 does not silently pick a resolution. It:

- trains the four orthogonal roles as the primary head;
- treats `hedge` as a **secondary binary output** (hedged: yes/no), trained separately, so a hedged
  finding can be both;
- emits `role='hedge'` at inference **only** when no other role is confidently assigned, preserving
  contract compatibility without letting the collision corrupt the primary labels;
- reports how often that collision occurs, as evidence for the contract decision.

**This must be resolved in the contract before promotion**, and resolving it is a `shared/` change
requiring two reviewers ([memory 0002](../../memory/0002-shared-contract-two-reviewers.md)). The
cleanest fix is likely to drop `hedge` from the role enum and rely on `assertion`, but that is not this
plan's call to make.

Public supervision for the hedge axis exists: **BioScope** annotates negation and speculation cues and
scopes over >20,000 sentences ([BMC Bioinformatics](https://pmc.ncbi.nlm.nih.gov/articles/PMC2586758/)),
free for academic use. Note it annotates *cues and scopes*, not sentence-level hedging, so labels need
derivation. The related CoNLL-2010 hedge task data is **registration-gated**.

## 5. Label mapping

| PubMed 200k RCT label | → `role` |
|---|---|
| `METHODS` | `method` |
| `BACKGROUND` · `OBJECTIVE` | `background` |
| `RESULTS` | `finding` |
| `CONCLUSIONS` | `finding` |
| — | `other` — no public counterpart; see below |
| — | `hedge` — orthogonal axis, from BioScope (§4) |

Two mapping decisions to record rather than assume:

- **`CONCLUSIONS` → `finding` is a judgement call.** Conclusions assert findings but at a different
  evidential distance from the data, and they are where causal overstatement concentrates. Freeze this
  mapping before evaluation and report `RESULTS`-derived and `CONCLUSIONS`-derived accuracy separately
  so the choice can be revisited on evidence. A6 counts pairs over `finding` sentences, so this mapping
  directly changes the co-occurrence index.
- **`other` has no public source.** Structured abstracts have no "other" heading. In real full text,
  `other` catches acknowledgements, funding statements, figure captions, and headers — none of which
  appear in abstract-only training data. Expect `other` to be the weakest class, source it from
  in-house labels in Stage B, and do not report a macro average that hides its absence.

## 6. Domain shift — abstracts vs full text

Training data is **abstract sentences**; A4 runs over **full text**, including JATS body sections and
GROBID-parsed PDFs. Full text contains sentence types abstracts never do, and its sentences are longer
and less polished.

Measure it: hold out a slice of real corpus papers, hand-label ≥300 sentences across
gut / hydration-heat / wearables-recovery / environment-vector, and report abstract-view and
full-text-view accuracy separately. If full-text accuracy collapses, Stage B is mandatory rather than
optional.

## 7. Evaluation protocol

Primary comparison is **against Haiku**, since Haiku is the incumbent:

- per-class precision/recall/F1, macro F1, confusion matrix, on both the public test split and the
  hand-labelled corpus slice;
- **agreement with Haiku** on a shared unlabelled sample (Cohen's kappa) — for a distillation, teacher
  agreement is the operative metric alongside ground-truth F1;
- **`finding`-class precision reported separately and weighted most heavily.** A6 builds the
  co-occurrence index from `finding` sentences only; false positives there inject noise into candidate
  enumeration for every downstream pair;
- the `hedge`/role collision rate (§4);
- **cost per 1,000 papers** for the model versus Haiku, and p50/p95 latency in Node via ONNX Runtime —
  this is the actual justification for the model and must be a first-class reported number, not an
  afterthought;
- calibration: ECE and a reliability diagram, since A4 output gates later stages.

Baselines: majority class; a heading-position heuristic (in structured abstracts, position predicts
role well and is nearly free); the TF-IDF logistic model; and Haiku itself.

If neither trained candidate beats the **heading-position heuristic plus Haiku fallback** on full text,
the honest outcome is `no-go` — keep Haiku, and record that the distillation was not worth it.

## 8. Splits, leakage, and licence

- Use the corpus's official train/dev/test split; additionally assert no duplicate normalised sentence
  text across splits (boilerplate method sentences recur heavily and are the main leak).
- Group by abstract so one paper's sentences never straddle splits.
- **Licence:** the PubMed 200k RCT repository declares no licence of its own and defers to NLM's terms;
  the underlying content is MEDLINE. As with the study-design model, treat abstract text as working
  data that is not redistributed, and keep `(PMID, sentence index, label)` as the derived artifact.
  Record this in the licence manifest and have it approved — the same rule applies that non-commercial
  status does not excuse an unconfirmed licence.
- **CSAbstruct** ([HF](https://huggingface.co/datasets/allenai/csabstruct), Apache-2.0, 2,189 abstracts)
  is cleanly licensed but computer-science domain. Use it only as an out-of-domain robustness probe,
  never as training data.
- Ourobion personal data may not enter training under any circumstance.

## 9. Cost controls

- **Preferred outcome: USD 0 compute.** The logistic baseline needs no rented hardware.
- If the encoder candidate is trained: one GPU, at most **2 GPU-hours**, at most **USD 8 compute** and
  **USD 12 all-in**. 2.3M sentences × 3 epochs at 128 tokens is roughly an hour on one H100.
- Run it on an existing model-training container session if one is already provisioned, rather than paying
  provisioning overhead for a job this small.

## 10. Completion and outcome gates

- **`no-go`** — neither candidate beats the heading heuristic + Haiku fallback on full text; keep Haiku;
- **`research-complete`** — a working tagger with stated limits, not yet wired in;
- **`eligible-for-integration-review`** — deliberately named differently from the other models' shadow
  gate, because this one *is* intended to be swapped in eventually. Requires: macro F1 within **0.05**
  of Haiku on the hand-labelled full-text slice; `finding`-class precision **≥ Haiku's**; ONNX p95
  latency acceptable for batch ingest; the `hedge` contract question (§4) resolved; and a
  `structureVersion` bump plan for re-structuring the existing corpus.

Integration remains a separate decision with its own review. Note that swapping the tagger changes
`structureVersion`, which **re-structures the whole corpus** and therefore perturbs the A6 index and
everything downstream — that is an ingestion-wide change, not a drop-in.

## 11. Stop conditions

- The `hedge`/`assertion` collision (§4) is resolved by quietly dropping one of them without a
  two-reviewer `shared/` change;
- someone proposes shipping the ONNX encoder over the logistic model on an F1 delta smaller than the
  margin declared in §3;
- distilled labels are described anywhere as independent evidence rather than as a compression of
  Haiku's behaviour (§2);
- `finding`-class precision regresses against Haiku but the model is promoted on macro F1;
- Python is proposed for the ingest runtime to avoid the ONNX export.

## 12. Execution order

1. **T0** — licence manifest for PubMed 200k RCT / MEDLINE approved; confirm no GPU is needed yet.
2. **T1** — the `model-training/` workspace (`ourobion_model_lab.models.leafcutter_sentence_role`) pinned; unit tests for the label map, the `CONCLUSIONS`→`finding`
   decision, and the hedge secondary-output rule pass.
3. **T2** — build splits, assert dedup/grouping, publish class report. **CPU only.**
4. **T3** — hand-label the ≥300-sentence full-text corpus slice; hash it.
5. **T4** — train and compare the logistic and encoder candidates; **decide whether a GPU is needed at
   all** before provisioning one.
6. **T5** — evaluate against Haiku on both views; measure cost-per-1,000-papers and ONNX latency in Node.
7. **T6** — export ONNX, verify parity between the training-time and ONNX-runtime outputs on a fixed
   sample (an ONNX export that silently diverges is the classic failure here), publish the model card.
8. **T7** — declare the outcome; open the contract question from §4 separately if promotion is proposed.

## 13. Deferred beyond v0

- Stage B in-house distillation, unless §6 forces it;
- resolving the `hedge`/`assertion` contract overlap — flagged here, decided elsewhere;
- sentence-level certainty grading beyond binary hedging
  (see [`model-roster.md`](./model-roster.md));
- any A6/A8 behaviour change arising from new role labels, and the `structureVersion` re-structure
  itself, which is an ingestion change requiring its own plan.
