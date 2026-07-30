"""Fail-closed artifact acquisition.

These tests drive `acquire_release` against a fake in-memory object store, so
the whole rejection matrix (missing / extra / renamed / nested / wrong-hash /
wrong-size / traversal) is exercised offline with no credential and no 400 MB
download. A real release is far too large to make these assertions against.
"""

from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.errors import HashMismatchError
from ourobion_model_lab.inference.acquire import (
    ArtifactAcquisitionError,
    acquire_release,
)
from ourobion_model_lab.inference.releases import (
    EXPECTED_BUNDLE_FILENAMES,
    ReleasePin,
    ResolvedRelease,
)

# A tiny synthetic bundle. Byte contents are arbitrary; only the digests matter.
BUNDLE = {name: f"contents-of-{name}".encode() for name in EXPECTED_BUNDLE_FILENAMES}
DIGESTS = {name: hashlib.sha256(body).hexdigest() for name, body in BUNDLE.items()}
WEIGHTS = "pytorch_model.bin"


def _release() -> ResolvedRelease:
    pin = ReleasePin(
        model="zebra-v1",
        version="v1",
        release_id="sha256-" + "a" * 64,
        evidence_dirname="zebra-v1",
        weights_filename=WEIGHTS,
        weights_size_bytes=len(BUNDLE[WEIGHTS]),
        bundle_size_bytes=sum(len(v) for v in BUNDLE.values()),
    )
    return ResolvedRelease(pin=pin, digests=dict(DIGESTS))


