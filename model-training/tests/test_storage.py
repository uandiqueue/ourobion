import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.storage import LocalFilesystemStorage


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


if __name__ == "__main__":
    unittest.main()
