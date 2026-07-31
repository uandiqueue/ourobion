"""Zebra v1 research runner — native three-class NLI over claim/evidence pairs.

Zebra's output space is `supported | contradicted | insufficient_evidence` and
**stops there**. It is not mapped onto `EdgeVerification.verdict`'s five-way
space anywhere in this package.

That restraint is the point of the whole runner. Zebra is `validated=false` and
`serving_ready=false`; a three-to-five mapping is a scientific decision about
how much an unvalidated NLI checkpoint is allowed to say about a research
claim, and it belongs to a reviewed serving gate with its own evidence. If the
mapping lived here, adding it to product would be one import away, and the
`validated=false` flag would be protecting nothing.
"""

from __future__ import annotations

from typing import Any

from ..acquire import AcquiredModel
from ..schemas import ZEBRA_LABELS, InputRow, PredictionRow
from ._engine import MAX_SEQUENCE_TOKENS, run_sequence_classification

MODEL_KEY = "zebra-v1"

# Checkpoint class names that mean one of our declared labels. Kept explicit and
# reviewable rather than fuzzy-matched: a wrong alias silently mislabels a whole
# run, so a name that is not listed here must fail and be added deliberately.
LABEL_ALIASES: dict[str, str] = {
    "entailment": "supported",
    "entail": "supported",
    "support": "supported",
    "supports": "supported",
    "contradiction": "contradicted",
    "contradict": "contradicted",
    "refutes": "contradicted",
    "refuted": "contradicted",
    "neutral": "insufficient_evidence",
    "nei": "insufficient_evidence",
    "not_enough_info": "insufficient_evidence",
    "not_enough_information": "insufficient_evidence",
    "insufficient": "insufficient_evidence",
}
# Note the absence of `label_0`/`label_1`/`label_2`. A checkpoint saved without
# real class names carries no information about which index is which, so those
# must stay unresolvable and fail loudly rather than be guessed.


def _encode(tokenizer: Any, batch: list[InputRow]) -> Any:
    """Encode claim/evidence as a sentence pair, in that order."""
    return tokenizer(
        [row.text_for("claim_text") for row in batch],
        [row.text_for("evidence_text") for row in batch],
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
        declared_labels=ZEBRA_LABELS,
        aliases=LABEL_ALIASES,
        encode=_encode,
    )
