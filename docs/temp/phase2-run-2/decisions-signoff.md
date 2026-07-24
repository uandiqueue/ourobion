---
title: Phase-2 Run 2.0 — Decisions for Sign-off (D-entries)
summary: Every non-trivial choice the Run-2.0 orchestrator made autonomously — design, schema, contract, config, test-strategy, the OpenAI-only decorrelation override, any ADR/architecture amendment intent. Jayden's retroactive-review queue. shared/- or ADR-touching entries carry the B8 2-reviewer flag. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 — Decisions for sign-off

Format per entry: the choice · alternatives rejected · why · source unit. Amendments append
(`Dn AMENDED`), never rewrite. C-entries (numeric/config values) are folded in here as `C2.x` rows
to keep Run 2.0's review surface in one doc.

## D1 · Run in a dedicated worktree; carry the run inputs onto the run branch — U0

- **Choice:** run in worktree `C:\project\ourobion-run2` on `feat/phase2-run-2/*` off
  `origin/dev-phase2` @ e185cf0; commit the run's input docs (`next-build-optimizations.md` Run-2.0
  version, the adversarial-verdict doc, the orchestrator prompt) plus Jayden's two prep diffs
  (`.gitignore` non-anchored `.open-next/`/`.next/` for graphify; `tools/brain-ingest/.env.example`
  LLM-provider block) in the U0 bootstrap commit.
- **Alternatives rejected:** (a) build in the main checkout — rejected: it sits on `signoff/phase2`
  with Jayden's uncommitted sign-off work (launch prompt says worktree when the checkout is in use);
  (b) leave the input docs uncommitted — rejected: they exist ONLY in the main checkout's working
  tree, so a fresh resume session (PART R) could not reconstruct the run's inputs from the branch.
- **Why:** resumability requires branch + tracking docs to be the complete state; the inputs are part
  of that state. Note the memory that solo runs skip worktrees is superseded here by the launch
  prompt's explicit instruction (checkout in use).

## D2 · OpenAI-only posture = TEST-MODE decorrelation override (ADR amendment intent) — U1 (planned)

- **Choice (per launch prompt PART 3 — Jayden's decision, recorded here for retro-review):** all
  router nodes point at gpt-*/o* ids on `api_worker`; the synthesis↔verifier family-decorrelation
  invariant is overridden behind an explicit, clearly-labelled TEST-MODE flag. Every verifier result
  this cycle is worded "scaffolded + unit-tested", NOT "demonstrated independent verification", in
  demo/UI and logs.
- **ADR amendment intent:** touches the accepted decorrelation invariant (memory 0012 / ADR-0012
  lineage, C6/O7). Accepted ADR bodies are immutable — this entry IS the recorded amendment intent;
  flagged for retro-review. The general O7 fix (family(verifier) !== family(synthesis)) still lands
  with B5, unchanged.
- **B8 flag:** any shared/-touching implementation detail will be listed on the owning unit's entry.

_(Further D-entries appended per unit as the run executes.)_
