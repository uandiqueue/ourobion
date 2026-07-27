import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ourobion_model_lab import release
from ourobion_model_lab.environment import EnvironmentSnapshot
from ourobion_model_lab.errors import ReleaseIncompleteError


def _build(metrics=None):
    return release.build_release_manifest(
        model_name="self-check",
        model_version="0.0.1",
        git_commit="deadbeef",
        config_hash="cfg-hash",
        dataset_manifest_hash=None,
        metrics=metrics if metrics is not None else {"accuracy": 0.9},
    )


class TestBuildReleaseManifest(unittest.TestCase):
    def test_deterministic_hash_same_inputs(self):
        a = _build()
        b = _build()
        self.assertEqual(a.release_hash, b.release_hash)

    def test_hash_changes_with_metrics(self):
        a = _build({"accuracy": 0.9})
        b = _build({"accuracy": 0.5})
        self.assertNotEqual(a.release_hash, b.release_hash)

    def test_training_status_always_not_run(self):
        manifest = _build()
        self.assertEqual(manifest.body["training_status"], "not run")

    def test_forbidden_key_raises(self):
        with self.assertRaises(ReleaseIncompleteError):
            release.build_release_manifest(
                model_name="x",
                model_version="0.0.1",
                git_commit=None,
                config_hash="c",
                dataset_manifest_hash=None,
                metrics={"api_key_leak": 1.0},
            )

    def test_forbidden_local_path_key_raises(self):
        with self.assertRaises(ReleaseIncompleteError):
            release.build_release_manifest(
                model_name="x",
                model_version="0.0.1",
                git_commit=None,
                config_hash="c",
                dataset_manifest_hash=None,
                metrics={"local_path_used": 1.0},
            )

    def test_environment_snapshot_is_embedded_and_deterministic(self):
        snapshot = EnvironmentSnapshot(
            python_version="3.10.12 (main, extra build text)",
            platform="Linux-6.5.0-x86_64",
            captured_at="2026-07-27T00:00:00+00:00",
            git_commit="deadbeef",
            env_vars_present={"GMI_API_KEY": True},
        )
        manifest = release.build_release_manifest(
            model_name="self-check",
            model_version="0.0.1",
            git_commit="deadbeef",
            config_hash="cfg-hash",
            dataset_manifest_hash=None,
            metrics={"accuracy": 0.9},
            environment=snapshot,
        )
        env = manifest.body["environment"]
        self.assertEqual(env["python_version"], "3.10.12")
        # Presence is a list of {name, present} records so an env var *name*
        # never becomes a manifest key (see to_release_fields).
        self.assertEqual(env["env_vars_present"], [{"name": "GMI_API_KEY", "present": True}])
        # Volatile/duplicated fields must not enter the hashed body.
        self.assertNotIn("captured_at", env)
        self.assertNotIn("git_commit", env)


