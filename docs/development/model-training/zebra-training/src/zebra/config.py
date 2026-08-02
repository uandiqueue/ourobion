"""Zebra NLI Shadow v0 — configuration, seeding, and device selection.

Everything in this module is import-cheap: `torch` is only ever imported *inside* the functions
that need it (`set_seed`, `select_device`), never at module import time. That keeps
``import zebra.config`` — and therefore ``python -m zebra.cli preflight`` — fast and possible
even before the pinned ML stack is installed or on a machine that only has the interpreter.
"""

import dataclasses
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import ClassVar, Mapping

# ``src/zebra/config.py`` -> parents[0]=src/zebra, [1]=src, [2]=zebra-training (the bundle root).
_THIS_FILE = Path(__file__).resolve()
_BUNDLE_ROOT = _THIS_FILE.parents[2]


def _default_data_dir() -> Path:
    return _BUNDLE_ROOT / "assets" / "scifact_entailment"


def _default_output_dir() -> Path:
    return _BUNDLE_ROOT / "outputs"


def _default_cache_dir() -> Path:
    return _BUNDLE_ROOT / ".cache"


@dataclass(frozen=True)
class ZebraConfig:
    """The preregistered Zebra NLI Shadow v0 recipe, plus the label-blind evidence-retrieval
    knobs that ``zebra.data`` needs. Frozen so a run's config cannot drift mid-run; anything
    that looks like it needs to change should produce a *new* config (and a new config_hash),
    not a mutation of this one.

    Field groups:
      - training recipe (max_seq_len .. epochs, seed): the preregistered hyperparameters.
      - cross-validation (n_folds, min_per_class_per_fold): consumed by ``zebra.splits``.
      - evidence-retrieval policy (evidence_top_k, bm25_k1, bm25_b, oracle_evidence): consumed
        by ``zebra.data``. These are deliberately part of the *same* frozen config object that
        the label-blind selector receives as its third positional argument, because that config
        object is a global, example-independent recipe — it has no per-row slot a label could
        ever occupy. See ``zebra/data.py`` module docstring for the full label-blind argument.
      - paths: bundle-local by default (see OWNER-NOTE.md — everything lives in this folder).
    """

    # --- training recipe -------------------------------------------------------------------
    max_seq_len: int = 384
    lr: float = 2e-5
    weight_decay: float = 0.01
    effective_batch_size: int = 32
    # Physical (per-step) batch size; gradient accumulation makes up the difference to reach
    # effective_batch_size. Kept small by default for a CPU/MPS run on a laptop-class machine.
    physical_batch_size: int = 8
    warmup_ratio: float = 0.1
    grad_clip: float = 1.0
    epochs: int = 5
    seed: int = 42

    # --- cross-validation --------------------------------------------------------------------
    n_folds: int = 5
    # ~1,259 rows (919 train + 340 dev) over 3 classes is NOT guaranteed to give every fold
    # viable per-class support once folds are locked to whole claim/abstract components
    # (zebra.splits never splits a component across folds). This minimum is enforced, not
    # assumed — see zebra.splits.assert_min_class_support. 5 is a conservative starting point;
    # revisit once the real per-fold class counts are measured.
    min_per_class_per_fold: int = 5

    # --- evidence-retrieval policy (see zebra/data.py) ----------------------------------------
    # Number of sentences the label-blind BM25-style retriever selects from the abstract, same
    # for every class (requirement: one policy for every class).
    evidence_top_k: int = 3
    bm25_k1: float = 1.5
    bm25_b: float = 0.75
    # Off-by-default secondary-analysis switch. NEVER flip this except for a clearly-labelled
    # oracle-evidence side experiment — see zebra/data.py's module docstring for why the
    # default path must stay label-blind.
    oracle_evidence: bool = False

    # --- model reference (consumed by cli.py / model.py, not by this module) -----------------
    # NOTE: this identifier has NOT been verified against the HF Hub from this (offline,
    # Windows) environment — confirm it resolves before the Mac run, and correct it here (one
    # place) if it doesn't. OWNER-NOTE.md describes the target as "BiomedBERT, 110M parameters".
    model_name: str = "microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext"

    # --- paths (bundle-local; see OWNER-NOTE.md "everything lives inside this one folder") ----
    data_dir: Path = field(default_factory=_default_data_dir)
    output_dir: Path = field(default_factory=_default_output_dir)
    cache_dir: Path = field(default_factory=_default_cache_dir)

    _PATH_FIELDS: ClassVar[tuple[str, ...]] = ("data_dir", "output_dir", "cache_dir")

    def __post_init__(self) -> None:
        if self.max_seq_len <= 0:
            raise ValueError(f"max_seq_len must be positive, got {self.max_seq_len}")
        if self.physical_batch_size <= 0 or self.effective_batch_size <= 0:
            raise ValueError("batch sizes must be positive")
        if self.effective_batch_size % self.physical_batch_size != 0:
            raise ValueError(
                "effective_batch_size must be an exact multiple of physical_batch_size "
                f"(got effective={self.effective_batch_size}, physical={self.physical_batch_size})"
            )
        if not (0.0 <= self.warmup_ratio < 1.0):
            raise ValueError(f"warmup_ratio must be in [0, 1), got {self.warmup_ratio}")
        if self.grad_clip <= 0:
            raise ValueError(f"grad_clip must be positive, got {self.grad_clip}")
        if self.epochs <= 0:
            raise ValueError(f"epochs must be positive, got {self.epochs}")
        if self.n_folds < 2:
            raise ValueError(f"n_folds must be >= 2, got {self.n_folds}")
        if self.min_per_class_per_fold < 0:
            raise ValueError("min_per_class_per_fold cannot be negative")
        if self.evidence_top_k < 1:
            raise ValueError(f"evidence_top_k must be >= 1, got {self.evidence_top_k}")
        if self.bm25_k1 <= 0:
            raise ValueError(f"bm25_k1 must be positive, got {self.bm25_k1}")
        if not (0.0 <= self.bm25_b <= 1.0):
            raise ValueError(f"bm25_b must be in [0, 1], got {self.bm25_b}")

    @property
    def gradient_accumulation_steps(self) -> int:
        """Number of physical-batch steps per optimizer step. Validated in __post_init__, so
        this division is always exact."""
        return self.effective_batch_size // self.physical_batch_size

    # --- (de)serialization --------------------------------------------------------------------

    def to_dict(self) -> dict:
        d = dataclasses.asdict(self)
        for f in self._PATH_FIELDS:
            d[f] = str(d[f])
        return d

    @classmethod
    def from_dict(cls, data: Mapping[str, object]) -> "ZebraConfig":
        data = dict(data)
        for f in cls._PATH_FIELDS:
            if f in data and data[f] is not None:
                data[f] = Path(data[f])
        field_names = {f.name for f in dataclasses.fields(cls)}
        filtered = {k: v for k, v in data.items() if k in field_names}
        return cls(**filtered)

    def config_hash(self) -> str:
        """Stable hash of the resolved config, for the artifact manifest. Any change to any
        field (including paths) changes this hash."""
        payload = self.to_dict()
        blob = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "ZebraConfig":
        path = Path(path)
        # utf-8-sig: transparently swallows a BOM (e.g. from a file saved by Windows Notepad)
        # instead of raising an opaque JSONDecodeError on the invisible leading byte.
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
        return cls.from_dict(data)


