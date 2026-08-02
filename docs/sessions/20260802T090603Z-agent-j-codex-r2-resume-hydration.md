# Issue 387 R2 synthesis resume hydration

memory: none

## Attempted

- Audited the next fresh-run behavior after issue #385 merged and before asking the owner to dispatch again.
- Traced whole-paper resumability from the workflow into `synthesizePapers()` and confirmed it consulted only the runner-local claims file even when `--push-r2` was selected.

## Changed

- Publishing synthesis runs now inspect the durable R2 claims artifact before constructing any provider request and merge its cited paper UIDs into the local resume set.
- A missing remote claims object remains a valid first-run state; an R2 inspection outage or malformed remote claims artifact fails closed before spend.
- Added regressions proving a fresh runner skips a remotely published paper with zero provider calls and refuses an unreadable R2 resume boundary.

## Decided

- Put the safety invariant in the shared synthesis entry point rather than only in GitHub YAML, so every future `--push-r2` caller gets the same no-repeat-spend behavior.
- Reuse one R2 store for resume inspection, canonical text loading, and publication where those surfaces are needed.

## Left

- Land this focused fix into `main`, then dispatch a fresh Nao-authorized acceptance revision.
- Confirm the run reports the selected paper as already done, performs Agnes verification, projects edges and verified rules, and regenerates hosted cards.

## Blockers

- Do not dispatch the next live run until the spend-safe remote resume fix is reviewed, green, and merged.

## Verification

- `node --import tsx --test tests/paperSynth.test.ts` — 36 passed.
- `npm run typecheck` — passed.
- `node --import tsx --test --test-concurrency=1 'tests/**/*.test.ts'` — 560 passed.
- `node tools/context_sync.mjs --check` — passed.
- `graphify update .` — refreshed the worktree-local structural projection; the tracked view was not
  retained because this fresh worktree lacked the semantic cache and would have erased semantic
  nodes and hyperedges from the existing view.
