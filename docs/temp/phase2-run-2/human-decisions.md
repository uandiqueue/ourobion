---
title: Phase-2 Run 2.0 — Human Decisions (needs Jayden)
summary: Open product/architecture decisions and blocked-on-human items for Run 2.0. Nothing here is resolved autonomously — recorded, skipped, and the run keeps building what is unblocked. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 — Human decisions & blocked-on-human register

Format: id · what stopped / what is decided · what is needed · what it gates.

## Pre-seeded (from the launch prompt)

- **H0 · O18 research-context = DECIDED (a) gap-only** (Jayden 2026-07-24). Store composed row + gap
  event; NO user card for research-context/contradiction; correlates/modulates never decorate a card.
  No architecture amendment needed — code moves to match the architecture. Nothing gated; recorded so
  no session re-opens it.
- **H1 · OpenAI-only / decorrelation-off posture** — AWAITS retro-review sign-off (see
  decisions-signoff.md D2). Gates nothing this cycle (it IS the cycle's posture); real decorrelated
  verifier + attested model + ablation artifacts are a later cycle (B5/O7).
- **H2 · Baseline-confidence 3/7/14 vs 3/5/14 truth drift** (verdict debt note) — any change is
  config-behind + amendment-intent only; the VALUE choice awaits retro-review. Gates nothing (runtime
  already uses 3/7/14).

## Blocked-on-human (live)

_(none yet)_
