"""Proves the shared JobSpec/CLI contract end-to-end, including the
"scripts work" acceptance-bar claims: unapproved licences and changed data
hashes fail closed on *every* subcommand, dry-run resolves without executing,
and CLI dispatch never crashes raw on a ModelLabError.

`gated-example` / `manifest-gated-example` below are test-only fixture
JobSpecs -- neither is one of the five real models, and both are registered
only for this test module's lifetime (process-wide registry, but the names
never collide with a real model_name).

The central point these tests defend: a fixture job declares
`requires_licence_approval` / `requires_dataset_manifest` and does *nothing*
itself to enforce them. If the gate ever moves back into subclass bodies, the
"gate is not reached" assertions below fail.
"""

import hashlib
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest import mock

import ourobion_model_lab  # noqa: F401  (side effect: registers "self-check")
from ourobion_model_lab import cli
from ourobion_model_lab.errors import ConfigError
from ourobion_model_lab.gmi_preflight import run_preflight
from ourobion_model_lab.job import (
    GATED_COMMANDS,
    DryRunResult,
    JobSpec,
    SmokeResult,
    StepResult,
    get_job_class,
    register_job,
    registered_models,
)

GATED_MODEL = "gated-example"  # test-only fixture name; never a real model
MANIFEST_GATED_MODEL = "manifest-gated-example"  # ditto
FIXTURES = Path(__file__).parent / "fixtures"

#: Every model-scoped subcommand. Each one must fail closed on a bad gate.
MODEL_COMMANDS = ("preflight", "dry-run", "smoke", "train", "evaluate", "build-release")


class _RecordingJob(JobSpec):
    """Fixture JobSpec that records which handler bodies were reached.

    Nothing here calls require_licence_approval / verify_hash: enforcement is
    the base class's job. `reached` staying empty after a CLI call is the proof
    that the gate ran *before* dispatch.
    """

    reached: list = []

    def preflight(self):
        type(self).reached.append("preflight")
        return run_preflight()

    def dry_run(self) -> DryRunResult:
        type(self).reached.append("dry-run")
        return DryRunResult(would_run=True, resolved={"model_name": self.config.model_name})

    def smoke(self) -> SmokeResult:
        type(self).reached.append("smoke")
        return SmokeResult(ok=True, detail="fixture-only")

    def train(self) -> StepResult:
        type(self).reached.append("train")
        return StepResult(ok=True, detail="noop")

    def evaluate(self) -> StepResult:
        type(self).reached.append("evaluate")
        return StepResult(ok=True, detail="noop")

    def build_release(self) -> StepResult:
        type(self).reached.append("build-release")
        return StepResult(ok=True, detail="noop")


class GatedJob(_RecordingJob):
    """Declares a licence requirement; enforces nothing itself."""

    model_name = GATED_MODEL
    requires_licence_approval = True
    reached: list = []


class ManifestGatedJob(_RecordingJob):
    """Declares a data-manifest requirement; enforces nothing itself."""

    model_name = MANIFEST_GATED_MODEL
    requires_dataset_manifest = True
    reached: list = []


register_job(GATED_MODEL, GatedJob)
register_job(MANIFEST_GATED_MODEL, ManifestGatedJob)


def _write_data_manifest(tmp: Path, *, payload: bytes, digest: str | None = None) -> Path:
    """Write a data file plus a manifest pinning its SHA-256."""
    data_dir = tmp / "fixtures"
    data_dir.mkdir(parents=True, exist_ok=True)
    data_file = data_dir / "corpus.jsonl"
    data_file.write_bytes(payload)
    manifest = {
        "dataset": "example-fixture",
        "source": "tests/fixtures (synthetic, never a real corpus)",
        "licence": "n/a -- synthetic test bytes",
        "licence_approval_path": None,
        "files": [
            {
                "path": "fixtures/corpus.jsonl",
                "sha256": digest if digest is not None else hashlib.sha256(payload).hexdigest(),
            }
        ],
    }
    path = tmp / "data_manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return path


