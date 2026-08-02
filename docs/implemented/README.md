---
title: Implemented state — current repository view
summary: Code-backed orientation to what Ourobion currently implements across Biotope, Nao, Supabase, the brain pipeline, and research models, with explicit boundaries around planned and live-state claims.
type: index
scope: implemented
status: unverified
updated: 2026-08-02
---

# Implemented state

This directory is meant to describe what Ourobion **currently implements**. This page is the working
entry point while the older design documents are reconciled with the code.

The evidence boundary matters:

- **Implemented** below means executable code, migrations, contracts, workflows, or reproducible
  research artifacts exist in this repository.
- It does **not** prove that every migration, function, workflow, provider, or application is currently
  deployed and reachable. Hosted state is mutable and must be checked live before it is claimed.
- Future architecture belongs in [`docs/development/`](../development/). A design is not implemented
  merely because its schema or flow is described in Markdown.

When this page conflicts with prose elsewhere in `docs/implemented/`, check the referenced code. The
code, migrations, shared contracts, configuration, and executed tests are the stronger evidence.

## What the system is

Ourobion is a non-diagnostic One Health system with two product surfaces:

- **Biotope** is the Flutter personal-health application. It records user observations, optionally
  reads a bounded set of wearable signals, computes deterministic baselines and personal patterns,
  and displays generated insight cards.
- **Nao** is the Next.js operator and evidence-inspection application. It exposes corpus, claim,
  verification, gap, model, seed, and pipeline-control surfaces without receiving authority over
  another user's personal health rows.

They do not call each other. They meet through shared contracts and backend projections.

```text
papers -> ingest/synthesis/verification -> R2 artifacts
                                            |
                    +-----------------------+----------------------+
                    |                                              |
             edge loader -> Supabase edges -> insight cards       D1 corpus index
                                      |                                  |
                                  Biotope                               Nao
```

GitHub Actions supplies long-running execution that a request-bounded Cloudflare Worker cannot. It is
an automation bridge, not the normal runtime data path for either application.

## Biotope

The source is [`apps/biotope/`](../../apps/biotope/).

Implemented in the repository:

- email/password authentication, profile setup, consent records, and user-scoped Supabase access;
- self-report logging for gut, hydration, behaviour, and related daily observations;
- best-effort wearable reads for resting heart rate, iOS SDNN HRV, sleep duration, blood oxygen,
  body temperature, and step count;
- registry-driven metric projection and baseline computation;
- deterministic signal evaluation, personal-relation evaluation, rule evaluation, and insight-card
  generation;
- active, dismissed, snoozed, and saved (`archived`) card lifecycle states, including restoring cards
  to `active` without deleting their rule or evidence;
- engagement state computed from logging history; and
- the five-tab Biotope interface and biomech-botanical design system.

Important boundaries:

- Google and Apple OAuth client hooks exist, but provider availability depends on external Supabase
  configuration and is not proven by this repository.
- M4 environmental collection is an inert placeholder; no environmental API or `env_daily` migration
  is implemented.
- M7 community is dormant; there is no community product or aggregation pipeline.
- `InsightFiredEvent` exists as a shared contract type but is not emitted or consumed. M6 currently
  updates from `daily_gut_rows` after a log write.
- No release APK, App Store release, or Play Store release is established here.

## Supabase serve path

The schema authority is [`supabase/migrations/`](../../supabase/migrations/) and the server code is
[`supabase/functions/`](../../supabase/functions/).

The implemented analytical path is:

1. raw user rows and storage primitives are projected into the long-format
   `metric_daily_values` view;
2. `compute-baselines` writes rebuildable baseline snapshots;
3. `evaluate-signals` writes deterministic personal-signal projections;
4. `generate-insights` reads in-force rules, personal signals, and eligible verified edges, then
   writes composed insights and cards; and
5. `run-pipeline` invokes those stages in order for an authorized operator path.

Card copy is currently rendered by deterministic, copy-gated templates. The configured phrasing and
report models are not wired into this serving function.

The edge serving gate asks whether the verifier found the claim faithful to its cited paper and
whether verifier confidence clears the configured band. Quote presence, direction, claim kind, and
effect-size fidelity gate serving. Evidence tier, venue impact, wider-literature corroboration, and
scope remain stored ranking/caveat signals; they do not withhold an otherwise faithful card. The
executable rule is [`shared/brain/index.ts`](../../shared/brain/index.ts).

## Brain pipeline

