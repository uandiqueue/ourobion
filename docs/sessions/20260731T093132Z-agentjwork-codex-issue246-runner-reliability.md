---
title: Issue 246 offline runner reliability repair
summary: Replaced the Run 4 dry-run runner's PowerShell native-command exit handling with a PS 5.1-safe Process wrapper and focused offline regressions.
type: session
scope: run4
status: canonical
updated: 2026-07-31
---

# Issue 246 offline runner reliability repair

Issue: #246 ? branch: `fix/run4/issue246-process-exit` ? base: `dev-phase2-run4` @ `42ae771c4809fe8f314fbf38dca89d60a809dedb`

## Attempted

- Repair only the offline runner reliability defect that blocked the fresh 14+7 acceptance attempt.
- Keep all validation fixture-only: no Docker, Supabase, cloud/R2, provider, or actual 14+7 workflow invocation.

## Changed

- Added a PowerShell 5.1-safe `System.Diagnostics.ProcessStartInfo` runner with authoritative `Process.ExitCode`, asynchronous stdout/stderr drains, Windows `.cmd` wrapping, explicit stdin closure, and process-tree cleanup on timeout.
- Routed both the runner's generic native command path and SQL command path through that helper; removed its `$LASTEXITCODE` acceptance checks.
- Added local probe regressions for zero-exit stderr warnings, nonzero commands with successful-looking text, direct and `.cmd` exact-argument round trips, large dual-stream output, stdin preservation, and timeout cleanup.

## Decided

- Stderr is preserved as diagnostics but does not determine success; a completed child's `Process.ExitCode` is the single success signal.
- The helper returns separate stdout/stderr plus combined diagnostic output so existing runner assertions retain readable evidence.

## Left

- Primary review, then any separately authorized fresh preflight or 14+7 acceptance work.
- Issues #179 and #240 remain open; this repair makes no acceptance-evidence or provider claim.

## Blockers

- None for the offline repair. The dedicated patch helper could not start because the Windows sandbox helper was unavailable; edits used reviewable Git patch application only in this isolated worktree.

## Verification

## Review correction

- The original `.cmd` wrapping is superseded: command scripts are now rejected before launch, and runner `npm`/`npx` paths execute their installed CLI JavaScript through `node.exe`.
- Timeout cleanup now has bounded taskkill, target-exit, and stream-drain phases; a timeout always returns exit `-1` and reports cleanup failure rather than a false success.
- The focused regressions now cover hostile cmd metacharacter rejection and real parent-child termination.
- Background Nao startup now supplies one `Join-NativeCommandLine`-quoted argument string to Windows PowerShell 5.1, so a CLI path below a spaced directory is not split. Node CLI discovery also continues to the project toolchain when the first PATH `node.exe` lacks the matching npm CLI script.
- Final Nao teardown now turns any `Stop-NativeProcessTree` failure into a recorded `FAIL`, preserving its error in the summary and forcing the authoritative final exit to be nonzero.


- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\tests\\native-process.tests.ps1`: PASS.
- Parse-only checks passed for all changed PowerShell files.
- The focused suite exercised only tracked local probe children; no external workflow or service was started.

memory: none
