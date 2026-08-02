---
title: Write the judge-facing submission write-up to the five-pillar structure and the 1,000-word cap
summary: Replaced a 292-word draft that was mostly a do-not-submit banner with a 980-word submission body using the event's five mandated pillar headings, every figure re-measured, all repo jargon removed, and the identity and origin story carrying the Problem and Approach pillars.
type: reference
scope: repo
status: canonical
updated: 2026-08-02
---

# Judge-facing write-up

Branch `docs/phase4/stale-updates-328`.

## Constraints the event imposes

From the rules: **maximum 1,000 words**, **the five pillars as section headings**, appendices excluded
from the cap. The pillars are fixed — Problem, Approach, Evidence, Constraints, Honesty & Trajectory —
each scored 1–5. The governing instruction is *"evidence appropriate to the claim … a modest claim,
proven, beats a grand claim, asserted."*

The previous body was **292 words**, most of it a `DO NOT SUBMIT` banner. The new body is **980**.

## Changed

- **Problem** leads with the origin constraint rather than a market description: a real health company
  has a research team, we are two people, so the product has to run one. The three currencies
  (reliability / cost / users) are the owner's own framing and are the sharpest thing available.
  Success criteria are stated as fixed *before* building, which the pillar explicitly asks for.
- **Approach** names what was ruled out — single-model self-review — and gives the empirical reason
  from the earlier project, where one error survived three rounds of same-family fixing. Swiss-cheese
  is cited to Reason (1990) as an existing concept, never as ours.
- **Evidence** reports only re-measured figures and, as the pillar demands, **against baselines**:
  Viceroy 0.8656 against 0.5068 cue-lexicon and 0.1535 majority; its dangerous error 4.52% against
  13.57%. Zebra is reported as **failing** its own pre-registered bar.
- **Constraints** uses caps that are verifiable in configuration, plus the free-tier verifier expiry
  on 2026-08-08 as a named dependency.
- **Honesty & Trajectory** states the two things most likely to be overclaimed: the last mile is not
  connected (the one edge-derived card is archived, so a user opening the app sees none), and the gate
  checks fidelity to the cited paper rather than agreement with the wider literature.
- The mark's open loop opens the document, tying the identity to the thing the product actually does.

## Decided

- **Cost is stated as enforced caps, not as a total.** The recorded figure of US$1.80 could not be
  re-derived: the local ledger holds only the verifier leg (~US$0.009 across three days), and the
  larger synthesis spend is not in it. Rather than publish a number I could not reproduce, the body
  cites the caps I verified by running the config gate and leaves the recorded total in Appendix D
  with its own provenance. This is the "modest claim, proven" rule applied to ourselves.
- **The `DO NOT SUBMIT` banner was removed.** Its two blockers no longer hold as stated: the owner has
  directed that the support models appear in the submission, and the card question is now measured and
  described precisely rather than being an open unknown. The document remains `status: draft` because
  publishing is the owner's call, not mine.
- **Appendices left intact.** They do not count against the cap and carry the evidence the body
  compresses. A body pointer to Appendix B was added because the rules require the write-up to state
  what existed before and what is new — that requirement was previously satisfied only implicitly.
- **No repository jargon.** Checked mechanically: no issue or PR numbers, no unit codes, no file
  paths, no column names anywhere in the body.

memory: none — a submission document, not a durable architectural fact.

## Verification

- body word count 980 against a 1,000 cap, appendices excluded
- all five mandated pillar headings present, in order
- jargon sweep over the body clean
- `node tools/context_sync.mjs --check` — passed
