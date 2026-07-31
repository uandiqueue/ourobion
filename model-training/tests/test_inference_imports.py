"""The inference package must stay stdlib-only at import time (D2).

This is asserted rather than reviewed because the failure is silent and remote:
a stray module-level `import torch` in a runner would break the zero-install
`model-training-core` CI job with an ImportError that looks like an
infrastructure problem rather than a boundary violation.
"""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path

HEAVY_MODULES = ("torch", "transformers", "numpy", "scipy", "sklearn", "datasets")

# CI exports PYTHONPATH=src with cwd=model-training. Deriving the path from this
# file instead means the test is correct however it is invoked, rather than
# passing only under one runner's cwd.
_SRC = Path(__file__).resolve().parents[1] / "src"


def _child_env() -> dict[str, str]:
    env = dict(os.environ)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = os.pathsep.join(p for p in (str(_SRC), existing) if p)
    return env


class TestImportPurity(unittest.TestCase):
    def test_importing_inference_pulls_no_ml_dependency(self):
        # A subprocess, not this interpreter: the test suite may already have
        # imported something heavy, which would make an in-process check pass
        # for the wrong reason.
        program = (
            "import sys;"
            "import ourobion_model_lab.inference as pkg;"
            "import ourobion_model_lab.inference.acquire;"
            "import ourobion_model_lab.inference.predict;"
            "import ourobion_model_lab.inference.r2;"
            "import ourobion_model_lab.inference.releases;"
            "import ourobion_model_lab.inference.schemas;"
            "import ourobion_model_lab.inference.runners.zebra;"
            "import ourobion_model_lab.inference.runners.viceroy;"
            f"leaked=[m for m in {HEAVY_MODULES!r} if m in sys.modules];"
            "print(','.join(leaked))"
        )
        result = subprocess.run(
            [sys.executable, "-c", program],
            capture_output=True,
            text=True,
            check=False,
            env=_child_env(),
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        leaked = result.stdout.strip()
        self.assertEqual(
            leaked,
            "",
            msg=(
                f"importing the inference package pulled in {leaked!r} at module scope. "
                "Torch/Transformers must be imported inside functions in runners/_engine.py."
            ),
        )

    def test_cli_import_does_not_pull_inference_or_torch(self):
        program = (
            "import sys;"
            "import ourobion_model_lab.cli;"
            "print('inference' if 'ourobion_model_lab.inference' in sys.modules else '');"
        )
        result = subprocess.run(
            [sys.executable, "-c", program],
            capture_output=True,
            text=True,
            check=False,
            env=_child_env(),
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(
            result.stdout.strip(),
            "",
            msg="cli.py must import the inference package lazily inside the predict branch",
        )


if __name__ == "__main__":
    unittest.main()
