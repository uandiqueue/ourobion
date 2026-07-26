"""Typed job configuration and seed control.

Stdlib only (json, random, dataclasses, pathlib). Resolving a JobConfig from
disk must never perform network I/O or dataset access -- that is what makes
`load_config` safe to call from the `dry-run` and `preflight` CLI commands.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .errors import ConfigError

try:
    import json
except ImportError as exc:  # pragma: no cover - json is stdlib; defensive only
    raise ConfigError("stdlib json module unavailable") from exc

_REQUIRED_FIELDS = ("model_name", "seed", "output_dir")


@dataclass(frozen=True)
class JobConfig:
    """The complete, validated description of one job invocation.

    Every field must be resolvable offline. `raw` retains the original parsed
    JSON so model-specific code can read extra, model-owned keys without this
    shared dataclass needing to know about them in advance.
    """

    model_name: str
    seed: int
    output_dir: str
    dataset_manifest_path: str | None = None
    licence_approval_path: str | None = None
    extras_required: tuple[str, ...] = field(default_factory=tuple)
    raw: dict[str, Any] = field(default_factory=dict)

    def resolved_output_dir(self) -> Path:
        return Path(self.output_dir)


def load_config(path: str | Path) -> JobConfig:
    """Load and validate a JSON job config. Raises ConfigError; never a bare crash."""
    p = Path(path)
    try:
        # utf-8-sig, not utf-8: this repo's PowerShell tooling writes UTF-8 with a
        # BOM by default, and a BOM must not become an opaque "not valid JSON" error.
        text = p.read_text(encoding="utf-8-sig")
    except FileNotFoundError as exc:
        raise ConfigError(f"config file not found: {p}") from exc
    except OSError as exc:
        raise ConfigError(f"config file could not be read: {p}: {exc}") from exc

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"config file is not valid JSON: {p}: {exc}") from exc

    if not isinstance(raw, dict):
        raise ConfigError(f"config file must contain a JSON object: {p}")

    missing = [name for name in _REQUIRED_FIELDS if name not in raw]
    if missing:
        raise ConfigError(f"config missing required field(s): {', '.join(missing)}")

    if isinstance(raw["seed"], bool) or not isinstance(raw["seed"], int):
        raise ConfigError("config field 'seed' must be an integer")

    if not isinstance(raw["model_name"], str) or not raw["model_name"]:
        raise ConfigError("config field 'model_name' must be a non-empty string")

    if not isinstance(raw["output_dir"], str) or not raw["output_dir"]:
        raise ConfigError("config field 'output_dir' must be a non-empty string")

    extras = raw.get("extras_required", [])
    if not isinstance(extras, list) or not all(isinstance(x, str) for x in extras):
        raise ConfigError("config field 'extras_required' must be a list of strings")

    for optional_field in ("dataset_manifest_path", "licence_approval_path"):
        value = raw.get(optional_field)
        if value is not None and not isinstance(value, str):
            raise ConfigError(f"config field '{optional_field}' must be a string or null")

    return JobConfig(
        model_name=raw["model_name"],
        seed=raw["seed"],
        output_dir=raw["output_dir"],
        dataset_manifest_path=raw.get("dataset_manifest_path"),
        licence_approval_path=raw.get("licence_approval_path"),
        extras_required=tuple(extras),
        raw=raw,
    )


def set_seed(seed: int) -> None:
    """Seed the stdlib `random` module.

    Model code that also needs numpy/torch determinism must seed those lazily,
    inside its own optional-extra-gated module (see the `ml` extra) -- this
    function stays stdlib-only so core substrate code and tests can call it
    with zero packages installed.
    """
    random.seed(seed)
