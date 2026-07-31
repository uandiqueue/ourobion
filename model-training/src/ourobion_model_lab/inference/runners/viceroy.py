"""Viceroy v0 research runner — native four-class causal-language over one sentence.

Viceroy's output space is read from the shipped checkpoint:

    no_relationship | direct_causal | conditional_causal | correlational

Issue #266 specified the fourth class as `mechanistic` and required the runner
never to manufacture it. The release actually contains no `mechanistic` class —
its `config.json` (downloaded and hash-checked against the frozen manifest at
release `sha256-751fbf1f…`) declares the four names above. The issue's
description was written from the training plan, not the shipped artifact.

So the requirement is satisfied structurally rather than behaviourally:
`mechanistic` is not in the closed label set, so no threshold, tie-break or
rounding rule could emit it even if one existed.

The distinction this model actually draws is between **direct** and
**conditional** causal language, which is a finer claim than "causal", and
`no_relationship` is its null class rather than a generic "none". Anything
consuming these predictions must use the checkpoint's meanings, not the
plan's.
"""

from __future__ import annotations

from typing import Any

from ..acquire import AcquiredModel
from ..schemas import VICEROY_LABELS, InputRow, PredictionRow
from ._engine import MAX_SEQUENCE_TOKENS, run_sequence_classification

MODEL_KEY = "viceroy-v0"

# Variants that unambiguously mean one of the four real classes. Deliberately
# conservative: nothing here collapses `direct_causal` and `conditional_causal`
# onto a shared "causal" bucket, because the whole point of the model is that
# they are different claims. A bare "causal" is therefore NOT aliased — it would
# have to pick one, and picking is exactly what this table must not do.
LABEL_ALIASES: dict[str, str] = {
    "no_relation": "no_relationship",
    "none": "no_relationship",
    "no_claim": "no_relationship",
    "direct_causation": "direct_causal",
    "direct": "direct_causal",
    "conditional_causation": "conditional_causal",
    "conditional": "conditional_causal",
    "correlation": "correlational",
    "correlative": "correlational",
    "association": "correlational",
    "associational": "correlational",
}


def _encode(tokenizer: Any, batch: list[InputRow]) -> Any:
    return tokenizer(
        [row.text_for("conclusion_sentence") for row in batch],
        padding=True,
        truncation=True,
        max_length=MAX_SEQUENCE_TOKENS,
        return_tensors="pt",
    )


def predict(acquired: AcquiredModel, rows: list[InputRow]) -> list[PredictionRow]:
    return run_sequence_classification(
        acquired,
        rows,
        model_key=MODEL_KEY,
        declared_labels=VICEROY_LABELS,
        aliases=LABEL_ALIASES,
        encode=_encode,
    )