class TestJobRegistry(unittest.TestCase):
    def test_self_check_registered_by_package_import(self):
        self.assertIn("self-check", registered_models())

    def test_unknown_model_raises_config_error(self):
        with self.assertRaises(ConfigError):
            get_job_class("not-a-real-model")

    def test_gated_commands_cover_every_model_scoped_subcommand(self):
        self.assertEqual(set(GATED_COMMANDS), set(MODEL_COMMANDS))

    def test_subclass_may_not_override_the_gate(self):
        # The whole HIGH-1 design rests on this: a model cannot opt out by
        # redefining execute()/run_gates().
        for member in ("execute", "run_gates", "_gate_licence", "_gate_data_manifest"):
            with self.assertRaises(TypeError):
                type(
                    "SneakyJob",
                    (GatedJob,),
                    {"model_name": "sneaky", member: lambda self, *a, **k: None},
                )

    def test_requires_flags_must_be_bools(self):
        with self.assertRaises(TypeError):
            type("BadFlagJob", (GatedJob,), {"requires_licence_approval": "yes"})

    def test_unknown_command_to_execute_fails_closed(self):
        from ourobion_model_lab.config import JobConfig

        job = GatedJob(JobConfig(model_name=GATED_MODEL, seed=1, output_dir="out"))
        with self.assertRaises(ConfigError):
            job.execute("rm-rf")


class _CliTestBase(unittest.TestCase):
    def setUp(self):
        GatedJob.reached = []
        ManifestGatedJob.reached = []

    def _write_config(self, tmp: Path, **overrides) -> Path:
        body = {
            "model_name": "self-check",
            "seed": 7,
            "output_dir": str(tmp / "out"),
            "dataset_manifest_path": None,
            "licence_approval_path": None,
            "extras_required": [],
        }
        body.update(overrides)
        path = tmp / "config.json"
        path.write_text(json.dumps(body), encoding="utf-8")
        return path

    def _run(self, argv) -> tuple[int, str]:
        """Run the CLI, returning (exit code, stdout)."""
        buffer = StringIO()
        with redirect_stdout(buffer):
            code = cli.main(argv)
        return code, buffer.getvalue()


