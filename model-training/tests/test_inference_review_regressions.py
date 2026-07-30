"""Regressions for the four blocking findings on PR #270.

Each class below pins one defect that review caught, so it cannot come back
quietly. Kept in one module, named for the review, because the shared context
("this was wrong once, here is the shape of the mistake") is the useful part.
"""

from __future__ import annotations

import hashlib
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ourobion_model_lab.inference import predict as predict_module
from ourobion_model_lab.inference.predict import run_inference
from ourobion_model_lab.inference.r2 import (
    ALLOWED_BUCKET,
    R2Credentials,
    R2Error,
    ReadOnlyR2Client,
    assert_allowed_target,
    credentials_from_env,
)
from ourobion_model_lab.inference.releases import EXPECTED_BUNDLE_FILENAMES, RELEASE_PINS
from ourobion_model_lab.inference.schemas import ZEBRA_LABELS, PredictionRow

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = REPO_ROOT / ".github/workflows/model-inference.yml"

VALID_ENDPOINT = "https://abc123.r2.cloudflarestorage.com"


def _creds(**overrides) -> R2Credentials:
    base = dict(
        access_key_id="test-id",
        secret_access_key="test-secret",
        endpoint=VALID_ENDPOINT,
        bucket=ALLOWED_BUCKET,
    )
    base.update(overrides)
    return R2Credentials(**base)


# ---------------------------------------------------------------------------
# Finding 1 — a fully failed forward pass reported success.
# ---------------------------------------------------------------------------

BUNDLE = {name: f"contents-of-{name}".encode() for name in EXPECTED_BUNDLE_FILENAMES}
DIGESTS = {name: hashlib.sha256(body).hexdigest() for name, body in BUNDLE.items()}


class _FakeClient:
    def __init__(self, prefix: str):
        self.objects = {prefix + name: body for name, body in BUNDLE.items()}

    def list_prefix(self, prefix: str) -> list[str]:
        return sorted(k for k in self.objects if k.startswith(prefix))

    def download(self, key: str, dest: Path) -> int:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(self.objects[key])
        return len(self.objects[key])


