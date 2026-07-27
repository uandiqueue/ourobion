"""Zebra NLI Shadow v0 — a three-way cross-encoder (supported / contradicted /
insufficient_evidence) over SciFact claim+abstract pairs.

This package deliberately does not import torch/transformers/datasets at import time (they stay
lazy inside the specific functions that need them, e.g. `config.set_seed`, `config.select_device`,
and everything in `model.py`), so `import zebra` and a preflight self-check stay fast and possible
even before the pinned ML stack is installed — see requirements-macos.txt / setup-macos.sh.

`metrics.py` is pure standard library (no numpy/scipy/torch, even lazily). `model.py` keeps
torch/transformers imports lazy inside its functions, so importing `zebra.model` itself stays
cheap; only calling into it actually requires the ML stack. `cli.py` is meant to be run as
`python -m zebra.cli`, not imported from here.
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
from .metrics import (
    DEFAULT_ABSTENTION_THRESHOLDS,
    MetricsError,
    abstention_and_selective_error,
    apply_temperature,
    balanced_accuracy,
    bootstrap_balanced_accuracy_ci,
    bootstrap_ci_by_component,
    bootstrap_macro_f1_ci,
    confusion_matrix,
    ece_equal_mass,
    fit_temperature,
    lexical_overlap_baseline_predict,
    macro_f1,
    majority_class_label,
    majority_class_probs,
    multiclass_brier,
    per_class_prf1,
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
    "DEFAULT_ABSTENTION_THRESHOLDS",
    "MetricsError",
    "abstention_and_selective_error",
    "apply_temperature",
    "balanced_accuracy",
    "bootstrap_balanced_accuracy_ci",
    "bootstrap_ci_by_component",
    "bootstrap_macro_f1_ci",
    "confusion_matrix",
    "ece_equal_mass",
    "fit_temperature",
    "lexical_overlap_baseline_predict",
    "macro_f1",
    "majority_class_label",
    "majority_class_probs",
    "multiclass_brier",
    "per_class_prf1",
    "__version__",
]
