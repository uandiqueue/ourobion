# Issue 391 verifier R2 CLI wiring

memory: none

## Attempted

- Audited successful hosted workflow run 30743133643 against issues #369 and #371 instead of
  accepting the workflow conclusion alone.
- Reconciled its 13 locally written Agnes verifications with the one verification subsequently
  materialized from R2 and projected into hosted Postgres.

## Changed

- Forwarded the parsed `verify --push-r2` CLI flag into the verifier options so accepted
  verifications are actually appended to `edges/verifications.jsonl` in R2.
- Documented the flag in CLI help.
- Strengthened the real CLI integration test with a loopback S3-compatible endpoint that requires
  an argv-level `--push-r2` invocation to GET and PUT the canonical verification object.

## Decided

- Treat workflow success as transport/process evidence only; issues #369 and #371 remain open
  because the durable bundle and hosted projection retained only one old verification, one verified
  edge, zero extracted rules, and one research-linked card path.
- Preserve the richer tracked semantic graph view: the fresh-worktree structural rebuild was
  inspected but not committed because it would replace named semantic communities and hyperedges.

## Left

- Obtain review, merge the corrective PR, and dispatch a fresh Nao-authorized one-paper acceptance
  run under a new artifact revision.
- Confirm the next run logs a non-zero `verify: pushed` count, R2 materializes the new verification
  set, hosted `verified_edges` increases, and verified extracted rules/cards satisfy #371.

## Blockers

- Do not close #369 or #371, and do not dispatch again, until this corrective PR is reviewed and
  merged to `main`.

## Verification

- Real CLI/R2 integration test: 3 passed.
- Complete serial `tools/brain-ingest` suite: 561 passed.
- `tools/brain-ingest` TypeScript typecheck: passed.
- `graphify update .`: inspected on the changed worktree; tracked semantic view preserved.
