"""Zebra NLI Shadow v0 — evaluation metrics.

Pure standard library (no numpy/scipy/torch import, even lazily) so this module stays as
import-cheap as ``zebra.data`` / ``zebra.splits`` and is trivially testable offline. Temperature
fitting uses a deterministic coarse-to-fine grid search rather than an optimizer library, for the
same reason.

Every function here validates its inputs and raises ``MetricsError`` rather than silently
returning a placeholder number. In particular: an accidentally empty eval set must produce a loud
error, never a metric value (e.g. ``0.0``) that could be misread as "the model got everything
wrong" or "perfectly calibrated".

Component-aware resampling
---------------------------
SciFact rows are not independent (see ``zebra.splits``): several rows can share a claim or an
abstract. A row-level bootstrap would therefore understate variance. ``bootstrap_ci_by_component``
resamples whole components (as given by a caller-supplied ``component_ids`` sequence, one id per
row — typically ``zebra.splits.build_components``'s output) rather than individual rows.
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
    "multiclass_brier",
    "ece_equal_mass",
    "bootstrap_ci_by_component",
    "bootstrap_macro_f1_ci",
    "bootstrap_balanced_accuracy_ci",
    "abstention_and_selective_error",
    "fit_temperature",
    "apply_temperature",
    "majority_class_label",
    "majority_class_probs",
    "lexical_overlap_baseline_predict",
    "DEFAULT_ABSTENTION_THRESHOLDS",
]

DEFAULT_ABSTENTION_THRESHOLDS: tuple[float, ...] = (0.50, 0.60, 0.70, 0.80)


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
            raise MetricsError(f"{arg_name}: unrecognized label {lbl!r}; expected one of {tuple(class_names)}")


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


def _argmax_and_confidence(prob_row: Sequence[float], class_names: Sequence[str]) -> tuple[str, float]:
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
        result[cls] = {"precision": precision, "recall": recall, "f1": f1, "support": float(support)}
    return result


def macro_f1(per_class: Mapping[str, Mapping[str, float]]) -> float:
    if not per_class:
        raise MetricsError("per_class is empty; nothing to average")
    return sum(v["f1"] for v in per_class.values()) / len(per_class)


def balanced_accuracy(cm: Sequence[Sequence[int]], class_names: Sequence[str] = CLASS_NAMES) -> float:
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


# --- Brier score -----------------------------------------------------------------------------


def multiclass_brier(
    y_true: Sequence[str], probs: Sequence[Sequence[float]], class_names: Sequence[str] = CLASS_NAMES
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
        accuracy = sum(corrects) / len(corrects)
        bins.append(
            {
                "bin_index": b,
                "n": len(chunk),
                "mean_confidence": mean_conf,
                "accuracy": accuracy,
                "confidence_lo": confidences[0],
                "confidence_hi": confidences[-1],
            }
        )
        ece += (len(chunk) / n) * abs(accuracy - mean_conf)

    return {"ece": ece, "n_bins": actual_bins, "bins": bins}


# --- bootstrap CI, resampled by component --------------------------------------------------------


def bootstrap_ci_by_component(
    metric_fn: Callable[[list[int]], float],
    component_ids: Sequence[object],
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """95% (by default) bootstrap CI for whatever ``metric_fn`` computes, resampled by whole
    *component* (e.g. the connected claim/abstract components from ``zebra.splits``) rather than
    by row — sampling components with replacement and including every row of a sampled
    component together, so a component is never split across the resampled set.

    ``metric_fn`` receives a list of row-indices (into the same order as ``component_ids``, with
    repeats when a component is drawn more than once) and must return a single float.
    """
    _check_nonempty("component_ids", component_ids)
    if n_resamples < 1:
        raise MetricsError(f"n_resamples must be >= 1, got {n_resamples}")
    if not (0.0 < alpha < 1.0):
        raise MetricsError(f"alpha must be in (0, 1), got {alpha}")

    rows_by_component: dict[object, list[int]] = {}
    for idx, cid in enumerate(component_ids):
        rows_by_component.setdefault(cid, []).append(idx)
    component_keys = list(rows_by_component.keys())

    point = metric_fn(list(range(len(component_ids))))

    rng = random.Random(seed)
    n_components = len(component_keys)
    boot_values = []
    for _ in range(n_resamples):
        resampled_indices: list[int] = []
        for _ in range(n_components):
            key = component_keys[rng.randrange(n_components)]
            resampled_indices.extend(rows_by_component[key])
        boot_values.append(metric_fn(resampled_indices))

    boot_values.sort()
    lo_i = max(0, min(n_resamples - 1, int((alpha / 2) * n_resamples)))
    hi_i = max(0, min(n_resamples - 1, int((1 - alpha / 2) * n_resamples) - 1))
    return {
        "point": point,
        "ci_lo": boot_values[lo_i],
        "ci_hi": boot_values[hi_i],
        "n_resamples": n_resamples,
        "n_components": n_components,
        "alpha": alpha,
    }


def bootstrap_macro_f1_ci(
    y_true: Sequence[str],
    y_pred: Sequence[str],
    component_ids: Sequence[object],
    class_names: Sequence[str] = CLASS_NAMES,
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """Convenience wrapper: component-resampled bootstrap CI for macro F1."""
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, y_pred=y_pred, component_ids=component_ids)
    y_true = list(y_true)
    y_pred = list(y_pred)

    def metric_fn(indices: list[int]) -> float:
        cm = confusion_matrix([y_true[i] for i in indices], [y_pred[i] for i in indices], class_names)
        return macro_f1(per_class_prf1(cm, class_names))

    return bootstrap_ci_by_component(metric_fn, component_ids, n_resamples, seed, alpha)


def bootstrap_balanced_accuracy_ci(
    y_true: Sequence[str],
    y_pred: Sequence[str],
    component_ids: Sequence[object],
    class_names: Sequence[str] = CLASS_NAMES,
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> dict[str, float]:
    """Convenience wrapper: component-resampled bootstrap CI for balanced accuracy."""
    _check_nonempty("y_true", y_true)
    _check_same_length(y_true=y_true, y_pred=y_pred, component_ids=component_ids)
    y_true = list(y_true)
    y_pred = list(y_pred)

    def metric_fn(indices: list[int]) -> float:
        cm = confusion_matrix([y_true[i] for i in indices], [y_pred[i] for i in indices], class_names)
        return balanced_accuracy(cm, class_names)

    return bootstrap_ci_by_component(metric_fn, component_ids, n_resamples, seed, alpha)


# --- abstention coverage / selective error -------------------------------------------------------


def abstention_and_selective_error(
    y_true: Sequence[str],
    probs: Sequence[Sequence[float]],
    class_names: Sequence[str] = CLASS_NAMES,
    thresholds: Sequence[float] = DEFAULT_ABSTENTION_THRESHOLDS,
) -> dict[float, dict]:
    """For each confidence threshold: coverage (fraction of rows where max-prob >= threshold,
    i.e. the model would "answer" rather than abstain) and selective error (error rate among the
    answered rows only; ``None`` — not 0.0 — when no row clears the threshold)."""
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
        coverage = answered / n
        selective_error = (errors / answered) if answered > 0 else None
        results[t] = {
            "threshold": t,
            "coverage": coverage,
            "selective_error": selective_error,
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


# --- baselines: majority-class and deterministic lexical-overlap ---------------------------------


def majority_class_label(train_labels: Sequence[str], class_names: Sequence[str] = CLASS_NAMES) -> str:
    """The most frequent label in ``train_labels``, ties broken alphabetically for
    determinism. A baseline exists so the real model has something concrete to beat — this
    function is not, and must never be reported as, a classifier."""
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


_SIMPLE_TOKEN_RE = None  # set lazily below to avoid a module-level `re` compile if unused


def _simple_tokens(text: str) -> set[str]:
    global _SIMPLE_TOKEN_RE
    if _SIMPLE_TOKEN_RE is None:
        import re

        _SIMPLE_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*")
    return {t.lower() for t in _SIMPLE_TOKEN_RE.findall(text)}


_NEGATION_TOKENS: frozenset = frozenset(
    {
        "not",
        "no",
        "none",
        "cannot",
        "can't",
        "won't",
        "doesn't",
        "didn't",
        "isn't",
        "aren't",
        "wasn't",
        "weren't",
        "fails",
        "failed",
        "fail",
        "lack",
        "lacks",
        "lacking",
        "absence",
        "without",
        "unable",
        "never",
        "insufficient",
    }
)

_LOW_OVERLAP_THRESHOLD = 0.2


def lexical_overlap_baseline_predict(claim_text: str, evidence_text: str) -> str:
    """A deterministic, non-learned baseline: NOT a serious entailment classifier, just a simple
    token-overlap + negation-cue heuristic that gives the real model something concrete (and
    weak) to beat.

    Rules, in order:
      1. no evidence text at all -> ``insufficient_evidence``;
      2. token overlap between claim and evidence below a low fixed threshold ->
         ``insufficient_evidence`` (the evidence doesn't look like it's even about the claim);
      3. a negation cue appears in exactly one of {claim, evidence} (asymmetric) ->
         ``contradicted`` (a crude proxy for "evidence negates the claim" or vice versa);
      4. otherwise -> ``supported``.
    """
    claim_tokens = _simple_tokens(claim_text)
    evidence_tokens = _simple_tokens(evidence_text)

    if not evidence_tokens:
        return "insufficient_evidence"

    overlap = len(claim_tokens & evidence_tokens) / len(claim_tokens) if claim_tokens else 0.0
    if overlap < _LOW_OVERLAP_THRESHOLD:
        return "insufficient_evidence"

    claim_has_negation = bool(_NEGATION_TOKENS & claim_tokens)
    evidence_has_negation = bool(_NEGATION_TOKENS & evidence_tokens)
    if claim_has_negation != evidence_has_negation:
        return "contradicted"

    return "supported"
