---
title: Run 4 brain/synthesis owner — land #292, then the #300 synthesis revamp
summary: Landed PR #292 by fixing its two red CI checks (a stale synthetic merge ref against a base that had moved 50 commits, then the cumulative product snapshot that merge grew), and took ownership of the #300 synthesis revamp including scope G.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 brain/synthesis owner — land #292, then the #300 synthesis revamp

Issues: #233 (via PR #292), #300; branch: `feat/brain/run4-233-live-legs` (for #292);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

Two other sessions are running in parallel: **Session B** owns `apps/**` and `shared/metrics/**`,
**Session C** owns `docs/**` except this log. This session's territory is `tools/**`,
`shared/brain/**`, `shared/rules/**`, `data/rules/**`, `.github/workflows/brain-*.yml`, and any
migration it adds itself.

## Attempted

- Land PR #292 (live provider acceptance + the #233 §D cloud pipeline) once CI was green.
- Read #300 and all its comments in full before touching synthesis code, including the two hackathon
  MVP goals and scope G.

## Changed

- `tools/run4_release_gate.test.mjs` — refreshed the Run 4 product snapshot from
  **533 paths / 75,645 added lines** to **536 / 76,351**. Recorded measurement only: the caps
  (`RUN4_MAX_CHANGED_PATHS` 115, `RUN4_MAX_ADDED_LINES` 8,500) are untouched, and the assertions
  that the measured delta *exceeds* them are still in place, so the deliberate "record, don't gate"
  split is unchanged and the enforcement wrapper still throws.
  **It took two passes, for a reason worth recording:** the snapshot measures the whole landing
  delta including the very commits that refresh it. The first pass (533 → 535) was measured
  correctly and then invalidated by *this session log itself* — a new file (+1 path, +96 lines)
  — pushing the true figure to 536 / 76,351. Refreshing this snapshot is therefore inherently
  self-referential and must be the **last** content change before the push.
  It does converge: re-editing the *same two already-differing lines* changes their content but
  not the added-line count measured against the immutable product base, so 536 / 76,351 is a
  genuine fixed point — verified by measuring with the edit in the working tree and getting the
  identical numbers back.
- Merged the current `dev-phase2-run4` tip (`253e0ad`) into `feat/brain/run4-233-live-legs`. Clean
  merge, **no conflicts**.
- **Nothing else.** The session-log entry recording #292's three CI defect fixes was written
  concurrently by another session (`eb4c4ec`) while this session was preparing the identical content.
  That version is a strict superset — it also carries the `workflow_dispatch` 404 finding, the
  `METRIC_TERMS` correction, and the zero-claim diagnosis — so this session **discarded its own
  duplicate** rather than recording the same three defects twice in one file.

## Decided

- **#292's two red checks were one root cause and one consequence, not two defects.**
  `Run 4 release evidence` failed with `synthetic merge parents do not match current event
  base/head`: `checkWorkflowProvenance` requires the synthetic merge commit's parents to equal the
  *current* event base/head, and the PR's merge ref had been computed against `d880ed0` while the
  base had advanced to `253e0ad` — the branch was **50 commits behind**. `Run 4 Gate` failed only as
  a downstream dependency (`Run 4 Gate dependencies not successful: run4-release=failure`). Merging
  the current base in forces GitHub to recompute the merge ref, which fixes both. Nothing in the
  gate needed changing — it was correctly refusing stale provenance.
- **The product-snapshot failure that surfaced next was expected, not a regression.** Merging 50
  commits of base grew the cumulative delta measured against the immutable product base SHA, so the
  recorded snapshot no longer matched. Refreshing it is the established practice on this line (base
  carries several `test(ci): refresh Run 4 product snapshot` commits). Measured locally
  (`productLandingDelta`) and in CI — **identical both times**, 535 / 76,255 — so the number is
  evidence, not a guess.
- **Discarding this session's duplicate log entry was the right call over merging both.** Two
  independent descriptions of the same three defects in one file would leave a reader unable to tell
  whether they were three defects or six.

## Verification

All at exact head, with the toolchain Node (`v26.3.0`, satisfies brain-ingest's `>=26` pin):

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck | clean |
| `tools/brain-ingest` tests | **430/430** |
| `tools/llm-router` typecheck | clean |
| `tools/llm-router` tests | **121/121** |
| `tools/run4_release_gate.test.mjs` | **18/18** |
| `node tools/context_sync.mjs --check` | passed |
| `git diff --check` | clean |

- brain-ingest 430/430 was re-run **after** merging the base in, not only before, since the merge
  brought in the `shared/metrics` Dart restructure and the model-training inference runner.
- Product landing delta measured directly:
  `{ base: 77c98213…, changedPaths: 535, addedLines: 76255, excludedPaths: 28, allowlistedBinaryPaths: 15, withinCap: false }`.
  `withinCap: false` is the expected recorded state, not a failure.
- **No provider calls were made this session.** Running spend is unchanged at **US$0.044** total
  against the SGD 2 (Anthropic) / SGD 20 (OpenAI) ceilings and the 20-call Agnes testing cap.

## Left

- #300 scope A–F and scope G are the substantive work and are **not** started in this entry.
- Non-provisional pricing for `gpt-5` and `agnes-2.5-flash` expires **2026-08-08**; after that the
  router fails closed. Any #300 live synthesis run has to happen before that date or refresh pricing
  first.
- Deliberate owner-review checkpoint after #300: **#240, #179, #246, #275, #277 and the two
  hackathon MVP goals are not to be started.**

## Blockers

- None for #292.

memory: none
