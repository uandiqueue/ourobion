"""Shared sequence-classification engine for the research runners.

**Torch and Transformers are imported inside functions here, never at module
scope.** That is not style: `model-training-core` is a zero-install CI job, and
a module-level `import torch` would break every stdlib-only test that merely
touches this package. `tests/test_inference_imports.py` asserts the property
directly rather than trusting review to catch a regression.

## Label order is read from the checkpoint, never assumed

The tempting shortcut is to treat output index 0 as the first label in our
declared order. That is wrong whenever the checkpoint was trained with a
different class ordering, and it fails *silently* — every prediction comes back
confidently mislabelled, and nothing in the output looks unusual.

So the engine reads `id2label` from the release's own `config.json` and builds
an explicit index permutation onto the declared native order. If the checkpoint
names classes this module cannot resolve, it raises and names exactly what it
found, rather than falling back to positional order.
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from ...errors import ConfigError
from ..acquire import AcquiredModel
from ..schemas import InputRow, PredictionRow, validate_prediction

# Inference is deliberately single-threaded and batch-1-friendly; determinism and
# auditability matter far more here than throughput over a smoke manifest.
DEFAULT_BATCH_SIZE = 8
MAX_SEQUENCE_TOKENS = 512


def _normalise_label(raw: str) -> str:
    return str(raw).strip().casefold().replace("-", "_").replace(" ", "_")


def build_label_permutation(
    id2label: dict[Any, Any],
    *,
    declared: Sequence[str],
    aliases: dict[str, str],
) -> list[int]:
    """Map declared label order onto checkpoint output indices.

    Returns a list `perm` where `perm[i]` is the checkpoint's output index for
    `declared[i]`. Raises ConfigError if the checkpoint's classes cannot be
    resolved onto the declared set — never guesses.
    """
    resolved: dict[str, int] = {}
    unresolved: dict[str, str] = {}
    for raw_index, raw_label in id2label.items():
        try:
            index = int(raw_index)
        except (TypeError, ValueError) as exc:
            raise ConfigError(f"checkpoint id2label key {raw_index!r} is not an integer") from exc
        key = _normalise_label(raw_label)
        canonical = aliases.get(key, key)
        if canonical in declared:
            if canonical in resolved:
                raise ConfigError(
                    f"checkpoint maps two output indices onto {canonical!r}; the class order "
                    "is ambiguous, so no permutation is safe"
                )
            resolved[canonical] = index
        else:
            unresolved[str(raw_label)] = canonical

    missing = [name for name in declared if name not in resolved]
    if missing:
        raise ConfigError(
            f"checkpoint class names could not be resolved onto the declared label space. "
            f"Missing {missing}; unresolved checkpoint labels were {unresolved or '{}'}. "
            "Refusing to assume positional order — a wrong permutation mislabels every row "
            "while looking completely normal. Add the correct alias to the runner instead."
        )
    if len(resolved) != len(declared):  # pragma: no cover - implied by the checks above
        raise ConfigError("label permutation is not a bijection onto the declared labels")
    return [resolved[name] for name in declared]


def _softmax(values: list[float]) -> list[float]:
    peak = max(values)
    exps = [math.exp(v - peak) for v in values]
    total = sum(exps)
    return [e / total for e in exps]


def run_sequence_classification(
    acquired: AcquiredModel,
    rows: list[InputRow],
    *,
    model_key: str,
    declared_labels: Sequence[str],
    aliases: dict[str, str],
    encode: Callable[[Any, list[InputRow]], Any],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[PredictionRow]:
    """Score `rows` with the acquired checkpoint, emitting model-native rows only.

    Ordering of the returned list matches `rows` exactly.
    """
    # Lazy on purpose — see the module docstring.
    import torch  # noqa: PLC0415
    from transformers import AutoModelForSequenceClassification, AutoTokenizer  # noqa: PLC0415

    model_dir = acquired.directory
    identity = acquired.release.identity()

    config_raw = json.loads((Path(model_dir) / "config.json").read_text(encoding="utf-8"))
    id2label = config_raw.get("id2label")
    if not isinstance(id2label, dict) or not id2label:
        raise ConfigError(
            f"release {acquired.release.release_id} has no usable id2label in config.json; "
            "the class order cannot be established, so no prediction is emitted"
        )
    permutation = build_label_permutation(id2label, declared=declared_labels, aliases=aliases)

    if len(id2label) != len(declared_labels):
        raise ConfigError(
            f"checkpoint exposes {len(id2label)} classes but {model_key!r} declares "
            f"{len(declared_labels)}; refusing to score against a mismatched head"
        )

    # local_files_only everywhere: a missing file must fail, never silently
    # trigger a Hub download of a different checkpoint.
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        str(model_dir), local_files_only=True
    )
    model.eval()

    predictions: list[PredictionRow] = []
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        try:
            encoded = encode(tokenizer, batch)
            with torch.no_grad():
                output = model(**encoded)
            batch_logits = output.logits.detach().cpu().tolist()
        except Exception as exc:  # noqa: BLE001 - one bad batch must not lose the run
            # The row's own text is never echoed into the error, only the type.
            for row in batch:
                predictions.append(
                    PredictionRow(
                        row_id=row.row_id,
                        status="error",
                        error=f"inference failed: {type(exc).__name__}",
                        model_identity=identity,
                    )
                )
            continue

        for row, raw_logits in zip(batch, batch_logits, strict=False):
            ordered_logits = [float(raw_logits[i]) for i in permutation]
            probabilities = _softmax(ordered_logits)
            label = declared_labels[max(range(len(probabilities)), key=probabilities.__getitem__)]
            prediction = PredictionRow(
                row_id=row.row_id,
                status="ok",
                label=label,
                logits=ordered_logits,
                probabilities=probabilities,
                label_order=list(declared_labels),
                model_identity=identity,
            )
            validate_prediction(prediction, model=model_key)
            predictions.append(prediction)

    return predictions
