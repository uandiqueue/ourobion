"""Strict JSONL input/output schemas for offline research inference.

Stdlib only.

Every bound here is a refusal, not a truncation. Silently trimming an
over-long evidence passage would produce a prediction over text the caller
never saw, which is worse than no prediction: it looks like a result. So an
over-long field raises and the row is recorded as an explicit failure.

## Model-native outputs only

`RESULT` rows carry each model's own label space and nothing else:

- **Zebra** emits `supported | contradicted | insufficient_evidence`. It must
  never be mapped onto `EdgeVerification.verdict`'s five-way space here. The
  three-to-five mapping is a scientific decision that belongs to a reviewed
  serving gate, not to a research runner, and doing it here would let an
  unvalidated checkpoint reach product semantics by import.
- **Viceroy** emits `no_relationship | direct_causal | conditional_causal |
  correlational`, read from the shipped checkpoint's own `id2label`.

  Issue #266 described Viceroy's fourth class as `mechanistic` and required
  that the runner "must never manufacture `mechanistic`". The checkpoint at
  release `sha256-751fbf1f…` has **no such class**: its four classes are the
  ones above, verified by downloading and hash-checking its `config.json`
  against the frozen manifest. So the label space here is the checkpoint's, not
  the issue's, and `mechanistic` is unmanufacturable in the strongest possible
  sense — it is not in the closed set, so no code path can emit it. A test
  asserts that directly.

  Getting this wrong would have been invisible: the issue's four names would
  have mapped positionally onto four real classes and produced a completely
  well-formed prediction file in which every label was the wrong concept.

Both label spaces are closed sets, validated on the way out.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..errors import ConfigError, ModelLabError

# --------------------------------------------------------------------------
# Bounds. Chosen to be comfortably above any legitimate abstract-scale input
# and far below anything that would make a runner allocate unboundedly.
# --------------------------------------------------------------------------
MAX_ROWS = 10_000
MAX_ROW_ID_CHARS = 200
MAX_TEXT_CHARS = 8_000
MAX_LINE_BYTES = 64 * 1024

# Both tuples are in the checkpoints' own `id2label` index order, so the
# permutation built in runners/_engine.py is the identity for an unmodified
# release. That is a convenience, not an assumption: the permutation is still
# resolved by name, and a reordered checkpoint would be handled correctly.
ZEBRA_LABELS: tuple[str, ...] = ("supported", "contradicted", "insufficient_evidence")
VICEROY_LABELS: tuple[str, ...] = (
    "no_relationship",
    "direct_causal",
    "conditional_causal",
    "correlational",
)

# Not a Viceroy class. Named here so the guard against re-introducing it is
# greppable from the label definitions themselves.
VICEROY_ABSENT_LABEL = "mechanistic"

# Which input fields each model's rows must carry, in the order a runner sees them.
INPUT_FIELDS: dict[str, tuple[str, ...]] = {
    "zebra-v1": ("claim_text", "evidence_text"),
    "viceroy-v0": ("conclusion_sentence",),
}

NATIVE_LABELS: dict[str, tuple[str, ...]] = {
    "zebra-v1": ZEBRA_LABELS,
    "viceroy-v0": VICEROY_LABELS,
}


class InputSchemaError(ModelLabError):
    """An input manifest row is absent, malformed, out of bounds, or duplicated."""


class OutputSchemaError(ModelLabError):
    """A runner produced a row that violates its own model-native contract."""


@dataclass(frozen=True)
class InputRow:
    """One validated input row. `fields` holds only the model's declared inputs."""

    row_id: str
    fields: dict[str, str]

    def text_for(self, name: str) -> str:
        return self.fields[name]


@dataclass(frozen=True)
class PredictionRow:
    """One model-native research prediction, or an explicit per-row failure."""

    row_id: str
    status: str  # "ok" | "error"
    label: str | None = None
    logits: list[float] | None = None
    probabilities: list[float] | None = None
    label_order: list[str] | None = None
    error: str | None = None
    model_identity: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "row_id": self.row_id,
            "status": self.status,
            "model_identity": dict(self.model_identity),
        }
        if self.status == "ok":
            payload.update(
                {
                    "label": self.label,
                    "label_order": list(self.label_order or []),
                    "logits": list(self.logits or []),
                    "probabilities": list(self.probabilities or []),
                }
            )
        else:
            payload["error"] = self.error
        return payload


def _require_str(value: Any, *, field_name: str, row_index: int, max_chars: int) -> str:
    if not isinstance(value, str):
        raise InputSchemaError(
            f"row {row_index}: field {field_name!r} must be a string, got {type(value).__name__}"
        )
        # Note: the row's own text is deliberately not echoed into this message.
    stripped = value.strip()
    if not stripped:
        raise InputSchemaError(f"row {row_index}: field {field_name!r} is empty or whitespace-only")
    if len(value) > max_chars:
        raise InputSchemaError(
            f"row {row_index}: field {field_name!r} is {len(value)} characters, over the "
            f"{max_chars} limit. The row is refused rather than truncated — a prediction over "
            "silently trimmed text would misrepresent what was actually scored."
        )
    return stripped


