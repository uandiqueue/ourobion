"""Viceroy Causal-Language-Risk v0 — evaluation metrics.

Pure standard library (no numpy/scipy/torch import, even lazily) so this module stays as
import-cheap as ``viceroy.data`` / ``viceroy.splits`` and is trivially testable offline.
Temperature fitting uses a deterministic coarse-to-fine grid search rather than an optimizer
library, for the same reason.

Every function here validates its inputs and raises ``MetricsError`` rather than silently
returning a placeholder number. In particular: an accidentally empty eval set must produce a loud
error, never a metric value (e.g. ``0.0``) that could be misread as "the model got everything
wrong" or "perfectly calibrated".

Two things differ from the sibling Zebra bundle's metrics, both because of what this model is for:

**Accuracy is never enough.** The corpus is 44% ``no_relationship``, so a predictor that answers
one class scores 0.44. ``macro_f1`` and ``balanced_accuracy`` are the headline numbers, and
``majority_class_accuracy`` is computed alongside so a reader always sees what accuracy costs.

**One confusion cell is not like the others.** ``directional_confusion_report`` pulls out the
causal↔correlational pair in both directions and refuses to average them together. Predicting
``correlational`` when the sentence is causal is a *missed flag* — the risk detector stayed quiet.
Predicting ``causal`` when the sentence is correlational is an *induced false alarm* that, if this
signal were ever surfaced to a reviewer, would point them at the wrong sentence and endorse the
overstatement it exists to catch. The second is worse and is reported on its own.

Group-aware resampling
-----------------------
Rows are not independent (see ``viceroy.splits``): sentences that share a provenance group are
plausibly one paper. A row-level bootstrap would understate variance, so
``bootstrap_ci_by_group`` resamples whole groups — pass the same ``group_ids`` the split was
built from, never ``range(n)``.
"""

import math
import random
from collections import Counter
from typing import Callable, Mapping, Sequence

from .data import CLASS_NAMES

__all__ = [
    "MetricsError",
    "confusion_matrix",
    "per_class_prf1",
    "macro_f1",
    "balanced_accuracy",
    "accuracy",
    "directional_confusion_report",
    "multiclass_brier",
    "ece_equal_mass",
    "bootstrap_ci_by_group",
    "bootstrap_macro_f1_ci",
    "bootstrap_balanced_accuracy_ci",
    "abstention_and_selective_error",
    "fit_temperature",
    "apply_temperature",
    "majority_class_label",
    "majority_class_probs",
    "causal_cue_baseline_predict",
    "cross_validation_summary",
    "DEFAULT_ABSTENTION_THRESHOLDS",
    "CAUSAL_LABELS",
]

DEFAULT_ABSTENTION_THRESHOLDS: tuple[float, ...] = (0.50, 0.60, 0.70, 0.80)

# The two native classes that both map to ClaimKind.causal (see viceroy.data.CONTRACT_MAP).
CAUSAL_LABELS: tuple[str, ...] = ("direct_causal", "conditional_causal")


class MetricsError(ValueError):
    """Raised for invalid metrics inputs (empty input, out-of-range probabilities, mismatched
    lengths, non-positive bin counts, ...). Deliberately a loud error rather than a silently
    returned placeholder number — see this module's docstring."""


# --- validation helpers -------------------------------------------------------------------------


def _check_nonempty(name: str, seq: Sequence) -> None:
    if len(seq) == 0:
        raise MetricsError(
            f"{name!r} is empty; refusing to compute a metric over zero rows (an empty eval set "
            "must not silently look like a model that got everything wrong)"
        )


def _check_same_length(**named_seqs: Sequence) -> None:
    lengths = {name: len(seq) for name, seq in named_seqs.items()}
    if len(set(lengths.values())) > 1:
        raise MetricsError(f"mismatched input lengths: {lengths}")


