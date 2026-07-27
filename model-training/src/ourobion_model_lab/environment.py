"""Environment capture for reproducibility metadata.

Stdlib only: platform, sys, os, subprocess (best-effort git commit). No
network access. Never captures or logs the *value* of a secret-shaped
environment variable -- only whether its name is set. See gmi_preflight.py
for the same discipline applied to GMI credentials specifically.
"""

from __future__ import annotations

import os
import platform
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone

# Only these variable *names* are ever recorded, and only presence, never value.
SAFE_TO_RECORD_PRESENCE = (
    "GMI_API_KEY",
    "GMI_ORG_ID",
    "CUDA_VISIBLE_DEVICES",
)


@dataclass(frozen=True)
class EnvironmentSnapshot:
    python_version: str
    platform: str
    captured_at: str
    git_commit: str | None
    env_vars_present: dict[str, bool] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "python_version": self.python_version,
            "platform": self.platform,
            "captured_at": self.captured_at,
            "git_commit": self.git_commit,
            "env_vars_present": dict(self.env_vars_present),
        }

    def to_release_fields(self) -> dict[str, object]:
        """The subset safe and stable enough to embed in a hashed release manifest.

        Drops `captured_at` (wall-clock time would break the "identical inputs
        produce identical bytes" guarantee) and `git_commit` (the manifest
        carries its own top-level field for that). Keeps only the interpreter's
        short version string -- `sys.version` also carries build/compiler text
        that varies per build and is not reproducibility-relevant. Values of
        environment variables are never included, only presence flags.

        Presence is a sorted *list of records*, not a name-keyed mapping, on
        purpose: release.py rejects any manifest key containing `api_key`,
        `secret`, `token`, ... and an env var name like `GMI_API_KEY` used as a
        key would trip that guard. Carrying the name as a value keeps the key
        guard strict instead of carving an exemption into it.
        """
        return {
            "python_version": self.python_version.split()[0] if self.python_version else "",
            "platform": self.platform,
            "env_vars_present": [
                {"name": name, "present": present}
                for name, present in sorted(self.env_vars_present.items())
            ],
        }


def _best_effort_git_commit() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    commit = result.stdout.strip()
    return commit or None


def capture_environment(env: dict[str, str] | None = None) -> EnvironmentSnapshot:
    """Capture a reproducibility snapshot. Never use this to log secret values."""
    source = env if env is not None else dict(os.environ)
    return EnvironmentSnapshot(
        python_version=sys.version,
        platform=platform.platform(),
        captured_at=datetime.now(timezone.utc).isoformat(),
        git_commit=_best_effort_git_commit(),
        env_vars_present={name: name in source for name in SAFE_TO_RECORD_PRESENCE},
    )
