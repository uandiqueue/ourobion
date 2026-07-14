---
title: Archive — rules and containment
summary: How docs/archive works — frozen provenance-only files, each carrying a forward-link banner; no active doc may link in (links flow archive→active only); agents skip it unless pointed at a specific path (see root .aiignore). Index source for archive policy.
type: process
scope: repo
status: canonical
updated: 2026-07-13
---

# Archive — rules and containment

`docs/archive/` holds **superseded and historical** documents kept only for provenance — the record of
how the current design was reached. Nothing here is ground truth. Build from the active docs under
`docs/shared`, `docs/nao`, and `docs/biotope`, never from here.

## Rules

- **Frozen — never edited.** Archived bodies are left exactly as they were when archived. Their internal
  links may be stale; that is expected and exempt. Do not "fix" them.
- **Every file carries a banner.** After any front-matter, each archived `.md` opens with a one-line
  banner that forward-links to the active doc that replaced it:

  > **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [<name>](<path>).

- **Containment — links flow archive → active only.** No active doc (under `docs/shared`, `docs/nao`,
  `docs/biotope`, `docs/temp`, `AGENTS.md`, `README.md`) may link *into* `docs/archive/`. If an active doc
  once pointed at a now-archived file, it must be repointed to the ground-truth doc that absorbed the
  content. Archived files may link out to active docs (via their banner); active docs must never link in.
- **Agents skip it.** Agents, ETL, and graphify treat `docs/archive/` as implicitly excluded (see the root
  `.aiignore`). Read a file here only when explicitly pointed at its path.

## Layout

- `briefs/` — dated human/stakeholder briefs, superseded by the current plans, memory decisions, and the
  insight-engine architecture.
- `research/fable/` — the self-contained Fable design pack whose flagship output was promoted to
  `docs/shared/insight-engine-architecture.md`.
- `hackathon/` — earlier hackathon self-judgement and narrative studies, superseded by
  `docs/shared/hackathon/hackathon-direction.md`.
