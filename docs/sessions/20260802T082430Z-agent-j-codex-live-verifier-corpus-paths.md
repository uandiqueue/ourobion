# Issue 385 live verifier corpus paths

memory: none

## Attempted

- Monitored the owner-dispatched one-paper hosted acceptance run for issues #369 and #371.
- Diagnosed run 30739556087 after synthesis succeeded but the echo-controlled verifier corpus step failed before Agnes verification.

## Changed

- Corrected the workflow's verifier-corpus output, claim-exclusion input, and verification corpus input to resolve from `tools/brain-ingest/` to the repository-root `data/corpus/` directory used by synthesis.
- Strengthened the workflow regression so the incorrect working-directory-relative paths cannot return.

## Decided

- Preserve the successfully published R2 claim and blueprint from the failed run as truth-tier artifacts.
- Rely on synthesis resumability in the next owner-dispatched run so the already-synthesised paper is skipped without another paid synthesis call.

## Left

- Land the focused fix, redeploy Nao if required by the main push, and dispatch a fresh audited acceptance revision.
- Verify Agnes evidence, artifact projection, extracted rules, and regenerated cards before closing #369 or #371.

## Blockers

- Hosted acceptance remains incomplete until this workflow-only fix reaches `main` and the fresh run succeeds.

## Verification

- Focused brain-pipeline workflow regressions: 10/10 passed.
- Complete serial `tools/brain-ingest` suite: 557/557 passed.
- `tools/brain-ingest` TypeScript typecheck passed.
- `brain-pipeline.yml` parsed successfully with the repository-installed YAML parser.
- Context integrity and `git diff --check` passed.
