"""Viceroy Causal-Language-Risk v0 — configuration, seeding, and device selection.

Everything in this module is import-cheap: `torch` is only ever imported *inside* the functions
that need it (`set_seed`, `select_device`), never at module import time. That keeps
``import viceroy.config`` — and therefore ``python -m viceroy.cli preflight`` — fast and possible
even before the pinned ML stack is installed or on a machine that only has the interpreter.

(Same convention as the Zebra bundle; these two bundles are siblings, not a shared library. They
are deliberately kept as separate copies so a change to one cannot silently alter the other's
preregistered recipe, and so this model's GPL-3.0 data dependency stays in its own namespace —
see CONTEXT.md "Licence isolation".)
"""

import dataclasses
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import ClassVar, Mapping

# ``src/viceroy/config.py`` -> parents[0]=src/viceroy, [1]=src, [2]=viceroy-training (bundle root).
_THIS_FILE = Path(__file__).resolve()
_BUNDLE_ROOT = _THIS_FILE.parents[2]


def _default_data_dir() -> Path:
    return _BUNDLE_ROOT / "assets" / "causal_language_use"


def _default_output_dir() -> Path:
    return _BUNDLE_ROOT / "outputs"


def _default_cache_dir() -> Path:
    return _BUNDLE_ROOT / ".cache"


# Group-assignment policies for cross-validation folds. See ``viceroy.splits`` and LEAKAGE.md.
#
#   "surrogate" (default) — the labelled corpus ships NO paper id (measured: the released
#       pubmed_causal_language_use.csv has exactly two columns, `sentence` and `label`), so
#       same-paper sentences are grouped by lexical near-duplicate linkage instead. This is an
#       acknowledged *surrogate* for paper identity with imperfect recall, not a replacement.
#   "pmid" — group by a real `pmid` column. Fails closed if the column is absent or incomplete
#       rather than silently degenerating to row-level splitting. Use this if a PMID-carrying
#       version of the corpus is ever obtained.
#   "row" — no grouping at all. This is what the upstream repository's own main.py does
#       (StratifiedKFold over sentences, random_state=0), and it is why the published
#       0.90 accuracy / 0.88 macro-F1 anchor is NOT comparable to a group-safe number. Available
#       only so that comparison can be reproduced deliberately; it is recorded loudly in every
#       artifact as an unsafe split.
GROUP_POLICIES: tuple[str, ...] = ("surrogate", "pmid", "row")


