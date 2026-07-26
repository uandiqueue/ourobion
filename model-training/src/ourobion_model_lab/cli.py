"""ourobion_model_lab CLI.

Six subcommands map onto the "scripts work" acceptance bar: preflight,
dry-run, smoke, train, evaluate, build-release. No subcommand here ever
downloads a dataset, provisions GMI, or calls a paid model API -- that
discipline lives in what JobSpec implementations are allowed to do, not in
this dispatcher, so keep new subcommands thin.

Every model-scoped subcommand dispatches through `JobSpec.execute()`, which
runs the licence-approval and data-manifest gates first (see job.py). This
dispatcher must never call `job.train()` / `job.preflight()` / ... directly:
that is the one way to reintroduce a subcommand that runs with a pending
licence. Structured JSON-line progress goes to stderr; the command's own
result document goes to stdout.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Sequence

from . import gmi_preflight
from .config import load_config
from .errors import ModelLabError
from .job import get_job_class, registered_models
from .logging_utils import get_logger

_log = get_logger("ourobion_model_lab.cli")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ourobion-model-lab")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_model_config(p: argparse.ArgumentParser) -> None:
        p.add_argument("--model", required=True, help="registered model job name")
        p.add_argument("--config", required=True, help="path to a JSON job config")

    p_pre = sub.add_parser(
        "preflight",
        help="validate environment/config without executing; omit --model for a "
        "model-agnostic environment check",
    )
    p_pre.add_argument("--model", required=False, default=None, help="registered model job name")
    p_pre.add_argument(
        "--config", required=False, default=None, help="path to a JSON job config"
    )
    p_pre.add_argument(
        "--strict-python",
        action="store_true",
        help="fail if not running on the GMI-pinned Python version (CI sets this; local dev "
        "should not)",
    )

    for name, help_text in (
        ("dry-run", "resolve and validate the complete job; do not execute"),
        ("smoke", "run against tiny local fixtures only"),
        ("train", "run the training job contract"),
        ("evaluate", "run the evaluation job contract"),
        ("build-release", "construct a release manifest"),
    ):
        p = sub.add_parser(name, help=help_text)
        add_model_config(p)

    sub.add_parser("list-models", help="list registered model job names")

    return parser


def _print(payload: dict[str, object]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "list-models":
        for name in registered_models():
            print(name)
        return 0

    if args.command == "preflight" and not args.model:
        report = gmi_preflight.run_preflight(strict_python=args.strict_python)
        _print(report.to_dict())
        code = 0 if report.ok else 1
        _log.info(
            "command=preflight model=<none> strict_python=%s exit=%s",
            args.strict_python,
            code,
        )
        return code

    if args.command == "preflight" and not args.config:
        parser.error("--config is required when --model is given")
        return 2  # pragma: no cover - parser.error exits the process

    strict_python = bool(getattr(args, "strict_python", False))

    try:
        job_cls = get_job_class(args.model)
        config = load_config(args.config)
        job = job_cls(config)
        _log.info(
            "command=%s model=%s gates=licence:%s,dataset_manifest:%s",
            args.command,
            args.model,
            job.requires_licence_approval,
            job.requires_dataset_manifest,
        )

        # NOTE: execute() -- never job.<command>() -- so the gate always runs.
        outcome = job.execute(args.command)

        if args.command == "preflight":
            report = outcome
            if strict_python:
                # Honour --strict-python on the model path too: a JobSpec that
                # builds its report without the flag must not report a passing
                # python_version check under --strict-python.
                report = gmi_preflight.with_strict_python(report)
            _print(report.to_dict())
            code = 0 if report.ok else 1

        elif args.command == "dry-run":
            _print(
                {
                    "would_run": outcome.would_run,
                    "resolved": outcome.resolved,
                    "problems": list(outcome.problems),
                }
            )
            code = 0 if outcome.ok else 1

        elif args.command == "smoke":
            _print({"ok": outcome.ok, "detail": outcome.detail})
            code = 0 if outcome.ok else 1

        else:  # train / evaluate / build-release
            _print({"ok": outcome.ok, "detail": outcome.detail, "artifacts": outcome.artifacts})
            code = 0 if outcome.ok else 1

    except ModelLabError as exc:
        print(f"error: {exc}", file=sys.stderr)
        _log.warning(
            "command=%s model=%s failed closed: %s: %s",
            args.command,
            args.model,
            type(exc).__name__,
            exc,
        )
        return 2

    _log.info("command=%s model=%s exit=%s", args.command, args.model, code)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
