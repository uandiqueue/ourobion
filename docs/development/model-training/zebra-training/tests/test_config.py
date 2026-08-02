"""Tests for zebra.config — ZebraConfig validation/(de)serialization, set_seed, select_device.

set_seed/select_device tests are skipped if torch isn't importable, since config.py's whole
design point is that it stays importable without torch — these two functions are the only place
that actually needs it.
"""

import json
import tempfile
import unittest
from pathlib import Path

from zebra.config import ZebraConfig, select_device, set_seed

try:
    import torch  # noqa: F401

    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


class TestZebraConfigDefaults(unittest.TestCase):
    def test_defaults_construct_without_error(self):
        config = ZebraConfig()
        self.assertEqual(config.max_seq_len, 384)
        self.assertEqual(config.epochs, 5)
        self.assertEqual(config.seed, 42)

    def test_gradient_accumulation_steps(self):
        config = ZebraConfig(effective_batch_size=32, physical_batch_size=8)
        self.assertEqual(config.gradient_accumulation_steps, 4)


class TestZebraConfigValidation(unittest.TestCase):
    def test_nonpositive_max_seq_len_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(max_seq_len=0)

    def test_effective_not_multiple_of_physical_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(effective_batch_size=10, physical_batch_size=3)

    def test_warmup_ratio_out_of_range_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(warmup_ratio=1.0)
        with self.assertRaises(ValueError):
            ZebraConfig(warmup_ratio=-0.1)

    def test_nonpositive_grad_clip_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(grad_clip=0)

    def test_nonpositive_epochs_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(epochs=0)

    def test_n_folds_below_two_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(n_folds=1)

    def test_negative_min_per_class_per_fold_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(min_per_class_per_fold=-1)

    def test_evidence_top_k_below_one_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(evidence_top_k=0)

    def test_nonpositive_bm25_k1_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(bm25_k1=0)

    def test_bm25_b_out_of_range_raises(self):
        with self.assertRaises(ValueError):
            ZebraConfig(bm25_b=1.5)


class TestZebraConfigHashAndSerialization(unittest.TestCase):
    def test_hash_stable_for_identical_config(self):
        a = ZebraConfig()
        b = ZebraConfig()
        self.assertEqual(a.config_hash(), b.config_hash())

    def test_hash_changes_with_any_field(self):
        a = ZebraConfig()
        b = ZebraConfig(seed=7)
        self.assertNotEqual(a.config_hash(), b.config_hash())

    def test_to_dict_from_dict_round_trip(self):
        config = ZebraConfig(seed=123, evidence_top_k=5)
        d = config.to_dict()
        self.assertIsInstance(d["data_dir"], str)  # paths serialize to str
        restored = ZebraConfig.from_dict(d)
        self.assertEqual(config, restored)

    def test_from_dict_ignores_unknown_fields(self):
        d = ZebraConfig().to_dict()
        d["totally_unknown_field"] = "ignored"
        restored = ZebraConfig.from_dict(d)  # must not raise
        self.assertIsInstance(restored, ZebraConfig)

    def test_save_load_round_trip(self):
        config = ZebraConfig(seed=99)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            config.save(path)
            loaded = ZebraConfig.load(path)
            self.assertEqual(config, loaded)

    def test_load_tolerates_utf8_bom(self):
        config = ZebraConfig()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            payload = json.dumps(config.to_dict())
            path.write_bytes(b"\xef\xbb\xbf" + payload.encode("utf-8"))  # prepend a BOM
            loaded = ZebraConfig.load(path)  # must not raise a JSONDecodeError
            self.assertEqual(config, loaded)


@unittest.skipUnless(HAS_TORCH, "torch not installed in this environment")
class TestSeedAndDevice(unittest.TestCase):
    def test_set_seed_is_repeatable(self):
        import random

        set_seed(1234)
        first = [random.random() for _ in range(3)]
        set_seed(1234)
        second = [random.random() for _ in range(3)]
        self.assertEqual(first, second)

    def test_select_device_returns_known_device_and_reason(self):
        device, reason = select_device()
        self.assertIn(device, ("cpu", "mps"))
        self.assertIsInstance(reason, str)
        self.assertTrue(len(reason) > 0)


if __name__ == "__main__":
    unittest.main()