class TestForbiddenValues(unittest.TestCase):
    """HIGH-3: keys alone are near-vacuous -- the body's keys are a fixed literal
    set, so a secret or a local path can only ever arrive as a *value*.

    Every credential below is obviously fake and was never issued.
    """

    def _build_with(self, **overrides):
        kwargs = dict(
            model_name="x",
            model_version="0.0.1",
            git_commit="deadbeef",
            config_hash="cfg-hash",
            dataset_manifest_hash=None,
            metrics={"accuracy": 1.0},
        )
        kwargs.update(overrides)
        return release.build_release_manifest(**kwargs)

    def test_the_evaluators_exact_bypass_is_rejected(self):
        with self.assertRaises(ReleaseIncompleteError):
            self._build_with(
                model_version="0.0.1+gmi_sk_live_ABCDEFG_REAL_SECRET",
                git_commit="/Users/jayden/private/checkout",
                config_hash=r"C:\Users\agent-j\.secrets\gmi.key",
            )

    def test_api_key_shaped_value_rejected(self):
        for value in (
            "sk-ABCDEFGHIJKLMNOPQRSTUVWX",
            "sk_live_0000fake0000fake",
            "ghp_000000000000000000fake",
            "AKIAIOSFODNN7EXAMPLE",
            "xoxb-0000-0000-fakefakefake",
            "eyJhbGciOiJIUzI1NiJ9.eyJmYWtlIjp0cnVlfQ",
            "hf_0000000000000000000fake",
            "Bearer 000000000000fake-token",
            "-----BEGIN RSA PRIVATE KEY-----",
            "supabase_service_role=abcd",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ReleaseIncompleteError):
                    self._build_with(model_version=value)

    def test_local_path_values_rejected(self):
        for value in (
            r"C:\Users\agent-j\project\out",
            "C:/Users/agent-j/project/out",
            "/home/jayden/checkouts/ourobion",
            "/Users/jayden/private/checkout",
            "~/secrets/gmi.key",
            "$HOME/.config/gmi",
            r"\\fileserver\share\weights",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ReleaseIncompleteError):
                    self._build_with(git_commit=value)

    def test_long_high_entropy_value_rejected(self):
        # 32 chars, three character classes, no recognizable shape: the profile
        # of a raw secret rather than a version/hash/slug. Fake, never issued.
        with self.assertRaises(ReleaseIncompleteError):
            self._build_with(config_hash="Zk3PmQ9xLv2RtY8wAe4UbN6cJd0FgHs1")

    def test_value_of_a_secret_shaped_env_var_rejected(self):
        with mock.patch.dict(os.environ, {"GMI_API_KEY": "totally-fake-value-12345"}):
            with self.assertRaises(ReleaseIncompleteError) as ctx:
                self._build_with(model_version="0.0.1+totally-fake-value-12345")
        # The error names the variable, never echoes the value.
        self.assertIn("GMI_API_KEY", str(ctx.exception))
        self.assertNotIn("totally-fake-value-12345", str(ctx.exception))

    def test_nested_values_are_scanned(self):
        snapshot = EnvironmentSnapshot(
            python_version="3.10.12",
            platform=r"C:\Users\agent-j\python",
            captured_at="2026-07-27T00:00:00+00:00",
            git_commit=None,
            env_vars_present={},
        )
        with self.assertRaises(ReleaseIncompleteError):
            self._build_with(environment=snapshot)

    def test_legitimate_values_are_not_false_positives(self):
        # git SHA, semantic version, sha256 digest, slug, prose, URL, platform
        # string: none of these may trip the scanner.
        manifest = release.build_release_manifest(
            model_name="leafcutter-sentence-role-v0",
            model_version="1.2.3-rc.1+build.5",
            git_commit="9f1c2d3e4b5a69788796a5b4c3d2e1f009182736",
            config_hash="a" * 64,
            dataset_manifest_hash="b" * 64,
            metrics={"accuracy": 0.9, "macro_f1": 0.88},
            environment=EnvironmentSnapshot(
                python_version="3.10.12",
                platform="Windows-11-10.0.26200-SP0",
                captured_at="2026-07-27T00:00:00+00:00",
                git_commit=None,
                env_vars_present={"GMI_API_KEY": False, "CUDA_VISIBLE_DEVICES": False},
            ),
        )
        self.assertEqual(manifest.body["training_status"], "not run")

    def test_https_url_is_not_read_as_a_drive_letter(self):
        manifest = self._build_with(model_version="0.0.1+https://example.org/spec")
        self.assertTrue(manifest.release_hash)


class TestAtomicWrite(unittest.TestCase):
    def test_write_creates_valid_file(self):
        manifest = _build()
        with tempfile.TemporaryDirectory() as d:
            dest = Path(d) / "out" / "release.json"
            written = release.write_release_manifest_atomic(manifest, dest)
            self.assertEqual(written, dest)
            self.assertTrue(dest.exists())
            body = json.loads(dest.read_text(encoding="utf-8"))
            self.assertEqual(body["release_hash"], manifest.release_hash)

    def test_repeated_build_produces_identical_bytes(self):
        manifest = _build()
        with tempfile.TemporaryDirectory() as d:
            dest1 = Path(d) / "a" / "release.json"
            dest2 = Path(d) / "b" / "release.json"
            release.write_release_manifest_atomic(manifest, dest1)
            release.write_release_manifest_atomic(manifest, dest2)
            self.assertEqual(dest1.read_bytes(), dest2.read_bytes())

    def test_crash_mid_write_leaves_no_partial_destination(self):
        manifest = _build()
        with tempfile.TemporaryDirectory() as d:
            dest = Path(d) / "out" / "release.json"
            with mock.patch(
                "ourobion_model_lab.release.os.replace",
                side_effect=OSError("simulated crash mid-write"),
            ):
                with self.assertRaises(OSError):
                    release.write_release_manifest_atomic(manifest, dest)
            self.assertFalse(dest.exists())
            leftover_temps = list(dest.parent.glob(".release-*.tmp"))
            self.assertEqual(leftover_temps, [])

    def test_write_rescans_a_hand_built_manifest_and_refuses_to_write(self):
        # A ReleaseManifest can be constructed directly, bypassing
        # build_release_manifest -- the write path must scan too.
        unsafe = release.ReleaseManifest(
            model_name="x",
            model_version="0.0.1",
            git_commit=None,
            config_hash="c",
            dataset_manifest_hash=None,
            metrics={},
            release_hash="0" * 64,
            body={"model_name": "x", "note": "/Users/jayden/private/checkout"},
        )
        with tempfile.TemporaryDirectory() as d:
            dest = Path(d) / "release.json"
            with self.assertRaises(ReleaseIncompleteError):
                release.write_release_manifest_atomic(unsafe, dest)
            self.assertFalse(dest.exists())

    def test_creates_parent_directories(self):
        manifest = _build()
        with tempfile.TemporaryDirectory() as d:
            dest = Path(d) / "nested" / "deeper" / "release.json"
            release.write_release_manifest_atomic(manifest, dest)
            self.assertTrue(dest.exists())


if __name__ == "__main__":
    unittest.main()
