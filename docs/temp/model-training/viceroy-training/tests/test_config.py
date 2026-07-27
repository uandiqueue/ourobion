"""Tests for viceroy.config — ViceroyConfig validation/(de)serialization, set_seed, select_device.

set_seed/select_device tests are skipped if torch isn't importable, since config.py's whole design
point is that it stays importable without torch — those two functions are the only place that
actually needs it.
"""

import json
import tempfile
import unittest
from pathlib import Path

from viceroy.config import GROUP_POLICIES, ViceroyConfig, select_device, set_seed

try:
    import torch  # noqa: F401

    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


class TestViceroyConfigDefaults(unittest.TestCase):
    def test_defaults_construct_without_error(self):
        config = ViceroyConfig()
        self.assertEqual(config.max_seq_len, 256)
        self.assertEqual(config.epochs, 5)
        self.assertEqual(config.seed, 42)
        self.assertEqual(config.effective_batch_size, 16)

    def test_gradient_accumulation_steps(self):
        config = ViceroyConfig(effective_batch_size=16, physical_batch_size=8)
        self.assertEqual(config.gradient_accumulation_steps, 2)

    def test_default_group_policy_is_the_honest_surrogate(self):
        # "pmid" cannot be satisfied by the released corpus and "row" is knowingly unsafe, so the
        # default must be the surrogate — a default that silently splits row-wise is the bug.
        self.assertEqual(ViceroyConfig().group_policy, "surrogate")

    def test_class_weighting_on_by_default(self):
        self.assertTrue(ViceroyConfig().class_weighting)


class TestViceroyConfigValidation(unittest.TestCase):
    def test_nonpositive_max_seq_len_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(max_seq_len=0)

    def test_effective_not_multiple_of_physical_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(effective_batch_size=10, physical_batch_size=3)

    def test_warmup_ratio_out_of_range_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(warmup_ratio=1.0)
        with self.assertRaises(ValueError):
            ViceroyConfig(warmup_ratio=-0.1)

    def test_nonpositive_grad_clip_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(grad_clip=0)

    def test_nonpositive_epochs_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(epochs=0)

    def test_n_folds_below_two_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(n_folds=1)

    def test_unknown_group_policy_raises(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(group_policy="whatever")
        for policy in GROUP_POLICIES:
            ViceroyConfig(group_policy=policy)  # each documented policy must construct

    def test_jaccard_thresholds_out_of_range_raise(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(near_dup_jaccard=0.0)
        with self.assertRaises(ValueError):
            ViceroyConfig(near_dup_jaccard=1.5)
        with self.assertRaises(ValueError):
            ViceroyConfig(audit_jaccard=0.0)

    def test_audit_threshold_above_grouping_threshold_raises(self):
        """The residual audit must look BELOW the grouping threshold. An audit at or above it can
        only re-confirm what grouping already guaranteed, producing a false all-clear."""
        with self.assertRaises(ValueError) as ctx:
            ViceroyConfig(near_dup_jaccard=0.7, audit_jaccard=0.9)
        self.assertIn("false all-clear", str(ctx.exception))

    def test_audit_threshold_equal_to_grouping_threshold_is_allowed(self):
        ViceroyConfig(near_dup_jaccard=0.8, audit_jaccard=0.8)

    def test_max_posting_length_floor(self):
        with self.assertRaises(ValueError):
            ViceroyConfig(max_posting_length=1)


class TestViceroyConfigSerialization(unittest.TestCase):
    def test_roundtrip_through_dict(self):
        config = ViceroyConfig(epochs=3, near_dup_jaccard=0.75)
        restored = ViceroyConfig.from_dict(config.to_dict())
        self.assertEqual(restored.epochs, 3)
        self.assertEqual(restored.near_dup_jaccard, 0.75)
        self.assertEqual(restored.config_hash(), config.config_hash())

    def test_from_dict_ignores_unknown_keys(self):
        payload = ViceroyConfig().to_dict()
        payload["not_a_field"] = "ignored"
        ViceroyConfig.from_dict(payload)

    def test_paths_survive_roundtrip_as_paths(self):
        restored = ViceroyConfig.from_dict(ViceroyConfig().to_dict())
        self.assertIsInstance(restored.data_dir, Path)
        self.assertIsInstance(restored.output_dir, Path)

    def test_save_and_load(self):
        config = ViceroyConfig(epochs=2)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            config.save(path)
            self.assertEqual(ViceroyConfig.load(path).epochs, 2)

    def test_load_tolerates_utf8_bom(self):
        config = ViceroyConfig()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            path.write_text(json.dumps(config.to_dict()), encoding="utf-8-sig")
            ViceroyConfig.load(path)

    def test_leakage_knobs_change_the_config_hash(self):
        """A run whose grouping threshold differs is not the same experiment, and the hash must
        say so — otherwise two incomparable runs look identical in their artifacts."""
        base = ViceroyConfig()
        self.assertNotEqual(
            base.config_hash(), ViceroyConfig(near_dup_jaccard=0.7).config_hash()
        )
        self.assertNotEqual(base.config_hash(), ViceroyConfig(group_policy="row").config_hash())


@unittest.skipUnless(HAS_TORCH, "torch not installed; config stays importable without it")
class TestSeedAndDevice(unittest.TestCase):
    def test_set_seed_is_reproducible(self):
        import random

        set_seed(42)
        first = [random.random() for _ in range(5)]
        set_seed(42)
        self.assertEqual(first, [random.random() for _ in range(5)])

    def test_select_device_returns_device_and_reason(self):
        device, reason = select_device()
        self.assertIn(device, ("cpu", "mps"))
        self.assertTrue(reason)


if __name__ == "__main__":
    unittest.main()
