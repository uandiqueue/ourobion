---
session: 20260802T021500Z-agent-j-claude-biotope-pubspec-lock-metrics-dep
agent: agent-j (Claude, orchestrator) — session log added to an existing fix by uandiqueue
date: 2026-08-02
scope: apps/biotope/pubspec.lock
---

# biotope's lockfile did not describe its declared dependency set

## What was wrong

`apps/biotope/pubspec.yaml:33` declares `ourobion_metrics` as a path dependency on
`../../shared/metrics`, but the committed `pubspec.lock` carried no entry for it.

Practical effect: every `flutter pub get` regenerates that block, so anyone who builds biotope
has a **permanently dirty working tree on a tracked file**. It showed up in `git status` on this
machine continuously through the 2026-08-01/02 run and had to be stepped around on every commit
— including being stashed before a branch switch.

The change is exactly the 7-line block `flutter pub get` produces. No version bumps, no other
packages touched.

## Why this log exists

The fix itself was authored by `uandiqueue` in PR #361. `context_sync --check` failed the PR
because this repo requires a `docs/sessions/` entry per commit, and that was the only real
failure on it — Flutter, Deno, the Node tool suites, migrations, TypeScript and nao all passed;
the four checks that appeared red were `SKIPPED`, gated behind the context job rather than
failing on their own.

This log supplies the missing entry so the fix can land.

## Gates

- `context_sync --check` — passed with this file present
- `git diff --check` — clean

Lockfile plus this log. No source change, no schema change, no provider calls.

memory: a `path:` dependency declared in `pubspec.yaml` but absent from `pubspec.lock` produces a
tracked file that is dirty immediately after any `pub get` — if a lockfile keeps reappearing in
`git status` on a clean checkout, check for a declared-but-unlocked path dep rather than
assuming local churn.

Refs #361
