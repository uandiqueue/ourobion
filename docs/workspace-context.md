# workspace-context.md — SUPERSEDED (pointer only)

> **This file is no longer the variable-layer tracker.** A single in-place file is merge-conflict-prone
> for a 2-person team, so the rolling per-session editing here has been replaced by **append-only,
> one-file-per-session logs**. Nothing was lost — see where each part went below.

## Where its content went

- **Session & commit conventions** → [`AGENTS.md`](../AGENTS.md) §5 + [`docs/commit-conventions.md`](commit-conventions.md).
- **Phase timeline + team workstreams (ownership)** → [`AGENTS.md`](../AGENTS.md) §6 (the durable parts).
- **Recent Change Log** → backfilled into `docs/sessions/` as a historical session log
  (`docs/sessions/20260601T000000Z-uandiqueue-team-historical-backfill.md`); all new work writes one
  file per session going forward.
- **"Blocked by / Needs" notes that were durable gotchas** → `docs/memory/` (e.g. HRV SDNN is iOS-only,
  wearable sync is best-effort, pg_cron config prereqs).

## What to do now (per the protocol in AGENTS.md §7)

- **Session start:** run `node tools/context_sync.mjs --session-start` and read the latest
  `docs/sessions/` files.
- **Session end / before a PR:** write exactly one `docs/sessions/<UTC-timestamp>-<device>-<agent>-<slug>.md`
  (Attempted / Changed / Decided / Left / Blockers) and post a summary on the session's GitHub issue.

The pre-push hook and CI **fail** if a push has no session log, so this replacement is enforced, not
optional.
