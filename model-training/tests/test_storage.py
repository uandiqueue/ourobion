import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.storage import LocalFilesystemStorage

try:  # `unittest discover -s tests` (how CI runs) imports test modules top-level
    from pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS
except ImportError:  # `unittest discover -s tests -t .` imports them as a package
    from tests.pathcases import SAFE_RELATIVE_PATHS, UNSAFE_RELATIVE_PATHS


class TestLocalFilesystemStorage(unittest.TestCase):
    def test_put_get_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            src_dir = Path(d) / "src"
            src_dir.mkdir()
            src_file = src_dir / "a.txt"
            src_file.write_text("hello", encoding="utf-8")

            storage = LocalFilesystemStorage(Path(d) / "storage-root")
            ref = storage.put(src_file, "release/a.txt")
            self.assertTrue(Path(ref).exists())
            self.assertTrue(storage.exists("release/a.txt"))

            dest = Path(d) / "restored.txt"
            got = storage.get("release/a.txt", dest)
            self.assertEqual(got.read_text(encoding="utf-8"), "hello")

    def test_exists_false_for_missing_key(self):
        with tempfile.TemporaryDirectory() as d:
            storage = LocalFilesystemStorage(Path(d) / "storage-root")
            self.assertFalse(storage.exists("nope.txt"))

    def test_key_cannot_escape_storage_root(self):
        with tempfile.TemporaryDirectory() as d:
            storage = LocalFilesystemStorage(Path(d) / "storage-root")
            with self.assertRaises(ValueError):
                storage.exists("../../escape.txt")

    def test_every_unsafe_key_form_rejected_on_every_os(self):
        """Same shared table as the manifest guard -- see tests/pathcases.py.

        The `resolve()`-only check this adapter had could not catch these
        portably: on Linux "..\\..\\escape.txt" is one ordinary filename and
        "C:/secrets/x" is a subdirectory named "C:", so both stayed under the
        root and were silently accepted, while on Windows they escaped.
        """
        with tempfile.TemporaryDirectory() as d:
            storage = LocalFilesystemStorage(Path(d) / "storage-root")
            for bad, _reason in UNSAFE_RELATIVE_PATHS:
                with self.subTest(key=bad):
                    with self.assertRaises(ValueError):
                        storage.exists(bad)

    def test_ordinary_relative_keys_accepted(self):
        with tempfile.TemporaryDirectory() as d:
            storage = LocalFilesystemStorage(Path(d) / "storage-root")
            for good in SAFE_RELATIVE_PATHS:
                with self.subTest(key=good):
                    self.assertFalse(storage.exists(good))


if __name__ == "__main__":
    unittest.main()