@dataclass(frozen=True)
class ViceroyConfig:
    """The preregistered Viceroy Causal-Language-Risk v0 recipe, plus the leakage-control knobs
    that ``viceroy.splits`` needs. Frozen so a run's config cannot drift mid-run; anything that
    looks like it needs to change should produce a *new* config (and a new config_hash), not a
    mutation of this one.

    Field groups:
      - training recipe (max_seq_len .. seed): the preregistered hyperparameters.
      - class imbalance (class_weighting): weights are derived from the training distribution,
        never tuned — see ``viceroy.model.class_weights``.
      - cross-validation + leakage control (n_folds .. drop_conflicting_labels): consumed by
        ``viceroy.splits``. These carry more weight in this bundle than they would elsewhere,
        because this corpus has no paper id to group on; read LEAKAGE.md before changing any of
        them.
      - paths: bundle-local by default (see OWNER-NOTE.md — everything lives in this folder).
    """

    # --- training recipe -------------------------------------------------------------------
    # 256 (not Zebra's 384): the input is a single conclusion sentence, and the measured token
    # length distribution of the corpus is min 3 / median 18 / p90 30 / max 57 whitespace tokens,
    # so 256 wordpieces is already generous headroom rather than a binding constraint.
    max_seq_len: int = 256
    lr: float = 2e-5
    weight_decay: float = 0.01
    effective_batch_size: int = 16
    physical_batch_size: int = 8
    warmup_ratio: float = 0.1
    grad_clip: float = 1.0
    epochs: int = 5
    seed: int = 42

    # --- class imbalance ----------------------------------------------------------------------
    # Measured class counts: no_relationship 1356 · correlational 998 · direct_causal 494 ·
    # conditional_causal 213. That is ~6.4:1 between the largest and smallest class, so a
    # majority-class predictor scores 44% accuracy — which is exactly why accuracy alone must
    # never be reported (see INTERPRETING-RESULTS.md).
    class_weighting: bool = True

    # --- cross-validation ----------------------------------------------------------------------
    n_folds: int = 5
    # The rarest class (conditional_causal, 213 rows) gives ~42 rows per fold at 5 folds, so 20
    # is a genuinely reachable minimum rather than a hopeful one. It is still *checked*, not
    # assumed — see viceroy.splits.assert_min_class_support.
    min_per_class_per_fold: int = 20

    # --- leakage control (see viceroy/splits.py and LEAKAGE.md) --------------------------------
    group_policy: str = "surrogate"
    # Two sentences whose token sets are at least this Jaccard-similar are treated as the same
    # group (i.e. presumed same paper / same boilerplate) and can never land in different folds.
    # 0.80 is the preregistered value; it was chosen from a measured sweep on the real corpus
    # (see LEAKAGE.md "Why 0.80"), not tuned against a score.
    near_dup_jaccard: float = 0.80
    # A deliberately LOWER threshold used only for the post-hoc residual audit: pairs at or above
    # this similarity that still ended up in different folds are reported as leakage this policy
    # did NOT catch. Reporting what was missed is the point — a grouping threshold always has
    # imperfect recall, and a run that claims zero leakage is claiming something it cannot know.
    audit_jaccard: float = 0.60
    # Candidate-pair generation caps how many rows a shared token may link, so near-duplicate
    # detection stays roughly linear instead of quadratic. A token appearing in more rows than
    # this is too common to be evidence of shared provenance ("patients", "significant", ...).
    max_posting_length: int = 40
    # The corpus contains one sentence annotated with two different labels (measured). Silently
    # keeping both copies would put contradictory supervision in different folds; silently
    # dropping them would hide an annotation problem. Default: drop, and count it loudly.
    drop_conflicting_labels: bool = True

    # --- model reference (consumed by cli.py / model.py, not by this module) -----------------
    # Same MIT-licensed base encoder as the Zebra bundle. The base model's licence is clean; the
    # GPL-3.0 question attaches to the *data* (see licence-approval.example.json).
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
        if self.group_policy not in GROUP_POLICIES:
            raise ValueError(
                f"group_policy must be one of {GROUP_POLICIES}, got {self.group_policy!r}"
            )
        if not (0.0 < self.near_dup_jaccard <= 1.0):
            raise ValueError(f"near_dup_jaccard must be in (0, 1], got {self.near_dup_jaccard}")
        if not (0.0 < self.audit_jaccard <= 1.0):
            raise ValueError(f"audit_jaccard must be in (0, 1], got {self.audit_jaccard}")
        if self.audit_jaccard > self.near_dup_jaccard:
            # The audit must look *below* the grouping threshold. An audit threshold above the
            # grouping threshold could only ever re-confirm what grouping already guaranteed,
            # which would make the residual-leakage report vacuously clean.
            raise ValueError(
                f"audit_jaccard ({self.audit_jaccard}) must be <= near_dup_jaccard "
                f"({self.near_dup_jaccard}); an audit at or above the grouping threshold cannot "
                "find anything grouping missed, so it would report a false all-clear"
            )
        if self.max_posting_length < 2:
            raise ValueError(f"max_posting_length must be >= 2, got {self.max_posting_length}")

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
    def from_dict(cls, data: Mapping[str, object]) -> "ViceroyConfig":
        data = dict(data)
        for f in cls._PATH_FIELDS:
            if f in data and data[f] is not None:
                data[f] = Path(data[f])
        field_names = {f.name for f in dataclasses.fields(cls)}
        filtered = {k: v for k, v in data.items() if k in field_names}
        return cls(**filtered)

    def config_hash(self) -> str:
        """Stable hash of the resolved config, for the artifact manifest. Any change to any
        field (including paths and the leakage knobs) changes this hash."""
        payload = self.to_dict()
        blob = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "ViceroyConfig":
        path = Path(path)
        # utf-8-sig: transparently swallows a BOM (e.g. from a file saved by Windows Notepad)
        # instead of raising an opaque JSONDecodeError on the invisible leading byte.
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
        return cls.from_dict(data)


def set_seed(seed: int) -> None:
    """Seeds every source of randomness this pipeline touches: stdlib `random`, `numpy`, and
    (lazily) `torch`, including its MPS RNG when MPS is actually usable. `torch` is imported
    inside this function, not at module level, so `viceroy.config` stays importable without it.
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
