"""Input/output schema strictness, bounds, and model-native label invariants."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.inference.schemas import (
    MAX_TEXT_CHARS,
    VICEROY_ABSENT_LABEL,
    VICEROY_LABELS,
    ZEBRA_LABELS,
    InputSchemaError,
    OutputSchemaError,
    PredictionRow,
    load_input_manifest,
    validate_prediction,
    write_predictions,
)

ZEBRA_ROW = {
    "row_id": "r1",
    "claim_text": "Fibre shortens transit time.",
    "evidence_text": "Transit time fell by four hours in the high-fibre arm.",
}


def _manifest(tmp: Path, rows: list[dict], name: str = "in.jsonl") -> Path:
    path = tmp / name
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8", newline="\n")
    return path


def _ok_prediction(**overrides) -> PredictionRow:
    base = dict(
        row_id="r1",
        status="ok",
        label="supported",
        logits=[2.0, 0.5, 0.1],
        probabilities=[0.7, 0.2, 0.1],
        label_order=list(ZEBRA_LABELS),
    )
    base.update(overrides)
    return PredictionRow(**base)


class TestInputManifest(unittest.TestCase):
    def test_valid_manifest_preserves_order(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            rows = [dict(ZEBRA_ROW, row_id=f"r{i}") for i in range(5)]
            loaded = load_input_manifest(_manifest(tmp, rows), model="zebra-v1")
            self.assertEqual([r.row_id for r in loaded], [f"r{i}" for i in range(5)])

    def test_duplicate_row_id_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = _manifest(tmp, [ZEBRA_ROW, ZEBRA_ROW])
            with self.assertRaises(InputSchemaError) as ctx:
                load_input_manifest(path, model="zebra-v1")
            self.assertIn("duplicate row_id", str(ctx.exception))

    def test_missing_field_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = _manifest(tmp, [{"row_id": "r1", "claim_text": "x"}])
            with self.assertRaises(InputSchemaError):
                load_input_manifest(path, model="zebra-v1")

    def test_unexpected_field_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = _manifest(tmp, [dict(ZEBRA_ROW, extra="smuggled")])
            with self.assertRaises(InputSchemaError) as ctx:
                load_input_manifest(path, model="zebra-v1")
            self.assertIn("unexpected field", str(ctx.exception))

    def test_over_long_text_is_refused_not_truncated(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            row = dict(ZEBRA_ROW, evidence_text="x" * (MAX_TEXT_CHARS + 1))
            path = _manifest(tmp, [row])
            with self.assertRaises(InputSchemaError) as ctx:
                load_input_manifest(path, model="zebra-v1")
            self.assertIn("refused rather than truncated", str(ctx.exception))

    def test_empty_field_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = _manifest(tmp, [dict(ZEBRA_ROW, claim_text="   ")])
            with self.assertRaises(InputSchemaError):
                load_input_manifest(path, model="zebra-v1")

    def test_malformed_json_line_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "in.jsonl"
            path.write_text('{"row_id": "r1"\n', encoding="utf-8")
            with self.assertRaises(InputSchemaError):
                load_input_manifest(path, model="zebra-v1")

    def test_empty_manifest_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "in.jsonl"
            path.write_text("\n\n", encoding="utf-8")
            with self.assertRaises(InputSchemaError):
                load_input_manifest(path, model="zebra-v1")

    def test_missing_manifest_is_refused(self):
        with self.assertRaises(InputSchemaError):
            load_input_manifest("/nonexistent/in.jsonl", model="zebra-v1")

    def test_error_message_does_not_echo_row_text(self):
        secret = "UNIQUE-SENTINEL-TEXT-THAT-MUST-NOT-LEAK"
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            row = dict(ZEBRA_ROW, evidence_text=secret + "y" * MAX_TEXT_CHARS)
            path = _manifest(tmp, [row])
            with self.assertRaises(InputSchemaError) as ctx:
                load_input_manifest(path, model="zebra-v1")
            self.assertNotIn(secret, str(ctx.exception))


class TestTrackedSmokeManifests(unittest.TestCase):
    """The committed fixtures must actually satisfy the schema they ship with."""

    def _manifest_dir(self) -> Path:
        return Path(__file__).resolve().parents[1] / "inference-manifests"

    def test_zebra_smoke_manifest_loads(self):
        rows = load_input_manifest(self._manifest_dir() / "zebra-smoke-v1.jsonl", model="zebra-v1")
        self.assertGreaterEqual(len(rows), 3)

    def test_viceroy_smoke_manifest_loads(self):
        rows = load_input_manifest(
            self._manifest_dir() / "viceroy-smoke-v0.jsonl", model="viceroy-v0"
        )
        self.assertGreaterEqual(len(rows), 3)

    def test_manifests_are_not_cross_compatible(self):
        """A zebra manifest must not silently validate as viceroy input."""
        with self.assertRaises(InputSchemaError):
            load_input_manifest(self._manifest_dir() / "zebra-smoke-v1.jsonl", model="viceroy-v0")


class TestPredictionValidation(unittest.TestCase):
    def test_valid_prediction_passes(self):
        validate_prediction(_ok_prediction(), model="zebra-v1")

    def test_label_outside_native_space_is_refused(self):
        with self.assertRaises(OutputSchemaError) as ctx:
            validate_prediction(_ok_prediction(label="uncertain"), model="zebra-v1")
        self.assertIn("native label", str(ctx.exception))

    def test_label_must_be_the_argmax_of_its_own_distribution(self):
        """Guards the 'manufactured label' failure mode directly."""
        row = _ok_prediction(label="contradicted", probabilities=[0.7, 0.2, 0.1])
        with self.assertRaises(OutputSchemaError) as ctx:
            validate_prediction(row, model="zebra-v1")
        self.assertIn("argmax", str(ctx.exception))

    def test_mechanistic_is_not_a_viceroy_class_at_all(self):
        """Issue #266 assumed a `mechanistic` class; the checkpoint has none.

        The requirement "must never manufacture `mechanistic`" is therefore met
        structurally: it is outside the closed label set, so no threshold,
        tie-break or rounding rule could emit it.
        """
        self.assertNotIn(VICEROY_ABSENT_LABEL, VICEROY_LABELS)

    def test_viceroy_cannot_emit_mechanistic_even_as_its_own_argmax(self):
        row = PredictionRow(
            row_id="v1",
            status="ok",
            label=VICEROY_ABSENT_LABEL,
            logits=[0.1, 0.2, 2.0, 0.1],
            probabilities=[0.05, 0.1, 0.8, 0.05],
            label_order=list(VICEROY_LABELS),
        )
        with self.assertRaises(OutputSchemaError) as ctx:
            validate_prediction(row, model="viceroy-v0")
        self.assertIn("native label", str(ctx.exception))

    def test_viceroy_declares_the_shipped_checkpoint_classes(self):
        """Pinned to what release sha256-751fbf1f… actually declares in id2label."""
        self.assertEqual(
            VICEROY_LABELS,
            ("no_relationship", "direct_causal", "conditional_causal", "correlational"),
        )

    def test_viceroy_label_must_be_its_own_argmax(self):
        row = PredictionRow(
            row_id="v2",
            status="ok",
            label="correlational",
            logits=[1.0, 0.5, 0.2, 0.1],
            probabilities=[0.6, 0.2, 0.1, 0.1],
            label_order=list(VICEROY_LABELS),
        )
        with self.assertRaises(OutputSchemaError):
            validate_prediction(row, model="viceroy-v0")

    def test_wrong_label_order_is_refused(self):
        row = _ok_prediction(label_order=["contradicted", "supported", "insufficient_evidence"])
        with self.assertRaises(OutputSchemaError) as ctx:
            validate_prediction(row, model="zebra-v1")
        self.assertIn("label_order", str(ctx.exception))

    def test_probabilities_must_sum_to_one(self):
        with self.assertRaises(OutputSchemaError):
            validate_prediction(_ok_prediction(probabilities=[0.5, 0.2, 0.1]), model="zebra-v1")

    def test_probabilities_must_be_in_range(self):
        with self.assertRaises(OutputSchemaError):
            validate_prediction(_ok_prediction(probabilities=[1.4, -0.3, -0.1]), model="zebra-v1")

    def test_wrong_arity_is_refused(self):
        with self.assertRaises(OutputSchemaError):
            validate_prediction(_ok_prediction(logits=[1.0, 2.0]), model="zebra-v1")

    def test_error_row_requires_a_message(self):
        with self.assertRaises(OutputSchemaError):
            validate_prediction(PredictionRow(row_id="r", status="error"), model="zebra-v1")

    def test_error_row_with_message_passes(self):
        validate_prediction(
            PredictionRow(row_id="r", status="error", error="inference failed: RuntimeError"),
            model="zebra-v1",
        )


class TestWritePredictions(unittest.TestCase):
    def test_round_trip_is_deterministic_jsonl(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "nested" / "out.jsonl"
            count = write_predictions([_ok_prediction(row_id=f"r{i}") for i in range(3)], out)
            self.assertEqual(count, 3)
            lines = out.read_text(encoding="utf-8").strip().split("\n")
            self.assertEqual([json.loads(x)["row_id"] for x in lines], ["r0", "r1", "r2"])
            # Keys sorted, so byte-identical inputs produce byte-identical files.
            self.assertEqual(lines[0], json.dumps(json.loads(lines[0]), sort_keys=True))

    def test_error_rows_omit_label_fields(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "out.jsonl"
            write_predictions(
                [PredictionRow(row_id="r", status="error", error="inference failed: X")], out
            )
            payload = json.loads(out.read_text(encoding="utf-8").strip())
            self.assertNotIn("label", payload)
            self.assertIn("error", payload)


if __name__ == "__main__":
    unittest.main()
