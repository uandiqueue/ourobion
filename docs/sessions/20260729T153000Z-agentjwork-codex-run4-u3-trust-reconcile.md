---
title: Run 4 U3 trust reconciliation evidence
summary: Reconciled trust plumbing evidence and CI handoff.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 U3 trust reconciliation evidence

## Attempted

- Reconciled current integration into trust plumbing and recorded local evidence.

## Changed

- Composed binary accounting with narrow source recovery; generator recorded local attestation.

## Decided

- Product cap is record-only and remains `withinCap: false`.

## Left

- This documentation sync commit is intended to trigger fresh CI.

## Blockers

- None locally.

## Verification

- Resolved-tree/pre-sync HEAD: `495db60a232bcff4cc6befd910d9cde6e1878692`.
- Four routes each returned HTTP 401, 12-byte `Unauthorized`, SHA-256 `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`.
- Generated `generate-insights` module graph: `e6439c8d9019499978eb3bf348b63ebfe27ab4e4af201ea930125d9739d5d92c`.
- Release 17/17, config, attest, and context checks passed.
- Landing base `38205d2`: 50/115 paths, 4062/8500 additions, 0 binary paths/0 bytes.
- Product base `77c982`: 367/115 paths, 53317/8500 additions, 28 exclusions, 15 binary paths/837194 bytes, record-only `withinCap: false`.
- PR retarget to `c0a85b` initially produced no run.

memory: none
