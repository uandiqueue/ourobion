# Interpreting the results — did training work as intended?

Read [`CONTEXT.md`](./CONTEXT.md) and [`LEAKAGE.md`](./LEAKAGE.md) first. This document answers one
question:

> **Is a given result a genuine finding about the model, or a symptom that something is broken?**

Those two are easy to confuse, and confusing them is the main way this experiment produces a wrong
conclusion. A mediocre score can be perfectly healthy. A *great* score is often the bug.

## The most important habit

**Suspicion should scale with how good the number looks**, and this bundle gives you a specific
anchor to be suspicious against.

The published result on this corpus is **0.90 accuracy / 0.88 macro-F1** — but it was computed with
`StratifiedKFold` over sentences, with no grouping, so same-paper sentences sat on both sides of
the split. This bundle's folds are group-safe. **A group-safe score should therefore land *below*
0.88.** If yours matches or beats it, your first hypothesis is a split bug, not success.

## Step 1 — checks that must pass before any metric means anything

Run these in order. If any fails, the metrics downstream are not interpretable yet.

| Check | Where | What a failure means |
|---|---|---|
| Licence gate | `preflight` exits 2 without a complete `gpl3_determination` | Working as designed. Produce the determination, or the model is blocked |
| Scope boundary | `preflight` runs `preflight_check_scope_boundary` | `CONTRACT_MAP` has been widened — `mechanistic` or `no_effect` crept in. **Stop** |
| `n_above_threshold_crossing` == 0 | `splits` | A pair above the grouping threshold crossed a fold. This is a **bug in fold assignment**, not a data property. **Stop** |
| `n_crossing_folds` | `splits` | Expected non-zero (45 on the real corpus). This is the honest residual — record it, don't "fix" it |
| Fold class balance | `splits` | Should be within ~1 row per class per fold. Wild imbalance means group structure distorted the split |
| `InsufficientFoldSupportError` | `splits`/`train` | Should be rare here — see below |
| Device actually used | logged in every artifact | If it says `mps` but timings match CPU, MPS silently fell back |

### `InsufficientFoldSupportError` means something different here than in Zebra

In the Zebra bundle this firing is expected — small corpus, size-only fold assignment, a hard
assertion afterwards. Here, folds are balanced **by class** during construction, and the rarest
class (`conditional_causal`, 213 rows) gives ~42 rows per fold against a minimum of 20. So if it
fires:

1. Read the emitted fold × class table. Group structure has probably concentrated one class.
2. Do **not** quietly lower `min_per_class_per_fold`. If you change it, say so loudly, record the
   original value, and note that `config_hash` changed.

## Step 2 — signals that something is BROKEN

| Symptom | Likely cause |
|---|---|
| **Group-safe macro F1 ≥ 0.88** | Leakage. Check `splits` output and whether `group_policy` silently became `row` |
| **`n_above_threshold_crossing` > 0** | Fold assignment bug — groups are assigned whole, so this should be impossible |
| **Only 3,051 groups but 0 near-dup links** | The surrogate did nothing; you are effectively splitting row-wise |
| **One class never predicted** (recall 0.00) | Class collapse — check the class weights in `train-artifact.json` actually applied |
| **Class weights all 1.0** | `class_weighting` got turned off, or the training split is accidentally balanced |
| **Loss flat across epochs** | LR/optimizer not applied, or MPS producing garbage. Compare a few steps on CPU |
| **Loss goes to NaN** | Precision issue; try fp32 explicitly and record the deviation |
| **Accuracy ≈ 0.443** | The model is predicting one class — that is exactly the majority baseline |
| **Accuracy quoted alone anywhere** | A reporting bug. `viceroy.metrics.accuracy` returns the majority baseline in the same object precisely so this cannot happen silently |
| **Macro F1 ≤ 0.539** | The model does not beat the **measured** cue-lexicon baseline — a real, reportable no-go |
| **Train accuracy ≈ 100%, dev far lower** | Plausible and *not* a bug at ~2,400 training rows |

## Step 3 — what a healthy, honest result looks like

- **Loss decreases** over the 5 epochs, then likely plateaus or overfits. Substantial train/dev
  divergence at this corpus size is expected and is not a defect.
- **Macro F1 meaningfully above the cue-lexicon baseline.** The baseline is *measured*, not
  remembered — on the real corpus it scores **macro F1 0.539, 95% CI [0.514, 0.560]** (balanced
  accuracy 0.526, accuracy 0.599 against a 0.443 majority baseline). Compute it again on your
  fold rather than quoting this number; if the encoder cannot beat it, that is a real no-go.
