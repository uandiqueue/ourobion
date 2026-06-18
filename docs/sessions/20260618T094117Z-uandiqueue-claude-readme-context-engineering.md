# Session 20260618T094117Z — uandiqueue — claude — readme-context-engineering

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (worked directly, per owner instruction)
- **Type:** Docs (human-facing). Document the development context-management system + its design principles in the README. No app/backend code.

## Attempted
Owner wanted a dedicated README section documenting biotope's **development-time context management**
(part of agent-driven app development) **with the design principles behind every rule** — framed for
humans/recruiters. Clarified two things first: the `dev-phase2` branch is a **per-phase integration line,
cut fresh each phase** (merges to main at phase end → next phase cut from main); and `docs/memory/`
`[[wikilinks]]` are a **past artifact** (no Obsidian workflow).

## Changed
- **`README.md`** — replaced the thin "Session Workflow" section with **"🧠 Context engineering — building
  biotope with AI agents"**: the problem (ephemeral agent memory → drift / collisions / silent contract
  breakage), 8 numbered **design principles** (single-source repo, constant/variable layers, two-tier
  truth, append-only one-file-per-session, executable couplings, automated enforcement, worktree
  isolation, graphify for context overload), a "How it's built" table mapping each piece to its
  principle, and a "How a session runs" loop incl. the `dev-phase2` per-phase lifecycle.

## Decided
- **README vs AGENTS split (owner directive, saved to memory):** README is human/recruiter-facing
  (what/why/principles/purpose, self-contained); AGENTS.md stays lean agent instructions (how, not why,
  must not overload an LLM). So the README section is self-contained narrative and **AGENTS.md was left
  untouched** — no "why" added there.
- Did **not** restate AGENTS.md's operational commands verbatim in README (different altitude: README =
  principles + map, with command-level detail living in AGENTS/scripts) to avoid harmful drift.

## Left
- **`[[wikilinks]]` in `docs/memory/` are a past artifact** (no Obsidian) — candidate cleanup: migrate to
  standard markdown links (also aligns with OKF + graphify, which prefer markdown links). Not done this
  session; offered.
- `docs/METRICS-REGISTRY-DESIGN.md` still **uncommitted** (pending owner go-ahead on the registry) —
  intentionally not in this commit.
- Repo is **not** OKF-conformant (assessed earlier); holding off on chasing the v0.1 spec.

## Blockers
- None.
