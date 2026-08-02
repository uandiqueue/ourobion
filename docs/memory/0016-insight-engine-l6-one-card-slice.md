---
id: "0016"
title: Insight engine L6 one-card slice shipped (interim-verifier caveat)
summary: The insight engine's L6 one-card end-to-end slice is proven on the local stack — one pair (gut_comfort_score × mood_score) driven claim→card with its §S8 source-panel dataset — but the A10 verifier verdict is an interim, key-blocked-honest `uncertain` (real deterministic halves, no real decorrelated verdict), so the edge is held and the card is the honest `personal`/`idiosyncratic` variant, not `agree`.
type: memory
status: accepted
decided: 2026-07-16
updated: 2026-07-16
---

# 0016 — Insight engine L6 one-card slice shipped (interim-verifier caveat)

**Durable fact (2026-07-16, Phase-2 run session U13).** The insight engine's **L6 one-card
end-to-end slice** (architecture §9) is proven end-to-end on the local stack. One metric pair,
`gut_comfort_score × mood_score`, was driven through the whole pipeline — agentic seeder (real
local-agent run) → A8 synthesis (the real U10 claim `gut_comfort_score|correlates|mood_score`) →
A10 verification → A11 edge load → S2/S3 baselines → S4/S5 signals → S7 composer → S8 card — into
one user-facing card carrying its §S8 source-panel dataset (verbatim quotes + char offsets +
derivation + population + U1 `'unknown'` applicability). Reproduce via
[`../shared/insight-slice-demo-runbook.md`](../development/insight-slice-demo-runbook.md).

**The load-bearing caveat.** The decorrelated A10 verifier **cannot run for real** — it needs a
non-Anthropic key (run decision D4; blocked register B5) and must not use the Anthropic-family
local-agent route (decorrelation, memory 0012/0013). The slice therefore ships an **interim,
key-blocked-honest verification**: its deterministic halves run for real (A9 quoteCheck over R2 text;
verifier-owned corpus BM25-lite retrieval), but the verdict is what the contract **forces** for the
evidence actually gathered. `EdgeVerification` only permits `supported`/`partial` when
`corroboration.supporting ≥ 1`, and corroboration is re-derived only from LLM-assigned stances over
retrieved sources; deterministic retrieval yields `stance:'mentions'` only, so no supporting stance
can be honestly assigned → the schema forces **`uncertain`**. `verifierModel` is stamped
`INTERIM:pending-real-verifier (decorrelation-blocked, register B5)` and the record lives only in the
gitignored artifact dir, never committed as truth.

**Consequence — honest branch, not demo shine.** `uncertain` → `edge_score 0` → `serving_band hold`
→ not servable. With no servable edge on the pair, the composer classifies **`idiosyncratic`** and
emits the uncited **`personal`** "still-researching" card, NOT `agree`. When the B5 key lands, the
verifier is a one-command re-run: a `supported`/`partial` verdict flips the band to `mid`/`high`,
the edge becomes servable, and the branch upgrades to `research-context` (this pair is a symmetric
`correlates`, so it tops out at `research-context` by the §1.3 monotonic-only direction rule; a
monotonic edge would reach `agree`).

**Status of the build.** L0–L6 are shipped (run sessions U1–U13). Remaining: L7 (S9 report +
surfaced_cards; A1/A3/A12), L8 (the full gap-loop), the A4–A7 structure/tiering/mention/gate stages,
the U1 real applicability grader, hyperparameter calibration, and the B5 verifier key.
