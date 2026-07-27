---
title: Add interpretive context to the Zebra bundle so a remote agent can judge the run
summary: The bundle was self-contained for execution but not for interpretation — an agent on the Mac Mini would have had no way to tell a genuine no-go from a bug. Added CONTEXT.md and INTERPRETING-RESULTS.md, with the central heuristic that suspicion should scale with how good the number looks.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Add interpretive context to the Zebra bundle

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/zebra-bundle-run4` in `C:\project\ourobion-zbundle`, on the
`dev-phase2-run4` line

## The gap this closes

The bundle was self-contained *for execution* — 82 tests pass with no repo present. It was **not**
self-contained *for interpretation*. An agent on the Mac Mini would have had the code and no way to
answer the question that actually matters: **is this result a finding, or a symptom?**

Without that, the likely failure mode is not a crash. It is a plausible-looking number being reported
as success when it is actually leakage — or a mediocre number being treated as failure when it is a
perfectly honest no-go.

## Changed

- **`CONTEXT.md`** — what Zebra feeds (the synthesis → adversarial-verifier pipeline), why a cheap
  second opinion is wanted, and the project's stated priority that a *second-source signal* matters now
  while token reduction does not. Explains why the third class is `insufficient_evidence` and must
  never be renamed to `uncertain`: the contract separates "no evidence found" from "could not be
  grounded", and SciFact `NEI` is neither. States the non-serving boundary, the label-blind design and
  why the earlier label-dependent version was fatal, the preregistration rule (**do not tune the
  recipe**), the data/licence position, and what is unverified.
- **`INTERPRETING-RESULTS.md`** — a five-step diagnostic guide: gates that must pass before any metric
  is meaningful; a symptom→cause table for *broken*; what a healthy honest result looks like; the
  preregistered outcome thresholds; and what this run cannot tell you.
- **`README.md`** — points at both up front, before the run steps.

## The judgements worth recording

- **The central heuristic is "suspicion should scale with how good the number looks."** A 110M model on
  919 examples is not supposed to be excellent. Macro F1 above ~0.90 is far more likely leakage than
  success. Stating this explicitly is more useful to a remote agent than any threshold table, because
  it inverts the natural bias toward treating a high score as good news.
- **`InsufficientFoldSupportError` is documented as possibly-correct behaviour, not a bug.** With
  ~1,259 rows over three classes and component-grouped folds, viable per-class support cannot be
  assumed. The guide tells the agent to read the fold × class table and report the finding — and
  explicitly *not* to quietly lower the minimum to make it pass.
- **`eligible-for-shadow-review` is flagged as unreachable in this run by construction**, since it
  requires a dual-reviewed audit set that does not exist. Without that, an agent reading the thresholds
  could reasonably conclude the model qualified. The realistic outcomes are `research-complete` or
  `no-go`.
- **The label-blind vs oracle gap is framed as informative rather than embarrassing** — it estimates
  how much of the task is retrieval rather than entailment, and the label-blind figure is the honest
  headline.
- Report-back list requires baselines *alongside* the model, so the delta is visible rather than a bare
  score, and requires wall-clock per phase — which replaces the unverified timing estimates currently
  quoted to the machine's owner.

## Left

- Everything in the previous session's unverified list still stands: no network, no real SciFact, no
  real tokenizer, no Apple Silicon.
- A human must still produce `licence-approval.json`.
- The Run-3 copy of the bundle does not have these two documents and is now stale relative to the Run-4
  copy. If Run 4 becomes the long-lived line, retire the Run-3 copy rather than maintaining both.

## Blockers

- None. 82 tests still pass after the change; no code was modified, only documentation added.

memory: none
