# Session 20260610T021136Z — uandiqueue — claude — local-test-seeder

> Session log format (use for every session): **Attempted / Changed / Decided / Left / Blockers**.
> A session's FIRST step is to read the latest few files in this directory to resume context, then run
> `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-jayden
- **Type:** Dev tooling + docs (no app/migration/contract code).
- **Goal:** Answer how to run the app on the Android emulator on this Windows-native box, and build a
  human-readable test-data seeder so time-based features (streaks/baselines/insights) can be tested
  without logging by hand for a week.

## Attempted
Walked the Android-emulator run flow (toolchain activation, execution-policy fix, Supabase container
conflict, per-shell PATH). Then **evaluated feasibility before building**: traced the four UI read paths
to confirm which are raw tables vs derived projections, and the RLS + job-ordering constraints. Built
the seeder per that evaluation and wrote up the iOS/Apple-Health/local-auth constraints as durable facts.

## Changed (tooling + docs only)
- **`scripts/seed-test-data.sql`** (new) — commented, standalone-runnable seeder: resolves the target
  user by email (RLS needs the real UUID), injects N backdated `daily_gut_rows` (+ optional
  `wearable_daily` / antibiotic course), and rebuilds `engagement_state` in SQL **mirroring**
  `engagement_service.dart`. Tunables via `psql -v`, defaulted with `\if :{?x}`; psql vars bridged into
  the `$$` DO block via `set_config`/`current_setting`.
- **`scripts/seed-test-data.ps1`** (new) — runner: finds the `supabase_db_*` container, pipes the SQL in
  via `docker exec`, then POSTs `compute-baselines` → `generate-insights` (ordering matters) using the
  service-role key from `supabase status`. Tunable `param()` block at top.
- **`docs/memory/0009-local-test-data-seeding.md`**, **`0010-ios-build-needs-mac-and-paid-account.md`**,
  **`0011-local-supabase-auth-email-only.md`** (new) — indexed in `docs/memory/README.md`.
- **`AGENTS.md` §4** — new "Local testing — seed instead of logging for a week" command + a
  "Platform & auth constraints" note.
- This session log.

## Decided
- **Seed, don't wait.** Raw rows key on `log_date`, so backdated injection renders the UI "weeks in".
  This is the [[0001-two-tier-truth]] model in script form: inject truth, rebuild projections.
- **Full pipeline + replicate M6 in SQL + PowerShell/`docker exec`** (user picked all three recommended
  options). engagement_state has no edge function, so its rebuild is duplicated in SQL — flagged as a
  drift risk in the file and in memory 0009.
- **Platform facts are durable:** no iOS build on Windows; HealthKit/Apple-Sign-In need the paid Apple
  Developer Program ($99/yr) + a real device; local auth is email/password only (OAuth → hosted project).

## Left
- End-to-end run of the seeder not yet executed here (needs the stack up + a signed-in test user) —
  offered to the owner. Verify it renders on `biotope_pixel`.
- If M6 streak/title rules change, update the SQL rebuild in `seed-test-data.sql` to match.
- Generated desktop `*_plugin_registrant.*` (linux/macos/windows) are modified in the worktree but
  **excluded from this commit** as unrelated generated artifacts.

## Blockers / notes
- Earlier `supabase start` left an orphaned `supabase_vector_biotope` container (name conflict) and the
  analytics/Vector service wants Docker TCP on Windows — clear with `docker rm -f`, or disable analytics.
- PowerShell execution policy blocked `biotope-env.ps1` until `Set-ExecutionPolicy -Scope CurrentUser
  RemoteSigned`; activation must be dot-sourced per shell.

## Addendum — integration target changed main → dev-phase2 (same session)
- **Checked the "artifacts":** the 7 modified desktop `*_plugin_registrant.*` (linux/macos/windows)
  files were **EOL-only churn** (`git diff --ignore-cr-at-eol` empty; `core.autocrlf=true`) from Flutter
  regenerating them with CRLF. **Not harmful** — discarded, not committed.
- **Owner re-pointed the integration seam:** everything now PRs into **`dev-phase2`** (the phase-2
  integration line), **never `main`**; **only `dev-phase2 → main`** at phase/milestone completion. The
  old convention pointed daily PRs at `dev-alton`.
- **Changed (docs):** `AGENTS.md` §5 (integration-seam bullet) + §7 (`gh pr create --base dev-phase2`);
  `docs/dev-workflow.md` (steps 7 & 9, Branch Model diagram, "When … Merges to main" section);
  `docs/AGENT-PROTOCOL.md` PR-destination/merge lines.
- **Propagation:** applied as its own docs-only commit on **dev-jayden** and replicated on **dev-alton**
  (independent identical commit, each with its own session log — conflict-free). `dev-phase2` inherits
  the change when either branch's next PR merges in.
