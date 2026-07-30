"""Orchestration for one offline research-inference run.

Stdlib only at import time.

The order of operations is the safety property, so it is written once here and
not re-derived by callers:

    resolve pin -> authenticate checksum manifest -> validate input manifest
    -> list remote prefix -> download -> verify every digest -> load model
    -> predict -> validate every output row -> write -> delete the model bytes

Everything that can fail without touching the network fails first. In
particular the input manifest is fully validated *before* a ~420 MiB download
starts, so a typo in a fixture costs a second rather than a download.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..errors import ConfigError
from ..logging_utils import get_logger
from .acquire import AcquiredModel, acquire_release
from .r2 import R2Credentials, ReadOnlyR2Client, credentials_from_env
from .releases import load_release, registered_releases
from .schemas import (
    NATIVE_LABELS,
    InputRow,
    PredictionRow,
    load_input_manifest,
    validate_prediction,
    write_predictions,
)

_log = get_logger("ourobion_model_lab.inference")

# Stamped onto every result document. A reader who finds a prediction file
# months from now should not have to reconstruct what it was allowed to be used
# for from the surrounding directory.
SERVING_POSTURE = "research-only; not wired to verified_edges, cards, Supabase, nao or biotope"


@dataclass(frozen=True)
class InferenceResult:
    ok: bool
    model: str
    release_id: str
    input_manifest: str
    rows_in: int
    rows_ok: int
    rows_error: int
    label_counts: dict[str, int]
    output_path: str | None
    verified_bytes: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "model": self.model,
            "release_id": self.release_id,
            "input_manifest": self.input_manifest,
            "rows_in": self.rows_in,
            "rows_ok": self.rows_ok,
            "rows_error": self.rows_error,
            "label_counts": dict(self.label_counts),
            "output_path": self.output_path,
            "verified_bytes": self.verified_bytes,
            "serving": SERVING_POSTURE,
        }


Runner = Callable[[AcquiredModel, list[InputRow]], list[PredictionRow]]


def _runner_for(model: str) -> Runner:
    """Import the right runner lazily, so neither pulls Torch until it is used."""
    if model == "zebra-v1":
        from .runners import zebra  # noqa: PLC0415

        return zebra.predict
    if model == "viceroy-v0":
        from .runners import viceroy  # noqa: PLC0415

        return viceroy.predict
    raise ConfigError(
        f"no runner registered for {model!r}; registered releases are {list(registered_releases())}"
    )


def summarise(rows: list[PredictionRow], *, model: str) -> dict[str, int]:
    """Aggregate label counts — the non-sensitive evidence a workflow may report."""
    counts = {label: 0 for label in NATIVE_LABELS[model]}
    for row in rows:
        if row.status == "ok" and row.label in counts:
            counts[row.label] += 1
    return counts


def run_inference(
    *,
    model: str,
    input_manifest: str | Path,
    output_path: str | Path | None,
    credentials: R2Credentials | None = None,
    evidence_dir: Path | None = None,
    parent_dir: Path | None = None,
    client: ReadOnlyR2Client | None = None,
) -> InferenceResult:
    """Run one complete, verified, offline research-inference job.

    `client` exists so the orchestration order can be tested against an
    in-memory object store without a credential or a 400 MB download. It is not
    a bypass: whatever client is supplied still goes through the same
    `acquire_release` verification, which is where the safety lives. The CLI
    never passes one.
    """
    release = load_release(model, evidence_dir=evidence_dir)

    rows: list[InputRow] = load_input_manifest(input_manifest, model=model)
    _log.info(
        "inference start model=%s release=%s rows=%d",
        model,
        release.release_id,
        len(rows),
    )

    if client is None:
        client = ReadOnlyR2Client(credentials or credentials_from_env())
    runner = _runner_for(model)

    with acquire_release(release, client, parent_dir=parent_dir) as acquired:
        _log.info(
            "artifact verified model=%s files=%d bytes=%d",
            model,
            len(acquired.verified_files),
            acquired.total_bytes,
        )
        predictions = runner(acquired, rows)
        verified_bytes = acquired.total_bytes

    if len(predictions) != len(rows):
        raise ConfigError(
            f"runner returned {len(predictions)} rows for {len(rows)} inputs; a research "
            "prediction file must line up with its input manifest exactly"
        )
    for prediction in predictions:
        validate_prediction(prediction, model=model)

    written = None
    if output_path is not None:
        write_predictions(predictions, output_path)
        written = str(output_path)

    rows_ok = sum(1 for r in predictions if r.status == "ok")
    result = InferenceResult(
        ok=True,
        model=model,
        release_id=release.release_id,
        input_manifest=str(input_manifest),
        rows_in=len(rows),
        rows_ok=rows_ok,
        rows_error=len(predictions) - rows_ok,
        label_counts=summarise(predictions, model=model),
        output_path=written,
        verified_bytes=verified_bytes,
    )
    _log.info(
        "inference complete model=%s rows_ok=%d rows_error=%d",
        model,
        result.rows_ok,
        result.rows_error,
    )
    return result
