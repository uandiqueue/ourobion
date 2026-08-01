# Interpreting the results — did training work as intended?

Read [`CONTEXT.md`](./CONTEXT.md) first. This document answers one question:

> **Is a given result a genuine finding about the model, or a symptom that something is broken?**

Those two are easy to confuse, and confusing them is the main way this experiment produces a wrong
conclusion. A mediocre score can be perfectly healthy. A *great* score is often the bug.

## The most important habit

**Suspicion should scale with how good the number looks.** This is a 110M-parameter encoder trained on
919 examples. It is not supposed to be excellent. If macro F1 lands very high, your first hypothesis
should be leakage or a label shortcut, not success.

## Step 1 — checks that must pass before any metric means anything

Run these in order. If any fails, the metrics downstream are not interpretable yet.

| Check | Where | What a failure means |
|---|---|---|
| Licence gate | `preflight` exits 2 without `licence-approval.json` | Working as designed. Produce the file. |
| Label-blind signature | `preflight` runs `preflight_check_label_blind` | If it fails, evidence construction can see the label — **stop**, the run is invalid |
| Split leakage | `SplitLeakageError` | Claim/abstract/component/text overlap across folds or between train and dev. **Stop** |
| Fold class support | `InsufficientFoldSupportError` | See below — this one is *expected* to be possible |
| Device actually used | logged in every artifact | If it says `mps` but timings match CPU, MPS silently fell back |

### `InsufficientFoldSupportError` is not necessarily a bug

With ~1,259 rows across three classes and component-grouped folds, there may not be enough of every
class in every fold. **That assertion exists precisely because this cannot be assumed.** If it fires:

1. Read the emitted fold × class table. Is one class genuinely rare, or is the split degenerate?
2. This is a legitimate finding to report — "SciFact's class distribution does not support 5-fold
   component-grouped CV at the preregistered minimum" is a real result.
3. Do **not** quietly lower `min_per_class_per_fold` to make it pass. If you change it, say so loudly
   and record the original value and why.

## Step 2 — signals that something is BROKEN

| Symptom | Likely cause |
|---|---|
| **Macro F1 > 0.90** | Leakage. Check train↔dev separation and whether oracle mode was left on |
| **Label-blind ≈ oracle performance** | Retrieval is accidentally recovering gold rationales — the label-blind guarantee is being defeated downstream of the selector |
| **One class never predicted** (recall 0.00) | Class collapse — check class balance, loss weighting, and that all three labels survived preprocessing |
| **Loss flat across epochs** | LR/optimizer not applied, or MPS producing garbage. Compare a few steps on CPU |
| **Loss goes to NaN** | Precision issue; try fp32 explicitly and record the deviation |
| **Evidence text identical across many rows** | Retrieval broken — inspect the evidence-length distribution |
| **`mps` reported but no speedup vs CPU** | Silent fallback; some ops aren't implemented. Not fatal, but the artifact must say CPU |
| **Dev accuracy ≈ 33%** on 3 classes | Model is guessing — check the label map and that logits align with class indices |
| **Train accuracy ≈ 100%, dev far lower** | Plausible and *not* a bug at 919 rows — see overfitting below |

## Step 3 — what a healthy, honest result looks like

- **Loss decreases** over the 5 epochs, then likely plateaus or overfits. On 919 examples, substantial
  train/dev divergence is expected and is not a defect.
- **Macro F1 meaningfully above the majority baseline.** The code computes both — compare against the
  *computed* majority and lexical-overlap baselines, not against a remembered number. If the model
  cannot beat a lexical-overlap baseline, that is a real and reportable no-go.
- **All three classes get predicted** at least sometimes, with non-trivial recall.
- **A visible gap between label-blind and oracle-evidence** performance. This gap is informative, not
  embarrassing: it estimates how much of the task is *retrieval* rather than *entailment*. A large gap
  means the honest deployment number is the label-blind one.
- **ECE is not tiny.** Small models on small data are usually overconfident; that is why temperature
  scaling is fitted on out-of-fold logits only.

## Step 4 — the preregistered outcome thresholds

From the training plan. These are **engineering screening thresholds, not scientific validity**, and
none of them authorises serving.

The result may be labelled `eligible-for-shadow-review` only if **all** hold:

- macro F1 **≥ 0.70**
- every class recall **≥ 0.60**
- ECE **≤ 0.10**
- improvement over the majority baseline **≥ 0.10 macro F1**
- and the audit set is non-preliminary — **which it is not**, see below

Otherwise the honest label is:

- **`research-complete`** — useful evidence produced, with limitations stated
- **`no-go`** — not credible enough to continue

> **In this run, `eligible-for-shadow-review` is unreachable by construction**, because it requires an
> independently labelled, dual-reviewed in-domain audit set that does not exist. Do not report that
> label. The realistic outcomes here are `research-complete` or `no-go`.

## Step 5 — what this run cannot tell you

Be explicit about these in any write-up:

- **Single seed, one frozen split.** No 5-fold variance estimate across seeds, no clean-container
  reproducibility rerun. Numbers carry more uncertainty than a single figure suggests — use the
  bootstrap CIs, which resample by component rather than by row.
- **No independent audit set.** Results are **preliminary** and cannot support even a shadow proposal.
- **SciFact is not Ourobion's domain.** It skews to biomedical abstracts; the product's
  hydration / gut / wearable / environment metric pairs are under-represented. Good SciFact numbers do
  not transfer automatically.
- **`NEI` may reflect incomplete annotation** rather than demonstrated absence of evidence. Say so when
  reporting per-class results for `insufficient_evidence`.
- **Nothing is validated or servable.** See the hard boundary in `CONTEXT.md`.

## What to report back

Include, at minimum:

1. Outcome label — `no-go` or `research-complete`, with the reasoning.
2. Confusion matrix, per-class precision/recall/F1, macro F1, balanced accuracy.
3. Both baselines (majority, lexical overlap) alongside the model, so the delta is visible.
4. Calibration before and after temperature, plus ECE.
5. Bootstrap 95% CIs, resampled by component.
6. **Label-blind vs oracle-evidence** side by side, with label-blind as the headline.
7. The device actually used and **wall-clock seconds per phase** — the timings quoted in
   `OWNER-NOTE.md` are unverified estimates and this run replaces them with measurements.
8. Every deviation from the preregistered recipe, and why it was forced.
9. Anything from Step 2 that you saw and ruled out, and how.

An honest `no-go` with clean diagnostics is a **better outcome** than a good-looking number you cannot
account for.
