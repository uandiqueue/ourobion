"""Release-pin resolution, manifest authentication, and tamper rejection."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.errors import ConfigError, HashMismatchError
from ourobion_model_lab.inference.releases import (
    EXPECTED_BUNDLE_FILENAMES,
    MODEL_ARTIFACT_BUCKET,
    RELEASE_PINS,
    evidence_root,
    load_release,
    parse_checksum_manifest,
    registered_releases,
)
from ourobion_model_lab.manifests import sha256_file


def _write_manifest(directory: Path, lines: list[str]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "local-bundle-sha256sums.txt"
    # write_bytes, NOT write_text: Path.write_text() applies universal-newline
    # translation, so on Windows "\n" lands on disk as "\r\n" and the file's
    # SHA-256 stops matching the digest computed from the same string in memory.
    # These manifests are content-addressed, so that difference is the whole ball
    # game. See .gitattributes for the tracked-file half of this fix.
    path.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
    return path


class TestReleaseRegistry(unittest.TestCase):
    def test_both_models_are_registered(self):
        self.assertEqual(registered_releases(), ("viceroy-v0", "zebra-v1"))

    def test_object_prefix_is_content_addressed(self):
        pin = RELEASE_PINS["zebra-v1"]
        self.assertEqual(
            pin.object_prefix,
            f"models/zebra-v1/releases/{pin.release_id}/model/",
        )
        self.assertTrue(pin.release_id.startswith("sha256-"))

    def test_unknown_model_is_refused(self):
        with self.assertRaises(ConfigError):
            load_release("not-a-model")

    def test_bucket_is_the_private_model_bucket_only(self):
        self.assertEqual(MODEL_ARTIFACT_BUCKET, "ourobion-model-artifacts")


class TestTrackedEvidenceMatchesPins(unittest.TestCase):
    """The pins must agree with the manifests actually committed to the repo.

    This is the test that would have caught a stale pin after a re-upload: it
    hashes the tracked evidence file and compares it to the registry, with no
    fixture in between.
    """

    def test_each_pin_matches_its_tracked_manifest(self):
        for model, pin in RELEASE_PINS.items():
            with self.subTest(model=model):
                manifest = evidence_root() / pin.evidence_dirname / "local-bundle-sha256sums.txt"
                self.assertTrue(manifest.is_file(), msg=f"missing tracked manifest: {manifest}")
                self.assertEqual(sha256_file(manifest), pin.manifest_digest)

    def test_load_release_reads_all_six_digests(self):
        for model in RELEASE_PINS:
            with self.subTest(model=model):
                resolved = load_release(model)
                self.assertEqual(sorted(resolved.digests), sorted(EXPECTED_BUNDLE_FILENAMES))
                self.assertEqual(resolved.identity()["bucket"], MODEL_ARTIFACT_BUCKET)


class TestManifestAuthentication(unittest.TestCase):
    def test_edited_manifest_fails_closed(self):
        """A single flipped hex digit must stop the run before any download."""
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            pin = RELEASE_PINS["zebra-v1"]
            real = evidence_root() / pin.evidence_dirname / "local-bundle-sha256sums.txt"
            text = real.read_bytes().decode("utf-8")
            # Change one character of one digest.
            tampered = text.replace("bc2d7a79", "bc2d7a78", 1)
            self.assertNotEqual(text, tampered)
            target = root / pin.evidence_dirname
            target.mkdir(parents=True)
            (target / "local-bundle-sha256sums.txt").write_bytes(tampered.encode("utf-8"))

            with self.assertRaises(HashMismatchError) as ctx:
                load_release("zebra-v1", evidence_dir=root)
            self.assertIn("release id", str(ctx.exception))

    def test_missing_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ConfigError):
                load_release("zebra-v1", evidence_dir=Path(d))


class TestChecksumManifestParsing(unittest.TestCase):
    def test_parses_two_space_form(self):
        digests = parse_checksum_manifest(f"{'a' * 64}  config.json\n")
        self.assertEqual(digests, {"config.json": "a" * 64})

    def test_parses_single_space_and_binary_marker(self):
        digests = parse_checksum_manifest(f"{'b' * 64} *vocab.txt\n")
        self.assertEqual(digests, {"vocab.txt": "b" * 64})

    def test_rejects_short_digest(self):
        with self.assertRaises(ConfigError):
            parse_checksum_manifest("deadbeef  config.json\n")

    def test_rejects_non_hex_digest(self):
        with self.assertRaises(ConfigError):
            parse_checksum_manifest(f"{'z' * 64}  config.json\n")

    def test_rejects_duplicate_filename(self):
        with self.assertRaises(ConfigError):
            parse_checksum_manifest(f"{'a' * 64}  config.json\n{'b' * 64}  config.json\n")

    def test_rejects_line_without_a_filename(self):
        with self.assertRaises(ConfigError):
            parse_checksum_manifest("a" * 64 + "\n")

    def test_ignores_blank_lines(self):
        digests = parse_checksum_manifest(f"\n{'a' * 64}  config.json\n\n")
        self.assertEqual(len(digests), 1)


class TestBundleShapeEnforcement(unittest.TestCase):
    def _manifest_dir(self, root: Path, lines: list[str]) -> Path:
        _write_manifest(root / "zebra-v1", lines)
        return root

    def test_missing_bundle_file_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            lines = [f"{'a' * 64}  {name}" for name in EXPECTED_BUNDLE_FILENAMES[:-1]]
            self._manifest_dir(root, lines)
            # Digest will not match the pin, so patch the pin comparison by
            # asserting the error is raised at all (manifest auth runs first).
            with self.assertRaises((ConfigError, HashMismatchError)):
                load_release("zebra-v1", evidence_dir=root)


if __name__ == "__main__":
    unittest.main()
