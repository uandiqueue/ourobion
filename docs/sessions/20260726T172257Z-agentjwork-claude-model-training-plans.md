---
title: Training plans for the remaining custom support models
summary: Researched and authored four separate GMI training plans (study-design, relation/direction, claim-kind, sentence-role) plus a roster recording nine researched-and-rejected candidates; found and recorded three incorrect dataset assumptions in the existing support-model design doc.
type: session
scope: model-training
status: canonical
updated: 2026-07-26
---

# Training plans for the remaining custom support models

Issue: [#140](https://github.com/uandiqueue/ourobion/issues/140)
Branch/worktree: `docs/model-training-plans-140` in `C:\project\ourobion-mt-140`
Task claim: `model-training-plans-remaining-support-models` / `claude` / `agentjwork`

## Attempted

- Followed the new-session convention: context briefing, latest sessions, issue, task claim, isolated
  worktree cut from `dev-phase2-run2`.
- Read the existing NLI plan (`docs/temp/run3/custom-model-training-plan.md`) as the structural
  template. **It was not modified**, per instruction.
- Delegated four bounded research tasks in parallel: a read-only repo inventory of every implied
  model and the exact contract fields each would populate, and three external-research tasks covering
  study-design data, relation/direction data, and "which additional models are worth training at all".
  The fourth was explicitly instructed that a negative verdict with evidence beats a padded list.
- Verified the subagent's contract citations directly against `shared/brain/relationships.ts` rather
  than trusting reported line numbers. All checked out; the `no_effect` comment
  ("studied and found null") confirmed the category-error argument the plans rest on.
- Checked `tools/context_sync.mjs` to confirm `docs/temp` is not in `GROUND_TRUTH_RELDIRS`, so these
  plans need no `docs/INDEX.md` entry and the dangling-link check does not apply to them.

## Changed

- Added `docs/temp/model-training/zebra-study-design-v0-training-plan.md` — model (b1) → `evidenceTier`
  at A5. Rebuilt label construction (PT for tiers 4–5, MeSH headings + check tags for 1–3), MEDLINE
  baseline FTP as the source, StudyTypeTeller (CC-BY) as the independent gold set.
- Added `docs/temp/model-training/zebra-relation-direction-v0-training-plan.md` — model (c) part one →
  `directionCheck` at A10. Two heads over one encoder, mandatory `symmetric` direction class,
  BioREDirect as the gating dependency.
- Added `docs/temp/model-training/zebra-claim-kind-v0-training-plan.md` — model (c) part two →
  `claimKindCheck`. Split out deliberately on input-granularity and GPL-3.0 licence-isolation grounds.
- Added `docs/temp/model-training/zebra-sentence-role-v0-training-plan.md` — the A4 tagger from the
  insight-engine deferred-models table, not from the memory-0013 roster.
- Added `docs/temp/model-training/model-roster.md` — the decision register: four planned models, one
  shipped lookup, one previously rejected model, nine researched-and-rejected candidates with evidence,
  a licence red-flag table, and the standing non-serving/offline/Python-free boundaries.
- Added `docs/memory/0017-support-model-dataset-corrections.md`.

## Decided

- **Four models, not two.** Beyond (b1) and (c), the A4 sentence-role tagger earns a plan; (b2) does not
  (shipped deterministically); and nine further candidates were rejected with evidence.
- **Model (c) splits into two models.** Claim-kind has different input granularity (conclusion sentence,
  no entity markers) and GPL-3.0 data, which must not entangle otherwise-clean relation/direction
  weights. Any one of those reasons would suffice.
- **Three assumptions in `brain-support-models-design.md` are wrong** and are not inherited: BioRED
  direction, PublicationType tiers 1–3, Cochrane Crowd reusability. Recorded as memory 0017; the source
  doc is left for its own change rather than edited from here.
- **LLM-label distillation is permitted for the sentence-role tagger and forbidden everywhere else.**
  Replacing a judgement on cost grounds is ordinary distillation; training a checker on the labels it
  checks is circular. The plans state which one they are doing.
- **`no_effect` and `confounds` get no coverage.** Every corpus's `no_relation` means *not annotated*,
  not *studied and found null*. Mapping `Drug_Interaction`→`confounds` is a category error and is
  dropped from the old recipe. One licensed lead was found for `no_effect` (Yu et al.'s `no relationship`
  class) and is trained/measured but explicitly not authorized to populate the field.
- **Compute is not the constraint anywhere.** All four models together are ≤14 GPU-hours / ≤USD 55, and
  the sentence-role tagger likely needs no GPU at all. Licences and human annotation are the real cost.
- Plans were written into `docs/temp/model-training/` to converge with #139, which is concurrently
  creating that folder and moving the NLI plan into it.

## Left

- Links point at `docs/temp/run3/custom-model-training-plan.md` so they resolve today; they need
  repointing to the sibling `zebra-nli-shadow-v0-training-plan.md` once #139 lands.
- #139's `docs/temp/model-training/README.md` workstream table needs four rows added (one per new plan).
  Not done here to avoid a merge conflict on a file that exists only on that branch.
- `docs/nao/brain-support-models-design.md` needs the three corrections applied under its own change.
- The `role='hedge'` vs `assertion='hedged'` contract overlap needs a `shared/` decision (two reviewers).
- The A8-vs-A10 seam discrepancy for the relation/direction extractor needs picking before promotion.
- All human gates remain: GMI-H1–H8, a re-approved licence manifest per model, the BioREDirect licence,
  the GPL-3.0 determination, and independent audit-set reviewers.

## Blockers

- **BioREDirect's data licence is unverified** and it is the only source of direction supervision — it
  gates the relation/direction model.
- **The GPL-3.0 question on Yu et al.'s corpus** gates the claim-kind model.
- No GPU was provisioned, no dataset downloaded, no paid call made. Planning only.

memory: added 0017
