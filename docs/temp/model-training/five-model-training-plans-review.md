---
title: Five custom-model training plans — workability review
summary: Independent technical review of Zebra, Giraffe, Salmon, Viceroy, and Leafcutter at dev-phase2-run3 commit 0da76ca, with binary workability verdicts, repair paths, minimum workable redesigns, and a one-day rapid-baseline priority; licensing is excluded at the requester's direction.
type: review
scope: model-training
status: draft
updated: 2026-07-27
---

# Five custom-model training plans — workability review

## 1. Scope and verdict rule

Reviewed at `dev-phase2-run3` commit `0da76ca9fd418b80884124dc307b548980821a40` after the MT0
training-substrate merge. The review covers:

- [`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md);
- [`giraffe-study-design-v0-training-plan.md`](./giraffe-study-design-v0-training-plan.md);
- [`salmon-relation-direction-v0-training-plan.md`](./salmon-relation-direction-v0-training-plan.md);
- [`viceroy-claim-kind-v0-training-plan.md`](./viceroy-claim-kind-v0-training-plan.md); and
- [`leafcutter-sentence-role-v0-training-plan.md`](./leafcutter-sentence-role-v0-training-plan.md).

Three independent reviewers assessed the five plans in parallel; the primary reviewer then checked the
material findings against the shared brain contracts, the authoritative insight-engine architecture,
the MT0 substrate, and the original dataset papers/repositories.

Per the requester's direction, **licensing is excluded from this review**. A licence issue neither changes
a verdict nor appears as a proposed solution below. The review still considers whether data exists, whether
its labels fit the intended task, and whether the plan has enough information to reproduce and evaluate the
experiment.

Verdicts mean:

- **WORKABLE** — the proposed research capability is technically coherent. Listed required changes must
  be made before execution, but they do not require changing the model's fundamental purpose.
- **NOT WORKABLE AS WRITTEN** — a task, label, evaluation, or contract mismatch prevents the plan from
  establishing what it claims. The model may still be viable after the stated redesign.

The absence of MT1–MT5 implementations does **not** by itself make a plan unworkable. At this commit all
five model packages are intentional placeholders; this review judges the plans that would drive those
builds, not whether training can be launched today.

## 2. Executive verdicts

| Plan | Verdict | Decisive reason |
|---|---|---|
| Zebra NLI Shadow v0 | **WORKABLE** | The NLI task is coherent, but label-dependent evidence windows and incomplete leakage/audit gates must be fixed before the results can represent a prospective pipeline. |
| Giraffe Study-Design v0 | **NOT WORKABLE AS WRITTEN** | Its primary “14→5” gold set cannot validate the tier-2-vs-tier-3 boundary the plan makes decisive, and the exact collapse/abstain map does not exist. |
| Salmon Relation/Direction v0 | **WORKABLE** | A narrower abstaining research model is feasible, but native direction states and biomedical relation labels cannot be mapped directly onto Ourobion's contract as currently written. |
| Viceroy Claim-Kind v0 | **NOT WORKABLE AS WRITTEN** | It detects authors' causal wording in a conclusion sentence; `claimKindCheck` asks what a specific claim's independently retrieved evidence licenses. Those are different tasks. |
| Leafcutter Sentence-Role v0 | **NOT WORKABLE AS WRITTEN** | The proposed public-data mapping supplies only three primary roles, not the stated four-role head or five-role contract classifier, and supplies no full-text `other` class. |

Overall: the five-model roster should not proceed unchanged. Zebra can proceed after plan corrections;
Salmon can proceed as an explicitly narrower offline experiment. Giraffe, Viceroy, and Leafcutter need
their repair plans incorporated before their MT units are implemented.

## 3. Cross-plan findings

### 3.1 The MT0 substrate is useful but does not validate a model plan

MT0 establishes a clean `model-training/` boundary, shared manifests, hash checks, guarded job dispatch,
metrics, release construction, and tests. That removes repeated operational work. It does not establish
that any model's labels match an Ourobion field, that an evaluation set supports its threshold, or that an
integration mapping is valid. Each MT1–MT5 implementation still needs its own scientific acceptance tests.

The current [`code-build-unit-index.md`](./code-build-unit-index.md) is also stale: it still says MT0 has
152 tests, lint/type checks never ran, and its PR is unopened, while the merged MT0 session records 158
tests plus successful Ruff and Mypy runs. Reconcile that index before using it as release evidence.

### 3.2 The repository data boundary is internally contradictory

Current `AGENTS.md` says code under `model-training/` “may only read fixtures and manifests it owns,”
while every plan requires it to read an approved, hash-pinned raw training dataset from isolated local or
object storage. A literal implementation cannot satisfy both.

Required correction: state that model-training code may read **its own fixtures/manifests and explicitly
approved, hash-pinned research datasets through its own storage/data adapters**, while it may never read
Ourobion product tables, user data, Supabase exports, or unrelated repository/runtime files.

### 3.3 A shadow-output schema is needed before any contract mapping

The shared contract has mandatory booleans and closed enums, while the proposed support models need
`abstain`, `not_covered`, `undirected`, and sometimes `insufficient_evidence`. Do not coerce those states
into `EdgeVerification` during research. Define a model-lab-only prediction record containing:

- native label and normalized research label;
- probabilities/calibrated confidence;
- `abstainReason` / `notCoveredReason`;
- input/evidence manifest hashes; and
- model/config/preprocessing revisions.

Only a later two-reviewer integration decision should map an accepted subset to shared fields. Missing
model opinion must never become `matchesClaim: false`, `not mechanistic`, or `no effect`.

### 3.4 Audit-set totals are not enough

All promotion gates should preregister minimum counts by the class whose recall/precision is gated, minimum
non-abstention coverage, and confidence-interval handling. A total of 80–96 examples can leave a rare class
with too few observations to support per-class recall, ECE, or asymmetric-error thresholds. If a minimum is
not met, the metric is descriptive and promotion eligibility is non-estimable—not a pass.

### 3.5 The old support-model design remains unsafe to implement from

[`brain-support-models-design.md`](../../nao/brain-support-models-design.md) still contains the three
incorrect assumptions recorded in [memory 0017](../../memory/0017-support-model-dataset-corrections.md).
The new plans correct them, but leaving two active recipes invites the old one to be implemented later.
Amend or clearly subordinate the deferred design before MT2/MT4 starts.

## 4. Zebra NLI Shadow v0

**Verdict: WORKABLE — make the required changes before MT3 implementation.**

The concept is sound as a non-serving, three-way claim/evidence research model. SciFact's official
entailment transform exposes 919 train and 340 validation rows with `SUPPORT`, `CONTRADICT`, and `NEI`,
so the basic experiment is implementable. The fixed recipe, OOF-only temperature scaling, clean rerun,
blind human audit, and LLM-as-comparator (not oracle) are strong controls. See the
[official transform/card](https://huggingface.co/datasets/allenai/scifact_entailment) and
[official SciFact repository](https://github.com/allenai/scifact).

### Required comments and corrections

1. **The evidence construction leaks label/annotation availability.** Positive and contradiction rows
   receive gold rationale sentences plus context, while `NEI` rows receive BM25-selected sentences. The
   classifier can learn the input-selection policy rather than entailment, and inference will not have gold
   rationales.

   **Fix:** use the same label-blind retrieval and windowing policy for every class in training, CV, dev,
   domain audit, and LLM comparison. Retain a gold-rationale run only as an explicitly named
   `oracle-evidence` secondary analysis. The prospective/shadow eligibility result must use label-blind
   retrieval.

2. **The split assertions stop at internal train folds.** The plan must also fail if train and official dev
   overlap by claim, abstract, connected component, or normalized text. With only 1,259 transformed rows,
   viable class support per group fold cannot be assumed.

   **Fix:** implement deterministic group-stratified assignment; assert train↔dev separation; emit
   fold-by-class/component tables; and fail preflight when a fold lacks the preregistered minimum for a class.

3. **`NEI → uncertain` is a research label, not a direct contract mapping.** In the shared contract,
   `unsupported` is absence of evidence, while `uncertain` includes failure to ground/independent-retrieval
   failure. SciFact `NEI` does not reproduce all of either state.

   **Fix:** name the model-native class `insufficient_evidence` in artifacts and define its SciFact source
   mapping. Do not claim it directly fills either five-way verifier state. A later verifier roll-up may use
   it as one input.

4. **The audit eligibility gate is underpowered and ambiguous.** “Freeze all eligible; target at least 96”
   does not define the exact selection rule or class minima, yet the gate requires every-class recall and ECE.

   **Fix:** preregister candidate inclusion/exclusion, the final-set rule, per-verdict minima, domain×verdict
   targets where feasible, and confidence intervals. No threshold pass when the relevant minimum is unmet.

5. **One MT0 wording remnant remains.** Zebra §12 still binds a “model-lab git SHA” separately from the
   main repository SHA, although code now lives in this repository.

   **Fix:** bind the Ourobion commit SHA plus the `model-training/` package/config/lock hashes; remove the
   obsolete second-repository identity.

### Workable end state

Proceed with MT3 only after the plan specifies one label-blind evidence pipeline, cross-dev leakage guards,
the model-native insufficient-evidence label, and estimable audit gates. Keep the result non-serving and
do not let it short-circuit A10.

## 5. Giraffe Study-Design v0

**Verdict: NOT WORKABLE AS WRITTEN.**

The broad concept—a rules-first A5 path with a model only on inconclusive papers—is sensible. The revised
MEDLINE rules are also directionally correct: cohort and cross-sectional concepts are MeSH descriptors,
not Publication Types. The failure is the plan's claimed primary five-tier evaluation.

The original StudyTypeTeller source has labels such as systematic review, several RCT types, study protocol,
case report, non-RCT intervention, animal classes, in-vitro, and remaining. It does **not** provide a clean
cohort-versus-cross-sectional distinction. Yet the Giraffe plan says the collapsed set is its primary gold
set and makes tier-2-vs-tier-3 F1 a promotion gate. That metric cannot be established from this gold source.
See the [StudyTypeTeller paper](https://www.cambridge.org/core/journals/research-synthesis-methods/article/studytypetellerlarge-language-models-to-automatically-classify-research-study-types-for-systematic-reviews/C50EB049FFE2D4367763814311C67B83)
and [official repository](https://github.com/Ineichen-Group/StudyTypeTeller).

### Blocking comments

1. **No valid 14→5 gold mapping is specified.** Protocol, case-report, non-systematic-review, non-RCT
   intervention, and remaining are not unambiguous rungs on the contract ladder. Silently forcing them to a
   tier would make the “independent gold” another heuristic projection.
2. **The decisive tier-2/3 metric lacks gold supervision.** The plan cannot use it as an eligibility gate
   until a source actually distinguishes the two designs under the Ourobion rubric.
3. **Tier-1 rules are incomplete.** “Or in-vitro headings” needs a closed identifier list, precedence,
   exclusions, and explicit ambiguous/unmapped behavior.
4. **Training and target inputs are misaligned.** The model trains on title+abstract while A5's residue is
   defined from methods text plus `workType`. Measuring the shift is good, but a model that fails the target
   view has not solved A5.
5. **Balanced sampling plus class-weighted loss may double-correct imbalance.** Preselect one default and
   treat the other as a fixed ablation rather than applying both without evidence.

### Solution

1. Use StudyTypeTeller only for the clearly mappable coarse slices (for example tier 1, tier 4, and tier 5)
   and as a robustness probe—not as the five-class primary gold set.
2. Create a dedicated, blinded five-tier gold set with an explicit rubric, sufficient tier-2 and tier-3
   counts, two reviewers, adjudication, and paper-level separation from MEDLINE training. Exclude
   unrepresentable study types rather than forcing them onto the ladder.
3. Publish and hash `giraffe-label-rules-v0` before preprocessing: exact PT/MeSH/check-tag IDs, precedence,
   max-tier behavior, ambiguity, exclusion, and abstention.
4. Align the eventual model input to the A5 residue contract—prefer title + abstract + available methods
   and `workType`, with missing-view indicators—or keep the model research-only if methods-view performance
   fails the preregistered non-inferiority bound.
5. Select on the residue slice and the dedicated five-tier gold set, not on MEDLINE self-label fidelity.

After those changes the Giraffe concept is viable; the current plan is not.

## 6. Salmon Relation/Direction v0

**Verdict: WORKABLE — only as a narrower, abstaining offline research model after plan changes.**

BioREDirect makes a directionality experiment feasible and genuinely adds 10,864 annotations to BioRED.
The plan is also right not to map `no_relation` to `no_effect` or `Drug_Interaction` to `confounds`.
Those protections match the shared contract's meanings. See the
[BioREDirect paper](https://academic.oup.com/bioinformatics/article/41/Supplement_1/i68/8199369)
and [official repository](https://github.com/ncbi-nlp/BioREDirect).

### Required comments and corrections

1. **Native direction states are misrepresented.** BioREDirect defines `rightward`, `leftward`,
   `undirected` (direction unclear in the abstract), and `none` (no relation). The plan's
   `e1→e2 | e2→e1 | symmetric` collapses “unclear” into “intrinsically symmetric” and drops `none`.

   **Fix:** retain the four native states in the data/model head. Normalize to
   `directed(e1→e2|e2→e1) | undirected | abstain/no-relation` only in a separate research schema.
   Never convert `undirected` into a Boolean mismatch.

2. **The relation ontology is a hypothesis, not a label equivalence.** BioRED/ChemProt describe
   biomedical entity-pair relation types; Ourobion's `increases`/`decreases` are monotonic metric
   relationships, while `modulates` and `correlates` have product-specific meanings.

   **Fix:** add a frozen mapping specification with positive, negative, ambiguous, and unrepresentable
   examples. Require an explicit `abstain` class and two-reviewer adjudication of the mapping/audit rubric.
   Report results both in native ontology and on the narrower mapped subset.

3. **Model selection optimizes the relation head only.** A shared encoder chosen solely by relation macro
   F1 can degrade the direction head—the capability this model primarily exists to test.

   **Fix:** preregister a multi-objective selection rule or a direction-first rule on directable validation
   examples, with no audit-set tuning.

4. **Conditional accuracy lacks a coverage floor.** Direction accuracy conditioned on correct relation is
   useful, but it can look strong after rejecting hard cases.

   **Fix:** add joint type+direction performance, non-abstention coverage, selective-risk lower bounds, and
   separate directable/undirected confidence intervals to the promotion gate.

5. **A8 versus A10 remains undecided.** The architecture describes a future A8 extractor, while this plan
   targets an A10 cross-check.

   **Fix:** declare v0 **A10 offline/shadow evaluation only**. Choosing A8 extraction is a later design and
   training-data decision; do not let one v0 score silently authorize both seams.

### Workable end state

Proceed with MT4 as native-label multi-task research plus an explicitly mapped, abstaining Ourobion audit.
Store results outside `EdgeVerification`; a later integration proposal must decide how `undirected` and
abstention interact with the mandatory Boolean contract.

## 7. Viceroy Claim-Kind v0

**Verdict: NOT WORKABLE AS WRITTEN FOR `claimKindCheck`.**

The underlying four-way **causal-language detector** is trainable: the Yu, Li, and Wang corpus contains
`no relationship`, `direct causal`, `conditional causal`, and `correlational` conclusion-sentence labels,
and its published BioBERT result is a credible baseline. See the
[original paper](https://aclanthology.org/D19-1473/) and
[official repository](https://github.com/junwang4/causal-language-use-in-science).

The proposed Ourobion use is the problem. `ClaimKind` is “the strongest claim the evidence licenses.” The
source corpus labels which causal language an author used. A bare conclusion sentence does not establish
whether an observational design justifies that language, and it may contain more than one relationship
without identifying the pair being checked. Therefore high corpus F1 cannot validate
`claimKindCheck.matchesClaim`.

### Blocking comments

1. **Surface language is not evidence-licensed claim kind.** The model can reproduce author phrasing,
   including overstatement; it cannot independently verify whether the evidence licenses causality.
2. **The input is not pair-aligned.** A conclusion sentence without entity/metric alignment cannot be
   safely compared to one `RelationshipClaim` when multiple relationships occur.
3. **The output cannot fill the contract.** `supportedKind` is mandatory and includes `mechanistic`, while
   Viceroy never predicts mechanistic and maps `no relationship` to abstention.
4. **The final epoch rule is missing.** Five fold jobs are followed by final-seed jobs “at the fixed epoch”
   without specifying how it is fixed.
5. **Audit totals do not support the asymmetric safety claim.** The plan needs native-class minima,
   pair-aligned examples, non-abstention coverage, and confidence bounds for the dangerous
   correlational→causal error.

### Solution

Choose one of two honest paths:

1. **Recommended v0: rescope and rename.** Train `viceroy-causal-language-risk-v0` as an auxiliary
   detector of causal wording. Use it to flag sentences/claims for verifier attention or error analysis;
   never populate `claimKindCheck` and never call it evidence validation. Evaluate pair alignment and
   observational-study slices, but retain the verifier as the decision-maker.
2. **Future true claim-kind checker:** construct a human-labelled dataset whose input is
   `(specific claim, pair-aligned independently retrieved evidence, study design/context)` and whose label
   is the strongest licensed kind plus explicit `abstain/not_covered`. Only that task can be evaluated as
   an A10 claim-kind checker.

For either path, set the final epoch to the median fold-selected epoch before audit evaluation and use a
model-lab shadow schema rather than forcing abstention into the shared enum.

## 8. Leafcutter Sentence-Role v0

**Verdict: NOT WORKABLE AS WRITTEN AS A FIVE-ROLE A4 TAGGER.**

The CPU-first logistic baseline is an excellent engineering choice. The error is in the task claim.
PubMed 200k RCT supplies five *source* labels—background, objective, method, result, conclusion—but the
plan maps them to only three primary Ourobion roles:

- background + objective → `background`;
- methods → `method`; and
- results + conclusions → `finding`.

It supplies neither `other` nor a primary `hedge` role. The plan's statement that public labels map onto
four of five roles is therefore false. The corpus is also abstract-only and cannot teach the full-text
`other` cases the plan names. See the [official dataset repository](https://github.com/Franck-Dernoncourt/pubmed-rct)
and [original paper](https://aclanthology.org/I17-2052/).

### Blocking comments

1. **Stage A is a three-role model, not four/five.** It cannot emit a learned `other` class.
2. **`hedge` is orthogonal and duplicated.** The shared structured sentence already has
   `assertion='hedged'`; a hedged finding should not lose its primary role. Training a second hedge head
   does not resolve which field is authoritative.
3. **Stage B is effectively mandatory.** Full-text A4 inputs contain classes absent from the public corpus;
   “only if Stage A underperforms” is not a meaningful gate for `other` because Stage A has no such class.
4. **The ≥300-sentence audit is underspecified.** It needs paper-level separation, dual review/adjudication,
   class quotas, uncertainty, and a predeclared non-inferiority test against Haiku.
5. **The encoder option is not reproducible.** “MiniLM-class” does not pin a checkpoint, revision,
   tokenizer, sequence features, ONNX opset/runtime, or parity tolerance.

### Solution

1. Make Stage A explicitly `background | method | finding`, with `unknown/other` as abstention or a
   deterministic section/heading fallback. Treat it as pretraining/baseline evidence, not an A4 replacement.
2. Make a paper-disjoint, dual-reviewed full-text Stage B dataset mandatory before claiming five-role A4
   coverage. Include enough `other` examples and preserve section/position features; 300 sentences may be
   an audit pilot, not automatically an integration-quality set.
3. Keep hedging exclusively on the `assertion` axis unless a two-reviewer shared-contract decision says
   otherwise. Do not emit `role='hedge'` from the learned classifier in the meantime.
4. Compare a deterministic heading/section heuristic, a TF-IDF+position logistic model, and one exactly
   pinned encoder. Prefer the simpler option inside the preregistered margin.
5. For any ONNX path, freeze identical Python/Node preprocessing and test logits/probabilities over a
   broad parity corpus with explicit numerical tolerances—not only a small hand-picked sample.

After that redesign Leafcutter can be a workable cost-reduction model. The current five-role claim cannot
be supported by its Stage A data.

## 9. Minimum workable redesigns

This is the consolidated answer to “how do we make each one workable?” It does not replace the detailed
repairs above; it states the smallest honest target each MT build should implement.

| Model | Minimum workable target | Required design changes | Honest output |
|---|---|---|---|
| **Zebra** | Three-way claim/evidence NLI research model | One label-blind retrieval/window pipeline for every class; model-native `insufficient_evidence`; train↔dev group-leak checks; class-estimable audit gates | NLI research predictions in the model-lab shadow schema; never a five-way `EdgeVerification.verdict` and never an A10 short-circuit |
| **Giraffe** | Rules-first A5 residue classifier evaluated on a real five-tier rubric | Dedicated five-tier human gold set with enough tier-2/3 examples; closed PT/MeSH/check-tag rule spec; explicit unmapped/abstain; input aligned to title/abstract/methods + `workType` | Offline evidence-tier suggestion with confidence/abstain; deterministic A5 rules remain authoritative |
| **Salmon** | Native biomedical relation + direction experiment with a separately evaluated Ourobion mapping | Preserve `rightward/leftward/undirected/none`; add unrepresentable/abstain to the relation map; select for both heads; coverage-aware evaluation; v0 fixed to A10 offline research | Native and mapped shadow predictions; never direct writes to `directionCheck` or `RelationshipClaim.relation` |
| **Viceroy** | Four-way causal-language risk detector | Rename/rescope away from evidence validation; align scored sentences to the target pair where possible; explicit abstain; keep mechanistic/no-effect uncovered | Auxiliary “causal wording risk” flag for audit/triage, not `claimKindCheck` |
| **Leafcutter** | Three-role `background/method/finding` public-data baseline followed by mandatory full-text adaptation | Remove learned `role='hedge'`; use `assertion` for hedging; make full-text Stage B mandatory for `other`; use section/position features; pin Node parity contract | Three-role baseline first; only a later, full-text-validated artifact may be proposed as the A4 replacement |

Each model should have two success labels, not one:

- `rapid-baseline-complete` — code/data path ran and produced reproducible descriptive metrics;
- `research-complete` — the full preregistered folds, seeds, calibration, domain audit, uncertainty, clean
  rerun, and release evidence completed.

The first never implies the second.

## 10. One-day constraint: what is and is not possible

### 10.1 Reality check

At reviewed commit `0da76ca`, MT1–MT5 are placeholder packages. **Implementing, training, and completing
the five full plans in one day is not workable.** Even with one fast GPU, the limiting work is adapters,
data construction, task corrections, grouped splits, human gold/audit sets, calibration, evaluation, and
release evidence—not raw gradient time.

A one-day run is credible only when all of these are true before the 24-hour clock starts:

- the five corrected model adapters and configs already exist and pass unit tests;
- datasets are already downloaded, hashed, normalized, and cached near the compute;
- fixed splits and any required rapid-evaluation labels are already frozen;
- the base weights and dependencies are already cached;
- one GPU plus adequate CPU/RAM/disk are available; and
- the run is explicitly labelled **rapid baseline only**, with no shadow/integration eligibility claim.

If those preconditions are not met, use the day to finish models in priority order. Do not reduce scientific
controls merely to produce five weight files.

### 10.2 One-day priority list

Priority is based on value × chance of producing an interpretable result inside one day, after the redesigns
in §9. Stop when the remaining time is insufficient for evaluation and artifact closeout.

| Priority | Model | One-day target | Why it is here | If time slips |
|---:|---|---|---|---|
| **1** | **Leafcutter** | CPU TF-IDF + section/position logistic model for `background/method/finding`; official split metrics; `finding` precision; pure-TS or frozen-feature export | Cheapest and fastest; no GPU needed; immediately tests whether a recurring LLM call can be reduced | Skip the encoder. Never claim five-role/full-text readiness |
| **2** | **Zebra** | Correct label-blind evidence pipeline; smoke + one fixed seed; official dev and lexical/majority baselines | Small dataset and highest direct safety relevance; a failed baseline is still informative | Drop LLM comparison, calibration, extra seeds, and ablations—not leakage checks or label-blind retrieval |
| **3** | **Viceroy** | Native four-way causal-language-risk classifier; grouped CV if time permits, otherwise one frozen split; cue-lexicon baseline | Only ~3k examples and fast to train, but its honest use is narrower than the original plan | Keep it a language-risk baseline; do not map it to `claimKindCheck` |
| **4** | **Salmon** | Native relation + four-state direction heads; smoke + one fixed seed; official native-label held-out metrics | Technically valuable, but multi-corpus adapters, de-duplication, two heads, and ontology mapping make it the riskiest same-day GPU job | Train/evaluate native labels only; defer Ourobion mapping and all promotion claims |
| **5** | **Giraffe** | Rules/data-pipeline report first; train only if corrected labels and dedicated gold are already prepared | MEDLINE acquisition/parsing and the missing five-tier gold design dominate the day; a forced five-class score would not answer the review question | Publish the label/rules baseline only. If weights are mandatory, train an explicitly separate `giraffe-coarse-1-4-5-prototype`, not Giraffe v0 |

### 10.3 Suggested 24-hour schedule

This is a planning envelope, not a performance guarantee. It assumes the preconditions in §10.1 and one
GPU. CPU/data jobs run concurrently where safe.

| Clock | GPU lane | CPU / evaluation lane |
|---|---|---|
| 00:00–02:00 | 64-example smoke for Zebra, Viceroy, Salmon, and any prepared Giraffe model | Fail-closed manifests/splits; start Leafcutter logistic; start Giraffe data/rules report |
| 02:00–04:30 | Zebra, fixed seed 42, one run | Finish Leafcutter evaluation/export; run Zebra baselines |
| 04:30–06:00 | Viceroy causal-language-risk run | Viceroy cue baseline and fixed evaluation |
| 06:00–12:00 | Salmon native-label run; terminate early on failed smoke/NaN/data assertion | Salmon collision/class reports; continue Giraffe preparation |
| 12:00–15:00 | Giraffe only if corrected train/eval artifacts were ready before the day | Giraffe rules baseline and coarse/gold-set evaluation |
| 15:00–17:00 | Optional Leafcutter encoder only if logistic misses its preregistered margin | Node/parity preparation or error analysis; otherwise keep GPU idle as buffer |
| 17:00–21:00 | Reserved retry for infrastructure failure only; no score-chasing reruns | Fixed evaluations, confusion matrices, per-class metrics, coverage, error samples |
| 21:00–24:00 | No new training jobs | Hash artifacts, write five rapid-baseline cards, record failures/costs, upload, verify, terminate compute |

Non-negotiable stop rule: **do not start a lower-priority training job unless enough time remains to evaluate,
hash, document, and safely close it.** An unevaluated checkpoint is not a completed model.

### 10.4 What the one-day run must omit honestly

Unless they happen to be precomputed, the one-day result will not include the full plans' three-seed
variance, five-fold OOF calibration, independent domain audit, paired LLM benchmark, every ablation, clean
container rerun, or prospective integration evidence. Every resulting model card must therefore say:

```text
outcome: rapid-baseline-complete | blocked | failed
promotion_eligible: false
serving_authorized: false
shadow_authorized: false
```

It must not say `research-complete`, `eligible-for-shadow-review`, or `eligible-for-integration-review`.

## 11. Recommended longer-term order after the one-day pass

1. Correct the cross-plan data-boundary wording and define the model-lab shadow-output schema.
2. Promote the Leafcutter three-role baseline into a full-text Stage B only if its cheap baseline is useful.
3. Complete Zebra's full preregistered evaluation after its rapid baseline proves the pipeline.
4. Rescope Viceroy permanently to causal-language risk, or source the pair/evidence/design labels for a
   true checker.
5. Amend Salmon's native direction states/ontology/coverage and complete its full audit before any mapping.
6. Replace Giraffe's primary gold design before spending on a full five-tier run.

No verdict authorizes serving, shadow telemetry, verifier short-circuiting, shared-contract changes, or
product integration. Those remain separate decisions.
