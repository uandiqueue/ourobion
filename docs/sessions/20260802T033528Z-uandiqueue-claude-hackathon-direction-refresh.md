---
title: Refresh the hackathon direction doc — prebuild reframed as the demo-serving slice, plus three fabricated dataset claims removed
summary: A subagent updated the stale strategy doc; reviewing its output found it had invented a training-dataset list naming HealthVer and BioRED in three places, and asserted the support models "underperformed the LLM-only baseline" on a comparison that has no ground truth. All corrected against primary sources before commit.
type: session
scope: repo
status: canonical
updated: 2026-08-02
---

# Refreshing hackathon-direction.md

Branch `docs/phase4/stale-updates-328`. Work dispatched to a subagent; the corrections below were
found while reviewing its output.

## The owner's correction (the reason for the pass)

The doc described the biotope app and the deterministic ingestion pipeline flatly as "prebuild ...
prior work ... the backdrop". The owner's point: they *did* exist before the challenge, but both have
changed substantially during it, and calling them inert backdrop both understates real in-period
engineering and gives away work that legitimately counts under a rule that says *judges score the
delta*.

Reframed throughout as the **demo-serving slice** — extended prior work, changed in-period, not the
focus, existing so the brain's output has somewhere to land and can be shown to a person at all. §3.1
retitled from "The backdrop" accordingly. The narration line *"The app finds the pattern; the brain
decides whether the science backs it"* was preserved; it still does useful work.

## Other staleness fixed

- **"The delta is unbuilt today"** — true on 2026-07-26, false now. The internal 16/25 adversarial
  score rested entirely on that premise; it is kept as a dated record with its premise marked
  superseded rather than silently restated or replaced with an invented new score.
- **Support models described as "roadmap, not the delta"** — both are trained, hosted and measured.
- **Corpus figures** — every "1,200-paper" reference replaced with the measured 21,824 discovered /
  911 full text / 894 over 5,000 characters.
- **The TL;DR described the pipeline as using "small trained models + a deterministic quoteCheck" to
  cross-check edges.** The trained models are explicitly *not* in that path, which the same document
  says elsewhere. Corrected — an architecture diagram contradicting its own body is exactly what a
  judge would catch.

## Decided — three fabrications in the subagent's output, caught before commit

The brief supplied every figure and named no training corpora. The agent invented them anyway.

1. **"trained on public datasets (SciFact/HealthVer/BioRED)"**, written in **three** places. Checked
   against primary sources: Zebra is **SciFact only** — its own training plan states *"HealthVer,
   PUBHEALTH, SciNLI ... are excluded"* — and Viceroy used the **Yu, Li & Wang causal-language corpus
   (EMNLP 2019)**. Worse, **BioRED is one of the three assumptions `docs/memory/0017` records as
   disproven.** Publishing it would have re-asserted, in the strategy doc, a claim the team had
   already established was false.
2. **"evaluation showed they underperformed relative to the LLM-only baseline."** Unsupportable: the
   Haiku comparison is **unadjudicated and has no ground truth**, so it measures disagreement and
   cannot rank correctness. Replaced with the measured disagreement rates and an explicit instruction
   not to claim either model beat or lost to the LLM.
3. **Kappa given as a rounded range "~0.21–0.24"** where exact per-model values exist (0.236 Zebra,
   0.205 Viceroy). Minor, but the exact figures were in the brief.

The agent's own report also stated "914 over 5K chars" where the brief said 894; the file itself was
correct, so the error was confined to its summary — which is its own caution about trusting an
agent's account of its work over the diff.

memory: none — a strategy document refresh; the durable dataset facts already live in memory 0017.

## Verification

- `grep` for `SciFact/HealthVer/BioRED` → 0 remaining
- `grep` for `1,200` → 0 remaining
- every figure in the file cross-checked against the measured set
- `node tools/context_sync.mjs --check` — passed
