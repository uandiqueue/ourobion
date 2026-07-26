#!/bin/bash
# graphify-build.sh - (re)build biotope's semantic context graph with graphify (macOS/Linux/Git Bash).
#
# Usage (from the repo root):
#     ./scripts/graphify-build.sh             # AST-only, local, no LLM, no network
#     ./scripts/graphify-build.sh --cluster   # also run community detection (clustering)
#
# graphify is the SEMANTIC / agent-context layer (memory 0008); it is complementary to the structural
# import-graph that docs/graph/README.md marks DEFERRED. The graph it writes to graphify-out/ is a
# rebuildable PROJECTION (two-tier-truth) - gitignored, never hand-edited. This script also refreshes
# the single tracked, interactive human view in docs/graph/semantic-graph.html.
#
# graphify is build tooling, NOT a repo/runtime dependency: it installs into a project-bounded venv
# inside the toolchain (default ../biotope-toolchain/graphify-venv), nothing touches the global PATH,
# and the venv is never committed or deployed. This script bootstraps that venv on first run.
#
# The cross-language SEMANTIC pass is driven by the host AI assistant (no API key needed inside Claude
# Code) or, headless, by a backend API key (ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY).
# This script only runs the local AST pass; see README "Code navigation - graphify".

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TOOLCHAIN="${BIOTOPE_TOOLCHAIN:-$(dirname "$REPO_ROOT")/biotope-toolchain}"
VENV_DIR="$TOOLCHAIN/graphify-venv"
GRAPHIFY="$VENV_DIR/bin/graphify"

# --- Bootstrap the project-bounded graphify venv on first run ---
if [ ! -x "$GRAPHIFY" ]; then
  echo "graphify not found - bootstrapping project-bounded venv at $VENV_DIR ..."
  if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found. Install Python 3 to use graphify." >&2
    exit 1
  fi
  mkdir -p "$TOOLCHAIN"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/python" -m pip install --upgrade pip --quiet
  "$VENV_DIR/bin/python" -m pip install graphifyy --quiet
  echo "graphify installed: $("$GRAPHIFY" --version)"
fi

# --- Build the graph from the repo root (biotope's own repo ONLY - never index NUSPlan) ---
cd "$REPO_ROOT"
if [ "$1" = "--cluster" ]; then
  echo "Building graph (AST + clustering)..."
  "$GRAPHIFY" update .
else
  echo "Building graph (AST-only, no LLM)..."
  "$GRAPHIFY" update . --no-cluster
fi

node tools/graph-view/generate_graph_view.mjs --write

echo ""
echo "Graph written to graphify-out/graph.json and human view refreshed at docs/graph/semantic-graph.html."
echo "Query it:  $GRAPHIFY query \"what connects auth to the database?\""
