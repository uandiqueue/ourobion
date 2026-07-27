"""Pure-stdlib metrics and calibration reporting.

No numpy/sklearn dependency: these are deliberately simple reference
implementations so the offline test suite can exercise real arithmetic with
zero installed packages (D2). Model code with the `ml` extra installed may use
a faster/richer implementation (e.g. sklearn.metrics) instead -- this module
is the always-available fallback and the contract both must agree with.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

from .errors import MetricInputError


def accuracy(y_true: Sequence[str], y_pred: Sequence[str]) -> float:
    if len(y_true) != len(y_pred):
        raise MetricInputError("y_true and y_pred must be the same length")
    if not y_true:
        return 0.0
    # strict=True, not strict=False: the length check above already guarantees
    # equal lengths, so this can only fire if that guard is ever removed -- in
    # which case a loud error beats silently scoring the shorter prefix.
    correct = sum(1 for t, p in zip(y_true, y_pred, strict=True) if t == p)
    return correct / len(y_true)


def macro_f1(y_true: Sequence[str], y_pred: Sequence[str]) -> float:
    if len(y_true) != len(y_pred):
        raise MetricInputError("y_true and y_pred must be the same length")
    labels = sorted(set(y_true) | set(y_pred))
    if not labels:
        return 0.0
    scores = []
    for label in labels:
        tp = sum(1 for t, p in zip(y_true, y_pred, strict=True) if t == label and p == label)
        fp = sum(1 for t, p in zip(y_true, y_pred, strict=True) if t != label and p == label)
        fn = sum(1 for t, p in zip(y_true, y_pred, strict=True) if t == label and p != label)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        scores.append(f1)
    return sum(scores) / len(scores)


def expected_calibration_error(
    confidences: Sequence[float], correct: Sequence[bool], *, n_bins: int = 10
) -> float:
    """A reference (non-vectorized) expected-calibration-error implementation.

    `confidences` must be probabilities in [0, 1]. Passing raw logits (or
    anything else outside that range) raises MetricInputError rather than
    silently binning into the wrong bucket -- an out-of-range value used to
    index backwards (negatives) or crash with a raw IndexError (>1), and
    "I passed logits" is exactly the mistake MT1-MT5 are most likely to make.
    """
    if len(confidences) != len(correct):
        raise MetricInputError("confidences and correct must be the same length")
    if n_bins < 1:
        raise MetricInputError(f"n_bins must be >= 1, got {n_bins}")
    if not confidences:
        return 0.0
    out_of_range = [c for c in confidences if not 0.0 <= c <= 1.0]
    if out_of_range:
        raise MetricInputError(
            f"confidences must be probabilities in [0, 1]; got {len(out_of_range)} value(s) "
            f"outside that range (first: {out_of_range[0]!r}) -- did you pass logits or "
            "unnormalized scores instead of probabilities?"
        )
    bins: list[list[tuple[float, bool]]] = [[] for _ in range(n_bins)]
    for conf, is_correct in zip(confidences, correct, strict=True):  # see accuracy() on strict
        idx = min(int(conf * n_bins), n_bins - 1)
        bins[idx].append((conf, is_correct))
    total = len(confidences)
    ece = 0.0
    for bucket in bins:
        if not bucket:
            continue
        bucket_conf = sum(c for c, _ in bucket) / len(bucket)
        bucket_acc = sum(1 for _, ok in bucket if ok) / len(bucket)
        ece += (len(bucket) / total) * abs(bucket_conf - bucket_acc)
    return ece


@dataclass(frozen=True)
class EvaluationReport:
    model_name: str
    metrics: dict[str, float] = field(default_factory=dict)
    n_examples: int = 0
    notes: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, object]:
        return {
            "model_name": self.model_name,
            "metrics": dict(sorted(self.metrics.items())),
            "n_examples": self.n_examples,
            "notes": list(self.notes),
        }
