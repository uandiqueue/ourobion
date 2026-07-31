---
title: Hackathon write-up model-truth correction
summary: Corrected two false statements in the submission write-up that denied any model was trained, and disclosed the Viceroy corpus licence position.
type: session
scope: run4
status: canonical
updated: 2026-08-01
---

# Hackathon write-up model-truth correction

Issue: #277 - branch: `docs/hackathon/writeup-model-truth` - base: `dev-phase2-run4` @ `1b32c5c`

## Attempted

- Fix statements in `docs/shared/hackathon/submission/writeup.md` that are now factually false, before the
  document is submitted.
- Change nothing else about the write-up's structure, word budget or claims.

## Changed

- The Honesty & Trajectory section said "No support model was trained; SciFact/HealthVer/BioRED are
  roadmap data only." Two checkpoints were in fact trained. Replaced with the accurate position: Zebra v1
  (SciFact entailment) and Viceroy v0 (causal wording) were trained after that section was drafted, and
  both are frozen, privately stored, `validated=false`, `serving_ready=false`, with zero imports from
  `apps/`, `supabase/`, `shared/` or `tools/brain-ingest` enforced in CI. Zebra's two failed readiness
  gates are stated inline.
- The attribution list said "SciFact, HealthVer, BioRED - named as roadmap training data only; no training
  performed." Split it: SciFact is Zebra v1's training data (research-only, frozen, not serving, weights
  not distributed); HealthVer and BioRED remain roadmap-only. Added the Yu, Li & Wang corpus with its
  unresolved GPL-3.0 propagation question and the blocked public-weight-release status, plus the
  BiomedBERT (MIT) base model.

## Decided

- Every figure was verified against `model-training/evidence/publication-results/zebra-v1-results.md`
  before being written: mean macro-F1 gate >=0.70 against 0.5991, every-class minimum-seed recall gate
  >=0.60 missed on contradicted 0.4348 and supported 0.5796, ECE 0.0491 the only pass.
- The 248-commit delta was NOT changed. It is explicitly frozen as `2214fbb..547280f` with a stated scope
  note that later reconciliation merges sit outside it, so it is honest as written. A report that it was
  stale had measured `2214fbb..HEAD` (483) instead, which is a different quantity.
- The correction only removes a false denial. It adds no capability, accuracy or validation claim, and it
  does not alter the run's local-only posture.

## Left

- Primary review. This touches `docs/shared/**`, so the single-reviewer owner deviation recorded for this
  run applies here too.
- The remaining write-up corrections catalogued in `docs/temp/run4/hack-submission-277.md` section 3.

## Blockers

- None.

## Verification

- Figures cross-checked against the checked-in publication-results evidence, not restated from memory.
- `node tools/context_sync.mjs --check`.
- No provider calls, cloud writes, deployment, promotion, or device operations. `main` and `dev-phase2`
  untouched.

memory: none