- **Below the 0.88 published anchor**, for the reason in "The most important habit".
- **All four classes predicted** at least sometimes, with non-trivial recall — especially
  `conditional_causal`, the 213-row minority the class weighting exists for.
- **ECE is not tiny.** Small models on small data are usually overconfident; that is why
  temperature scaling is fitted on out-of-fold logits only.

### The one cell that is not like the others

`directional_confusion_report` splits the causal↔correlational boundary in two, and they must
never be averaged:

- **`causal_read_as_correlational`** — a *missed flag*. The detector stayed quiet on causal
  wording. Bad, but quiet. (Cue baseline: n=22, rate 0.031.)
- **`correlational_read_as_causal`** — **the dangerous cell**. The model implies overstatement that
  is not in the sentence. If this signal were ever shown to a reviewer, it would point them at a
  sentence whose author was appropriately cautious — manufacturing the very error the detector
  exists to catch. (Cue baseline: n=123, rate 0.123.)

An encoder that beats the baseline on macro F1 while *raising* the dangerous rate is not an
improvement. Report both directions, with their rates, every time.

## Step 4 — the preregistered outcome thresholds

From the training plan. These are **engineering screening thresholds, not scientific validity**,
and none of them authorises serving.

The result may be labelled `eligible-for-shadow-review` only if **all** hold:

- cross-validated macro F1 **≥ 0.80** (against the 0.88 published anchor)
- audit-set macro F1 **≥ 0.65**
- precision on the causal classes **≥ 0.75** — the asymmetric gate
- ECE **≤ 0.10**
- beats the cue lexicon by **≥ 0.15 macro F1**
- the licence determination permits the intended use
- and the audit set is non-preliminary — **which it is not**, see below

Otherwise the honest label is:

- **`research-complete`** — useful evidence produced, with limitations stated
- **`no-go`** — not credible enough to continue

> **In this run, `eligible-for-shadow-review` is unreachable by construction**, because it requires
> an independently labelled, dual-reviewed in-domain audit set that does not exist. Do not report
> that label. The realistic outcomes are `research-complete` or `no-go`.
>
> Note also that the ≥0.80 threshold was set against a **row-level** published anchor. A group-safe
> score is expected to be lower, so falling short of 0.80 here is weaker evidence of failure than
> the plan implies. Say which kind of split produced your number.

## Step 5 — what this run cannot tell you

Be explicit about these in any write-up:

- **Same-paper leakage is uncontrolled.** The corpus ships no paper id; two confirmed same-paper
  pairs cross fold boundaries undetected. Results carry an unquantified optimistic bias. See
  [`LEAKAGE.md`](./LEAKAGE.md).
- **Single seed, one frozen grouped split.** No 3-seed variance, no clean-container rerun. Use the
  bootstrap CIs, which resample by group rather than by row.
- **No independent audit set.** Results are **preliminary** and cannot support even a shadow
  proposal.
- **This corpus is not Ourobion's domain.** It is general biomedical text; the product's
  hydration / gut / wearable / environment metric pairs are under-represented, and much of that
  literature is observational — exactly where causal overstatement concentrates.
- **Author phrasing is not ground truth about the science.** Over 80% of titles misinterpret
  non-significance as support for the null; `no_relationship` records what authors wrote, not what
  the evidence showed.
- **Nothing is validated or servable**, and nothing here populates `claimKindCheck`. See the hard
  boundary in `CONTEXT.md`.

## What to report back

Include, at minimum:

1. Outcome label — `no-go` or `research-complete`, with the reasoning.
2. Confusion matrix, per-class precision/recall/F1, macro F1, balanced accuracy — and accuracy
   only ever beside the majority baseline.
3. **Both directions of the causal↔correlational report**, with rates, unaveraged.
4. Both baselines (majority, cue lexicon) alongside the model, so the delta is visible.
5. Calibration before and after temperature, plus ECE.
6. Bootstrap 95% CIs, resampled by group.
7. **The split's leakage audit** — `n_groups`, `n_crossing_folds`, and the explicit statement that
   same-paper leakage is uncontrolled.
8. Whether the number is group-safe or row-level, whenever it is compared to the 0.88 anchor.
9. The device actually used and **wall-clock seconds per phase**.
10. Every deviation from the preregistered recipe, and why it was forced.
11. Anything from Step 2 that you saw and ruled out, and how.

An honest `no-go` with clean diagnostics is a **better outcome** than a good-looking number you
cannot account for.
