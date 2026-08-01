---
name: evidence-review-run
description: "Use when running a record-only evidence review of a run's decisions (config values, ADRs, thresholds) against the scientific literature on this repo — resumable RU-unit worklist, deep-research-per-unit method, cite-don't-change discipline, and deep-research harness failure recovery."
---

# Record-only evidence-review run

Part of the **orchestrate-build-run** skill set (see that skill for the full run loop).

Judge whether a run's *empirical/quantitative* decisions hold up against the published
literature: **evaluate and cite — never change a decision, config value, ADR, or code.**
Proven instance (example from the Phase-2 run): the Phase-2 decisions research
(2026-07-18, units RU1 triage + RU2–RU7 + executive summary) reviewing config C1–C12 /
sign-off D1–D15 against ADRs 0001–0003.
Sibling skill: **record-only-audit** (which audits *code* against the codebase; this skill
audits *decisions* against the literature) — same record-only + resumable-ledger discipline,
different method. Environment: **windows-toolchain-gotchas** (`. .\scripts\biotope-env.ps1`
only if inspecting code).

## 0. Ground rules (non-negotiable)

- **Record only.** The ONLY files written are the three research docs (below). Never edit a
  decision, config value, ADR, or code. Do not commit or push.
- **Cite or admit.** Every non-obvious claim carries a citation. Where no source supports a
  value, write **"engineering judgment, uncited"** — never invent support. Distinguish
  **"supported by literature"** vs **"reasonable convention"** vs **"arbitrary — needs
  calibration"**, and **"plausible"** vs **"empirically calibrated"**.
- **Ground truth is the ADR/code, not the dev-aid docs.** The decision docs (C-/D-entries)
  are dev aids; their scientific ground truth lives in the ADRs + architecture doc. Verify
  the *shipped* value against the ADR and the code before writing any verdict.

## 1. Scaffold (unit RU0)

Create a research dir under `docs/temp/` (index-exempt dev-aid tier) holding exactly three docs:

1. **`research-orchestration-log.md`** — resume protocol, ground rules, worklist
   (`RU# | Unit | Status | Notes`), a `▶ RESUME AT: RU#` pointer, and a session ledger.
2. **`decisions-evidence-review.md`** — the triage table + one appended section per
   researched decision + an **Executive summary (written last)**.
3. **`references.md`** — keyed bibliography (`[key]` Author. *Title*. Venue, Year. URL/DOI —
   one line on what it supports), appended when each source is first cited.

## 2. RU1 — triage (do this before any research)

Classify every decision as **(a) empirical/scientific** (the value or method can be judged
against published literature) or **(b) process/engineering** (workflow, schema, product
judgment — no external literature to test; saying so *is* the finding). Only (a) items get an
RU unit; group tightly-related decisions into one unit (e.g. an anomaly-baseline unit folding
C3 + its D-entries). Write the triage table; then expand the worklist with one RU per unit.

## 3. Resume protocol (what makes a killed session cheap)

1. One unit at a time — never start the next before closing the current.
2. Set the unit `in-progress` in the log **before** starting it.
3. **Append the unit's section to the review doc and its sources to references.md AS YOU GO** —
   a killed session must lose at most the one in-flight unit.
4. Close a unit: status `done` + ledger row + move the `▶ RESUME` pointer — then start the next.
5. `in-progress` found on resume = the prior session died mid-unit → redo that whole unit, dedup.

## 4. Method per unit (what worked across RU2–RU7)

1. **Verify shipped values against the ADR + code FIRST.** Grep the config object / function
   for the literal (e.g. `IMPACT_BANDS_C8`, `ALLOWED_LAG_DAYS`); confirm it matches the C-entry
   and the ADR. Verdicts written against an unverified value are worthless.
2. **One `deep-research` run per unit**, with a tightly-scoped multi-part question that names
   the exact values/thresholds AND the data regime to judge against — for this repo that is
   **n=1 daily self-tracking: small samples, ordinal/non-normal, autocorrelated series**.
   End the prompt with "where a value has no literature support, say so plainly rather than
   inventing it."
3. **Read the FULL result from the task output file**, not the notification (which truncates).
   The top-N synthesized findings are 3-vote adversarially verified; claims that were extracted
   but fell below the verify budget live in the fetch agents' `resultPreview`s / `journal.jsonl`.
   Mine those for any sub-question the synthesis marks "unanswered," and cite them as
   **quote-extracted (not 3-vote verified)**, cross-checked against the ADR's own citations.
4. **Write the section:** restatement + the run's rationale/alternatives; method soundness for
   the n=1 regime (with citations); value defensibility (supported / convention / uncited);
   a **keep / adjust (suggest range) / calibrate-before-trust** verdict; citations mirrored into
   references.md. Note refuted claims explicitly so a future reader doesn't resurrect them.

## 5. Deep-research harness gotchas (the sharp, reusable bit)

- **Empty or failed result → resume before re-running from scratch.** Relaunch with
  `{scriptPath, resumeFromRunId}`; completed agents replay from cache. But **inspect
  `journal.jsonl` first** — a cached result can itself be empty (a run that "finished" with no
  output). If genuinely empty end-to-end, a clean re-run is fine (nothing to recover).
- **Transient `StructuredOutput retry cap exceeded` with 0 agents done = platform/capacity
  issue** (often at a usage-limit-reset boundary), NOT a script or content problem — do not
  edit the question. Back off, note it in the log, and clean re-run later. If it fails
  identically twice, treat it as a real platform problem and stop hammering it.
- **A high refutation count is a good sign,** not a failure — it means verification is working
  (example from the Phase-2 run: RU7 killed 6/25 attractive-but-wrong claims). Exclude
  refuted claims from verdicts.

## 6. RU-final — executive summary (always last)

Rank the researched decisions **well-grounded → weakest / most in need of calibration**. Then
name the **cross-cutting themes** (the *pattern*, citing unit IDs — e.g. "autocorrelation is
load-bearing and under-addressed, surfacing in both RU4 and RU7") and a short **most-urgent,
in-priority-order** list. The recurring shape of findings here: architecture/exclusions tend to
be well-grounded; specific magic-number thresholds tend to be uncited — say which literature
actually backs (few) vs merely tolerates (most). Bump the three docs' `updated:` front-matter.
