---
title: Repository guide for reviewers and judges
summary: The human-facing map of Ourobion — a short review route, the purpose of each top-level directory, and pointers to the authoritative product, system, architecture, evidence, and attribution documents.
type: guide
scope: repo
status: accepted
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T10:04:23Z
---

# Repository guide

This is the human navigation guide for Ourobion. Reviewers, judges, contributors, and other readers
can use it to find the product, the evidence behind it, and the implementation without reading the
agent operating manual. `AGENTS.md` is instructions for AI coding agents, not a prerequisite for
understanding or evaluating the project.

## Fast review route

If time is limited, read these in order:

1. [`project-overview.md`](project-overview.md) — what Ourobion is, why it exists, and why it has two
   products.
2. [`hackathon/the_launchpad_challenge/submission/`](hackathon/the_launchpad_challenge/submission/)
   — the Launchpad submission:
   [`writeup.txt`](hackathon/the_launchpad_challenge/submission/writeup.txt) is the 1,000-word
   judge-facing write-up,
   [`appendix.md`](hackathon/the_launchpad_challenge/submission/appendix.md) carries the evidence
   behind each of its claims plus the boundary between prior work and challenge work, and
   [`references.md`](hackathon/the_launchpad_challenge/submission/references.md) lists the external
   works cited.
3. [`implemented/system-truth.md`](implemented/system-truth.md) — measured implementation status,
   test counts, schema, corpus, pipeline output, and explicit gaps.
4. [`../apps/biotope/README.md`](../apps/biotope/README.md) and
   [`../apps/nao/README.md`](../apps/nao/README.md) — how to configure, run, and verify each product
   from source. These are build instructions today; a walkthrough of the screens and features, with
   screenshots, is planned for these files and has not landed yet. To *see* the products without
   building them, sign in to the hosted demo with the shared test account in the root
   [`README.md`](../README.md) — one credential, view-only in both.
5. [`../ATTRIBUTION.md`](../ATTRIBUTION.md) — services, models, datasets, software, assets, licences,
   and human sign-off.

For a deeper technical review, continue with
[`implemented/shared/insight-engine-architecture.md`](implemented/shared/insight-engine-architecture.md), the
end-to-end architecture, and
[`hackathon/the_launchpad_challenge/plan/system-connection-map.md`](hackathon/the_launchpad_challenge/plan/system-connection-map.md),
which maps the challenge components into the demonstrated system.

## Repository map

| Path | What is there | Start here |
|---|---|---|
| [`apps/biotope/`](../apps/biotope/) | Flutter mobile app for daily logging, trends, insights, sources, and settings | [`apps/biotope/README.md`](../apps/biotope/README.md) |
| [`apps/nao/`](../apps/nao/) | Next.js/Cloudflare operator dashboard for inspecting the scientific brain | [`apps/nao/README.md`](../apps/nao/README.md) |
| [`supabase/`](../supabase/) | Postgres migrations, row-level security, tests, and TypeScript Edge Functions | [`supabase/migrations/`](../supabase/migrations/) |
| [`shared/`](../shared/) | Cross-language Dart/TypeScript contracts, metric definitions, rules, brain types, and copy safeguards | [`shared/SHARED-CONTEXT.md`](../shared/SHARED-CONTEXT.md) |
| [`tools/`](../tools/) | Paper ingestion, LLM routing, edge/rule loading, metrics, validation, and repository tooling | [`implemented/nao/brain-ingestion-design.md`](implemented/nao/brain-ingestion-design.md) |
| [`model-training/`](../model-training/) | Isolated Python workspace for reproducible research-model training, evaluation, export, and release checks. Trained checkpoints themselves are never committed — the weights for Zebra and Viceroy live outside the repository, and only manifests, hashes, and evaluation artifacts are tracked | [`model-training/README.md`](../model-training/README.md) · [model roster](development/model-training/model-roster.md) |
| [`data/`](../data/) | Versioned or local pipeline inputs and evidence artifacts, including the paper corpus, rules, and router ledger | [`implemented/system-truth.md`](implemented/system-truth.md) |
| [`docs/`](.) | Product truth, architecture, plans, measured state, decisions, session history, and hackathon material | [`INDEX.md`](INDEX.md) |
| [`assets/`](../assets/) | Team-owned brand kits and the reviewed UI asset-generation record | [`../assets/ourobion-brand/DESIGN.md`](../assets/ourobion-brand/DESIGN.md) |
| [`scripts/`](../scripts/) | Project setup, local demo seeding, graph refresh, and validation helpers | [`development/dev-workflow.md`](development/dev-workflow.md) |
| [`ci/`](../ci/) and [`.github/`](../.github/) | CI support files, GitHub workflows, issue templates, and PR policy | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

## How the pieces connect

```text
scientific literature
        │
        ▼
tools/brain-ingest + LLM router ──► verified evidence edges
                                             │
daily observations + wearable/environment ───┼─► Supabase insight engine
                                             │              │
                                      nao inspects          ▼
                                                     biotope presents
```

The two user-visible applications do not import each other's code. They meet through Supabase data
and the contracts in `shared/`. The authoritative explanation of that boundary is
[`implemented/shared/biotope-nao-link.md`](implemented/shared/biotope-nao-link.md).

## Which documents to trust

- [`implemented/`](implemented/) describes the current product and architecture.
- [`implemented/system-truth.md`](implemented/system-truth.md) is the measured snapshot when a claim
  depends on counts or shipped state.
- [`development/`](development/) contains plans, workflows, design decisions, and in-progress work.
- [`memory/`](memory/) records durable facts and known constraints — including the ones that bound
  what could be built, such as
  [training compute being local](memory/0024-training-compute-is-local.md).
- [`sessions/`](sessions/) is the chronological engineering record; it is useful for provenance, not
  as the first introduction to the project.
- [`archive/`](archive/) is frozen or superseded history. Do not use it as the description of the
  current system.
- [`INDEX.md`](INDEX.md) lists every active document and its purpose.

Raw logged data, database migrations, and shared contracts are source material. Baselines, insight
cards, engagement state, and synthesised brain edges are rebuildable projections. This distinction
is why generated outputs may be demonstrated and measured while their generating contracts and
pipelines remain the reviewable implementation.

## Running and verification

- Mobile app: follow [`apps/biotope/README.md`](../apps/biotope/README.md), then run
  `flutter analyze` and `flutter test` from `apps/biotope/`.
- Web dashboard: follow [`apps/nao/README.md`](../apps/nao/README.md) for local and Cloudflare paths.
- Local backend: use the Supabase commands in the root [`README.md`](../README.md).
- Repository documentation and contract checks: run `npm run context:check` from the repository root.

For engineering process rather than product evaluation, see
[`engineering-practice.md`](engineering-practice.md) and
[`development/dev-workflow.md`](development/dev-workflow.md).
