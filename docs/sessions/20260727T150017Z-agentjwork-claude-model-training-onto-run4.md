---
title: Inherit the full model-training workstream from run3 onto dev-phase2-run4
summary: Brought the MT0 Python substrate, all five training plans, the plan review, run-2 corrections and supporting policy from dev-phase2-run3 onto the Run 4 line, deliberately excluding ci.yml because Run 4's U0 is rebuilding it. Both suites verified on the new line — 158 substrate tests and 82 bundle tests.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Inherit model-training from run3 onto dev-phase2-run4

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/zebra-bundle-run4` in `C:\project\ourobion-zbundle`

Jayden asked that `dev-phase2-run4` inherit `/model-training` from `dev-phase2-run3`, not just the
portable Zebra bundle.

## Why this was needed

`dev-phase2-run4` diverged from the Run 3 line at `854aa47` and carried **none** of the model-training
workstream — no `model-training/` substrate, and none of the fourteen planning documents. It had only
the Zebra bundle I had copied across earlier. Anyone working model-training on the Run 4 line would
have found the plans missing and the substrate absent.

## Changed — 60 files

- **`model-training/`** — the whole MT0 Python substrate: config, environment capture, licence/data
  manifests with SHA-256 verification, the personal-data guard, leakage/split assertions, metrics,
  release-manifest construction with atomic write, storage adapters, the non-provisioning GMI
  preflight, the sealed `JobSpec` gate, the CLI, and its test suite.
- **`docs/temp/model-training/`** — `README.md`, `model-roster.md`, all five `*-training-plan.md`,
  `five-model-training-plans-review.md`, `human-gates.md`, the three `code-build-*` tracking docs, and
  `run2/` (the review disposition and today's training decision).
- **Supporting policy**, without which the substrate is incoherent: `AGENTS.md`'s task-fit polyglot
  rule (otherwise the repo declares itself Python-free while containing Python),
  `.gitignore`'s anchored model-artifact entries (otherwise weights and caches become committable),
  `docs/shared/structure-context.md`, `docs/memory/0017` and `0008`, and the memory index.

## Deliberately excluded

- **`.github/workflows/ci.yml`.** Run 4's U0 unit is actively rebuilding this file, and MT0's version
  adds three `model-training` jobs plus a `dev-phase2-run3` trigger branch. Merging it would have
  conflicted with live work and re-introduced a trigger list Run 4 is replacing. **Consequence: the
  three model-training CI jobs do not exist on the Run 4 line.** Whoever owns U0's ci.yml rebuild
  should re-add them — a zero-install core job, a lint/type job, and an ML job gated `if: false`.
- **Run 3's older `zebra-training/`.** Run 4's copy is newer, carrying `CONTEXT.md` and
  `INTERPRETING-RESULTS.md`. Verified preserved after the checkout rather than assumed.

## Verified on the Run 4 line

- `model-training/` substrate: `python -m unittest discover -s tests` → **`Ran 158 tests` / `OK`**
- Zebra bundle: **`Ran 82 tests` / `OK`**
- `node tools/context_sync.mjs --check` → passed
- No `__pycache__`, venv, weight or credential file staged
- `AGENTS.md` carries the polyglot rule, so the policy and the code now agree on this line

Before copying, I checked that Run 4 had **not** modified `AGENTS.md`, `.gitignore`,
`structure-context.md` or the memory index since the merge-base — it had not, so taking Run 3's
versions clobbered nothing. That check was deliberate: earlier today I overwrote a colleague's canonical
docs by working from a stale worktree, and this is the same failure mode.

## Left

- The three model-training CI jobs are missing on Run 4 until U0's ci.yml rebuild re-adds them.
- The Run-3 line still holds its own copy of everything. The two will diverge if either is edited; if
  Run 4 becomes the long-lived line, retire the Run-3 copies rather than maintaining both.
- Nothing about the Zebra experiment itself changed: still no network, no real SciFact, no real
  tokenizer, no Apple Silicon, and a human must still produce `licence-approval.json`.

## Blockers

- None. No code modified — this is a file-inheritance reconciliation. Nothing trained, nothing
  downloaded.

## Memory records inherited

Relative to the Run 4 line these are new or changed, even though they already existed on Run 3:

- **`0017-support-model-dataset-corrections`** — added. Records the three dataset assumptions that did
  not survive checking: BioRED is non-directional so direction needs the BioREDirect enrichment;
  MEDLINE PublicationType cannot express evidence tiers 1–3; and Cochrane Crowd is personal-use only.
- **`0008-graphify-context-tool`** — modified, carrying the "one tracked view, and it is Markdown"
  correction and the `graphify-out/semantic-graph.html` location.

The pre-push gate correctly rejected an earlier version of this log that declared `memory: none` while
the push touched both records. That is the check working.

memory: added 0017; modified 0008
