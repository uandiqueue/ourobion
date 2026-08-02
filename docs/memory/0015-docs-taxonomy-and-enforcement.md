---
id: "0015"
title: Documentation roles and lifecycle
summary: Implemented, development, session, memory, hackathon, graph, and archive documents have distinct authority; generated indexes and structural checks do not substitute for owner verification or executable evidence.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Documentation roles and lifecycle

The `docs/` tree separates intent, work in progress, history, and durable memory:

- `docs/implemented/` — intended implemented architecture; volatile claims still require executable
  or hosted verification.
- `docs/development/` — plans, process, ADRs, and in-flight material.
- `docs/memory/` — durable one-fact-per-file decisions, boundaries, and gotchas.
- `docs/sessions/` — append-only event and handoff records; dated run state belongs here.
- `docs/hackathon/` — submission material and its plans.
- `docs/graph/` — curated relationships/couplings plus explicitly generated projections.
- `docs/archive/` — frozen or superseded provenance; never a build authority.

Each topic has one owning document; other documents point to it instead of copying volatile detail.
`docs/INDEX.md` is the navigation map. Generated indexes, front-matter validation, supersession links,
archive containment, and session coverage enforce structure, not semantic truth.

Documents under the owner-verification gate remain `unverified` after agent-authored or material
changes until Jayden reviews and signs that revision; see
[0022](0022-owner-verification-is-an-authority-boundary.md). Active documents must not link into
`docs/archive/`.
