---
title: Phase-2 Research-Fixes — Sign-off Decisions
summary: Judgment calls made during the remediation run (D-entries). Choice · alternatives rejected (with why) · AMENDED lines appended, never rewritten. Lane-C method changes that flag an ADR amendment record the amendment intent here. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

# Phase-2 Research-Fixes — Sign-off Decisions

Entry format: **Choice · Alternatives rejected (with why) ·** optional dated **AMENDED** lines
(appended — the original stays visible). Anything a human might reasonably have decided differently
gets a D-entry; later units cite D-refs instead of re-arguing. Numeric values go in the config-decisions
doc (C-entries), not here.

## Decisions

### D1 · Run structure — stacked session-PR chain off `dev-phase2`, human-gated merge
**Choice:** Each remediation unit is a session branch cut from the chain tip (first unit off
`dev-phase2`), one commit, one PR stacked on its predecessor, left open for Jayden to merge in order.
This run never merges and never touches `main`.
**Alternatives rejected:** self-merge (merging is human-gated on this repo — not ours to do);
one big branch (loses per-unit reviewability and the lane-classification audit trail).

### D2 · Lane classification governs unit scope
**Choice:** Every verdict is assigned a lane (A verify-first / B safe-fix / C method-change) and the
lane bounds what the unit may do — B never rewrites accepted science; C never ships a guessed constant
and always appends (never overwrites) the accepted ADR rationale.
**Alternatives rejected:** treating every verdict as a fix-now (would silently rewrite accepted ADRs
and §11 values — explicitly forbidden by the run brief); treating every verdict as design-only (would
skip the cheap, unambiguous label/config corrections the review calls out).
