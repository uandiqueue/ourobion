# Session 20260617T064658Z — uandiqueue — claude — graphify-setup-and-readme

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (worked directly, per owner instruction)
- **Type:** Tooling + docs. Closes the new-device gap for graphify + documents its usage. No app/backend code.

## Attempted
Owner asked to (1) close the migration gap so a fresh device gets graphify from the setup script (it
wasn't installed by `setup.ps1` — only lazily by `graphify-build.ps1`), and (2) document graphify in the
README for human users, making clear the auto-integration is **Claude Code only** and other models/tools
must trigger graphify themselves.

## Changed
- **`scripts/setup.ps1`** — added a non-fatal "graphify" step that calls `graphify-build.ps1` (installs
  the bounded venv + builds the initial graph). The Claude hook + `CLAUDE.md` block are already committed,
  so only the CLI binary is installed here.
- **`scripts/graphify-build.sh`** (new) — bash parity of `graphify-build.ps1`: bootstraps the
  project-bounded venv (`../biotope-toolchain/graphify-venv`) and builds `graphify-out/`. `--cluster` opt-in.
- **`scripts/setup.sh`** — added a non-fatal graphify step (invokes `graphify-build.sh` via `bash`, skips
  cleanly if `python3` is absent).
- **`README.md`** — new "Code navigation — graphify" section: what it is, auto-install + rebuild commands
  (PS + bash), `graphify-out/` is gitignored/rebuildable, and a Claude-vs-other-tool-vs-no-AI table
  making explicit that the auto-hook is Claude-Code-only and everyone else runs the CLI manually
  (`graphify query/path/explain`), plus the API-key/cost note (free in Claude Code; key needed headless).

## Decided
- **Migration model unchanged and reaffirmed:** the toolchain (incl. graphify) is **regenerated, not
  copied** — clone repo + Docker/Git, run `setup.ps1`/`setup.sh`. The hook config travels in the repo
  (`.claude/settings.json` + `CLAUDE.md`), so only binaries are installed per device.
- **graphify is auxiliary** → its setup step is non-fatal in both installers (a graphify failure never
  blocks app setup). `setup.sh` calls the build via `bash` so it doesn't depend on the file's +x bit.

## Left
- `graphify-build.sh` is committed with the executable bit set (`git update-index --chmod=+x`); standalone
  `./scripts/graphify-build.sh` works, and `bash scripts/graphify-build.sh` works regardless.
- Non-Claude tool integrations (`graphify gemini install`, etc.) are documented but not pre-wired — by design.

## Blockers
- None.
