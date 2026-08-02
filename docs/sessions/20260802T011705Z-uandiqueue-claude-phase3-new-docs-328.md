---
title: Write the four reviewer-facing docs, fix AGENTS.md, and teach the secret-scan guard about historical paths
summary: Added system-truth, project-overview, engineering-practice and research-models; corrected a fabricated mechanism in the drafted system-truth; retargeted AGENTS.md onto the new taxonomy and onto main as the integration line; and fixed the secret-scan guard so a commit-pinned allowlist entry is validated against its own commit rather than HEAD, verified against a real gitleaks 8.30.1 history scan.
type: session
scope: repo
status: canonical
updated: 2026-08-02
---

# Phase 3 — the new docs, plus two corrections

Branch `docs/phase3/new-docs-328`, cut from `docs/reorg/taxonomy-328` (PR #378), which it depends on.

## Changed

Four new documents, drafted by subagents against briefs containing the Phase 1 **measured** figures
(agents were given the numbers rather than asked to find them, because earlier agent-sourced counts
were wrong by up to 7x):

- `docs/implemented/system-truth.md` — the measured ground truth
- `docs/project-overview.md` — origin, audience, why two systems, identity/logo, rescoped from the
  owner's brand doc (dropping the "life-science company" framing and the unrelated Yugen product)
- `docs/engineering-practice.md` — development cycle and enforcement discipline
- `docs/hackathon/the_launchpad_challenge/plan/research-models.md` — the Swiss-cheese argument,
  Zebra/Viceroy results, and why neither is wired in

`README.md` gained a "start here" table pointing at the first three. `AGENTS.md` was retargeted onto
the new taxonomy (0 dead doc paths remain) and onto `main` as the integration line.

## Decided

- **A subagent fabricated a mechanism, and it was caught by checking the code.** The drafted
  system-truth asserted that the directional card rule "emits cards only for edges carrying
  `decreases`" and that a correlational co-movement path "has not been implemented". Neither was in
  its brief and neither is true — `coMovementEdgeCardTemplate` and `classified.coMovementEdge` exist
  in `supabase/functions/generate-insights/index.ts`. Rewritten to state what is measured (13
  `correlates`, 1 `decreases`, exactly 1 cited card), to note that the co-movement path exists and is
  deliberately constrained, and to record explicitly that **the per-edge reason more cards have not
  appeared was not established** — rather than inventing one.
- **The secret-scan guard could not express a moved file's history, so the guard was fixed.** A
  gitleaks 8.30.1 history scan was run locally (binary SHA256-verified against
  `tools/secret-scan/pins.json`) and emits, for the historical finding:
  `1a69650…:docs/nao/nao-app-design.md:generic-api-key:198` — the path **as it was at that commit**.
  The guard required `entry.path` to equal the fingerprint's file *and* be tracked at HEAD; after the
  reorg those are unsatisfiable. Rewriting the path to the new location would have silently
  un-suppressed a real finding. Added `existedAtCommit()`: a **commit-pinned** entry is now validated
  against the commit it names, while dir-mode entries still require HEAD. This is not a relaxation —
  the path must still resolve to a real blob in history, ruleId must still match exactly, and globs
  are still refused.
  - This supersedes the interim decision recorded in the Phase 2 session log, which aligned both
    fields to the new path on a fail-visible argument. That would have failed CI; the scan proved it.
- **Verified end to end:** with the emitted `.gitleaksignore` applied, the `nao-app-design` finding is
  suppressed and no longer reported. Five findings remain, all at commit `1cb6f74` on the unmerged
  local branch `feat/db/run4-u3-atomic-demo-loader` — **not on `main`**, so CI does not see them.
- **AGENTS.md branch model updated with a historical note** rather than a silent rewrite, so the ~250
  session logs describing the old `session → dev-phase2-run4 → main` flow read as records of what was
  true then, not as instructions to follow.
- **README edit kept additive** so it merges cleanly with the launch instructions already open in
  PR #374.

memory: none — the durable facts here (measured system state, the reliability argument) are captured
in the documents themselves, which is where a future session should read them.

## Verification

- `node --test tools/secret_scan_guard.test.mjs` — 112 pass, 0 fail
- `gitleaks git` with the emitted ignore — target finding suppressed; residue is off-main only
- `node tools/context_sync.mjs --check` — passed
- `AGENTS.md` — 0 dead doc paths; every `docs/*.md` reference resolves on disk
