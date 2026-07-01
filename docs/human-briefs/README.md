# docs/human-briefs

Plain-language briefs on significant plans and decisions, written for **human stakeholders** (product,
non-engineers, reviewers) — not for agents. Each brief is a one-page "what & why" companion to a more
detailed technical doc (a plan in `docs/`, an architecture note, etc.), so a person can understand the
direction without reading the engineering detail.

- One file per brief: `YYYY-MM-DD-<slug>.md`.
- Lead with the problem and the outcome; keep it to ~one page; link to the technical doc it summarizes.
- Briefs are a snapshot at their date — the linked technical doc + code are the living source of truth.

> Briefs are dated snapshots; the live plan is [`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) and the engine
> contract is [`../INSIGHTS-ENGINE-DESIGN.md`](../INSIGHTS-ENGINE-DESIGN.md).

| Brief | Summarizes |
|---|---|
| [2026-06-09-next-phase-direction.md](2026-06-09-next-phase-direction.md) | the insights-engine direction → now [`../INSIGHTS-ENGINE-DESIGN.md`](../INSIGHTS-ENGINE-DESIGN.md) |
| [2026-06-11-phase2-goals-and-features.md](2026-06-11-phase2-goals-and-features.md) | the Phase 2 goals/features → now folded into [`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) |
| [2026-06-11-phase2-integrated-plan.md](2026-06-11-phase2-integrated-plan.md) | [`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) — the Phase 2 plan: two tracks, stress-test gate |
| [2026-06-30-nao-architecture-research.md](2026-06-30-nao-architecture-research.md) | nao web-app architecture research & options → [`../nao/NAO-DESIGN.md`](../nao/NAO-DESIGN.md) |
| [2026-07-01-brain-pipeline-and-training-eval.md](2026-07-01-brain-pipeline-and-training-eval.md) | **DECISION (anchor)** — brain pipeline (agents + 4 support models) + training data. Design docs reconciled to it; durable record [`../memory/0013-brain-pipeline-and-support-models-decision.md`](../memory/0013-brain-pipeline-and-support-models-decision.md). |
