---
id: "0001"
title: Two-tier truth, including mixed records
summary: Preserve authored inputs and user choices; rebuild analytical outputs. Insight cards are mixed records whose generated content is projection but whose user-controlled lifecycle state is truth.
type: memory
status: unverified
decided: 2026-06-08
updated: 2026-08-02
---

# Two-tier truth, including mixed records

Ourobion distinguishes authored or non-reconstructable truth from rebuildable projections.

- **Truth:** migrations, shared contracts, source rule blueprints, raw observations and their
  provenance, explicit human curation verdicts, and user choices such as whether an insight is active,
  snoozed, dismissed, or archived.
- **Derived projection:** baselines, personal signals, generated insight content and provenance,
  recomputable engagement fields, model-synthesised relationship claims and machine verification
  output, loaded rule rows, D1 search indexes, and generated semantic graphs.

`insight_cards` is deliberately a **mixed record**. Its analytical payload is generated, but its
user-controlled lifecycle state is not disposable. Any regeneration path must preserve that state.

Correct a projection by changing its source data or generating logic and rerunning the owning
pipeline. Never patch analytical output as the lasting fix. Equally, never erase or reset user-held
state merely because the surrounding generated payload is rebuilt. Concrete table ownership and
regeneration paths live in the applicable migration and implemented architecture.
