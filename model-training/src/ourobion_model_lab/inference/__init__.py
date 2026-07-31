"""Private, offline, read-only research inference over frozen model releases.

Issue #266. This package exists to run the frozen Zebra v1 and Viceroy v0
checkpoints over explicitly supplied public/frozen input manifests and emit
**research-only** predictions. It is not product serving, and nothing here may
be wired into `RelationshipClaim`, `EdgeVerification`, `verified_edges`, edge
scores/bands, cards, Supabase, nao, or biotope.

Two invariants are load-bearing and enforced by tests, not by convention:

1. **Stdlib only at import time.** Per D2 (docs/temp/model-training/
   code-build-decisions.md) the core substrate imports nothing outside the
   standard library. Torch and Transformers are imported *inside functions* in
   `runners/`, never at module scope, so `import ourobion_model_lab.inference`
   stays free in the zero-install CI job. `tests/test_inference_imports.py`
   asserts this by inspecting `sys.modules` after import.

2. **Fail-closed artifact acquisition.** A release is identified by the SHA-256
   of its own checksum manifest, so the expected per-file digests cannot be
   edited without changing the release id. `acquire.py` refuses to hand a
   model directory to a runner unless every byte matched. There is deliberately
   no fallback to Hugging Face Hub, a local cache, another release, or randomly
   initialised weights: an unverifiable model is a stop, not a warning.
"""

from __future__ import annotations
