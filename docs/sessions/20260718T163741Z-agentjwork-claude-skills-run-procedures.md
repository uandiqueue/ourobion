# Session 20260718T163741Z — agentjwork — claude — skills-run-procedures

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, post-run capture) · **Branch:**
  `docs/skills/run-procedures` (plain branch off `dev-phase2` @ d0578f8 — chain fully merged) ·
  **Issue:** see PR
- **Type:** docs-only — capture the Phase-2 run's repeatable procedures as a Claude
  **orchestration skill set** under `.claude/skills/`: one master skill
  (`orchestrate-build-run`) + two standalone member skills (`stacked-pr-chain`,
  `windows-toolchain-gotchas`), so a future session with no memory of the run can operate
  and recover it. Scope was extended mid-session by Jayden (two standalone skills → full set).

## Attempted
- Distill the run's operating loop and its two hardest-won operational lessons into skills,
  verifying every claim against the repo record (session logs, orchestration log, sign-off /
  config / blocked docs, source files) before writing it down.

## Changed (committed)
- **`.claude/skills/orchestrate-build-run/SKILL.md`** (NEW, master) — the run operating loop:
  roles (orchestrator never edits code; ONE writer at a time, no worktrees on solo runs per
  the standing waiver; parallel read-only Explore agents); startup checklist (toolchain,
  `--session-start`, run docs as resume point, **verify the integration branch really
  contains what "merged" claims** via `git log <integration>..<tip>`, graphify refresh);
  assessment-before-dispatch (verified baseline + sequenced worklist); the 7-step unit
  lifecycle (branch from chain tip → build → full gate + live proof → one commit + session
  log → push → issue/PR, never merge → run-doc rows updated per unit); decisions & blockers
  (B/D/C entry disciplines; never halt on human-gated items; by-design findings skipped,
  not re-decided — A15/D9 precedent); honesty invariants (`INTERIM:`/`MOCK:` provenance,
  ran-vs-statically-checked reporting, honest end-state over demo shine).
- **`.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md`** (NEW) —
  the proven build-agent brief skeleton (Environment gotchas / Session setup / Read-first
  with exclusions / The change / Tests + live proof / Gate / Bookkeeping / Commit-push-PR /
  Return format) + a filled example condensed from the run's U24 dispatch.
- **`.claude/skills/orchestrate-build-run/references/tracking-docs.md`** (NEW) — the four
  `docs/temp/phase2-run-*.md` run docs: index-exempt placement, per-doc record formats
  (worklist statuses, ledger rows, B/D/C entry shapes), and the update-after-every-unit rule.
- **`.claude/skills/stacked-pr-chain/SKILL.md`** (NEW, member) — when to stack session
  branches (merge human-gated, dependent units can't wait; cut from predecessor tip, PR base
  = predecessor branch, merge order in PR bodies); the correct merge procedure (bottom-up,
  "Delete branch" after EVERY merge — deletion triggers GitHub's base auto-retarget; never
  merge unless the base line shows the integration branch; 2-click alternative: merge bottom,
  retarget + merge the tip, close intermediates); the reverse-cascade failure mode +
  detection; recovery (ONE tip→integration PR, no rebase/cherry-pick) and branch-cleanup
  safety (`git branch -r --merged` + `git cherry -v`, `-d` never `-D`).
- **`.claude/skills/stacked-pr-chain/references/phase2-reverse-cascade.md`** (NEW) — the
  incident record: D1-amended stacking, PRs #43–#71 merged upward into parent branches, only
  #43 reached `dev-phase2` (81b5827), 28 commits pooled on `feat/shared/l6-one-card-slice`
  (f442eac), recovery PR #72 per D20.
- **`.claude/skills/windows-toolchain-gotchas/SKILL.md`** (NEW, member) — the six recurring
  traps, each verified against its primary record: (1) node/flutter not on base PATH,
  `. .\scripts\biotope-env.ps1` per shell; Git Bash has no node so the pre-push hook kills
  `git push` — push from PowerShell; (2) 7-file `apps/biotope/{linux,macos,windows}`
  generated-plugin EOL churn (+ occasional `docs/memory/README.md`) — verify content-empty,
  `git checkout --`, never commit; (3) Write-tool NUL bytes — detection (`Bin` diffs,
  ripgrep skips) + perl fix + the DELIBERATE `\x00` map-key separator in
  `compute-baselines/index.ts` (:129) as the check-first counterexample; (4) PS 5.1 can't
  parse the BOM-less `seed-test-data.ps1` — pipe the SQL into `supabase_db_ourobion` psql
  with `-v` overrides (proven form from the SQL header + U7 log); (5) deno absent locally —
  serve + HTTP invoke, CI deno-check is the type gate (U29 precedent); (6) here-string /
  heredoc rules. Points to AGENTS.md §4 + the backend-test-plan brief for full commands.
- **`docs/temp/phase2-run-orchestration-log.md`** — ledger row: skill set captured post-run.

## Decided
- **Set structure:** master + two standalone members. The members keep independent triggers
  (chain trouble / Windows traps occur outside full runs) and carry a one-line
  "Part of the orchestrate-build-run skill set" pointer; the master cross-references them
  by name instead of duplicating their content.
- New skills over editing: only `graphify` existed under `.claude/skills/` (a packaged tool
  skill, unrelated) — nothing covered these topics.
- Front-matter matches the house shape (`name` + quoted `description`, nothing else); long
  detail split to `references/` per the graphify layout so each SKILL.md stays concise.
- The NUL-byte "twice" claim written as "more than once" — one occurrence is in the record
  (`identity.ts`, session 20260629T054330Z); the second is run experience without a log
  line, so the skill cites only what the record supports.
- Session log filename uses actual UTC now (20260718T…) per house convention, though the
  local date has rolled to 2026-07-19.

## Left
- Nothing pending for the set. If GitHub changes stacked-PR retarget behavior, revisit
  `stacked-pr-chain`. If a future run outgrows the Phase-2 doc names
  (`phase2-run-*.md`), generalize `tracking-docs.md` paths then.

## Blockers
- None. Gate: `flutter analyze` clean · `flutter test` 66/66 untouched-green ·
  `node tools/context_sync.mjs --check` pass (skills + docs/temp are outside INDEX
  enforcement) · all six new skill files byte-verified NUL-free (per the skill's own rule).

memory: none
