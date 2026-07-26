---
title: Semantic graph — generated human view
summary: Deterministic, human-readable community map and directory generated from the machine-local Graphify graph; a lossy projection for orientation, not architecture truth.
type: reference
scope: repo
status: generated
generated_by: tools/graph-view/generate_graph_view.mjs
updated: 2026-07-26
---

# Semantic graph — generated human view

> **GENERATED FILE — do not hand-edit.** Run `npm run graph:view:write` after Graphify updates.
> The machine graph is a rebuildable semantic projection; curated architecture and contracts remain truth.

This is the repository’s single tracked human-readable view of `graphify-out/graph.json`. It compresses
the graph into communities, cross-community connections, bridge nodes, and hyperedges. It is deliberately
lossy: use `graphify query`, `graphify path`, or `graphify explain` for node-level investigation.

## Snapshot

| Measure | Value |
|---|---:|
| Nodes | 5698 |
| Pair links | 7789 |
| Hyperedges | 44 |
| Communities | 607 |
| Source files represented | 749 |
| Dangling pair-link endpoints | 0 |
| Dangling hyperedge members | 0 |

- Graphify revision stamp: `0be89d44c481baf34ab895f71672b47126898752+worktree`
- Exact source-file SHA-256: `9d1473f3a1d3e25bd4fc7e1e39549f33429600e2c9a70c58c146c12a5a29d2cb`
- Semantic-content SHA-256 (revision metadata excluded): `46bfe4d343dacaa1b27da9514ed69f71b697307e8751f5be77993f1888841716`

## Main community topology

The 18 largest communities are shown. Edge labels are aggregated pair-link counts;
an absent line does not mean two areas have no path through smaller communities.

```mermaid
flowchart LR
  C_0["Dev Workflow Commit Conventions<br/>89 nodes"]
  C_1["Daily Logging and Insights<br/>85 nodes"]
  C_2["M2 Self-Report Screens<br/>62 nodes"]
  C_19["Research Source Discovery<br/>62 nodes"]
  C_3["Windows Win32 Runner<br/>59 nodes"]
  C_5["Theme Design Tokens<br/>57 nodes"]
  C_4["App Bootstrap Auth Gate<br/>52 nodes"]
  C_7["Stool Form Screen<br/>52 nodes"]
  C_8["Engagement Home Tab<br/>51 nodes"]
  C_9["Insight Card Model Service<br/>51 nodes"]
  C_80["User Consent and Metrics Models<br/>49 nodes"]
  C_10["Baseline Service Snapshots<br/>46 nodes"]
  C_11["Insights Tab UI<br/>45 nodes"]
  C_13["Daily Gut Row Model<br/>45 nodes"]
  C_14["Brain Ingestion Storage Pipeline<br/>43 nodes"]
  C_15["macOS App Delegate<br/>43 nodes"]
  C_28["Brain Ingestion Storage Pipeline<br/>43 nodes"]
  C_6["Claim Synthesis Pipeline<br/>42 nodes"]
  C_14 ---|"20"| C_28
  C_8 ---|"13"| C_28
  C_4 ---|"12"| C_28
  C_19 ---|"12"| C_28
  C_1 ---|"9"| C_2
  C_2 ---|"6"| C_5
  C_4 ---|"5"| C_6
  C_7 ---|"5"| C_19
  C_8 ---|"5"| C_19
  C_7 ---|"4"| C_8
  C_7 ---|"4"| C_28
  C_4 ---|"3"| C_19
  C_14 ---|"3"| C_19
  C_6 ---|"2"| C_14
  C_6 ---|"2"| C_28
  C_8 ---|"2"| C_14
  C_3 ---|"1"| C_15
  C_7 ---|"1"| C_14
```

## Graph composition

### Node types

| Kind | Count | Share |
|---|---:|---:|
| code | 3649 | 64.0% |
| document | 1615 | 28.3% |
| concept | 176 | 3.1% |
| rationale | 144 | 2.5% |
| image | 112 | 2.0% |
| paper | 2 | 0.0% |

### Node origins

| Kind | Count | Share |
|---|---:|---:|
| ast | 5111 | 89.7% |
| unspecified | 587 | 10.3% |

### Pair-link confidence

| Kind | Count | Share |
|---|---:|---:|
| EXTRACTED | 7697 | 98.8% |
| INFERRED | 90 | 1.2% |
| AMBIGUOUS | 2 | 0.0% |

### Most common pair-link relations

| Relation | Links |
|---|---:|
| contains | 3285 |
| imports | 1266 |
| defines | 990 |
| calls | 817 |
| references | 572 |
| imports_from | 280 |
| re_exports | 169 |
| conceptually_related_to | 100 |
| inherits | 82 |
| method | 75 |
| rationale_for | 46 |
| implements | 38 |
| semantically_similar_to | 31 |
| shares_data_with | 16 |
| exports | 13 |
| mixes_in | 4 |
| navigates | 4 |
| extends | 1 |

## Strongest cross-community connections

| Community A | Community B | Pair links |
|---|---|---:|
| `50` Flutter LLDB Helper | `87` Community 101 | 30 |
| `4` App Bootstrap Auth Gate | `64` Agent Worktree Setup | 27 |
| `14` Brain Ingestion Storage Pipeline | `28` Brain Ingestion Storage Pipeline | 20 |
| `117` Claim Verification Types | `118` Claim Verification Workflow | 19 |
| `50` Flutter LLDB Helper | `65` Community 74 | 17 |
| `29` Architecture Module Dependency Graph | `65` Community 74 | 16 |
| `29` Architecture Module Dependency Graph | `87` Community 101 | 16 |
| `39` Windows Flutter Window C++ | `56` Community 68 | 15 |
| `50` Flutter LLDB Helper | `71` Community 83 | 15 |
| `6` Claim Synthesis Pipeline | `95` Claim Verification Types | 14 |
| `50` Flutter LLDB Helper | `103` Community 124 | 14 |
| `65` Community 74 | `87` Community 101 | 14 |
| `6` Claim Synthesis Pipeline | `64` Agent Worktree Setup | 13 |
| `8` Engagement Home Tab | `28` Brain Ingestion Storage Pipeline | 13 |
| `29` Architecture Module Dependency Graph | `50` Flutter LLDB Helper | 13 |
| `89` Community 103 | `118` Claim Verification Workflow | 13 |
| `118` Claim Verification Workflow | `229` Community 364 | 13 |
| `4` App Bootstrap Auth Gate | `28` Brain Ingestion Storage Pipeline | 12 |
| `19` Research Source Discovery | `28` Brain Ingestion Storage Pipeline | 12 |
| `104` Community 126 | `118` Claim Verification Workflow | 12 |
| `39` Windows Flutter Window C++ | `45` Session Isolation Worktrees | 11 |
| `41` Consent Service | `45` Session Isolation Worktrees | 11 |
| `45` Session Isolation Worktrees | `56` Community 68 | 10 |
| `79` Community 73 | `109` Community 73 | 10 |
| `1` Daily Logging and Insights | `2` M2 Self-Report Screens | 9 |
| `6` Claim Synthesis Pipeline | `183` Claim Synthesis Pipeline | 9 |
| `50` Flutter LLDB Helper | `167` Community 210 | 9 |
| `118` Claim Verification Workflow | `160` Community 196 | 9 |
| `1` Daily Logging and Insights | `27` Antibiotic Course Service | 8 |
| `19` Research Source Discovery | `76` Research Source Discovery | 8 |
| `19` Research Source Discovery | `77` Community 87 | 8 |
| `22` Symptom Flags Screen | `64` Agent Worktree Setup | 8 |
| `28` Brain Ingestion Storage Pipeline | `64` Agent Worktree Setup | 8 |
| `28` Brain Ingestion Storage Pipeline | `123` Insight Rules Engine Two-Tier | 8 |
| `120` Community 142 | `122` Paper Detail Display | 8 |
| `4` App Bootstrap Auth Gate | `87` Community 101 | 7 |
| `19` Research Source Discovery | `20` Home Navigation Routes | 7 |
| `19` Research Source Discovery | `35` iOS/macOS Runner Tests | 7 |
| `20` Home Navigation Routes | `28` Brain Ingestion Storage Pipeline | 7 |
| `20` Home Navigation Routes | `76` Research Source Discovery | 7 |
| `28` Brain Ingestion Storage Pipeline | `76` Research Source Discovery | 7 |
| `89` Community 103 | `229` Community 364 | 7 |
| `104` Community 126 | `229` Community 364 | 7 |
| `117` Claim Verification Types | `229` Community 364 | 7 |
| `122` Paper Detail Display | `127` Paper Detail Display | 7 |
| `2` M2 Self-Report Screens | `5` Theme Design Tokens | 6 |
| `12` Shared Types TS | `76` Research Source Discovery | 6 |
| `19` Research Source Discovery | `89` Community 103 | 6 |
| `24` Authentication and App Navigation | `55` Authentication and App Navigation | 6 |
| `28` Brain Ingestion Storage Pipeline | `33` Community 66 | 6 |

## Bridge nodes

Bridge nodes touch several communities. They are useful starting points for blast-radius questions,
but high degree can also reflect generic infrastructure or documentation hubs.

| Node | Community | Neighbor communities | Cross links | Source |
|---|---|---:|---:|---|
| package:supabase_flutter/supabase_flutter.dart | `42` Supabase Package | 20 | 20 | `no source` |
| run.ts | `28` Brain Ingestion Storage Pipeline | 17 | 74 | `tools/brain-ingest/src/run.ts` |
| package:flutter/material.dart | `55` Authentication and App Navigation | 16 | 19 | `no source` |
| SourceName | `20` Home Navigation Routes | 14 | 31 | `tools/brain-ingest/src/types.ts` |
| index.ts | `87` Community 101 | 13 | 66 | `tools/llm-router/src/index.ts` |
| cli.ts | `64` Agent Worktree Setup | 13 | 31 | `tools/brain-ingest/src/cli.ts` |
| SourceCtx | `19` Research Source Discovery | 13 | 24 | `tools/brain-ingest/src/types.ts` |
| List | `137` Linux GTK Runner | 13 | 14 | `no source` |
| index.ts | `6` Claim Synthesis Pipeline | 12 | 27 | `tools/brain-ingest/src/synth/index.ts` |
| insight_provenance_screen.dart | `2` M2 Self-Report Screens | 11 | 28 | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart` |
| home_tab.dart | `27` Antibiotic Course Service | 11 | 22 | `apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart` |
| PaperRecord | `33` Community 66 | 10 | 21 | `tools/brain-ingest/src/types.ts` |
| daily_log_screen.dart | `1` Daily Logging and Insights | 10 | 17 | `apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart` |
| Config | `14` Brain Ingestion Storage Pipeline | 10 | 14 | `tools/brain-ingest/src/types.ts` |
| FetchOptions | `19` Research Source Discovery | 10 | 14 | `tools/brain-ingest/src/types.ts` |
| ../../../../core/theme.dart | `55` Authentication and App Navigation | 10 | 13 | `no source` |
| LlmRouter | `361` Community 461 | 10 | 12 | `tools/llm-router/src/router.ts` |
| package:google_fonts/google_fonts.dart | `24` Authentication and App Navigation | 10 | 12 | `no source` |
| loadConfig() | `65` Community 74 | 9 | 15 | `tools/llm-router/src/config.ts` |
| verifier.ts | `118` Claim Verification Workflow | 8 | 49 | `tools/brain-ingest/src/verify/verifier.ts` |
| types.ts | `76` Research Source Discovery | 8 | 16 | `tools/brain-ingest/src/types.ts` |
| LlmResponse | `87` Community 101 | 8 | 12 | `tools/llm-router/src/types.ts` |
| insights_tab.dart | `25` Wearable Sync Service | 8 | 10 | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insights_tab.dart` |
| SupabaseClient | `42` Supabase Package | 8 | 8 | `no source` |
| router.ts | `50` Flutter LLDB Helper | 7 | 28 | `tools/llm-router/src/router.ts` |
| verify.test.ts | `104` Community 126 | 7 | 24 | `tools/brain-ingest/tests/verify.test.ts` |
| package:flutter_test/flutter_test.dart | `109` Community 73 | 7 | 20 | `no source` |
| retrieval.ts | `89` Community 103 | 7 | 17 | `tools/brain-ingest/src/verify/retrieval.ts` |
| SynthClaim | `117` Claim Verification Types | 7 | 15 | `tools/brain-ingest/src/synth/types.ts` |
| Candidate | `19` Research Source Discovery | 7 | 10 | `tools/brain-ingest/src/types.ts` |
| LlmRequest | `87` Community 101 | 7 | 10 | `tools/llm-router/src/types.ts` |
| createServerSupabaseClient() | `73` Community 128 | 7 | 9 | `apps/nao/src/lib/supabase-server.ts` |
| Identifiers | `8` Engagement Home Tab | 7 | 8 | `tools/brain-ingest/src/types.ts` |
| static const | `78` Community 88 | 7 | 7 | `no source` |
| budget.ts | `50` Flutter LLDB Helper | 6 | 16 | `tools/llm-router/src/budget.ts` |
| types.ts | `229` Community 364 | 6 | 16 | `tools/brain-ingest/src/verify/types.ts` |
| Seed | `19` Research Source Discovery | 6 | 11 | `tools/brain-ingest/src/types.ts` |
| d1.ts | `67` Community 78 | 6 | 9 | `apps/nao/src/lib/d1.ts` |
| metric_trend_section.dart | `30` Linux GTK Runner | 6 | 9 | `apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_trend_section.dart` |
| retrieveRecord() | `123` Insight Rules Engine Two-Tier | 6 | 9 | `tools/brain-ingest/src/run.ts` |
| stool_form_screen.dart | `16` Antibiotic Course Screen | 6 | 9 | `apps/biotope/lib/modules/m2_self_report/ui/screens/stool_form_screen.dart` |
| openalex.test.ts | `12` Shared Types TS | 6 | 8 | `tools/brain-ingest/tests/openalex.test.ts` |
| State | `70` Antibiotic Course Screen | 6 | 8 | `no source` |
| StatefulWidget | `70` Antibiotic Course Screen | 6 | 8 | `no source` |
| europepmcFulltext.ts | `63` Community 80 | 6 | 7 | `tools/brain-ingest/src/retrieval/europepmcFulltext.ts` |
| R2Store | `14` Brain Ingestion Storage Pipeline | 6 | 7 | `tools/brain-ingest/src/storage/r2.ts` |
| RouterConfig | `50` Flutter LLDB Helper | 6 | 7 | `tools/llm-router/src/config.ts` |
| metric_trend_section_widget_test.dart | `137` Linux GTK Runner | 6 | 6 | `apps/biotope/test/m5a_baselines/metric_trend_section_widget_test.dart` |
| provenance_models.dart | `5` Theme Design Tokens | 6 | 6 | `apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart` |
| provenance_screen_widget_test.dart | `131` Community 154 | 6 | 6 | `apps/biotope/test/m5b_insight_engine/provenance_screen_widget_test.dart` |

## Hyperedges

Hyperedges express one relationship spanning three or more nodes. A non-zero missing-member count is
an integrity defect in the machine graph and should be resolved before treating that hyperedge as usable.

| Hyperedge | Relation | Members | Missing | Confidence | Source |
|---|---|---:|---:|---|---|
| Anomaly and personal-signal detectors | participate_in | 8 | 0 | EXTRACTED | `docs/shared/decisions/0002-anomaly-definition.md` |
| Resumable Multi-Unit Run Governance | participate_in | 7 | 0 | EXTRACTED | `.claude/skills/orchestrate-build-run/SKILL.md` |
| Run 3 Security Data and Scientific Semantics Tranche | participate_in | 7 | 0 | EXTRACTED | `docs/temp/run3/pending-build-register.md` |
| Citation reference graph pipeline | participate_in | 6 | 0 | EXTRACTED | `docs/shared/decisions/0001-citation-extraction.md` |
| Graphify Adoption History | participate_in | 6 | 0 | EXTRACTED | `docs/sessions/20260617T041218Z-uandiqueue-claude-graphify-adoption.md` |
| Run 3 Locked Remediation Units | form | 6 | 0 | EXTRACTED | `docs/temp/run3/README.md` |
| Brain-to-card Pipeline Slice | participate_in | 5 | 0 | EXTRACTED | `docs/sessions/20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md` |
| Graphify Knowledge Graph Workflow | form | 5 | 0 | EXTRACTED | `.claude/skills/graphify/SKILL.md` |
| Localized Low-Friction Capture | participate_in | 5 | 0 | EXTRACTED | `docs/biotope/metrics-catalog.md` |
| M2 Self-Report Logging Contract | form | 5 | 0 | EXTRACTED | `apps/biotope/lib/modules/m2_self_report/m2-context.md` |
| Manual Collection Tiers | form | 5 | 0 | EXTRACTED | `docs/biotope/metrics-catalog.md` |
| Ourobion Master Identity System | form | 5 | 0 | EXTRACTED | `assets/ourobion-brand/DESIGN.md` |
| Phase 2 Audit Fix Units | participate_in | 5 | 0 | EXTRACTED | `docs/sessions/20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md` |
| Run 2 early pipeline units | conceptually_related_to | 5 | 0 | INFERRED | `docs/sessions/20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md` |
| Run 3 Client Trust Tranche | participate_in | 5 | 0 | EXTRACTED | `docs/temp/run3/pending-build-register.md` |
| Sustainable Trend Discovery | form | 5 | 0 | EXTRACTED | `docs/biotope/metrics-catalog.md` |
| Transparent Decorative Cutouts | participate_in | 5 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/prompts/deco_flower_cluster_blush.md` |
| Accepted Empty-State Asset Family | participate_in | 4 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/reviews/empty_scan_bloom.md` |
| Decorative Review Family | participate_in | 4 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/reviews/deco_flower_cluster_blush.md` |
| Deterministic Insight-Engine Foundation | form | 4 | 0 | EXTRACTED | `docs/sessions/20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md` |
| Documentation Routing and Authority | form | 4 | 0 | EXTRACTED | `docs/INDEX.md` |
| Enforced Cross-Language Safety | form | 4 | 0 | EXTRACTED | `docs/graph/couplings.yaml` |
| Generated Asset Quality System | participate_in | 4 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/README.md` |
| Ingestion Identity and Retrieval Flow | participate_in | 4 | 0 | EXTRACTED | `docs/nao/brain-ingestion-design.md` |
| Insight engine deterministic serve flow | participate_in | 4 | 0 | EXTRACTED | `docs/shared/insight-engine-architecture.md` |
| Metric Platform Foundation History | participate_in | 4 | 0 | INFERRED | `docs/sessions/20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md` |
| One-Card Proof and CI Backstop | form | 4 | 0 | INFERRED | `docs/sessions/20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md` |
| Phase 2 Workflow Evolution | participate_in | 4 | 0 | EXTRACTED | `docs/sessions/20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md` |
| Porcelain Archive Asset Family | form | 4 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/prompts/archive_report_thumbnail_base.md` |
| Run 2 demo curation features | conceptually_related_to | 4 | 0 | EXTRACTED | `docs/sessions/20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md` |
| Run-3 Documentation Reconciliation | participate_in | 4 | 0 | EXTRACTED | `docs/temp/documentation-freshness-audit-2026-07-26.md` |
| Scan Asset Family | participate_in | 4 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/prompts/scan_biomech_orchid.md` |
| U6 Simulated Data Loading Flow | participate_in | 4 | 0 | EXTRACTED | `docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| U8 Model Configuration Boundary | participate_in | 4 | 0 | EXTRACTED | `docs/sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md` |
| Accepted Insights Asset Family | participate_in | 3 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/reviews/insights_neural_botanical_cluster.md` |
| Agent Guidance Graphify Navigation | participate_in | 3 | 0 | INFERRED | `CLAUDE.md` |
| Brain Verification Support | participate_in | 3 | 0 | INFERRED | `docs/sessions/20260715T143750Z-agentjwork-claude-brain-llm-router.md` |
| Insight engine authoring loop | participate_in | 3 | 0 | EXTRACTED | `docs/shared/insight-engine-architecture.md` |
| Phase 2 Demo Analysis Flow | participate_in | 3 | 0 | INFERRED | `docs/shared/phase2-demo-runbook.md` |
| Profile Asset Family | participate_in | 3 | 0 | EXTRACTED | `docs/biotope/ui/ai-assets/prompts/profile_botanical_crest.md` |
| Semantic Graph Quality Gaps | participate_in | 3 | 0 | EXTRACTED | `docs/temp/run3/pending-build-register.md` |
| Shared Contract Projection Pattern | participate_in | 3 | 0 | INFERRED | `shared/brain/README.md` |
| Shared engineering delivery guidance | conceptually_related_to | 3 | 0 | INFERRED | `docs/shared/dev-workflow.md` |
| U5 Pipeline and Baseline Lifecycle | participate_in | 3 | 0 | EXTRACTED | `docs/sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md` |

