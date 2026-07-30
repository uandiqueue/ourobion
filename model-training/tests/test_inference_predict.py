"""End-to-end orchestration, offline.

This is the "tiny-fixture smoke path that does not need real weights or R2"
from issue #266 §4. It exercises the real `run_inference` — release
resolution, manifest authentication, input validation, listing, download,
per-file hashing, output validation, writing and cleanup — against an
in-memory object store and a stub runner. Only the Torch forward pass is
substituted; every guard on either side of it is the production code path.
"""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ourobion_model_lab.errors import ConfigError
from ourobion_model_lab.inference import predict as predict_module
from ourobion_model_lab.inference.predict import run_inference, summarise
from ourobion_model_lab.inference.releases import EXPECTED_BUNDLE_FILENAMES, RELEASE_PINS
from ourobion_model_lab.inference.schemas import (
    ZEBRA_LABELS,
    InputSchemaError,
    OutputSchemaError,
    PredictionRow,
)

BUNDLE = {name: f"contents-of-{name}".encode() for name in EXPECTED_BUNDLE_FILENAMES}
DIGESTS = {name: hashlib.sha256(body).hexdigest() for name, body in BUNDLE.items()}


class FakeClient:
    def __init__(self, prefix: str):
        self.objects = {prefix + name: body for name, body in BUNDLE.items()}
        self.prefix = prefix

    def list_prefix(self, prefix: str) -> list[str]:
        return sorted(k for k in self.objects if k.startswith(prefix))

    def download(self, key: str, dest: Path) -> int:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(self.objects[key])
        return len(self.objects[key])


def _stub_runner(acquired, rows):
    """A deterministic stand-in for the Torch forward pass."""
    identity = acquired.release.identity()
    out = []
    for index, row in enumerate(rows):
        probs = [0.6, 0.3, 0.1] if index % 2 == 0 else [0.2, 0.7, 0.1]
        label = ZEBRA_LABELS[max(range(3), key=probs.__getitem__)]
        out.append(
            PredictionRow(
                row_id=row.row_id,
                status="ok",
                label=label,
                logits=[float(p) for p in probs],
                probabilities=list(probs),
                label_order=list(ZEBRA_LABELS),
                model_identity=identity,
            )
        )
    return out