def set_seed(seed: int) -> None:
    """Seeds every source of randomness this pipeline touches: stdlib `random`, `numpy`, and
    (lazily) `torch`, including its MPS RNG when MPS is actually usable. `torch` is imported
    inside this function, not at module level, so `zebra.config` stays importable without it.
    """
    import random

    random.seed(seed)

    import numpy as np

    np.random.seed(seed)

    import torch  # lazy: see module docstring

    torch.manual_seed(seed)
    if torch.backends.mps.is_built() and torch.backends.mps.is_available():
        mps_seed_fn = getattr(torch.mps, "manual_seed", None)
        if mps_seed_fn is not None:
            mps_seed_fn(seed)


def select_device() -> tuple[str, str]:
    """Prefer MPS when it is genuinely usable; otherwise CPU. Never requires or touches CUDA —
    this bundle is arm64/Metal-only by design (see requirements-macos.txt).

    MPS can report ``is_available() == True`` and then silently misbehave or fall back for
    certain ops, so — mirroring setup-macos.sh's own verification step — this does a real
    smoke matmul rather than trusting the availability flag alone. Returns
    ``(device, human_reason)`` so the reason string can be written into the run manifest;
    a run must be able to say what it actually used, not just what it hoped for.
    """
    import torch  # lazy: see module docstring

    if not torch.backends.mps.is_built():
        return "cpu", "MPS not built into this torch install; using CPU"
    if not torch.backends.mps.is_available():
        return (
            "cpu",
            "MPS built but not available on this machine (no Apple GPU / unsupported macOS "
            "version); using CPU",
        )
    try:
        x = torch.randn(8, 8, device="mps") @ torch.randn(8, 8, device="mps")
        torch.mps.synchronize()
        if not str(x.device).startswith("mps"):
            return "cpu", f"MPS smoke matmul landed on unexpected device {x.device!r}; using CPU"
        return "mps", "MPS built, available, and a smoke matmul completed on-device"
    except Exception as exc:  # pragma: no cover - exact failure mode not verified offline
        return "cpu", f"MPS reported available but the smoke matmul raised {exc!r}; using CPU"
