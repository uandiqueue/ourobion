---
session: 20260801T200232Z-agent-j-codex-nao-live-autodeploy
agent: codex
date: 2026-08-01
scope: apps/nao, .github/workflows/nao-deploy.yml
---

# nao live deployment and main-branch auto-deploy

Issue: #373. Branch: `chore/nao/deploy-main-live`, cut from `dev-phase2-run4` in an isolated
worktree. The deployed nao runtime tree was byte-identical to `origin/main:apps/nao` at merge
commit `5a5af7c` (tree `79581a33e32bbf65e15f0a20d205f57edb9b4255`).

## Attempted

- Diagnose why merging nao changes to `main` did not update `nao.ourobion.com`.
- Deploy the merged `main` nao runtime to the existing Cloudflare Worker.
- Add a guarded GitHub Actions deployment for future nao-relevant pushes to `main`.

## Changed

- Deployed `ourobion-nao` through the repository's OpenNext/Cloudflare configuration. Cloudflare
  activated version `b900f28f-0b16-4c46-be8e-3685fc447266` at 100% on the
  `nao.ourobion.com` custom domain.
- Added `.github/workflows/nao-deploy.yml`: main-only push + manual triggers, pinned action SHAs,
  serialized production deploys, fail-closed credential preflight, locked install, typecheck,
  tests, production public env projection, and OpenNext deploy.
- Added `npm run deploy`, using OpenNext build/deploy with `--keep-vars` so dashboard-managed
  Worker values are preserved.
- Added three textual workflow contract tests and documented the automatic/operator paths.
- Set the repository's `CLOUDFLARE_ACCOUNT_ID` secret to the authenticated account ID.

## Decided

- Trigger only when `apps/nao/**`, `shared/**`, or the deploy workflow changes on `main`.
  nao imports the shared metrics registry, so `shared/**` is part of its build blast radius;
  unrelated Flutter-only merges do not need to republish the same Worker.
- Always check out `refs/heads/main`, including manual retries, and skip the job from any other ref.
- Do not copy the machine's broad Wrangler OAuth token into GitHub. CI needs its own scoped
  `CLOUDFLARE_API_TOKEN`.

## Left

- Add repository secret `CLOUDFLARE_API_TOKEN` with permission to edit the `ourobion-nao`
  Worker and its route/bindings. The other three workflow inputs already exist:
  `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
- Merge this session PR into `dev-phase2-run4`, then promote that line to `main`. The workflow
  file's own arrival on `main` matches its path filter and performs the first automatic deploy.
- npm reported six existing high-severity audit findings in the locked dependency graph. No
  lockfile mutation or automatic audit fix was attempted during deployment.

## Blockers

- Automatic deployment is credential-blocked until `CLOUDFLARE_API_TOKEN` is added to GitHub.
  The current live deployment is not blocked.

## Verification

- `npm run typecheck`: clean.
- `npm test`: 411 passed, 0 failed.
- `npm run lint`: no warnings or errors.
- Workflow YAML parsed with the installed YAML parser; `git diff --check` clean.
- Post-deploy `wrangler secret list`: all four required Worker secrets retained.
- `wrangler deployments status`: version
  `b900f28f-0b16-4c46-be8e-3685fc447266` receives 100% of traffic.
- `https://nao.ourobion.com/` and `/login`: HTTP 200 with `x-opennext: 1`.

memory: none
