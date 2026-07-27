#!/usr/bin/env bash
# Zebra NLI Shadow v0 — one-time environment setup for Apple Silicon.
#
# Creates a self-contained Python 3.10 virtualenv inside this folder and installs the pinned
# dependencies. Touches nothing outside this directory: no sudo, no Homebrew installs, no login
# items, no system configuration. Remove everything by deleting this folder.
#
# Usage:   bash setup-macos.sh
# Undo:    rm -rf .venv        (or delete the whole folder)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

VENV="$HERE/.venv"
NEED_PY="3.10"

echo "== Zebra setup =="
echo "folder: $HERE"

# --- locate a Python 3.10 interpreter --------------------------------------------------------
# Prefer an existing 3.10; do not install one silently on someone else's machine.
PY=""
for cand in python3.10 python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then
    v="$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo "")"
    if [ "$v" = "$NEED_PY" ]; then PY="$cand"; break; fi
    [ -z "$PY" ] && FALLBACK="$cand" && FALLBACK_V="$v"
  fi
done

if [ -z "$PY" ]; then
  echo
  echo "!! No Python ${NEED_PY} found."
  echo "   Found instead: ${FALLBACK:-none} ${FALLBACK_V:-}"
  echo
  echo "   The pinned stack targets ${NEED_PY} because that is what the project's CI pins and what"
  echo "   the pinned wheels are built for. Newer Pythons (3.13+) have NO wheels for numpy 1.26.4,"
  echo "   scipy 1.13.1, scikit-learn 1.5.1 or torch 2.4.1 — this is a hard blocker, not a warning."
  echo
  echo "   Options, in order of preference:"
  echo "     1. brew install python@3.10        (then re-run this script)"
  echo "     2. use pyenv / conda to provide 3.10"
  echo
  echo "   Nothing has been installed or changed. Exiting."
  exit 1
fi

echo "python: $PY ($("$PY" --version 2>&1))"

# --- create the venv --------------------------------------------------------------------------
if [ -d "$VENV" ]; then
  echo "venv already exists at .venv — reusing it"
else
  echo "creating venv at .venv"
  "$PY" -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"

python -m pip install --quiet --upgrade pip
echo "installing pinned dependencies (~150 MB download, ~600 MB installed)..."
python -m pip install --quiet -r "$HERE/requirements-macos.txt"

# --- verify -------------------------------------------------------------------------------------
echo
echo "== verification =="
python - <<'PYCHECK'
import platform, sys
import torch, transformers, datasets, numpy, scipy, sklearn

print(f"{'python':14} {sys.version.split()[0]}  ({platform.machine()})")
for name, mod in [("torch", torch), ("transformers", transformers), ("datasets", datasets),
                  ("numpy", numpy), ("scipy", scipy), ("scikit-learn", sklearn)]:
    print(f"{name:14} {mod.__version__}")

mps_built = torch.backends.mps.is_built()
mps_ok = torch.backends.mps.is_available()
print(f"\nMPS (Apple GPU) built: {mps_built}   available: {mps_ok}")
if mps_ok:
    # prove a real tensor op runs on the GPU, not just that the backend reports available
    x = torch.randn(64, 64, device="mps") @ torch.randn(64, 64, device="mps")
    torch.mps.synchronize()
    print(f"MPS smoke matmul OK, result device = {x.device}")
else:
    print("MPS unavailable -> training will run on CPU. Still fine for this dataset, just slower.")
PYCHECK

echo
echo "== setup complete =="
echo "Next:  source .venv/bin/activate  &&  python -m zebra.cli preflight"
echo "Undo:  rm -rf '$VENV'"
