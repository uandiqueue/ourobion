---
id: "0019"
title: Runtime and storage topology
summary: GitHub is Ourobion's versioned source and automation bridge: Nao dispatches GitHub Actions for long-running jobs whose runners connect Cloudflare R2/D1 and Supabase, while normal app data paths remain direct to their runtime stores.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:21:34Z
---

# Runtime and storage topology

Ourobion has distinct product, research, storage, and automation layers. Their boundaries matter more
than any current deployment count or framework version:

| Layer | Durable responsibility |
|---|---|
| **GitHub repository** | Versioned source, migrations, shared contracts, rule blueprints, workflows, and provenance. Review status is recorded separately. |
| **GitHub Actions** | CI plus the long-running execution bridge that Cloudflare Workers cannot provide. Nao can dispatch bounded workflows; GitHub-hosted runners ingest into R2, project brain artifacts into Supabase, rebuild D1 from R2, and run approved model research/inference tasks. |
| **Biotope** | Flutter/Dart user application for observations and personal insights. |
| **Supabase** | Shared Auth identity pool, Postgres product state and RLS, and Edge Functions for the analytical pipeline. |
| **Nao** | Next.js/TypeScript operator and evidence-inspection surface built for OpenNext on Cloudflare Workers. |
| **Cloudflare R2** | Canonical object store for the private research corpus and brain artifacts under versioned contracts. |
| **Cloudflare D1** | Rebuildable Nao search/facet projection of the R2 corpus, not an independent truth store. |
| **`model-training/`** | Isolated Python research workspace; never a product runtime dependency. |

Cross-layer data must pass through an explicit contract, loader, API, or binding. Biotope does not
read R2 or D1 directly; Nao does not gain access to personal health rows merely because it shares the
Supabase identity pool; model-training outputs do not become serving components automatically.

GitHub is therefore the main **automation and integration control plane** between the repository,
Nao's Cloudflare surface, R2/D1, and Supabase. It is not the universal runtime data plane: Biotope
normally talks to Supabase directly, while the deployed Nao Worker reads its native R2/D1 bindings and
Supabase APIs directly. The execution units are GitHub Actions workflows running on GitHub-hosted
runners—not “GitHub workers.”

Exact runtime versions, resource identifiers, deployment state, workflow inventory, credentials, and
counts belong to executable configuration and timestamped evidence. Architecture pointers:
[`project-context.md`](../implemented/project-context.md),
[`brain-ingestion-design.md`](../implemented/nao/brain-ingestion-design.md), and
[`apps/nao/README.md`](../../apps/nao/README.md).