def _check_known_labels(labels: Sequence[str], class_names: Sequence[str], arg_name: str) -> None:
    known = set(class_names)
    for lbl in labels:
        if lbl not in known:
            raise MetricsError(
                f"{arg_name}: unrecognized label {lbl!r}; expected one of {tuple(class_names)}"
            )


def _check_probs(probs: Sequence[Sequence[float]], class_names: Sequence[str]) -> None:
    n_classes = len(class_names)
    for row in probs:
        if len(row) != n_classes:
            raise MetricsError(
                f"each probability row must have length {n_classes} (one per class in "
                f"{tuple(class_names)}), got a row of length {len(row)}"
            )
        for p in row:
            if not (0.0 <= p <= 1.0):
                raise MetricsError(f"probability {p!r} outside [0, 1]")


def _argmax_and_confidence(
    prob_row: Sequence[float], class_names: Sequence[str]
) -> tuple[str, float]:
    best_i = 0
    best_p = prob_row[0]
    for i in range(1, len(prob_row)):
        if prob_row[i] > best_p:
            best_p = prob_row[i]
            best_i = i
    return class_names[best_i], best_p


# --- confusion matrix / per-class prf1 / macro f1 / balanced accuracy ---------------------------


def confusion_matrix(
    y_true: Sequence[str], y_pred: Sequence[str], class_names: Sequence[str] = CLASS_NAMES
) -> list[list[int]]:
    """Rows = true class, columns = predicted class, ordered per ``class_names``."""
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, y_pred=y_pred)
    _check_known_labels(y_true, class_names, "y_true")
    _check_known_labels(y_pred, class_names, "y_pred")

    idx_of = {c: i for i, c in enumerate(class_names)}
    n = len(class_names)
    cm = [[0] * n for _ in range(n)]
    for t, p in zip(y_true, y_pred):
        cm[idx_of[t]][idx_of[p]] += 1
    return cm


def per_class_prf1(
    cm: Sequence[Sequence[int]], class_names: Sequence[str] = CLASS_NAMES
) -> dict[str, dict[str, float]]:
    n = len(class_names)
    if len(cm) != n or any(len(row) != n for row in cm):
        raise MetricsError(f"confusion matrix must be {n}x{n} for class_names={tuple(class_names)}")

    result: dict[str, dict[str, float]] = {}
    for i, cls in enumerate(class_names):
        tp = cm[i][i]
        fp = sum(cm[r][i] for r in range(n)) - tp
        fn = sum(cm[i][c] for c in range(n)) - tp
        support = tp + fn
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        result[cls] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": float(support),
        }
    return result


def macro_f1(per_class: Mapping[str, Mapping[str, float]]) -> float:
    if not per_class:
        raise MetricsError("per_class is empty; nothing to average")
    return sum(v["f1"] for v in per_class.values()) / len(per_class)


def balanced_accuracy(
    cm: Sequence[Sequence[int]], class_names: Sequence[str] = CLASS_NAMES
) -> float:
    """Mean of per-class recall (a.k.a. macro-recall), the standard definition of balanced
    accuracy for multiclass problems."""
    n = len(class_names)
    if len(cm) != n or any(len(row) != n for row in cm):
        raise MetricsError(f"confusion matrix must be {n}x{n} for class_names={tuple(class_names)}")
    recalls = []
    for i in range(n):
        support = sum(cm[i])
        recalls.append(cm[i][i] / support if support > 0 else 0.0)
    return sum(recalls) / len(recalls)


def accuracy(cm: Sequence[Sequence[int]], class_names: Sequence[str] = CLASS_NAMES) -> dict:
    """Plain accuracy, returned *only* alongside the majority-class accuracy it must be compared
    against. On this corpus a single-class predictor scores ~0.44, so a bare accuracy figure is
    close to meaningless — this function makes it impossible to quote one without the other."""
    n = len(class_names)
    if len(cm) != n or any(len(row) != n for row in cm):
        raise MetricsError(f"confusion matrix must be {n}x{n} for class_names={tuple(class_names)}")
    total = sum(sum(row) for row in cm)
    if total == 0:
        raise MetricsError("confusion matrix is all zeros; nothing to score")
    correct = sum(cm[i][i] for i in range(n))
    supports = [sum(row) for row in cm]
    return {
        "accuracy": correct / total,
        "majority_class_accuracy": max(supports) / total,
        "n": total,
        "note": "accuracy alone is not reportable on this corpus; compare against majority_class_accuracy",
    }


