---
id: "0022"
title: Owner verification is an authority boundary
summary: Agents may draft or revise governed documents only as unverified; only Jayden may promote and stamp a reviewed revision, and structural automation cannot certify semantic truth.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Owner verification is an authority boundary

Documents directly under `docs/`, under `docs/hackathon/`, under `docs/memory/`, and under
`docs/development/decisions/` require owner verification.

- Agents create or materially revise them as `unverified` and remove any stale verification stamp.
- Only Jayden may promote a reviewed document to `canonical`, or a memory/ADR to `accepted`, and add
  `verified_by: Jayden` plus `verified_at`.
- A later material edit invalidates the earlier approval; the content returns to `unverified` before
  it can be reviewed again.
- Accepted ADR bodies are immutable. Replace an accepted architectural decision through explicit
  supersession rather than silently rewriting history.

`tools/context_sync.mjs` enforces the transition and document shape, but cannot determine whether a
claim is true. Owner sign-off also does not make volatile measurements permanent; executable and
timestamped evidence must still be checked.
