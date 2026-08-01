---
title: Run 4 U3 14+7 partial acceptance closeout
summary: Records deterministic passes, blocked fresh-runtime attempts, cleanup evidence, and the next independently audited runner change.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 U3 14+7 partial acceptance closeout

## Attempted

- Continued issue #246 from exact HEAD `efdb92eef51a9d47eea209a919ea06a8906b2699` to establish the fresh 14+7 positive-control acceptance evidence.
- Completed deterministic suites and verifier dry-runs, then executed an independently audited fresh-runtime harness three times under the approved safety boundaries.

## Changed

- Added only this append-only session record; no product, source, memory, decision, projection, or runtime data was hand-edited.
- Preserved the three sanitized evidence directories under the root `.run4-scratch`: `run-output-ff499142dc83`, `run-output-28fad7fc1635`, and `run-output-15332b168c80`.

## Decided

- Do not make a fourth runtime attempt in this session.
- Issues #179 and #240 remain open because the complete 14+7 positive-control acceptance is still unproven.

## Left

- The next session must replace the native-command wrapper with an independently audited `System.Diagnostics.Process` / `Process.ExitCode` implementation, with PowerShell 5.1 argument quoting and asynchronous stdout/stderr handling.
- Keep persistence metadata-only, then re-preflight the lockfile, exact HEAD, ports, processes, and `node_modules` before any further run.

## Blockers

- Both verifier dry-runs stopped at `quoteCheck` 0/1 and performed no provider dispatch.
- All three fresh-harness runs stopped at `npm ci`, before Supabase startup, identity provisioning, services, or acceptance measurements: non-elevated `EPERM`, elevated stderr false-failure, then elevated `LASTEXITCODE` shadowing.
- Android enumeration hung and produced no authorized physical-device proof.

## Verification

- Deterministic suites passed: U3 228/228; U2 468/468; profile preferences 34/34; Nao B-PL15/redaction 44/44; edge trust 32/32; release 17/17 plus config.
- Verifier dry-runs returned `quoteCheck` 0/1 with no retrieval, model, or provider dispatch.
- After every runtime attempt, ports 54321 and 3114 were closed; runner, Node, Deno, Supabase, Postgres, and edge-runtime processes were absent; transient secret/env artifacts were absent; and the target worktree remained clean.
- Local Supabase database, edge-runtime, and storage volumes were preserved; the vector container remained stopped with exit 0.
- No hosted, provider, deployment, database reset, GitHub, source, or projection write occurred during runtime execution.

memory: none