def directional_confusion_report(
    cm: Sequence[Sequence[int]], class_names: Sequence[str] = CLASS_NAMES
) -> dict:
    """The causal↔correlational boundary, reported in both directions and never averaged.

    ``causal_read_as_correlational`` — the model saw causal wording and called it correlational.
    A missed flag: the risk detector stayed quiet. Bad, but quiet.

    ``correlational_read_as_causal`` — the model saw correlational wording and called it causal.
    This is the dangerous direction. Were this signal ever shown to a reviewer, it would point at
    a sentence whose author was appropriately cautious and imply overstatement that is not there —
    manufacturing the very error the detector exists to catch. Report this cell on its own, with
    its own rate, every time.

    Rates are over the true class's support, so they read as "of all genuinely causal sentences,
    this fraction were called correlational".
    """
    idx_of = {c: i for i, c in enumerate(class_names)}
    for needed in (*CAUSAL_LABELS, "correlational"):
        if needed not in idx_of:
            raise MetricsError(f"class_names must include {needed!r}, got {tuple(class_names)}")

    causal_idx = [idx_of[c] for c in CAUSAL_LABELS]
    corr_idx = idx_of["correlational"]

    causal_support = sum(sum(cm[i]) for i in causal_idx)
    causal_as_corr = sum(cm[i][corr_idx] for i in causal_idx)

    corr_support = sum(cm[corr_idx])
    corr_as_causal = sum(cm[corr_idx][j] for j in causal_idx)

    return {
        "causal_read_as_correlational": {
            "n": causal_as_corr,
            "of_true_support": causal_support,
            "rate": (causal_as_corr / causal_support) if causal_support else None,
            "severity": "missed flag — the detector stayed quiet on causal wording",
        },
        "correlational_read_as_causal": {
            "n": corr_as_causal,
            "of_true_support": corr_support,
            "rate": (corr_as_causal / corr_support) if corr_support else None,
            "severity": (
                "DANGEROUS — implies overstatement that is not in the sentence; this is the cell "
                "that would make the signal actively misleading, and it must never be averaged "
                "into a single causal↔correlational error rate"
            ),
        },
    }


# --- Brier score -----------------------------------------------------------------------------


def multiclass_brier(
    y_true: Sequence[str],
    probs: Sequence[Sequence[float]],
    class_names: Sequence[str] = CLASS_NAMES,
) -> float:
    """Mean squared distance between the one-hot true label and the predicted probability
    vector, summed over classes: ``mean_i sum_c (p_ic - y_ic)^2``. Ranges ``[0, 2]``; ``0`` is a
    perfect, fully-confident correct prediction."""
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, probs=probs)
    _check_known_labels(y_true, class_names, "y_true")
    _check_probs(probs, class_names)

    idx_of = {c: i for i, c in enumerate(class_names)}
    total = 0.0
    for true_label, prob_row in zip(y_true, probs):
        true_idx = idx_of[true_label]
        for i, p in enumerate(prob_row):
            target = 1.0 if i == true_idx else 0.0
            total += (p - target) ** 2
    return total / len(y_true)


# --- 10-bin equal-mass ECE + reliability-diagram data -------------------------------------------


