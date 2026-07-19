# Dispatch-brief anatomy — the proven build-agent brief skeleton

Every section below earned its place during the Phase-2 run (a missing section = a
predictable failure: wrong branch base, merged PRs, phantom churn committed, unusable
report). Write the brief so an agent with **zero memory of the run** succeeds.

## Skeleton

```
You are a build agent in C:\project\ourobion (Windows). <One-sentence mission.>

## Environment gotchas
- Toolchain per PowerShell shell: `. .\scripts\biotope-env.ps1`; git in bash,
  push from PowerShell (pre-push hook needs node).
- Do NOT merge anything; never touch main.
- Before committing: discard generated-plugin churn (`git checkout -- apps/biotope/`)
  after verifying the diff is EOL-only.
  (Full list: the windows-toolchain-gotchas skill.)

## Session setup
- You are on `<base branch>` @ <sha> (or later — pull first).
- Cut: `git checkout -b <type>/<area>/<slug>`
  (base = current chain tip when stacking, else <integration-branch>).

## Read first
- <finding/spec/ADR/decision docs — exact paths, most-binding first>
- <the code files in scope>
- Decisions already made — cite D/C refs; the agent must NOT re-litigate them.
- do NOT read <large irrelevant docs> — keep your context for the change.

## The change
- <exact spec: files, behavior, contracts, edge cases>
- <what is explicitly OUT of scope>

## Tests + live proof
- <new/updated tests expected, per touched package>
- Behavior changes: really run it on the local stack — record the SQL/HTTP
  evidence (response fields, row counts) in the session log, not claims.

## Gate (all green before PR)
- flutter analyze · flutter test · node tools/context_sync.mjs --check
- <touched package suites: tsc --noEmit, npm test, db reset, functions serve …>

## Bookkeeping
- Session log docs/sessions/<UTC>-<device>-claude-<slug>.md, house format
  (Attempted/Changed/Decided/Left/Blockers) + `memory:` line.
- Update docs/temp/<run-slug>-orchestration-log.md: worklist row + ledger row.

## Commit / push / PR
- One commit: `<type>(<scope>): <summary>` + Co-Authored-By line. Push.
- `gh issue create` + `gh pr create --base <predecessor branch or <integration-branch>>`
  (body: what + why the bar is met, Closes #<issue>, Claude Code footer).
- Do NOT merge.

## Return
Report: <the exact facts the orchestrator needs — paths, counts, PR/issue
numbers, deviations>. Final message is orchestrator data.
```

## Filled example (condensed from the run's U24 dispatch)

> You are a build agent in C:\project\ourobion (Windows). Fix audit findings A13/A14 in
> both loaders.
> **Environment gotchas:** toolchain per shell; never merge; discard `apps/biotope/` churn.
> **Session setup:** on `fix/m5b-app/relationship-cards-utc-expiry` (chain tip) — cut
> `fix/loaders/empty-guard-timestamp-normalize`.
> **Read first:** audit register A13/A14; D13 (prune model — already decided, do not
> revisit); `tools/edge-loader/load_edges.mjs`, `tools/rules/load_rules.mjs`. Do NOT read
> the architecture doc end-to-end.
> **The change:** empty validated set aborts (exit 1, no prune) unless `--allow-empty`, in
> BOTH loaders, firing in `--check` too; `canonicalVerifiedAt()` (UTC toISOString) for
> dedup key + supersede ordering + the `verified_at` column; jsonb stays verbatim.
> **Tests + live proof:** +8 edge-loader, +6 rules; live on the local stack: empty dir →
> exit 1 tables untouched; `--allow-empty` → emptied; mixed-offset mirror → correct
> supersede; re-run prunes 0.
> **Gate:** both suites + both tsc + flutter 62/62 untouched-green + context_sync --check.
> **Bookkeeping/PR:** session log + ledger row; issue + PR based on the predecessor
> branch; do not merge.
> **Return:** suite counts, live-proof observations, PR/issue numbers.
