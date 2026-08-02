# Issue 389 R2-to-local claims hydration

memory: none

## Attempted

- Monitored live acceptance run 30741967819 after issue #387 merged.
- Confirmed the spend guard skipped the remotely published paper with zero provider calls and zero
  cost, then traced the next failure to the absent runner-local claims artifact.

## Changed

- The shared publishing synthesis entry point now contract-validates remote R2 claims and hydrates
  them append-safely into the runner-local claims artifact during resume.
- The existing fresh-run regression now proves the validated remote claim is available locally for
  verifier-corpus construction while provider calls remain at zero.

## Decided

- Hydrate at the shared resume boundary rather than adding a GitHub-only copy step, so every fresh
  `--push-r2` caller receives the same downstream artifact handoff.
- Use the existing append/dedupe writer so a persistent runner's local claims are preserved rather
  than overwritten by the R2 snapshot.

## Left

- Land this focused fix into `main`, then dispatch a fresh Nao-authorized acceptance revision.
- Confirm Agnes verification, exact bundle materialization, edge/rule projection, and hosted card
  regeneration before closing #369 and #371.

## Blockers

- Do not dispatch another live run until the hydration fix is reviewed, green, and merged.

## Verification

- `node --import tsx --test tests/paperSynth.test.ts` — 37 passed.
- `npm run typecheck` — passed.
- `node --import tsx --test --test-concurrency=1 'tests/**/*.test.ts'` — 561 passed.
- `node tools/context_sync.mjs --check` — passed.
- `graphify update .` — refreshed the worktree-local structural projection (12,274 nodes / 19,063
  edges); the machine-local projection was removed after inspection because a fresh worktree has no
  semantic cache and must not replace the richer tracked semantic view.
