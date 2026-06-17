# graphify-build.ps1 - (re)build biotope's semantic context graph with graphify.
#
# Usage (from the repo root):
#     .\scripts\graphify-build.ps1            # AST-only, local, no LLM, no network
#     .\scripts\graphify-build.ps1 -Cluster   # also run community detection (clustering)
#
# graphify is the SEMANTIC / agent-context layer (memory 0008); it is complementary to the
# structural import-graph that docs/graph/README.md still marks DEFERRED. The graph it writes to
# graphify-out/ is a rebuildable PROJECTION (two-tier-truth) - gitignored, never hand-edited.
#
# graphify is build tooling, NOT a repo/runtime dependency: it installs into a project-bounded venv
# inside the toolchain (default ..\biotope-toolchain\graphify-venv), nothing touches the global PATH,
# and the venv is never committed or deployed. This script bootstraps that venv on first run.
#
# AST extraction is fully local (tree-sitter) - Dart + TS + the rest of the repo, no key needed.
# The optional cross-language SEMANTIC pass (Dart <-> TS concept merging) is NOT run here: per the
# repo's repo-consistent wiring decision we do NOT register graphify's skill/hook, so that pass is
# driven on demand by the local Claude Code agent (the host session model) - no ANTHROPIC_API_KEY.

param(
    [switch]$Cluster
)

$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path $PSScriptRoot -Parent
$Toolchain = if ($env:BIOTOPE_TOOLCHAIN) { $env:BIOTOPE_TOOLCHAIN } else { Join-Path (Split-Path $RepoRoot -Parent) 'biotope-toolchain' }

if (-not (Test-Path $Toolchain)) {
    Write-Error "Toolchain not found at '$Toolchain'. Run scripts\setup.ps1 first (or set `$env:BIOTOPE_TOOLCHAIN)."
    return
}

$VenvDir    = Join-Path $Toolchain 'graphify-venv'
$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
$Graphify   = Join-Path $VenvDir 'Scripts\graphify.exe'

# --- Bootstrap the project-bounded graphify venv on first run ---
if (-not (Test-Path $Graphify)) {
    Write-Host "graphify not found - bootstrapping project-bounded venv at $VenvDir ..." -ForegroundColor Yellow
    $BasePython = Join-Path $Toolchain 'miniconda\python.exe'
    if (-not (Test-Path $BasePython)) {
        Write-Error "No Python in the toolchain at '$BasePython'. Run scripts\setup.ps1 first."
        return
    }
    & $BasePython -m venv $VenvDir
    & $VenvPython -m pip install --upgrade pip --quiet
    & $VenvPython -m pip install graphifyy --quiet
    Write-Host ("graphify installed: {0}" -f (& $Graphify --version)) -ForegroundColor Green
}

# --- Build the graph from the repo root (biotope's own repo ONLY - never index NUSPlan) ---
Push-Location $RepoRoot
try {
    if ($Cluster) {
        Write-Host "Building graph (AST + clustering)..." -ForegroundColor Cyan
        & $Graphify update .
    } else {
        Write-Host "Building graph (AST-only, no LLM)..." -ForegroundColor Cyan
        & $Graphify update . --no-cluster
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Graph written to graphify-out\graph.json (gitignored, rebuildable projection)." -ForegroundColor Green
Write-Host "Query it:  & '$Graphify' query `"what connects auth to the database?`"" -ForegroundColor DarkGray
