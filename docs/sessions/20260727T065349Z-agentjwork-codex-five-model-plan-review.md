---
title: Review all five custom-model training plans for workability
summary: Reviewed Zebra, Giraffe, Salmon, Viceroy, and Leafcutter in parallel and against primary sources; recorded verdicts, minimum workable redesigns, and a one-day rapid-baseline priority/schedule, excluding licensing at Jayden's direction.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Review all five custom-model training plans for workability

Issue: [#146](https://github.com/uandiqueue/ourobion/issues/146)
Branch/worktree: `docs/model-training-review-146` in `C:\project\ourobion-review-146`
Task claim: `review-five-model-training-plans` / `codex` / `agentjwork`

## Attempted

- Ran the session briefing, read the latest model-training and graph sessions, consulted the tracked
  semantic graph view, and created the required issue/task claim/isolated worktree.
- Dispatched three independent read-only reviews in parallel: Zebra; Giraffe + Leafcutter; and Salmon +
  Viceroy. Each was asked to assess labels/task fit, data, leakage, architecture, evaluation, compute,
  integration containment, and execution gates against primary/official sources.
- Paused all subagents on request, then resumed after checking both the primary checkout and review
  worktree for intervening updates.
- Found that MT0 had merged while paused and intentionally touched all five plans. Verified the plan
  diffs, session record, policy change, and clean worktree; fast-forwarded the review branch from
  `9b41f4a` to current `dev-phase2-run3` commit `0da76ca` before restarting the reviews.
- Independently checked material reviewer findings against `shared/brain/relationships.ts`, the A4/A5/
  A8/A10 architecture, the MT0 substrate/placeholders, and original SciFact, StudyTypeTeller, PubMed
  200k RCT, BioREDirect, and Yu/Li/Wang sources.
- Excluded all licensing considerations from verdicts and solutions after Jayden explicitly requested
  that scope change.
- Extended the review on follow-up with consolidated minimum workable redesigns for all five models and a
  one-day priority/schedule. Distinguished a credible `rapid-baseline-complete` result from the full plans'
  `research-complete` and promotion gates.

## Changed

- Added
  [`docs/temp/model-training/five-model-training-plans-review.md`](../temp/model-training/five-model-training-plans-review.md):
  review method, binary verdict table, cross-plan findings, comments for every plan, required corrections,
  concrete repair paths for every not-workable plan, minimum workable targets, a one-day priority list,
  concurrent CPU/GPU schedule, stop rules, and longer-term sequencing.
- Added this one session log. No training plan, shared contract, model-training source file, memory record,
  or product/runtime file was edited.

## Decided

- **Zebra: WORKABLE**, but label-dependent evidence windows, train↔dev leakage assertions, model-native
  `insufficient_evidence` semantics, audit estimability, and one stale MT0 identity must be fixed before MT3.
- **Giraffe: NOT WORKABLE AS WRITTEN** because StudyTypeTeller cannot validate the plan's decisive tier-2
  versus tier-3 boundary; repair with a dedicated five-tier gold set and a hashed label/abstain spec.
- **Salmon: WORKABLE only as a narrower abstaining offline pilot** after retaining BioREDirect's native
  right/left/undirected/none states, validating the relation mapping, adding coverage gates, and fixing v0
  to A10 research rather than silently spanning A8/A10.
- **Viceroy: NOT WORKABLE AS WRITTEN for `claimKindCheck`** because causal wording is not the same as
  evidence-licensed claim kind. Recommended rescope: causal-language risk detector; a true checker needs
  pair-aligned claim + independent evidence + study-design labels.
- **Leafcutter: NOT WORKABLE AS WRITTEN as a five-role A4 tagger** because its public mapping creates only
  background/method/finding. Repair with an explicit three-role Stage A, mandatory full-text Stage B, and
  one authoritative hedge representation.
- Missing MT1–MT5 code is reported as execution state, not used to reject a plan. MT0's shared substrate is
  useful infrastructure but is not evidence that any task or label mapping is scientifically valid.
- A model-lab-only shadow-output record is needed for `abstain`, `not_covered`, `undirected`, and
  `insufficient_evidence`; research outputs must not be forced into mandatory shared-contract booleans/enums.
- Current `AGENTS.md` data-read wording needs clarification because a literal “fixtures and manifests only”
  rule conflicts with every plan's approved, hash-pinned external research-data adapter.
- **One-day priority:** Leafcutter three-role CPU baseline → Zebra label-blind NLI → Viceroy causal-language
  risk → Salmon native-label relation/direction → Giraffe rules/data pipeline (train only when corrected
  data/gold are prebuilt). A one-day pass never authorizes promotion and must preserve evaluation/closeout
  time rather than chase five checkpoints.
- A full five-model day is credible only if corrected adapters, cached datasets/base weights, frozen splits,
  compute, and evaluation inputs exist before the clock starts. From MT1–MT5 placeholders, implementation +
  full training + evaluation in one day is not workable.

## Left

- No requested plan fixes were implemented; this session was a review/documentation task.
- `docs/temp/model-training/code-build-unit-index.md` remains stale against the merged MT0 result (152 vs
  158 tests, lint/type status, PR/merge state). Recorded in the review, not edited outside task scope.
- `docs/nao/brain-support-models-design.md` still contains the three known-invalid assumptions from memory
  0017. The review recommends amendment/subordination before MT2/MT4.
- At Jayden's explicit request, the completed review/session changes are committed on the issue branch and
  fast-forwarded into the current local primary `dev-phase2-run3` worktree. No push or PR is performed.

## Blockers

- None for completing the requested review document. The plans themselves have the technical blockers and
  repair paths recorded in the review.

memory: none
