---
title: Hackathon write-up drafted and moved into the repo
summary: Drafted the Launchpad 2026 submission write-up (five pillars, ≤1,000 words, appendices free) from the existing hackathon-prep guideline docs and the evidence ledger, then moved it from a scratch location into docs/shared/hackathon/submission/writeup.md with front-matter.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Hackathon write-up drafted and moved into the repo

Issue: #212
Branch: `docs/hackathon-writeup-submission`

## Attempted

- Wrote the submission-ready write-up for the Launchpad 2026 AI Challenge, using
  `docs/shared/hackathon/hackathon-direction.md` §11 (Pillar 1/5 drafts), the evidence ledger, and
  `deliverable-3-writeup.md`'s scaffold (all outside this repo, in the user's hackathon-prep workspace) as
  source material.
- Re-measured the prebuild/delta commit split directly from `git log` rather than quoting the docs (118
  prebuild commits through `2026-07-03` ending `2214fbb`; 248 delta commits `2026-07-13` → `2026-07-28`).
- Confirmed via `git tag -l` that `pre-hackathon-baseline` does not yet exist, and via repo search that no
  hand-labelled gold set / baseline-vs-verifier eval exists yet — both stated honestly in the write-up
  rather than invented.
- Moved the finished write-up from a scratch file into `docs/shared/hackathon/submission/writeup.md` with
  front-matter (`type: reference`, `status: draft`), per the user's request.

## Changed

- Added `docs/shared/hackathon/submission/writeup.md`.
- Regenerated `docs/INDEX.md` via `node tools/context_sync.mjs --fix-index` to include the new doc.

## Decided

- Kept `status: draft` on the new doc (not `canonical`) since the write-up itself names two open gaps
  (the missing tag, the missing baseline eval) that should close before the doc is truly final.
- Did not touch the pre-existing unstaged/untracked changes present at session start
  (`apps/biotope/pubspec.lock`, `apps/biotope/macos/Podfile`, `docs/temp/next-build-optimizations.md`) —
  unrelated to this task, left as-is.

## Left

- `pre-hackathon-baseline` tag still not created (command is in the write-up's Appendix C).
- Baseline-vs-verifier eval still absent — the write-up's Evidence/Honesty sections state this plainly.
- `ATTRIBUTION.md` not yet committed to the repo root.

## Blockers

None.

memory: none
