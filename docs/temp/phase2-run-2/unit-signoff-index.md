---
title: Phase-2 Run 2.0 — Unit Sign-off Index
summary: One row per Run-2.0 unit — what it built, O-items closed, gate status, e2e-verified, and Jayden's sign-off (always `pending` until Jayden reviews; the orchestrator NEVER self-signs). The audit surface for the post-run review / record-only audit. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 — Unit sign-off index

Honesty rule: `e2e-verified` = the seam was ACTUALLY exercised on the local stack by this run (not
merely unit-green). Anything NOT verified is named in the Notes column — never implied as covered.

| Unit | Built | O-items | Gate | e2e-verified | SIGN-OFF | Notes (incl. what was NOT verified) |
|------|-------|---------|------|--------------|----------|--------------------------------------|
| U0 | Run bootstrap: worktree, input docs carried onto branch, tracking docs, final worklist + test strategy from 4-agent assessment | — | context_sync green | n/a (docs-only) | pending | PR #123 |
| U1 | Router OpenAI-only TEST-MODE posture: labelled decorrelation override, 6 nodes → gpt-5/gpt-5-mini on api_worker, caps 1.00 USD/day/node + 60k tok/run, live smoke | PART 3 / D2 | tsc + 56/56 + context_sync green | y (one live api_worker call, US$0.00015125, ledger-recorded) | pending | PR #124. NOT live-verified: the 5 non-phrasing nodes, expectJson against live endpoint, real 429/5xx retries (offline-tested only) |
| U2 | Verifier grounding: EvidencePassage + Citation.evidence (shared/, additive), sentence-level evidence extraction (700-char bound), fixture corpus + JSONL loader, CLI --corpus wiring, evidence+locator in prompt (version bump) | O15 | brain-ingest tsc + 338/338; shared tsc; edge-loader 45/45; context_sync green | y-offline (ACCEPTANCE (i) on real CLI argv seam, fetch-level capture, mutation-checked) | pending | PR #125. **[B8] shared/ touched — 2-reviewer retro-review.** NOT verified: live LLM verify call (deferred to U12 by budget policy); live web retrieval (next cycle per O15); shared/brain has no own tsc (verified via edge-loader consumer) |
| U3 | Contract hardening: O17 servable⇒passing-quote-check superRefine (shared/); O20 derivation copy-gate at synthesis (typed 'copy-gate' rejection) + loader (line-numbered hard-fail) | O17, O20 | shared tsc; edge-loader tsc + 50/50; brain-ingest tsc + 340/340; context_sync green | y-offline (ACCEPTANCE (iii) both cases, git-stash mutation-proven; over-blocking guard passing) | pending | PR #126. **[B8] shared/ touched — 2-reviewer retro-review.** Reviewer note: pre-existing A3 zero-span test retargeted partial→uncertain fixture (intended O17 tightening). NOT verified: live synthesis run, real DB load, synth-seam mutation (type-level impossibility argued instead) |
| U4 | Orientation-aware cards (cardEdge subject-endpoint driver + rendersCard policy + fired-metric render assert); research-context/contradiction gap-only; pairEdges fallback removed; gap_ledger migration (§A1 verbatim) + record_gap_events RPC + handler gap writes | O16, O18, O9-slice(table) | rules 82/82 + tsc; db reset clean; context_sync green | **y-LIVE** (local stack: reproduced bug input → 0 wrong-metric cards + object-only gap row; subject card names fired metric; research-context → composed row + gap row, no card; demand 1→2 on re-invoke; anon RPC denied 42501) | pending | PR #127. NOT verified: Deno typecheck of index.ts (no local deno — CI gate); contradiction + defensive-drop paths live (pure-tested only); needsReview() wiring carried forward |