def load_input_manifest(path: str | Path, *, model: str) -> list[InputRow]:
    """Read and strictly validate a frozen JSONL input manifest.

    Ordering is preserved exactly as written, and `row_id` must be unique, so a
    prediction file can be joined back to its inputs deterministically.
    """
    expected_fields = INPUT_FIELDS.get(model)
    if expected_fields is None:
        raise ConfigError(f"no input schema registered for model {model!r}")

    p = Path(path)
    if not p.is_file():
        raise InputSchemaError(f"input manifest not found: {p}")

    rows: list[InputRow] = []
    seen: set[str] = set()

    with open(p, "rb") as fh:
        for row_index, raw in enumerate(fh, start=1):
            if not raw.strip():
                continue
            if len(raw) > MAX_LINE_BYTES:
                raise InputSchemaError(
                    f"row {row_index}: line is {len(raw)} bytes, over the {MAX_LINE_BYTES} limit"
                )
            if len(rows) >= MAX_ROWS:
                raise InputSchemaError(
                    f"input manifest has more than {MAX_ROWS} rows; refusing an unbounded run"
                )
            try:
                obj = json.loads(raw.decode("utf-8"))
            except UnicodeDecodeError as exc:
                raise InputSchemaError(f"row {row_index}: line is not valid UTF-8") from exc
            except json.JSONDecodeError as exc:
                raise InputSchemaError(
                    f"row {row_index}: line is not valid JSON: {exc.msg}"
                ) from exc

            if not isinstance(obj, dict):
                raise InputSchemaError(f"row {row_index}: each line must be a JSON object")

            row_id = _require_str(
                obj.get("row_id"),
                field_name="row_id",
                row_index=row_index,
                max_chars=MAX_ROW_ID_CHARS,
            )
            if row_id in seen:
                raise InputSchemaError(
                    f"row {row_index}: duplicate row_id {row_id!r}; row ids must be unique so "
                    "predictions can be joined back to inputs unambiguously"
                )
            seen.add(row_id)

            fields: dict[str, str] = {}
            for name in expected_fields:
                fields[name] = _require_str(
                    obj.get(name), field_name=name, row_index=row_index, max_chars=MAX_TEXT_CHARS
                )

            unexpected = set(obj) - {"row_id", *expected_fields}
            if unexpected:
                raise InputSchemaError(
                    f"row {row_index}: unexpected field(s) {sorted(unexpected)}; the {model!r} "
                    f"input schema is {['row_id', *expected_fields]}. Unknown fields are refused "
                    "so a manifest cannot smuggle unreviewed content past the guards."
                )

            rows.append(InputRow(row_id=row_id, fields=fields))

    if not rows:
        raise InputSchemaError(f"input manifest {p} contains no rows")
    return rows


def validate_prediction(row: PredictionRow, *, model: str) -> None:
    """Raise OutputSchemaError unless a prediction honours its model-native contract."""
    labels = NATIVE_LABELS.get(model)
    if labels is None:
        raise ConfigError(f"no label space registered for model {model!r}")

    if row.status not in ("ok", "error"):
        raise OutputSchemaError(f"row {row.row_id!r}: status must be 'ok' or 'error'")

    if row.status == "error":
        if not row.error:
            raise OutputSchemaError(
                f"row {row.row_id!r}: an error row must carry an 'error' string"
            )
        return

    if row.label not in labels:
        raise OutputSchemaError(
            f"row {row.row_id!r}: label {row.label!r} is outside the {model!r} native label "
            f"space {list(labels)}. Model-native labels only — no mapping onto product verdicts."
        )
    if list(row.label_order or []) != list(labels):
        raise OutputSchemaError(
            f"row {row.row_id!r}: label_order must be exactly {list(labels)} so logits and "
            "probabilities are interpretable without guessing the class order"
        )
    for name, values in (("logits", row.logits), ("probabilities", row.probabilities)):
        if values is None or len(values) != len(labels):
            raise OutputSchemaError(
                f"row {row.row_id!r}: {name} must have exactly {len(labels)} entries"
            )
        if any(not isinstance(v, float) for v in values):
            raise OutputSchemaError(f"row {row.row_id!r}: {name} must be floats")
    probs = list(row.probabilities or [])
    if any(p < 0.0 or p > 1.0 for p in probs):
        raise OutputSchemaError(f"row {row.row_id!r}: probabilities must lie in [0, 1]")
    if abs(sum(probs) - 1.0) > 1e-3:
        raise OutputSchemaError(
            f"row {row.row_id!r}: probabilities sum to {sum(probs):.6f}, not 1.0"
        )
    argmax_label = labels[max(range(len(probs)), key=probs.__getitem__)]
    if argmax_label != row.label:
        raise OutputSchemaError(
            f"row {row.row_id!r}: label {row.label!r} is not the argmax of the reported "
            f"probabilities ({argmax_label!r}). A label that disagrees with its own "
            "distribution would let a class be asserted the model did not actually pick."
        )


def write_predictions(rows: Iterator[PredictionRow] | list[PredictionRow], path: str | Path) -> int:
    """Write predictions as JSONL in the order given. Returns the row count."""
    count = 0
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            fh.write(json.dumps(row.to_dict(), sort_keys=True) + "\n")
            count += 1
    return count
