---
title: Model-training code build — unit index
summary: One row per build unit (MT0-MT5) in the custom-model training-code build, with code-build status and a training-status column that always reads "not run" — no real training happens in this workstream.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Model-training code build — unit index

Per PART 6 of
`../run3/model-training-code-build-orchestrator-prompt.md` (`docs/archive/runs/run3/model-training-code-build-orchestrator-prompt.md`, archived),
this workstream finishes when MT0-MT5 each have an honestly evaluated PR into `dev-phase2-run3` and
this index says "code ready; training not run" for all six. It does not say that yet.

| Unit | Model(s) | Code-build status | PR | Training status |
|---|---|---|---|---|
| MT0 | Repository policy + shared training substrate | Code/tests/docs complete; adversarially evaluated 2026-07-27 and the confirmed defects remediated (central fail-closed gate, data manifests, release value scanning) — offline-verified 152/152 `unittest`; lint/type-check still never run anywhere; PR not yet opened | none yet | not run |
| MT1 | `leafcutter-sentence-role-v0` | Not started — placeholder package only (`models/leafcutter_sentence_role/__init__.py`) | none | not run |
| MT2 | `giraffe-study-design-v0` | Not started — placeholder package only (`models/giraffe_study_design/__init__.py`) | none | not run |
| MT3 | `zebra-nli-shadow-v0` | Not started — placeholder package only (`models/zebra_nli_shadow/__init__.py`) | none | not run |
| MT4 | `salmon-relation-direction-v0` | Not started — placeholder package only (`models/salmon_relation_direction/__init__.py`); direction head additionally gated on the BioREDirect licence (`human-gates.md`) | none | not run |
| MT5 | `viceroy-claim-kind-v0` | Not started — placeholder package only (`models/viceroy_claim_kind/__init__.py`); additionally gated on the Yu/Li/Wang GPL-3.0 determination (`human-gates.md`) | none | not run |

**Overall workstream status:** code ready for MT0 only; MT1-MT5 not started; **training not run** for
every model, and no model may claim otherwise until a separate, explicitly human-authorized execution
run happens against this code (see `human-gates.md`). MT1-MT5 must not be branched before MT0's PR
merges into `dev-phase2-run3` (orchestrator prompt PART 3: "The infrastructure PR must be merged...
before the five model PRs are cut").