class TestCliWiring(_CliTestBase):
    def test_list_models_includes_self_check(self):
        self.assertEqual(cli.main(["list-models"]), 0)

    def test_global_preflight_passes_with_credential_name_present(self):
        # Exit code is fully determined once the one env-dependent input is
        # pinned, so assert the exact code rather than "0 or 1".
        with mock.patch.dict(os.environ, {"GMI_API_KEY": "dummy-not-a-real-key"}):
            code, _ = self._run(["preflight"])
        self.assertEqual(code, 0)

    def test_global_preflight_fails_when_credential_name_absent(self):
        with mock.patch.dict(os.environ, {}):
            os.environ.pop("GMI_API_KEY", None)
            code, _ = self._run(["preflight"])
        self.assertEqual(code, 1)

    def test_dry_run_self_check(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(
                cli.main(["dry-run", "--model", "self-check", "--config", str(cfg)]), 0
            )

    def test_smoke_self_check(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(cli.main(["smoke", "--model", "self-check", "--config", str(cfg)]), 0)

    def test_evaluate_self_check(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(
                cli.main(["evaluate", "--model", "self-check", "--config", str(cfg)]), 0
            )

    def test_build_release_self_check_writes_file_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(
                cli.main(["build-release", "--model", "self-check", "--config", str(cfg)]), 0
            )
            release_path = Path(d) / "out" / "release.json"
            self.assertTrue(release_path.exists())
            first = release_path.read_bytes()

            # Repeated release construction is deterministic: same config -> same bytes.
            # (Environment capture is embedded, so this also proves the volatile
            # captured_at field is excluded from the manifest body.)
            release_path.unlink()
            self.assertEqual(
                cli.main(["build-release", "--model", "self-check", "--config", str(cfg)]), 0
            )
            self.assertEqual(release_path.read_bytes(), first)

    def test_build_release_records_environment_without_secrets_or_paths(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(
                cli.main(["build-release", "--model", "self-check", "--config", str(cfg)]), 0
            )
            body = json.loads((Path(d) / "out" / "release.json").read_text(encoding="utf-8"))
            env = body["environment"]
            self.assertTrue(env["python_version"])
            names = {record["name"]: record["present"] for record in env["env_vars_present"]}
            self.assertIn("GMI_API_KEY", names)
            self.assertIsInstance(names["GMI_API_KEY"], bool)
            self.assertNotIn("captured_at", env)
            # No env var *value* and no local path may appear anywhere.
            self.assertNotIn(str(Path.home()), json.dumps(body))

    def test_build_release_stores_a_copy_through_the_storage_adapter(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            self.assertEqual(
                cli.main(["build-release", "--model", "self-check", "--config", str(cfg)]), 0
            )
            self.assertTrue((Path(d) / "out" / "store" / "release.json").exists())

    def test_unknown_model_fails_closed_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d), model_name="self-check")
            code = cli.main(["dry-run", "--model", "not-a-real-model", "--config", str(cfg)])
            self.assertEqual(code, 2)

    def test_missing_config_file_fails_closed_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            code = cli.main(
                ["dry-run", "--model", "self-check", "--config", str(Path(d) / "missing.json")]
            )
            self.assertEqual(code, 2)


class TestStrictPythonFlag(_CliTestBase):
    """--strict-python must mean the same thing with and without --model."""

    def _python_check(self, stdout: str) -> dict:
        payload = json.loads(stdout)
        return next(c for c in payload["checks"] if c["name"] == "python_version")

    def test_strict_python_agrees_on_both_preflight_paths(self):
        expected_pass = sys.version_info[:2] == (3, 10)
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            _, global_out = self._run(["preflight", "--strict-python"])
            _, model_out = self._run(
                ["preflight", "--model", "self-check", "--config", str(cfg), "--strict-python"]
            )
        global_check = self._python_check(global_out)
        model_check = self._python_check(model_out)
        self.assertEqual(global_check["passed"], expected_pass)
        self.assertEqual(model_check["passed"], expected_pass)
        self.assertEqual(global_check["passed"], model_check["passed"])

    def test_without_strict_python_the_model_path_is_informational(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d))
            _, out = self._run(["preflight", "--model", "self-check", "--config", str(cfg)])
        self.assertTrue(self._python_check(out)["passed"])


class TestGatedJobFailsClosed(_CliTestBase):
    """HIGH-1 regression test: the licence gate covers *every* subcommand."""

    def _assert_all_commands_fail_closed(self, cfg: Path, model: str, reached_owner) -> None:
        for command in MODEL_COMMANDS:
            with self.subTest(command=command):
                reached_owner.reached = []
                code = cli.main([command, "--model", model, "--config", str(cfg)])
                self.assertEqual(code, 2, f"{command} did not fail closed")
                self.assertEqual(
                    reached_owner.reached,
                    [],
                    f"{command} reached the job body despite a failed gate",
                )

    def test_no_licence_path_fails_closed_on_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(Path(d), model_name=GATED_MODEL, licence_approval_path=None)
            self._assert_all_commands_fail_closed(cfg, GATED_MODEL, GatedJob)

    def test_pending_licence_fails_closed_on_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            pending = str(FIXTURES / "example_licence_approval_pending.json")
            cfg = self._write_config(Path(d), model_name=GATED_MODEL, licence_approval_path=pending)
            self._assert_all_commands_fail_closed(cfg, GATED_MODEL, GatedJob)

    def test_missing_licence_file_fails_closed_on_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            absent = str(Path(d) / "no_such_approval.json")
            cfg = self._write_config(Path(d), model_name=GATED_MODEL, licence_approval_path=absent)
            self._assert_all_commands_fail_closed(cfg, GATED_MODEL, GatedJob)

    def test_malformed_licence_fails_closed_on_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            bad = Path(d) / "bad_licence.json"
            bad.write_text("{not valid json", encoding="utf-8")
            cfg = self._write_config(
                Path(d), model_name=GATED_MODEL, licence_approval_path=str(bad)
            )
            self._assert_all_commands_fail_closed(cfg, GATED_MODEL, GatedJob)

    def test_supplied_but_pending_licence_fails_closed_even_when_not_required(self):
        # self-check does NOT declare requires_licence_approval. A config that
        # nonetheless supplies a pending approval must still fail closed:
        # silently ignoring it would read as "the gate ran and passed".
        with tempfile.TemporaryDirectory() as d:
            pending = str(FIXTURES / "example_licence_approval_pending.json")
            cfg = self._write_config(Path(d), licence_approval_path=pending)
            for command in MODEL_COMMANDS:
                with self.subTest(command=command):
                    code = cli.main([command, "--model", "self-check", "--config", str(cfg)])
                    self.assertEqual(code, 2)

    def test_approved_licence_allows_every_subcommand_to_proceed(self):
        approved = str(FIXTURES / "example_licence_approval_approved.json")
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(
                Path(d), model_name=GATED_MODEL, licence_approval_path=approved
            )
            with mock.patch.dict(os.environ, {"GMI_API_KEY": "dummy-not-a-real-key"}):
                for command in MODEL_COMMANDS:
                    with self.subTest(command=command):
                        GatedJob.reached = []
                        code, _ = self._run([command, "--model", GATED_MODEL, "--config", str(cfg)])
                        self.assertEqual(code, 0)
                        self.assertEqual(GatedJob.reached, [command])


class TestDataManifestGateFailsClosed(_CliTestBase):
    """HIGH-2 regression test: a changed or missing digest stops every subcommand."""

    def test_matching_hashes_allow_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = _write_data_manifest(tmp, payload=b"one\ntwo\n")
            cfg = self._write_config(
                tmp, model_name=MANIFEST_GATED_MODEL, dataset_manifest_path=str(manifest)
            )
            with mock.patch.dict(os.environ, {"GMI_API_KEY": "dummy-not-a-real-key"}):
                for command in MODEL_COMMANDS:
                    with self.subTest(command=command):
                        ManifestGatedJob.reached = []
                        code, _ = self._run(
                            [command, "--model", MANIFEST_GATED_MODEL, "--config", str(cfg)]
                        )
                        self.assertEqual(code, 0)
                        self.assertEqual(ManifestGatedJob.reached, [command])

    def test_changed_file_contents_fail_closed_on_every_subcommand(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = _write_data_manifest(tmp, payload=b"one\ntwo\n")
            # The data changed after the manifest was pinned -- the classic
            # "someone re-downloaded the corpus" case.
            (tmp / "fixtures" / "corpus.jsonl").write_bytes(b"one\ntwo\nthree\n")
            cfg = self._write_config(
                tmp, model_name=MANIFEST_GATED_MODEL, dataset_manifest_path=str(manifest)
            )
            for command in MODEL_COMMANDS:
                with self.subTest(command=command):
                    ManifestGatedJob.reached = []
                    code = cli.main(
                        [command, "--model", MANIFEST_GATED_MODEL, "--config", str(cfg)]
                    )
                    self.assertEqual(code, 2)
                    self.assertEqual(ManifestGatedJob.reached, [])

    def test_changed_expected_digest_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = _write_data_manifest(tmp, payload=b"one\ntwo\n", digest="0" * 64)
            cfg = self._write_config(
                tmp, model_name=MANIFEST_GATED_MODEL, dataset_manifest_path=str(manifest)
            )
            self.assertEqual(
                cli.main(["train", "--model", MANIFEST_GATED_MODEL, "--config", str(cfg)]), 2
            )

    def test_missing_pinned_file_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = _write_data_manifest(tmp, payload=b"one\ntwo\n")
            (tmp / "fixtures" / "corpus.jsonl").unlink()
            cfg = self._write_config(
                tmp, model_name=MANIFEST_GATED_MODEL, dataset_manifest_path=str(manifest)
            )
            self.assertEqual(
                cli.main(["evaluate", "--model", MANIFEST_GATED_MODEL, "--config", str(cfg)]), 2
            )

    def test_absent_manifest_fails_closed_when_required(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = self._write_config(
                Path(d), model_name=MANIFEST_GATED_MODEL, dataset_manifest_path=None
            )
            self.assertEqual(
                cli.main(["smoke", "--model", MANIFEST_GATED_MODEL, "--config", str(cfg)]), 2
            )

    def test_supplied_manifest_is_verified_even_when_not_required(self):
        # self-check declares no manifest requirement; a supplied one is still
        # verified, so a stale digest cannot pass unnoticed.
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            manifest = _write_data_manifest(tmp, payload=b"one\ntwo\n", digest="0" * 64)
            cfg = self._write_config(tmp, dataset_manifest_path=str(manifest))
            self.assertEqual(
                cli.main(["dry-run", "--model", "self-check", "--config", str(cfg)]), 2
            )


if __name__ == "__main__":
    unittest.main()
