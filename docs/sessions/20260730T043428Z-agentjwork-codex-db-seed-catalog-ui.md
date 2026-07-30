---
title: Wire Run-now to the database seed catalog
summary: Makes curator Run-now dispatch static-first over the cookie/RLS-bound seed catalog while preserving workflow and CLI safety.
type: session
scope: nao
status: canonical
updated: 2026-07-30
---

# Wire Run-now to the database seed catalog

## Attempted

- Continued issue #228 from exact `dev-phase2-run4` commit
  `8ecad585503967866a8e4d581021b6f38f1cebaa` in an isolated worktree.
- Audited the Nao seed catalog, curator dispatch route, GitHub workflow input, and CLI merged-pool
  revalidation without making provider calls or hosted writes.

## Changed

- Reused `GET /api/seeds` as the curator-only, cookie/RLS-bound catalog endpoint and shared its
  explicit-column database reader with the curator trigger route.
- Validated requested seed slugs against the database-compatible regex and 64-character application
  cap; built-ins win collisions, and only enabled, non-shadowed custom entries are runnable.
- Added a forward `NOT VALID` database constraint that applies the same regex and 64-character cap
  to new/updated rows without hiding or pretending to remediate legacy overlength rows.
- Kept legacy-invalid database rows visible but unavailable with an explicit remediation reason,
  blocked them from Nao dispatch, and excluded them independently from brain-ingest's merged pool.
- Grouped Run-now choices into built-in and custom seeds, kept disabled/shadowed custom rows visible
  but unavailable with honest reasons, and fell back visibly to built-ins when catalog loading fails.
- Synchronized Run-now immediately after a successful seed add or toggle.
- Changed the workflow input from a closed choice to a string while retaining environment transport,
  quoted Bash-array invocation, and the CLI's merged-pool revalidation.
- Set the optional GitHub Actions source default to the owner-approved `dev-phase2-run4`.

## Decided

- A catalog read failure blocks custom dispatch; the UI may degrade to independently known static
  built-ins, but it cannot turn an unverified custom slug into a runnable option.
- Preserve the existing CLI as the final independent selector check; no gate, shell quoting, RLS,
  service-role, workflow dispatch, or static-wins boundary was weakened.

## Left

- Stop uncommitted for independent review. No provider call, hosted write, deployment, database reset,
  model training, or fabricated runtime evidence was performed.
- Authenticated rendered-browser traversal remains unclaimed: the Browser plugin is absent, Nao has
  no configured Playwright workflow, and no authenticated curator browser state was supplied.

## Blockers

- None.

## Verification

- Focused catalog/trigger/dispatch/authz suite: 71/71 passed; focused brain-ingest database-seed
  loader suite: 11/11 passed.
- Nao lint and `tsc --noEmit` passed; full Nao suite: 316/316 passed; production build passed.
- Full brain-ingest suite: 388/388 passed with `tsc --noEmit`.
- Disposable migration/authz shadow fixture applied all 36 migrations in filename order and passed
  471/471 assertions, including the `NOT VALID` constraint shape and 65-character insert rejection.
- Run 4 release tests: 17/17 passed; config/workflow and fresh local attestation passed.
- Frozen-base pre-patch landing: 65 paths / 4,937 added lines; direct patch: 24 paths /
  +533/-95; projected landing: 89 paths / 5,470 added, within 115/8,500.
- Product cap remains record-only/over: pre-patch 375 paths / 54,128 added; projected working tree
  389 paths / 54,647 added after the same 28-path MT4 exclusion.
- Context and diff whitespace checks passed.

memory: none