class _Harness(unittest.TestCase):
    """Patches the pin's digests/sizes onto the synthetic bundle."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

        real_pin = RELEASE_PINS["zebra-v1"]
        manifest_lines = [f"{DIGESTS[name]}  {name}" for name in EXPECTED_BUNDLE_FILENAMES]
        manifest_text = "\n".join(manifest_lines) + "\n"
        evidence = self.root / "evidence" / "zebra-v1"
        evidence.mkdir(parents=True)
        (evidence / "local-bundle-sha256sums.txt").write_text(manifest_text, encoding="utf-8")

        # The release id IS the manifest digest, so the synthetic pin must carry
        # the synthetic manifest's own hash — the same binding production uses.
        digest = hashlib.sha256(manifest_text.encode("utf-8")).hexdigest()
        self.pin = type(real_pin)(
            model="zebra-v1",
            version="v1",
            release_id=f"sha256-{digest}",
            evidence_dirname="zebra-v1",
            weights_filename="pytorch_model.bin",
            weights_size_bytes=len(BUNDLE["pytorch_model.bin"]),
            bundle_size_bytes=sum(len(v) for v in BUNDLE.values()),
        )
        patcher = mock.patch.dict(RELEASE_PINS, {"zebra-v1": self.pin})
        patcher.start()
        self.addCleanup(patcher.stop)

        self.client = FakeClient(self.pin.object_prefix)
        self.manifest = self.root / "in.jsonl"
        self.manifest.write_text(
            "".join(
                json.dumps(
                    {
                        "row_id": f"r{i}",
                        "claim_text": f"claim {i}",
                        "evidence_text": f"evidence {i}",
                    }
                )
                + "\n"
                for i in range(4)
            ),
            encoding="utf-8",
        )

    def _run(self, **kwargs):
        with mock.patch.object(predict_module, "_runner_for", return_value=_stub_runner):
            return run_inference(
                model="zebra-v1",
                input_manifest=self.manifest,
                evidence_dir=self.root / "evidence",
                client=self.client,
                parent_dir=self.root,
                **kwargs,
            )


class TestOfflineSmoke(_Harness):
    def test_full_run_produces_validated_predictions(self):
        out = self.root / "out.jsonl"
        result = self._run(output_path=out)

        self.assertTrue(result.ok)
        self.assertEqual(result.rows_in, 4)
        self.assertEqual(result.rows_ok, 4)
        self.assertEqual(result.rows_error, 0)
        self.assertEqual(result.release_id, self.pin.release_id)
        self.assertEqual(sum(result.label_counts.values()), 4)

        lines = out.read_text(encoding="utf-8").strip().split("\n")
        self.assertEqual(len(lines), 4)
        payloads = [json.loads(x) for x in lines]
        self.assertEqual([p["row_id"] for p in payloads], ["r0", "r1", "r2", "r3"])
        for payload in payloads:
            self.assertIn(payload["label"], ZEBRA_LABELS)
            self.assertEqual(payload["model_identity"]["release_id"], self.pin.release_id)

    def test_output_is_optional(self):
        result = self._run(output_path=None)
        self.assertIsNone(result.output_path)
        self.assertEqual(result.rows_ok, 4)

    def test_result_document_declares_research_only_posture(self):
        result = self._run(output_path=None)
        self.assertIn("research-only", result.to_dict()["serving"])

    def test_model_bytes_do_not_survive_the_run(self):
        self._run(output_path=None)
        leftovers = [p.name for p in self.root.iterdir() if p.name.startswith("ourobion-")]
        self.assertEqual(leftovers, [], msg=f"temp model dirs survived: {leftovers}")

    def test_predictions_never_carry_a_product_verdict_vocabulary(self):
        """Model-native labels only — no five-way EdgeVerification vocabulary."""
        out = self.root / "out.jsonl"
        self._run(output_path=out)
        text = out.read_text(encoding="utf-8")
        for product_term in ("agree", "disagree", "uncertain", "unsupported", "verdict"):
            self.assertNotIn(product_term, text)


class TestOrchestrationOrdering(_Harness):
    def test_bad_input_manifest_fails_before_any_download(self):
        """A fixture typo must not cost a 400 MB download."""
        self.manifest.write_text('{"row_id": "r1"}\n', encoding="utf-8")
        downloaded: list[str] = []
        original = self.client.download

        def spy(key, dest):
            downloaded.append(key)
            return original(key, dest)

        self.client.download = spy  # type: ignore[method-assign]
        with self.assertRaises(InputSchemaError):
            self._run(output_path=None)
        self.assertEqual(downloaded, [])

    def test_runner_row_count_mismatch_is_refused(self):
        def short_runner(acquired, rows):
            return _stub_runner(acquired, rows)[:-1]

        with mock.patch.object(predict_module, "_runner_for", return_value=short_runner):
            with self.assertRaises(ConfigError) as ctx:
                run_inference(
                    model="zebra-v1",
                    input_manifest=self.manifest,
                    output_path=None,
                    evidence_dir=self.root / "evidence",
                    client=self.client,
                    parent_dir=self.root,
                )
        self.assertIn("must line up with its input manifest", str(ctx.exception))

    def test_invalid_runner_output_is_refused(self):
        def bad_runner(acquired, rows):
            identity = acquired.release.identity()
            return [
                PredictionRow(
                    row_id=row.row_id,
                    status="ok",
                    label="agree",  # not in the native label space
                    logits=[1.0, 0.0, 0.0],
                    probabilities=[1.0, 0.0, 0.0],
                    label_order=list(ZEBRA_LABELS),
                    model_identity=identity,
                )
                for row in rows
            ]

        with mock.patch.object(predict_module, "_runner_for", return_value=bad_runner):
            with self.assertRaises(OutputSchemaError):
                run_inference(
                    model="zebra-v1",
                    input_manifest=self.manifest,
                    output_path=None,
                    evidence_dir=self.root / "evidence",
                    client=self.client,
                    parent_dir=self.root,
                )


class TestSummarise(unittest.TestCase):
    def test_counts_cover_every_native_label(self):
        counts = summarise([], model="zebra-v1")
        self.assertEqual(sorted(counts), sorted(ZEBRA_LABELS))
        self.assertEqual(set(counts.values()), {0})

    def test_error_rows_are_not_counted_as_labels(self):
        rows = [PredictionRow(row_id="r", status="error", error="inference failed: X")]
        self.assertEqual(sum(summarise(rows, model="zebra-v1").values()), 0)


class TestRunnerRegistration(unittest.TestCase):
    def test_unknown_model_has_no_runner(self):
        with self.assertRaises(ConfigError):
            predict_module._runner_for("not-a-model")


if __name__ == "__main__":
    unittest.main()