class TestFailedRunsDoNotReportSuccess(unittest.TestCase):
    """`ok` was hardcoded True, so an all-errors run exited 0.

    The runner catches per-batch exceptions and emits `status=error` rows, so a
    forward pass that raised on every batch produced a green acceptance run
    proving nothing at all.
    """

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

        manifest_text = "\n".join(f"{DIGESTS[n]}  {n}" for n in EXPECTED_BUNDLE_FILENAMES) + "\n"
        evidence = self.root / "evidence" / "zebra-v1"
        evidence.mkdir(parents=True)
        (evidence / "local-bundle-sha256sums.txt").write_bytes(manifest_text.encode("utf-8"))

        digest = hashlib.sha256(manifest_text.encode("utf-8")).hexdigest()
        real_pin = RELEASE_PINS["zebra-v1"]
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

        self.client = _FakeClient(self.pin.object_prefix)
        self.manifest = self.root / "in.jsonl"
        self.manifest.write_text(
            '{"row_id": "r0", "claim_text": "c", "evidence_text": "e"}\n'
            '{"row_id": "r1", "claim_text": "c", "evidence_text": "e"}\n',
            encoding="utf-8",
            newline="\n",
        )

    def _run_with(self, runner):
        with mock.patch.object(predict_module, "_runner_for", return_value=runner):
            return run_inference(
                model="zebra-v1",
                input_manifest=self.manifest,
                output_path=None,
                evidence_dir=self.root / "evidence",
                client=self.client,
                parent_dir=self.root,
            )

    @staticmethod
    def _all_errors(acquired, rows):
        return [
            PredictionRow(
                row_id=row.row_id,
                status="error",
                error="inference failed: RuntimeError",
                model_identity=acquired.release.identity(),
            )
            for row in rows
        ]

    @staticmethod
    def _one_error(acquired, rows):
        identity = acquired.release.identity()
        out = []
        for index, row in enumerate(rows):
            if index == 0:
                out.append(
                    PredictionRow(
                        row_id=row.row_id,
                        status="error",
                        error="inference failed: RuntimeError",
                        model_identity=identity,
                    )
                )
            else:
                out.append(
                    PredictionRow(
                        row_id=row.row_id,
                        status="ok",
                        label="supported",
                        logits=[2.0, 0.5, 0.1],
                        probabilities=[0.7, 0.2, 0.1],
                        label_order=list(ZEBRA_LABELS),
                        model_identity=identity,
                    )
                )
        return out

    def test_all_rows_failing_is_not_ok(self):
        result = self._run_with(self._all_errors)
        self.assertFalse(result.ok)
        self.assertEqual(result.rows_ok, 0)
        self.assertEqual(result.rows_error, 2)

    def test_a_single_failed_row_is_not_ok(self):
        result = self._run_with(self._one_error)
        self.assertFalse(result.ok)
        self.assertEqual(result.rows_error, 1)

    def test_a_clean_run_is_ok(self):
        def clean(acquired, rows):
            identity = acquired.release.identity()
            return [
                PredictionRow(
                    row_id=row.row_id,
                    status="ok",
                    label="supported",
                    logits=[2.0, 0.5, 0.1],
                    probabilities=[0.7, 0.2, 0.1],
                    label_order=list(ZEBRA_LABELS),
                    model_identity=identity,
                )
                for row in rows
            ]

        self.assertTrue(self._run_with(clean).ok)

    def test_error_rows_are_still_written_so_evidence_survives(self):
        out = self.root / "out.jsonl"
        with mock.patch.object(predict_module, "_runner_for", return_value=self._all_errors):
            result = run_inference(
                model="zebra-v1",
                input_manifest=self.manifest,
                output_path=out,
                evidence_dir=self.root / "evidence",
                client=self.client,
                parent_dir=self.root,
            )
        self.assertFalse(result.ok)
        self.assertEqual(len(out.read_text(encoding="utf-8").strip().split("\n")), 2)

    def test_cli_exit_status_follows_ok(self):
        """The workflow's `set -o pipefail` turns this into a red job."""
        source = (REPO_ROOT / "model-training/src/ourobion_model_lab/cli.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("return 0 if result.ok else 1", source)


# ---------------------------------------------------------------------------
# Finding 2 — the exact bucket/endpoint were documented but not enforced.
# ---------------------------------------------------------------------------


class TestTargetPinning(unittest.TestCase):
    def test_the_pinned_bucket_is_accepted(self):
        assert_allowed_target(_creds())

    def test_another_bucket_is_refused(self):
        with self.assertRaises(R2Error) as ctx:
            assert_allowed_target(_creds(bucket="ourobion-corpus"))
        self.assertIn("ourobion-corpus", str(ctx.exception))

    def test_the_corpus_bucket_specifically_cannot_be_read(self):
        """A `MODEL_R2_BUCKET` typo must not point this runner at the corpus."""
        env = {
            "MODEL_R2_ACCESS_KEY_ID": "id",
            "MODEL_R2_SECRET_ACCESS_KEY": "secret",
            "MODEL_R2_ENDPOINT": VALID_ENDPOINT,
            "MODEL_R2_BUCKET": "ourobion-corpus",
        }
        with self.assertRaises(R2Error):
            credentials_from_env(env)

    def test_non_https_endpoint_is_refused(self):
        with self.assertRaises(R2Error) as ctx:
            assert_allowed_target(_creds(endpoint="http://abc.r2.cloudflarestorage.com"))
        self.assertIn("https", str(ctx.exception))

    def test_foreign_host_is_refused(self):
        for endpoint in (
            "https://evil.example.com",
            "https://abc.r2.cloudflarestorage.com.evil.example.com",
            "https://s3.amazonaws.com",
        ):
            with self.subTest(endpoint=endpoint):
                with self.assertRaises(R2Error):
                    assert_allowed_target(_creds(endpoint=endpoint))

    def test_endpoint_with_a_path_or_query_is_refused(self):
        for endpoint in (
            f"{VALID_ENDPOINT}/some/path",
            f"{VALID_ENDPOINT}?x=1",
            f"{VALID_ENDPOINT}#frag",
        ):
            with self.subTest(endpoint=endpoint):
                with self.assertRaises(R2Error):
                    assert_allowed_target(_creds(endpoint=endpoint))

    def test_embedded_userinfo_is_refused(self):
        with self.assertRaises(R2Error):
            assert_allowed_target(_creds(endpoint="https://u:p@abc.r2.cloudflarestorage.com"))

    def test_client_construction_also_enforces_the_pin(self):
        """Credentials can be built directly, so the client re-checks."""
        with self.assertRaises(R2Error):
            ReadOnlyR2Client(_creds(bucket="ourobion-corpus"))

    def test_rejection_never_echoes_a_key(self):
        with self.assertRaises(R2Error) as ctx:
            assert_allowed_target(_creds(bucket="wrong", secret_access_key="SUPER-SECRET-VALUE"))
        self.assertNotIn("SUPER-SECRET-VALUE", str(ctx.exception))


# ---------------------------------------------------------------------------
# Finding 3 — CRLF checkout broke the content-addressed manifests on Windows.
# ---------------------------------------------------------------------------


class TestLineEndingInvariants(unittest.TestCase):
    """`core.autocrlf=true` on the Windows dev machine changed these digests.

    The tracked checksum manifests are content-addressed: the release id IS the
    file's SHA-256. A CRLF checkout silently produced a different digest, so
    every inference run and the tracked-pin tests failed on Windows while
    passing on Linux CI. `.gitattributes` now forces LF; this asserts the
    result on whatever platform the suite runs on.
    """

    def _tracked_manifests(self) -> list[Path]:
        return [
            REPO_ROOT
            / "model-training/evidence"
            / pin.evidence_dirname
            / "local-bundle-sha256sums.txt"
            for pin in RELEASE_PINS.values()
        ]

    def test_checksum_manifests_contain_no_carriage_returns(self):
        for path in self._tracked_manifests():
            with self.subTest(path=path.name):
                self.assertTrue(path.is_file(), msg=f"missing: {path}")
                self.assertNotIn(
                    b"\r",
                    path.read_bytes(),
                    msg=(
                        f"{path} has CR bytes in the working tree. Its SHA-256 is the pinned "
                        "release id, so this breaks every inference run on this platform. "
                        "Check the .gitattributes `text eol=lf` entry."
                    ),
                )

    def test_frozen_input_manifests_contain_no_carriage_returns(self):
        for path in (REPO_ROOT / "model-training/inference-manifests").glob("*.jsonl"):
            with self.subTest(path=path.name):
                self.assertNotIn(b"\r", path.read_bytes())

    def test_gitattributes_pins_both_manifest_globs_to_lf(self):
        text = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")
        self.assertIn("model-training/evidence/*/local-bundle-sha256sums.txt text eol=lf", text)
        self.assertIn("model-training/inference-manifests/*.jsonl text eol=lf", text)


# ---------------------------------------------------------------------------
# Finding 4 — credentialed workflow used floating action tags.
# ---------------------------------------------------------------------------

_USES_RE = re.compile(r"^\s*uses:\s*(\S+)", re.MULTILINE)
_SHA_PINNED_RE = re.compile(r"^[^@]+@[0-9a-f]{40}$")


class TestWorkflowActionsArePinned(unittest.TestCase):
    """Setup steps run in the same job that later receives the R2 secrets.

    A floating tag means the code that runs before the credential is introduced
    can change without any review in this repository.
    """

    def test_every_action_is_pinned_to_a_commit_sha(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        used = _USES_RE.findall(text)
        self.assertGreaterEqual(len(used), 3, msg="expected at least three `uses:` steps")
        for reference in used:
            with self.subTest(action=reference):
                self.assertRegex(
                    reference,
                    _SHA_PINNED_RE,
                    msg=f"{reference} is a floating tag; pin it to a 40-character commit SHA",
                )

    def test_each_pin_carries_a_human_readable_version_comment(self):
        for line in WORKFLOW.read_text(encoding="utf-8").splitlines():
            if "uses:" in line and "@" in line:
                with self.subTest(line=line.strip()):
                    self.assertIn("#", line, msg="pin should note which version the SHA is")


if __name__ == "__main__":
    unittest.main()
