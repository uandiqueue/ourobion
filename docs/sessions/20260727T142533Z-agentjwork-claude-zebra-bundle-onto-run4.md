---
title: Land the portable Zebra training bundle on dev-phase2-run4
summary: Copied only the self-contained zebra-training folder onto the Run 4 line so it can be pulled to the Mac Mini, deliberately avoiding a wholesale merge of the Run 3 branch which would have dragged 181 files and conflicted in ci.yml. Self-containment proven — 82 tests pass on a branch with no model-training substrate.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Land the portable Zebra bundle on dev-phase2-run4

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/zebra-bundle-run4` in `C:\project\ourobion-zbundle`, cut from
`dev-phase2-run4`

Jayden asked for the bundle on `dev-phase2-run4` so it can be pulled to the Mac Mini.

## Why this is a copy, not a branch merge

`dev-phase2-run4` **diverged from the Run 3 line at `854aa47`** and does not contain Run 3's 34
commits. That looks deliberate — the audit's precondition P4 called for Run 4 to start from a fresh
immutable base rather than inherit a contaminated one.

Merging `feat/model-training/mt3-zebra` wholesale would therefore have:

- brought **181 files / 19,089 insertions** onto Run 4, including MT0's entire Python substrate and the
  `AGENTS.md` task-fit polyglot rule;
- produced a **content conflict in `.github/workflows/ci.yml`**, the file Run 4's U0 unit is actively
  rebuilding.

That is an integration decision about Run 4's base, not a delivery task, so it was not made
unilaterally. Only `docs/temp/model-training/zebra-training/` was copied across — 21 files, nothing
else touched.

## Verified

The bundle imports nothing from the repo, and this branch proves it: `model-training/` is **absent**
here, yet from the bundle folder with `PYTHONPATH=src`:

- `python -m unittest discover -s tests` → **`Ran 82 tests` / `OK`**
- `python -m zebra.cli preflight` → **exit 2**, the fail-closed licence gate refusing to run without a
  human-produced `licence-approval.json`

## Left

- The bundle has still never touched the network, real SciFact, a real tokenizer, or Apple Silicon.
  Everything in the previous session's "unverified" list stands, in particular whether real SciFact
  clears `min_per_class_per_fold`.
- A human must produce `licence-approval.json` before anything runs.
- The Run 3 line still holds the same bundle plus the MT0 substrate; the two copies will diverge if
  either is edited. If Run 4 becomes the long-lived line, the Run-3 copy should be retired rather than
  maintained in parallel.

## Blockers

- None. No training run, nothing downloaded, no compute provisioned.

memory: none
