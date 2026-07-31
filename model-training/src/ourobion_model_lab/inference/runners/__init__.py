"""Model-native research runners.

Import-time cost here is stdlib only; each runner imports Torch/Transformers
inside its own call path (see `_engine`). Nothing in this package maps a
model-native label onto a product verdict.
"""

from __future__ import annotations
