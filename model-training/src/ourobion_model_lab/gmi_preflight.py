"""GMI environment preflight -- validates, never provisions or mutates.

This module intentionally contains no GMI API client. It checks local
expectations (Python version against the documented GMI runtime, required
credential *names* present, GPU tooling observed) and reports pass/fail. It
never creates a GMI organization, container, EIP, firewall, API key, or
bucket -- those are the human-owned gates tracked in
docs/temp/model-training/human-gates.md.
"""
from __future__ import annotations

import os
import shutil
import sys
from dataclasses import dataclass

# The documented GMI runtime (see docs/temp/model-training/zebra-nli-shadow-v0-training-plan.md
# §3.2): CUDA 12.4 / Python 3.10.12. This module only compares against it; it
# never installs or changes anything to match. CI pins Python 3.10 (D3); local
# dev may run newer, which is why the check below is informational by default
# and only enforced with --strict-python (see cli.py).
EXPECTED_PYTHON_MINOR = (3, 10)
REQUIRED_CREDENTIAL_ENV_VARS: tuple[str, ...] = ("GMI_API_KEY",)


@dataclass(frozen=True)
class PreflightCheck:
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class PreflightReport:
    checks: tuple[PreflightCheck, ...]

    @property
    def ok(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> dict[str, object]:
        return {
            "ok": self.ok,
            "checks": [
                {"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks
            ],
        }


def _check_python_version(actual: tuple[int, int], *, strict: bool) -> PreflightCheck:
    matches = actual == EXPECTED_PYTHON_MINOR
    passed = matches if strict else True
    detail = f"expected {EXPECTED_PYTHON_MINOR} (documented GMI runtime), running {actual}"
    if not matches:
        detail += (
            "; failing because --strict-python was requested"
            if strict
            else "; informational only -- local dev may differ from the CI-pinned/GMI version"
        )
    return PreflightCheck(name="python_version", passed=passed, detail=detail)


def _check_credentials_present(env: dict[str, str]) -> PreflightCheck:
    missing = [name for name in REQUIRED_CREDENTIAL_ENV_VARS if name not in env]
    return PreflightCheck(
        name="gmi_credentials_present",
        passed=not missing,
        detail=(
            "all required credential names set"
            if not missing
            else f"missing (checked by name only, values never logged): {missing}"
        ),
    )


def _check_gpu_tooling_observed() -> PreflightCheck:
    """Record whether nvidia-smi is on PATH. Informational only, never required.

    A missing GPU is expected and correct for this offline code-build; this
    check exists so a preflight report stays honest about the local machine
    instead of silently assuming a GPU exists.
    """
    found = shutil.which("nvidia-smi") is not None
    return PreflightCheck(
        name="gpu_tooling_observed",
        passed=True,
        detail=f"nvidia-smi on PATH: {found} (informational only; no GPU is required or acted on)",
    )


def run_preflight(
    env: dict[str, str] | None = None, *, strict_python: bool = False
) -> PreflightReport:
    source = env if env is not None else dict(os.environ)
    checks = (
        _check_python_version(sys.version_info[:2], strict=strict_python),
        _check_credentials_present(source),
        _check_gpu_tooling_observed(),
    )
    return PreflightReport(checks=checks)


def with_strict_python(report: PreflightReport) -> PreflightReport:
    """Return `report` with its python_version check re-evaluated in strict mode.

    cli.py applies this to a *model's* preflight report so `--strict-python` is
    honoured on both preflight paths. Doing it here, rather than trusting each
    JobSpec to thread the flag into its own run_preflight() call, means a model
    that forgets the flag still cannot report a passing python_version check
    under --strict-python.
    """
    strict_check = _check_python_version(sys.version_info[:2], strict=True)
    checks = list(report.checks)
    for i, check in enumerate(checks):
        if check.name == strict_check.name:
            checks[i] = strict_check
            break
    else:
        checks.append(strict_check)
    return PreflightReport(checks=tuple(checks))
