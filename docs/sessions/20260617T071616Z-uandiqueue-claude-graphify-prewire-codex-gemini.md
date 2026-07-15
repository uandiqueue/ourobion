# Session 20260617T071616Z — uandiqueue — claude — graphify-prewire-codex-gemini

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (worked directly, per owner instruction)
- **Type:** Tooling + docs. Pre-wire graphify for Codex (GPT) + Gemini, alongside the existing Claude Code wiring. No app/backend code.

## Attempted
Owner asked to pre-wire graphify for GPT and Gemini too (Claude Code was already wired). Ran graphify's
own installers, then reconciled their output with the repo's conventions and portability needs.

## Changed
- **Codex (GPT):** `graphify codex install` registered `.codex/hooks.json` and appended a graphify block
  to `AGENTS.md`. Two fixes:
  - `.codex/hooks.json` hardcoded this machine's absolute venv path
    (`C:\project\biotope-toolchain\…\graphify.EXE`) — replaced with portable **`graphify hook-check`**
    (relies on PATH after toolchain activation, like everything else here).
  - The installer injected a `## graphify` H2 **mid-§8 of AGENTS.md**, truncating the existing graphify
    bullet and duplicating §8. Repaired the bullet and removed the duplicate block; §8 now carries the
    query commands inline (Codex reads AGENTS.md) and lists all three pre-wired tools.
- **Gemini:** `graphify gemini install` registered `.gemini/settings.json` (portable `python -c` hook,
  left as-is) and a `## graphify` block in `GEMINI.md` (kept — mirrors the CLAUDE.md treatment).
- **README:** the "automatic?" table now shows Claude Code, **Codex (GPT)**, and **Gemini CLI** as
  pre-wired (each: hook + the file that tool reads); other tools run `graphify <tool> install` or the CLI.
- **docs/graph/README.md + memory 0008:** "Agent integration" updated from Claude-only to the three
  pre-wired tools.

## Decided
- **Three tools pre-wired via committed config** (`.claude/`, `.codex/`, `.gemini/` + the per-tool
  instruction file) so a fresh clone is wired after toolchain install. Only the CLI binary installs per
  device; the global graphify skill dirs (`~/.agents/skills/…`) are machine-local and not needed for the
  hooks to work.
- **Did NOT add installer calls to setup.ps1/setup.sh** — the hook config is already committed; re-running
  `graphify <tool> install` on a fresh device would duplicate the committed blocks.
- **AGENTS.md stays curated/clean** — graphify's auto-injected H2 was removed; its operational lines live
  in §8 only.

## Left
- Codex/Gemini hooks assume `graphify` on PATH (toolchain activated) — same model as the rest of the repo.
- The Gemini hook uses `python` (the Windows Store shim on this machine), so it degrades to no-op here;
  fires on machines with a real `python`. Acceptable (best-effort, as graphify ships it).
- Cursor/Copilot/etc. are documented but not pre-wired, by design.

## Blockers
- None.
