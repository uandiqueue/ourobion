# Session 20260617T041218Z — uandiqueue — claude — graphify-adoption

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** chore/graphify-adoption (worktree, cut from dev-phase2)
- **Type:** Tooling + docs — adopt graphify for repo context management. Issue **#12**. No app/backend code.

## Attempted
Owner asked to **adopt graphify** (NEXT-PHASE-PLAN step A), reversing the prior "design-only — do not
install yet" decision (memory 0008 / the 2026-06-10 probe). Two decisions confirmed with the owner up
front: (1) **repo-consistent wiring** — do NOT let graphify's installer edit `CLAUDE.md` / register
hooks; (2) the cross-language semantic pass should use the **local agent**, not a separate API key —
verified against graphify's docs that invoking it inside Claude Code uses the host session model.

## Changed
- **Installed graphify project-bounded** — `graphifyy` 0.8.40 into a venv at
  `..\biotope-toolchain\graphify-venv` (build tooling, uncommitted, never global). `graphify install`
  was **not** run (no `CLAUDE.md` edits, no hooks).
- **Indexed biotope's own repo** (AST-only, local, no LLM): 153 files → 1445 nodes / 1513 edges
  (680 Dart, 31 TS). Output in repo-root **`graphify-out/`** (graphify's native dir).
- **`.gitignore`** — added `graphify-out/` (§6 new block): rebuildable projection, gitignored.
- **`scripts/graphify-build.ps1`** (new) — idempotent wrapper: bootstraps the venv on first run,
  rebuilds the graph (`-Cluster` opt-in). ASCII-only (PS 5.1 reads `.ps1` as ANSI).
- **`AGENTS.md` §8** — added graphify as the ADOPTED semantic-context layer (complementary to the
  still-DEFERRED structural import-graph).
- **`docs/graph/README.md`** — new "Semantic context graph — graphify (ADOPTED)" section (rebuild cmd,
  output path, no-key/no-installer notes).
- **`docs/memory/0008-graphify-context-tool.md`** — flipped to **Status: ADOPTED (2026-06-17)**;
  re-verified Dart coverage (0.8.40 now emits Dart `calls`/`mixes_in`/`extends` edges — the 0.1.14
  probe had none). Indexed in `docs/memory/README.md`.
- **`docs/NEXT-PHASE-PLAN.md`** — roadmap row A → DONE; §A rewritten to "ADOPTED"; open-decision #2
  (committed-vs-gitignored) RESOLVED = gitignored; corrected the "deferred-by-design" line so it no
  longer implies graphify fills the structural-graph role.
- This session log.

## Decided
- **Artifacts live at repo-root `graphify-out/`, not the originally-planned `docs/graph/generated/`.**
  graphify 0.8.40 hard-defaults to `graphify-out/` and its incremental `update`/`query`/`watch` assume
  it (`update` has no `--out`); honoring the plan's pre-install guess would break the incremental
  workflow. Documented as superseding the planned path.
- **Gitignored** (open-decision #2) until a path-normalizer (port NUSPlan `tools/normalize_deps_graph.mjs`)
  makes `graph.json` diff cleanly cross-machine; then promote `graph.json` to committed + add a
  regenerate/diff check to `tools/context_sync.mjs --check`. `graph.html` stays gitignored (heavy).
- graphify remains **complementary to, not a substitute for, the deferred structural import-graph**
  (semantic vs structural) — unchanged from 0008's framing.

## Left
- **Promote `graph.json` to committed + wire the `context_sync.mjs --check` regenerate/diff** once the
  path-normalizer exists (deferred; needs the normalizer port first).
- **Semantic-LLM pass via the local agent** is enabled in principle (no key) but not yet exercised
  end-to-end for Dart↔TS concept merging — run on demand when context work needs it.
- Pin/track the graphify version if reproducibility across machines becomes an issue (currently floats
  to latest on first `graphify-build.ps1` run; 0.8.40 today).

## Blockers
- None.