def ece_equal_mass(
    y_true: Sequence[str],
    probs: Sequence[Sequence[float]],
    class_names: Sequence[str] = CLASS_NAMES,
    n_bins: int = 10,
) -> dict:
    """Expected Calibration Error using equal-*mass* (quantile) bins rather than equal-width
    bins, so every bin gets a comparable number of rows even when confidence is heavily skewed
    (as it often is for a fine-tuned classifier). Confidence is ``max`` predicted probability;
    "correct" means the argmax class equals the true label.

    Returns ``{"ece": float, "n_bins": int, "bins": [ {bin_index, n, mean_confidence, accuracy,
    confidence_lo, confidence_hi}, ... ]}`` — the reliability-diagram data as plain numbers, no
    plotting.
    """
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, probs=probs)
    _check_known_labels(y_true, class_names, "y_true")
    _check_probs(probs, class_names)
    if n_bins < 1:
        raise MetricsError(f"n_bins must be >= 1, got {n_bins}")

    rows = []
    for true_label, prob_row in zip(y_true, probs):
        pred_label, confidence = _argmax_and_confidence(prob_row, class_names)
        rows.append((confidence, 1.0 if pred_label == true_label else 0.0))
    rows.sort(key=lambda r: r[0])

    n = len(rows)
    actual_bins = min(n_bins, n)  # can't make more equal-mass bins than rows
    bins = []
    ece = 0.0
    start = 0
    for b in range(actual_bins):
        # distribute the remainder across the first bins so sizes differ by at most 1
        size = n // actual_bins + (1 if b < n % actual_bins else 0)
        chunk = rows[start : start + size]
        start += size
        confidences = [c for c, _ in chunk]
        corrects = [a for _, a in chunk]
        mean_conf = sum(confidences) / len(confidences)
        acc = sum(corrects) / len(corrects)
        bins.append(
            {
                "bin_index": b,
                "n": len(chunk),
                "mean_confidence": mean_conf,
                "accuracy": acc,
                "confidence_lo": confidences[0],
                "confidence_hi": confidences[-1],
            }
        )
        ece += (len(chunk) / n) * abs(acc - mean_conf)

    return {"ece": ece, "n_bins": actual_bins, "bins": bins}


# --- bootstrap CI, resampled by provenance group --------------------------------------------------


