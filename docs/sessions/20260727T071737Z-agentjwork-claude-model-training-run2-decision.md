---
title: Evaluate codex's five-model plan review; open model-training run 2 and pick today's training target
summary: Independently checked codex's review of the five plans I authored and agreed with it — three of five plans are not workable as written, including a label-dependent evidence construction in Zebra that would have inflated its scores. Opened docs/temp/model-training/run2/ with the accepted corrections and the decision to train Zebra, then rescoped Viceroy.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Evaluate codex's five-model plan review; open model-training run 2

Issue: [#149](https://github.com/uandiqueue/ourobion/issues/149)
Branch/worktree: `docs/model-training-run2-149` in `C:\project\ourobion-mt-run2`
Task claim: `model-training-run2-decision` / `claude` / `agentjwork`

Codex reviewed the five custom-model training plans, all of which I authored. This session evaluates
that review rather than accepting it, then folds the accepted findings into a run-2 planning doc and
reaches the concrete decision Jayden asked for: which model to train today. **No implementation code.**

## Attempted

- Read the review in full and checked its load-bearing factual claims against sources rather than
  taking them on assertion.
- **Independently verified the decisive Giraffe claim.** Fetched StudyTypeTeller's actual label set:
  15 classes (protocol, human/animal systematic review, three RCT variants, case report, two non-RCT
  intervention classes, three animal classes, in-vitro, remaining). It contains **no cohort class and no
  cross-sectional class** — both fall into `Remaining`. Codex is right.
- Re-read the `RelationKind`/`ClaimKind`/`Verdict` contract comments to check the Viceroy and Zebra
  mapping arguments against the actual enums.

## Changed

- Added `docs/temp/model-training/run2/plan-corrections.md` — per-model disposition of every finding.
- Added `docs/temp/model-training/run2/README.md` — run-2 cockpit and today's decision.

No plan file was amended; each amendment lands with its MT unit. No code was written.

## Decided

- **I agree with the review.** Every technical finding is accepted. Three of five verdicts overturn
  plans I wrote.
- **Train Zebra today, then rescoped Viceroy if Zebra lands.** Defer Giraffe, Leafcutter and Salmon.
- **One disagreement, on purpose-fit not correctness:** the review ranks Leafcutter first on cost and
  probability of an interpretable result. Jayden's stated purposes are a second-source signal and a
  hackathon showcase, with token reduction explicitly deferred until reliability is confirmed.
  Leafcutter is not demoable, its only near-term value is the deprioritised purpose, and by the review's
  own verdict it can today be at most a 3-role baseline that is not an A4 replacement — so it can be
  neither shown nor shipped. Recorded in `plan-corrections.md` §6.
- **Giraffe cannot be trained today at any GPU budget** — its primary evaluation now needs a human
  five-tier gold set that does not exist.
- **Viceroy is rescoped and renamed** to `viceroy-causal-language-risk-v0`. It never populates
  `claimKindCheck`.

## Defects in my own plans, recorded

Two would have produced misleading results, not just untidy ones:

1. **Zebra's evidence construction leaked label availability.** Supported/contradicted rows received
   gold rationale sentences plus context while `NEI` rows received BM25-selected sentences, so the
   classifier could learn the input-selection policy instead of entailment — and inference never has
   gold rationales. My plan anticipated a *length* shortcut but not the structural one, and my note that
   "BM25 never assigns the label" missed the point: the *procedure* carries the label even when the
   selector does not. This is the single most important finding in the review.
2. **Giraffe made an unmeasurable metric a promotion gate.** I named StudyTypeTeller the primary gold
   set *and* made tier-2-vs-tier-3 F1 ≥0.50 an eligibility condition. The gold set has no cohort or
   cross-sectional class, so the gate cannot be evaluated on it. Two incompatible decisions in one plan.

Also accepted: `NEI → uncertain` is not a clean contract mapping (`unsupported` is absence of evidence,
`uncertain` is failure to ground; SciFact `NEI` is neither) — rename the native class
`insufficient_evidence`; Viceroy's task is mismatched with `claimKindCheck` at the task level, which is
sharper than the coverage gap I had flagged; Leafcutter's public mapping yields three roles, not the
four my plan claimed; and Zebra §12 still binds an obsolete separate `model-lab` git SHA.

## Left

- The Zebra plan needs Z1/Z2/Z3/Z5 folded in before MT3 implementation; Z4 (audit gates) blocks
  promotion, not training.
- Giraffe, Salmon and Leafcutter plans need their accepted corrections applied before their units start.
- Licence determinations still need recording as artifacts — the substrate fails closed without them —
  even though Jayden has indicated the three contested datasets are usable where they beat the
  alternative.
- Anything trained today is preliminary: single seed, one frozen split, no independent audit set, and
  non-serving unconditionally.

## Blockers

- No training was run and no GPU was provisioned in this session.
- MT1–MT5 remain placeholders; MT3 (Zebra) cannot start until Z1's label-blind evidence pipeline is
  specified in the plan.

memory: none