class FakeClient:
    """An in-memory stand-in for ReadOnlyR2Client."""

    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.downloaded: list[str] = []

    def list_prefix(self, prefix: str) -> list[str]:
        return sorted(k for k in self.objects if k.startswith(prefix))

    def download(self, key: str, dest: Path) -> int:
        self.downloaded.append(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(self.objects[key])
        return len(self.objects[key])


def _objects(release: ResolvedRelease, bundle: dict[str, bytes] | None = None) -> dict[str, bytes]:
    body = bundle if bundle is not None else BUNDLE
    return {release.object_prefix + name: data for name, data in body.items()}


class TestHappyPath(unittest.TestCase):
    def test_verified_release_is_yielded_then_removed(self):
        release = _release()
        client = FakeClient(_objects(release))
        captured: Path | None = None
        with acquire_release(release, client) as acquired:
            captured = acquired.directory
            self.assertTrue(captured.is_dir())
            self.assertEqual(len(acquired.verified_files), 6)
            self.assertEqual(acquired.total_bytes, release.pin.bundle_size_bytes)
            for name in EXPECTED_BUNDLE_FILENAMES:
                self.assertTrue((captured / name).is_file())
        # The whole temp tree, weights included, is gone after the context exits.
        self.assertFalse(captured.exists())
        self.assertFalse(captured.parent.exists())

    def test_identity_block_is_stamped_from_the_pin(self):
        release = _release()
        identity = release.identity()
        self.assertEqual(identity["model"], "zebra-v1")
        self.assertEqual(identity["bucket"], "ourobion-model-artifacts")
        self.assertIn("releases/sha256-", str(identity["object_prefix"]))


class TestListingRejections(unittest.TestCase):
    def _expect_failure(self, objects, exc=ArtifactAcquisitionError):
        release = _release()
        client = FakeClient(objects)
        with self.assertRaises(exc) as ctx:
            with acquire_release(release, client):
                pass  # pragma: no cover - the context must not be entered
        return ctx.exception

    def test_empty_prefix_is_refused(self):
        error = self._expect_failure({})
        self.assertIn("no objects found", str(error))

    def test_missing_file_is_refused(self):
        release = _release()
        objects = _objects(release)
        del objects[release.object_prefix + "vocab.txt"]
        error = self._expect_failure(objects)
        self.assertIn("missing=['vocab.txt']", str(error))

    def test_extra_file_is_refused(self):
        release = _release()
        objects = _objects(release)
        objects[release.object_prefix + "README.md"] = b"unexpected"
        error = self._expect_failure(objects)
        self.assertIn("extra=['README.md']", str(error))

    def test_renamed_file_is_refused(self):
        release = _release()
        objects = _objects(release)
        objects[release.object_prefix + "model.safetensors"] = objects.pop(
            release.object_prefix + WEIGHTS
        )
        error = self._expect_failure(objects)
        self.assertIn("extra=['model.safetensors']", str(error))

    def test_nested_object_is_refused(self):
        release = _release()
        objects = _objects(release)
        objects[release.object_prefix + "subdir/config.json"] = b"nested"
        error = self._expect_failure(objects)
        self.assertIn("nested", str(error))

    def test_traversal_object_name_is_refused(self):
        release = _release()
        objects = _objects(release)
        objects[release.object_prefix + "../escape.json"] = b"escape"
        error = self._expect_failure(objects)
        # Caught as unsafe or as nested; either is a refusal before download.
        self.assertTrue("unsafe" in str(error) or "nested" in str(error), msg=str(error))

    def test_nothing_is_downloaded_when_the_listing_is_wrong(self):
        release = _release()
        objects = _objects(release)
        del objects[release.object_prefix + "vocab.txt"]
        client = FakeClient(objects)
        with self.assertRaises(ArtifactAcquisitionError):
            with acquire_release(release, client):
                pass  # pragma: no cover
        self.assertEqual(
            client.downloaded,
            [],
            msg="the listing check must run before any bytes are fetched",
        )


class TestContentRejections(unittest.TestCase):
    def test_wrong_hash_is_refused(self):
        release = _release()
        corrupted = dict(BUNDLE)
        corrupted["config.json"] = b"tampered"
        client = FakeClient(_objects(release, corrupted))
        with self.assertRaises(HashMismatchError) as ctx:
            with acquire_release(release, client):
                pass  # pragma: no cover
        self.assertIn("failed verification", str(ctx.exception))
        self.assertIn("No model is loaded", str(ctx.exception))

    def test_wrong_weights_size_is_refused(self):
        release = _release()
        # Same digests, but the pin claims a different weights length.
        bad_pin = ReleasePin(
            model=release.pin.model,
            version=release.pin.version,
            release_id=release.pin.release_id,
            evidence_dirname=release.pin.evidence_dirname,
            weights_filename=WEIGHTS,
            weights_size_bytes=release.pin.weights_size_bytes + 1,
            bundle_size_bytes=release.pin.bundle_size_bytes,
        )
        mismatched = ResolvedRelease(pin=bad_pin, digests=dict(DIGESTS))
        client = FakeClient(_objects(mismatched))
        with self.assertRaises(ArtifactAcquisitionError) as ctx:
            with acquire_release(mismatched, client):
                pass  # pragma: no cover
        self.assertIn("weights file is", str(ctx.exception))

    def test_temp_directory_is_removed_after_a_hash_failure(self):
        release = _release()
        corrupted = dict(BUNDLE)
        corrupted["tokenizer.json"] = b"tampered"
        client = FakeClient(_objects(release, corrupted))
        with tempfile.TemporaryDirectory() as parent:
            parent_path = Path(parent)
            with self.assertRaises(HashMismatchError):
                with acquire_release(release, client, parent_dir=parent_path):
                    pass  # pragma: no cover
            leftovers = list(parent_path.iterdir())
            self.assertEqual(leftovers, [], msg=f"weights survived a failed run: {leftovers}")

    def test_every_file_is_hashed_not_just_the_weights(self):
        for target in EXPECTED_BUNDLE_FILENAMES:
            with self.subTest(corrupted=target):
                release = _release()
                corrupted = dict(BUNDLE)
                corrupted[target] = b"tampered-" + target.encode()
                client = FakeClient(_objects(release, corrupted))
                with self.assertRaises((HashMismatchError, ArtifactAcquisitionError)):
                    with acquire_release(release, client):
                        pass  # pragma: no cover


class TestNoFallback(unittest.TestCase):
    def test_acquire_has_no_hub_or_cache_fallback_path(self):
        """A textual guard: the module must not reference an alternative source."""
        source = (
            Path(__file__).resolve().parents[1] / "src/ourobion_model_lab/inference/acquire.py"
        ).read_text(encoding="utf-8")
        for forbidden in ("huggingface", "hf_hub", "from_pretrained", "HF_HOME", "cache_dir"):
            self.assertNotIn(
                forbidden,
                source.replace("not to Hugging Face Hub", ""),
                msg=f"acquire.py must not reference {forbidden!r}",
            )


if __name__ == "__main__":
    unittest.main()
