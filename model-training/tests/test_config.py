import json
import tempfile
import unittest
from pathlib import Path

from ourobion_model_lab.config import load_config, set_seed
from ourobion_model_lab.errors import ConfigError


class TestLoadConfig(unittest.TestCase):
    def _write(self, tmp: Path, body: dict) -> Path:
        path = tmp / "config.json"
        path.write_text(json.dumps(body), encoding="utf-8")
        return path

    def test_valid_config_loads(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(
                Path(d),
                {"model_name": "x", "seed": 42, "output_dir": "out"},
            )
            cfg = load_config(path)
            self.assertEqual(cfg.model_name, "x")
            self.assertEqual(cfg.seed, 42)
            self.assertEqual(cfg.output_dir, "out")
            self.assertIsNone(cfg.dataset_manifest_path)
            self.assertEqual(cfg.extras_required, ())

    def test_missing_required_field_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(Path(d), {"model_name": "x", "seed": 1})
            with self.assertRaises(ConfigError):
                load_config(path)

    def test_seed_must_be_int(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(
                Path(d), {"model_name": "x", "seed": "not-an-int", "output_dir": "o"}
            )
            with self.assertRaises(ConfigError):
                load_config(path)

    def test_seed_bool_rejected(self):
        # bool is a subclass of int in Python; must not silently pass as a seed.
        with tempfile.TemporaryDirectory() as d:
            path = self._write(Path(d), {"model_name": "x", "seed": True, "output_dir": "o"})
            with self.assertRaises(ConfigError):
                load_config(path)

    def test_invalid_json_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.json"
            path.write_text("{not valid json", encoding="utf-8")
            with self.assertRaises(ConfigError):
                load_config(path)

    def test_file_not_found_raises(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ConfigError):
                load_config(Path(d) / "missing.json")

    def test_utf8_bom_config_loads(self):
        # This repo's PowerShell tooling writes UTF-8 *with* a BOM by default;
        # decoding as plain utf-8 left a U+FEFF in front of "{" and produced an
        # opaque "not valid JSON" error.
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.json"
            body = json.dumps({"model_name": "x", "seed": 1, "output_dir": "o"})
            path.write_text(body, encoding="utf-8-sig")
            self.assertTrue(path.read_bytes().startswith(b"\xef\xbb\xbf"))
            cfg = load_config(path)
            self.assertEqual(cfg.model_name, "x")

    def test_extras_required_must_be_string_list(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write(
                Path(d),
                {"model_name": "x", "seed": 1, "output_dir": "o", "extras_required": [1, 2]},
            )
            with self.assertRaises(ConfigError):
                load_config(path)


class TestSetSeed(unittest.TestCase):
    def test_set_seed_is_deterministic(self):
        import random

        set_seed(7)
        first = [random.random() for _ in range(5)]
        set_seed(7)
        second = [random.random() for _ in range(5)]
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
