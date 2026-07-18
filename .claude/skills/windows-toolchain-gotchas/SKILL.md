---
name: windows-toolchain-gotchas
description: "Use at the start of any build/session work on this repo on Windows, or when hitting node-not-found, phantom file churn, binary-looking diffs, or seeder parse errors. The recurring Windows traps and their fixes."
---

# Windows toolchain gotchas — the recurring traps on this repo

Part of the **orchestrate-build-run** skill set (see that skill for the full run loop).

Six traps, each hit repeatedly during the Phase-2 run. Full command reference:
`AGENTS.md` §4 (Environment & commands) and the backend test plan
`docs/temp/briefs/2026-07-18-backend-test-plan.md` — don't duplicate them, read them.

## 1. node/flutter are NOT on the base PATH

Activate the bounded toolchain **per PowerShell shell**:

```powershell
. .\scripts\biotope-env.ps1
```

Git Bash has **no node** → `git push` from bash dies in the pre-push hook
(`.githooks/pre-push` runs `node tools/context_sync.mjs --check`; error:
"node: command not found"). **Push from an activated PowerShell**, use bash for
the rest of git.

## 2. Generated-plugin churn (phantom modified files)

`flutter test` / `flutter pub get` dirty **7 generated plugin files** under
`apps/biotope/{linux,macos,windows}` (`*_plugin_registrant.*` etc.) with
**line-ending-only** diffs (Flutter regenerates with CRLF; `core.autocrlf=true`).
`docs/memory/README.md` occasionally shows the same EOL-only churn.

Before committing: confirm the diff is content-empty
(`git diff --ignore-cr-at-eol` empty), then discard —
`git checkout -- apps/biotope/` (or the specific files). Never commit these.

## 3. Write-tool NUL bytes (binary-looking files)

File-writing has more than once produced literal NUL (0x00) bytes where spaces were
intended (e.g. the stray NUL in `identity.ts`, session log `20260629T054330Z`).
Symptoms: `git diff --stat` shows the file as `Bin`; ripgrep silently skips it;
a test fails mysteriously.

- Detect: `git diff --stat` showing `Bin`, or `perl -ne 'print "$.\n" if /\x00/' <file>`.
- **Check before fixing** — a NUL can be intentional:
  `supabase/functions/compute-baselines/index.ts` deliberately uses `\x00` as the
  `${user_id}\x00${metric_key}` map-key separator (line ~129; renders as a space in
  most viewers). Preserve it.
- Fix accidental ones: `perl -pi -e 's/\x00/ /g' <file>`.
- After any Write to critical code, byte-verify.

## 4. PowerShell 5.1 cannot parse BOM-less UTF-8 .ps1

`scripts/seed-test-data.ps1` is UTF-8 without BOM and **fails to parse** under
Windows PowerShell 5.1 (a mis-decoded `✓` becomes a smart quote inside a string).
Don't fight it — every session pipes the SQL straight into the DB container instead
(proven form, from the SQL file's own header + U7's session log):

```powershell
Get-Content scripts\seed-test-data.sql -Raw |
  docker exec -i supabase_db_ourobion psql -U postgres -d postgres `
    -v email=you@example.com -v days=45
```

The target auth user must already exist (RLS keys on `auth.uid()`); headless sessions
create it by direct `auth.users` INSERT — see
`docs/sessions/20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md`.

## 5. `deno` is absent locally

Edge functions cannot be `deno check`ed on this machine. Validate instead with
`npx supabase functions serve` + HTTP invokes; the CI `deno-check` job is the type
gate — first-run type failures surface on the PR, not locally (that is how U29's
TS2345 was caught).

## 6. Heredocs / multiline strings

- PowerShell here-strings: the closing `'@` / `"@` must be at **column 0**, own line.
- Bash heredocs work fine in Git Bash.
- Multi-line commit messages: here-string in PowerShell or heredoc in bash — never
  try backtick-continuation for message bodies.
