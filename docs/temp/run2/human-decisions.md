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
  **Update 2026-07-24 (Jayden):** ANTHROPIC_API_KEY loaded, ≤ 2 SGD — the verifier CAN be
  decorrelated this cycle at the orchestrator's judgment (D2 AMENDED). Attestation/ablation still
  later cycle.
- **H2 · Baseline-confidence 3/7/14 vs 3/5/14 truth drift** (verdict debt note) — any change is
  config-behind + amendment-intent only; the VALUE choice awaits retro-review. Gates nothing (runtime
  already uses 3/7/14).

## Blocked-on-human (live)

- **H3 · evaluate-signals has no cron schedule** (found in assessment 2026-07-24): the shipped
  pipeline never populates `personal_signals` on the nightly schedule — only compute-baselines
  (18:00) and generate-insights (18:30) are scheduled. The demo is unaffected (the U5 on-demand
  trigger runs all three), but production needs a decision: add a `evaluate-signals` cron between
  the two (plus its missing `config.toml` entry)? What cadence? Gates: nightly-schedule correctness
  only; nothing in this run.
  **Update 2026-07-25 (Jayden asked; orchestrator answered):** clarified that the raw-data
  dashboard/trends are LIVE (metric_daily_values reads raw tables directly) — only insight cards
  are batch. Orchestrator recommends adding the missing cron at 18:15 nightly (deterministic, no
  LLM cost). AWAITING Jayden's confirmation before building.

## Resolved by Jayden (2026-07-25)

- **H1 → RESOLVED as a directive:** the Anthropic key was loaded to SIMULATE A FULL RUN with a
  different-model verifier (not merely the single U12 leg). Executed as follow-up unit U13
  (decorrelated full-loop simulation). Posture labels unchanged: "decorrelated but not
  attested/ablated" — attestation/ablation still next cycle (B5/O7).
- **H2 → DECIDED:** science-based config follows the evidence-review outputs
  (docs/temp/phase2-research-fixes* + docs/temp/phase2-research*). For the baseline-confidence
  drift: RU5 keeps 7 → canonical = **3/7/14** (runtime already correct); doc reconciliation
  (architecture §11 + superseding note for the stale migration comment) folded into U13 under
  O1's discipline.
