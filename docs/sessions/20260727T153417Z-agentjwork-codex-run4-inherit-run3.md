---
title: "Run 4 lineage repair — inherit Run 3 history"
summary: "Merged dev-phase2-run3 into the Run 4 repair branch without rewriting either line, preserving the Run 4 build log and reconciling CI coverage."
type: session
scope: repo
status: canonical
updated: 2026-07-27
---

# Run 4 lineage repair — inherit Run 3 history

## Attempted

- Reconciled the verified remote tips: Run 4 `837b7e690f92dc1669428a2476c9d8d0456020e8` and Run 3 `6869eeadb05c792bf9437bd866f03d06b297ee9d`.
- Created an isolated repair branch from the Run 4 remote tip and merged Run 3 with a normal non-fast-forward merge; neither source branch was reset, rebased, or force-pushed.

## Changed

- Resolved only the expected conflicts. The model-training build log retains the exact Run 4 blob; no semantic reading or edit was made.
- Reconciled the CI workflow as a strict superset: it retains both Run 3 and Run 4 triggers, Run 4's existing checks, Run 3's graph-view and active model-training core/lint/type checks, and excludes the disabled no-op ML placeholder.

## Decided

- This is a lineage repair only. The resulting PR targets `dev-phase2-run4`; it does not merge Run 4 anywhere.

## Left

- CI will validate the merged history and workflow in GitHub. No hosted settings, providers, or training jobs were executed.

## Blockers

- None.

memory: none
