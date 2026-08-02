---
title: Model-training run 2 — cockpit and today's training decision
summary: Second run of the model-training workstream, opened after codex's five-model plan review overturned three of five plans. Records the accepted corrections and the decision for the one-day training budget: train Zebra, then rescoped Viceroy; defer Giraffe, Leafcutter and Salmon.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Model-training run 2 — cockpit and today's training decision

Run 1 of this workstream was **MT0**, the shared substrate (merged, PR #145). Run 2 opens because
codex's [five-model plan review](../five-model-training-plans-review.md) found that three of the five
plans are **not workable as written**, including two defects that would have produced misleading
results rather than merely untidy ones.

| Document | Role |
|---|---|
| [`plan-corrections.md`](./plan-corrections.md) | Disposition of every review finding: what is accepted, what changes per plan, and the one disagreement |
| [`../five-model-training-plans-review.md`](../five-model-training-plans-review.md) | The review itself (codex) |

**No implementation code is authorised by this document.** MT1–MT5 remain placeholder packages.

## Decision: what to train today

**Train Zebra first. Then rescoped Viceroy if it clears.** Nothing else.

| Model | Today | Why |
|---|---|---|
| **Zebra NLI** | **TRAIN — priority 1** | Only plan rated workable that also serves both stated purposes. ~1.4k SciFact rows, minutes of GPU. Directly demoable: *supported / contradicted / insufficient-evidence* on a real claim. Highest safety relevance as a second-source signal |
| **Viceroy** (rescoped) | **TRAIN — priority 2, only if Zebra lands** | ~3k sentences, single-digit GPU-minutes, simple 4-class sentence classifier. Rescoping to `viceroy-causal-language-risk-v0` is a rename plus an honesty change, not new engineering. Demoable: flags conclusions whose causal wording outruns their design |
| **Giraffe** | **DEFER** | Its primary evaluation is now blocked on a human-annotated five-tier gold set that does not exist. Cannot be honestly evaluated today at any GPU budget |
| **Leafcutter** | **DEFER** | Not demoable; its only near-term value is token reduction, which is the purpose explicitly deferred; and it can today be at most a 3-role baseline that is *not* an A4 replacement. See `plan-corrections.md` §6 |
| **Salmon** | **DEFER** | Riskiest same-day job — multi-corpus adapters, PMID de-duplication across four corpora, two heads with masked loss, plus an ontology mapping the review says must be reworked |

This differs from the review's ordering, which puts Leafcutter first. The disagreement and its reasoning
are in `plan-corrections.md` §6; it turns on purpose-fit, not on any technical claim.

## What must be true before the clock starts

The review's reality check applies and is accepted: **the limiting work is adapters, data construction,
splits and evaluation — not gradient time.** A one-day run is only credible if, before it begins:

- the corrected Zebra adapter exists and passes unit tests against fixtures;
- SciFact is downloaded, hashed and cached, with the licence manifest approved;
- splits are frozen, including the train↔official-dev leakage assertion (Z2);
- BiomedBERT base weights are cached locally;
- the run is labelled **rapid baseline only**, with no shadow or integration eligibility claim.

If those are not met, the day is spent finishing the adapter — not cutting controls to produce a weight
file.

## Corrections that must land in Zebra before it trains

Only one is load-bearing enough to block:

**Z1 — one label-blind evidence pipeline for every class.** My plan gave supported/contradicted rows
gold rationale sentences and `NEI` rows BM25-selected sentences, so the model could learn the
input-selection policy instead of entailment. Training on it would inflate the headline number. Any
gold-rationale variant runs only as a named `oracle-evidence` secondary analysis.

Also fold in before evaluation, all cheap: the train↔dev leakage assertion (Z2); renaming the third class
**`insufficient_evidence`** rather than claiming it fills the contract's `uncertain` or `unsupported`
(Z3); and dropping the obsolete `model-lab` git-SHA binding now that code lives in this repository (Z5).

The audit-gate rework (Z4) matters for *promotion*, not for training, and promotion is not on today's
table.

## Honest limits of whatever ships today

- **Single seed, one frozen split.** No 5-fold CV, no 3-seed variance, no clean-container rerun.
- **No independent audit set** — dual blind review cannot happen in a day, so results are
  **preliminary** and cannot support even a shadow proposal.
- **Non-serving, unconditionally.** Nothing trained today may influence `EdgeVerification`, edge score,
  cards, routing or spend, and nothing may short-circuit A10.
- Viceroy, if trained, is a **causal-language risk detector**. It does not populate `claimKindCheck` and
  is not evidence validation.

Report the outcome as *"rapid baseline trained; preliminary, single-seed, no independent audit set"* — or
as a documented no-go, which remains a valid result.

## Cost

Both models are minutes of GPU on the shared BiomedBERT base. Expect **1–2 GPU-hours all-in**, roughly
USD 2–4 against the USD 20 cap. The way to overspend today is idle GPU while debugging, so build and
smoke-test on CPU and provision only for the real runs.

## Still-open human gates

Unchanged by this document, and all recorded in [`../human-gates.md`](../human-gates.md): GMI-H1–H8,
the SciFact licence manifest approval (blocks Zebra), and the Yu/Li/Wang GPL-3.0 determination (blocks
Viceroy). Jayden has indicated the three contested datasets are usable where they beat the alternative;
the determinations still need recording as artifacts, because the substrate fails closed without them.