<details>
<summary><strong>Complete community directory (607)</strong></summary>

Communities are ordered by node count. “Cross links” counts incidences, so each connection contributes
once to each endpoint community.

| ID | Community | Nodes | Internal links | Cross links | Inferred incidences | Key nodes | Representative sources |
|---:|---|---:|---:|---:|---:|---|---|
| 0 | Dev Workflow Commit Conventions | 89 | 88 | 1 | 0 | index.dart · activeTitle · BaselineSnapshot · body | `shared/types/index.dart` |
| 1 | Daily Logging and Insights | 85 | 93 | 42 | 0 | daily_log_screen.dart · StatelessWidget · _ActiveCourseCard · _CardHeader | `apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart` |
| 2 | M2 Self-Report Screens | 62 | 61 | 28 | 0 | insight_provenance_screen.dart · _body · _centeredNote · _dateOnly | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart` |
| 19 | Research Source Discovery | 62 | 114 | 81 | 0 | SourceCtx · FetchOptions · crossref.test.ts · crossref.ts | `tools/brain-ingest/src/sources/discovery/crossref.ts`<br/>`tools/brain-ingest/src/sources/discovery/arxiv.ts`<br/>`tools/brain-ingest/src/sources/discovery/s2.ts` |
| 3 | Windows Win32 Runner | 59 | 115 | 6 | 0 | stats.ts · index.ts · s5_pairwise.test.ts · config.ts | `supabase/functions/evaluate-signals/stats.ts`<br/>`supabase/functions/evaluate-signals/index.ts`<br/>`supabase/functions/evaluate-signals/lifecycle.ts` |
| 5 | Theme Design Tokens | 57 | 56 | 12 | 0 | provenance_models.dart · ProvenanceCardInfo · ProvenanceCitation · ProvenanceCompleteness | `apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart` |
| 4 | App Bootstrap Auth Gate | 52 | 119 | 56 | 0 | index.ts · seeder.test.ts · artifact.ts · candidates.ts | `tools/brain-ingest/src/seeder/types.ts`<br/>`tools/brain-ingest/tests/seeder.test.ts`<br/>`tools/brain-ingest/src/seeder/dbSeeds.ts` |
| 7 | Stool Form Screen | 52 | 103 | 27 | 0 | core.retrieval.test.ts · capture.ts · core.ts · capture.test.ts | `tools/brain-ingest/src/retrieval/capture.ts`<br/>`tools/brain-ingest/src/retrieval/core.ts`<br/>`tools/brain-ingest/tests/core.retrieval.test.ts` |
| 8 | Engagement Home Tab | 51 | 98 | 44 | 0 | identity.ts · idconv.ts · normalizeIdentifiers() · idconv.test.ts | `tools/brain-ingest/src/identity.ts`<br/>`tools/brain-ingest/src/sources/idconv.ts`<br/>`tools/brain-ingest/tests/idconv.test.ts` |
| 9 | Insight Card Model Service | 51 | 79 | 0 | 3 | win32_window.cpp · Create() · MessageHandler() · WndProc() | `apps/biotope/windows/runner/win32_window.cpp`<br/>`apps/biotope/windows/runner/flutter_window.cpp`<br/>`apps/biotope/windows/flutter/generated_plugin_registrant.cc` |
| 80 | User Consent and Metrics Models | 49 | 49 | 4 | 0 | metric_series_models.dart · user_profile.dart · consent_record.dart · DateTime | `apps/biotope/lib/modules/m5a_baselines/impl/metric_series_models.dart`<br/>`apps/biotope/lib/modules/m1_core/models/user_profile.dart`<br/>`apps/biotope/lib/modules/m1_core/models/consent_record.dart` |
| 10 | Baseline Service Snapshots | 46 | 49 | 0 | 1 | Ourobion — Brand Assets · Ourobion — Brand & Logo Design Principles · Ourobion Biotope — Logo & Design Notes · Ourobion Master Identity | `assets/ourobion-brand/DESIGN.md`<br/>`assets/ourobion-biotope-logo/DESIGN.md`<br/>`assets/ourobion-brand/README.md` |
| 11 | Insights Tab UI | 45 | 79 | 1 | 0 | simulatedHealth.ts · route.ts · LoaderPanel.tsx · simulatedHealth.test.ts | `apps/nao/src/lib/simulatedHealth.ts`<br/>`apps/nao/src/components/LoaderPanel.tsx`<br/>`apps/nao/src/app/(app)/api/loader/route.ts` |
| 13 | Daily Gut Row Model | 45 | 44 | 0 | 0 | Session 20260719T154600Z — agentjwork — claude — research-fixes-lag2 · Session 20260719T151130Z — agentjwork — claude — research-fixes-c5-cu… · Session 20260719T152353Z — agentjwork — claude — research-fixes-edge-… · Left (worklist, resume at F6) | `docs/sessions/20260719T154600Z-agentjwork-claude-research-fixes-lag2.md`<br/>`docs/sessions/20260719T144911Z-agentjwork-claude-research-fixes-run-setup.md`<br/>`docs/sessions/20260719T151130Z-agentjwork-claude-research-fixes-c5-cutoff.md` |
| 14 | Brain Ingestion Storage Pipeline | 43 | 81 | 55 | 0 | r2.ts · Config · run.test.ts · R2Store | `tools/brain-ingest/src/storage/r2.ts`<br/>`tools/brain-ingest/tests/r2.test.ts`<br/>`tools/brain-ingest/tests/run.test.ts` |
| 15 | macOS App Delegate | 43 | 58 | 3 | 0 | index.ts · registry.ts · index.ts · buildSnapshots() | `supabase/functions/compute-baselines/index.ts`<br/>`shared/metrics/registry.ts`<br/>`shared/metrics/index.ts` |
| 28 | Brain Ingestion Storage Pipeline | 43 | 76 | 115 | 1 | run.ts · run() · rateLimiter.ts · memoryGuard.ts | `tools/brain-ingest/src/run.ts`<br/>`tools/brain-ingest/src/limits/memoryGuard.ts`<br/>`tools/brain-ingest/src/limits/rateLimiter.ts` |
| 6 | Claim Synthesis Pipeline | 42 | 87 | 68 | 1 | index.ts · types.ts · synthesize() · postprocess.ts | `tools/brain-ingest/src/synth/types.ts`<br/>`tools/brain-ingest/src/synth/index.ts`<br/>`tools/brain-ingest/src/synth/load.ts` |
| 16 | Antibiotic Course Screen | 42 | 43 | 20 | 0 | stool_form_screen.dart · urine_color_screen.dart · AnimationController · Animation | `apps/biotope/lib/modules/m2_self_report/ui/screens/stool_form_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/urine_color_screen.dart` |
| 17 | Community 202 | 42 | 47 | 0 | 0 | Graphify Knowledge Graph Pipeline · Graphify Incremental Update · Graphify Query Path and Explain Flow · Semantic Extraction Contract | `.claude/skills/graphify/SKILL.md`<br/>`.claude/skills/graphify/references/extraction-spec.md`<br/>`.claude/skills/graphify/references/query.md` |
| 18 | Context-Sync Enforcer | 42 | 41 | 6 | 0 | insight_service.dart · InsightService · _client · _parseCategory | `apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart` |
| 25 | Wearable Sync Service | 40 | 41 | 18 | 0 | insights_tab.dart · _InsightsTabState · _ResearchBasis · _ResearchBasisState | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insights_tab.dart` |
| 21 | Sign-In Sign-Up Screens | 39 | 38 | 3 | 0 | guard_support.dart · activeKeysFor · allMatches · baselineApplicable | `apps/biotope/test/guards/guard_support.dart` |
| 22 | Symptom Flags Screen | 39 | 77 | 8 | 0 | venue.test.ts · banding.ts · cache.ts · openalexSources.ts | `tools/brain-ingest/src/venue/cache.ts`<br/>`tools/brain-ingest/src/venue/openalexSources.ts`<br/>`tools/brain-ingest/src/venue/banding.ts` |
| 23 | Home Tab Widgets | 39 | 99 | 0 | 0 | context_sync.mjs · read() · runCheck() · isFile() | `tools/context_sync.mjs` |
| 26 | Symptoms and Antibiotic Logging | 37 | 38 | 24 | 0 | antibiotic_course_screen.dart · symptom_flags_screen.dart · IconData · VoidCallback | `apps/biotope/lib/modules/m2_self_report/ui/screens/antibiotic_course_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/symptom_flags_screen.dart` |
| 27 | Antibiotic Course Service | 37 | 37 | 29 | 0 | home_tab.dart · ../../impl/auth_service.dart · ../../impl/profile_service.dart · index.dart | `apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart`<br/>`apps/biotope/lib/modules/m1_core/index.dart` |
| 29 | Architecture Module Dependency Graph | 37 | 68 | 54 | 0 | apiWorker.ts · apiWorker.test.ts · errors.ts · router.test.ts | `tools/llm-router/src/routes/apiWorker.ts`<br/>`tools/llm-router/src/errors.ts`<br/>`tools/llm-router/tests/apiWorker.test.ts` |
| 30 | Linux GTK Runner | 36 | 36 | 17 | 0 | metric_trend_section.dart · MetricTrendSectionState · ../../index.dart · MetricTrendSection | `apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_trend_section.dart` |
| 31 | Auth Service | 35 | 34 | 1 | 0 | registry.dart · availability · baselineApplicable · continuity | `shared/metrics/registry.dart` |
| 24 | Authentication and App Navigation | 34 | 38 | 24 | 0 | sign_up_screen.dart · sign_in_screen.dart · package:google_fonts/google_fonts.dart · _SignInScreenState | `apps/biotope/lib/modules/m1_core/ui/screens/sign_up_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/sign_in_screen.dart` |
| 32 | Consent Screen Records | 34 | 33 | 0 | 0 | devDependencies · scripts · dependencies · package.json | `apps/nao/package.json` |
| 34 | Community 198 | 32 | 35 | 0 | 6 | Ourobion biotope Flutter App · DailyGutRow Raw Data Asset · M2 Self-Report Logging Module · biotope Package Manifest | `apps/biotope/README.md`<br/>`apps/biotope/lib/modules/m2_self_report/m2-context.md`<br/>`apps/biotope/lib/modules/m1_core/m1-context.md` |
| 20 | Home Navigation Routes | 31 | 63 | 41 | 0 | SourceName · budget.ts · FileBudgetGuard · .charge() | `tools/brain-ingest/src/limits/budget.ts`<br/>`tools/brain-ingest/tests/budget.test.ts`<br/>`tools/brain-ingest/tests/unpaywall.test.ts` |
| 35 | iOS/macOS Runner Tests | 31 | 48 | 19 | 0 | pubmed.ts · pubmed.test.ts · articleToCandidate() · discover() | `tools/brain-ingest/src/sources/discovery/pubmed.ts`<br/>`tools/brain-ingest/tests/pubmed.test.ts` |
| 36 | Baselines Compute TS | 31 | 30 | 3 | 0 | theme.dart · base · copyWith · manrope | `apps/biotope/lib/core/theme.dart` |
| 37 | Project Toolchain CI | 29 | 47 | 4 | 0 | claimsControl.ts · ClaimsPanel.tsx · claimsControl.test.ts · route.ts | `apps/nao/src/lib/claimsControl.ts`<br/>`apps/nao/src/components/ClaimsPanel.tsx`<br/>`apps/nao/src/app/(app)/api/claims/reject/route.ts` |
| 76 | Research Source Discovery | 29 | 41 | 50 | 0 | types.ts · unpaywall.test.ts · unpaywall.ts · OaInfo | `tools/brain-ingest/src/sources/oa/unpaywall.ts`<br/>`tools/brain-ingest/src/types.ts`<br/>`tools/brain-ingest/tests/unpaywall.test.ts` |
| 123 | Insight Rules Engine Two-Tier | 29 | 48 | 25 | 0 | arxivPdf.test.ts · arxivPdf.ts · retrieveRecord() · extract.ts | `tools/brain-ingest/src/extract.ts`<br/>`tools/brain-ingest/src/retrieval/arxivPdf.ts`<br/>`tools/brain-ingest/tests/arxivPdf.test.ts` |
| 38 | Web App Manifest | 28 | 27 | 1 | 0 | generated_assets.dart · _base · archiveHerbariumSpecimen · archivePreservedFlowerFragment | `apps/biotope/lib/core/generated_assets.dart` |
| 39 | Windows Flutter Window C++ | 28 | 39 | 26 | 0 | composer.ts · engine_orientation_gap.test.ts · classifyPattern() · CandidatePattern | `supabase/functions/generate-insights/composer.ts`<br/>`tools/rules/tests/engine_orientation_gap.test.ts`<br/>`supabase/functions/generate-insights/render.ts` |
| 40 | Stool Form Screen State | 28 | 62 | 18 | 0 | types.ts · ingestControl.ts · route.ts · route.ts | `apps/nao/src/lib/types.ts`<br/>`apps/nao/src/lib/ingestControl.ts`<br/>`apps/nao/src/app/(app)/api/ingest-control/route.ts` |
| 12 | Shared Types TS | 27 | 48 | 18 | 0 | openalex.ts · openalex.test.ts · resolveOa() · mapWorkToOaInfo() | `tools/brain-ingest/src/sources/oa/openalex.ts`<br/>`tools/brain-ingest/tests/openalex.test.ts` |
| 41 | Consent Service | 27 | 48 | 13 | 0 | evaluators.ts · engine_condition_coverage.test.ts · windowedBaseline() · evaluateCoincidence() | `supabase/functions/generate-insights/evaluators.ts`<br/>`tools/rules/tests/engine_condition_coverage.test.ts` |
| 43 | Parity Schema Tests | 27 | 26 | 0 | 0 | What Phase 2 contains (by workstream) · Phase 2 plan · The metric platform (the floor everything else stands on) · Tracks, dependencies & sequencing | `docs/shared/phase-2-plan.md` |
| 64 | Agent Worktree Setup | 27 | 54 | 87 | 6 | cli.ts · main() · generateSeedQueries() · runVerify() | `tools/brain-ingest/src/cli.ts`<br/>`tools/brain-ingest/src/seeder/index.ts`<br/>`tools/brain-ingest/src/config.ts` |
| 42 | Supabase Package | 26 | 28 | 30 | 0 | package:supabase_flutter/supabase_flutter.dart · SupabaseClient · mosquito_logging.dart · metric_series_service.dart | `apps/biotope/lib/modules/m2_self_report/impl/behaviour/mosquito_logging.dart`<br/>`apps/biotope/lib/modules/m1_core/impl/profile_service.dart`<br/>`apps/biotope/lib/modules/m5a_baselines/impl/metric_series_service.dart` |
| 44 | Graphify Extraction Spec | 26 | 51 | 1 | 0 | modelsControl.ts · ModelsPanel.tsx · modelsControl.test.ts · ModelsPanel() | `apps/nao/src/lib/modelsControl.ts`<br/>`apps/nao/src/components/ModelsPanel.tsx`<br/>`apps/nao/src/app/(app)/api/models/caps/route.ts` |
| 45 | Session Isolation Worktrees | 26 | 27 | 38 | 0 | index.ts · Branch · GapStatus · GapEventRow | `supabase/functions/generate-insights/index.ts`<br/>`supabase/functions/generate-insights/composer.ts` |
| 55 | Authentication and App Navigation | 26 | 26 | 45 | 0 | package:flutter/material.dart · app_shell.dart · ../../../../core/theme.dart · home_screen.dart | `apps/biotope/lib/modules/m1_core/ui/screens/app_shell.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/home_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/sign_in_screen.dart` |
| 46 | Profile Service | 25 | 30 | 0 | 2 | my_application.cc · _MyApplication · GApplication · my_application_local_command_line() | `apps/biotope/linux/runner/my_application.cc`<br/>`apps/biotope/linux/flutter/generated_plugin_registrant.cc`<br/>`apps/biotope/linux/runner/main.cc` |
| 47 | Auth Result Model | 25 | 29 | 6 | 0 | index.ts · relationships.ts · EdgeVerification · Citation | `shared/brain/relationships.ts`<br/>`shared/brain/index.ts` |
| 48 | Urine Color Screen | 25 | 24 | 0 | 0 | The Brain — Ingestion (paper corpus) Design · 10 · Build sequence · 2 · The source-API catalog · 5 · Tooling — fetch, capture, extract (TypeScript, no Python) | `docs/nao/brain-ingestion-design.md` |
| 49 | Copy Guidelines Enforcement | 25 | 36 | 14 | 0 | pmcJats.ts · pmcJats.test.ts · retrieveJats() · parseJats() | `tools/brain-ingest/src/retrieval/pmcJats.ts`<br/>`tools/brain-ingest/tests/pmcJats.test.ts` |
| 50 | Flutter LLDB Helper | 25 | 61 | 102 | 0 | router.ts · budget.ts · types.ts · LlmNodeId | `tools/llm-router/src/budget.ts`<br/>`tools/llm-router/src/router.ts`<br/>`tools/llm-router/src/types.ts` |
| 33 | Community 66 | 24 | 53 | 29 | 0 | PaperRecord · Manifest · manifest.ts · manifest.test.ts | `tools/brain-ingest/src/manifest.ts`<br/>`tools/brain-ingest/tests/manifest.test.ts`<br/>`tools/brain-ingest/src/types.ts` |
| 51 | Setup Script | 24 | 23 | 6 | 0 | main.dart · AuthGate · OurobionApp · _checkOnboarding | `apps/biotope/lib/main.dart` |
| 52 | Claude Settings Hooks | 24 | 23 | 0 | 0 | What You Must Do When Invoked · /graphify · Step 3 - Extract entities and relationships · For --update and --cluster-only | `.claude/skills/graphify/SKILL.md` |
| 53 | iOS Scene Delegate | 24 | 23 | 7 | 0 | engagement_service.dart · _client · _computeStreak · _dateStr | `apps/biotope/lib/modules/m6_engagement/impl/engagement_service.dart` |
| 118 | Claim Verification Workflow | 24 | 40 | 81 | 0 | verifier.ts · verifyClaim() · prompt.ts · VerificationValidator | `tools/brain-ingest/src/verify/verifier.ts`<br/>`tools/brain-ingest/src/verify/prompt.ts`<br/>`tools/brain-ingest/src/verify/types.ts` |
| 54 | Community 67 | 23 | 22 | 13 | 0 | living_backdrop.dart · Color · CustomPainter · _OrbPainter | `apps/biotope/lib/modules/m1_core/ui/widgets/living_backdrop.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/stool_form_screen.dart`<br/>`apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_trend_section.dart` |
| 56 | Community 68 | 23 | 31 | 29 | 0 | engine_composer_render.test.ts · render.ts · renderCard() · ServableEdge | `supabase/functions/generate-insights/render.ts`<br/>`tools/rules/tests/engine_composer_render.test.ts`<br/>`supabase/functions/generate-insights/composer.ts` |
| 57 | Community 69 | 23 | 22 | 5 | 0 | baseline_service.dart · _client · _parseConfidence · _parseTrend | `apps/biotope/lib/modules/m5a_baselines/impl/baseline_service.dart` |
| 58 | Community 70 | 23 | 22 | 0 | 0 | compilerOptions · tsconfig.json · paths · @/* | `apps/nao/tsconfig.json` |
| 59 | Community 99 | 23 | 22 | 0 | 0 | scripts · package.json · devDependencies · context:check | `package.json` |
| 60 | Community 75 | 23 | 35 | 18 | 0 | quoteCheck.ts · quoteCheck.test.ts · checkClaimQuotes() · normalizeForMatch() | `tools/brain-ingest/src/verify/quoteCheck.ts`<br/>`tools/brain-ingest/tests/quoteCheck.test.ts`<br/>`tools/brain-ingest/src/verify/verifier.ts` |
| 61 | Community 77 | 22 | 29 | 11 | 0 | IngestControlPanel.tsx · SeedsPanel.tsx · GapsAndSeeds.tsx · GapsPanel.tsx | `apps/nao/src/components/GapsPanel.tsx`<br/>`apps/nao/src/components/SeedsPanel.tsx`<br/>`apps/nao/src/components/IngestControlPanel.tsx` |
| 62 | Community 72 | 22 | 21 | 0 | 0 | package.json · scripts · dependencies · devDependencies | `tools/edge-loader/package.json` |
| 65 | Community 74 | 22 | 34 | 67 | 3 | config.ts · loadConfig() · testMode.test.ts · validateConfig() | `tools/llm-router/src/config.ts`<br/>`tools/llm-router/tests/testMode.test.ts`<br/>`tools/llm-router/src/types.ts` |
| 63 | Community 80 | 21 | 35 | 19 | 0 | europepmcFulltext.test.ts · europepmcFulltext.ts · fetchEuropePmcJats() · jatsToText() | `tools/brain-ingest/src/retrieval/europepmcFulltext.ts`<br/>`tools/brain-ingest/tests/europepmcFulltext.test.ts` |
| 66 | Community 76 | 21 | 20 | 0 | 0 | package.json · dependencies · devDependencies · scripts | `tools/brain-ingest/package.json` |
| 67 | Community 78 | 21 | 36 | 22 | 0 | d1.ts · searchPapers() · facetCounts · corpusStats | `apps/nao/src/lib/d1.ts`<br/>`apps/nao/src/lib/types.ts` |
| 68 | Community 79 | 21 | 20 | 0 | 0 | package.json · scripts · devDependencies · allowScripts | `tools/metric-view/package.json` |
| 69 | Community 81 | 21 | 20 | 0 | 0 | package.json · scripts · dependencies · devDependencies | `tools/rules/package.json` |
| 70 | Antibiotic Course Screen | 21 | 31 | 35 | 0 | State · StatefulWidget · HomeTabState · _LivingBackdropState | `apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/app_shell.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart` |
| 71 | Community 83 | 21 | 44 | 31 | 0 | BudgetLedger · budget.test.ts · .assertCanSpend() · .record() | `tools/llm-router/src/budget.ts`<br/>`tools/llm-router/tests/budget.test.ts`<br/>`tools/llm-router/src/overrides.ts` |
| 117 | Claim Verification Types | 21 | 34 | 46 | 0 | enforce.ts · SynthClaim · enforceVerification() · RetrievalResult | `tools/brain-ingest/src/verify/enforce.ts`<br/>`tools/brain-ingest/src/verify/types.ts`<br/>`tools/brain-ingest/src/synth/types.ts` |
| 72 | Community 84 | 20 | 21 | 0 | 0 | AppDelegate · .application() · AppDelegate · .applicationShouldTerminateAfterLastWindowClosed() | `apps/biotope/ios/Runner/AppDelegate.swift`<br/>`apps/biotope/macos/Runner/AppDelegate.swift` |
| 73 | Community 128 | 20 | 28 | 10 | 0 | createServerSupabaseClient() · layout.tsx · page.tsx · supabase.ts | `apps/nao/src/app/(app)/api/models/route.ts`<br/>`apps/nao/src/app/login/page.tsx`<br/>`apps/nao/src/components/SubNav.tsx` |
| 75 | Community 85 | 20 | 19 | 3 | 0 | chart_math.dart · bool get · compactValueLabel · dayFraction | `apps/biotope/lib/modules/m5a_baselines/impl/chart_math.dart` |
| 77 | Community 87 | 20 | 31 | 18 | 0 | europepmc.ts · europepmc.test.ts · mapResult() · toIdentifiers() | `tools/brain-ingest/src/sources/discovery/europepmc.ts`<br/>`tools/brain-ingest/tests/europepmc.test.ts` |
| 78 | Community 88 | 20 | 19 | 16 | 0 | wearable_service.dart · static const · double? · _aggregate | `apps/biotope/lib/modules/m3_passive_health/impl/wearable_service.dart` |
| 79 | Community 73 | 20 | 19 | 11 | 0 | guard_support.dart · rules_table_contract_test.dart · copy_guidelines_parity_test.dart · daily_gut_row_schema_test.dart | `apps/biotope/test/guards/rules_table_contract_test.dart`<br/>`apps/biotope/test/guards/copy_guidelines_parity_test.dart`<br/>`apps/biotope/test/guards/daily_gut_row_schema_test.dart` |
| 81 | Community 92 | 20 | 20 | 20 | 0 | rule.schema.ts · gateTemplate() · templateSyntaxError() · coincidenceConditionSchema | `shared/rules/rule.schema.ts` |
| 82 | Community 94 | 20 | 19 | 0 | 0 | ui-design-context.md — Ourobion · Component Specs · AI-Generated Image Assets · Cards | `docs/biotope/ui/ui-design-context.md` |
| 74 | Community 95 | 19 | 19 | 6 | 0 | profile_setup_screen.dart · _ProfileSetupScreenState · ProfileSetupScreen · _cityController | `apps/biotope/lib/modules/m1_core/ui/screens/profile_setup_screen.dart` |
| 83 | Logging and Metric Trends | 19 | 18 | 8 | 0 | logging_controller.dart · int? · _client · DailyLogInput | `apps/biotope/lib/modules/m2_self_report/impl/logging_controller.dart` |
| 84 | Community 97 | 19 | 32 | 8 | 0 | artifacts.mjs · edge_artifacts.test.ts · buildLoad() · parseClaims() | `tools/edge-loader/lib/artifacts.mjs`<br/>`tools/edge-loader/tests/edge_artifacts.test.ts`<br/>`tools/edge-loader/tests/edge_endpoints_registry.test.ts` |
| 85 | Community 98 | 19 | 28 | 0 | 2 | auth.ts · verifyAccessToken() · middleware.ts · auth.test.ts | `apps/nao/src/lib/auth.ts`<br/>`apps/nao/src/middleware.ts`<br/>`apps/nao/tests/auth.test.ts` |
| 86 | render graph view mjs | 19 | 37 | 0 | 0 | render_graph_view.mjs · renderGraphView() · text() · render_graph_view.test.mjs | `tools/graph-view/lib/render_graph_view.mjs`<br/>`tools/graph-view/tests/render_graph_view.test.mjs` |
| 87 | Community 101 | 19 | 44 | 99 | 0 | index.ts · LlmRequest · LlmResponse · localAgent.ts | `tools/llm-router/src/routes/localAgent.ts`<br/>`tools/llm-router/tests/localAgent.test.ts`<br/>`tools/llm-router/src/types.ts` |
| 88 | Community 102 | 19 | 18 | 0 | 0 | Session 20260617T041218Z — uandiqueue — claude — graphify-adoption · 20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md · 20260617T041218Z-uandiqueue-claude-graphify-adoption.md · 20260617T064658Z-uandiqueue-claude-graphify-setup-and-readme.md | `docs/sessions/20260617T041218Z-uandiqueue-claude-graphify-adoption.md`<br/>`docs/sessions/20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md`<br/>`docs/sessions/20260617T064658Z-uandiqueue-claude-graphify-setup-and-readme.md` |
| 90 | Community 235 | 18 | 17 | 0 | 5 | Insight Engine · Offline authoring and loop pipeline · Composed insights · Brain support models | `docs/shared/insight-engine-architecture.md`<br/>`AGENTS.md`<br/>`docs/biotope/architecture-context.md` |
| 91 | Community 104 | 18 | 17 | 10 | 0 | relationships.schema.ts · citationSchema · claimKindSchema · edgeVerificationSchema | `shared/brain/relationships.schema.ts` |
| 92 | Community 107 | 18 | 17 | 0 | 0 | ADR: Paper-reliability scoring — the evidence-tier ladder and the rel… · Decision · Options considered · 0003-paper-reliability.md | `docs/shared/decisions/0003-paper-reliability.md` |
| 93 | Community 108 | 18 | 17 | 0 | 0 | package.json · devDependencies · scripts · allowScripts | `tools/engine-stats/package.json` |
| 94 | Community 110 | 18 | 17 | 0 | 0 | compilerOptions · tsconfig.json · declaration · esModuleInterop | `tools/llm-router/tsconfig.json` |
| 229 | Community 364 | 18 | 22 | 44 | 1 | types.ts · corpus.ts · CorpusDoc · loadCorpusFromFile() | `tools/brain-ingest/src/verify/types.ts`<br/>`tools/brain-ingest/src/verify/corpus.ts`<br/>`tools/brain-ingest/src/verify/retrieval.ts` |
| 89 | Community 103 | 17 | 28 | 42 | 0 | retrieval.ts · DiscoverFn · retrieveForClaim() · claimQueryTerms() | `tools/brain-ingest/src/verify/retrieval.ts`<br/>`tools/brain-ingest/src/types.ts` |
| 96 | Community 117 | 17 | 30 | 3 | 0 | gapsControl.ts · gapsControl.test.ts · route.ts · shapeGapRows() | `apps/nao/src/lib/gapsControl.ts`<br/>`apps/nao/src/app/(app)/api/gaps/route.ts`<br/>`apps/nao/tests/gapsControl.test.ts` |
| 97 | Community 118 | 17 | 17 | 7 | 0 | consent_screen.dart · normaliser.dart · _ConsentScreenState · ConsentScreen | `apps/biotope/lib/modules/m1_core/ui/screens/consent_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/impl/normaliser.dart` |
| 98 | Community 109 | 17 | 31 | 9 | 0 | seedsControl.ts · route.ts · seedsControl.test.ts · INGEST_SEED_TOPICS | `apps/nao/src/lib/seedsControl.ts`<br/>`apps/nao/src/app/(app)/api/seeds/route.ts`<br/>`apps/nao/tests/seedsControl.test.ts` |
| 99 | Community 119 | 17 | 16 | 0 | 0 | m2-context.md — M2: Self-Report — Gut & Behaviour · Metrics Implemented (Phase 1 Stage 1) · Antibiotic Tracker (event-based, not daily) · Core Logging Flow (~30 seconds) | `apps/biotope/lib/modules/m2_self_report/m2-context.md` |
| 100 | Community 121 | 17 | 27 | 5 | 0 | d1.test.ts · etl.mjs · manifestToSql() · main() | `apps/nao/scripts/etl.mjs`<br/>`apps/nao/tests/d1.test.ts` |
| 101 | Community 122 | 17 | 16 | 0 | 0 | Each Step · dev-workflow.md — Ourobion Development Workflow · 1. Issue · 2. Branch + Worktree | `docs/shared/dev-workflow.md` |
| 102 | Community 123 | 17 | 16 | 0 | 0 | package.json · dependencies · devDependencies · scripts | `shared/package.json` |
| 103 | Community 124 | 17 | 24 | 31 | 0 | overrides.ts · overrides.test.ts · cli.ts · checkConfig() | `tools/llm-router/src/overrides.ts`<br/>`tools/llm-router/tests/overrides.test.ts`<br/>`tools/llm-router/src/cli.ts` |
| 104 | Community 126 | 16 | 21 | 35 | 0 | verify.test.ts · triage.ts · decideTriage() · supportingCitationCount() | `tools/brain-ingest/tests/verify.test.ts`<br/>`tools/brain-ingest/src/verify/triage.ts` |
| 105 | Community 129 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · esModuleInterop · forceConsistentCasingInFileNames | `tools/brain-ingest/tsconfig.json` |
| 106 | Paper Search Filters | 16 | 24 | 12 | 0 | page.tsx · PapersPage() · one() · filtersFrom() | `apps/nao/src/app/(app)/papers/page.tsx`<br/>`apps/nao/src/components/SortSelect.tsx`<br/>`apps/nao/src/components/SearchBar.tsx` |
| 107 | Community 131 | 16 | 15 | 0 | 0 | Decision 0002: Anomaly & Personal-Signal Definition for the nao Brain… · Options considered · Decision · 0002-anomaly-definition.md | `docs/shared/decisions/0002-anomaly-definition.md` |
| 108 | Community 132 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/edge-loader/tsconfig.json` |
| 109 | Community 73 | 16 | 15 | 22 | 0 | package:flutter_test/flutter_test.dart · chart_math_test.dart · metrics_registry_schema_test.dart · metrics_registry_signals_test.dart | `apps/biotope/test/guards/metrics_registry_schema_test.dart`<br/>`apps/biotope/test/guards/metrics_registry_signals_test.dart`<br/>`apps/biotope/test/m2_self_report/mosquito_logging_test.dart` |
| 110 | Community 133 | 16 | 15 | 4 | 0 | antibiotic_service.dart · AntibioticCourse · _client · _fmt | `apps/biotope/lib/modules/m2_self_report/impl/antibiotic_service.dart` |
| 111 | Community 134 | 16 | 22 | 0 | 0 | view.mjs · view_migration_drift.test.ts · gen_metric_view.mjs · generateViewSql() | `tools/metric-view/lib/view.mjs`<br/>`tools/metric-view/gen_metric_view.mjs`<br/>`tools/metric-view/tests/view_migration_drift.test.ts` |
| 112 | Community 135 | 16 | 15 | 0 | 0 | package.json · devDependencies · scripts · engines | `tools/llm-router/package.json` |
| 113 | Community 136 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/metric-view/tsconfig.json` |
| 114 | Community 137 | 16 | 15 | 2 | 0 | index.dart · return · activeKeys · activeMetrics | `shared/metrics/index.dart` |
| 115 | Community 138 | 16 | 15 | 8 | 0 | rule.ts · CoincidenceCondition · ThresholdCondition · TrendCondition | `shared/rules/rule.ts` |
| 116 | Community 139 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/rules/tsconfig.json` |
| 95 | Claim Verification Types | 15 | 19 | 23 | 0 | synth.test.ts · passages.ts · selectPassages() · segmentSentences() | `tools/brain-ingest/src/synth/passages.ts`<br/>`tools/brain-ingest/tests/synth.test.ts`<br/>`tools/brain-ingest/src/synth/types.ts` |
| 119 | Community 141 | 15 | 14 | 0 | 1 | GeneratedPluginRegistrant.swift · MainFlutterWindow · MainFlutterWindow.swift · RegisterGeneratedPlugins() | `apps/biotope/macos/Flutter/GeneratedPluginRegistrant.swift`<br/>`apps/biotope/macos/Runner/MainFlutterWindow.swift` |
| 120 | Community 142 | 15 | 19 | 12 | 0 | page.tsx · OverviewPage() · humanBytes() · retrievabilityConic() | `apps/nao/src/app/(app)/page.tsx`<br/>`apps/nao/src/lib/palette.ts` |
| 121 | Community 143 | 15 | 14 | 1 | 0 | C2. Derived `D` (D-1 … D-150) · Activity, fitness & neuromotor (D-28 … D-43) · Cardiovascular / autonomic (D-16 … D-27) — all 🟠 (wearable HR/HRV) · Composite roll-ups (D-146 … D-150) | `docs/biotope/metrics-catalog.md` |
| 122 | Paper Detail Display | 15 | 26 | 19 | 0 | palette.ts · PaperCard.tsx · PaperCard() · PaperDetailPage() | `apps/nao/src/lib/palette.ts`<br/>`apps/nao/src/components/PaperCard.tsx`<br/>`apps/nao/src/app/(app)/paper/[uid]/page.tsx` |
| 132 | Community 146 | 15 | 19 | 22 | 0 | blueprints.mjs · rule_blueprint.test.ts · loadBlueprints() · validateFile() | `tools/rules/lib/blueprints.mjs`<br/>`tools/rules/tests/rule_blueprint.test.ts`<br/>`shared/rules/rule.schema.ts` |
| 124 | Community 148 | 14 | 13 | 0 | 0 | Collection Tier Ladder · Manual Logging Budget · Three Data Economies · Event-Triggered Logging | `docs/biotope/metrics-catalog.md` |
| 125 | Community 149 | 14 | 13 | 0 | 0 | Metrics Registry — Design · Add a metric (safe flow) · Alternatives considered · Fix-on-arrival — RESOLVED (registry seeded from deployed truth) | `docs/biotope/metrics-registry-design.md` |
| 126 | Community 310 | 14 | 15 | 0 | 5 | Semantic Context Graph · Deferred Structural Import Graph · Graphify Context Tool Decision · Rule Blueprint Contract | `docs/graph/README.md`<br/>`shared/brain/README.md`<br/>`shared/rules/README.md` |
| 127 | Paper Detail Display | 14 | 18 | 13 | 0 | page.tsx · r2.ts · getPaperMeta() · PaperRecord | `apps/nao/src/app/(app)/paper/[uid]/page.tsx`<br/>`apps/nao/src/lib/r2.ts`<br/>`apps/nao/src/components/CollapsibleAbstract.tsx` |
| 128 | Community 151 | 14 | 13 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · esModuleInterop | `tools/engine-stats/tsconfig.json` |
| 129 | Community 152 | 14 | 13 | 5 | 1 | Record-only evidence-review run · Audit Unit Resume Protocol · Research Unit Resume Protocol · 0. Ground rules (non-negotiable) | `.claude/skills/evidence-review-run/SKILL.md`<br/>`.claude/skills/record-only-audit/SKILL.md` |
| 130 | Community 153 | 14 | 13 | 2 | 0 | auth_service.dart · _client · ../models/auth_result.dart · ../models/user_identity.dart | `apps/biotope/lib/modules/m1_core/impl/auth_service.dart` |
| 131 | Community 154 | 14 | 13 | 10 | 0 | provenance_screen_widget_test.dart · InsightProvenance · ProvenanceService · _FakeProvenanceService | `apps/biotope/test/m5b_insight_engine/provenance_screen_widget_test.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_service.dart` |
| 133 | Community 155 | 14 | 13 | 6 | 0 | copy_gate_word_boundary_test.dart · ../../../../shared/constants/copy_guidelines.dart · insight_copy_gate_test.dart · provenance_copy_gate_test.dart | `apps/biotope/test/m5b_insight_engine/copy_gate_word_boundary_test.dart`<br/>`apps/biotope/test/m5a_baselines/trend_copy_gate_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/insight_copy_gate_test.dart` |
| 134 | Community 156 | 14 | 13 | 0 | 0 | registry.schema.ts · Exact · metricAvailabilitySchema · metricContinuitySchema | `shared/metrics/registry.schema.ts` |
| 135 | Community 157 | 14 | 15 | 8 | 0 | Autonomous Multi-Unit Build Run · Resumable Run Tracking Documents · Phase-2 Multi-Unit Build Run · Blocked Register | `.claude/skills/orchestrate-build-run/SKILL.md`<br/>`.claude/skills/orchestrate-build-run/references/tracking-docs.md`<br/>`.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 136 | Community 161 | 13 | 12 | 0 | 0 | RunnerTests.swift · RunnerTests.swift · RunnerTests · RunnerTests | `apps/biotope/ios/RunnerTests/RunnerTests.swift`<br/>`apps/biotope/macos/RunnerTests/RunnerTests.swift` |
| 137 | Linux GTK Runner | 13 | 12 | 22 | 0 | metric_trend_section_widget_test.dart · List · MetricSeriesService · _FakeSeriesService | `apps/biotope/test/m5a_baselines/metric_trend_section_widget_test.dart`<br/>`apps/biotope/lib/modules/m5a_baselines/impl/metric_series_service.dart` |
| 138 | Community 164 | 13 | 12 | 0 | 1 | deco_flower_cluster_blush.md · deco_flower_cluster_white Review · deco_flower_cluster_blush.md · deco_flower_cluster_white.md | `docs/biotope/ui/ai-assets/reviews/deco_flower_cluster_white.md`<br/>`docs/biotope/ui/ai-assets/reviews/deco_flower_cluster_blush.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_flower_cluster_blush.md` |
| 139 | Community 166 | 13 | 15 | 12 | 0 | index.ts · _assert.ts · _assert.typetest.ts · AssertExact | `shared/rules/index.ts`<br/>`shared/rules/_assert.ts`<br/>`shared/rules/rule.ts` |
| 140 | Community 168 | 13 | 12 | 0 | 0 | Run-2 U9 · Human verdict override + nao claims curation (O13, DEMO-CR… · What ships · 1 · Migration `20260724150000_create_o13_edge_human_verdicts.sql` · 2 · Migration `20260724150001_o13_verified_edges_human_overlay.sql` | `docs/sessions/20260724T150900Z-agentjwork-claude-run2-u9-claims-human-verdict.md` |
| 141 | Community 159 | 13 | 12 | 0 | 0 | shared/SHARED-CONTEXT.md — Ourobion Shared Contract · BaselineSnapshot · DailyEnvRow · DailyGutRow | `shared/SHARED-CONTEXT.md` |
| 142 | Insight Rules Engine Two-Tier | 13 | 12 | 0 | 0 | O24-O29 Locked Six-Unit Product-Only Run 3 Tranche · B-BR1 Real Attested Decorrelated Verifier · B-DATA1 Simulated Loader Raw-Truth Corruption Risk · B-DATA2 Pipeline Idempotency Demand Semantics and Atomic Publication | `docs/temp/run3/pending-build-register.md` |
| 143 | Community 173 | 13 | 23 | 0 | 0 | shared_memory.mjs · main() · loadDb() · cmdClaim() | `tools/shared_memory.mjs` |
| 144 | Community 174 | 12 | 11 | 0 | 0 | Biotope AI Asset Style Guide · Accepted Botanical Direction · Accepted Material Language · Accepted Robot-Hand Direction | `docs/biotope/ui/ai-assets/asset-style-guide.md` |
| 145 | Community 175 | 12 | 14 | 0 | 2 | GetCommandLineArguments() · wWinMain() · Utf8FromUtf16() · utils.cpp | `apps/biotope/windows/runner/utils.cpp`<br/>`apps/biotope/windows/runner/main.cpp`<br/>`apps/biotope/windows/runner/utils.h` |
| 146 | Community 177 | 12 | 11 | 7 | 0 | edge_table_schema.test.ts · relationKindSchema · verdictSchema · verificationStatusSchema | `tools/edge-loader/tests/edge_table_schema.test.ts`<br/>`shared/brain/relationships.schema.ts` |
| 147 | Community 179 | 12 | 11 | 0 | 0 | Citation extraction & reference-graph construction — architecture dec… · Options considered · 0001-citation-extraction.md · Context (what doc-12 leaves open, why it matters) | `docs/shared/decisions/0001-citation-extraction.md` |
| 148 | Documentation Navigation | 12 | 11 | 0 | 1 | Documentation Index · Generated Active Documentation Map · AI Agent Navigation Protocol · Archive Exclusion from Agent Crawl | `docs/INDEX.md` |
| 149 | Community 180 | 12 | 18 | 3 | 0 | load_edges.mjs · main() · loadIntoDb() · parseArgs() | `tools/edge-loader/load_edges.mjs` |
| 150 | Community 184 | 12 | 11 | 0 | 0 | m1-context.md — M1: Core Platform & Compliance · Consent Scopes · Current State · Database Tables Owned | `apps/biotope/lib/modules/m1_core/m1-context.md` |
| 152 | Community 187 | 12 | 11 | 0 | 0 | The Brain — Design · The safeguard — a second, independent, adversarial verifier · Alternatives considered · brain-synthesis-design.md | `docs/nao/brain-synthesis-design.md` |
| 153 | Community 188 | 12 | 11 | 0 | 1 | archive_herbarium_specimen · archive_preserved_flower_fragment · archive_herbarium_specimen.md · archive_preserved_flower_fragment.md | `docs/biotope/ui/ai-assets/reviews/archive_herbarium_specimen.md`<br/>`docs/biotope/ui/ai-assets/reviews/archive_preserved_flower_fragment.md` |
| 154 | Community 189 | 12 | 11 | 0 | 1 | deco_leaf_brass_node Review · deco_small_biomech_bloom Review · deco_leaf_brass_node.md · deco_small_biomech_bloom.md | `docs/biotope/ui/ai-assets/reviews/deco_leaf_brass_node.md`<br/>`docs/biotope/ui/ai-assets/reviews/deco_small_biomech_bloom.md` |
| 155 | Community 190 | 12 | 13 | 0 | 0 | demo-dryrun-run2.ps1 · Add-Result() · Invoke-Api() · Invoke-Nao() | `scripts/demo-dryrun-run2.ps1` |
| 156 | Community 192 | 12 | 11 | 0 | 0 | Run-2 U10 · Manual seed-load from nao, seeds-as-data (O14, DEMO-CRITI… · What ships · 1 · Migration `20260724152525_create_o14_ingestion_seeds.sql` · 2 · Pipeline consumption — `tools/brain-ingest/src/seeder/dbSeeds.ts` | `docs/sessions/20260724T152525Z-agentjwork-claude-run2-u10-seeds-as-data.md` |
| 157 | Community 193 | 12 | 11 | 0 | 0 | Part A — decorrelated full-loop simulation (H1) · Run-2 U13 · Decorrelated full-loop simulation (H1) + baseline-confide… · `router.config.json` — restored, proof · 20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md | `docs/sessions/20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md` |
| 158 | Community 194 | 12 | 11 | 0 | 0 | compilerOptions · tsconfig.json · esModuleInterop · exclude | `shared/tsconfig.json` |
| 159 | Community 195 | 12 | 18 | 9 | 0 | config.ts · inspectConfig() · loadConfig() · readEnv() | `tools/brain-ingest/src/config.ts`<br/>`tools/brain-ingest/src/types.ts` |
| 160 | Community 196 | 12 | 21 | 16 | 0 | artifact.ts · appendVerificationsToDir() · VerifyRecord · appendVerificationsToR2() | `tools/brain-ingest/src/verify/artifact.ts`<br/>`tools/brain-ingest/src/verify/types.ts`<br/>`tools/brain-ingest/src/verify/verifier.ts` |
| 161 | Community 199 | 11 | 10 | 9 | 0 | metrics_registry_engine_test.dart · dart:convert · insight_card_roundtrip_test.dart · metric_series_model_test.dart | `apps/biotope/test/guards/metrics_registry_engine_test.dart`<br/>`apps/biotope/test/m5a_baselines/metric_series_model_test.dart`<br/>`apps/biotope/test/shared_types/insight_card_roundtrip_test.dart` |
| 162 | Run 3 Product Remediation Tranche | 11 | 10 | 0 | 1 | Run 3 Product Remediation Tranche · Adversarial Verification · O29 Live Verifier Attestation · Zebra NLI Shadow v0 | `docs/temp/run3/pending-build-register.md`<br/>`docs/shared/hackathon/hackathon-direction.md`<br/>`docs/temp/model-training/zebra-nli-shadow-v0-training-plan.md` |
| 164 | Community 205 | 11 | 14 | 0 | 8 | Botanical-Luxury Visual Language · Chroma-Key Alpha Workflow · Archive Report Thumbnail Base · Herbarium Archive Cover | `docs/biotope/ui/ai-assets/prompts/archive_report_thumbnail_base.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_flower_cluster_blush.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_vine_corner_left.md` |
| 165 | Community 206 | 11 | 10 | 7 | 0 | Record-only audit run · 2. Resume protocol (what makes a killed session cheap) · 0. Ground rules (non-negotiable) · 1. Scaffold (unit AU0) | `.claude/skills/record-only-audit/SKILL.md` |
| 166 | Community 208 | 11 | 10 | 11 | 0 | rules_table_schema.test.ts · CONDITION_TYPES · ruleProvenanceTierSchema · ruleScopeSchema | `tools/rules/tests/rules_table_schema.test.ts`<br/>`shared/rules/rule.schema.ts` |
| 167 | Community 210 | 11 | 21 | 25 | 3 | publish-status.ts · resolveRepoPath() · repoRoot() · smoke-openai.ts | `tools/llm-router/scripts/publish-status.ts`<br/>`tools/llm-router/scripts/smoke-openai.ts`<br/>`tools/llm-router/src/config.ts` |
| 168 | Community 211 | 11 | 10 | 0 | 0 | What shipped · Run-2 U6 · Simulated health-data loader in nao (O11, DEMO-CRITICAL) +… · 20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md · Decisions made autonomously (for review) | `docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 169 | Community 212 | 11 | 10 | 0 | 0 | What was built · Run-2 U8 · Model-config + spend read boundaries + editable caps + nao… · 1 · Migration `supabase/migrations/20260724130000_create_o10_llm_rout… · 2 · Publisher (router side) | `docs/sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md` |
| 170 | Community 213 | 11 | 11 | 0 | 1 | Commit Message Format · Commit message guidelines · AI routing and review protocol · Development workflow | `docs/shared/commit-conventions.md`<br/>`docs/shared/agent-protocol.md`<br/>`docs/shared/dev-workflow.md` |
| 171 | Community 215 | 11 | 10 | 0 | 0 | project-context.md — Ourobion · Module Map · Phases · Product Principles (Non-Negotiable) | `docs/shared/project-context.md` |
| 172 | Community 216 | 11 | 10 | 0 | 0 | index.ts · BaselineSnapshot · DailyEnvRow · DailyGutRow | `shared/types/index.ts` |
| 173 | Community 217 | 11 | 10 | 0 | 0 | manifest.json · background_color · description · display | `apps/biotope/web/manifest.json` |
| 174 | Paper Search Filters | 10 | 11 | 8 | 0 | Facets.tsx · facets.ts · ActiveChips.tsx · FacetBucket | `apps/nao/src/lib/facets.ts`<br/>`apps/nao/src/components/ActiveChips.tsx`<br/>`apps/nao/src/components/Facets.tsx` |
| 175 | Community 221 | 10 | 9 | 0 | 0 | S4 robust median MAD baseline · S5 pairwise personal co-movement · deterministic serve detectors · Anomaly and Personal-Signal Definition | `docs/shared/decisions/0002-anomaly-definition.md` |
| 176 | Community 225 | 10 | 9 | 0 | 0 | Prompt Lessons · Background Mode Lessons · Batch 1 Lessons · Botanical Realism Lessons | `docs/biotope/ui/ai-assets/lessons/prompt-lessons.md` |
| 177 | Community 226 | 10 | 11 | 7 | 0 | load_rules.test.ts · contentHash() · flattenRule() · canonicalJson() | `tools/rules/tests/load_rules.test.ts`<br/>`tools/rules/lib/blueprints.mjs` |
| 178 | Community 228 | 10 | 9 | 5 | 0 | Windows Toolchain Gotchas · Self-Contained Build Agent Dispatch Brief · Bookkeeping and Return Contract · Dispatch Environment and Scope Contract | `.claude/skills/windows-toolchain-gotchas/SKILL.md`<br/>`.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md` |
| 179 | Community 229 | 10 | 11 | 2 | 0 | Stacked Pull Request Chain · Phase-2 Reverse-Cascade Incident · Bottom-Up Merge Procedure · GitHub Branch-Base Contract | `.claude/skills/stacked-pr-chain/SKILL.md`<br/>`.claude/skills/stacked-pr-chain/references/phase2-reverse-cascade.md`<br/>`.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 180 | Community 232 | 10 | 9 | 0 | 0 | Run-2 U4 · Card semantics + gap ledger (O16 + O18 + the gap_ledger sl… · What changed · 20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md · Divergences / judgment calls (recorded) | `docs/sessions/20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md` |
| 181 | Community 233 | 10 | 9 | 0 | 0 | Run-2 U5 · Serve-pipeline trigger + provenance read + baseline prune … · What changed · 20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md · Divergences / judgment calls (recorded) | `docs/sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md` |
| 182 | Community 234 | 10 | 9 | 0 | 0 | Run-2 U12 · Scripted E2E demo dry-run + reproducible demo runbook (fi… · 20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md · Biotope visual check (Android emulator; Windows desktop honestly bloc… · Decisions made autonomously (for review) | `docs/sessions/20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md` |
| 183 | Claim Synthesis Pipeline | 10 | 18 | 19 | 0 | artifact.ts · appendClaimsToDir() · appendClaimsToR2() · dedupeAgainst() | `tools/brain-ingest/src/synth/artifact.ts` |
| 151 | User Consent and Metrics Models | 9 | 8 | 3 | 0 | consent_service.dart · ../../models/consent_record.dart · _client · ConsentService | `apps/biotope/lib/modules/m1_core/impl/consent_service.dart` |
| 163 | User Consent and Metrics Models | 9 | 11 | 9 | 0 | directOa.test.ts · directOa.ts · fetchBestOaUrl() · looksLikePdf() | `tools/brain-ingest/tests/directOa.test.ts`<br/>`tools/brain-ingest/src/retrieval/directOa.ts` |
| 184 | Community 237 | 9 | 8 | 1 | 0 | Part B — The manual layer, rebuilt by tier · B1. Tier 1 — Daily Core (the sticky spine: two ~30s micro-checks) · B2. Tier 2 — Daily Optional / Rotating (opt-in, or app samples a few … · B3. Tier 3 — Event-Triggered (log at the moment via quick-action/widg… | `docs/biotope/metrics-catalog.md` |
| 185 | render graph view mjs | 9 | 8 | 0 | 0 | generate_graph_view.mjs · DEFAULT_INPUT · DEFAULT_OUTPUT · normalizeNewlines() | `tools/graph-view/generate_graph_view.mjs` |
| 186 | Community 243 | 9 | 13 | 5 | 0 | load_rules.mjs · buildRows() · loadIntoDb() · main() | `tools/rules/load_rules.mjs`<br/>`tools/rules/lib/blueprints.mjs` |
| 187 | Community 246 | 9 | 8 | 0 | 0 | Orchestrate a build run · 1. Roles · 2. Startup checklist (fresh orchestrator session) · 3. Assessment before dispatch | `.claude/skills/orchestrate-build-run/SKILL.md` |
| 188 | Community 247 | 9 | 8 | 0 | 1 | profile_signature_flower.md · profile_porcelain_camellia.md · Background Mode · Flutter Usage | `docs/biotope/ui/ai-assets/reviews/profile_signature_flower.md`<br/>`docs/biotope/ui/ai-assets/prompts/profile_porcelain_camellia.md`<br/>`docs/biotope/ui/ai-assets/prompts/profile_signature_flower.md` |
| 189 | Community 248 | 9 | 8 | 0 | 0 | graphify reference: extra exports and benchmark · exports.md · Step 6b - Wiki (only if --wiki flag) · Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag) | `.claude/skills/graphify/references/exports.md` |
| 190 | Community 250 | 9 | 8 | 0 | 0 | Session 20260716T042500Z — agentjwork — claude — a8-synthesis · 20260716T042500Z-agentjwork-claude-a8-synthesis.md · Attempted · Blockers | `docs/sessions/20260716T042500Z-agentjwork-claude-a8-synthesis.md` |
| 191 | Community 251 | 9 | 8 | 0 | 0 | Session 20260718T050856Z — agentjwork — claude — u24-loader-hardening · 20260718T050856Z-agentjwork-claude-u24-loader-hardening.md · Attempted · Blockers | `docs/sessions/20260718T050856Z-agentjwork-claude-u24-loader-hardening.md` |
| 192 | Community 252 | 9 | 8 | 0 | 0 | Session 20260718T051721Z — agentjwork — claude — u25-db-constraint-hy… · 20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md · Attempted · Blockers | `docs/sessions/20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md` |
| 193 | Community 253 | 9 | 8 | 0 | 0 | run-pipeline edge function · baseline snapshot lifecycle · get_insight_provenance RPC · InsightProvenanceScreen | `docs/sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md`<br/>`docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md`<br/>`docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 194 | Community 254 | 9 | 8 | 0 | 0 | Run-2 U7 · biotope trend view + insight provenance view (O12 app side… · What shipped · 20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md · Decisions made autonomously (for review) | `docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md` |
| 195 | Community 255 | 9 | 8 | 0 | 0 | agent-protocol.md — AI Agent Navigation Protocol · agent-protocol.md · Branch and PR Conventions · How to Use This File | `docs/shared/agent-protocol.md` |
| 197 | Community 256 | 8 | 7 | 5 | 0 | metrics-catalog.md · Part G — Summary counts · Metrics Catalog — Candidate Metrics, Reorganized Around a Logging Bud… · Manual layer (`L-1 … L-110`) — re-tiered by logging budget | `docs/biotope/metrics-catalog.md` |
| 198 | TypeScript Config | 8 | 7 | 0 | 0 | Metrics Registry · `MetricDefinition` fields · Add a metric (safe flow) · Guard couplings | `shared/metrics/README.md`<br/>`docs/biotope/metrics-registry-design.md` |
| 199 | Community 258 | 8 | 8 | 0 | 0 | claimCites mapping · format-routed citation pipeline · reference graph · GROBID PDF sidecar | `docs/shared/decisions/0001-citation-extraction.md` |
| 200 | Community 259 | 8 | 10 | 0 | 2 | Linux Desktop Relocatable Bundle · Linux Flutter Engine Build · Linux Runner Target · Windows Desktop In-Place Bundle | `apps/biotope/linux/CMakeLists.txt`<br/>`apps/biotope/windows/CMakeLists.txt`<br/>`apps/biotope/linux/flutter/CMakeLists.txt` |
| 201 | Community 260 | 8 | 7 | 8 | 0 | engine_cards_schema.test.ts · REPO_ROOT · ruleCategorySchema · PRODUCERS | `tools/rules/tests/engine_cards_schema.test.ts`<br/>`shared/rules/rule.schema.ts`<br/>`supabase/functions/generate-insights/render.ts` |
| 202 | Community 261 | 8 | 7 | 0 | 0 | Checklist · PULL_REQUEST_TEMPLATE.md · Changes · Code | `.github/PULL_REQUEST_TEMPLATE.md` |
| 203 | Community 263 | 8 | 7 | 4 | 0 | insight_card_model_test.dart · insight_service_expiry_test.dart · package:src/modules/m5b_insight_engine/impl/insight_service.dart · _edgeRowJson | `apps/biotope/test/m5b_insight_engine/insight_card_model_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/insight_service_expiry_test.dart` |
| 204 | Community 264 | 8 | 7 | 0 | 0 | The four run tracking docs · 1. `&lt;run-slug&gt;-orchestration-log.md` — the resume point · 2. `&lt;run-slug&gt;-blocked-register.md` — human-gated items (B-entr… · 3. `&lt;run-slug&gt;-signoff-decisions.md` — judgment calls (D-entrie… | `.claude/skills/orchestrate-build-run/references/tracking-docs.md` |
| 205 | Community 266 | 8 | 7 | 0 | 0 | gen-env.mjs · appRoot · here · p() | `apps/nao/scripts/gen-env.mjs` |
| 206 | Community 267 | 8 | 7 | 0 | 0 | Session 20260608T045610Z — uandiqueue — claude — context-system-boots… · 20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md · Addendum — branch integration (same session) · Attempted | `docs/sessions/20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md` |
| 207 | Community 268 | 8 | 7 | 0 | 0 | Session 20260608T071424Z — uandiqueue — claude — windows-native-toolc… · 20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md · Attempted · Blockers / notes | `docs/sessions/20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md` |
| 208 | Community 269 | 8 | 7 | 0 | 0 | Session 20260609T021240Z — uandiqueue — claude — next-phase-plan · 20260609T021240Z-uandiqueue-claude-next-phase-plan.md · Addendum — scope generalized + Phase 0 added (same session) · Attempted | `docs/sessions/20260609T021240Z-uandiqueue-claude-next-phase-plan.md` |
| 209 | Community 270 | 8 | 7 | 0 | 0 | Session 20260610T021136Z — uandiqueue — claude — local-test-seeder · 20260610T021136Z-uandiqueue-claude-local-test-seeder.md · Addendum — integration target changed main → dev-phase2 (same session) · Attempted | `docs/sessions/20260610T021136Z-uandiqueue-claude-local-test-seeder.md` |
| 210 | Community 271 | 8 | 7 | 0 | 0 | Session 20260629T054330Z — agentjwork — claude — brain-ingest-pipeline · 20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md · Attempted · Blockers | `docs/sessions/20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md` |
| 211 | Community 272 | 8 | 7 | 0 | 0 | Session 20260630T065703Z — agentjwork — claude — apps-monorepo-layout · 20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md · Attempted · Blockers | `docs/sessions/20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md` |
| 212 | Community 273 | 8 | 7 | 0 | 0 | Session 20260630T132112Z — agentjwork — claude — nao-v1-corpus-dashbo… · 20260630T132112Z-agentjwork-claude-nao-v1-corpus-dashboard.md · Attempted · Blockers | `docs/sessions/20260630T132112Z-agentjwork-claude-nao-v1-corpus-dashboard.md` |
| 213 | Community 274 | 8 | 7 | 0 | 0 | Session 20260630T155323Z — agentjwork — claude — nao-design-implement… · 20260630T155323Z-agentjwork-claude-nao-design-implementation.md · Attempted · Blockers | `docs/sessions/20260630T155323Z-agentjwork-claude-nao-design-implementation.md` |
| 214 | Community 275 | 8 | 7 | 0 | 0 | Session 20260701T064546Z — agentjwork — claude — phase2-plan-rewrite · 20260701T064546Z-agentjwork-claude-phase2-plan-rewrite.md · Addendum — demo scope: drop PDPA/privacy; expand nao; flag stale arti… · Attempted | `docs/sessions/20260701T064546Z-agentjwork-claude-phase2-plan-rewrite.md` |
| 215 | Community 276 | 8 | 7 | 0 | 0 | Session 20260716T035351Z — agentjwork — claude — agentic-seeder · 20260716T035351Z-agentjwork-claude-agentic-seeder.md · Attempted · Blockers | `docs/sessions/20260716T035351Z-agentjwork-claude-agentic-seeder.md` |
| 216 | Community 277 | 8 | 7 | 0 | 0 | Session 20260716T044929Z — agentjwork — claude — a10-verifier-scaffold · 20260716T044929Z-agentjwork-claude-a10-verifier-scaffold.md · Attempted · Blockers | `docs/sessions/20260716T044929Z-agentjwork-claude-a10-verifier-scaffold.md` |
| 217 | Community 278 | 8 | 7 | 0 | 0 | Session 20260716T060410Z — agentjwork — claude — l6-one-card-slice · 20260716T060410Z-agentjwork-claude-l6-one-card-slice.md · Attempted · Blockers | `docs/sessions/20260716T060410Z-agentjwork-claude-l6-one-card-slice.md` |
| 218 | Community 279 | 8 | 7 | 0 | 0 | Session 20260716T061453Z — agentjwork — claude — ci-node-tool-suites · 20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md · Attempted · Blockers | `docs/sessions/20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md` |
| 219 | Community 280 | 8 | 7 | 0 | 0 | Session 20260718T035658Z — agentjwork — claude — u19-brain-safeguard-… · 20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md · Attempted · Blockers | `docs/sessions/20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md` |
| 220 | Community 281 | 8 | 7 | 0 | 0 | Session 20260718T041457Z — agentjwork — claude — u20-insight-card-cat… · 20260718T041457Z-agentjwork-claude-u20-insight-card-catchup.md · Attempted · Blockers | `docs/sessions/20260718T041457Z-agentjwork-claude-u20-insight-card-catchup.md` |
| 221 | Community 282 | 8 | 7 | 0 | 0 | Session 20260718T045102Z — agentjwork — claude — u21-relationship-car… · 20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.… · Attempted · Blockers | `docs/sessions/20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.md` |
| 222 | Community 283 | 8 | 7 | 0 | 0 | Session 20260718T053625Z — agentjwork — claude — u26-budget-ledger-li… · 20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md · Attempted · Blockers | `docs/sessions/20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md` |
| 223 | Community 284 | 8 | 7 | 0 | 0 | Session 20260718T055159Z — agentjwork — claude — u27-ci-deno-migratio… · 20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md · Attempted · Blockers | `docs/sessions/20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md` |
| 224 | Community 285 | 8 | 7 | 0 | 0 | Session 20260718T061213Z — agentjwork — claude — u28-nit-sweep · 20260718T061213Z-agentjwork-claude-u28-nit-sweep.md · Attempted · Blockers | `docs/sessions/20260718T061213Z-agentjwork-claude-u28-nit-sweep.md` |
| 225 | Community 286 | 8 | 7 | 0 | 0 | Session 20260718T160053Z — agentjwork — claude — u29-deno-client-types · 20260718T160053Z-agentjwork-claude-u29-deno-client-types.md · Attempted · Blockers | `docs/sessions/20260718T160053Z-agentjwork-claude-u29-deno-client-types.md` |
| 226 | Community 287 | 8 | 7 | 0 | 0 | Session: Run 2.0 · U0 bootstrap (orchestrator) · 20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md · Assessment synthesis + worklist finalization (same session, second co… · Mid-run input from Jayden + U2 closed (orchestrator, same session) | `docs/sessions/20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md` |
| 227 | Community 288 | 8 | 7 | 0 | 0 | Run 2.0 U2 — ground the adversarial verifier (O15 / verdict B1) · 20260724T074529Z-agentjwork-claude-run2-u2-verifier-grounding.md · Acceptance test (i) · Context | `docs/sessions/20260724T074529Z-agentjwork-claude-run2-u2-verifier-grounding.md` |
| 228 | Community 289 | 8 | 7 | 0 | 0 | Run-2 independent adversarial sign-off audit and Run-3 scope lock · 20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md · Attempted · Blockers | `docs/sessions/20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md` |
| 230 | Community 292 | 8 | 7 | 0 | 0 | Windows toolchain gotchas — the recurring traps on this repo · 1. node/flutter are NOT on the base PATH · 2. Generated-plugin churn (phantom modified files) · 3. Write-tool NUL bytes (binary-looking files) | `.claude/skills/windows-toolchain-gotchas/SKILL.md` |
| 231 | Community 293 | 7 | 6 | 0 | 1 | Biomech-botanical Asset Style · Asset Acceptance Workflow · Background Mode Prompting · Biotope Design Tokens | `docs/biotope/ui/ai-assets/asset-style-guide.md`<br/>`docs/biotope/ui/ai-assets/lessons/prompt-lessons.md`<br/>`docs/biotope/ui/ai-assets/lessons/rejected-assets.md` |
| 232 | Community 294 | 7 | 6 | 1 | 0 | Part A — Operating principles · A1. The three economies · A2. The three levers that decide every manual metric · A3. The tier ladder | `docs/biotope/metrics-catalog.md` |
| 233 | Community 295 | 7 | 6 | 1 | 0 | Part D — SG/MY localization deep-dive · D-i. Diet capture kit (replaces gram-level logging) · D-ii. Hydration without asking volume · D-iii. Climate & exposome priorities | `docs/biotope/metrics-catalog.md` |
| 234 | Community 296 | 7 | 6 | 0 | 0 | copy_guidelines.dart · _forbiddenWordPattern · allowedPhrases · CopyRules | `shared/constants/copy_guidelines.dart` |
| 235 | Community 297 | 7 | 7 | 2 | 0 | copy_guidelines.test.ts · copy_guidelines.ts · COPY_RULES · forbiddenWordPattern() | `shared/constants/copy_guidelines.ts`<br/>`tools/rules/tests/copy_guidelines.test.ts` |
| 236 | Community 204 | 7 | 8 | 3 | 0 | githubDispatch.ts · dispatchIngestWorkflow() · githubDispatch.test.ts · requiredEnv() | `apps/nao/src/lib/githubDispatch.ts`<br/>`apps/nao/tests/githubDispatch.test.ts` |
| 237 | Community 302 | 7 | 6 | 3 | 0 | provenance_model_test.dart · package:src/modules/m5b_insight_engine/impl/provenance_models.dart · _edgeCardJson · _json | `apps/biotope/test/m5b_insight_engine/provenance_model_test.dart` |
| 238 | Community 158 | 7 | 6 | 0 | 1 | nao Research Operations Dashboard · Evidence-tiered Verified Relationship Graph · Ourobion · zebra-nli-shadow-v0 | `apps/nao/README.md`<br/>`docs/temp/model-training/README.md`<br/>`README.md` |
| 239 | Community 303 | 7 | 6 | 0 | 0 | _ · AuthResult · errorMessage · failure | `apps/biotope/lib/modules/m1_core/models/auth_result.dart` |
| 240 | Community 304 | 7 | 6 | 0 | 0 | deco_vine_corner_right.md · Background Mode · deco_vine_corner_right · deco_vine_corner_right.md | `docs/biotope/ui/ai-assets/reviews/deco_vine_corner_right.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_vine_corner_right.md` |
| 241 | Community 305 | 7 | 6 | 0 | 0 | empty_archive_specimen.md · Background Mode · empty_archive_specimen · empty_archive_specimen.md | `docs/biotope/ui/ai-assets/reviews/empty_archive_specimen.md`<br/>`docs/biotope/ui/ai-assets/prompts/empty_archive_specimen.md` |
| 242 | Community 306 | 7 | 6 | 0 | 0 | empty_notifications_flower.md · Background Mode · empty_notifications_flower · empty_notifications_flower.md | `docs/biotope/ui/ai-assets/reviews/empty_notifications_flower.md`<br/>`docs/biotope/ui/ai-assets/prompts/empty_notifications_flower.md` |
| 243 | Community 307 | 7 | 6 | 0 | 0 | Where audit findings cluster in this repo · 1. The "shared schema is the only gate on foreign inputs" seam · 2. Contract-vs-reality drift on app-facing surfaces · 3. Projection lifecycle — rows that only ever accumulate, or vanish w… | `.claude/skills/record-only-audit/references/finding-hotspots.md` |
| 244 | Community 308 | 7 | 6 | 0 | 1 | Insights Neural Botanical Cluster · Fits Well · Flutter Usage · Insights Branching System | `docs/biotope/ui/ai-assets/reviews/insights_neural_botanical_cluster.md`<br/>`docs/biotope/ui/ai-assets/reviews/insights_branching_node_system.md` |
| 245 | Community 309 | 7 | 6 | 0 | 1 | scan_circular_bloom · Fits Well · Flutter Usage · Scan Biomechanical Orchid | `docs/biotope/ui/ai-assets/reviews/scan_circular_bloom.md`<br/>`docs/biotope/ui/ai-assets/reviews/scan_biomech_orchid.md` |
| 246 | Community 312 | 7 | 6 | 0 | 0 | Session 20260601T000000Z — uandiqueue — team — historical-backfill · 20260601T000000Z-uandiqueue-team-historical-backfill.md · Attempted · Blockers / notes | `docs/sessions/20260601T000000Z-uandiqueue-team-historical-backfill.md` |
| 247 | Community 313 | 7 | 6 | 0 | 0 | Session 20260610T035536Z — uandiqueue — claude — pr-target-dev-phase2… · 20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md · Attempted · Blockers | `docs/sessions/20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md` |
| 248 | Community 314 | 7 | 6 | 0 | 0 | Session 20260610T042206Z — uandiqueue — claude — consolidate-onto-dev… · 20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md · Attempted · Blockers | `docs/sessions/20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md` |
| 249 | Community 315 | 7 | 6 | 0 | 0 | Session 20260611T070148Z — uandiqueue — claude — phase2-goals-feature… · 20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md · Attempted · Blockers | `docs/sessions/20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md` |
| 250 | Community 316 | 7 | 6 | 0 | 0 | Session 20260611T073034Z — uandiqueue — claude — docs-cleanup-stale-r… · 20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md · Attempted · Blockers | `docs/sessions/20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md` |
| 251 | Community 317 | 7 | 6 | 0 | 0 | Session 20260611T084236Z — uandiqueue — claude — phase2-integrated-pl… · 20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md · Attempted · Blockers | `docs/sessions/20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md` |
| 252 | Community 318 | 7 | 6 | 0 | 0 | Session 20260617T062023Z — uandiqueue — claude — graphify-hook-and-do… · 20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md · Attempted · Blockers | `docs/sessions/20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md` |
| 253 | Community 319 | 7 | 6 | 0 | 0 | Session 20260617T071616Z — uandiqueue — claude — graphify-prewire-cod… · 20260617T071616Z-uandiqueue-claude-graphify-prewire-codex-gemini.md · Attempted · Blockers | `docs/sessions/20260617T071616Z-uandiqueue-claude-graphify-prewire-codex-gemini.md` |
| 254 | Community 320 | 7 | 6 | 0 | 0 | Session 20260618T092022Z — uandiqueue — claude — graphify-claude-skill · 20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md · Attempted · Blockers | `docs/sessions/20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md` |
| 255 | Community 321 | 7 | 6 | 0 | 0 | Session 20260618T094117Z — uandiqueue — claude — readme-context-engin… · 20260618T094117Z-uandiqueue-claude-readme-context-engineering.md · Attempted · Blockers | `docs/sessions/20260618T094117Z-uandiqueue-claude-readme-context-engineering.md` |
| 256 | Community 322 | 7 | 6 | 0 | 0 | Session 20260618T094429Z — uandiqueue — claude — wikilinks-to-markdown · 20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md · Attempted · Blockers | `docs/sessions/20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md` |
| 257 | Community 323 | 7 | 6 | 0 | 0 | Session 20260619T020858Z — uandiqueue — claude — commit-metrics-regis… · 20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md · Attempted · Blockers | `docs/sessions/20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md` |
| 258 | Community 324 | 7 | 6 | 0 | 0 | Session 20260619T060221Z — uandiqueue — claude — metrics-registry-sha… · 20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md · Attempted · Blockers | `docs/sessions/20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md` |
| 259 | Community 325 | 7 | 6 | 0 | 0 | Session 20260620T161931Z — uandiqueue — claude — phase2-replan-metric… · 20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md · Attempted · Blockers | `docs/sessions/20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md` |
| 260 | Community 326 | 7 | 6 | 0 | 0 | Session 20260622T021945Z — uandiqueue — claude — w0-metric-platform-f… · 20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md · Attempted · Blockers | `docs/sessions/20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md` |
| 261 | Community 327 | 7 | 6 | 0 | 0 | Session 20260625T030745Z — uandiqueue — claude — brain-relationship-c… · 20260625T030745Z-uandiqueue-claude-brain-relationship-contract.md · Attempted · Blockers | `docs/sessions/20260625T030745Z-uandiqueue-claude-brain-relationship-contract.md` |
| 262 | Community 328 | 7 | 6 | 0 | 0 | Session 20260625T041011Z — uandiqueue — claude — rebrand-ourobion · 20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md · Attempted · Blockers | `docs/sessions/20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md` |
| 263 | Community 329 | 7 | 6 | 0 | 0 | Session 20260629T152720Z — agentjwork — claude — docs-feature-folders · 20260629T152720Z-agentjwork-claude-docs-feature-folders.md · Attempted · Blockers | `docs/sessions/20260629T152720Z-agentjwork-claude-docs-feature-folders.md` |
| 264 | Community 330 | 7 | 6 | 0 | 0 | Session 20260630T050141Z — agentjwork — claude — nao-design-doc · 20260630T050141Z-agentjwork-claude-nao-design-doc.md · Attempted · Blockers | `docs/sessions/20260630T050141Z-agentjwork-claude-nao-design-doc.md` |
| 265 | Community 331 | 7 | 6 | 0 | 0 | Session 20260630T071429Z — agentjwork — claude — nao-research-brief · 20260630T071429Z-agentjwork-claude-nao-research-brief.md · Attempted · Blockers | `docs/sessions/20260630T071429Z-agentjwork-claude-nao-research-brief.md` |
| 266 | Community 332 | 7 | 6 | 0 | 0 | Session 20260630T075152Z — agentjwork — claude — nao-env-convention · 20260630T075152Z-agentjwork-claude-nao-env-convention.md · Attempted · Blockers | `docs/sessions/20260630T075152Z-agentjwork-claude-nao-env-convention.md` |
| 267 | Community 333 | 7 | 6 | 0 | 0 | Session 20260701T031916Z — agentjwork — claude — readme-restructure · 20260701T031916Z-agentjwork-claude-readme-restructure.md · Attempted · Blockers | `docs/sessions/20260701T031916Z-agentjwork-claude-readme-restructure.md` |
| 268 | Community 334 | 7 | 6 | 0 | 0 | Session 20260701T052316Z — agentjwork — claude — brain-pipeline-decis… · 20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md · Attempted · Blockers | `docs/sessions/20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md` |
| 269 | Community 335 | 7 | 6 | 0 | 0 | Session 20260701T061754Z — agentjwork — claude — phase2-integrated-pl… · 20260701T061754Z-agentjwork-claude-phase2-integrated-plan-update.md · Attempted · Blockers | `docs/sessions/20260701T061754Z-agentjwork-claude-phase2-integrated-plan-update.md` |
| 270 | Community 336 | 7 | 6 | 0 | 0 | Session 20260701T062951Z — agentjwork — claude — metric-100-decision-… · 20260701T062951Z-agentjwork-claude-metric-100-decision-consolidate.md · Attempted · Blockers | `docs/sessions/20260701T062951Z-agentjwork-claude-metric-100-decision-consolidate.md` |
| 271 | Community 337 | 7 | 6 | 0 | 0 | Session 20260701T080448Z — agentjwork — claude — demo-scope-propagate · 20260701T080448Z-agentjwork-claude-demo-scope-propagate.md · Attempted · Blockers | `docs/sessions/20260701T080448Z-agentjwork-claude-demo-scope-propagate.md` |
| 272 | Community 338 | 7 | 6 | 0 | 0 | Session 20260702T080203Z — altogennn — claude — m2-standing-water-aud… · 20260702T080203Z-altogennn-claude-m2-standing-water-audit.md · Attempted · Blockers | `docs/sessions/20260702T080203Z-altogennn-claude-m2-standing-water-audit.md` |
| 273 | Community 339 | 7 | 6 | 0 | 0 | Session 20260703T065307Z — agentjwork — claude — nao-corpus-run-plus-… · 20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md · Attempted · Blockers | `docs/sessions/20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md` |
| 274 | Community 340 | 7 | 6 | 0 | 0 | Session 20260708T164343Z — altogennn — claude — biotope-nao-link-refi… · 20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md · Attempted · Blockers | `docs/sessions/20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md` |
| 275 | Community 341 | 7 | 6 | 0 | 0 | Session 20260715T134326Z — agentjwork — claude — phase2-run-orchestra… · 20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap… · Attempted · Blockers | `docs/sessions/20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap.md` |
| 276 | Community 342 | 7 | 6 | 0 | 0 | Session 20260715T135541Z — agentjwork — claude — l0-contract-extension · 20260715T135541Z-agentjwork-claude-l0-contract-extension.md · Attempted · Blockers | `docs/sessions/20260715T135541Z-agentjwork-claude-l0-contract-extension.md` |
| 277 | Community 343 | 7 | 6 | 0 | 0 | Session 20260715T140420Z — agentjwork — claude — storage-primitives · 20260715T140420Z-agentjwork-claude-storage-primitives.md · Attempted · Blockers | `docs/sessions/20260715T140420Z-agentjwork-claude-storage-primitives.md` |
| 278 | Community 344 | 7 | 6 | 0 | 0 | Session 20260715T143750Z — agentjwork — claude — brain-llm-router · 20260715T143750Z-agentjwork-claude-brain-llm-router.md · Attempted · Blockers | `docs/sessions/20260715T143750Z-agentjwork-claude-brain-llm-router.md` |
| 279 | Community 345 | 7 | 6 | 0 | 0 | Session 20260715T145734Z — agentjwork — claude — quotecheck-venue-loo… · 20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md · Attempted · Blockers | `docs/sessions/20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md` |
| 280 | Community 346 | 7 | 6 | 0 | 0 | Session 20260715T152517Z — agentjwork — claude — rules-as-data · 20260715T152517Z-agentjwork-claude-rules-as-data.md · Attempted · Blockers | `docs/sessions/20260715T152517Z-agentjwork-claude-rules-as-data.md` |
| 281 | Community 347 | 7 | 6 | 0 | 0 | Session 20260715T153917Z — agentjwork — claude — s2-view-s3-baseline-… · 20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md · Attempted · Blockers | `docs/sessions/20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md` |
| 282 | Community 348 | 7 | 6 | 0 | 0 | Session 20260716T024359Z — agentjwork — claude — s4-signals-s5-evalua… · 20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md · Attempted · Blockers | `docs/sessions/20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md` |
| 283 | Community 349 | 7 | 6 | 0 | 0 | Session 20260716T031048Z — agentjwork — claude — s6-edge-store-a11-lo… · 20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md · Attempted · Blockers | `docs/sessions/20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md` |
| 284 | Community 350 | 7 | 6 | 0 | 0 | Session 20260716T050639Z — agentjwork — claude — s7-composer-s8-cards · 20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md · Attempted · Blockers | `docs/sessions/20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md` |
| 285 | Community 351 | 7 | 6 | 0 | 0 | Session 20260718T033750Z — agentjwork — claude — chain-recovery-docs-… · 20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md · Attempted · Blockers | `docs/sessions/20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md` |
| 286 | Community 352 | 7 | 6 | 0 | 0 | Session 20260718T043726Z — agentjwork — claude — u22-snooze-stale-sig… · 20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md · Attempted · Blockers | `docs/sessions/20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md` |
| 287 | Community 353 | 7 | 6 | 0 | 0 | Session 20260718T062214Z — agentjwork — claude — backend-test-plan-br… · 20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md · Attempted · Blockers | `docs/sessions/20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md` |
| 288 | Community 354 | 7 | 6 | 0 | 0 | Session 20260718T163741Z — agentjwork — claude — skills-run-procedures · 20260718T163741Z-agentjwork-claude-skills-run-procedures.md · Attempted · Blockers | `docs/sessions/20260718T163741Z-agentjwork-claude-skills-run-procedures.md` |
| 289 | Community 355 | 7 | 6 | 0 | 0 | Session 20260719T102011Z — agentjwork — claude — skills-generality-re… · 20260719T102011Z-agentjwork-claude-skills-generality-refactor.md · Attempted · Blockers | `docs/sessions/20260719T102011Z-agentjwork-claude-skills-generality-refactor.md` |
| 290 | Community 356 | 7 | 6 | 0 | 0 | Session 20260719T161537Z — agentjwork — claude — research-fixes-compo… · 20260719T161537Z-agentjwork-claude-research-fixes-composite-calibrati… · Attempted · Blockers | `docs/sessions/20260719T161537Z-agentjwork-claude-research-fixes-composite-calibration.md` |
| 291 | Community 357 | 7 | 6 | 0 | 0 | Session 20260720T040750Z — agentjwork — claude — research-fixes-commi… · 20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-rev… · Attempted · Blockers | `docs/sessions/20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-review.md` |
| 292 | Community 358 | 7 | 6 | 0 | 0 | Session 20260720T054702Z — agentjwork — claude — phase2-unit-signoff-… · 20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md · Attempted · Blockers | `docs/sessions/20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md` |
| 293 | Community 359 | 7 | 6 | 0 | 0 | What was done · Run 2.0 U3 — contract hardening (O17 + O20; verdict B3 + H3) · 20260724T080239Z-agentjwork-claude-run2-u3-contract-hardening.md · Gate summary (all green) | `docs/sessions/20260724T080239Z-agentjwork-claude-run2-u3-contract-hardening.md` |
| 294 | Community 360 | 7 | 6 | 0 | 0 | Run-2 U11 — gap surfacing in nao (O9 demo slice / feature (d)) · 20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md · Decisions made autonomously (for review) · Gates | `docs/sessions/20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md` |
| 295 | Community 363 | 7 | 6 | 0 | 0 | Stacked PR chains — run, merge, recover · Branch-cleanup safety · Recovery · SKILL.md | `.claude/skills/stacked-pr-chain/SKILL.md` |
| 296 | Community 235 | 7 | 6 | 0 | 0 | Documentation Readiness · Truth Hierarchy · B-PL20 Documentation and Agent Safety Work · B-PL21 Shared Contract Debt | `docs/temp/documentation-freshness-audit-2026-07-26.md` |
| 297 | Community 366 | 6 | 5 | 0 | 0 | Biotope AI Image Assets · Continuation Workflow · Flutter Usage · README.md | `docs/biotope/ui/ai-assets/README.md` |
| 299 | Community 374 | 6 | 5 | 3 | 0 | edge_human_verdicts.test.ts · REPO_ROOT · migrationsDir · migrationSql() | `tools/edge-loader/tests/edge_human_verdicts.test.ts`<br/>`tools/edge-loader/lib/artifacts.mjs` |
| 300 | Community 186 | 6 | 5 | 0 | 0 | Corpus as Durable Truth · Open-access Retrieval Pattern · paper_uid Identity Scheme · Resumable Ingest CLI | `docs/nao/brain-ingestion-design.md` |
| 301 | Community 381 | 6 | 5 | 0 | 0 | The Phase-2 reverse-cascade merge (2026-07-18) — the incident behind … · How the chain came to exist · Lessons encoded in the skill · phase2-reverse-cascade.md | `.claude/skills/stacked-pr-chain/references/phase2-reverse-cascade.md` |
| 302 | Community 382 | 6 | 5 | 0 | 0 | graphify reference: query, path, explain · For /graphify explain · For /graphify path · query.md | `.claude/skills/graphify/references/query.md` |
| 303 | Community 385 | 6 | 5 | 0 | 0 | archive_report_thumbnail_base · archive_report_thumbnail_base.md · Fits Well · Flutter Usage | `docs/biotope/ui/ai-assets/reviews/archive_report_thumbnail_base.md` |
| 304 | Community 386 | 6 | 5 | 0 | 0 | deco_vine_corner_left Review · Background Mode · deco_vine_corner_left.md · Flutter Usage | `docs/biotope/ui/ai-assets/reviews/deco_vine_corner_left.md` |
| 305 | Community 387 | 6 | 5 | 0 | 0 | empty_insights_seedpod Review · Background Mode · empty_insights_seedpod.md · Flutter Usage | `docs/biotope/ui/ai-assets/reviews/empty_insights_seedpod.md` |
| 306 | Community 388 | 6 | 5 | 0 | 0 | empty_scan_bloom Review · Background Mode · empty_scan_bloom.md · Flutter Usage | `docs/biotope/ui/ai-assets/reviews/empty_scan_bloom.md` |
| 307 | Community 389 | 6 | 5 | 0 | 0 | home_flower_cluster_card · Fits Well · Flutter Usage · home_flower_cluster_card.md | `docs/biotope/ui/ai-assets/reviews/home_flower_cluster_card.md` |
| 308 | Community 390 | 6 | 5 | 0 | 0 | home_hero_robot_hand_alt_01 · Fits Well · Flutter Usage · home_hero_robot_hand_alt_01.md | `docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_alt_01.md` |
| 309 | Community 391 | 6 | 5 | 0 | 0 | home_hero_robot_hand_main · Fits Well · Flutter Usage · home_hero_robot_hand_main.md | `docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_main.md` |
| 310 | Community 392 | 6 | 5 | 0 | 0 | insights_biomech_heart_bloom · Fits Well · Flutter Usage · insights_biomech_heart_bloom.md | `docs/biotope/ui/ai-assets/reviews/insights_biomech_heart_bloom.md` |
| 311 | Community 393 | 6 | 5 | 0 | 0 | insights_branching_node_system · Fits Well · Flutter Usage · insights_branching_node_system.md | `docs/biotope/ui/ai-assets/reviews/insights_branching_node_system.md` |
| 312 | Community 394 | 6 | 5 | 0 | 0 | profile_botanical_crest Review · Background Mode · Flutter Usage · profile_botanical_crest.md | `docs/biotope/ui/ai-assets/reviews/profile_botanical_crest.md` |
| 313 | Community 395 | 6 | 5 | 0 | 0 | profile_porcelain_camellia Review · Background Mode · Flutter Usage · profile_porcelain_camellia.md | `docs/biotope/ui/ai-assets/reviews/profile_porcelain_camellia.md` |
| 314 | Community 396 | 6 | 5 | 0 | 0 | scan_biomech_orchid · Fits Well · Flutter Usage · scan_biomech_orchid.md | `docs/biotope/ui/ai-assets/reviews/scan_biomech_orchid.md` |
| 315 | Community 397 | 6 | 5 | 0 | 0 | Scan Sensor Flower Closeup · Fits Well · Flutter Usage · scan_sensor_flower_closeup.md | `docs/biotope/ui/ai-assets/reviews/scan_sensor_flower_closeup.md` |
| 316 | Community 400 | 6 | 5 | 0 | 3 | Run 2 U0 bootstrap session · Run 2 U1 router OpenAI session · Run 2 U2 verifier grounding session · Run 2 U3 contract hardening session | `docs/sessions/20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md`<br/>`docs/sessions/20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md`<br/>`docs/sessions/20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md` |
| 317 | Community 401 | 6 | 5 | 0 | 0 | Session: Run 2.0 · U1 router OpenAI-only posture (TEST-MODE decorrela… · 20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md · Decisions taken inside the unit's mandate · Gate | `docs/sessions/20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md` |
| 318 | Community 402 | 6 | 5 | 0 | 0 | simulated health generator · planLoadRange · Run-2 U6 Nao Data Loader · loader API route | `docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 319 | Community 403 | 6 | 6 | 0 | 0 | ModelsPanel · llm router cap overrides · llm_router_spend projection · llm_router_status projection | `docs/sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md` |
| 320 | Community 404 | 6 | 5 | 0 | 0 | Project Context · One Health personal ecological health monitor · shared contract · graceful degradation | `docs/shared/project-context.md` |
| 321 | Community 406 | 6 | 5 | 0 | 0 | edge_loader_cli.test.ts · CLI · emptyMirror() · FIXTURES | `tools/edge-loader/tests/edge_loader_cli.test.ts` |
| 322 | Community 407 | 6 | 5 | 0 | 0 | verify.cli.integration.test.ts · CLAIMS · CORPUS · EVIDENCE_SNIPPETS | `tools/brain-ingest/tests/verify.cli.integration.test.ts` |
| 323 | Community 408 | 6 | 8 | 0 | 0 | setup_agent_worktree.mjs · main() · parseArgs() · runCmd() | `tools/setup_agent_worktree.mjs` |
| 324 | Community 409 | 5 | 4 | 0 | 0 | Ourobion Pull Request Checklist · Code Boundary and Copy Gate · dev-phase2 Target Gate · Session Context Gate | `.github/PULL_REQUEST_TEMPLATE.md` |
| 325 | Community 410 | 5 | 4 | 0 | 0 | layout.tsx · jetbrainsMono · metadata · outfit | `apps/nao/src/app/layout.tsx` |
| 326 | Community 411 | 5 | 4 | 0 | 0 | SceneDelegate.swift · SceneDelegate · Flutter · FlutterSceneDelegate | `apps/biotope/ios/Runner/SceneDelegate.swift` |
| 327 | Community 412 | 5 | 4 | 2 | 0 | C1. Auto-fetchable `E` (E-1 … E-100) · Part C — The passive layer (zero logging budget) · External APIs keyed to location + time (E-58 … E-100) — all collectib… · Phone sensors & OS signals (E-1 … E-30) | `docs/biotope/metrics-catalog.md` |
| 328 | Community 413 | 5 | 4 | 0 | 0 | Singapore-Malaysia Localization · Local Diet Capture Kit · Hydration Proxy · Metrics Catalog | `docs/biotope/metrics-catalog.md` |
| 329 | Community 415 | 5 | 7 | 0 | 0 | setup.sh · setup.sh script · hint_docker() · hint_flutter() | `scripts/setup.sh` |
| 330 | Community 378 | 5 | 5 | 0 | 3 | Durable Cross-device Memory Index · Claude Agent Guidance · Docs Taxonomy and Enforcement · Gemini Agent Guidance | `docs/sessions/20260713T033718Z-agentjwork-claude-docs-consolidation-hackathon.md`<br/>`CLAUDE.md`<br/>`docs/memory/README.md` |
| 331 | Community 417 | 5 | 4 | 0 | 0 | hooks · settings.json · $schema · PreToolUse | `.claude/settings.json` |
| 332 | Community 169 | 5 | 4 | 0 | 0 | Insight-Engine Architecture · biotope Architecture Context · Brain Ingestion Design · Brain Synthesis and Verification Design | `docs/INDEX.md` |
| 333 | Community 421 | 5 | 4 | 0 | 0 | index.dart · impl/baseline_service.dart · impl/chart_math.dart · impl/metric_series_models.dart | `apps/biotope/lib/modules/m5a_baselines/index.dart` |
| 334 | Community 422 | 5 | 4 | 0 | 0 | Rejected Assets · Needs Regeneration, Not Rejected · empty_scan_bloom - attempt 1 · home_flower_cluster_card - attempt 1 | `docs/biotope/ui/ai-assets/lessons/rejected-assets.md` |
| 335 | Brain Ingestion Storage Pipeline | 5 | 5 | 1 | 0 | TokenBucket · .consumeOne() · .refill() · .acquire() | `tools/brain-ingest/src/limits/rateLimiter.ts` |
| 336 | Community 424 | 5 | 4 | 0 | 0 | eslint.config.mjs · __dirname · __filename · compat | `apps/nao/eslint.config.mjs` |
| 337 | Community 425 | 5 | 4 | 0 | 1 | empty_scan_bloom · empty_scan_bloom.md · scan_circular_bloom.md · Attempt 2 Refinement | `docs/biotope/ui/ai-assets/prompts/empty_scan_bloom.md`<br/>`docs/biotope/ui/ai-assets/prompts/scan_circular_bloom.md` |
| 338 | Community 427 | 5 | 4 | 1 | 0 | Audit Finding Hotspots · App-Facing Contract Drift · Foreign Artifact Schema Seam · Projection Lifecycle Ownership | `.claude/skills/record-only-audit/references/finding-hotspots.md` |
| 339 | Community 428 | 5 | 4 | 0 | 0 | The Phase-2 run — the proven instance behind this skill · Named incidents (with their D/B ids) · phase2-run-example.md · Primary records | `.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 340 | Community 433 | 5 | 4 | 0 | 1 | Phase 2 Integrated Plan Session · Metric 100 Decision Consolidation Session · Brain Pipeline Decision Session · Phase 2 Goals and Features Session | `docs/sessions/20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md`<br/>`docs/sessions/20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md`<br/>`docs/sessions/20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md` |
| 341 | Community 434 | 5 | 4 | 0 | 0 | A8 Synthesis Session · S6 Edge Store and A11 Loader Session · A10 Verifier Scaffold Session · Agentic Seeder Session | `docs/sessions/20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md`<br/>`docs/sessions/20260716T035351Z-agentjwork-claude-agentic-seeder.md`<br/>`docs/sessions/20260716T042500Z-agentjwork-claude-a8-synthesis.md` |
| 342 | verified edges | 5 | 4 | 0 | 0 | verified_edges · L6 One-Card End-to-End Slice · Biotope–nao Runtime Boundary · quoteCheck | `docs/shared/biotope-nao-link.md`<br/>`docs/shared/insight-slice-demo-runbook.md` |
| 343 | Community 437 | 5 | 5 | 1 | 0 | edge_score_components.test.ts · referenceBand() · referenceScore() · mk() | `tools/edge-loader/tests/edge_score_components.test.ts` |
| 196 | Supabase Package | 4 | 3 | 0 | 0 | Run 3 Pending-Build Register · 100-Metric Expansion · Next-Build Optimizations · Superset Gap Map | `docs/temp/run3/pending-build-register.md` |
| 344 | Community 438 | 4 | 3 | 1 | 0 | Part F — Logging reliability & accuracy · F1. Reliability ladder (most → least trustworthy) · F2. Quick reference · F3. Implications for the model | `docs/biotope/metrics-catalog.md` |
| 345 | Community 301 | 4 | 4 | 0 | 0 | Shared Contract Two-Reviewer Gate · Executable Semantic Data Couplings · Non-Diagnostic Copy Rule · HRV SDNN iOS-Only Signal | `docs/graph/couplings.yaml`<br/>`docs/memory/0002-shared-contract-two-reviewers.md`<br/>`docs/memory/0003-non-diagnostic-copy.md` |
| 346 | Community 442 | 4 | 3 | 0 | 0 | index.dart · impl/insight_service.dart · impl/provenance_models.dart · impl/provenance_service.dart | `apps/biotope/lib/modules/m5b_insight_engine/index.dart` |
| 347 | Community 218 | 4 | 3 | 0 | 1 | Bug Report Form · Feature Request Form · Module and Environment Triage · Phase Scope and Acceptance Gate | `.github/ISSUE_TEMPLATE/bug_report.yml`<br/>`.github/ISSUE_TEMPLATE/feature_request.yml` |
| 348 | Community 443 | 4 | 3 | 0 | 1 | 0005-pgcron-config-prereqs.md · 0009-local-test-data-seeding.md · Local test data seeding (don't log for a week by hand) · pg_cron migrations need app config set in the Supabase dashboard first | `docs/memory/0005-pgcron-config-prereqs.md`<br/>`docs/memory/0009-local-test-data-seeding.md` |
| 349 | Community 444 | 4 | 3 | 0 | 0 | 0006-wearable-sync-best-effort.md · iOS Build and HealthKit Constraints · Local Supabase Auth Constraints · Wearable sync is best-effort | `docs/memory/0006-wearable-sync-best-effort.md`<br/>`docs/memory/0010-ios-build-needs-mac-and-paid-account.md`<br/>`docs/memory/0011-local-supabase-auth-email-only.md` |
| 350 | Community 378 | 4 | 3 | 0 | 0 | Adversarial Edge Verification · Brain Pipeline and Support Models · 100-metric Collector-gated Expansion · L6 One-card Slice with Interim Verifier | `docs/memory/0012-brain-adversarial-edge-verification.md`<br/>`docs/memory/0013-brain-pipeline-and-support-models-decision.md`<br/>`docs/memory/0014-metric-catalog-100-expansion-decision.md` |
| 351 | Community 446 | 4 | 3 | 0 | 1 | home_hero_robot_hand_alt_01.md · home_hero_robot_hand_main.md · home_hero_robot_hand_alt_01 · home_hero_robot_hand_main | `docs/biotope/ui/ai-assets/prompts/home_hero_robot_hand_alt_01.md`<br/>`docs/biotope/ui/ai-assets/prompts/home_hero_robot_hand_main.md` |
| 352 | Community 447 | 4 | 3 | 0 | 1 | insights_branching_node_system.md · insights_neural_botanical_cluster.md · insights_branching_node_system · insights_neural_botanical_cluster | `docs/biotope/ui/ai-assets/prompts/insights_branching_node_system.md`<br/>`docs/biotope/ui/ai-assets/prompts/insights_neural_botanical_cluster.md` |
| 353 | Community 448 | 4 | 3 | 0 | 0 | graphify reference: add a URL and watch a folder · add-watch.md · For --watch · For /graphify add | `.claude/skills/graphify/references/add-watch.md` |
| 354 | Community 449 | 4 | 3 | 0 | 0 | Dispatch-brief anatomy — the proven build-agent brief skeleton · dispatch-brief-template.md · Filled example (condensed from the run's U24 dispatch) · Skeleton | `.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md` |
| 355 | Community 450 | 4 | 3 | 0 | 0 | graphify reference: commit hook and native CLAUDE.md integration · For git commit hook · For native CLAUDE.md integration · hooks.md | `.claude/skills/graphify/references/hooks.md` |
| 356 | Community 451 | 4 | 3 | 0 | 0 | graphify reference: incremental update and cluster-only · For --cluster-only · For --update (incremental re-extraction) · update.md | `.claude/skills/graphify/references/update.md` |
| 357 | Community 457 | 4 | 5 | 1 | 0 | route.ts · POST() · json() · supabaseUrl() | `apps/nao/src/app/(app)/api/loader/run-pipeline/route.ts` |
| 358 | Community 458 | 4 | 3 | 0 | 1 | Graphify Adoption Session · Graphify Codex and Gemini Prewire Session · Graphify Dart Probe Session · Graphify Hook and Docs Cleanup Session | `docs/sessions/20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md`<br/>`docs/sessions/20260617T041218Z-uandiqueue-claude-graphify-adoption.md`<br/>`docs/sessions/20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md` |
| 359 | Community 459 | 4 | 3 | 0 | 1 | Metric Daily Values and Baseline V2 · Signal and Pairwise Evaluator · Continuity Storage Primitives · Rules as Data | `docs/sessions/20260715T140420Z-agentjwork-claude-storage-primitives.md`<br/>`docs/sessions/20260715T152517Z-agentjwork-claude-rules-as-data.md`<br/>`docs/sessions/20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md` |
| 360 | Community 460 | 4 | 4 | 0 | 0 | Run 2 U9 claims human-verdict session · Run 2 U10 seeds-as-data session · Run 2 U11 gap-surfacing session · Run 2 U12 demo dry-run session | `docs/sessions/20260724T150900Z-agentjwork-claude-run2-u9-claims-human-verdict.md`<br/>`docs/sessions/20260724T152525Z-agentjwork-claude-run2-u10-seeds-as-data.md`<br/>`docs/sessions/20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md` |
| 361 | Community 461 | 4 | 3 | 16 | 0 | LlmRouter · .testModeState() · .budgetState() · .constructor() | `tools/llm-router/src/router.ts` |
| 363 | Community 462 | 3 | 2 | 0 | 0 | MainActivity · FlutterFragmentActivity · MainActivity.kt | `apps/biotope/android/app/src/main/kotlin/com/ourobion/app/MainActivity.kt` |
| 364 | Community 464 | 3 | 2 | 0 | 0 | FlutterWindow() · class · flutter_window.h | `apps/biotope/windows/runner/flutter_window.h` |
| 365 | Community 465 | 3 | 2 | 0 | 0 | imports · @supabase/functions-js · deno.json | `supabase/functions/compute-baselines/deno.json` |
| 366 | Community 466 | 3 | 2 | 0 | 0 | Cross-Metric Rule Blueprints · Coincidence Condition Contract · Engine Refactor Gate for Cross Rules | `data/rules/cross/README.md` |
| 367 | Community 467 | 3 | 2 | 0 | 0 | imports · @supabase/functions-js · deno.json | `supabase/functions/evaluate-signals/deno.json` |
| 368 | Community 471 | 3 | 2 | 0 | 0 | imports · @supabase/functions-js · deno.json | `supabase/functions/generate-insights/deno.json` |
| 369 | Community 379 | 3 | 2 | 0 | 0 | Adversarial Edge Verification · Brain Knowledge Graph · Serving-Band Gating | `docs/nao/brain-synthesis-design.md` |
| 370 | Community 475 | 3 | 2 | 0 | 0 | Asset Generation Completion · Manifest-First Asset Planning · Resumable Asset Generation State | `docs/biotope/ui/ai-assets/progress/current-batch.md`<br/>`docs/biotope/ui/ai-assets/progress/next-actions.md`<br/>`docs/biotope/ui/ai-assets/progress/README.md` |
| 371 | Community 476 | 3 | 2 | 0 | 0 | graphify reference: GitHub clone and cross-repo merge · github-and-merge.md · Step 0 - Clone GitHub repo(s) (only if a GitHub URL was given) | `.claude/skills/graphify/references/github-and-merge.md` |
| 372 | Community 479 | 3 | 2 | 0 | 0 | graphify reference: transcribe video and audio · Step 2.5 - Transcribe video / audio files (only if video files detect… · transcribe.md | `.claude/skills/graphify/references/transcribe.md` |
| 373 | Community 483 | 3 | 2 | 0 | 0 | imports · @supabase/functions-js · deno.json | `supabase/functions/run-pipeline/deno.json` |
| 374 | Community 484 | 3 | 2 | 0 | 0 | index.ts · PIPELINE_STAGES · StageResult | `supabase/functions/run-pipeline/index.ts` |
| 375 | Community 485 | 3 | 2 | 0 | 1 | Local Test-Data Seeder · Next-Phase Rules-as-Data Plan · Windows-Native Toolchain | `docs/sessions/20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md`<br/>`docs/sessions/20260609T021240Z-uandiqueue-claude-next-phase-plan.md`<br/>`docs/sessions/20260610T021136Z-uandiqueue-claude-local-test-seeder.md` |
| 376 | Community 486 | 3 | 2 | 0 | 1 | Brain Safeguard Hardening · Projection Loader Hardening · Stacked-Chain Recovery | `docs/sessions/20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md`<br/>`docs/sessions/20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md`<br/>`docs/sessions/20260718T050856Z-agentjwork-claude-u24-loader-hardening.md` |
| 377 | Community 487 | 3 | 2 | 0 | 1 | Skills Run Procedures Session · Skills Generality Refactor Session · U26 Budget Ledger Lifecycle Session | `docs/sessions/20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md`<br/>`docs/sessions/20260718T163741Z-agentjwork-claude-skills-run-procedures.md`<br/>`docs/sessions/20260719T102011Z-agentjwork-claude-skills-generality-refactor.md` |
| 378 | Community 488 | 3 | 2 | 0 | 0 | MetricSeriesService · Run-2 U7 Biotope Trend and Provenance · TrendChartPainter | `docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md` |
| 379 | Phase 2 Demo Runbook | 3 | 2 | 0 | 0 | Phase 2 Demo Runbook · Decorrelated Full Run · Next Steps and Roadmap | `docs/shared/phase2-demo-runbook.md`<br/>`docs/shared/next-steps.md` |
| 298 | User Consent and Metrics Models | 2 | 1 | 0 | 0 | B-PL17 Semantic Graph Freshness · B-PL18 Semantic Graph Broad-Query Ranking | `docs/temp/run3/pending-build-register.md` |
| 362 | Agent Worktree Setup | 2 | 1 | 0 | 0 | B-PL20 Canonical Orientation Docs Lag Long-Horizon Builds · B-PL21 PaperRecord Shared Contract Debt | `docs/temp/run3/pending-build-register.md` |
| 380 | Community 491 | 2 | 1 | 0 | 0 | graphify-build.sh · graphify-build.sh script | `scripts/graphify-build.sh` |
| 381 | Community 493 | 2 | 1 | 0 | 0 | EyebrowLabel.tsx · EyebrowLabel() | `apps/nao/src/components/EyebrowLabel.tsx` |
| 382 | Community 494 | 2 | 1 | 0 | 0 | data/rules/cross — cross-metric rule blueprints · README.md | `data/rules/cross/README.md` |
| 383 | Community 495 | 2 | 1 | 0 | 0 | Insight-engine ADR index · Paper-reliability scoring decision | `docs/shared/decisions/0003-paper-reliability.md`<br/>`docs/shared/decisions/README.md` |
| 384 | Community 496 | 2 | 1 | 0 | 0 | Insight-engine architecture decisions (ADRs) · README.md | `docs/shared/decisions/README.md` |
| 385 | Community 497 | 2 | 1 | 0 | 1 | Phase 2 Plan · Project Context | `docs/INDEX.md` |
| 386 | Community 498 | 2 | 1 | 0 | 0 | FIXTURE edge artifacts — hand-authored, NEVER synthesized · README.md | `tools/edge-loader/tests/fixtures/edges/README.md` |
| 387 | Community 501 | 2 | 1 | 0 | 1 | Europe PMC full-text-not-found fixture · Minimal arXiv PDF fixture | `tools/brain-ingest/tests/fixtures/arxiv-2401.12345.pdf`<br/>`tools/brain-ingest/tests/fixtures/europepmc-fulltext-notfound.html` |
| 388 | Community 504 | 2 | 1 | 0 | 0 | impl/engagement_service.dart · index.dart | `apps/biotope/lib/modules/m6_engagement/index.dart` |
| 389 | Community 505 | 2 | 1 | 0 | 0 | impl/wearable_service.dart · index.dart | `apps/biotope/lib/modules/m3_passive_health/index.dart` |
| 390 | Community 506 | 2 | 1 | 0 | 0 | Launch Screen Assets · README.md | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` |
| 391 | Community 507 | 2 | 1 | 0 | 0 | Style Drift Notes · style-drift-notes.md | `docs/biotope/ui/ai-assets/lessons/style-drift-notes.md` |
| 392 | Community 301 | 2 | 1 | 0 | 0 | 0001-two-tier-truth.md · Two-tier truth | `docs/memory/0001-two-tier-truth.md` |
| 393 | Community 508 | 2 | 1 | 0 | 0 | 0002-shared-contract-two-reviewers.md · Shared contract changes need 2 reviewers | `docs/memory/0002-shared-contract-two-reviewers.md` |
| 394 | Community 509 | 2 | 1 | 0 | 0 | 0003-non-diagnostic-copy.md · Non-diagnostic language is mandatory for all user-facing copy | `docs/memory/0003-non-diagnostic-copy.md` |
| 395 | Community 510 | 2 | 1 | 0 | 0 | 0004-hrv-sdnn-ios-only.md · HRV SDNN is iOS-only | `docs/memory/0004-hrv-sdnn-ios-only.md` |
| 396 | Community 377 | 2 | 1 | 0 | 0 | 0007 — Analysis rules become data, via a two-tier blueprint→table pat… · 0007-rules-as-data-two-tier.md | `docs/memory/0007-rules-as-data-two-tier.md` |
| 397 | Community 511 | 2 | 1 | 0 | 0 | 0010-ios-build-needs-mac-and-paid-account.md · iOS builds need a Mac; HealthKit needs a paid Apple account + real de… | `docs/memory/0010-ios-build-needs-mac-and-paid-account.md` |
| 398 | Community 512 | 2 | 1 | 0 | 0 | 0011-local-supabase-auth-email-only.md · Local Supabase auth: email/password works; OAuth needs a hosted proje… | `docs/memory/0011-local-supabase-auth-email-only.md` |
| 399 | Community 513 | 2 | 1 | 0 | 0 | 0012 — The brain verifies synthesised edges with a second, grounded, … · 0012-brain-adversarial-edge-verification.md | `docs/memory/0012-brain-adversarial-edge-verification.md` |
| 400 | Community 514 | 2 | 1 | 0 | 0 | 0013 — Brain pipeline + support-models decision (the anchor) · 0013-brain-pipeline-and-support-models-decision.md | `docs/memory/0013-brain-pipeline-and-support-models-decision.md` |
| 401 | Community 515 | 2 | 1 | 0 | 0 | 0014 — Metric-catalog 100-expansion decision · 0014-metric-catalog-100-expansion-decision.md | `docs/memory/0014-metric-catalog-100-expansion-decision.md` |
| 402 | Community 516 | 2 | 1 | 0 | 0 | 0015 — Docs taxonomy and enforcement · 0015-docs-taxonomy-and-enforcement.md | `docs/memory/0015-docs-taxonomy-and-enforcement.md` |
| 403 | Community 517 | 2 | 1 | 0 | 0 | 0016 — Insight engine L6 one-card slice shipped (interim-verifier cav… · 0016-insight-engine-l6-one-card-slice.md | `docs/memory/0016-insight-engine-l6-one-card-slice.md` |
| 404 | Community 518 | 2 | 1 | 0 | 0 | CloudflareEnv · env.d.ts | `apps/nao/env.d.ts` |
| 405 | Community 519 | 2 | 1 | 0 | 0 | next.config.mjs · nextConfig | `apps/nao/next.config.mjs` |
| 406 | Community 520 | 2 | 1 | 0 | 0 | Current Batch · current-batch.md | `docs/biotope/ui/ai-assets/progress/current-batch.md` |
| 407 | Community 521 | 2 | 1 | 0 | 0 | Next Actions · next-actions.md | `docs/biotope/ui/ai-assets/progress/next-actions.md` |
| 408 | Community 522 | 2 | 1 | 0 | 0 | AI Asset Generation Progress · README.md | `docs/biotope/ui/ai-assets/progress/README.md` |
| 409 | Community 523 | 2 | 1 | 0 | 0 | archive_herbarium_specimen · archive_herbarium_specimen.md | `docs/biotope/ui/ai-assets/prompts/archive_herbarium_specimen.md` |
| 410 | Community 524 | 2 | 1 | 0 | 0 | archive_preserved_flower_fragment · archive_preserved_flower_fragment.md | `docs/biotope/ui/ai-assets/prompts/archive_preserved_flower_fragment.md` |
| 411 | Community 525 | 2 | 1 | 0 | 0 | deco_flower_cluster_white · deco_flower_cluster_white.md | `docs/biotope/ui/ai-assets/prompts/deco_flower_cluster_white.md` |
| 412 | Community 526 | 2 | 1 | 0 | 0 | deco_leaf_brass_node · deco_leaf_brass_node.md | `docs/biotope/ui/ai-assets/prompts/deco_leaf_brass_node.md` |
| 413 | Community 527 | 2 | 1 | 0 | 0 | deco_small_biomech_bloom · deco_small_biomech_bloom.md | `docs/biotope/ui/ai-assets/prompts/deco_small_biomech_bloom.md` |
| 414 | Community 528 | 2 | 1 | 0 | 0 | deco_vine_corner_left · deco_vine_corner_left.md | `docs/biotope/ui/ai-assets/prompts/deco_vine_corner_left.md` |
| 415 | Community 529 | 2 | 1 | 0 | 0 | empty_insights_seedpod · empty_insights_seedpod.md | `docs/biotope/ui/ai-assets/prompts/empty_insights_seedpod.md` |
| 416 | Community 530 | 2 | 1 | 0 | 0 | home_flower_cluster_card · home_flower_cluster_card.md | `docs/biotope/ui/ai-assets/prompts/home_flower_cluster_card.md` |
| 417 | Community 531 | 2 | 1 | 0 | 0 | insights_biomech_heart_bloom · insights_biomech_heart_bloom.md | `docs/biotope/ui/ai-assets/prompts/insights_biomech_heart_bloom.md` |
| 418 | Community 532 | 2 | 1 | 0 | 0 | profile_botanical_crest · profile_botanical_crest.md | `docs/biotope/ui/ai-assets/prompts/profile_botanical_crest.md` |
| 419 | Community 533 | 2 | 1 | 0 | 0 | scan_biomech_orchid · scan_biomech_orchid.md | `docs/biotope/ui/ai-assets/prompts/scan_biomech_orchid.md` |
| 420 | Community 534 | 2 | 1 | 0 | 0 | scan_sensor_flower_closeup · scan_sensor_flower_closeup.md | `docs/biotope/ui/ai-assets/prompts/scan_sensor_flower_closeup.md` |
| 421 | Community 535 | 2 | 1 | 0 | 0 | extraction-spec.md · graphify reference: extraction subagent prompt | `.claude/skills/graphify/references/extraction-spec.md` |
| 422 | Community 537 | 2 | 1 | 0 | 1 | Accepted Left Vine Overlay · Accepted Right Vine Overlay | `docs/biotope/ui/ai-assets/reviews/deco_vine_corner_left.md`<br/>`docs/biotope/ui/ai-assets/reviews/deco_vine_corner_right.md` |
| 423 | Community 538 | 2 | 1 | 0 | 1 | Alternate Home Hero · Primary Home Hero | `docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_alt_01.md`<br/>`docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_main.md` |
| 424 | Community 539 | 2 | 1 | 0 | 1 | Profile Porcelain Camellia · Profile Signature Flower | `docs/biotope/ui/ai-assets/reviews/profile_porcelain_camellia.md`<br/>`docs/biotope/ui/ai-assets/reviews/profile_signature_flower.md` |
| 425 | Community 545 | 2 | 1 | 0 | 0 | seed-test-data.ps1 · Write-Step() | `scripts/seed-test-data.ps1` |
| 426 | Community 546 | 2 | 1 | 0 | 0 | setup.ps1 · Step() | `scripts/setup.ps1` |
| 427 | Community 547 | 2 | 1 | 0 | 1 | Context-System Bootstrap · Historical Session Backfill | `docs/sessions/20260601T000000Z-uandiqueue-team-historical-backfill.md`<br/>`docs/sessions/20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md` |
| 428 | Community 548 | 2 | 1 | 0 | 0 | Dev-Phase2 PR Target · Single Dev-Phase2 Integration Line | `docs/sessions/20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md`<br/>`docs/sessions/20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md` |
| 429 | Community 549 | 2 | 1 | 0 | 1 | Metrics Registry Design Session · Metrics Registry Shared Parity Session | `docs/sessions/20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md`<br/>`docs/sessions/20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md` |
| 430 | Community 550 | 2 | 1 | 0 | 1 | Docs Feature Folders Session · Nao Design Document Session | `docs/sessions/20260629T152720Z-agentjwork-claude-docs-feature-folders.md`<br/>`docs/sessions/20260630T050141Z-agentjwork-claude-nao-design-doc.md` |
| 431 | Community 551 | 2 | 1 | 0 | 1 | Nao V1 Design Implementation Session · Readme Restructure Session | `docs/sessions/20260630T155323Z-agentjwork-claude-nao-design-implementation.md`<br/>`docs/sessions/20260701T031916Z-agentjwork-claude-readme-restructure.md` |
| 432 | Community 553 | 2 | 1 | 0 | 1 | Biotope Nao Link Refinement Session · Nao Corpus Run and Controls Session | `docs/sessions/20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md`<br/>`docs/sessions/20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md` |
| 433 | Community 554 | 2 | 1 | 0 | 0 | L0 Contract Extension Session · Phase 2 Run Orchestration Bootstrap Session | `docs/sessions/20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap.md`<br/>`docs/sessions/20260715T135541Z-agentjwork-claude-l0-contract-extension.md` |
| 434 | Community 555 | 2 | 1 | 0 | 1 | Dual-Route LLM Router · QuoteCheck and Venue Lookup | `docs/sessions/20260715T143750Z-agentjwork-claude-brain-llm-router.md`<br/>`docs/sessions/20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md` |
| 435 | Community 556 | 2 | 1 | 0 | 0 | L6 One-Card End-to-End Slice · Node Tool CI Matrix | `docs/sessions/20260716T060410Z-agentjwork-claude-l6-one-card-slice.md`<br/>`docs/sessions/20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md` |
| 436 | Shared Memory Coordinator | 2 | 1 | 0 | 1 | Relationship Cards and UTC Expiry · Snooze and Stale-Signal Safety | `docs/sessions/20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md`<br/>`docs/sessions/20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.md` |
| 437 | Community 557 | 2 | 1 | 0 | 1 | U25 DB Constraint Hygiene Session · U28 Nit Sweep Session | `docs/sessions/20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md`<br/>`docs/sessions/20260718T061213Z-agentjwork-claude-u28-nit-sweep.md` |
| 438 | Community 558 | 2 | 1 | 0 | 1 | U27 CI Deno and Migrations Session · U29 Deno Client Types Session | `docs/sessions/20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md`<br/>`docs/sessions/20260718T160053Z-agentjwork-claude-u29-deno-client-types.md` |
| 439 | Community 559 | 2 | 1 | 0 | 0 | Research Fixes Rho Label Session · Research Fixes Run Setup Session | `docs/sessions/20260719T144911Z-agentjwork-claude-research-fixes-run-setup.md`<br/>`docs/sessions/20260719T145507Z-agentjwork-claude-research-fixes-rho-label.md` |
| 440 | Community 560 | 2 | 1 | 0 | 1 | C5 Medium Confidence Cutoff · Deadband Fire-Rate Instrumentation | `docs/sessions/20260719T151130Z-agentjwork-claude-research-fixes-c5-cutoff.md`<br/>`docs/sessions/20260719T153645Z-agentjwork-claude-research-fixes-deadbandk.md` |
| 441 | Community 561 | 2 | 1 | 0 | 1 | Lag-Two Coincidence Window · xDF Effective-N Seam | `docs/sessions/20260719T154600Z-agentjwork-claude-research-fixes-lag2.md`<br/>`docs/sessions/20260719T155721Z-agentjwork-claude-research-fixes-xdf-seam.md` |
| 442 | Community 562 | 2 | 1 | 0 | 0 | Research fixes commit evidence review session · Research fixes composite calibration session | `docs/sessions/20260719T161537Z-agentjwork-claude-research-fixes-composite-calibration.md`<br/>`docs/sessions/20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-review.md` |
| 443 | Community 245 | 2 | 1 | 0 | 0 | Brain Ingestion Workflow · Remote-Controlled Corpus Ingestion | `.github/workflows/brain-ingest.yml` |
| 444 | Community 565 | 1 | 0 | 0 | 0 | build.gradle.kts | `apps/biotope/android/build.gradle.kts` |
| 445 | Community 566 | 1 | 0 | 0 | 0 | settings.gradle.kts | `apps/biotope/android/settings.gradle.kts` |
| 446 | Community 567 | 1 | 0 | 0 | 0 | build.gradle.kts | `apps/biotope/android/app/build.gradle.kts` |
| 447 | Community 568 | 1 | 0 | 0 | 0 | Nao application icon | `apps/nao/src/app/icon.png` |
| 448 | Community 569 | 1 | 0 | 0 | 0 | Flutter macOS app icon at 16 pixels | `apps/biotope/macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_16.png` |
| 449 | Community 570 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png` |
| 450 | Community 571 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@1x.png` |
| 451 | Community 572 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png` |
| 452 | Community 573 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@3x.png` |
| 453 | Community 574 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@1x.png` |
| 454 | Community 575 | 1 | 0 | 0 | 0 | Flutter app icon at 29x29 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@2x.png` |
| 455 | Community 576 | 1 | 0 | 0 | 0 | Flutter app icon at 40x40 1x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png` |
| 456 | Community 577 | 1 | 0 | 0 | 0 | Flutter app icon at 60x60 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png` |
| 457 | Community 578 | 1 | 0 | 0 | 0 | Flutter app icon at 83.5x83.5 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-83.5x83.5@2x.png` |
| 458 | Community 580 | 1 | 0 | 0 | 0 | generated_plugin_registrant.h | `apps/biotope/linux/flutter/generated_plugin_registrant.h` |
| 459 | Community 581 | 1 | 0 | 0 | 0 | my_application.h | `apps/biotope/linux/runner/my_application.h` |
| 460 | Community 582 | 1 | 0 | 0 | 0 | generated_plugin_registrant.h | `apps/biotope/windows/flutter/generated_plugin_registrant.h` |
| 461 | Community 583 | 1 | 0 | 0 | 0 | win32_window.h | `apps/biotope/windows/runner/win32_window.h` |
| 462 | Community 584 | 1 | 0 | 0 | 0 | Biomechanical herbarium specimen | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_herbarium_specimen.png` |
| 463 | Community 585 | 1 | 0 | 0 | 0 | Mechanical preserved flower fragment | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_preserved_flower_fragment.png` |
| 464 | Community 586 | 1 | 0 | 0 | 0 | Botanical report thumbnail | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_report_thumbnail_base.png` |
| 465 | Community 592 | 1 | 0 | 0 | 0 | antibiotics_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/behaviour/antibiotics_logging.dart` |
| 466 | Community 593 | 1 | 0 | 0 | 0 | food_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/behaviour/food_logging.dart` |
| 467 | Community 594 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `apps/nao/public/brand/ourobion-lockup-dark.svg` |
| 468 | Community 595 | 1 | 0 | 0 | 0 | Ourobion dark mark | `apps/nao/public/brand/ourobion-mark-dark-512.png` |
| 469 | Community 596 | 1 | 0 | 0 | 0 | Ourobion dark mark | `apps/nao/public/brand/ourobion-mark-dark.svg` |
| 470 | Community 597 | 1 | 0 | 0 | 0 | Herbarium specimen candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_herbarium_specimen_attempt_1.png` |
| 471 | Community 598 | 1 | 0 | 0 | 0 | Preserved flower fragment candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_preserved_flower_fragment_attempt_1.png` |
| 472 | Community 599 | 1 | 0 | 0 | 0 | Archive report thumbnail candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_report_thumbnail_base_attempt_1.png` |
| 473 | Community 600 | 1 | 0 | 0 | 0 | Blush flower cluster candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_flower_cluster_blush_attempt_1.png` |
| 474 | Community 601 | 1 | 0 | 0 | 0 | White flower cluster candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_flower_cluster_white_attempt_1.png` |
| 475 | Community 602 | 1 | 0 | 0 | 0 | Brass leaf node candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_leaf_brass_node_attempt_1.png` |
| 476 | Community 603 | 1 | 0 | 0 | 0 | Small biomechanical bloom candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_small_biomech_bloom_attempt_1.png` |
| 477 | Community 604 | 1 | 0 | 0 | 0 | Left vine corner candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_vine_corner_left_attempt_1.png` |
| 478 | Community 605 | 1 | 0 | 0 | 0 | Right vine corner candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_vine_corner_right_attempt_1.png` |
| 479 | Community 606 | 1 | 0 | 0 | 0 | Empty archive specimen candidate | `docs/biotope/ui/ai-assets/reviews/candidates/empty_archive_specimen_attempt_1.png` |
| 480 | Community 607 | 1 | 0 | 0 | 0 | Pale green biomechanical seedpod on a curved stem with leaves and gol… | `docs/biotope/ui/ai-assets/reviews/candidates/empty_insights_seedpod_attempt_1.png` |
| 481 | Community 608 | 1 | 0 | 0 | 0 | Drooping white bell flower with botanical stem, leaf, and gold mechan… | `docs/biotope/ui/ai-assets/reviews/candidates/empty_notifications_flower_attempt_1.png` |
| 482 | Community 609 | 1 | 0 | 0 | 0 | White orchid bloom with buds and a cream mechanical ring | `docs/biotope/ui/ai-assets/reviews/candidates/empty_scan_bloom_attempt_1.png` |
| 483 | Community 610 | 1 | 0 | 0 | 0 | White orchid bloom with buds, long leaf, and cream mechanical arc | `docs/biotope/ui/ai-assets/reviews/candidates/empty_scan_bloom_attempt_2.png` |
| 484 | Community 611 | 1 | 0 | 0 | 0 | White biomechanical flowering branch cluster arranged in the lower-ri… | `docs/biotope/ui/ai-assets/reviews/candidates/home_flower_cluster_card_attempt_1.png` |
| 485 | Community 612 | 1 | 0 | 0 | 0 | Dense white and blush biomechanical flower cluster with branching gol… | `docs/biotope/ui/ai-assets/reviews/candidates/home_flower_cluster_card_attempt_2.png` |
| 486 | Community 613 | 1 | 0 | 0 | 0 | White robotic hand cradling a lush white botanical flower arrangement | `docs/biotope/ui/ai-assets/reviews/candidates/home_hero_robot_hand_alt_01_attempt_1.png` |
| 487 | Community 614 | 1 | 0 | 0 | 0 | Upraised white robotic hand holding white flowers and green botanical… | `docs/biotope/ui/ai-assets/reviews/candidates/home_hero_robot_hand_main_attempt_1.png` |
| 488 | Community 615 | 1 | 0 | 0 | 0 | Heart-shaped biomechanical frame filled with white and blush flowers | `docs/biotope/ui/ai-assets/reviews/candidates/insights_biomech_heart_bloom_attempt_1.png` |
| 489 | Community 616 | 1 | 0 | 0 | 0 | Branching biomechanical node network interwoven with white and blush … | `docs/biotope/ui/ai-assets/reviews/candidates/insights_branching_node_system_attempt_1.png` |
| 490 | Community 617 | 1 | 0 | 0 | 0 | Neural-like biomechanical node system woven through a white botanical… | `docs/biotope/ui/ai-assets/reviews/candidates/insights_neural_botanical_cluster_attempt_1.png` |
| 491 | Community 618 | 1 | 0 | 0 | 0 | Symmetrical botanical crest with central cream mechanical node and pa… | `docs/biotope/ui/ai-assets/reviews/candidates/profile_botanical_crest_attempt_1.png` |
| 492 | Community 619 | 1 | 0 | 0 | 0 | Porcelain camellia candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/profile_porcelain_camellia_attempt_1.png` |
| 493 | Community 620 | 1 | 0 | 0 | 0 | Signature flower candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/profile_signature_flower_attempt_1.png` |
| 494 | Community 621 | 1 | 0 | 0 | 0 | Biomechanical orchid candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/scan_biomech_orchid_attempt_1.png` |
| 495 | Community 622 | 1 | 0 | 0 | 0 | Circular bloom candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/scan_circular_bloom_attempt_1.png` |
| 496 | Community 623 | 1 | 0 | 0 | 0 | Circular bloom candidate two | `docs/biotope/ui/ai-assets/reviews/candidates/scan_circular_bloom_attempt_2.png` |
| 497 | Community 624 | 1 | 0 | 0 | 0 | Sensor flower closeup candidate | `docs/biotope/ui/ai-assets/reviews/candidates/scan_sensor_flower_closeup_attempt_1.png` |
| 498 | Community 625 | 1 | 0 | 0 | 0 | daily_checkin.dart | `apps/biotope/lib/modules/m2_self_report/impl/checkin/daily_checkin.dart` |
| 499 | Community 626 | 1 | 0 | 0 | 0 | Blush mechanical flower cluster | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_flower_cluster_blush.png` |
| 500 | Community 627 | 1 | 0 | 0 | 0 | White mechanical flower cluster | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_flower_cluster_white.png` |
| 501 | Community 628 | 1 | 0 | 0 | 0 | Brass leaf node | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_leaf_brass_node.png` |
| 502 | Community 629 | 1 | 0 | 0 | 0 | Small biomechanical bloom | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_small_biomech_bloom.png` |
| 503 | Community 630 | 1 | 0 | 0 | 0 | Left biomechanical botanical corner vine decoration | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_vine_corner_left.png` |
| 504 | Community 631 | 1 | 0 | 0 | 0 | Right biomechanical botanical corner vine decoration | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_vine_corner_right.png` |
| 505 | Community 368 | 1 | 0 | 0 | 0 | Hand-authored edge artifact fixtures | `tools/edge-loader/tests/fixtures/edges/README.md` |
| 506 | Community 632 | 1 | 0 | 0 | 0 | Pinned pressed-flower archive empty-state illustration | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_archive_specimen.png` |
| 507 | Community 633 | 1 | 0 | 0 | 0 | Seedpod empty-state illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_insights_seedpod.png` |
| 508 | Community 634 | 1 | 0 | 0 | 0 | Pendant bell-flower empty-state illustration for notifications | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_notifications_flower.png` |
| 509 | Community 635 | 1 | 0 | 0 | 0 | Biomechanical orchid empty-state illustration for scanning | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_scan_bloom.png` |
| 510 | Community 636 | 1 | 0 | 0 | 0 | Ourobion circular teal apple touch icon at 180 pixels | `assets/ourobion-brand/favicon/apple-touch-icon-180.png` |
| 511 | Community 637 | 1 | 0 | 0 | 0 | Biotope touch icon | `assets/ourobion-biotope-logo/favicon/apple-touch-icon-180.png` |
| 512 | Community 638 | 1 | 0 | 0 | 0 | Ourobion circular teal favicon at 16 pixels | `assets/ourobion-brand/favicon/favicon-16.png` |
| 513 | Community 639 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon-16.png` |
| 514 | Community 640 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon-32.png` |
| 515 | Community 641 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon.svg` |
| 516 | Community 642 | 1 | 0 | 0 | 0 | Ourobion favicon | `assets/ourobion-brand/favicon/favicon.svg` |
| 517 | Community 643 | 1 | 0 | 0 | 0 | stool_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/gut/stool_logging.dart` |
| 518 | Community 644 | 1 | 0 | 0 | 0 | urine_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/gut/urine_logging.dart` |
| 519 | Community 645 | 1 | 0 | 0 | 0 | hackathon-rules.md | `docs/shared/hackathon/hackathon-rules.md` |
| 520 | Community 646 | 1 | 0 | 0 | 0 | Launchpad 2026 hackathon rules | `docs/shared/hackathon/hackathon-rules.md` |
| 521 | Community 647 | 1 | 0 | 0 | 0 | Biomechanical flower cluster for a home card | `apps/biotope/assets/images/generated/biomech_botanical/home/home_flower_cluster_card.png` |
| 522 | Community 648 | 1 | 0 | 0 | 0 | Alternate home hero image of a robotic hand with blossoms | `apps/biotope/assets/images/generated/biomech_botanical/home/home_hero_robot_hand_alt_01.png` |
| 523 | Community 649 | 1 | 0 | 0 | 0 | Main home hero image of an upraised robotic hand with blossoms | `apps/biotope/assets/images/generated/biomech_botanical/home/home_hero_robot_hand_main.png` |
| 524 | Community 650 | 1 | 0 | 0 | 0 | Flutter web icon at 192 pixels | `apps/biotope/web/icons/Icon-192.png` |
| 525 | Community 651 | 1 | 0 | 0 | 0 | Flutter web icon at 512 pixels | `apps/biotope/web/icons/Icon-512.png` |
| 526 | Community 652 | 1 | 0 | 0 | 0 | Flutter maskable web icon at 192 pixels | `apps/biotope/web/icons/Icon-maskable-192.png` |
| 527 | Community 653 | 1 | 0 | 0 | 0 | Flutter web maskable icon | `apps/biotope/web/icons/Icon-maskable-512.png` |
| 528 | Community 654 | 1 | 0 | 0 | 0 | Biotope logo mark | `apps/biotope/assets/images/logo.png` |
| 529 | Community 655 | 1 | 0 | 0 | 0 | Heart-shaped biomechanical floral illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_biomech_heart_bloom.png` |
| 530 | Community 656 | 1 | 0 | 0 | 0 | Branching biomechanical node network for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_branching_node_system.png` |
| 531 | Community 657 | 1 | 0 | 0 | 0 | Neural botanical cluster illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_neural_botanical_cluster.png` |
| 532 | Community 658 | 1 | 0 | 0 | 0 | Blank white launch image at 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png` |
| 533 | Community 659 | 1 | 0 | 0 | 0 | Blank white launch image | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png` |
| 534 | Community 660 | 1 | 0 | 0 | 0 | index.dart | `apps/biotope/lib/modules/m4_environmental/index.dart` |
| 535 | Community 661 | 1 | 0 | 0 | 0 | index.dart | `apps/biotope/lib/modules/m7_community/index.dart` |
| 536 | Community 378 | 1 | 0 | 0 | 0 | Docs Taxonomy and Enforcement | `docs/memory/0015-docs-taxonomy-and-enforcement.md` |
| 537 | Community 368 | 1 | 0 | 0 | 0 | Metrics registry contract | `shared/metrics/README.md` |
| 538 | Community 662 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-hdpi/ic_launcher.png` |
| 539 | Community 663 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-mdpi/ic_launcher.png` |
| 540 | Community 664 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` |
| 541 | Community 665 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` |
| 542 | Community 666 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` |
| 543 | Community 668 | 1 | 0 | 0 | 0 | open-next.config.ts | `apps/nao/open-next.config.ts` |
| 544 | Community 669 | 1 | 0 | 0 | 0 | bool? |  |
| 545 | Community 670 | 1 | 0 | 0 | 0 | Biotope dark lockup | `assets/ourobion-biotope-logo/logo/png/biotope-lockup-dark-1024.png` |
| 546 | Community 671 | 1 | 0 | 0 | 0 | Biotope light lockup | `assets/ourobion-biotope-logo/logo/png/biotope-lockup-light-1024.png` |
| 547 | Community 672 | 1 | 0 | 0 | 0 | Biotope dark mark | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-1024.png` |
| 548 | Community 673 | 1 | 0 | 0 | 0 | Biotope dark logo mark at 256 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-256.png` |
| 549 | Community 674 | 1 | 0 | 0 | 0 | Biotope dark logo mark at 512 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-512.png` |
| 550 | Community 675 | 1 | 0 | 0 | 0 | Biotope light logo mark at 1024 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-1024.png` |
| 551 | Community 676 | 1 | 0 | 0 | 0 | Biotope light logo mark at 256 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-256.png` |
| 552 | Community 677 | 1 | 0 | 0 | 0 | Biotope light logo mark at 512 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-512.png` |
| 553 | Community 678 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `assets/ourobion-brand/logo/png/ourobion-lockup-dark-1024.png` |
| 554 | Community 679 | 1 | 0 | 0 | 0 | Ourobion light lockup | `assets/ourobion-brand/logo/png/ourobion-lockup-light-1024.png` |
| 555 | Community 680 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-1024.png` |
| 556 | Community 681 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-256.png` |
| 557 | Community 682 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-512.png` |
| 558 | Community 683 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-1024.png` |
| 559 | Community 684 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-256.png` |
| 560 | Community 685 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-512.png` |
| 561 | Community 686 | 1 | 0 | 0 | 0 | Botanical mechanical profile crest | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_botanical_crest.png` |
| 562 | Community 687 | 1 | 0 | 0 | 0 | Porcelain camellia profile flower | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_porcelain_camellia.png` |
| 563 | Community 688 | 1 | 0 | 0 | 0 | Signature mechanical flower | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_signature_flower.png` |
| 564 | Community 689 | 1 | 0 | 0 | 0 | Biomechanical botanical UI reference | `docs/biotope/ui/ai-assets/references/biomech-botanical-ui-seed.png` |
| 565 | Community 692 | 1 | 0 | 0 | 0 | Archive Empty-State Specimen | `docs/biotope/ui/ai-assets/reviews/empty_archive_specimen.md` |
| 566 | Community 693 | 1 | 0 | 0 | 0 | Insights Empty-State Seedpod | `docs/biotope/ui/ai-assets/reviews/empty_insights_seedpod.md` |
| 567 | Community 694 | 1 | 0 | 0 | 0 | Notifications Empty-State Flower | `docs/biotope/ui/ai-assets/reviews/empty_notifications_flower.md` |
| 568 | Community 695 | 1 | 0 | 0 | 0 | Scan Empty-State Bloom | `docs/biotope/ui/ai-assets/reviews/empty_scan_bloom.md` |
| 569 | Community 696 | 1 | 0 | 0 | 0 | Home Flower Card Accent | `docs/biotope/ui/ai-assets/reviews/home_flower_cluster_card.md` |
| 570 | Community 697 | 1 | 0 | 0 | 0 | Insights Heart Bloom | `docs/biotope/ui/ai-assets/reviews/insights_biomech_heart_bloom.md` |
| 571 | Community 698 | 1 | 0 | 0 | 0 | Profile Botanical Crest | `docs/biotope/ui/ai-assets/reviews/profile_botanical_crest.md` |
| 572 | Community 700 | 1 | 0 | 0 | 0 | Runner-Bridging-Header.h | `apps/biotope/ios/Runner/Runner-Bridging-Header.h` |
| 573 | Community 701 | 1 | 0 | 0 | 0 | Biomechanical orchid scan | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_biomech_orchid.png` |
| 574 | Community 702 | 1 | 0 | 0 | 0 | Circular biomechanical bloom scan | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_circular_bloom.png` |
| 575 | Community 703 | 1 | 0 | 0 | 0 | Sensor flower closeup | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_sensor_flower_closeup.png` |
| 576 | Community 704 | 1 | 0 | 0 | 0 | biotope-env.ps1 | `scripts/biotope-env.ps1` |
| 577 | Community 705 | 1 | 0 | 0 | 0 | graphify-build.ps1 | `scripts/graphify-build.ps1` |
| 578 | Community 706 | 1 | 0 | 0 | 0 | Docs Cleanup Session | `docs/sessions/20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md` |
| 579 | Community 707 | 1 | 0 | 0 | 0 | Graphify Setup and Readme Session | `docs/sessions/20260617T064658Z-uandiqueue-claude-graphify-setup-and-readme.md` |
| 580 | Community 708 | 1 | 0 | 0 | 0 | Graphify Claude Skill Session | `docs/sessions/20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md` |
| 581 | Community 709 | 1 | 0 | 0 | 0 | Readme Context Engineering Session | `docs/sessions/20260618T094117Z-uandiqueue-claude-readme-context-engineering.md` |
| 582 | Community 710 | 1 | 0 | 0 | 0 | Wikilinks to Markdown Session | `docs/sessions/20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md` |
| 583 | Community 711 | 1 | 0 | 0 | 0 | Phase 2 Metric Platform Replan Session | `docs/sessions/20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md` |
| 584 | Community 712 | 1 | 0 | 0 | 0 | W0 Metric Platform Foundation Session | `docs/sessions/20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md` |
| 585 | Community 713 | 1 | 0 | 0 | 0 | Ourobion Rebrand Session | `docs/sessions/20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md` |
| 586 | Community 368 | 1 | 0 | 0 | 0 | Brain Ingest Pipeline Session | `docs/sessions/20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md` |
| 587 | Community 245 | 1 | 0 | 0 | 0 | Apps Monorepo Layout | `docs/sessions/20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md` |
| 588 | Community 245 | 1 | 0 | 0 | 0 | Nao Architecture Research Snapshot | `docs/sessions/20260630T071429Z-agentjwork-claude-nao-research-brief.md` |
| 589 | Community 245 | 1 | 0 | 0 | 0 | Nao Environment Convention | `docs/sessions/20260630T075152Z-agentjwork-claude-nao-env-convention.md` |
| 590 | Community 552 | 1 | 0 | 0 | 0 | Demo Scope Propagation Session | `docs/sessions/20260701T080448Z-agentjwork-claude-demo-scope-propagate.md` |
| 591 | Community 714 | 1 | 0 | 0 | 0 | M2 Standing-water Audit Session | `docs/sessions/20260702T080203Z-altogennn-claude-m2-standing-water-audit.md` |
| 592 | Community 715 | 1 | 0 | 0 | 0 | Backend Test Plan Brief Session | `docs/sessions/20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md` |
| 593 | Community 169 | 1 | 0 | 0 | 0 | Run 2 U13 decorrelated full-run session | `docs/sessions/20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md` |
| 594 | Run Three Build Register | 1 | 0 | 0 | 0 | Run-2 Adversarial Audit Session | `docs/sessions/20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md` |
| 595 | NLI Support Model Pilot | 1 | 0 | 0 | 0 | Run-3 GMI Training-plan Session | `docs/sessions/20260726T141532Z-agentjwork-codex-run3-gmi-training-plan.md` |
| 596 | Community 716 | 1 | 0 | 0 | 0 | Ourobion shared contract context | `shared/SHARED-CONTEXT.md` |
| 597 | Community 717 | 1 | 0 | 0 | 0 | Ourobion Biotope dark lockup: gold six-petal botanical emblem encircl… | `assets/ourobion-biotope-logo/logo/svg/biotope-lockup-dark.svg` |
| 598 | Community 718 | 1 | 0 | 0 | 0 | Ourobion Biotope light lockup: gold six-petal botanical emblem and wh… | `assets/ourobion-biotope-logo/logo/svg/biotope-lockup-light.svg` |
| 599 | Community 719 | 1 | 0 | 0 | 0 | Biotope dark mark: gold six-petal botanical emblem inside a circular … | `assets/ourobion-biotope-logo/logo/svg/biotope-mark-dark.svg` |
| 600 | Community 720 | 1 | 0 | 0 | 0 | Biotope light mark: gold six-petal botanical emblem inside a white-ac… | `assets/ourobion-biotope-logo/logo/svg/biotope-mark-light.svg` |
| 601 | Community 721 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `assets/ourobion-brand/logo/svg/ourobion-lockup-dark.svg` |
| 602 | Community 722 | 1 | 0 | 0 | 0 | Ourobion light lockup | `assets/ourobion-brand/logo/svg/ourobion-lockup-light.svg` |
| 603 | Community 723 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/svg/ourobion-mark-dark.svg` |
| 604 | Community 724 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/svg/ourobion-mark-light.svg` |
| 605 | Community 725 | 1 | 0 | 0 | 0 | Flutter web favicon | `apps/biotope/web/favicon.png` |
| 606 | Community 606 | 1 | 0 | 0 | 0 | B-BR4 Custom Support Models | `docs/temp/run3/pending-build-register.md` |

</details>

## Interpretation limits

- Community labels and inferred links are probabilistic; they are navigation aids, not reviewed facts.
- Node and link counts depend on Graphify’s extractors and ignore rules, not just repository size.
- This view does not replace `docs/biotope/architecture-context.md`, `shared/` contracts, migrations,
  `docs/graph/couplings.yaml`, memory records, or accepted ADRs.
- Historical `docs/archive/` material and this generated file are excluded through `.graphifyignore`.
