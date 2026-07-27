"""Zebra NLI Shadow v0 — a three-way cross-encoder (supported / contradicted /
insufficient_evidence) over SciFact claim+abstract pairs.

This package deliberately does not import torch/transformers/datasets at import time (they stay
lazy inside the specific functions that need them, e.g. `config.set_seed` and
`config.select_device`), so `import zebra` and a preflight self-check stay fast and possible even
before the pinned ML stack is installed — see requirements-macos.txt / setup-macos.sh.

Only `config`, `data`, and `splits` are implemented so far. `metrics.py`, `model.py`, and
`cli.py` are a separate, later task and are not imported here.
"""

from .config import ZebraConfig, select_device, set_seed
from .data import (
    CLASS_NAMES,
    LABEL_MAP,
    ProcessedExample,
    RawExample,
    SelectedEvidence,
    build_dataset,
    build_example,
    evidence_shortcut_report,
    fit_evidence_to_budget,
    normalize_text,
    preflight_check_label_blind,
    preprocessing_version_hash,
    select_evidence_sentences,
    select_oracle_evidence_sentences,
)
from .splits import (
    InsufficientFoldSupportError,
    SplitLeakageError,
    SplitResult,
    assert_min_class_support,
    assert_no_cross_fold_leakage,
    assert_no_train_dev_leakage,
    build_components,
    build_splits,
    dedupe_rows,
    fold_class_table,
    fold_component_table,
)

__version__ = "0.1.0-shadow"

__all__ = [
    "ZebraConfig",
    "set_seed",
    "select_device",
    "CLASS_NAMES",
    "LABEL_MAP",
    "ProcessedExample",
    "RawExample",
    "SelectedEvidence",
    "build_dataset",
    "build_example",
    "evidence_shortcut_report",
    "fit_evidence_to_budget",
    "normalize_text",
    "preflight_check_label_blind",
    "preprocessing_version_hash",
    "select_evidence_sentences",
    "select_oracle_evidence_sentences",
    "InsufficientFoldSupportError",
    "SplitLeakageError",
    "SplitResult",
    "assert_min_class_support",
    "assert_no_cross_fold_leakage",
    "assert_no_train_dev_leakage",
    "build_components",
    "build_splits",
    "dedupe_rows",
    "fold_class_table",
    "fold_component_table",
    "__version__",
]
