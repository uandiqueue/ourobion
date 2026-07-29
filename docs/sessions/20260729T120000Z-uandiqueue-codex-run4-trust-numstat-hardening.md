---
title: Run 4 source numstat recovery hardening
summary: Hardened the narrow historical-binary source recovery with byte-level patch parsing and status/path constraints.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 source numstat recovery hardening

## Attempted

- Address adversarial review findings for the exceptional historical-NUL source recovery.

## Changed

- Scoped recovery now consumes Buffer patch bytes, proves safe source paths and head blobs, accepts NUL only in removed lines, and rejects malformed/ambiguous patches.
- Recovery requires exact modified status and landing now compares numstat paths with name-status paths.

## Decided

- Normal numeric numstat remains unchanged; fallback stays fail-closed and source-only.

## Left

- CI will provide the remote PR check run after push.

## Blockers

- None locally.

## Verification

- Node 26 release-gate suite: 13/13 passed after hardening.

memory: none
