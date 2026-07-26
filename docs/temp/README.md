---
title: Temp — in-building and promotable docs
summary: TEMP is the staging area for active drafts, the current product-build run, independent experimental workstreams, and dated briefs; closed run records move to archive after their actionable debt is reconciled forward.
type: process
scope: repo
status: canonical
updated: 2026-07-26
---

# Temp — in-building and promotable docs

`docs/temp/` is the staging area for work that is still being designed, reviewed, or executed. It is
not the constant-layer source of truth. Durable outcomes must eventually be promoted into
`docs/shared/`, `docs/nao/`, `docs/biotope/`, memory, or an accepted decision.

## Active folders

| Folder | Purpose | State |
|---|---|---|
| [`run3/`](./run3/README.md) | Phase-2 Run 3.0: six product-only remediation and UI units, O24–O29 | planning locked; build not started |
| [`model-training/`](./model-training/README.md) | Independent model experiments, beginning with `zebra-nli-shadow-v0` | planned; no training or GMI provisioning performed |
| `briefs/` | Plain-language stakeholder briefs named `YYYY-MM-DD-slug.md` | draft/promotable |

Model training is not a numbered product run. A product run may consume a compatible frozen evaluation
artifact, but it does not own the model-training lifecycle, compute budget, repository, or completion
gate.

## Closed-run rule

Run 1 and Run 2 are frozen historical records under `docs/archive/runs/`. Active product debt from both
is repeated self-sufficiently in
[`run3/pending-build-register.md`](./run3/pending-build-register.md); archived records are provenance,
never execution sources. Closing a future run follows the same sequence:

1. reconcile every still-actionable item into an active register or canonical doc;
2. remove active links into the closing run;
3. move the whole run folder to `docs/archive/runs/` and add archive banners;
4. verify active docs contain no links into archive.

## Lifecycle

1. **Draft** in `docs/temp/` (or `docs/temp/briefs/` for a dated brief).
2. **Promote** durable content into its canonical home under `docs/shared`, `docs/nao`, or
   `docs/biotope`, with proper front-matter and a single owner.
3. **Archive** the original after its active content is reconciled forward.

A temp doc should end as either a promoted design/decision or a frozen historical record. It should
not silently become permanent architecture truth.