The ingestion and verification tooling is under
[`tools/brain-ingest/`](../../tools/brain-ingest/), with shared contracts in
[`shared/brain/`](../../shared/brain/) and long-running orchestration in
[`brain-pipeline.yml`](../../.github/workflows/brain-pipeline.yml).

Implemented in the repository:

- multi-source paper discovery, retrieval, extraction, stable paper identity, manifests, and R2
  artifact contracts;
- LLM synthesis of paper-scoped relationship claims;
- deterministic quote checking and adversarial verification with independent retrieval;
- fail-closed vendor-family separation in the LLM router;
- versioned claim and verification artifacts;
- a transactional Node edge loader that uses `SUPABASE_DB_URL` to project artifacts into
  `relationship_claims`, `edge_verifications`, and the derived `verified_edges` view; and
- append-only human rejection overlays used by Nao and the serving view.

The current router configuration assigns GPT-5 to synthesis and Agnes 2.5 Flash to verification. The
router refuses to load when those nodes resolve to the same vendor family. Configuration is not proof
that provider credentials are present or that a particular hosted run completed.

Rule blueprints and brain edges are related but not yet one fully automatic loop. Authored JSON rule
blueprints can be loaded into the `rules` projection and evaluated deterministically. The brain
workflow can produce generated rule-blueprint artifacts, but it does not currently invoke the rules
loader to promote those artifacts into the database. Human revocation that survives rule-projection
rebuilds also needs a complete executable overlay before the loop can be called end to end.

## Nao

Nao lives in [`apps/nao/`](../../apps/nao/) and targets an OpenNext Cloudflare Worker, not Cloudflare
Pages.

Its implemented repository surfaces include:

- Supabase authentication plus viewer, curator, and admin role enforcement;
- D1/FTS-backed paper listing, search, and facets;
- R2-backed paper detail and evidence artifacts;
- claim, gap, seed, model, loader, and brain-pipeline inspection/control routes;
- bounded GitHub Actions dispatch for work that cannot run inside the Worker request lifetime; and
- audited human rejection of claims without granting Nao general access to personal health tables.

R2 is the canonical corpus/artifact store; D1 is a rebuildable Nao search projection. D1 refresh is a
separate workflow, so a visible Nao count does not by itself prove parity with the current R2 manifest.

## Research models

The isolated research workspace is [`model-training/`](../../model-training/). It is not imported by
Biotope, Nao, Supabase functions, shared contracts, or the brain runtime.

The durable programme contains Zebra, Giraffe, Salmon, Viceroy, and Leafcutter. Zebra and Viceroy have
trained research checkpoints with publication-result artifacts; Giraffe, Salmon, and Leafcutter remain
planned research directions. The completed runs used local Apple Silicon. None of the checkpoints is
validated or authorized for product serving, and public weight release remains subject to
model-specific licensing decisions.

## Not currently implemented

The following items appear in older architecture prose but are not current executable product
capabilities:

- environmental ingestion and the M7 community surface;
- cached LLM card phrasing in `generate-insights`;
- weekly `insight_reports` and append-only `surfaced_cards` history;
- `applicability_grades` and `user_attributes` serving stores;
- `coverage_snapshots`;
- automatic loading of generated brain rule blueprints into the `rules` table;
- a regeneration-safe human rule-revocation overlay; and
- product inference by any custom research checkpoint.

## Status of the documents below

The present code audit found material drift in the older files. Until they are rewritten and reviewed:

- treat [`shared/insight-engine-architecture.md`](shared/insight-engine-architecture.md),
  [`shared/biotope-nao-link.md`](shared/biotope-nao-link.md),
  [`nao/brain-synthesis-design.md`](nao/brain-synthesis-design.md),
  [`nao/nao-app-design.md`](nao/nao-app-design.md),
  [`nao/brain-support-models-design.md`](nao/brain-support-models-design.md),
  [`biotope/architecture-context.md`](biotope/architecture-context.md), and
  [`project-context.md`](project-context.md) as mixed current/target descriptions rather than runtime
  proof;
- treat [`biotope/metrics-catalog.md`](biotope/metrics-catalog.md) as a candidate catalogue, not an
  implemented metric inventory; and
- treat [`system-truth.md`](system-truth.md) as a dated measurement snapshot. Mutable database,
  corpus, deployment, and provider claims require a fresh command or live query before reuse.

The next documentation pass should either rewrite each file around current executable behavior or move
its unapplied design into `docs/development/`. Only Jayden can promote this README from `unverified`
after reviewing it.
