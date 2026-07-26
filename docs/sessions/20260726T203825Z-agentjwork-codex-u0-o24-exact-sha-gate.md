---
title: U0 O24 exact-tip CI and reproducible Deno gate
summary: Added every-PR CI coverage, exact-SHA manual evidence protection, complete Deno matrix coverage, and a shared frozen Deno lock.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# U0 O24 exact-tip CI and reproducible Deno gate

Branch: `ci/run3-o24-exact-sha-gate` (base candidate
`9b41f4abc0a52e2c3ebfebb6b6fe6b375709dca3`, worktree
`C:\project\ourobion-run3-u0-143`).

## Attempted

- Implemented the locked O24 release-gate repair only: every-PR CI coverage, manual exact-SHA
  dispatch protection, four-function Deno coverage, and reproducible Deno/JSR resolution.
- Generated the shared lock with the official temporary Deno `2.8.1` Windows distribution, then ran
  frozen checks for all four configured Edge Function handlers.
- Ran the local CI-equivalent context, Flutter, shared, nao, and Node-tool verification gates.

## Changed

- CI now covers every pull request, preserves `main` / `dev-phase2` push gates and adds the Run 3
  integration push gate; `workflow_dispatch` requires an expected SHA and rejects a ref-tip race.
- Added a Node-stdlib guard plus negative tests that compare configured Supabase function entrypoints
  with the Deno matrix. `run-pipeline` is now in that matrix.
- Added a shared `supabase/deno.lock`, frozen in all four handler configs and checked by pinned Deno
  `2.8.1` in CI.
- Created the Run 3 resumability tracking records; U0 remains in-progress pending its PR and exact
  GitHub workflow evidence.

## Decided

- D1 records the exact Deno `2.8.1` runtime / shared-lock choice in
  `docs/temp/run3/decisions-signoff.md`.
- No feature defects, O23/package work, Graphify work, deployment, hosted write, or paid-provider
  call was undertaken.

## Left

- GitHub Actions must supply the required exact-SHA evidence: context, Flutter, shared TypeScript,
  every Node/nao suite, all four Deno handlers, and shadow migration apply on one PR run. A local
  green result is not represented as that evidence.
- Human baseline acceptance, unit sign-off, and merge remain pending.

## Blockers

- None. The sandbox prevents Node's test worker from spawning (`EPERM`), but the same three guard
  tests passed in the authorized bounded toolchain. Local Flutter initially required the normally
  CI-created, gitignored `.env.public` asset; a temporary example-derived file enabled a clean run.

memory: none

## PR state

- PR #144 opened directly against `dev-phase2-run3`. The subsequent tracking-state commit changed the
  candidate SHA, so the required exact GitHub Actions evidence must be taken from the newest pushed
  commit rather than from the original implementation commit.
