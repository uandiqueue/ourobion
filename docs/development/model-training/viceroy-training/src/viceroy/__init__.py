"""Viceroy Causal-Language-Risk v0 — a four-way classifier (no_relationship / direct_causal /
conditional_causal / correlational) over PubMed conclusion sentences.

This model detects **which causal language an author used**. It does not, and must not, fill
``EdgeVerification.claimKindCheck`` — that field asks what a claim's independently retrieved
evidence *licenses*, which is a different question. The scope boundary is enforced mechanically by
``data.preflight_check_scope_boundary``; see ``data.py``'s module docstring.

This package deliberately does not import torch/transformers/datasets at import time (they stay
lazy inside the specific functions that need them, e.g. `config.set_seed`, `config.select_device`,
and everything in `model.py`), so `import viceroy` and a preflight self-check stay fast and
possible even before the pinned ML stack is installed — see requirements-macos.txt /
setup-macos.sh.

`metrics.py` and `splits.py` are pure standard library (no numpy/scipy/torch, even lazily).
`model.py` keeps torch/transformers imports lazy inside its functions, so importing
`viceroy.model` itself stays cheap; only calling into it actually requires the ML stack. `cli.py`
is meant to be run as `python -m viceroy.cli`, not imported from here.
"""

from .config import GROUP_POLICIES, ViceroyConfig, select_device, set_seed
from .data import (
    CLASS_NAMES,
    CONTRACT_MAP,
    NATIVE_LABEL_IDS,
    NEVER_PREDICTED,
    ProcessedExample,
    RawExample,
    build_dataset,
    build_example,
    class_distribution_report,
    conflicting_label_report,
    dedup_key_for,
    map_to_contract_claim_kind,
    normalize_text,
    preflight_check_scope_boundary,
    preprocessing_version_hash,
    token_length_report,
    tokens_for_similarity,
)
from .splits import (
    GroupPolicyError,
    InsufficientFoldSupportError,
    SplitLeakageError,
    SplitResult,
    assert_min_class_support,
    assert_no_cross_fold_leakage,
    assign_folds,
    build_groups,
    build_splits,
    candidate_pairs,
    drop_conflicting_label_rows,
    fold_class_table,
    fold_group_table,
    jaccard,
    near_duplicate_pairs,
    residual_leakage_audit,
)
from .metrics import (
    CAUSAL_LABELS,
    DEFAULT_ABSTENTION_THRESHOLDS,
    MetricsError,
    abstention_and_selective_error,
    accuracy,
    apply_temperature,
    balanced_accuracy,
    bootstrap_balanced_accuracy_ci,
    bootstrap_ci_by_group,
    bootstrap_macro_f1_ci,
    causal_cue_baseline_predict,
    confusion_matrix,
    cross_validation_summary,
    directional_confusion_report,
    ece_equal_mass,
    fit_temperature,
    macro_f1,
    majority_class_label,
    majority_class_probs,
    multiclass_brier,
    per_class_prf1,
)

__version__ = "0.1.0-risk"

__all__ = [
    "ViceroyConfig",
    "GROUP_POLICIES",
    "set_seed",
    "select_device",
    "CLASS_NAMES",
    "CONTRACT_MAP",
    "NATIVE_LABEL_IDS",
    "NEVER_PREDICTED",
    "ProcessedExample",
    "RawExample",
    "build_dataset",
    "build_example",
    "class_distribution_report",
    "conflicting_label_report",
    "dedup_key_for",
    "map_to_contract_claim_kind",
    "normalize_text",
    "preflight_check_scope_boundary",
    "preprocessing_version_hash",
    "token_length_report",
    "tokens_for_similarity",
    "GroupPolicyError",
    "InsufficientFoldSupportError",
    "SplitLeakageError",
    "SplitResult",
    "assert_min_class_support",
    "assert_no_cross_fold_leakage",
    "assign_folds",
    "build_groups",
    "build_splits",
    "candidate_pairs",
    "drop_conflicting_label_rows",
    "fold_class_table",
    "fold_group_table",
    "jaccard",
    "near_duplicate_pairs",
    "residual_leakage_audit",
    "CAUSAL_LABELS",
    "DEFAULT_ABSTENTION_THRESHOLDS",
    "MetricsError",
    "abstention_and_selective_error",
    "accuracy",
    "apply_temperature",
    "balanced_accuracy",
    "bootstrap_balanced_accuracy_ci",
    "bootstrap_ci_by_group",
    "bootstrap_macro_f1_ci",
    "causal_cue_baseline_predict",
    "confusion_matrix",
    "cross_validation_summary",
    "directional_confusion_report",
    "ece_equal_mass",
    "fit_temperature",
    "macro_f1",
    "majority_class_label",
    "majority_class_probs",
    "multiclass_brier",
    "per_class_prf1",
    "__version__",
]
