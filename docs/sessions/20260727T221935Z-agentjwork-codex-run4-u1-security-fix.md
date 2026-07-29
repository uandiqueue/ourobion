---
title: "Run 4 U1 security admission corrections"
summary: "Closes the U1 aggregate, boundary-parser, client-surface, and local bundle-proof gaps found after initial signoff."
type: session
scope: shared
status: canonical
updated: 2026-07-27
---
# Run 4 U1 security admission corrections

## Attempted

Correct issue #178 on `fix/ci/run4-u1-security-bypasses`, exact base `baab1536e7e1292e7e00ee2748ffe42cb212d72a`, without weakening O35/O36 claims.

## Changed

- Correction code/workflow delta before this log: 7 files, +204/-55 (net +149).
- Added both U1 jobs to the frozen 12-job aggregate; closed template/Windows/unresolved boundary forms, TOML native allowlists, `@/` closure, bare environment leaks, and missing/read-failed surface bypasses.
- Added a local Next synthetic-canary build/`.next/static` inspection; no fixture or output contains a real secret.
- Evidence: architecture 48/48, secret 109/109, release gate 9/9; real guards clean over 322 sources/14 surfaces; workflow config, Next build plus 47-artifact canary inspection, nao typecheck, context check, and `diff --check` passed.
- PR CI exposed one Gitleaks false positive where the `secret-scan` object key sat beside its frozen SHA-256; the key now resolves through the frozen required-job array with identical runtime bytes. Checksum-verified Gitleaks 8.30.1 then reported no findings over `tools/`, and release-gate tests remained 9/9.

## Decided

- Bundle evidence proves only the local Next client artifacts; it does not claim OpenNext, hosted, deployed, or served-byte proof.
- No provider call, hosted write, credential mutation, model training, `shared/`, UI, or U2-U5 work was performed.

## Left

- Orchestrator owns integration-cap accounting, issue/PR records, commit/push, and exact-SHA CI evidence.
- CI must rerun the pinned working-tree/history scans after the false-positive-safe source representation; the locked landing-cap failure remains intentionally fail-closed.

## Blockers
None.
memory: none
