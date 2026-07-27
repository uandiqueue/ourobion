---
title: Fold Z1-Z5 into the Zebra plan; reframe Run 4 as a product build run
summary: Applied the accepted review corrections to the Zebra plan, chiefly the label-blind evidence pipeline that decides whether the experiment means anything. Then reframed Run 4 with model training removed, Run 3's unbuilt units absorbed, and eight candidate units against Jayden's six priorities.
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Fold Z1–Z5 into the Zebra plan; reframe Run 4 as a product build run

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/mt3-zebra` in `C:\project\ourobion-mt3`
Task claim: `mt3-zebra-training` / `claude` / `agentjwork`

Two pieces of work: finish S2 of the Zebra build (the plan corrections), then reframe Run 4 to
Jayden's new brief. **No implementation code, no training data fetched, no compute run.**

## Attempted

- Applied the four accepted Zebra corrections from the codex review.
- Reframed `docs/temp/run4/` around six stated priorities, with model training removed entirely.
- Checked the metric-expansion section of the register to size priority 4 honestly, which surfaced a
  structural dependency the brief did not mention.

## Changed — Zebra plan (S2)

- **Z1 — one label-blind evidence pipeline.** Rewrote §6 into §6.1. The primary pipeline is now
  identical for every class: the same deterministic retrieval function, sentence count, context window
  and tie-breaking, applied without reference to the label. Gold rationales survive only as a named
  `oracle-evidence` secondary analysis, and the gap between the two is itself reported as a finding
  (it estimates how much of the task is retrieval rather than entailment). A preflight assertion must
  fail if the evidence code branches on the label. Eligibility rests solely on the label-blind result.
- **Z2 — §7.1 added.** Train↔official-dev separation asserted on the same four keys used across folds,
  plus fold × class and fold × component count tables, and a preflight failure when any fold falls
  below the preregistered per-class minimum. With ~1,259 rows across three classes, viable per-class
  support cannot be assumed.
- **Z3 — the third class is now `insufficient_evidence`**, propagated through the plan. It is
  model-native and fills no contract state: the contract separates `unsupported` (absence of evidence)
  from `uncertain` (failure to ground), and SciFact `NEI` is cleanly neither.
- **Z5 — dropped the obsolete separate-repository identity.** The release manifest now binds the
  Ourobion commit plus `model-training/` package/config/lock hashes; the release prefix and the
  exact-SHA clause were updated too.

Z4 (audit-gate rework) is deliberately not applied: it gates *promotion*, not training.

## Changed — Run 4 reframe

- **Model training removed.** `docs/temp/run4/zebra-training/` moved to
  `docs/temp/model-training/zebra-training/`. Run 4 may consume a frozen artifact from that workstream
  but never waits on it.
- **Added `pending-build-register.md`.** Jayden referenced this path; it did not exist — the register
  content was buried inside `next-build-optimizations.md` §3, so "section C" did not resolve. Split out
  with sections A–J mirroring the Run-3 register, original IDs preserved.
- **Rewrote `next-build-optimizations.md`** as the scope authority: eight candidate units U0–U8 mapped
  to the six priorities, five preconditions, out-of-scope list, sequencing and a sizing warning.
- **Rewrote `README.md`** as the cockpit.

## Decided

- **Run 4 absorbs Run 3.** O24–O29 were never built, so rather than run two tranches against one
  branch, they fold in as U1/U2/U4/U5 and Run 3 is marked superseded when Run 4 locks.
- **U0 absorbs O25.** The dev/user auth split and the nao RBAC boundary are the same surface; keeping
  them apart would mean building the same RLS twice.
- **U3 proves pipeline completeness only, not decorrelation.** `testMode` is ON with all six nodes on
  OpenAI because only one key is provisioned, so a single-provider stand-in run cannot also satisfy
  `B-BR1`/`B-BR2`. Recorded as precondition P6 rather than silently conflated.
- **U6 must split into U6a/U6b/U6c.** Priority 4 is not a metric-authoring unit — EASY metrics need
  `register A5` (generalise `daily_log`) and MEDIUM metrics need `register A4` (extend
  `metric_daily_values`). Both are structural schema work owned by `B-PL6`/O5.
- **New precondition P7:** give model-training its own integration base. Five model PRs still point at
  the product branch and would repeat the Run-3 cap-and-conflict collision.

## Observations worth keeping

- **The device and live nao change the register's shape.** `B-UI2`, `B-UI5`, `B-UI6`, `B-UI11`, the
  O28 TalkBack traversal and `B10` all move from blocked to doable. That is the largest single change
  entering Run 4 and it is why U5 and U7 are now viable at all.
- **Run 4 is bigger than Run 3, whose scope was already 1.7–2.1× over its file cap.** Eight units,
  three substantially greenfield, plus a UX revamp — plausibly 150–250 changed files. Recorded as an
  explicit sizing warning with a recommended must-have order rather than a cap that will be blown.
- **A stand-in is an LLM call, not a custom model.** It reduces no tokens and proves no model works.
  Every stand-in output must carry an `INTERIM:` marker.

## Left

- Run 4 is candidate scope; nothing is locked or sequenced for execution.
- Preconditions P1, P2, P4, P6, P7 are all Jayden's or the orchestrator's; P1 and P2 block over half
  the run.
- Zebra remains at S2-complete; S3 (licence approval artifact) onward is untouched.
- `decisions/0003-paper-reliability.md` still has an `accepted`/"Proposed" contradiction that U4 must
  resolve by superseding, since it renders user-facing copy off those semantics.

## Blockers

- No training data fetched, no compute run, no implementation code written.
- MT1–MT5 remain placeholder packages.

memory: none