def bootstrap_ci_by_group(
    metric_fn: Callable[[list[int]], float],
    group_ids: Sequence[object],
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """95% (by default) bootstrap CI for whatever ``metric_fn`` computes, resampled by whole
    *provenance group* (from ``viceroy.splits.build_groups``) rather than by row — sampling
    groups with replacement and including every row of a sampled group together, so a group is
    never split across the resampled set.

    ``metric_fn`` receives a list of row-indices (into the same order as ``group_ids``, with
    repeats when a group is drawn more than once) and must return a single float.
    """
    _check_nonempty("group_ids", group_ids)
    if n_resamples < 1:
        raise MetricsError(f"n_resamples must be >= 1, got {n_resamples}")
    if not (0.0 < alpha < 1.0):
        raise MetricsError(f"alpha must be in (0, 1), got {alpha}")

    rows_by_group: dict[object, list[int]] = {}
    for idx, gid in enumerate(group_ids):
        rows_by_group.setdefault(gid, []).append(idx)
    group_keys = list(rows_by_group.keys())

    point = metric_fn(list(range(len(group_ids))))

    rng = random.Random(seed)
    n_groups = len(group_keys)
    boot_values = []
    for _ in range(n_resamples):
        resampled_indices: list[int] = []
        for _ in range(n_groups):
            key = group_keys[rng.randrange(n_groups)]
            resampled_indices.extend(rows_by_group[key])
        boot_values.append(metric_fn(resampled_indices))

    boot_values.sort()
    lo_i = max(0, min(n_resamples - 1, int((alpha / 2) * n_resamples)))
    hi_i = max(0, min(n_resamples - 1, int((1 - alpha / 2) * n_resamples) - 1))
    return {
        "point": point,
        "ci_lo": boot_values[lo_i],
        "ci_hi": boot_values[hi_i],
        "n_resamples": n_resamples,
        "n_groups": n_groups,
        "alpha": alpha,
    }


def bootstrap_macro_f1_ci(
    y_true: Sequence[str],
    y_pred: Sequence[str],
    group_ids: Sequence[object],
    class_names: Sequence[str] = CLASS_NAMES,
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """Convenience wrapper: group-resampled bootstrap CI for macro F1.

    Note the resampled confusion matrix can be missing a class entirely; ``per_class_prf1``
    handles that by scoring the absent class 0.0 rather than raising, which is the conservative
    reading for a CI.
    """
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, y_pred=y_pred, group_ids=group_ids)
    y_true = list(y_true)
    y_pred = list(y_pred)

    def metric_fn(indices: list[int]) -> float:
        cm = confusion_matrix(
            [y_true[i] for i in indices], [y_pred[i] for i in indices], class_names
        )
        return macro_f1(per_class_prf1(cm, class_names))

    return bootstrap_ci_by_group(metric_fn, group_ids, n_resamples, seed, alpha)


def bootstrap_balanced_accuracy_ci(
    y_true: Sequence[str],
    y_pred: Sequence[str],
    group_ids: Sequence[object],
    class_names: Sequence[str] = CLASS_NAMES,
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """Convenience wrapper: group-resampled bootstrap CI for balanced accuracy."""
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, y_pred=y_pred, group_ids=group_ids)
    y_true = list(y_true)
    y_pred = list(y_pred)

    def metric_fn(indices: list[int]) -> float:
        cm = confusion_matrix(
            [y_true[i] for i in indices], [y_pred[i] for i in indices], class_names
        )
        return balanced_accuracy(cm, class_names)

    return bootstrap_ci_by_group(metric_fn, group_ids, n_resamples, seed, alpha)


# --- cross-validation aggregation -----------------------------------------------------------------


def cross_validation_summary(per_fold_values: Sequence[float]) -> dict:
    """Mean and sample standard deviation across folds.

    The training plan requires reporting cross-validated **mean ± sd**, not a single split's
    number: on ~3k examples one split's macro F1 has a wide interval, and quoting one figure
    overstates precision. Uses the sample sd (n-1 denominator) because these folds are a sample of
    possible splits, not the population of them.
    """
    _check_nonempty("per_fold_values", per_fold_values)
    values = [float(v) for v in per_fold_values]
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return {"mean": mean, "sd": None, "n_folds": n, "values": values}
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    return {"mean": mean, "sd": math.sqrt(variance), "n_folds": n, "values": values}


# --- abstention coverage / selective error -------------------------------------------------------


def abstention_and_selective_error(
    y_true: Sequence[str],
    probs: Sequence[Sequence[float]],
    class_names: Sequence[str] = CLASS_NAMES,
    thresholds: Sequence[float] = DEFAULT_ABSTENTION_THRESHOLDS,
) -> dict[float, dict]:
    """For each confidence threshold: coverage (fraction of rows where max-prob >= threshold,
    i.e. the model would "answer" rather than abstain) and selective error (error rate among the
    answered rows only; ``None`` — not 0.0 — when no row clears the threshold).

    Abstention matters more for this model than for most: a risk flag that declines to fire is
    harmless, while a confident wrong one is not (see ``directional_confusion_report``). A high
    threshold with low coverage and low selective error is a perfectly good outcome to report.
    """
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, probs=probs)
    _check_known_labels(y_true, class_names, "y_true")
    _check_probs(probs, class_names)
    if len(thresholds) == 0:
        raise MetricsError("thresholds is empty")

    n = len(y_true)
    predictions = [_argmax_and_confidence(row, class_names) for row in probs]

    results: dict[float, dict] = {}
    for t in thresholds:
        answered = 0
        errors = 0
        for true_label, (pred_label, confidence) in zip(y_true, predictions):
            if confidence >= t:
                answered += 1
                if pred_label != true_label:
                    errors += 1
        results[t] = {
            "threshold": t,
            "coverage": answered / n,
            "selective_error": (errors / answered) if answered > 0 else None,
            "n_answered": answered,
            "n_total": n,
        }
    return results


