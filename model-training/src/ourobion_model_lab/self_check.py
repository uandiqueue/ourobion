"""A trivial reference JobSpec proving the CLI contract end-to-end.

`self-check` is NOT one of the five planned models -- see
docs/temp/model-training/model-roster.md for those. It exists purely so MT0's
preflight/dry-run/smoke/train/evaluate/build-release contract has something
real to run against before MT1-MT5 land, and so CI's "config validation" and
"offline smoke" steps exercise the actual CLI rather than only unit tests
importing internals directly. Its train()/evaluate() do no real computation
and its build-release output must never be mistaken for a trained model's.
"""

from __future__ import annotations

from pathlib import Path

from . import metrics, release
from .config import set_seed
from .environment import capture_environment
from .gmi_preflight import PreflightReport, run_preflight
from .job import DryRunResult, JobSpec, SmokeResult, StepResult, register_job
from .storage import LocalFilesystemStorage

MODEL_NAME = "self-check"


class SelfCheckJob(JobSpec):
    model_name = MODEL_NAME

    def preflight(self) -> PreflightReport:
        return run_preflight()

    def dry_run(self) -> DryRunResult:
        problems: list[str] = []
        if self.config.model_name != MODEL_NAME:
            problems.append(
                f"config model_name={self.config.model_name!r} does not match {MODEL_NAME!r}"
            )
        return DryRunResult(
            would_run=not problems,
            resolved={
                "model_name": self.config.model_name,
                "seed": self.config.seed,
                "output_dir": self.config.output_dir,
            },
            problems=tuple(problems),
        )

    def smoke(self) -> SmokeResult:
        set_seed(self.config.seed)
        y_true = ["a", "b", "a", "b"]
        y_pred = ["a", "b", "b", "b"]
        acc = metrics.accuracy(y_true, y_pred)
        return SmokeResult(ok=0.0 <= acc <= 1.0, detail=f"fixture accuracy={acc}")

    def train(self) -> StepResult:
        return StepResult(ok=True, detail="self-check has no real training; contract-wiring only")

    def evaluate(self) -> StepResult:
        report = metrics.EvaluationReport(
            model_name=MODEL_NAME, metrics={"accuracy": 1.0}, n_examples=1
        )
        return StepResult(
            ok=True,
            detail="fixture evaluation only, no real model was scored",
            artifacts={"report": str(report.to_dict())},
        )

    def build_release(self) -> StepResult:
        manifest = release.build_release_manifest(
            model_name=MODEL_NAME,
            model_version="0.0.0-self-check",
            git_commit=None,
            config_hash="fixture",
            dataset_manifest_hash=None,
            metrics={"accuracy": 1.0},
            # Reproducibility metadata: presence/versions only. build_release_manifest
            # scans every value, so a local path or secret here would fail the build.
            environment=capture_environment(),
        )
        out_dir = Path(self.config.output_dir)
        dest = out_dir / "release.json"
        release.write_release_manifest_atomic(manifest, dest)
        # Exercise the storage adapter on the artifact we just wrote: a local
        # directory today, an approved object-storage prefix in an execution run
        # (GMI-H5). Never a credentialed remote in this code-build.
        store = LocalFilesystemStorage(out_dir / "store")
        stored = store.put(dest, "release.json")
        return StepResult(
            ok=True,
            detail=f"wrote {dest}",
            artifacts={"release_manifest": str(dest), "stored_copy": str(stored)},
        )


register_job(MODEL_NAME, SelfCheckJob)
