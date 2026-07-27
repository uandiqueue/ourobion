import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.errors import (
    DataManifestError,
    ForbiddenDataError,
    HashMismatchError,
    LicenceApprovalError,
)
from ourobion_model_lab.manifests import (
    load_data_manifest,
    require_data_manifest,
    require_licence_approval,
    sha256_file,
    verify_hash,
)

try:  # `unittest discover -s tests` (how CI runs) imports test modules top-level
    from pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS
except ImportError:  # `unittest discover -s tests -t .` imports them as a package
    from tests.pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS

FIXTURES = Path(__file__).parent / "fixtures"


class TestSha256(unittest.TestCase):
    def test_sha256_file_matches_known_value(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "hello.txt"
            path.write_bytes(b"hello world")
            expected = hashlib.sha256(b"hello world").hexdigest()
            self.assertEqual(sha256_file(path), expected)

    def test_verify_hash_ok(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "hello.txt"
            path.write_bytes(b"hello world")
            expected = hashlib.sha256(b"hello world").hexdigest()
            verify_hash(path, expected)  # must not raise
            verify_hash(path, expected.upper())  # case-insensitive

    def test_verify_hash_mismatch_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "hello.txt"
            path.write_bytes(b"hello world")
            with self.assertRaises(HashMismatchError):
                verify_hash(path, "0" * 64)


class TestLicenceApproval(unittest.TestCase):
    def test_missing_path_fails_closed(self):
        with self.assertRaises(LicenceApprovalError):
            require_licence_approval(None)

    def test_missing_file_fails_closed(self):
        with self.assertRaises(LicenceApprovalError):
            require_licence_approval(FIXTURES / "does_not_exist.json")

    def test_pending_status_fails_closed(self):
        with self.assertRaises(LicenceApprovalError):
            require_licence_approval(FIXTURES / "example_licence_approval_pending.json")

    def test_approved_status_succeeds(self):
        approval = require_licence_approval(FIXTURES / "example_licence_approval_approved.json")
        self.assertTrue(approval.is_approved)
        self.assertEqual(approval.dataset, "example-fixture")

    def test_malformed_json_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "bad.json"
            path.write_text("{not json", encoding="utf-8")
            with self.assertRaises(LicenceApprovalError):
                require_licence_approval(path)

    def test_utf8_bom_approval_loads(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "approval.json"
            path.write_text(
                json.dumps({"dataset": "example-fixture", "status": "approved"}),
                encoding="utf-8-sig",
            )
            self.assertTrue(require_licence_approval(path).is_approved)


class TestDataManifest(unittest.TestCase):
    def _write(self, tmp: Path, manifest: dict, *, encoding: str = "utf-8") -> Path:
        path = tmp / "data_manifest.json"
        path.write_text(json.dumps(manifest), encoding=encoding)
        return path

    def _with_payload(self, tmp: Path, payload: bytes, **overrides) -> Path:
        (tmp / "fixtures").mkdir(parents=True, exist_ok=True)
        (tmp / "fixtures" / "corpus.jsonl").write_bytes(payload)
        manifest = {
            "dataset": "example-fixture",
            "source": "synthetic test bytes",
            "licence": "n/a",
            "files": [
                {
                    "path": "fixtures/corpus.jsonl",
                    "sha256": hashlib.sha256(payload).hexdigest(),
                }
            ],
        }
        manifest.update(overrides)
        return self._write(tmp, manifest)

    def test_loads_and_verifies_matching_digests(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = load_data_manifest(self._with_payload(tmp, b"one\n"))
            self.assertEqual(manifest.dataset, "example-fixture")
            self.assertEqual(len(manifest.files), 1)
            self.assertEqual(manifest.base_dir, tmp)
            manifest.verify()  # must not raise

    def test_changed_bytes_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = load_data_manifest(self._with_payload(tmp, b"one\n"))
            (tmp / "fixtures" / "corpus.jsonl").write_bytes(b"one\ntwo\n")
            with self.assertRaises(HashMismatchError):
                manifest.verify()

    def test_missing_pinned_file_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = load_data_manifest(self._with_payload(tmp, b"one\n"))
            (tmp / "fixtures" / "corpus.jsonl").unlink()
            with self.assertRaises(HashMismatchError):
                manifest.verify()

    def test_absent_manifest_fails_closed(self):
        with self.assertRaises(DataManifestError):
            require_data_manifest(None)
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(DataManifestError):
                require_data_manifest(Path(d) / "missing.json")

    def test_malformed_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "data_manifest.json"
            path.write_text("{not json", encoding="utf-8")
            with self.assertRaises(DataManifestError):
                load_data_manifest(path)

    def test_non_hex_digest_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = self._write(
                tmp,
                {
                    "dataset": "x",
                    "files": [{"path": "fixtures/corpus.jsonl", "sha256": "not-a-digest"}],
                },
            )
            with self.assertRaises(DataManifestError):
                load_data_manifest(path)

    def test_empty_file_list_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(Path(d), {"dataset": "x", "files": []})
            with self.assertRaises(DataManifestError):
                load_data_manifest(path)

    def test_absolute_or_escaping_paths_rejected(self):
        """Every unsafe spelling in the shared table, asserted the same on every OS.

        This used to be a three-entry list checked with Path.is_absolute(),
        which meant "C:/secrets/x.jsonl" was only rejected when the tests ran
        on Windows. See tests/pathcases.py.
        """
        for bad, _reason in UNSAFE_RELATIVE_PATHS:
            with self.subTest(path=bad):
                with tempfile.TemporaryDirectory() as d:
                    path = self._write(
                        Path(d),
                        {"dataset": "x", "files": [{"path": bad, "sha256": "0" * 64}]},
                    )
                    with self.assertRaises(DataManifestError):
                        load_data_manifest(path)

    def test_ordinary_relative_paths_accepted(self):
        """The mirror of the above: the guard must not have become a blanket refusal."""
        for good in SAFE_RELATIVE_PATHS:
            with self.subTest(path=good):
                with tempfile.TemporaryDirectory() as d:
                    path = self._write(
                        Path(d),
                        {"dataset": "x", "files": [{"path": good, "sha256": "0" * 64}]},
                    )
                    manifest = load_data_manifest(path)  # validation only, no digest check
                    self.assertEqual(manifest.files[0].path, good)

    def test_forbidden_source_location_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(
                Path(d),
                {
                    "dataset": "x",
                    "files": [{"path": "supabase/seed.sql", "sha256": "0" * 64}],
                },
            )
            with self.assertRaises(ForbiddenDataError):
                load_data_manifest(path)

    def test_duplicate_entry_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(
                Path(d),
                {
                    "dataset": "x",
                    "files": [
                        {"path": "a.jsonl", "sha256": "0" * 64},
                        {"path": "a.jsonl", "sha256": "1" * 64},
                    ],
                },
            )
            with self.assertRaises(DataManifestError):
                load_data_manifest(path)

    def test_utf8_bom_manifest_loads(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            self._with_payload(tmp, b"one\n")
            path = tmp / "data_manifest.json"
            path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8-sig")
            load_data_manifest(path).verify()

    def test_licence_metadata_is_carried(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            path = self._with_payload(
                tmp,
                b"one\n",
                licence="CC-BY-4.0",
                licence_approval_path="approvals/example.json",
            )
            manifest = load_data_manifest(path)
            self.assertEqual(manifest.licence, "CC-BY-4.0")
            self.assertEqual(manifest.licence_approval_path, "approvals/example.json")
            self.assertEqual(manifest.to_dict()["dataset"], "example-fixture")


if __name__ == "__main__":
    unittest.main()