# --- temperature scaling (pure Python, deterministic coarse-to-fine grid search) ----------------


def _log_softmax(logit_row: Sequence[float], temperature: float) -> list[float]:
    scaled = [x / temperature for x in logit_row]
    m = max(scaled)
    exps = [math.exp(x - m) for x in scaled]
    s = sum(exps)
    log_s = math.log(s)
    return [x - m - log_s for x in scaled]


def _nll_at_temperature(
    logits: Sequence[Sequence[float]], true_indices: Sequence[int], temperature: float
) -> float:
    total = 0.0
    for row, ti in zip(logits, true_indices):
        total -= _log_softmax(row, temperature)[ti]
    return total / len(logits)


def fit_temperature(
    logits: Sequence[Sequence[float]],
    y_true: Sequence[str],
    class_names: Sequence[str] = CLASS_NAMES,
    bounds: tuple[float, float] = (0.05, 10.0),
    n_grid: int = 50,
    n_rounds: int = 5,
) -> float:
    """Fits a single scalar temperature ``T`` minimizing negative log-likelihood on the given
    (out-of-fold) logits, via deterministic coarse-to-fine grid search — no scipy/numpy
    dependency, so this stays testable and importable everywhere this bundle runs.

    ``logits`` MUST be out-of-fold predictions (i.e. never the same rows the classifier that
    produced them was trained on) — fitting temperature on in-fold logits would understate the
    model's true miscalibration. That discipline is the caller's responsibility; this function
    only does the numerical fit.
    """
    _check_nonempty("logits", logits)
    _check_same_length(logits=logits, y_true=y_true)
    _check_known_labels(y_true, class_names, "y_true")
    if n_grid < 2:
        raise MetricsError(f"n_grid must be >= 2, got {n_grid}")
    lo, hi = bounds
    if not (lo > 0 and hi > lo):
        raise MetricsError(f"bounds must be (lo, hi) with 0 < lo < hi, got {bounds}")

    idx_of = {c: i for i, c in enumerate(class_names)}
    true_indices = [idx_of[c] for c in y_true]

    for row in logits:
        if len(row) != len(class_names):
            raise MetricsError(
                f"each logits row must have length {len(class_names)}, got {len(row)}"
            )

    best_t = (lo + hi) / 2.0
    for _ in range(n_rounds):
        step = (hi - lo) / (n_grid - 1)
        grid = [lo + i * step for i in range(n_grid)]
        scored = [(_nll_at_temperature(logits, true_indices, t), t) for t in grid]
        _best_nll, best_t = min(scored, key=lambda pair: pair[0])
        span = step * 2
        lo = max(bounds[0], best_t - span)
        hi = min(bounds[1], best_t + span)
        if hi <= lo:
            break
    return best_t


def apply_temperature(logits: Sequence[Sequence[float]], temperature: float) -> list[list[float]]:
    """Softmax(logit / T) for each row. Raises if ``temperature`` is not strictly positive."""
    _check_nonempty("logits", logits)
    if temperature <= 0:
        raise MetricsError(f"temperature must be positive, got {temperature}")
    probs = []
    for row in logits:
        log_p = _log_softmax(row, temperature)
        probs.append([math.exp(x) for x in log_p])
    return probs


# --- baselines: majority-class and the deterministic causal-cue lexicon ---------------------------


def majority_class_label(
    train_labels: Sequence[str], class_names: Sequence[str] = CLASS_NAMES
) -> str:
    """The most frequent label in ``train_labels``, ties broken alphabetically for determinism.
    A baseline exists so the real model has something concrete to beat — this function is not,
    and must never be reported as, a classifier."""
    _check_nonempty("train_labels", train_labels)
    _check_known_labels(train_labels, class_names, "train_labels")
    counts = Counter(train_labels)
    best_count = max(counts.values())
    tied = sorted(lbl for lbl, c in counts.items() if c == best_count)
    return tied[0]


