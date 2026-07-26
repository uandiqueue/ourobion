"""The shared preflight/dry-run/smoke/train/evaluate/build-release contract.

Every model (MT1-MT5) implements JobSpec and registers itself under its own
model_name via register_job(). MT0 provides the contract, the registry, and
one internal reference implementation (self_check.py) so the contract is
proven end-to-end before any of the five real models exists.

**The gate lives here, not in the subclasses.** `JobSpec.execute()` is the one
entry point cli.py uses for every subcommand, and it runs the licence-approval
and data-manifest gates *before* dispatching. A subclass cannot skip a gate by
forgetting to call something: it declares `requires_licence_approval` /
`requires_dataset_manifest` and `__init_subclass__` refuses to build a class
that overrides `execute` or the gate itself. A subclass's own
preflight()/train()/... body is only ever reached through that door.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Tuple, Type

from .config import JobConfig
from .errors import ConfigError
from .gmi_preflight import PreflightReport
from .manifests import (
    DataManifest,
    LicenceApproval,
    load_data_manifest,
    load_licence_approval,
    require_data_manifest,
    require_licence_approval,
)


@dataclass(frozen=True)
class DryRunResult:
    would_run: bool
    resolved: dict[str, Any]
    problems: tuple[str, ...] = ()

    @property
    def ok(self) -> bool:
        return self.would_run and not self.problems


@dataclass(frozen=True)
class SmokeResult:
    ok: bool
    detail: str


@dataclass(frozen=True)
class StepResult:
    ok: bool
    detail: str
    artifacts: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class GateResult:
    """What the central gate actually checked, for logging/reporting."""

    licence: LicenceApproval | None
    data_manifest: DataManifest | None
    checked: Tuple[str, ...]


#: Every subcommand that can consume data or produce an artifact. All of them
#: go through the gate -- including `preflight`, which reads config and may
#: touch pinned files.
GATED_COMMANDS: Tuple[str, ...] = (
    "preflight",
    "dry-run",
    "smoke",
    "train",
    "evaluate",
    "build-release",
)

#: Names a subclass may not redefine: doing so would let a model opt out of the
#: gate silently, which is exactly the failure mode this design exists to stop.
_SEALED_MEMBERS = ("execute", "run_gates", "_gate_licence", "_gate_data_manifest")


class JobSpec(abc.ABC):
    """One model's implementation of the six-command CLI contract.

    Subclasses declare their gate requirements; they never enforce them:

        class MyJob(JobSpec):
            model_name = "my-model"
            requires_licence_approval = True
            requires_dataset_manifest = True
    """

    model_name: str

    #: The model declares that it may only run once a human has recorded an
    #: approval for its dataset licence. `config.licence_approval_path` must
    #: then be set and the artifact must record status "approved".
    requires_licence_approval: bool = False

    #: The model declares that it reads pinned data. `config.dataset_manifest_path`
    #: must then be set, loadable, and every pinned digest must still match.
    requires_dataset_manifest: bool = False

    def __init__(self, config: JobConfig) -> None:
        self.config = config

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        for name in _SEALED_MEMBERS:
            if name in cls.__dict__:
                raise TypeError(
                    f"{cls.__name__} may not override JobSpec.{name}: the licence/data-manifest "
                    "gate is enforced centrally. Declare requires_licence_approval / "
                    "requires_dataset_manifest instead."
                )
        for flag in ("requires_licence_approval", "requires_dataset_manifest"):
            value = cls.__dict__.get(flag)
            if value is not None and not isinstance(value, bool):
                raise TypeError(f"{cls.__name__}.{flag} must be a bool, got {value!r}")

    # -- the gate -----------------------------------------------------------

    def _gate_licence(self) -> LicenceApproval | None:
        """Fail closed on a required-but-absent, or supplied-but-unapproved, licence.

        Two distinct rules, both fail-closed:
          1. the model *requires* an approval -> the path must be set and approved;
          2. the config *supplies* a path at all -> it must load and be approved,
             even for a model that does not require one. Silently ignoring a
             supplied-but-pending approval would read as "the gate ran and
             passed", which is worse than having no gate.
        """
        path = self.config.licence_approval_path
        if self.requires_licence_approval:
            return require_licence_approval(path)
        if path is not None:
            return load_licence_approval(path)
        return None

    def _gate_data_manifest(self) -> DataManifest | None:
        """Fail closed on a required-but-absent manifest, or any changed/missing digest.

        Same two rules as the licence gate: required-and-absent fails, and a
        supplied manifest is always verified even when the model does not
        declare that it needs one.
        """
        path = self.config.dataset_manifest_path
        if self.requires_dataset_manifest:
            manifest = require_data_manifest(path)
        elif path is not None:
            manifest = load_data_manifest(path)
        else:
            return None
        manifest.verify()
        return manifest

    def run_gates(self) -> GateResult:
        """Run every fail-closed gate. Raises ModelLabError; returns what it checked."""
        licence = self._gate_licence()
        manifest = self._gate_data_manifest()
        checked: list[str] = []
        if licence is not None:
            checked.append("licence_approval")
        if manifest is not None:
            checked.append("dataset_manifest")
        return GateResult(licence=licence, data_manifest=manifest, checked=tuple(checked))

    def execute(self, command: str) -> Any:
        """Run one subcommand *through the gate*. The only entry point cli.py uses.

        Calling `job.train()` (etc.) directly bypasses the gate by construction;
        nothing in this package does that, and subclasses cannot override this
        method (see __init_subclass__).
        """
        handlers: Dict[str, Callable[[], Any]] = {
            "preflight": self.preflight,
            "dry-run": self.dry_run,
            "smoke": self.smoke,
            "train": self.train,
            "evaluate": self.evaluate,
            "build-release": self.build_release,
        }
        if command not in handlers:
            raise ConfigError(f"unknown job command {command!r}; known: {sorted(handlers)}")
        self.run_gates()
        return handlers[command]()

    # -- the per-model contract ---------------------------------------------

    @abc.abstractmethod
    def preflight(self) -> PreflightReport:
        """Validate environment/config expectations. Never provisions anything."""

    @abc.abstractmethod
    def dry_run(self) -> DryRunResult:
        """Resolve and validate the complete job without executing it."""

    @abc.abstractmethod
    def smoke(self) -> SmokeResult:
        """Run against tiny local fixtures only. No network, no real data, no real weights."""

    @abc.abstractmethod
    def train(self) -> StepResult:
        """The training command contract. No real training is authorized in this code-build."""

    @abc.abstractmethod
    def evaluate(self) -> StepResult:
        """The evaluation command contract."""

    @abc.abstractmethod
    def build_release(self) -> StepResult:
        """The release-build command contract. Must be deterministic or report why not."""


_REGISTRY: Dict[str, Type[JobSpec]] = {}


def register_job(name: str, cls: Type[JobSpec]) -> None:
    _REGISTRY[name] = cls


def get_job_class(name: str) -> Type[JobSpec]:
    try:
        return _REGISTRY[name]
    except KeyError as exc:
        raise ConfigError(
            f"no job registered for model_name={name!r}; known: {sorted(_REGISTRY)}"
        ) from exc


def registered_models() -> tuple[str, ...]:
    return tuple(sorted(_REGISTRY))
