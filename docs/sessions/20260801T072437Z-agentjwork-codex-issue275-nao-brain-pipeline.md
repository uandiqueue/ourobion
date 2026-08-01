# Nao bounded brain-pipeline operator control

memory: none

## Attempted

- Implemented issue #275's Nao operator control for the existing `brain-pipeline.yml` workflow without adding provider calls, provider credentials, or direct imports from `tools/**`.
- Exercised the Nao package with TypeScript checking, the full Node test suite, a production Next.js build, the non-diagnostic copy gate, and browser regression at 1440x900 and 390x844.
- Kept Docker and the local Supabase stack stopped throughout this session, as explicitly requested.

## Changed

- Added a viewer-visible `/brain-pipeline` surface and navigation entry that reports dispatchability at load, including the exact blocked state `Not dispatchable: workflow not on default branch`.
- Added curator-only dispatch handling with a dry-run default, exact typed `RUN` confirmation for live requests, a required explicit artifact revision, an approved-corpus allowlist, two distinct active metric keys, bounded paper UIDs, and server-owned repository/workflow/ref inputs.
- Added GitHub workflow discovery and dispatch handling that distinguishes missing-on-default from unregistered/invalid workflows, treats ambiguous transport or malformed success responses as unknown, and never invents a run identity.
- Added append-only audit lifecycle events and claims projections for confidence, quote checking, corroboration, verifier identity/family, and decorrelation evidence.
- Added responsive/focus styling and browser-regressed the blocked, dry-run, live-confirmation, zero-result, unsupported, and verifier-evidence states.

## Decided

- Kept provider selection and spend-cap controls out of the UI. The workflow owns provider routing and hard caps; the UI shows the dated owner snapshot and the workflow's published maximum exposure before a live run.
- Classified unsupported and uncertain verification results as normal outcomes, not errors, and provided no retry or verdict-shopping action.
- Reported post-dispatch usage only as the observed day/node ledger delta. The current workflow exposes no structured per-run usage artifact, so the UI states that the delta is not isolated to one run and does not claim an exact run cost.
- Used Playwright Core with the installed Chrome binary for browser regression because the browser connector was unavailable. The harness mocked only read APIs and performed no dispatch.

## Left

- Rebase onto the current `origin/dev-phase2-run4`, rerun all gates against the exact rebased head, publish the evidence to issue #275, and self-merge the PR after CI passes.
- The control remains intentionally non-dispatchable until `.github/workflows/brain-pipeline.yml` exists and is registered on GitHub's default branch.

## Blockers

- Live workflow execution is BLOCKED by the workflow not being present on GitHub's default branch. This is an expected product state covered by the required visible UI; it does not block landing the control.