def majority_class_probs(
    majority_label: str, n: int, class_names: Sequence[str] = CLASS_NAMES
) -> list[list[float]]:
    """``n`` copies of a one-hot probability row on ``majority_label`` — the majority-class
    baseline's "probabilities" (it is maximally, and wrongly, confident by construction)."""
    if n <= 0:
        raise MetricsError(f"n must be positive, got {n}")
    if majority_label not in class_names:
        raise MetricsError(f"majority_label {majority_label!r} not in {tuple(class_names)}")
    idx = class_names.index(majority_label)
    row = [0.0] * len(class_names)
    row[idx] = 1.0
    return [list(row) for _ in range(n)]


# Cue phrases, ordered by specificity within each group. Matched on the lowercased sentence as
# substrings, so multi-word phrases work without a parser. These are deliberately the *obvious*
# cues a person would write down in five minutes — the baseline is meant to be weak and
# interpretable, and beating it is the minimum bar for the encoder to justify its existence.
_NULL_CUES: tuple[str, ...] = (
    "no association",
    "no significant association",
    "not associated",
    "no correlation",
    "not correlated",
    "no significant difference",
    "no difference",
    "did not differ",
    "no evidence",
    "no effect",
    "did not affect",
    "were not related",
    "was not related",
    "no relationship",
    "not significant",
)

_CORRELATIONAL_CUES: tuple[str, ...] = (
    "associated with",
    "association between",
    "correlated with",
    "correlation between",
    "linked to",
    "relationship between",
    "related to",
    "predictor of",
    "risk factor",
)

# Stems, not full words, so a single entry covers the inflections a conclusion sentence actually
# uses ("reduce"/"reduces"/"reduced"/"reducing"). Matching full forms missed the bare infinitive
# after a modal — "may reduce" — which is precisely the hedged-causal case this baseline must
# handle.
_CAUSAL_CUES: tuple[str, ...] = (
    "caus",  # causes / caused / causal / causing / causality
    "leads to",
    "lead to",
    "led to",
    "result in",
    "results in",
    "resulted in",
    "induc",  # induce / induces / induced
    "improv",  # improve / improves / improved / improvement
    "reduc",  # reduce / reduces / reduced / reduction
    "increas",  # increase / increases / increased
    "decreas",  # decrease / decreases / decreased
    "prevent",  # prevent / prevents / prevented / prevention
    "effect of",
    "efficacy",
    "effective in",
)

_HEDGE_CUES: tuple[str, ...] = (
    "may ",
    "might ",
    "could ",
    "suggest",
    "appears to",
    "seems to",
    "potentially",
    "possibly",
    "likely",
)


def causal_cue_baseline_predict(sentence_text: str) -> str:
    """A deterministic, non-learned baseline: NOT a serious classifier, just a cue-phrase lexicon
    that gives the encoder something concrete (and weak) to beat.

    Rules, in order:
      1. an explicit null/negation cue ("no association", "did not differ") -> ``no_relationship``;
      2. a correlational cue ("associated with", "linked to") -> ``correlational``;
      3. a causal cue plus a hedge ("may reduce", "suggests ... improves") ->
         ``conditional_causal``;
      4. a causal cue with no hedge -> ``direct_causal``;
      5. otherwise -> ``no_relationship``, the majority class.

    Rule order encodes the one asymmetry that matters: the null and correlational cues are checked
    *before* the causal ones, so a sentence saying "X was associated with, but did not cause, Y"
    lands on the cautious side. A baseline that guessed causal on ties would flatter the model it
    is supposed to challenge.
    """
    text = sentence_text.lower()

    if any(cue in text for cue in _NULL_CUES):
        return "no_relationship"
    if any(cue in text for cue in _CORRELATIONAL_CUES):
        return "correlational"
    if any(cue in text for cue in _CAUSAL_CUES):
        if any(cue in text for cue in _HEDGE_CUES):
            return "conditional_causal"
        return "direct_causal"
    return "no_relationship"
