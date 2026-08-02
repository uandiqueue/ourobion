---
session: 20260802T054924Z-agent-j-codex-issue369-unattended-agnes
agent: agent-j (Codex)
date: 2026-08-02
scope: issue 369 cloud brain pipeline, nao dispatch control, verifier corpus
---

# Issue 369 — unattended Agnes verification

## Attempted

- Reconcile the registered cloud brain workflow with Agnes's existing acceptance-only enforcement.
- Remove the operator-selected fixture corpus from nao and make one dispatch run the real loop.
- Preserve an unambiguous authorization trail without copying raw curator identity into GitHub.

## Changed

- Nao now sends its validated control-operation UUID with the workflow dispatch; request bodies
  cannot supply or spoof that field.
- A live workflow builds `verify-corpus-workflow.jsonl` from the hydrated real manifest and excludes
  every paper cited by the run's claims.
- The workflow issues a fresh three-hour acceptance descriptor, passes both acceptance flags to
  `verify`, and retains the descriptor plus hash-chained attempt journal as a run artifact.
- The nao panel no longer asks an operator to select a committed test fixture and explains automatic
  real-corpus construction and source-echo exclusion.
- Added corpus, control-contract, copy, workflow, and authorization regression coverage.

## Decided

- The accepted cloud authorization basis is the authenticated nao control event plus GitHub's
  dispatcher identity. Curator identity remains in the audit table, its legitimate privacy boundary.
- Agnes is bounded to 60 aggregate POST starts per submitted paper (maximum 1,200 for nao's existing
  20-paper request cap), zero reserved USD, and the unchanged three-start per-logical-call router cap.
  Anthropic and OpenAI verifier allowances remain zero.
- Full dry runs stop after no-provider synthesis assembly; they do not manufacture a verifier input
  or acceptance authorization when synthesis intentionally writes no claims.

## Left

- Merge the PR, dispatch one live run from nao, and verify R2 artifacts, verifier verdict/caveat
  records, hosted projection, retained authorization journal, and an increased `verified_edges` row
  count. That hosted evidence is required before issue #369 can close.

## Blockers

- Hosted acceptance cannot run from an unmerged feature branch because nao dispatches the registered
  workflow on the repository's default branch.

memory: added 0018
