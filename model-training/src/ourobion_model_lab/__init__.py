"""ourobion_model_lab -- core substrate for Ourobion's model-training workspace.

Core-substrate rule (D2, docs/temp/model-training/code-build-decisions.md):
everything importable from this top-level package and its direct submodules
must depend on the Python standard library only. Heavy ML dependencies
(torch, transformers, datasets, scikit-learn, onnxruntime, ...) are optional
extras declared in model-training/pyproject.toml and must only be imported
lazily, inside model-specific code under ourobion_model_lab.models.*, never
here.
"""
from __future__ import annotations

__version__ = "0.0.1"

from . import self_check as _self_check  # noqa: F401  (registers the "self-check" reference job)

__all__ = ["__version__"]
