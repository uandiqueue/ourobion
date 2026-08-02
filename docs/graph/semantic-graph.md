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
| Nodes | 13124 |
| Pair links | 19871 |
| Hyperedges | 47 |
| Communities | 1027 |
| Source files represented | 1366 |
| Dangling pair-link endpoints | 0 |
| Dangling hyperedge members | 0 |

- Graphify revision stamp: `099b2fda5c1350c59c0a5ad52bcb24e4cacf55b7`
- Exact source-file SHA-256: `a7abc651c977af07cf9f39dccddbd793867055b97082095d2151f425e5ed1e65`
- Semantic-content SHA-256 (revision metadata excluded): `c0334902ebed328d4dd31b06fa1e1f680a5a775ff7f3010f02b2915c399ea999`

## Main community topology

The 18 largest communities are shown. Edge labels are aggregated pair-link counts;
an absent line does not mean two areas have no path through smaller communities.

```mermaid
flowchart LR
  C_25["Community 25<br/>139 nodes"]
  C_2["Community 2<br/>116 nodes"]
  C_60["Community 60<br/>111 nodes"]
  C_76["Community 76<br/>96 nodes"]
  C_21["Community 21<br/>94 nodes"]
  C_0["Community 0<br/>93 nodes"]
  C_26["Community 26<br/>88 nodes"]
  C_80["Community 80<br/>87 nodes"]
  C_121["Community 121<br/>84 nodes"]
  C_13["Community 13<br/>81 nodes"]
  C_84["Community 84<br/>74 nodes"]
  C_20["Community 20<br/>73 nodes"]
  C_85["Community 85<br/>73 nodes"]
  C_66["Community 66<br/>72 nodes"]
  C_1["Community 1<br/>71 nodes"]
  C_14["Community 14<br/>71 nodes"]
  C_98["Community 98<br/>71 nodes"]
  C_105["Community 105<br/>71 nodes"]
  C_25 ---|"39"| C_80
  C_60 ---|"33"| C_66
  C_13 ---|"18"| C_21
  C_21 ---|"18"| C_66
  C_14 ---|"15"| C_21
  C_13 ---|"14"| C_14
  C_14 ---|"13"| C_66
  C_2 ---|"11"| C_26
  C_2 ---|"10"| C_98
  C_2 ---|"10"| C_121
  C_1 ---|"8"| C_2
  C_26 ---|"7"| C_121
  C_25 ---|"6"| C_105
  C_98 ---|"6"| C_121
  C_1 ---|"5"| C_98
  C_1 ---|"4"| C_121
  C_13 ---|"3"| C_66
  C_21 ---|"3"| C_60
  C_1 ---|"2"| C_26
  C_13 ---|"2"| C_60
  C_25 ---|"1"| C_76
  C_76 ---|"1"| C_105
```

## Graph composition

### Node types

| Kind | Count | Share |
|---|---:|---:|
| code | 7823 | 59.6% |
| document | 4478 | 34.1% |
| rationale | 522 | 4.0% |
| concept | 187 | 1.4% |
| image | 112 | 0.9% |
| paper | 2 | 0.0% |

### Node origins

| Kind | Count | Share |
|---|---:|---:|
| ast | 12508 | 95.3% |
| unspecified | 616 | 4.7% |

### Pair-link confidence

| Kind | Count | Share |
|---|---:|---:|
| EXTRACTED | 19003 | 95.6% |
| INFERRED | 866 | 4.4% |
| AMBIGUOUS | 2 | 0.0% |

### Most common pair-link relations

| Relation | Links |
|---|---:|
| contains | 7632 |
| calls | 2986 |
| imports | 2727 |
| defines | 2198 |
| references | 1147 |
| method | 784 |
| imports_from | 660 |
| uses | 581 |
| rationale_for | 427 |
| re_exports | 273 |
| inherits | 221 |
| conceptually_related_to | 102 |
| implements | 39 |
| semantically_similar_to | 31 |
| exports | 19 |
| shares_data_with | 16 |
| mixes_in | 15 |
| navigates | 7 |
| configures | 5 |
| extends | 1 |

## Strongest cross-community connections

| Community A | Community B | Pair links |
|---|---|---:|
| `38` Community 38 | `102` Community 102 | 53 |
| `60` Community 60 | `123` Community 123 | 52 |
| `76` Community 76 | `205` Community 205 | 40 |
| `25` Community 25 | `80` Community 80 | 39 |
| `66` Community 66 | `153` Community 153 | 34 |
| `60` Community 60 | `66` Community 66 | 33 |
| `66` Community 66 | `67` Community 67 | 31 |
| `85` Community 85 | `302` Community 302 | 31 |
| `37` Community 37 | `55` Community 55 | 30 |
| `15` Community 15 | `66` Community 66 | 28 |
| `48` Community 48 | `59` Community 59 | 28 |
| `30` Community 30 | `48` Community 48 | 24 |
| `48` Community 48 | `89` Community 89 | 22 |
| `48` Community 48 | `107` Community 107 | 22 |
| `66` Community 66 | `74` Community 74 | 22 |
| `66` Community 66 | `370` Community 370 | 22 |
| `148` Community 148 | `167` Community 167 | 22 |
| `114` Community 114 | `205` Community 205 | 21 |
| `13` Community 13 | `153` Community 153 | 20 |
| `638` Community 638 | `669` Community 669 | 20 |
| `48` Community 48 | `626` Community 626 | 19 |
| `13` Community 13 | `21` Community 21 | 18 |
| `21` Community 21 | `66` Community 66 | 18 |
| `21` Community 21 | `153` Community 153 | 18 |
| `30` Community 30 | `171` Community 171 | 18 |
| `48` Community 48 | `171` Community 171 | 18 |
| `85` Community 85 | `141` Community 141 | 18 |
| `102` Community 102 | `366` Community 366 | 18 |
| `102` Community 102 | `131` Community 131 | 17 |
| `167` Community 167 | `621` Community 621 | 17 |
| `30` Community 30 | `59` Community 59 | 16 |
| `37` Community 37 | `39` Community 39 | 16 |
| `76` Community 76 | `114` Community 114 | 16 |
| `100` Community 100 | `102` Community 102 | 16 |
| `7` Community 7 | `13` Community 13 | 15 |
| `14` Community 14 | `21` Community 21 | 15 |
| `25` Community 25 | `666` Community 666 | 15 |
| `85` Community 85 | `621` Community 621 | 15 |
| `638` Community 638 | `683` Community 683 | 15 |
| `13` Community 13 | `14` Community 14 | 14 |
| `25` Community 25 | `172` Community 172 | 14 |
| `60` Community 60 | `153` Community 153 | 14 |
| `114` Community 114 | `301` Community 301 | 14 |
| `151` Community 151 | `302` Community 302 | 14 |
| `210` Community 210 | `659` Community 659 | 14 |
| `6` Community 6 | `79` Community 79 | 13 |
| `14` Community 14 | `66` Community 66 | 13 |
| `39` Community 39 | `55` Community 55 | 13 |
| `48` Community 48 | `124` Community 124 | 13 |
| `60` Community 60 | `109` Community 109 | 13 |

## Bridge nodes

Bridge nodes touch several communities. They are useful starting points for blast-radius questions,
but high degree can also reflect generic infrastructure or documentation hubs.

| Node | Community | Neighbor communities | Cross links | Source |
|---|---|---:|---:|---|
| package:flutter/material.dart | `121` Community 121 | 35 | 57 | `no source` |
| package:supabase_flutter/supabase_flutter.dart | `41` Community 41 | 26 | 31 | `no source` |
| List | `627` Community 627 | 25 | 31 | `no source` |
| static const | `24` Community 24 | 21 | 22 | `no source` |
| package:google_fonts/google_fonts.dart | `121` Community 121 | 19 | 26 | `no source` |
| ../../../../core/theme.dart | `16` Community 16 | 19 | 23 | `no source` |
| home_tab.dart | `26` Community 26 | 18 | 44 | `apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart` |
| _state | `90` Community 90 | 17 | 21 | `apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart` |
| package:flutter_test/flutter_test.dart | `64` Community 64 | 16 | 49 | `no source` |
| StatefulWidget | `90` Community 90 | 16 | 20 | `no source` |
| cli.ts | `21` Community 21 | 15 | 52 | `tools/brain-ingest/src/cli.ts` |
| index.ts | `66` Community 66 | 15 | 49 | `tools/brain-ingest/src/synth/index.ts` |
| scan_tab.dart | `98` Community 98 | 15 | 43 | `apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart` |
| StatelessWidget | `2` Community 2 | 14 | 41 | `no source` |
| index.ts | `48` Community 48 | 13 | 69 | `tools/llm-router/src/index.ts` |
| run.ts | `13` Community 13 | 13 | 69 | `tools/brain-ingest/src/run.ts` |
| verifier.ts | `60` Community 60 | 12 | 47 | `tools/brain-ingest/src/verify/verifier.ts` |
| errors.py | `25` Community 25 | 12 | 28 | `model-training/src/ourobion_model_lab/errors.py` |
| SourceCtx | `6` Community 6 | 12 | 25 | `tools/brain-ingest/src/types.ts` |
| SourceName | `19` Community 19 | 12 | 25 | `tools/brain-ingest/src/types.ts` |
| PaperRecord | `53` Community 53 | 11 | 27 | `tools/brain-ingest/src/types.ts` |
| daily_log_screen.dart | `1` Community 1 | 11 | 26 | `apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart` |
| paperRun.ts | `66` Community 66 | 11 | 24 | `tools/brain-ingest/src/synth/paperRun.ts` |
| insight_provenance_screen.dart | `2` Community 2 | 10 | 21 | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart` |
| liveAcceptance.ts | `124` Community 124 | 10 | 19 | `tools/brain-ingest/src/liveAcceptance.ts` |
| Config | `13` Community 13 | 10 | 13 | `tools/brain-ingest/src/types.ts` |
| dart:io | `633` Community 633 | 10 | 11 | `no source` |
| return | `118` Community 118 | 10 | 10 | `no source` |
| ViceroyConfig | `621` Community 621 | 9 | 54 | `docs/development/model-training/viceroy-training/src/viceroy/config.py` |
| router.ts | `48` Community 48 | 9 | 32 | `tools/llm-router/src/router.ts` |
| apiWorker.ts | `171` Community 171 | 9 | 31 | `tools/llm-router/src/routes/apiWorker.ts` |
| LlmRequest | `89` Community 89 | 9 | 17 | `tools/llm-router/src/types.ts` |
| ModelLabError | `25` Community 25 | 9 | 17 | `model-training/src/ourobion_model_lab/errors.py` |
| archive_tab.dart | `242` Community 242 | 9 | 15 | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/archive_tab.dart` |
| metric_detail_screen.dart | `339` Community 339 | 9 | 14 | `apps/biotope/lib/modules/m5a_baselines/ui/screens/metric_detail_screen.dart` |
| provenance_models.dart | `3` Community 3 | 9 | 10 | `apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart` |
| scan_test_support.dart | `241` Community 241 | 9 | 10 | `apps/biotope/test/m2_self_report/scan_test_support.dart` |
| Map | `930` Community 930 | 9 | 9 | `no source` |
| index.ts | `39` Community 39 | 8 | 41 | `supabase/functions/generate-insights/index.ts` |
| __init__.py | `151` Community 151 | 8 | 36 | `docs/development/model-training/viceroy-training/src/viceroy/__init__.py` |
| offlineAcceptance.ts | `74` Community 74 | 8 | 28 | `tools/brain-ingest/src/offlineAcceptance.ts` |
| singlePaper.ts | `370` Community 370 | 8 | 24 | `tools/brain-ingest/src/singlePaper.ts` |
| verify.test.ts | `123` Community 123 | 8 | 21 | `tools/brain-ingest/tests/verify.test.ts` |
| retrieval.ts | `123` Community 123 | 8 | 18 | `tools/brain-ingest/src/verify/retrieval.ts` |
| types.ts | `60` Community 60 | 8 | 18 | `tools/brain-ingest/src/verify/types.ts` |
| LlmResponse | `66` Community 66 | 8 | 17 | `tools/llm-router/src/types.ts` |
| LlmRouter | `59` Community 59 | 8 | 16 | `tools/llm-router/src/router.ts` |
| types.ts | `8` Community 8 | 8 | 16 | `tools/brain-ingest/src/types.ts` |
| FetchOptions | `79` Community 79 | 8 | 15 | `tools/brain-ingest/src/types.ts` |
| profile_tab.dart | `180` Community 180 | 8 | 15 | `apps/biotope/lib/modules/m1_core/ui/screens/profile_tab.dart` |

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
| Graph build and human-view refresh flow | participate_in | 5 | 0 | INFERRED | `docs/graph/README.md` |
| Graph-view renderer verification suite | implement | 5 | 0 | EXTRACTED | `tools/graph-view/tests/render_graph_view.test.mjs` |
| Graphify Knowledge Graph Workflow | form | 5 | 0 | EXTRACTED | `.claude/skills/graphify/SKILL.md` |
| Isolated Model-Training Workstreams | participate_in | 5 | 0 | EXTRACTED | `docs/temp/model-training/README.md` |
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
<summary><strong>Complete community directory (1027)</strong></summary>

Communities are ordered by node count. “Cross links” counts incidences, so each connection contributes
once to each endpoint community.

| ID | Community | Nodes | Internal links | Cross links | Inferred incidences | Key nodes | Representative sources |
|---:|---|---:|---:|---:|---:|---|---|
| 25 | Community 25 | 139 | 294 | 134 | 121 | PredictionRow · errors.py · ReadOnlyR2Client · predict.py | `model-training/tests/test_inference_review_regressions.py`<br/>`model-training/src/ourobion_model_lab/inference/r2.py`<br/>`model-training/tests/test_inference_r2.py` |
| 2 | Community 2 | 116 | 125 | 95 | 0 | insight_provenance_screen.dart · StatelessWidget · ProvenanceService · _FakeProvenanceService | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart` |
| 60 | Community 60 | 111 | 276 | 158 | 0 | verifier.ts · types.ts · enforce.ts · SynthClaim | `tools/brain-ingest/src/verify/types.ts`<br/>`tools/brain-ingest/src/verify/enforce.ts`<br/>`tools/brain-ingest/src/verify/artifact.ts` |
| 76 | Community 76 | 96 | 245 | 80 | 115 | JobSpec · Path · StepResult · DryRunResult | `model-training/tests/test_job_and_cli.py`<br/>`model-training/src/ourobion_model_lab/job.py`<br/>`model-training/src/ourobion_model_lab/self_check.py` |
| 21 | Community 21 | 94 | 198 | 118 | 2 | cli.ts · corpusBuild.ts · main() · venue.test.ts | `tools/brain-ingest/src/cli.ts`<br/>`tools/brain-ingest/src/verify/corpusBuild.ts`<br/>`tools/brain-ingest/src/venue/cache.ts` |
| 0 | Community 0 | 93 | 92 | 2 | 0 | index.dart · activeTitle · anxietyScore · appetiteScore | `shared/types/index.dart` |
| 26 | Community 26 | 88 | 88 | 49 | 0 | home_tab.dart · MaterialPageRoute · _open · _openAntibiotics | `apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/sign_in_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart` |
| 80 | Community 80 | 87 | 180 | 48 | 77 | load_input_manifest() · validate_prediction() · InputSchemaError · OutputSchemaError | `model-training/tests/test_inference_schemas.py`<br/>`model-training/tests/test_inference_predict.py`<br/>`model-training/src/ourobion_model_lab/inference/schemas.py` |
| 121 | Community 121 | 84 | 96 | 136 | 0 | package:flutter/material.dart · biotope_auth_scaffold.dart · package:google_fonts/google_fonts.dart · biotope_bottom_navigation.dart | `apps/biotope/lib/core/widgets/biotope_auth_scaffold.dart`<br/>`apps/biotope/lib/core/widgets/biotope_bottom_navigation.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/widgets/about_biotope_card.dart` |
| 13 | Community 13 | 81 | 163 | 154 | 5 | run.ts · r2.ts · run() · run.test.ts | `tools/brain-ingest/src/run.ts`<br/>`tools/brain-ingest/src/storage/r2.ts`<br/>`tools/brain-ingest/src/extract.ts` |
| 84 | Community 84 | 74 | 135 | 28 | 0 | scientific_provenance.test.ts · provenance.ts · trust_labels.ts · relationships.ts | `shared/brain/trust_labels.ts`<br/>`shared/brain/provenance.ts`<br/>`shared/brain/relationships.ts` |
| 20 | Community 20 | 73 | 72 | 4 | 0 | guard_support.dart · _numericField · _quotedField · _scaleFields | `apps/biotope/test/guards/guard_support.dart` |
| 85 | Community 85 | 73 | 195 | 87 | 109 | ProcessedExample · _small_config() · _row() · build_groups() | `docs/development/model-training/viceroy-training/tests/test_splits.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/splits.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/data.py` |
| 66 | Community 66 | 72 | 222 | 258 | 3 | index.ts · paperRun.ts · synth.test.ts · synthesizePapers() | `tools/brain-ingest/src/synth/artifact.ts`<br/>`tools/brain-ingest/src/synth/load.ts`<br/>`tools/brain-ingest/tests/synth.test.ts` |
| 1 | Community 1 | 71 | 72 | 36 | 0 | daily_log_screen.dart · _DailyLogScreenState · _NotesCard · _NotesCardState | `apps/biotope/lib/modules/m2_self_report/ui/screens/daily_log_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/index.dart` |
| 14 | Community 14 | 71 | 186 | 63 | 1 | index.ts · seeder.test.ts · Seed · artifact.ts | `tools/brain-ingest/src/seeder/index.ts`<br/>`tools/brain-ingest/src/seeder/types.ts`<br/>`tools/brain-ingest/tests/seeder.test.ts` |
| 98 | Community 98 | 71 | 70 | 43 | 0 | scan_tab.dart · _answerInline · _completionAnim · _controller | `apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart` |
| 105 | Community 105 | 71 | 128 | 22 | 11 | assert_no_forbidden_schema() · assert_allowed_input_path() · data_guard.py · ForbiddenDataError | `model-training/tests/test_data_guard.py`<br/>`model-training/src/ourobion_model_lab/data_guard.py`<br/>`model-training/src/ourobion_model_lab/errors.py` |
| 339 | Community 339 | 70 | 75 | 23 | 0 | metric_detail_screen.dart · index.dart · _MetricDetailScreenState · ../../impl/chart_math.dart | `apps/biotope/lib/modules/m5a_baselines/ui/screens/metric_detail_screen.dart`<br/>`apps/biotope/lib/modules/m5a_baselines/index.dart` |
| 41 | Community 41 | 69 | 74 | 43 | 0 | package:supabase_flutter/supabase_flutter.dart · antibiotic_service.dart · auth_service.dart · SupabaseClient | `apps/biotope/lib/modules/m2_self_report/impl/antibiotic_service.dart`<br/>`apps/biotope/lib/modules/m1_core/impl/auth_service.dart`<br/>`apps/biotope/lib/modules/m1_core/impl/consent_service.dart` |
| 102 | Community 102 | 69 | 216 | 152 | 1 | authzServer.ts · route.ts · guardRole() · createServerSupabaseClient() | `apps/nao/src/lib/controlAudit.ts`<br/>`apps/nao/src/lib/authzServer.ts`<br/>`apps/nao/src/app/(app)/api/loader/route.ts` |
| 108 | Community 108 | 69 | 229 | 3 | 3 | run4_release_gate.mjs · fail() · run4_release_gate.test.mjs · validateRun4Workflow() | `tools/run4_release_gate.mjs`<br/>`tools/run4_release_gate.test.mjs` |
| 54 | Community 54 | 67 | 68 | 23 | 0 | living_backdrop.dart · daily_scale_value_visual.dart · daily_scale_visuals.dart · Color | `apps/biotope/lib/modules/m1_core/ui/widgets/living_backdrop.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/widgets/daily_scale_value_visual.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/widgets/daily_scale_visuals.dart` |
| 114 | Community 114 | 67 | 175 | 84 | 67 | HashMismatchError · job.py · load_data_manifest() · Path | `model-training/tests/test_manifests.py`<br/>`model-training/src/ourobion_model_lab/manifests.py`<br/>`model-training/src/ourobion_model_lab/errors.py` |
| 122 | Community 122 | 67 | 121 | 8 | 14 | release.py · EnvironmentSnapshot · ReleaseIncompleteError · TestForbiddenValues | `model-training/tests/test_release.py`<br/>`model-training/src/ourobion_model_lab/release.py`<br/>`model-training/src/ourobion_model_lab/environment.py` |
| 23 | Community 23 | 65 | 73 | 40 | 0 | sign_up_screen.dart · sign_in_screen.dart · app_shell.dart · waking_screen.dart | `apps/biotope/lib/modules/m1_core/ui/screens/sign_up_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/sign_in_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/waking_screen.dart` |
| 38 | Community 38 | 64 | 136 | 79 | 0 | types.ts · route.ts · route.ts · ingestControl.ts | `apps/nao/src/lib/types.ts`<br/>`apps/nao/src/lib/seedsControl.ts`<br/>`apps/nao/src/lib/ingestControl.ts` |
| 131 | Community 131 | 64 | 104 | 45 | 1 | loaderRuns.test.ts · loaderRuns.ts · buildPublicationSummary() · parseApplyResult() | `apps/nao/src/lib/loaderRuns.ts`<br/>`apps/nao/tests/loaderRuns.test.ts`<br/>`apps/nao/src/lib/simulatedHealth.ts` |
| 3 | Community 3 | 63 | 62 | 14 | 0 | provenance_models.dart · ProvenanceCardInfo · ProvenanceCompleteness · ProvenanceEdge | `apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart` |
| 79 | Community 79 | 62 | 105 | 65 | 0 | europepmc.ts · FetchOptions · crossref.test.ts · crossref.ts | `tools/brain-ingest/src/sources/discovery/crossref.ts`<br/>`tools/brain-ingest/src/sources/discovery/europepmc.ts`<br/>`tools/brain-ingest/src/sources/discovery/s2.ts` |
| 134 | Community 134 | 62 | 65 | 33 | 0 | deck_recovery_widget_test.dart · archive_status_widget_test.dart · archive_trends_widget_test.dart · InsightService | `apps/biotope/test/m5b_insight_engine/deck_recovery_widget_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/archive_status_widget_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/archive_trends_widget_test.dart` |
| 27 | Community 27 | 61 | 61 | 18 | 0 | metric_trend_section.dart · MetricTrendSectionState · MetricTrendSection · ../../../m2_self_report/index.dart | `apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_trend_section.dart` |
| 64 | Community 64 | 59 | 71 | 57 | 0 | package:flutter_test/flutter_test.dart · guard_support.dart · how_ourobion_works_copy_gate_test.dart · metrics_registry_engine_test.dart | `apps/biotope/test/guards/rules_table_contract_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/citation_link_test.dart`<br/>`apps/biotope/test/core/session_refresh_retry_test.dart` |
| 39 | Community 39 | 58 | 95 | 47 | 0 | index.ts · evaluators.ts · engine_condition_coverage.test.ts · windowedBaseline() | `supabase/functions/generate-insights/index.ts`<br/>`supabase/functions/generate-insights/evaluators.ts`<br/>`supabase/functions/generate-insights/composer.ts` |
| 135 | Community 135 | 58 | 63 | 26 | 0 | evidence_chain_rendering_test.dart · provenance_screen_widget_test.dart · provenance_citation_link_widget_test.dart · package:src/modules/m5b_insight_engine/impl/insight_service.dart | `apps/biotope/test/m5b_insight_engine/evidence_chain_rendering_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/provenance_citation_link_widget_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/provenance_screen_widget_test.dart` |
| 168 | Community 168 | 58 | 60 | 17 | 0 | deck_recovery_service_test.dart · daily_log_partial_write_test.dart · dart:convert · insight_card_model_test.dart | `apps/biotope/test/m5b_insight_engine/deck_recovery_service_test.dart`<br/>`apps/biotope/test/m2_self_report/daily_log_partial_write_test.dart`<br/>`apps/biotope/test/m5b_insight_engine/insight_card_model_test.dart` |
| 141 | Community 141 | 56 | 105 | 50 | 35 | splits.py · build_components() · _row() · build_splits() | `docs/development/model-training/zebra-training/src/zebra/splits.py`<br/>`docs/development/model-training/zebra-training/tests/test_splits.py` |
| 144 | Community 144 | 56 | 95 | 41 | 8 | data.py · build_example() · select_evidence_sentences() · FakeTokenizer | `docs/development/model-training/zebra-training/src/zebra/data.py`<br/>`docs/development/model-training/zebra-training/tests/test_evidence_label_blind.py` |
| 30 | Community 30 | 55 | 100 | 90 | 0 | router.test.ts · apiWorker.test.ts · helpers.ts · rawBody.test.ts | `tools/llm-router/tests/router.test.ts`<br/>`tools/llm-router/tests/helpers.ts`<br/>`tools/llm-router/tests/apiWorker.test.ts` |
| 148 | Community 148 | 55 | 96 | 55 | 14 | data.py · build_dataset() · build_example() · FakeTokenizer | `docs/development/model-training/viceroy-training/tests/test_data.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/data.py` |
| 5 | Community 5 | 54 | 105 | 31 | 1 | core.retrieval.test.ts · capture.ts · core.ts · capture.test.ts | `tools/brain-ingest/src/retrieval/capture.ts`<br/>`tools/brain-ingest/src/retrieval/core.ts`<br/>`tools/brain-ingest/tests/core.retrieval.test.ts` |
| 42 | Community 42 | 54 | 105 | 14 | 0 | modelsControl.ts · BrainPipelinePanel.tsx · ModelsPanel.tsx · modelsControl.test.ts | `apps/nao/src/lib/modelsControl.ts`<br/>`apps/nao/src/lib/brainPipelineControl.ts`<br/>`apps/nao/src/components/BrainPipelinePanel.tsx` |
| 149 | Community 149 | 54 | 54 | 19 | 0 | insight_card_visual.dart · _ResearchBasisState · ProvenanceCitation · ProvenanceQuoteSpan | `apps/biotope/lib/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/impl/provenance_models.dart` |
| 151 | Community 151 | 54 | 127 | 58 | 25 | __init__.py · MetricsError · metrics.py · _check_nonempty() | `docs/development/model-training/viceroy-training/src/viceroy/metrics.py`<br/>`docs/development/model-training/viceroy-training/tests/test_metrics.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/__init__.py` |
| 7 | Community 7 | 53 | 103 | 42 | 0 | identity.ts · idconv.ts · idconv.test.ts · normalizeIdentifiers() | `tools/brain-ingest/src/identity.ts`<br/>`tools/brain-ingest/src/sources/idconv.ts`<br/>`tools/brain-ingest/tests/idconv.test.ts` |
| 124 | Community 124 | 53 | 115 | 78 | 0 | liveAcceptance.ts · runLiveAcceptance() · liveAcceptance.test.ts · acceptanceJournalRepoPath() | `tools/brain-ingest/src/liveAcceptance.ts`<br/>`tools/brain-ingest/tests/liveAcceptance.test.ts`<br/>`tools/brain-ingest/src/verify/verifier.ts` |
| 153 | Community 153 | 53 | 86 | 105 | 0 | artifactPromotion.ts · artifactPromotion.test.ts · R2Store · blueprint.ts | `tools/brain-ingest/src/synth/blueprint.ts`<br/>`tools/brain-ingest/tests/artifactPromotion.test.ts`<br/>`tools/brain-ingest/src/artifactPromotion.ts` |
| 19 | Community 19 | 52 | 93 | 48 | 0 | SourceName · unpaywall.test.ts · budget.ts · FileBudgetGuard | `tools/brain-ingest/src/limits/budget.ts`<br/>`tools/brain-ingest/tests/unpaywall.test.ts`<br/>`tools/brain-ingest/src/limits/rateLimiter.ts` |
| 28 | Community 28 | 52 | 53 | 3 | 0 | registry.dart · DailyProjection · num? · EventDailyProjection | `shared/metrics/lib/src/registry.dart` |
| 32 | Community 32 | 52 | 51 | 3 | 0 | theme.dart · authBreathe · background · base | `apps/biotope/lib/core/theme.dart` |
| 48 | Community 48 | 52 | 145 | 178 | 0 | index.ts · router.ts · budget.ts · LlmNodeId | `tools/llm-router/src/overrides.ts`<br/>`tools/llm-router/src/router.ts`<br/>`tools/llm-router/src/types.ts` |
| 167 | Community 167 | 52 | 109 | 60 | 27 | cli.py · RawExample · cmd_dry_run() · ViceroyConfig | `docs/development/model-training/viceroy-training/src/viceroy/cli.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/data.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/config.py` |
| 4 | Community 4 | 51 | 82 | 0 | 3 | win32_window.cpp · Create() · MessageHandler() · WndProc() | `apps/biotope/windows/runner/win32_window.cpp`<br/>`apps/biotope/windows/runner/flutter_window.cpp`<br/>`apps/biotope/windows/flutter/generated_plugin_registrant.cc` |
| 35 | render graph view mjs | 51 | 87 | 0 | 1 | render_graph_view.mjs · renderGraphView() · generate_graph_view.mjs · render_graph_html.mjs | `tools/graph-view/lib/render_graph_view.mjs`<br/>`tools/graph-view/generate_graph_view.mjs`<br/>`tools/graph-view/lib/render_graph_html.mjs` |
| 172 | Community 172 | 51 | 124 | 27 | 46 | ResolvedRelease · acquire_release() · _release() · FakeClient | `model-training/tests/test_inference_acquire.py`<br/>`model-training/src/ourobion_model_lab/inference/releases.py`<br/>`model-training/src/ourobion_model_lab/inference/acquire.py` |
| 177 | Community 177 | 51 | 112 | 1 | 1 | check_arch_boundaries.mjs · check_arch_boundaries.test.mjs · analyze() · checkR2b() | `tools/check_arch_boundaries.mjs`<br/>`tools/check_arch_boundaries.test.mjs` |
| 55 | Community 55 | 50 | 78 | 47 | 0 | engine_composer_render.test.ts · render.ts · composer_test.ts · causal_copy_gate.test.ts | `supabase/functions/generate-insights/render.ts`<br/>`supabase/functions/generate-insights/composer_test.ts`<br/>`tools/rules/tests/engine_composer_render.test.ts` |
| 137 | Community 137 | 50 | 53 | 40 | 0 | ../../../../shared/constants/copy_guidelines.dart · profile_load_failure_test.dart · profile_digest_test.dart · signals_detail_copy_gate_test.dart | `apps/biotope/test/m1_core/profile_load_failure_test.dart`<br/>`apps/biotope/test/m1_core/profile_preference_truthfulness_test.dart`<br/>`apps/biotope/test/m1_core/profile_digest_test.dart` |
| 8 | Community 8 | 49 | 85 | 53 | 0 | openalex.ts · types.ts · openalex.test.ts · unpaywall.ts | `tools/brain-ingest/src/sources/oa/openalex.ts`<br/>`tools/brain-ingest/src/types.ts`<br/>`tools/brain-ingest/src/sources/oa/unpaywall.ts` |
| 10 | Baseline Service Snapshots | 49 | 52 | 0 | 1 | Ourobion — Brand & Logo Design Principles · Ourobion — Brand Assets · Ourobion Biotope — Logo & Design Notes · Ourobion Biotope — Brand Assets | `assets/ourobion-brand/DESIGN.md`<br/>`assets/ourobion-biotope-logo/DESIGN.md`<br/>`assets/ourobion-biotope-logo/README.md` |
| 15 | Community 15 | 49 | 58 | 56 | 0 | types.ts · paperSynth.test.ts · prompt.ts · SynthesizePapersResult | `tools/brain-ingest/tests/paperSynth.test.ts`<br/>`tools/brain-ingest/src/synth/types.ts`<br/>`tools/brain-ingest/src/synth/prompt.ts` |
| 180 | Community 180 | 49 | 50 | 26 | 0 | profile_tab.dart · ../../impl/auth_service.dart · ../../impl/profile_service.dart · _DailyDigestToggleState | `apps/biotope/lib/modules/m1_core/ui/screens/profile_tab.dart`<br/>`apps/biotope/lib/modules/m1_core/index.dart` |
| 18 | Community 18 | 48 | 47 | 7 | 0 | insight_service.dart · _client · _parseCategory · _parseDbTimestamp | `apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart` |
| 24 | Community 24 | 48 | 49 | 51 | 0 | insights_tab.dart · static const · app_preferences.dart · String get | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insights_tab.dart`<br/>`apps/biotope/lib/core/app_preferences.dart`<br/>`apps/biotope/lib/core/brand_assets.dart` |
| 190 | Community 190 | 48 | 77 | 22 | 0 | authz.test.ts · naoAccess.test.ts · naoAccess.ts · satisfies() | `apps/nao/tests/authz.test.ts`<br/>`apps/nao/tests/naoAccess.test.ts`<br/>`apps/nao/src/lib/naoAccess.ts` |
| 16 | Community 16 | 47 | 51 | 70 | 0 | ../../../../core/theme.dart · stool_form_screen.dart · urine_color_screen.dart · likert_check_in_card.dart | `apps/biotope/lib/modules/m2_self_report/ui/screens/stool_form_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/urine_color_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/widgets/likert_check_in_card.dart` |
| 200 | Community 200 | 46 | 80 | 0 | 0 | TestLicenceGate · _approval() · .write() · test_cli.py | `docs/development/model-training/viceroy-training/tests/test_cli.py` |
| 22 | Community 22 | 44 | 113 | 0 | 0 | context_sync.mjs · read() · runCheck() · isFile() | `tools/context_sync.mjs` |
| 142 | Community 142 | 44 | 45 | 32 | 0 | metric_detail_screen_test.dart · metric_trend_section_widget_test.dart · MetricSeriesService · package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart | `apps/biotope/test/m5a_baselines/metric_detail_screen_test.dart`<br/>`apps/biotope/test/m5a_baselines/metric_trend_section_widget_test.dart`<br/>`apps/biotope/test/m5a_baselines/trend_copy_gate_test.dart` |
| 6 | Community 6 | 43 | 70 | 56 | 0 | SourceCtx · arxivPdf.test.ts · arxiv.test.ts · arxiv.ts | `tools/brain-ingest/src/sources/discovery/arxiv.ts`<br/>`tools/brain-ingest/src/retrieval/arxivPdf.ts`<br/>`tools/brain-ingest/tests/arxivPdf.test.ts` |
| 123 | Community 123 | 43 | 76 | 86 | 0 | verify.test.ts · retrieval.ts · verifyClaim() · triage.ts | `tools/brain-ingest/src/verify/retrieval.ts`<br/>`tools/brain-ingest/tests/verify.test.ts`<br/>`tools/brain-ingest/src/verify/triage.ts` |
| 205 | Community 205 | 43 | 83 | 101 | 88 | ConfigError · PreflightReport · JobConfig · load_config() | `model-training/src/ourobion_model_lab/job.py`<br/>`model-training/tests/test_config.py`<br/>`model-training/src/ourobion_model_lab/config.py` |
| 207 | Community 207 | 43 | 42 | 0 | 0 | 5 · Authoring + loop stages (the paper side) · Insight-engine architecture — design spec · 4 · Serve-path stages · 8 · Control flow | `docs/implemented/shared/insight-engine-architecture.md` |
| 17 | Community 202 | 42 | 47 | 0 | 0 | Graphify Knowledge Graph Pipeline · Graphify Incremental Update · Graphify Query Path and Explain Flow · Semantic Extraction Contract | `.claude/skills/graphify/SKILL.md`<br/>`.claude/skills/graphify/references/extraction-spec.md`<br/>`.claude/skills/graphify/references/query.md` |
| 37 | Community 37 | 42 | 75 | 58 | 0 | composer.ts · engine_orientation_gap.test.ts · edge_trust_gate.test.ts · classifyPattern() | `supabase/functions/generate-insights/composer.ts`<br/>`tools/rules/tests/engine_orientation_gap.test.ts`<br/>`tools/rules/tests/edge_trust_gate.test.ts` |
| 210 | Community 210 | 42 | 87 | 36 | 11 | cli.py · build_dataset() · RawExample · ZebraConfig | `docs/development/model-training/zebra-training/src/zebra/cli.py`<br/>`docs/development/model-training/zebra-training/src/zebra/data.py` |
| 240 | Community 240 | 41 | 59 | 35 | 0 | redact.test.ts · authz.ts · prepareControlMutationStorage() · sanitizeStorageValue() | `apps/nao/tests/redact.test.ts`<br/>`apps/nao/src/lib/authz.ts`<br/>`apps/nao/src/lib/loaderRuns.ts` |
| 241 | Community 241 | 41 | 41 | 12 | 0 | scan_test_support.dart · ScanGapListHost · ScanGapListHostState · answered | `apps/biotope/test/m2_self_report/scan_test_support.dart` |
| 242 | Community 242 | 41 | 41 | 25 | 0 | archive_tab.dart · _ArchiveTabState · ../../../m5a_baselines/index.dart · ArchiveTab | `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/archive_tab.dart` |
| 67 | Community 67 | 40 | 67 | 63 | 0 | quoteCheck.ts · paperPostprocess.ts · postprocess.ts · processSynthesisResponse() | `tools/brain-ingest/src/verify/quoteCheck.ts`<br/>`tools/brain-ingest/src/synth/paperPostprocess.ts`<br/>`tools/brain-ingest/src/synth/postprocess.ts` |
| 301 | Community 301 | 40 | 65 | 37 | 27 | load_release() · releases.py · parse_checksum_manifest() · sha256_file() | `model-training/tests/test_inference_releases.py`<br/>`model-training/src/ourobion_model_lab/inference/releases.py`<br/>`model-training/src/ourobion_model_lab/manifests.py` |
| 83 | Community 83 | 39 | 47 | 19 | 0 | rule.schema.ts · rules_table_schema.test.ts · engine_cards_schema.test.ts · REPO_ROOT | `shared/rules/rule.schema.ts`<br/>`tools/rules/tests/rules_table_schema.test.ts`<br/>`tools/rules/tests/engine_cards_schema.test.ts` |
| 302 | Community 302 | 39 | 64 | 57 | 25 | splits.py · build_splits() · near_duplicate_pairs() · ProcessedExample | `docs/development/model-training/viceroy-training/src/viceroy/splits.py`<br/>`docs/development/model-training/viceroy-training/tests/test_splits.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/data.py` |
| 304 | Community 304 | 39 | 99 | 37 | 2 | __init__.py · metrics.py · MetricsError · _check_nonempty() | `docs/development/model-training/zebra-training/src/zebra/metrics.py`<br/>`docs/development/model-training/zebra-training/src/zebra/__init__.py` |
| 9 | Community 9 | 38 | 39 | 28 | 0 | antibiotic_course_screen.dart · symptom_flags_screen.dart · IconData · _set | `apps/biotope/lib/modules/m2_self_report/ui/screens/antibiotic_course_screen.dart`<br/>`apps/biotope/lib/modules/m2_self_report/ui/screens/symptom_flags_screen.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/profile_tab.dart` |
| 11 | Community 11 | 38 | 60 | 23 | 0 | simulatedHealth.ts · simulatedHealth.test.ts · generateSimulatedDays() · planLoadRange() | `apps/nao/src/lib/simulatedHealth.ts`<br/>`apps/nao/tests/simulatedHealth.test.ts`<br/>`apps/nao/src/app/(app)/loader/page.tsx` |
| 93 | Community 93 | 38 | 40 | 10 | 1 | relationships.schema.ts · edge_table_schema.test.ts · relationKindSchema · validateClaim() | `shared/brain/relationships.schema.ts`<br/>`tools/edge-loader/tests/edge_table_schema.test.ts` |
| 305 | Community 305 | 38 | 38 | 12 | 0 | quick_count_control.dart · _QuickCountControlState · QuickCountControl · int get | `apps/biotope/lib/modules/m2_self_report/ui/widgets/quick_count_control.dart` |
| 78 | Community 78 | 37 | 36 | 2 | 0 | chart_math.dart · _shortMonths · _snapTick · compactValueLabel | `apps/biotope/lib/modules/m5a_baselines/impl/chart_math.dart` |
| 96 | Community 96 | 37 | 75 | 16 | 0 | stats.ts · s5_pairwise.test.ts · config.ts · s4_signal.test.ts | `supabase/functions/evaluate-signals/stats.ts`<br/>`supabase/functions/evaluate-signals/config.ts`<br/>`tools/engine-stats/tests/s4_signal.test.ts` |
| 327 | Community 327 | 37 | 36 | 12 | 8 | test_metrics.py · TestBrierAndEce · TestConfusionMatrixAndPrf1 · TestTemperature | `docs/development/model-training/viceroy-training/tests/test_metrics.py` |
| 338 | Community 338 | 37 | 63 | 30 | 19 | ProcessedExample · model.py · train() · ToySmokeTokenizer | `docs/development/model-training/zebra-training/src/zebra/model.py`<br/>`docs/development/model-training/zebra-training/src/zebra/config.py`<br/>`docs/development/model-training/zebra-training/src/zebra/data.py` |
| 341 | Community 341 | 37 | 36 | 0 | 0 | Demo runbook — 3-minute video production plan · 1b. Section-by-section map to the internal system · 7. The six slides · 3. What nao can actually be filmed doing | `docs/hackathon/the_launchpad_challenge/plan/demo-runbook.md` |
| 370 | Community 370 | 37 | 76 | 58 | 1 | singlePaper.ts · runSinglePaper() · passages.ts · loadVerificationValidator() | `tools/brain-ingest/src/singlePaper.ts`<br/>`tools/brain-ingest/src/synth/passages.ts`<br/>`tools/brain-ingest/tests/singlePaper.test.ts` |
| 53 | Community 53 | 36 | 77 | 48 | 0 | PaperRecord · Manifest · manifest.ts · manifestCheckpoint.ts | `tools/brain-ingest/src/manifest.ts`<br/>`tools/brain-ingest/src/manifestCheckpoint.ts`<br/>`tools/brain-ingest/tests/manifestCheckpoint.test.ts` |
| 90 | Community 90 | 36 | 60 | 72 | 0 | _state · StatefulWidget · SingleTickerProviderStateMixin · HomeTabState | `apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart`<br/>`apps/biotope/lib/core/widgets/biotope_auth_scaffold.dart`<br/>`apps/biotope/lib/modules/m1_core/ui/screens/home_tab.dart` |
| 238 | Community 238 | 36 | 35 | 1 | 0 | trust_labels.dart · copy_guidelines.dart · static const List · static const Map | `shared/brain/trust_labels.dart`<br/>`shared/constants/copy_guidelines.dart` |
| 411 | Community 411 | 36 | 38 | 21 | 0 | scan_tab_widgets_test.dart · named_scale_visual_test.dart · _AnsweringList · _AnsweringListState | `apps/biotope/test/m2_self_report/scan_tab_widgets_test.dart`<br/>`apps/biotope/test/m5a_baselines/named_scale_visual_test.dart` |
| 413 | Community 413 | 36 | 57 | 23 | 12 | model.py · train() · ToySmokeTokenizer · ModelError | `docs/development/model-training/viceroy-training/src/viceroy/model.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/config.py` |
| 531 | Community 531 | 36 | 35 | 0 | 0 | hackathon-direction.md — Ourobion @ Launchpad 2026 AI Challenge · 3 · Positioning & narrative · 0.5 · Self-judgement response (post-adversarial round) · 5 · Sponsor integration (all three, each load-bearing — sponsors are … | `docs/hackathon/the_launchpad_challenge/plan/hackathon-direction.md` |
| 609 | Community 609 | 36 | 36 | 7 | 0 | how_ourobion_works_screen.dart · _HowOurobionWorksScreenState · HowOurobionWorksScreen · _availableExpanded | `apps/biotope/lib/modules/m1_core/ui/screens/how_ourobion_works_screen.dart` |
| 100 | Community 100 | 35 | 56 | 29 | 1 | gapsControl.ts · route.ts · gapsControl.test.ts · layout.tsx | `apps/nao/src/lib/gapsControl.ts`<br/>`apps/nao/src/app/login/page.tsx`<br/>`apps/nao/src/app/(app)/api/gaps/route.ts` |
| 384 | Community 384 | 35 | 60 | 17 | 1 | internal_auth.ts · internal_auth.test.ts · internalSecret.test.ts · index.ts | `supabase/functions/_shared/internal_auth.test.ts`<br/>`supabase/functions/_shared/internal_auth.ts`<br/>`apps/nao/tests/internalSecret.test.ts` |
| 621 | Community 621 | 35 | 45 | 65 | 45 | ViceroyConfig · config.py · TestViceroyConfigSerialization · Path | `docs/development/model-training/viceroy-training/tests/test_config.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/config.py` |
| 622 | Community 622 | 35 | 34 | 0 | 0 | 2. New optimisation items (O31–O40) · Run 4 — reviewed candidate scope and priority tranche · 4. Carried forward from the pending-build register · 3c. Run 4 exit gate — local qualification before cloud promotion | `docs/development/run4/next-build-optimizations.md` |
| 29 | Community 29 | 34 | 33 | 0 | 0 | devDependencies · scripts · dependencies · package.json | `apps/nao/package.json` |
| 31 | Community 198 | 34 | 42 | 0 | 6 | Ourobion biotope Flutter App · Ourobion biotope — Flutter app · Prerequisites · DailyGutRow Raw Data Asset | `apps/biotope/README.md`<br/>`apps/biotope/lib/modules/m2_self_report/m2-context.md`<br/>`apps/biotope/lib/modules/m1_core/m1-context.md` |
| 623 | Community 623 | 34 | 34 | 16 | 0 | metric_trend_axis_widget_test.dart · metric_tile_tap_test.dart · metric_tile_overflow_test.dart · package:src/modules/m5a_baselines/impl/metric_series_models.dart | `apps/biotope/test/m5a_baselines/metric_trend_axis_widget_test.dart`<br/>`apps/biotope/test/m5a_baselines/metric_tile_tap_test.dart`<br/>`apps/biotope/test/m5a_baselines/metric_tile_overflow_test.dart` |
| 624 | Community 624 | 34 | 33 | 17 | 0 | insight_deck.dart · _EmptyDeck · _FrontCard · _GhostCard | `apps/biotope/lib/modules/m5b_insight_engine/ui/widgets/insight_deck.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart` |
| 625 | Community 625 | 34 | 34 | 0 | 0 | test_model_inference_workflow.py · TestNoProhibitedOperations · TestPermissionsAndEnvironment · TestInputSurface | `model-training/tests/test_model_inference_workflow.py` |
| 33 | Community 33 | 33 | 52 | 21 | 0 | pubmed.ts · pubmed.test.ts · articleToCandidate() · textOf() | `tools/brain-ingest/src/sources/discovery/pubmed.ts`<br/>`tools/brain-ingest/tests/pubmed.test.ts` |
| 61 | Community 61 | 33 | 62 | 30 | 0 | NaoAccess.tsx · IngestControlPanel.tsx · SeedsPanel.tsx · GapsPanel.tsx | `apps/nao/src/components/NaoAccess.tsx`<br/>`apps/nao/src/components/GapsPanel.tsx`<br/>`apps/nao/src/components/IngestControlPanel.tsx` |
| 86 | Community 86 | 33 | 32 | 10 | 0 | logging_controller.dart · _client · anxiety · appetite | `apps/biotope/lib/modules/m2_self_report/impl/logging_controller.dart` |
| 378 | Community 378 | 33 | 32 | 18 | 0 | insight_deck_order_test.dart · inline_control_range_test.dart · package:src/modules/m2_self_report/impl/logging_controller.dart · package:src/modules/m2_self_report/impl/normaliser.dart | `apps/biotope/test/m5b_insight_engine/insight_deck_order_test.dart`<br/>`apps/biotope/test/m2_self_report/inline_control_range_test.dart`<br/>`apps/biotope/test/m2_self_report/normaliser_test.dart` |
| 626 | Community 626 | 33 | 70 | 57 | 0 | attemptJournal.ts · AttemptJournal · acceptanceAuthorizationHash() · validateAcceptanceAuthorization() | `tools/llm-router/src/attemptJournal.ts`<br/>`tools/brain-ingest/tests/liveAcceptance.test.ts`<br/>`tools/llm-router/src/config.ts` |
| 627 | Community 627 | 32 | 31 | 46 | 0 | List · archive_empty_state_widget_test.dart · biotope_shell_visuals_test.dart · home_hero_parity_widget_test.dart | `apps/biotope/test/m5b_insight_engine/archive_empty_state_widget_test.dart`<br/>`apps/biotope/test/m1_core/home_hero_parity_widget_test.dart`<br/>`apps/biotope/test/core/biotope_shell_visuals_test.dart` |
| 628 | Community 628 | 32 | 31 | 0 | 0 | Five custom-model training plans — workability review · 3. Cross-plan findings · 10. One-day constraint: what is and is not possible · 4. Zebra NLI Shadow v0 | `docs/development/model-training/five-model-training-plans-review.md` |
| 629 | Community 629 | 32 | 44 | 10 | 18 | build_label_permutation() · TestViceroyPermutation · TestZebraPermutation · test_inference_engine.py | `model-training/tests/test_inference_engine.py`<br/>`model-training/src/ourobion_model_lab/inference/runners/_engine.py` |
| 630 | Community 630 | 32 | 49 | 10 | 19 | MetricInputError · TestExpectedCalibrationError · expected_calibration_error() · metrics.py | `model-training/tests/test_metrics.py`<br/>`model-training/src/ourobion_model_lab/metrics.py`<br/>`model-training/src/ourobion_model_lab/errors.py` |
| 49 | Community 310 | 31 | 34 | 0 | 5 | Semantic context graph · shared/rules — the rule-blueprint contract · 0008-graphify-context-tool.md · Graphify operational policy | `shared/rules/README.md`<br/>`docs/graph/README.md`<br/>`docs/memory/0008-graphify-context-tool.md` |
| 128 | Community 128 | 31 | 64 | 32 | 0 | page.tsx · palette.ts · PaperCard.tsx · retrievabilityColor() | `apps/nao/src/app/(app)/paper/[uid]/page.tsx`<br/>`apps/nao/src/lib/palette.ts`<br/>`apps/nao/src/components/PaperCard.tsx` |
| 631 | Community 631 | 31 | 30 | 10 | 8 | test_metrics.py · TestConfusionMatrixAndPrf1 · TestBrier · TestEceEqualMass | `docs/development/model-training/zebra-training/tests/test_metrics.py` |
| 632 | Community 632 | 31 | 30 | 0 | 0 | Zebra NLI Shadow v0 — GMI training and evaluation plan · 3. GMI platform decision · 5. Dataset and licence gate · 11. Completion, outcome, and future-promotion gates | `docs/development/model-training/zebra-nli-shadow-v0-training-plan.md` |
| 633 | Community 633 | 30 | 29 | 17 | 0 | onboarding_truthfulness_test.dart · dart:io · how_ourobion_works_isolation_test.dart · home_design_alignment_test.dart | `apps/biotope/test/m1_core/onboarding_truthfulness_test.dart`<br/>`apps/biotope/test/m1_core/how_ourobion_works_isolation_test.dart`<br/>`apps/biotope/test/m1_core/home_design_alignment_test.dart` |
| 50 | Community 50 | 29 | 28 | 7 | 0 | main.dart · AuthGate · OurobionApp · _checkOnboarding | `apps/biotope/lib/main.dart` |
| 162 | Community 162 | 29 | 43 | 0 | 4 | demo-dryrun-run2.ps1 · native-process.ps1 · Invoke-NativeProcess() · Invoke-NodePackageCli() | `scripts/demo-dryrun-run2.ps1`<br/>`scripts/lib/native-process.ps1`<br/>`scripts/tests/native-process.tests.ps1` |
| 36 | Community 36 | 28 | 27 | 1 | 0 | generated_assets.dart · _base · archiveHerbariumSpecimen · archivePreservedFlowerFragment | `apps/biotope/lib/core/generated_assets.dart` |
| 109 | Community 109 | 28 | 48 | 48 | 1 | corpus.ts · evidenceTier.ts · classifyEvidenceTier() · CorpusDoc | `tools/brain-ingest/src/evidenceTier.ts`<br/>`tools/brain-ingest/src/verify/corpus.ts`<br/>`tools/brain-ingest/tests/evidenceTier.test.ts` |
| 119 | Community 119 | 28 | 33 | 12 | 0 | rule.ts · index.ts · _assert.ts · _assert.typetest.ts | `shared/rules/rule.ts`<br/>`shared/rules/index.ts`<br/>`shared/rules/_assert.ts` |
| 87 | Community 87 | 27 | 43 | 12 | 1 | artifacts.mjs · buildLoad() · edge_artifacts.test.ts · joinEdges() | `tools/edge-loader/lib/artifacts.mjs`<br/>`tools/edge-loader/tests/edge_artifacts.test.ts`<br/>`tools/edge-loader/tests/edge_human_verdicts.test.ts` |
| 634 | Community 634 | 27 | 26 | 10 | 0 | metric_axis_policy.dart · quick_count_control_test.dart · package:ourobion_metrics/ourobion_metrics.dart · metric_axis_policy_test.dart | `apps/biotope/lib/modules/m5a_baselines/impl/metric_axis_policy.dart`<br/>`apps/biotope/test/m2_self_report/quick_count_control_test.dart`<br/>`apps/biotope/test/m5a_baselines/metric_axis_policy_test.dart` |
| 635 | Community 635 | 27 | 26 | 0 | 0 | What Phase 2 contains (by workstream) · Phase 2 — Plan · The metric platform (the floor everything else stands on) · Tracks, dependencies & sequencing | `docs/development/phase-2-plan.md` |
| 46 | Community 46 | 26 | 25 | 0 | 0 | The Brain — Ingestion (paper corpus) Design · 10 · Build sequence · 2 · The source-API catalog · 5 · Tooling — fetch, capture, extract (TypeScript, no Python) | `docs/implemented/nao/brain-ingestion-design.md` |
| 58 | Community 58 | 26 | 25 | 0 | 0 | scripts · devDependencies · package.json · @iarna/toml | `package.json` |
| 101 | Community 101 | 26 | 26 | 9 | 0 | consent_screen.dart · _ConsentScreenState · ConsentScreen · _WearableStatementRow | `apps/biotope/lib/modules/m1_core/ui/screens/consent_screen.dart` |
| 111 | Community 111 | 26 | 39 | 13 | 0 | page.tsx · Facets.tsx · facets.ts · PapersPage() | `apps/nao/src/app/(app)/papers/page.tsx`<br/>`apps/nao/src/lib/facets.ts`<br/>`apps/nao/src/components/SortSelect.tsx` |
| 115 | Community 115 | 26 | 37 | 3 | 0 | view.mjs · generateViewSql() · local_projection_fixture.mjs · view_migration_drift.test.ts | `tools/metric-view/lib/view.mjs`<br/>`supabase/tests/metric-view/local_projection_fixture.mjs`<br/>`tools/metric-view/gen_metric_view.mjs` |
| 156 | Community 156 | 26 | 40 | 6 | 0 | load_edges.mjs · edge_loader_cli.test.ts · loadIntoDb() · main() | `tools/edge-loader/load_edges.mjs`<br/>`tools/edge-loader/tests/edge_loader_cli.test.ts` |
| 636 | Community 636 | 26 | 25 | 1 | 0 | TestZebraConfigValidation · TestZebraConfigHashAndSerialization · test_config.py · TestSeedAndDevice | `docs/development/model-training/zebra-training/tests/test_config.py` |
| 34 | Community 34 | 25 | 39 | 19 | 0 | claimsControl.ts · ClaimsPanel.tsx · route.ts · claimsControl.test.ts | `apps/nao/src/lib/claimsControl.ts`<br/>`apps/nao/src/components/ClaimsPanel.tsx`<br/>`apps/nao/src/app/(app)/api/claims/route.ts` |
| 44 | Community 44 | 25 | 32 | 0 | 2 | my_application.cc · _MyApplication · GApplication · my_application_local_command_line() | `apps/biotope/linux/runner/my_application.cc`<br/>`apps/biotope/linux/flutter/generated_plugin_registrant.cc`<br/>`apps/biotope/linux/runner/main.cc` |
| 47 | Community 47 | 25 | 36 | 14 | 0 | pmcJats.ts · pmcJats.test.ts · retrieveJats() · parseJats() | `tools/brain-ingest/src/retrieval/pmcJats.ts`<br/>`tools/brain-ingest/tests/pmcJats.test.ts` |
| 637 | Community 637 | 25 | 24 | 0 | 0 | Salmon Relation/Direction v0 — GMI training plan · 4. Dataset and licence gate · 5. Label construction · 1. Decision summary | `docs/development/model-training/salmon-relation-direction-v0-training-plan.md` |
| 638 | Community 638 | 25 | 27 | 47 | 0 | secret_scan_guard.mjs · validateAllowlistEntry() · checkConfigPolicy() · existedAtCommit() | `tools/secret_scan_guard.mjs` |
| 51 | Community 51 | 24 | 23 | 0 | 0 | What You Must Do When Invoked · /graphify · Step 3 - Extract entities and relationships · For --update and --cluster-only | `.claude/skills/graphify/SKILL.md` |
| 52 | Community 52 | 24 | 23 | 7 | 0 | engagement_service.dart · _client · _computeStreak · _dateStr | `apps/biotope/lib/modules/m6_engagement/impl/engagement_service.dart` |
| 59 | Community 59 | 24 | 41 | 78 | 1 | config.ts · LlmRouter · .route() · validateConfig() | `tools/llm-router/src/config.ts`<br/>`tools/llm-router/src/router.ts`<br/>`tools/llm-router/src/types.ts` |
| 639 | Community 639 | 24 | 23 | 14 | 0 | metric_trend_axis_test.dart · knowledge_base_service.dart · bool get · KnowledgeBaseStats | `apps/biotope/test/m5a_baselines/metric_trend_axis_test.dart`<br/>`apps/biotope/lib/modules/m5b_insight_engine/impl/knowledge_base_service.dart` |
| 640 | Community 640 | 24 | 39 | 4 | 13 | assert_disjoint_groups() · SplitLeakageError · assert_no_duplicate_normalized_text() · TestDisjointGroups | `model-training/tests/test_splits.py`<br/>`model-training/src/ourobion_model_lab/splits.py`<br/>`model-training/src/ourobion_model_lab/errors.py` |
| 641 | Community 641 | 24 | 38 | 11 | 0 | gmi_preflight.py · run_preflight() · _check_python_version() · _check_credentials_present() | `model-training/tests/test_gmi_preflight.py`<br/>`model-training/src/ourobion_model_lab/gmi_preflight.py`<br/>`model-training/src/ourobion_model_lab/self_check.py` |
| 642 | Community 642 | 24 | 23 | 0 | 0 | Hackathon submission write-up · refreshed against issue #277 · 2 · The model section, in full · 1 · Five pillars (submission text) · 3 · Corrections required in the shared submission docs | `docs/development/run4/hack-submission-277.md` |
| 643 | Community 643 | 24 | 24 | 13 | 0 | metric_tile.dart · _MetricTileState · MetricTile · _MiniBars | `apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_tile.dart` |
| 56 | Community 56 | 23 | 22 | 6 | 0 | baseline_service.dart · BaselineConfidence · BaselineTrend · _client | `apps/biotope/lib/modules/m5a_baselines/impl/baseline_service.dart` |
| 57 | Community 57 | 23 | 22 | 0 | 0 | compilerOptions · tsconfig.json · paths · @/* | `apps/nao/tsconfig.json` |
| 65 | Community 65 | 23 | 24 | 14 | 0 | registry.ts · index.ts · METRICS · MetricTable | `shared/metrics/registry.ts`<br/>`shared/metrics/index.ts` |
| 191 | Community 191 | 23 | 32 | 9 | 1 | extracted.mjs · load_rules.mjs · main() · extracted_blueprints.test.ts | `tools/rules/lib/extracted.mjs`<br/>`tools/rules/load_rules.mjs`<br/>`tools/rules/tests/extracted_blueprints.test.ts` |
| 644 | Community 644 | 23 | 22 | 0 | 0 | Model-training code build — resumable log · Unit MT0 — CI-fix pass after the first real CI run (2026-07-27) · Unit MT0 — remediation pass after adversarial evaluation (2026-07-27) · Unit MT0 — Repository policy and shared training substrate | `docs/development/model-training/code-build-log.md` |
| 645 | Community 645 | 23 | 22 | 0 | 0 | Giraffe Study-Design v0 — GMI training plan · 4. Dataset and licence gate · 1. Decision summary · 9. Preregistered training recipe | `docs/development/model-training/giraffe-study-design-v0-training-plan.md` |
| 62 | Community 62 | 22 | 36 | 9 | 0 | index.ts · buildSnapshots() · lifecycle.ts · s3_baseline_lifecycle.test.ts | `supabase/functions/compute-baselines/index.ts`<br/>`supabase/functions/compute-baselines/lifecycle.ts`<br/>`tools/engine-stats/tests/s3_baseline_lifecycle.test.ts` |
| 63 | Community 63 | 22 | 21 | 0 | 0 | package.json · scripts · dependencies · devDependencies | `tools/edge-loader/package.json` |
| 69 | Community 69 | 22 | 29 | 20 | 0 | index.ts · lifecycle.ts · s5_lifecycle.test.ts · computeStalePairs() | `supabase/functions/evaluate-signals/index.ts`<br/>`supabase/functions/evaluate-signals/lifecycle.ts`<br/>`tools/engine-stats/tests/s5_lifecycle.test.ts` |
| 81 | Community 81 | 22 | 21 | 14 | 0 | wearable_service.dart · double? · Duration · _aggregate | `apps/biotope/lib/modules/m3_passive_health/impl/wearable_service.dart` |
| 171 | Community 171 | 22 | 39 | 66 | 0 | apiWorker.ts · callApiWorker() · providerContentSha256() · priceIsAuthoritativeAt() | `tools/llm-router/src/routes/apiWorker.ts`<br/>`tools/llm-router/src/raw.ts`<br/>`tools/llm-router/src/attemptJournal.ts` |
| 366 | Community 366 | 22 | 32 | 34 | 0 | route.ts · POST() · serverKey.ts · redactRelayBody() | `apps/nao/src/lib/serverKey.ts`<br/>`apps/nao/src/app/(app)/api/loader/run-pipeline/route.ts`<br/>`apps/nao/src/lib/loaderRuns.ts` |
| 646 | Community 646 | 22 | 22 | 16 | 0 | scan_sweep_test.dart · scan_globe_states_test.dart · wearable_service_timeout_test.dart · package:flutter/foundation.dart | `apps/biotope/test/m2_self_report/scan_sweep_test.dart`<br/>`apps/biotope/test/m2_self_report/scan_globe_states_test.dart`<br/>`apps/biotope/test/m3_passive_health/wearable_service_timeout_test.dart` |
| 647 | Community 647 | 22 | 30 | 19 | 1 | cli.py · get_logger() · main() · get_job_class() | `model-training/src/ourobion_model_lab/cli.py`<br/>`model-training/src/ourobion_model_lab/logging_utils.py`<br/>`model-training/tests/test_logging_utils.py` |
| 648 | Community 648 | 22 | 21 | 7 | 0 | insight_status_contract_test.dart · _quotedLiterals · _stripLineComments · body | `apps/biotope/test/m5b_insight_engine/insight_status_contract_test.dart` |
| 649 | Community 649 | 22 | 21 | 0 | 0 | Viceroy Claim-Kind v0 — GMI training plan · 4. Dataset and licence gate · 1. Decision summary · 8. Preregistered training recipe | `docs/development/model-training/viceroy-claim-kind-v0-training-plan.md` |
| 68 | Community 68 | 21 | 20 | 0 | 0 | package.json · dependencies · devDependencies · scripts | `tools/brain-ingest/package.json` |
| 71 | Community 71 | 21 | 20 | 0 | 0 | package.json · scripts · devDependencies · allowScripts | `tools/metric-view/package.json` |
| 72 | Community 72 | 21 | 35 | 19 | 0 | europepmcFulltext.test.ts · europepmcFulltext.ts · fetchEuropePmcJats() · jatsToText() | `tools/brain-ingest/src/retrieval/europepmcFulltext.ts`<br/>`tools/brain-ingest/tests/europepmcFulltext.test.ts` |
| 73 | Community 73 | 21 | 20 | 0 | 0 | package.json · scripts · dependencies · devDependencies | `tools/rules/package.json` |
| 91 | Community 91 | 21 | 30 | 0 | 0 | Session 20260617T041218Z — uandiqueue — claude — graphify-adoption · Session 20260610T093356Z — uandiqueue — claude — graphify-dart-probe · Session 20260617T064658Z — uandiqueue — claude — graphify-setup-and-r… · 20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md | `docs/sessions/20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md`<br/>`docs/sessions/20260617T041218Z-uandiqueue-claude-graphify-adoption.md`<br/>`docs/sessions/20260617T064658Z-uandiqueue-claude-graphify-setup-and-readme.md` |
| 104 | Community 104 | 21 | 42 | 6 | 0 | d1.test.ts · etl.mjs · manifestToSql() · createImportSnapshot() | `apps/nao/scripts/etl.mjs`<br/>`apps/nao/tests/d1.test.ts` |
| 138 | Community 138 | 21 | 22 | 7 | 0 | registry.schema.ts · projection_policy.test.ts · MetricDefinition · validateRegistry() | `shared/metrics/registry.schema.ts`<br/>`tools/metric-view/tests/projection_policy.test.ts`<br/>`shared/metrics/registry.ts` |
| 650 | Community 650 | 21 | 20 | 0 | 0 | ui-design-context.md — Ourobion · Component Specs · AI-Generated Image Assets · Cards | `docs/implemented/biotope/ui-design-context.md` |
| 651 | Community 651 | 21 | 39 | 6 | 0 | brainPipelineGithub.ts · dispatchBrainPipeline() · inspectBrainPipeline() · brainPipelineGithub.test.ts | `apps/nao/src/lib/brainPipelineGithub.ts`<br/>`apps/nao/tests/brainPipelineGithub.test.ts` |
| 652 | Community 652 | 21 | 38 | 11 | 6 | LocalFilesystemStorage · Path · TestLocalFilesystemStorage · ._resolve() | `model-training/src/ourobion_model_lab/storage.py`<br/>`model-training/tests/test_storage.py` |
| 653 | Community 653 | 21 | 29 | 19 | 0 | server_keys.ts · resolveServerKey() · server_keys.test.ts · ServerKeyConfigurationError | `supabase/functions/_shared/server_keys.ts`<br/>`supabase/functions/_shared/engine_request.ts`<br/>`supabase/functions/_shared/server_keys.test.ts` |
| 45 | Community 45 | 20 | 23 | 10 | 0 | index.ts · servingBand() · reviewReasons() · singlePaperGate() | `shared/brain/index.ts`<br/>`shared/brain/relationships.ts` |
| 75 | Community 75 | 20 | 21 | 0 | 0 | AppDelegate · .application() · AppDelegate · .applicationShouldTerminateAfterLastWindowClosed() | `apps/biotope/ios/Runner/AppDelegate.swift`<br/>`apps/biotope/macos/Runner/AppDelegate.swift` |
| 77 | Community 77 | 20 | 20 | 7 | 0 | profile_setup_screen.dart · _ProfileSetupScreenState · FormState · ProfileSetupScreen | `apps/biotope/lib/modules/m1_core/ui/screens/profile_setup_screen.dart` |
| 82 | Community 82 | 20 | 19 | 1 | 0 | metric_series_models.dart · MetricDailyPoint · d · date | `apps/biotope/lib/modules/m5a_baselines/impl/metric_series_models.dart` |
| 107 | Community 107 | 20 | 42 | 35 | 0 | BudgetLedger · costUsd() · budget.test.ts · .assertCanSpend() | `tools/llm-router/src/budget.ts`<br/>`tools/llm-router/tests/budget.test.ts`<br/>`tools/llm-router/src/types.ts` |
| 620 | Custom Model Training | 20 | 27 | 0 | 1 | Zebra NLI Shadow v0 · Run 3 Product Remediation Tranche · Support-Model Roster · Model Training Workstreams | `docs/temp/run3/pending-build-register.md`<br/>`docs/memory/0017-support-model-dataset-corrections.md`<br/>`docs/shared/hackathon/hackathon-direction.md` |
| 654 | Community 654 | 20 | 19 | 0 | 0 | How Ourobion is Built · 1. Establish Authority Before Work Begins · 2. Orchestrate the Work, Isolate the Writes · 4. Verify Before Integration | `docs/engineering-practice.md` |
| 70 | Community 70 | 19 | 34 | 31 | 0 | d1.ts · searchPapers() · facetCounts · corpusStats | `apps/nao/src/lib/d1.ts` |
| 74 | Community 74 | 19 | 37 | 55 | 0 | offlineAcceptance.ts · prepareOfflineAcceptance() · offlineAcceptance.test.ts · readFrozenFile() | `tools/brain-ingest/src/offlineAcceptance.ts`<br/>`tools/brain-ingest/tests/offlineAcceptance.test.ts`<br/>`tools/brain-ingest/src/synth/index.ts` |
| 89 | Community 89 | 19 | 33 | 53 | 0 | errors.ts · LlmRequest · localAgent.ts · localAgent.test.ts | `tools/llm-router/src/routes/localAgent.ts`<br/>`tools/llm-router/src/errors.ts`<br/>`tools/llm-router/tests/localAgent.test.ts` |
| 343 | Community 158 | 19 | 18 | 0 | 0 | Ourobion · Run from source · nao Research Operations Dashboard · Two products, different users | `README.md`<br/>`apps/nao/README.md`<br/>`.github/workflows/ci.yml` |
| 655 | Community 655 | 19 | 18 | 0 | 0 | Decisions made in the 2026-07-27 remediation pass · Model-training code build — decisions · Further decisions made while building MT0 · CI layout | `docs/development/model-training/code-build-decisions.md` |
| 88 | Community 88 | 18 | 27 | 0 | 2 | auth.ts · verifyAccessToken() · middleware.ts · auth.test.ts | `apps/nao/src/lib/auth.ts`<br/>`apps/nao/src/middleware.ts`<br/>`apps/nao/tests/auth.test.ts` |
| 92 | Community 235 | 18 | 17 | 0 | 5 | Insight Engine · Offline authoring and loop pipeline · Composed insights · Brain support models | `docs/shared/insight-engine-architecture.md`<br/>`AGENTS.md`<br/>`docs/biotope/architecture-context.md` |
| 94 | Community 94 | 18 | 17 | 0 | 0 | ADR: Paper-reliability scoring — the evidence-tier ladder and the rel… · Decision · Options considered · 0003-paper-reliability.md | `docs/development/decisions/0003-paper-reliability.md` |
| 95 | Community 95 | 18 | 17 | 0 | 0 | package.json · devDependencies · scripts · allowScripts | `tools/engine-stats/package.json` |
| 97 | Community 97 | 18 | 17 | 0 | 0 | compilerOptions · tsconfig.json · declaration · esModuleInterop | `tools/llm-router/tsconfig.json` |
| 183 | Community 183 | 18 | 28 | 17 | 0 | blueprints.mjs · load_rules.test.ts · loadBlueprints() · buildRows() | `tools/rules/lib/blueprints.mjs`<br/>`tools/rules/tests/load_rules.test.ts` |
| 656 | Community 656 | 18 | 17 | 0 | 0 | AGENTS.md — Ourobion · 4. Agent work protocol · 5. Agent roles · 1. How an agent finds current truth | `AGENTS.md` |
| 657 | Community 657 | 18 | 17 | 0 | 0 | Agnes 2.5 Flash · API Reference · Response Format · agnes-2_5-flash.md | `docs/hackathon/the_launchpad_challenge/plan/agnes-ai/agnes-2_5-flash.md` |
| 658 | Community 658 | 18 | 17 | 0 | 0 | Phase-2 Demo Runbook — Run 2.0 end-to-end demo MVP · 1 · Clean stack + rules · 2 · Verified edges: fixtures + ONE live verifier call · 3 · Demo user + nao | `docs/development/phase2-demo-runbook.md` |
| 659 | Community 659 | 18 | 25 | 43 | 21 | ZebraConfig · config.py · Path · .config_hash() | `docs/development/model-training/zebra-training/src/zebra/config.py` |
| 660 | Community 660 | 18 | 17 | 0 | 0 | Ourobion — system connection map · 2. Component status · 0. The evidence labels · 1. Runtime trust zones | `docs/hackathon/the_launchpad_challenge/plan/system-connection-map.md` |
| 661 | Community 661 | 18 | 17 | 0 | 0 | Run 4 Pending-Build Register · C · Brain / verifier / LLM · A · Metric expansion (committed 100-wave; analysis 2026-07-25) · I · Reconciled subset map — every O-item ↔ its register row | `docs/development/run4/pending-build-register.md` |
| 662 | Community 662 | 18 | 17 | 0 | 0 | howItWorks.test.ts · __dirname · APPROVED_STRINGS · EXPLAINER_PATH | `apps/nao/tests/howItWorks.test.ts` |
| 663 | Community 663 | 18 | 23 | 0 | 0 | run.mjs · docker() · psqlCommandAllowFail() · waitForPostgres() | `supabase/tests/u3/run.mjs` |
| 103 | Community 103 | 17 | 16 | 0 | 0 | m2-context.md — M2: Self-Report — Gut & Behaviour · Metrics Implemented (Phase 1 Stage 1) · Antibiotic Tracker (event-based, not daily) · Core Logging Flow (~30 seconds) | `apps/biotope/lib/modules/m2_self_report/m2-context.md` |
| 106 | Community 106 | 17 | 16 | 0 | 0 | package.json · dependencies · devDependencies · scripts | `shared/package.json` |
| 664 | Community 664 | 17 | 16 | 0 | 0 | Steps (engine refactor is LAST) · Insights Engine — Design (Phase 2, W2 / Track B) · The pattern (two-tier truth, adapted to Postgres) · B1. Rule-blueprint contract (TRUTH) — `shared/rules/` | `docs/implemented/biotope/rules-engine-design.md` |
| 665 | Community 665 | 17 | 16 | 0 | 0 | Each Step · dev-workflow.md — Ourobion Development Workflow · 1. Issue · 2. Branch + Worktree | `docs/development/dev-workflow.md` |
| 666 | Community 666 | 17 | 30 | 15 | 12 | TestTargetPinning · assert_allowed_target() · _creds() · test_inference_review_regressions.py | `model-training/tests/test_inference_review_regressions.py`<br/>`model-training/src/ourobion_model_lab/inference/r2.py` |
| 667 | Community 667 | 17 | 16 | 0 | 0 | Ourobion nao — Design (brain inspection & curation) · 5 · Data sources & feature phasing · 1 · What nao is (three capability pillars) · 2 · Two-tier placement (the rule that shapes the data model) | `docs/implemented/nao/nao-app-design.md` |
| 668 | Community 668 | 17 | 16 | 0 | 0 | Restore Scan inline-control interaction and reduced-motion behaviour · Continuation — independent-review remediation · Continuation — Bristol canvas-size correction · 20260731T113024Z-agentjwork-codex-issue-287-scan-collapse-reduced-mot… | `docs/sessions/20260731T113024Z-agentjwork-codex-issue-287-scan-collapse-reduced-motion.md` |
| 669 | Community 669 | 17 | 31 | 25 | 1 | runCli() · fail() · git() · policy() | `tools/secret_scan_guard.mjs` |
| 670 | Community 670 | 17 | 16 | 0 | 0 | Viceroy Causal-Language-Risk v0 — training bundle · 0. One-time setup · 1. Licence approval (a human must do this — stricter than Zebra's) · 2. Fetch (the only step that touches the network) | `docs/development/model-training/viceroy-training/README.md` |
| 43 | Community 43 | 16 | 32 | 1 | 1 | seed-test-data-regression.mjs · query() · expectWipeMarkerRefusal() · docker() | `scripts/tests/seed-test-data-regression.mjs`<br/>`supabase/functions/generate-insights/index.ts` |
| 110 | Community 110 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · esModuleInterop · forceConsistentCasingInFileNames | `tools/brain-ingest/tsconfig.json` |
| 112 | Community 112 | 16 | 15 | 0 | 0 | Decision 0002: Anomaly & Personal-Signal Definition for the nao Brain… · Options considered · Decision · 0002-anomaly-definition.md | `docs/development/decisions/0002-anomaly-definition.md` |
| 113 | Community 113 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/edge-loader/tsconfig.json` |
| 116 | Community 116 | 16 | 15 | 0 | 0 | package.json · devDependencies · scripts · engines | `tools/llm-router/package.json` |
| 117 | Community 117 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/metric-view/tsconfig.json` |
| 120 | Community 120 | 16 | 15 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · allowJs | `tools/rules/tsconfig.json` |
| 671 | Community 671 | 16 | 22 | 4 | 9 | TestBaselines · causal_cue_baseline_predict() · .test_cue_baseline_prefers_correlational_over_causal_on_mixed_wording… · .test_cue_baseline_correlational() | `docs/development/model-training/viceroy-training/tests/test_metrics.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/metrics.py` |
| 672 | Community 672 | 16 | 15 | 0 | 0 | Placeholder truthfulness sweep — fabricated numbers, dead controls, u… · Changed · Blockers · 20260728T085558Z-uandiqueue-claude-placeholder-truthfulness.md | `docs/sessions/20260728T085558Z-uandiqueue-claude-placeholder-truthfulness.md` |
| 673 | Community 673 | 16 | 15 | 0 | 0 | Home signals tiles press through to a real metric detail graph · Changed · Verification actually run · 20260728T090349Z-uandiqueue-claude-signals-tile-detail-view.md | `docs/sessions/20260728T090349Z-uandiqueue-claude-signals-tile-detail-view.md` |
| 674 | Community 674 | 16 | 15 | 0 | 0 | Run 4 live provider acceptance and 226 backend membership unblock · Continuation — §D local validation, three defects, and the zero-claim… · Amendment 2026-08-01 · the `/model-training/experiments/` ignore rule… · 20260731T124051Z-uandiqueue-claude-run4-live-provider-acceptance.md | `docs/sessions/20260731T124051Z-uandiqueue-claude-run4-live-provider-acceptance.md` |
| 125 | Community 125 | 15 | 14 | 0 | 1 | GeneratedPluginRegistrant.swift · MainFlutterWindow · MainFlutterWindow.swift · RegisterGeneratedPlugins() | `apps/biotope/macos/Flutter/GeneratedPluginRegistrant.swift`<br/>`apps/biotope/macos/Runner/MainFlutterWindow.swift` |
| 127 | Community 127 | 15 | 14 | 1 | 0 | C2. Derived `D` (D-1 … D-150) · Activity, fitness & neuromotor (D-28 … D-43) · Cardiovascular / autonomic (D-16 … D-27) — all 🟠 (wearable HR/HRV) · Composite roll-ups (D-146 … D-150) | `docs/implemented/biotope/metrics-catalog.md` |
| 139 | Community 157 | 15 | 16 | 7 | 0 | Autonomous Multi-Unit Build Run · Resumable Run Tracking Documents · Self-Contained Build Agent Dispatch Brief · Blocked Register | `.claude/skills/orchestrate-build-run/SKILL.md`<br/>`.claude/skills/orchestrate-build-run/references/tracking-docs.md`<br/>`.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md` |
| 675 | Community 675 | 15 | 18 | 0 | 0 | run.mjs · docker() · waitForPostgres() · psqlFile() | `supabase/tests/authz/run.mjs` |
| 676 | Community 676 | 15 | 14 | 0 | 0 | metric_value_format.dart · abs · digits · formatDurationMinutes | `apps/biotope/lib/modules/m5a_baselines/impl/metric_value_format.dart` |
| 677 | Community 677 | 15 | 14 | 1 | 0 | ourobion_metrics.dart · activeKeys · activeMetrics · any | `shared/metrics/lib/ourobion_metrics.dart` |
| 678 | Community 678 | 15 | 19 | 11 | 0 | page.tsx · OverviewPage() · humanCount() · retrievabilityConic() | `apps/nao/src/app/(app)/overview/page.tsx`<br/>`apps/nao/src/lib/palette.ts` |
| 679 | Community 679 | 15 | 14 | 0 | 0 | Leafcutter Sentence-Role v0 — training plan (mostly not a GMI job) · 1. Decision summary · 2. Why LLM labels are permitted here, when they are forbidden elsewhe… · 3. Recommended path: public data first, no GPU | `docs/development/model-training/leafcutter-sentence-role-v0-training-plan.md` |
| 680 | Community 680 | 15 | 14 | 0 | 0 | Changed · Run 4 synthesis revamp (#300) · §A · Whole-paper input; the prefilter is gone from this path · §B · Mechanism as a second verbatim quote span | `docs/sessions/20260731T190500Z-agent-j-claude-run4-synthesis-revamp-300.md` |
| 681 | Community 681 | 15 | 14 | 0 | 0 | Hackathon submission writeups — honesty rewrite · Second pass — corrections after a hosted read (2026-08-02) · 20260802T000000Z-agent-j-claude-run4-submission-honesty-rewrite.md · Measured, before changing anything | `docs/sessions/20260802T000000Z-agent-j-claude-run4-submission-honesty-rewrite.md` |
| 682 | Community 682 | 15 | 14 | 0 | 0 | brand.test.ts · __dirname · COPIED_PAIRS · extractIconsBlock() | `apps/nao/tests/brand.test.ts` |
| 683 | Community 683 | 15 | 19 | 24 | 0 | checkHeaderResponseAndLogSurfaces() · buildTsJsReferenceRegex() · escapeRegExp() · checkCalleeGroup() | `tools/secret_scan_guard.mjs` |
| 684 | Community 684 | 15 | 14 | 0 | 0 | Zebra NLI Shadow v0 — training bundle · 0. One-time setup · 1. Licence approval (a human must do this) · 2. Fetch (the only step that touches the network) | `docs/development/model-training/zebra-training/README.md` |
| 12 | Community 12 | 14 | 18 | 21 | 0 | Session 20260719T154600Z — agentjwork — claude — research-fixes-lag2 · Session 20260719T144911Z — agentjwork — claude — research-fixes-run-s… · 20260719T144911Z-agentjwork-claude-research-fixes-run-setup.md · Attempted | `docs/sessions/20260719T144911Z-agentjwork-claude-research-fixes-run-setup.md`<br/>`docs/sessions/20260719T154600Z-agentjwork-claude-research-fixes-lag2.md` |
| 129 | Community 148 | 14 | 13 | 0 | 0 | Collection Tier Ladder · Manual Logging Budget · Three Data Economies · Event-Triggered Logging | `docs/biotope/metrics-catalog.md` |
| 130 | Community 130 | 14 | 13 | 0 | 0 | Metrics Registry — Design · Add a metric (safe flow) · Alternatives considered · Fix-on-arrival — RESOLVED (registry seeded from deployed truth) | `docs/implemented/biotope/metrics-registry-design.md` |
| 132 | Community 132 | 14 | 13 | 0 | 0 | compilerOptions · tsconfig.json · allowImportingTsExtensions · esModuleInterop | `tools/engine-stats/tsconfig.json` |
| 143 | Community 143 | 14 | 17 | 0 | 1 | deco_flower_cluster_blush.md · deco_flower_cluster_blush Review · deco_flower_cluster_white Review · deco_flower_cluster_blush.md | `assets/ui-generation/biomech-botanical/reviews/deco_flower_cluster_blush.md`<br/>`assets/ui-generation/biomech-botanical/reviews/deco_flower_cluster_white.md`<br/>`assets/ui-generation/biomech-botanical/prompts/deco_flower_cluster_blush.md` |
| 147 | Community 147 | 14 | 13 | 0 | 0 | shared/SHARED-CONTEXT.md — Ourobion Shared Contract · The Brain — RelationshipClaim / EdgeVerification · Artifact trust + scientific semantics (R4-U4 / O27, additive) · BaselineSnapshot | `shared/SHARED-CONTEXT.md` |
| 685 | Community 685 | 14 | 13 | 0 | 0 | Private read-only offline model inference runner · Local live run — both models, real weights, full pipeline · 20260730T185942Z-uandiqueue-claude-offline-inference-runner.md · Attempted | `docs/sessions/20260730T185942Z-uandiqueue-claude-offline-inference-runner.md` |
| 686 | Community 686 | 14 | 13 | 0 | 0 | Verifier approve-with-caveat (#300 §E) · Changed · `tools/brain-ingest/src/verify/caveat.ts` (new) · `tools/edge-loader/` — the other half of the starvation | `docs/sessions/20260801T104500Z-agent-j-claude-run4-verifier-caveat-300E.md` |
| 687 | Community 687 | 14 | 13 | 0 | 0 | nao viewer read-only UX · Changed · `src/components/NaoAccess.tsx` (new) — the client half · `src/lib/naoAccess.ts` (new) — pure, zero I/O, the whole decision | `docs/sessions/20260801T182224Z-agent-j-claude-nao-viewer-readonly-ux.md` |
| 688 | Community 688 | 14 | 19 | 9 | 2 | TestScopeBoundary · preflight_check_scope_boundary() · map_to_contract_claim_kind() · .test_both_causal_classes_map_to_causal() | `docs/development/model-training/viceroy-training/tests/test_data.py`<br/>`docs/development/model-training/viceroy-training/src/viceroy/data.py` |
| 689 | Community 689 | 14 | 19 | 2 | 0 | secret_scan_guard.test.mjs · withTmpDir() · buildBaseRepo() · initGitRepo() | `tools/secret_scan_guard.test.mjs` |
| 133 | Community 152 | 13 | 12 | 5 | 0 | Record-only evidence-review run · 0. Ground rules (non-negotiable) · 1. Scaffold (unit RU0) · 2. RU1 — triage (do this before any research) | `.claude/skills/evidence-review-run/SKILL.md` |
| 140 | Community 140 | 13 | 12 | 0 | 0 | RunnerTests.swift · RunnerTests.swift · RunnerTests · RunnerTests | `apps/biotope/ios/RunnerTests/RunnerTests.swift`<br/>`apps/biotope/macos/RunnerTests/RunnerTests.swift` |
| 145 | Insight Rules Engine Two-Tier | 13 | 12 | 0 | 0 | O24-O29 Locked Six-Unit Product-Only Run 3 Tranche · B-BR1 Real Attested Decorrelated Verifier · B-DATA1 Simulated Loader Raw-Truth Corruption Risk · B-DATA2 Pipeline Idempotency Demand Semantics and Atomic Publication | `docs/temp/run3/pending-build-register.md` |
| 146 | Community 146 | 13 | 12 | 0 | 0 | Run-2 U9 · Human verdict override + nao claims curation (O13, DEMO-CR… · What ships · 1 · Migration `20260724150000_create_o13_edge_human_verdicts.sql` · 2 · Migration `20260724150001_o13_verified_edges_human_overlay.sql` | `docs/sessions/20260724T150900Z-agentjwork-claude-run2-u9-claims-human-verdict.md` |
| 150 | Community 150 | 13 | 23 | 0 | 0 | shared_memory.mjs · main() · loadDb() · cmdClaim() | `tools/shared_memory.mjs` |
| 158 | Community 158 | 13 | 12 | 1 | 0 | user_profile.dart · UserProfile · city · copyWith | `apps/biotope/lib/modules/m1_core/models/user_profile.dart` |
| 159 | Community 159 | 13 | 12 | 0 | 0 | The Brain — Design · The safeguard — a second, independent, adversarial verifier · Alternatives considered · brain-synthesis-design.md | `docs/implemented/nao/brain-synthesis-design.md` |
| 170 | Community 206 | 13 | 12 | 7 | 1 | Record-only audit run · 2. Resume protocol (what makes a killed session cheap) · Audit Unit Resume Protocol · Research Unit Resume Protocol | `.claude/skills/record-only-audit/SKILL.md`<br/>`.claude/skills/evidence-review-run/SKILL.md` |
| 690 | Community 690 | 13 | 12 | 0 | 0 | Command sequence (db reset → card + source panel) · Insight Slice Demo Runbook — L6 one-card end-to-end · 1. Seeder (A2-adjacent) — real local-agent run · 2. Synthesis (A8) — already exists; re-run only if missing | `docs/development/insight-slice-demo-runbook.md` |
| 691 | Community 691 | 13 | 22 | 3 | 2 | fetch_assets.py · main() · _hash_tree() · fetch_data() | `docs/development/model-training/viceroy-training/fetch_assets.py` |
| 692 | Community 692 | 13 | 22 | 1 | 0 | fetch_assets.py · main() · _hash_tree() · fetch_data() | `docs/development/model-training/zebra-training/fetch_assets.py` |
| 693 | Community 693 | 13 | 18 | 0 | 0 | nao_authorization.mjs · validateNaoAuthorization() · nao_authorization.test.ts · validate_nao_authorization.mjs | `tools/edge-loader/lib/nao_authorization.mjs`<br/>`tools/edge-loader/tests/nao_authorization.test.ts`<br/>`tools/edge-loader/validate_nao_authorization.mjs` |
| 694 | Community 694 | 13 | 18 | 13 | 0 | paperDetail.ts · paperDetail.test.ts · PaperDetailRow · indexRowFacts() | `apps/nao/src/lib/paperDetail.ts`<br/>`apps/nao/tests/paperDetail.test.ts`<br/>`apps/nao/src/lib/d1.ts` |
| 695 | Community 695 | 13 | 12 | 0 | 0 | Issue #317 ? wearable metric UI labels · Continuation ? generated deployment attestation · 20260731T215714Z-agentjwork-codex-issue317-wearable-ui-labels.md · Attempted | `docs/sessions/20260731T215714Z-agentjwork-codex-issue317-wearable-ui-labels.md` |
| 696 | Community 696 | 13 | 12 | 0 | 0 | Run 4 — four defects from the live flow test (#307) · Changed · 20260801T004500Z-agent-j-claude-run4-d1a-d2-d3a-307.md · Attempted | `docs/sessions/20260801T004500Z-agent-j-claude-run4-d1a-d2-d3a-307.md` |
| 697 | Community 697 | 13 | 12 | 0 | 0 | Single-paper serving gate (#300 §E, C15) · Changed · `shared/brain/index.ts` · `tools/edge-loader/load_edges.mjs` | `docs/sessions/20260801T143748Z-agent-j-claude-run4-single-paper-serving-gate-300.md` |
| 698 | Community 698 | 13 | 12 | 0 | 0 | Issue 369 — unattended Agnes verification · Safe-sequence continuation · 20260802T054924Z-agent-j-codex-issue369-unattended-agnes.md · Attempted | `docs/sessions/20260802T054924Z-agent-j-codex-issue369-unattended-agnes.md` |
| 699 | Community 699 | 13 | 12 | 2 | 1 | TestViceroyConfigValidation · .test_audit_threshold_above_grouping_threshold_raises() · .test_audit_threshold_equal_to_grouping_threshold_is_allowed() · .test_effective_not_multiple_of_physical_raises() | `docs/development/model-training/viceroy-training/tests/test_config.py` |
| 152 | Community 152 | 12 | 15 | 0 | 2 | GetCommandLineArguments() · utils.cpp · wWinMain() · Utf8FromUtf16() | `apps/biotope/windows/runner/utils.cpp`<br/>`apps/biotope/windows/runner/main.cpp`<br/>`apps/biotope/windows/runner/utils.h` |
| 154 | Community 154 | 12 | 11 | 0 | 0 | Citation extraction & reference-graph construction — architecture dec… · Options considered · 0001-citation-extraction.md · Context (what doc-12 leaves open, why it matters) | `docs/development/decisions/0001-citation-extraction.md` |
| 155 | Documentation Navigation | 12 | 11 | 0 | 1 | Documentation index · Generated Active Documentation Map · AI Agent Navigation Protocol · Archive Exclusion from Agent Crawl | `docs/INDEX.md` |
| 157 | Community 157 | 12 | 11 | 0 | 0 | m1-context.md — M1: Core Platform & Compliance · Consent Scopes · Current State · Database Tables Owned | `apps/biotope/lib/modules/m1_core/m1-context.md` |
| 160 | Community 160 | 12 | 11 | 0 | 1 | archive_herbarium_specimen · archive_preserved_flower_fragment · archive_herbarium_specimen.md · archive_preserved_flower_fragment.md | `assets/ui-generation/biomech-botanical/reviews/archive_herbarium_specimen.md`<br/>`assets/ui-generation/biomech-botanical/reviews/archive_preserved_flower_fragment.md` |
| 161 | Community 161 | 12 | 11 | 0 | 1 | deco_leaf_brass_node Review · deco_small_biomech_bloom Review · deco_leaf_brass_node.md · deco_small_biomech_bloom.md | `assets/ui-generation/biomech-botanical/reviews/deco_leaf_brass_node.md`<br/>`assets/ui-generation/biomech-botanical/reviews/deco_small_biomech_bloom.md` |
| 163 | Community 163 | 12 | 11 | 0 | 0 | Run-2 U10 · Manual seed-load from nao, seeds-as-data (O14, DEMO-CRITI… · What ships · 1 · Migration `20260724152525_create_o14_ingestion_seeds.sql` · 2 · Pipeline consumption — `tools/brain-ingest/src/seeder/dbSeeds.ts` | `docs/sessions/20260724T152525Z-agentjwork-claude-run2-u10-seeds-as-data.md` |
| 164 | Community 164 | 12 | 11 | 0 | 0 | Part A — decorrelated full-loop simulation (H1) · Run-2 U13 · Decorrelated full-loop simulation (H1) + baseline-confide… · `router.config.json` — restored, proof · 20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md | `docs/sessions/20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md` |
| 165 | Community 165 | 12 | 11 | 0 | 0 | compilerOptions · tsconfig.json · esModuleInterop · exclude | `shared/tsconfig.json` |
| 169 | Community 205 | 12 | 15 | 0 | 8 | Botanical-Luxury Visual Language · Chroma-Key Alpha Workflow · Archive Report Thumbnail Base · Herbarium Archive Cover | `assets/ui-generation/biomech-botanical/prompts/archive_report_thumbnail_base.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_flower_cluster_blush.md`<br/>`docs/biotope/ui/ai-assets/prompts/deco_vine_corner_left.md` |
| 700 | Community 700 | 12 | 11 | 0 | 0 | Overview · 1. Agnes AI API Introduction · 2. Core Capabilities · 3. Model Capabilities Overview | `docs/hackathon/the_launchpad_challenge/plan/agnes-ai/agnes-ai-docs.md` |
| 701 | Community 701 | 12 | 11 | 0 | 0 | Biotope AI Asset Style Guide · Accepted Botanical Direction · Accepted Material Language · Accepted Robot-Hand Direction | `assets/ui-generation/biomech-botanical/asset-style-guide.md` |
| 702 | Community 702 | 12 | 11 | 0 | 0 | Decision · Local-day projection for event and state primitives — architecture de… · 1. Calendar policy is explicit and versioned · 2. Local day is captured as raw provenance, not reconstructed from a … | `docs/development/decisions/0004-local-day-projection.md` |
| 703 | Community 703 | 12 | 11 | 0 | 0 | Documentation freshness audit — 2026-07-26 · Material freshness gaps · documentation-freshness-audit-2026-07-26.md · P0 — repair before unattended Run-3 build work | `docs/development/documentation-freshness-audit-2026-07-26.md` |
| 704 | Community 704 | 12 | 11 | 0 | 0 | system-truth.md · The Brain Pipeline: End-to-End Working with Limited Output · Infrastructure Schema · Model Decorrelation and Safety | `docs/implemented/system-truth.md` |
| 705 | Community 705 | 12 | 11 | 0 | 0 | @ourobion/llm-router · Bounded two-leg acceptance · Budget ledgers · CLI | `tools/llm-router/README.md` |
| 706 | Community 706 | 12 | 11 | 0 | 0 | model-training — Ourobion custom-model training/evaluation/release wo… · Dependency posture (D2) — why the offline test suite needs zero insta… · CLI contract · `predict` — offline research inference (issue #266) | `model-training/README.md` |
| 707 | Community 707 | 12 | 11 | 0 | 0 | Zebra v1 training and evaluation results · Canonical source artifacts · Checkpoint · Evaluation | `model-training/evidence/publication-results/zebra-v1-results.md` |
| 708 | Community 708 | 12 | 11 | 0 | 0 | Hosted demo migration runbook — `bewwvcksgpxoomyjavjp` · 4. Ordered steps · 6. The blocker that stopped 2026-07-28 — how to tell if you have it t… · 1. Authorization and limits (carry these forward) | `docs/development/run4/hosted-demo-migration-runbook.md` |
| 709 | Community 709 | 12 | 11 | 0 | 0 | Hackathon submission evidence audit · Measured state at 2026-08-01 (supersedes the point-in-time rows above) · Classification · Connection-map audit | `docs/development/run4/submission-verification-audit.md` |
| 710 | Community 710 | 12 | 21 | 1 | 0 | pin.mjs · main() · fail() · loadPins() | `tools/secret-scan/pin.mjs` |
| 711 | Community 711 | 12 | 11 | 0 | 0 | Session — docs consolidation into app-scoped ground truth + hackathon… · 20260713T033718Z-agentjwork-claude-docs-consolidation-hackathon.md · Attempted · Blockers | `docs/sessions/20260713T033718Z-agentjwork-claude-docs-consolidation-hackathon.md` |
| 712 | Community 712 | 12 | 11 | 0 | 0 | Co-movement edge card (M5b · S7/S8) · Changed · `composer.ts` — branch rule 2b, a new field, no widened sets · `index.ts` — a separate production block in the coincidence-rule hand… | `docs/sessions/20260801T162940Z-agent-j-claude-run4-comovement-edge-card.md` |
| 713 | Community 713 | 12 | 11 | 0 | 0 | nao Data loader → coming-soon state · Changed · `loader/page.tsx` — metadata only · `LoaderPanel.tsx` — a static unavailable state | `docs/sessions/20260801T180712Z-agent-j-claude-nao-loader-coming-soon.md` |
| 714 | Community 714 | 12 | 11 | 0 | 0 | biotope ↔ nao — the runtime link · 4 · Edge selection & trust gating at the seam · 1 · The headline fact: there is no app-to-app link · 2 · Where cross-metric relationships get decided (offline, not at req… | `docs/implemented/shared/biotope-nao-link.md` |
| 715 | Community 715 | 12 | 17 | 8 | 1 | preflight_check_label_blind() · TestPreflightCheckStructural · _label_blind_report() · .test_real_selector_passes() | `docs/development/model-training/zebra-training/tests/test_evidence_label_blind.py`<br/>`docs/development/model-training/zebra-training/src/zebra/data.py`<br/>`docs/development/model-training/zebra-training/src/zebra/cli.py` |
| 716 | Community 716 | 12 | 11 | 0 | 0 | Context — what Viceroy is for, and what it must never become · The two design decisions that matter most · 1. Leakage control, and its honest limit · 2. Class imbalance is handled in the loss, and never in the metric | `docs/development/model-training/viceroy-training/CONTEXT.md` |
| 99 | Community 99 | 11 | 11 | 0 | 0 | consent_record.dart · ConsentScope · ConsentScopeX · ConsentRecord | `apps/biotope/lib/modules/m1_core/models/consent_record.dart` |
| 118 | Community 118 | 11 | 10 | 14 | 0 | asset_bundling_test.dart · return · package:src/core/generated_assets.dart · _allGeneratedAssets | `apps/biotope/test/core/asset_bundling_test.dart` |
| 166 | Community 166 | 11 | 16 | 11 | 0 | config.ts · inspectConfig() · loadConfig() · readEnv() | `tools/brain-ingest/src/config.ts`<br/>`tools/brain-ingest/src/types.ts` |
| 174 | Community 174 | 11 | 10 | 0 | 0 | What shipped · Run-2 U6 · Simulated health-data loader in nao (O11, DEMO-CRITICAL) +… · 20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md · Decisions made autonomously (for review) | `docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 175 | Community 175 | 11 | 10 | 0 | 0 | What was built · Run-2 U8 · Model-config + spend read boundaries + editable caps + nao… · 1 · Migration `supabase/migrations/20260724130000_create_o10_llm_rout… · 2 · Publisher (router side) | `docs/sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md` |
| 178 | Community 178 | 11 | 10 | 0 | 0 | index.ts · BaselineSnapshot · DailyEnvRow · DailyGutRow | `shared/types/index.ts` |
| 179 | Community 179 | 11 | 10 | 0 | 0 | manifest.json · background_color · description · display | `apps/biotope/web/manifest.json` |
| 717 | Community 717 | 11 | 13 | 5 | 5 | TestBaselines · lexical_overlap_baseline_predict() · _simple_tokens() · .test_lexical_overlap_asymmetric_negation_is_contradicted() | `docs/development/model-training/zebra-training/tests/test_metrics.py`<br/>`docs/development/model-training/zebra-training/src/zebra/metrics.py` |
| 718 | Community 718 | 11 | 10 | 0 | 0 | project-context.md — Ourobion · Module Map · Phases · Product Principles (Non-Negotiable) | `docs/implemented/project-context.md` |
| 719 | Community 719 | 11 | 10 | 0 | 0 | Model-training code build — human gates · BioREDirect data licence — unresolved (gates Salmon's direction head) · D4 — hash-pinned lock gap · Frozen human audit-set labels | `docs/development/model-training/human-gates.md` |
| 720 | Community 720 | 11 | 10 | 0 | 0 | Custom-model roster — what we train, what we don't, and why · 1. The roster · 1.1 The codename scheme · 2. What changed as a result of this research | `docs/development/model-training/model-roster.md` |
| 721 | Community 721 | 11 | 10 | 0 | 0 | ourobion nao · Run locally · Brand assets · Deploy (Cloudflare Workers, outline) | `apps/nao/README.md` |
| 722 | Community 722 | 11 | 14 | 0 | 0 | run.mjs · docker() · waitForPostgres() · psqlFile() | `supabase/tests/profile_prefs/run.mjs` |
| 723 | Community 723 | 11 | 10 | 0 | 0 | Viceroy v0 training and evaluation results · Canonical source artifacts · Checkpoint · Executive verdict | `model-training/evidence/publication-results/viceroy-v0-results.md` |
| 724 | Community 724 | 11 | 10 | 0 | 0 | Hackathon MVP hosted demo migration — executed · Changed · 20260728T091140Z-uandiqueue-claude-hack-mvp-hosted-demo-executed.md · Attempted | `docs/sessions/20260728T091140Z-uandiqueue-claude-hack-mvp-hosted-demo-executed.md` |
| 725 | Community 725 | 11 | 10 | 0 | 0 | Issue 282 post-defect reconciliation · 20260731T183134Z-agentjwork-codex-issue282-reconciliation.md · Accepted unit-base resumption · Attempted | `docs/sessions/20260731T183134Z-agentjwork-codex-issue282-reconciliation.md` |
| 726 | Community 726 | 11 | 10 | 0 | 0 | Run 4 — Agnes verifier (#307 prerequisite) · Option (d) — exposing the acceptance context on the plain `verify` CLI · 20260731T201500Z-agent-j-claude-run4-agnes-verifier-307.md · Attempted | `docs/sessions/20260731T201500Z-agent-j-claude-run4-agnes-verifier-307.md` |
| 727 | Community 727 | 11 | 10 | 0 | 0 | 3 · Corpus selection + verifier calibration (analysis only — no decis… · Session D — #336: pricing expiry, the unreachable `caveat` field, cor… · 1 · Pricing expiry — gpt-5 renewed, Agnes escalated (NOT renewed) · 2 · `edge_verifications.caveat` — one forward migration | `docs/sessions/20260801T065652Z-agent-j-claude-session-d-pricing-caveat-corpus-336.md` |
| 728 | Community 728 | 11 | 10 | 0 | 0 | nao Overview — "By publication year" horizontal overflow · Changed · `overview.css` — three bounds · `page.tsx` — display sort + a scroll container | `docs/sessions/20260801T180354Z-agent-j-claude-nao-overview-year-facet-overflow.md` |
| 729 | Community 729 | 11 | 17 | 22 | 0 | checkNaoClientSurface() · checkNextPublic() · computeClientSurface() · checkBiotope() | `tools/secret_scan_guard.mjs` |
| 730 | Community 730 | 11 | 10 | 0 | 0 | Interpreting the results — did training work as intended? · Step 1 — checks that must pass before any metric means anything · Step 3 — what a healthy, honest result looks like · `InsufficientFoldSupportError` means something different here than in… | `docs/development/model-training/viceroy-training/INTERPRETING-RESULTS.md` |
| 173 | Community 173 | 10 | 19 | 27 | 3 | resolveRepoPath() · publish-status.ts · repoRoot() · smoke-openai.ts | `tools/llm-router/scripts/publish-status.ts`<br/>`tools/llm-router/scripts/smoke-openai.ts`<br/>`tools/llm-router/src/config.ts` |
| 181 | Community 221 | 10 | 9 | 0 | 0 | S4 robust median MAD baseline · S5 pairwise personal co-movement · deterministic serve detectors · Anomaly and Personal-Signal Definition | `docs/shared/decisions/0002-anomaly-definition.md` |
| 182 | Community 182 | 10 | 9 | 0 | 0 | Prompt Lessons · Background Mode Lessons · Batch 1 Lessons · Botanical Realism Lessons | `assets/ui-generation/biomech-botanical/lessons/prompt-lessons.md` |
| 185 | Community 229 | 10 | 11 | 2 | 0 | Stacked Pull Request Chain · Phase-2 Reverse-Cascade Incident · Bottom-Up Merge Procedure · GitHub Branch-Base Contract | `.claude/skills/stacked-pr-chain/SKILL.md`<br/>`.claude/skills/stacked-pr-chain/references/phase2-reverse-cascade.md`<br/>`.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 186 | Community 186 | 10 | 9 | 0 | 0 | Run-2 U4 · Card semantics + gap ledger (O16 + O18 + the gap_ledger sl… · What changed · 20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md · Divergences / judgment calls (recorded) | `docs/sessions/20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md` |
| 187 | Community 187 | 10 | 9 | 0 | 0 | Run-2 U5 · Serve-pipeline trigger + provenance read + baseline prune … · What changed · 20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md · Divergences / judgment calls (recorded) | `docs/sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md` |
| 188 | Community 188 | 10 | 9 | 0 | 0 | Run-2 U12 · Scripted E2E demo dry-run + reproducible demo runbook (fi… · 20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md · Biotope visual check (Android emulator; Windows desktop honestly bloc… · Decisions made autonomously (for review) | `docs/sessions/20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md` |
| 193 | Community 193 | 10 | 13 | 0 | 1 | profile_signature_flower.md · profile_signature_flower Review · Background Mode · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/profile_signature_flower.md`<br/>`assets/ui-generation/biomech-botanical/prompts/profile_porcelain_camellia.md`<br/>`assets/ui-generation/biomech-botanical/prompts/profile_signature_flower.md` |
| 731 | Community 731 | 10 | 9 | 0 | 0 | Implemented state · Biotope · Brain pipeline · Nao | `docs/implemented/README.md` |
| 732 | Community 732 | 10 | 9 | 0 | 0 | Brain support models — training design (public-data-first) · 2 · Model (b) — evidence tier + venue weight · (b1) Study-design classifier → `evidenceTier` (1–5) — trainable · (b2) Venue weight → `impactTier` — **no training, deterministic looku… | `docs/implemented/nao/brain-support-models-design.md` |
| 733 | Community 733 | 10 | 9 | 0 | 0 | Run 4 continuation status · Snapshot authority · continuation-status.md · Fresh GitHub PR ledger | `docs/development/run4/continuation-status.md` |
| 734 | Community 734 | 10 | 9 | 0 | 0 | Options · Run 4 U6 A5 — daily-log storage options · 1. Defer, then add columns to `daily_gut_rows` · 2. Long-form general daily values beside the grandfathered row | `docs/development/run4/u6-a5-daily-log-options.md` |
| 735 | Community 735 | 10 | 9 | 0 | 0 | Run 4 U3 — atomic demo loader, raw-truth and retry safety (O26) · Corrected after independent review — a real defect, not just a cap · 20260727T231608Z-agentjwork-claude-run4-u3-atomic-demo-loader.md · Attempted | `docs/sessions/20260727T231608Z-agentjwork-claude-run4-u3-atomic-demo-loader.md` |
| 736 | Community 736 | 10 | 9 | 0 | 0 | Run 4 U5 evidence reconciliation · `verifierModel` / `TEST_MODE_LABEL` — exact finding · 20260728T095345Z-uandiqueue-claude-run4-u5-evidence-reconcile.md · Attempted | `docs/sessions/20260728T095345Z-uandiqueue-claude-run4-u5-evidence-reconcile.md` |
| 737 | Community 737 | 10 | 9 | 0 | 0 | Run 4 U2 corrections — one reconciled correction path · Evidence actually obtained · 20260728T101500Z-uandiqueue-claude-run4-u2-corrections-combined.md · Attempted | `docs/sessions/20260728T101500Z-uandiqueue-claude-run4-u2-corrections-combined.md` |
| 738 | Community 738 | 10 | 9 | 0 | 0 | Port the #268 acceptance-test coverage onto the merged implementation · 20260731T092053Z-agentjwork-claude-268-coverage-port.md · Attempted · Blockers | `docs/sessions/20260731T092053Z-agentjwork-claude-268-coverage-port.md` |
| 739 | Community 739 | 10 | 9 | 0 | 0 | Run 4 — advance the per-unit release-gate base (#307 task 1) · Changed · `.gitignore` — the test-credential rule was NOT already landed · 20260731T195600Z-agent-j-claude-run4-advance-unit-base-307.md | `docs/sessions/20260731T195600Z-agent-j-claude-run4-advance-unit-base-307.md` |
| 740 | Community 740 | 10 | 9 | 0 | 0 | Run 4 — idconv crosswalk fixes + ingestion stall diagnosis + handover… · The finding the next session most needs — per-seed ingestion is O(cor… · 20260801T053000Z-agent-j-claude-run4-idconv-fixes-ingest-handover-307… · Attempted | `docs/sessions/20260801T053000Z-agent-j-claude-run4-idconv-fixes-ingest-handover-307.md` |
| 741 | Community 741 | 10 | 9 | 0 | 0 | Changed · Single-paper verdicts (#300 §E) — corroboration stops steering the ve… · `shared/brain/relationships.schema.ts` — the contract invariant · `verify/caveat.ts` — `citedPaperAssessed` | `docs/sessions/20260801T160500Z-agent-j-claude-run4-single-paper-verdict-300E.md` |
| 742 | Community 742 | 10 | 9 | 0 | 0 | Cited insights first (M5b · insight deck ordering) · Changed · `insight_service.dart` — one comparator, three call sites · 20260801T182403Z-agent-j-claude-cited-insights-first.md | `docs/sessions/20260801T182403Z-agent-j-claude-cited-insights-first.md` |
| 743 | Community 743 | 10 | 9 | 0 | 0 | Changed · Launchpad submission rewrite and governed-document signing · 20260802T100500Z-uandiqueue-claude-submission-writeup-and-doc-signing… · Attempted | `docs/sessions/20260802T100500Z-uandiqueue-claude-submission-writeup-and-doc-signing.md` |
| 744 | Community 744 | 10 | 9 | 0 | 0 | Leakage — what this bundle controls, and what it cannot · What it does not catch — the honest limit · What the bundle does · LEAKAGE.md | `docs/development/model-training/viceroy-training/LEAKAGE.md` |
| 745 | Community 745 | 10 | 9 | 0 | 0 | Note for the owner of the machine · Cleanup · Compute time — under an hour, mostly idle · Disk — about 2.5 GB, fully removable | `docs/development/model-training/viceroy-training/OWNER-NOTE.md` |
| 746 | Community 746 | 10 | 9 | 0 | 0 | Zebra NLI Shadow v0 — training build log · build-log.md · GMI inference — viable today, and not blocked by the container ticket · Ledger | `docs/development/model-training/zebra-training/build-log.md` |
| 747 | Community 747 | 10 | 9 | 0 | 0 | Interpreting the results — did training work as intended? · Step 1 — checks that must pass before any metric means anything · `InsufficientFoldSupportError` is not necessarily a bug · INTERPRETING-RESULTS.md | `docs/development/model-training/zebra-training/INTERPRETING-RESULTS.md` |
| 136 | Community 136 | 9 | 8 | 11 | 0 | rule_blueprint.test.ts · byKey() · conditionMetricKeys() · QUARANTINE | `tools/rules/tests/rule_blueprint.test.ts`<br/>`shared/rules/rule.schema.ts`<br/>`shared/metrics/index.ts` |
| 189 | Community 189 | 9 | 8 | 1 | 0 | Part B — The manual layer, rebuilt by tier · B1. Tier 1 — Daily Core (the sticky spine: two ~30s micro-checks) · B2. Tier 2 — Daily Optional / Rotating (opt-in, or app samples a few … · B3. Tier 3 — Event-Triggered (log at the moment via quick-action/widg… | `docs/implemented/biotope/metrics-catalog.md` |
| 192 | Community 192 | 9 | 8 | 0 | 0 | Orchestrate a build run · 1. Roles · 2. Startup checklist (fresh orchestrator session) · 3. Assessment before dispatch | `.claude/skills/orchestrate-build-run/SKILL.md` |
| 194 | Community 194 | 9 | 8 | 0 | 0 | graphify reference: extra exports and benchmark · exports.md · Step 6b - Wiki (only if --wiki flag) · Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag) | `.claude/skills/graphify/references/exports.md` |
| 195 | Community 195 | 9 | 8 | 0 | 0 | Session 20260716T042500Z — agentjwork — claude — a8-synthesis · 20260716T042500Z-agentjwork-claude-a8-synthesis.md · Attempted · Blockers | `docs/sessions/20260716T042500Z-agentjwork-claude-a8-synthesis.md` |
| 196 | Community 196 | 9 | 8 | 0 | 0 | Session 20260718T050856Z — agentjwork — claude — u24-loader-hardening · 20260718T050856Z-agentjwork-claude-u24-loader-hardening.md · Attempted · Blockers | `docs/sessions/20260718T050856Z-agentjwork-claude-u24-loader-hardening.md` |
| 197 | Community 197 | 9 | 8 | 0 | 0 | Session 20260718T051721Z — agentjwork — claude — u25-db-constraint-hy… · 20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md · Attempted · Blockers | `docs/sessions/20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md` |
| 198 | Community 253 | 9 | 8 | 0 | 0 | run-pipeline edge function · baseline snapshot lifecycle · get_insight_provenance RPC · InsightProvenanceScreen | `docs/sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md`<br/>`docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md`<br/>`docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 199 | Community 199 | 9 | 8 | 0 | 0 | Run-2 U7 · biotope trend view + insight provenance view (O12 app side… · What shipped · 20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md · Decisions made autonomously (for review) | `docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md` |
| 202 | TypeScript Config | 9 | 8 | 0 | 0 | Metrics Registry · `MetricDefinition` fields · Add a metric (safe flow) · Daily projection policy (ADR-0004; implementation pending) | `shared/metrics/README.md`<br/>`docs/biotope/metrics-registry-design.md` |
| 748 | Community 748 | 9 | 8 | 0 | 0 | The Brain — relationship contract · Drift guard · Field reference · Gating (where trust becomes behaviour) | `shared/brain/README.md` |
| 749 | Community 749 | 9 | 8 | 0 | 0 | agent-protocol.md — AI Agent Navigation Protocol · agent-protocol.md · Branch and PR Conventions · How to Use This File | `docs/development/agent-protocol.md` |
| 750 | Community 750 | 9 | 8 | 0 | 0 | Commit Message Format · Commit Message Guidelines · 1. Type · 2. Scope (Optional) | `docs/development/commit-conventions.md` |
| 751 | Community 751 | 9 | 8 | 0 | 0 | What we got wrong, and what caught it · Caught by a human · Caught by an automated gate · Caught by evidence and literature review | `docs/development/what-we-got-wrong.md` |
| 752 | Community 752 | 9 | 8 | 0 | 0 | project-overview.md · The brain, and why its output can be trusted · Identity and logo · The layers not yet built | `docs/project-overview.md` |
| 753 | Community 753 | 9 | 8 | 0 | 0 | Ourobion Nao — Logo & Design Notes · Colour — dark tech, sci-fi · DESIGN.md · Palette | `assets/ourobion-nao-logo/DESIGN.md` |
| 754 | Community 754 | 9 | 8 | 0 | 0 | Model-training run 2 — accepted plan corrections · 1. Zebra NLI Shadow v0 — WORKABLE after corrections · 2. Giraffe Study-Design v0 — NOT WORKABLE AS WRITTEN · 3. Salmon Relation/Direction v0 — WORKABLE, narrower | `docs/development/model-training/run2/plan-corrections.md` |
| 755 | Community 755 | 9 | 8 | 0 | 0 | Run 4 Decisions and Signoff · D-215-ISSUE-RETENTION — follow-on work keeps the issue live · D-229-REVIEW-DEVIATION — owner-authorized shared-metric review interp… · D-231-PRODUCT-BINARY-ACCOUNTING — narrow binary accounting applies to… | `docs/development/run4/decisions-signoff.md` |
| 756 | Community 756 | 9 | 8 | 0 | 0 | Hackathon MVP · biotope local-fallback demo script · Commands actually used · Demo posture · Five-tab walkthrough and talk track | `docs/development/run4/hack-mvp-demo-script.md` |
| 757 | Community 757 | 9 | 8 | 0 | 0 | Run 4 Human Decisions · Branch and autonomy · External actions not authorized · Hackathon MVP demo rehearsal — hosted demo project (2026-07-28) | `docs/development/run4/human-decisions.md` |
| 758 | Community 758 | 9 | 8 | 0 | 0 | Run 4 reviewed planning cockpit · Documents · Boundaries · Bounded provider-test exception (2026-07-28) | `docs/development/run4/README.md` |
| 759 | Community 759 | 9 | 8 | 0 | 0 | Run-3 independent audit — findings register · Detail on the two blockers · A1 — the verification claim is false · A2 — stale evidence that looks permanently green | `docs/development/run4/run3-audit-findings.md` |
| 760 | Community 760 | 9 | 8 | 0 | 0 | MT0 — repository polyglot policy and shared custom-model training sub… · 20260726T212718Z-agentjwork-claude-mt0-training-substrate.md · Attempted · Blockers | `docs/sessions/20260726T212718Z-agentjwork-claude-mt0-training-substrate.md` |
| 761 | Community 761 | 9 | 8 | 0 | 0 | Independent adversarial audit of Run 3, and Run 4 candidate scope · 20260727T070438Z-agentjwork-claude-run3-audit-run4.md · Attempted · Blockers | `docs/sessions/20260727T070438Z-agentjwork-claude-run3-audit-run4.md` |
| 762 | Community 762 | 9 | 8 | 0 | 0 | Fold Z1–Z5 into the Zebra plan; reframe Run 4 as a product build run · 20260727T091102Z-agentjwork-claude-zebra-z-corrections-and-run4-refra… · Attempted · Blockers | `docs/sessions/20260727T091102Z-agentjwork-claude-zebra-z-corrections-and-run4-reframe.md` |
| 763 | Community 763 | 9 | 8 | 0 | 0 | Inherit model-training from run3 onto dev-phase2-run4 · 20260727T150017Z-agentjwork-claude-model-training-onto-run4.md · Blockers · Changed — 60 files | `docs/sessions/20260727T150017Z-agentjwork-claude-model-training-onto-run4.md` |
| 764 | Community 764 | 9 | 8 | 0 | 0 | MT4 — Viceroy training bundle · 20260727T181945Z-agentjwork-claude-mt4-viceroy-training-bundle.md · Attempted · Blockers | `docs/sessions/20260727T181945Z-agentjwork-claude-mt4-viceroy-training-bundle.md` |
| 765 | Community 765 | 9 | 8 | 0 | 0 | Session: biomech-botanical UI reskin — part 1 (foundation) · 20260727T200710Z-uandiqueue-claude-biomech-botanical-reskin-part1.md · Attempted · Blockers | `docs/sessions/20260727T200710Z-uandiqueue-claude-biomech-botanical-reskin-part1.md` |
| 766 | Community 766 | 9 | 8 | 0 | 0 | Run 4 canonical full-UI integration onto the reconciled gate base · Verification actually run · `archived` status contract parity · 20260728T041500Z-agentjwork-claude-run4-u7-ui-integration.md | `docs/sessions/20260728T041500Z-agentjwork-claude-run4-u7-ui-integration.md` |
| 767 | Community 767 | 9 | 8 | 0 | 0 | Run 4 U4 — scientific provenance semantics and artifact trust posture… · 20260728T041545Z-uandiqueue-claude-run4-u4-scientific-semantics.md · Attempted · Blockers | `docs/sessions/20260728T041545Z-uandiqueue-claude-run4-u4-scientific-semantics.md` |
| 768 | Community 768 | 9 | 8 | 0 | 0 | Run 4 UI integration, three device-only defects, and the Home design … · 20260728T063000Z-agentjwork-claude-run4-ui-device-defects-and-home-de… · Attempted · Blockers | `docs/sessions/20260728T063000Z-agentjwork-claude-run4-ui-device-defects-and-home-design.md` |
| 769 | Community 769 | 9 | 8 | 0 | 0 | Make the Nao root the public Ourobion explainer · Verification · 20260731T062725Z-agentjwork-codex-nao-public-root.md · Attempted | `docs/sessions/20260731T062725Z-agentjwork-codex-nao-public-root.md` |
| 770 | Community 770 | 9 | 8 | 0 | 0 | Issues 233 and 280 live acceptance prerequisites · 20260731T074033Z-agentjwork-codex-issue233-live-acceptance.md · Attempted · Blockers | `docs/sessions/20260731T074033Z-agentjwork-codex-issue233-live-acceptance.md` |
| 771 | Community 771 | 9 | 8 | 0 | 0 | Issue 246 offline runner reliability repair · 20260731T093132Z-agentjwork-codex-issue246-runner-reliability.md · Attempted · Blockers | `docs/sessions/20260731T093132Z-agentjwork-codex-issue246-runner-reliability.md` |
| 772 | Community 772 | 9 | 8 | 0 | 0 | Named-scale integer tick fallback · 20260731T200519Z-agentjwork-codex-issue310-named-scale-ticks.md · Attempted · Blockers | `docs/sessions/20260731T200519Z-agentjwork-codex-issue310-named-scale-ticks.md` |
| 773 | Community 773 | 9 | 8 | 0 | 0 | Run 4 — price the attested snapshot (#307) · Verification — the live run, reported honestly including the zero res… · 20260731T204500Z-agent-j-claude-run4-price-attested-snapshot-307.md · Attempted | `docs/sessions/20260731T204500Z-agent-j-claude-run4-price-attested-snapshot-307.md` |
| 774 | Community 774 | 9 | 8 | 0 | 0 | The verifier had no corpus, so every verdict was `uncertain` for a me… · 20260801T103805Z-agent-j-claude-real-verify-corpus-builder.md · Emitted vs skipped · Evidence the corpus works | `docs/sessions/20260801T103805Z-agent-j-claude-real-verify-corpus-builder.md` |
| 775 | Community 775 | 9 | 8 | 0 | 0 | Docs reorganisation — Phase 2 of the #328 housekeeping run · Changed · 20260802T005847Z-uandiqueue-claude-docs-reorg-taxonomy-328.md · CI corrections (added after the first CI run) | `docs/sessions/20260802T005847Z-uandiqueue-claude-docs-reorg-taxonomy-328.md` |
| 776 | Community 776 | 9 | 8 | 0 | 0 | Phase 3 — the new docs, plus two corrections · Follow-up 2 — mistakes split into their own document (owner) · 20260802T011705Z-uandiqueue-claude-phase3-new-docs-328.md · Accuracy fixes to `engineering-practice.md` | `docs/sessions/20260802T011705Z-uandiqueue-claude-phase3-new-docs-328.md` |
| 777 | Community 777 | 9 | 8 | 0 | 0 | Verified extracted-blueprint loader gate (#371) · 20260802T052051Z-agent-j-codex-verified-blueprint-loader.md · Attempted · Blockers | `docs/sessions/20260802T052051Z-agent-j-codex-verified-blueprint-loader.md` |
| 778 | Community 778 | 9 | 8 | 0 | 0 | Appendix — From papers to product · What existed before, and what is new · appendix.md · Evidence | `docs/hackathon/the_launchpad_challenge/submission/appendix.md` |
| 779 | Community 779 | 9 | 8 | 0 | 0 | Context — what Zebra is for, and what it must never become · CONTEXT.md · Data and licensing · Hard boundary: this is non-serving | `docs/development/model-training/zebra-training/CONTEXT.md` |
| 780 | Community 780 | 9 | 8 | 0 | 0 | Note for the owner of the Mac Mini · Cleanup · Compute time — under an hour, mostly idle · Disk — about 2.5 GB, fully removable | `docs/development/model-training/zebra-training/OWNER-NOTE.md` |
| 126 | Community 126 | 8 | 8 | 8 | 0 | page.tsx · OurobionExplainer.tsx · OurobionExplainer() · CARDS | `apps/nao/src/components/OurobionExplainer.tsx`<br/>`apps/nao/src/app/page.tsx` |
| 201 | Community 201 | 8 | 7 | 5 | 0 | metrics-catalog.md · Part G — Summary counts · Metrics Catalog — Candidate Metrics, Reorganized Around a Logging Bud… · Manual layer (`L-1 … L-110`) — re-tiered by logging budget | `docs/implemented/biotope/metrics-catalog.md` |
| 203 | Community 258 | 8 | 8 | 0 | 0 | claimCites mapping · format-routed citation pipeline · reference graph · GROBID PDF sidecar | `docs/shared/decisions/0001-citation-extraction.md` |
| 204 | Community 259 | 8 | 10 | 0 | 2 | Linux Desktop Relocatable Bundle · Linux Flutter Engine Build · Linux Runner Target · Windows Desktop In-Place Bundle | `apps/biotope/linux/CMakeLists.txt`<br/>`apps/biotope/windows/CMakeLists.txt`<br/>`apps/biotope/linux/flutter/CMakeLists.txt` |
| 206 | Community 206 | 8 | 7 | 0 | 0 | Checklist · PULL_REQUEST_TEMPLATE.md · Changes · Code | `.github/PULL_REQUEST_TEMPLATE.md` |
| 208 | Community 208 | 8 | 7 | 0 | 0 | The four run tracking docs · 1. `&lt;run-slug&gt;-orchestration-log.md` — the resume point · 2. `&lt;run-slug&gt;-blocked-register.md` — human-gated items (B-entr… · 3. `&lt;run-slug&gt;-signoff-decisions.md` — judgment calls (D-entrie… | `.claude/skills/orchestrate-build-run/references/tracking-docs.md` |
| 209 | Community 209 | 8 | 7 | 0 | 0 | gen-env.mjs · appRoot · here · p() | `apps/nao/scripts/gen-env.mjs` |
| 211 | Community 211 | 8 | 7 | 0 | 0 | Session 20260608T045610Z — uandiqueue — claude — context-system-boots… · 20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md · Addendum — branch integration (same session) · Attempted | `docs/sessions/20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md` |
| 212 | Community 212 | 8 | 7 | 0 | 0 | Session 20260608T071424Z — uandiqueue — claude — windows-native-toolc… · 20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md · Attempted · Blockers / notes | `docs/sessions/20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md` |
| 213 | Community 213 | 8 | 7 | 0 | 0 | Session 20260609T021240Z — uandiqueue — claude — next-phase-plan · 20260609T021240Z-uandiqueue-claude-next-phase-plan.md · Addendum — scope generalized + Phase 0 added (same session) · Attempted | `docs/sessions/20260609T021240Z-uandiqueue-claude-next-phase-plan.md` |
| 214 | Community 214 | 8 | 7 | 0 | 0 | Session 20260610T021136Z — uandiqueue — claude — local-test-seeder · 20260610T021136Z-uandiqueue-claude-local-test-seeder.md · Addendum — integration target changed main → dev-phase2 (same session) · Attempted | `docs/sessions/20260610T021136Z-uandiqueue-claude-local-test-seeder.md` |
| 215 | Community 215 | 8 | 7 | 0 | 0 | Session 20260629T054330Z — agentjwork — claude — brain-ingest-pipeline · 20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md · Attempted · Blockers | `docs/sessions/20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md` |
| 216 | Community 216 | 8 | 7 | 0 | 0 | Session 20260630T065703Z — agentjwork — claude — apps-monorepo-layout · 20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md · Attempted · Blockers | `docs/sessions/20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md` |
| 217 | Community 217 | 8 | 7 | 0 | 0 | Session 20260630T132112Z — agentjwork — claude — nao-v1-corpus-dashbo… · 20260630T132112Z-agentjwork-claude-nao-v1-corpus-dashboard.md · Attempted · Blockers | `docs/sessions/20260630T132112Z-agentjwork-claude-nao-v1-corpus-dashboard.md` |
| 218 | Community 218 | 8 | 7 | 0 | 0 | Session 20260630T155323Z — agentjwork — claude — nao-design-implement… · 20260630T155323Z-agentjwork-claude-nao-design-implementation.md · Attempted · Blockers | `docs/sessions/20260630T155323Z-agentjwork-claude-nao-design-implementation.md` |
| 219 | Community 219 | 8 | 7 | 0 | 0 | Session 20260701T064546Z — agentjwork — claude — phase2-plan-rewrite · 20260701T064546Z-agentjwork-claude-phase2-plan-rewrite.md · Addendum — demo scope: drop PDPA/privacy; expand nao; flag stale arti… · Attempted | `docs/sessions/20260701T064546Z-agentjwork-claude-phase2-plan-rewrite.md` |
| 220 | Community 220 | 8 | 7 | 0 | 0 | Session 20260716T035351Z — agentjwork — claude — agentic-seeder · 20260716T035351Z-agentjwork-claude-agentic-seeder.md · Attempted · Blockers | `docs/sessions/20260716T035351Z-agentjwork-claude-agentic-seeder.md` |
| 221 | Community 221 | 8 | 7 | 0 | 0 | Session 20260716T044929Z — agentjwork — claude — a10-verifier-scaffold · 20260716T044929Z-agentjwork-claude-a10-verifier-scaffold.md · Attempted · Blockers | `docs/sessions/20260716T044929Z-agentjwork-claude-a10-verifier-scaffold.md` |
| 222 | Community 222 | 8 | 7 | 0 | 0 | Session 20260716T060410Z — agentjwork — claude — l6-one-card-slice · 20260716T060410Z-agentjwork-claude-l6-one-card-slice.md · Attempted · Blockers | `docs/sessions/20260716T060410Z-agentjwork-claude-l6-one-card-slice.md` |
| 223 | Community 223 | 8 | 7 | 0 | 0 | Session 20260716T061453Z — agentjwork — claude — ci-node-tool-suites · 20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md · Attempted · Blockers | `docs/sessions/20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md` |
| 224 | Community 224 | 8 | 7 | 0 | 0 | Session 20260718T035658Z — agentjwork — claude — u19-brain-safeguard-… · 20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md · Attempted · Blockers | `docs/sessions/20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md` |
| 225 | Community 225 | 8 | 7 | 0 | 0 | Session 20260718T041457Z — agentjwork — claude — u20-insight-card-cat… · 20260718T041457Z-agentjwork-claude-u20-insight-card-catchup.md · Attempted · Blockers | `docs/sessions/20260718T041457Z-agentjwork-claude-u20-insight-card-catchup.md` |
| 226 | Community 226 | 8 | 7 | 0 | 0 | Session 20260718T045102Z — agentjwork — claude — u21-relationship-car… · 20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.… · Attempted · Blockers | `docs/sessions/20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.md` |
| 227 | Community 227 | 8 | 7 | 0 | 0 | Session 20260718T053625Z — agentjwork — claude — u26-budget-ledger-li… · 20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md · Attempted · Blockers | `docs/sessions/20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md` |
| 228 | Community 228 | 8 | 7 | 0 | 0 | Session 20260718T055159Z — agentjwork — claude — u27-ci-deno-migratio… · 20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md · Attempted · Blockers | `docs/sessions/20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md` |
| 229 | Community 229 | 8 | 7 | 0 | 0 | Session 20260718T061213Z — agentjwork — claude — u28-nit-sweep · 20260718T061213Z-agentjwork-claude-u28-nit-sweep.md · Attempted · Blockers | `docs/sessions/20260718T061213Z-agentjwork-claude-u28-nit-sweep.md` |
| 230 | Community 230 | 8 | 7 | 0 | 0 | Session 20260718T160053Z — agentjwork — claude — u29-deno-client-types · 20260718T160053Z-agentjwork-claude-u29-deno-client-types.md · Attempted · Blockers | `docs/sessions/20260718T160053Z-agentjwork-claude-u29-deno-client-types.md` |
| 231 | Community 231 | 8 | 7 | 0 | 0 | Session: Run 2.0 · U0 bootstrap (orchestrator) · 20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md · Assessment synthesis + worklist finalization (same session, second co… · Mid-run input from Jayden + U2 closed (orchestrator, same session) | `docs/sessions/20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md` |
| 232 | Community 232 | 8 | 7 | 0 | 0 | Run 2.0 U2 — ground the adversarial verifier (O15 / verdict B1) · 20260724T074529Z-agentjwork-claude-run2-u2-verifier-grounding.md · Acceptance test (i) · Context | `docs/sessions/20260724T074529Z-agentjwork-claude-run2-u2-verifier-grounding.md` |
| 233 | Community 233 | 8 | 7 | 0 | 0 | Run-2 independent adversarial sign-off audit and Run-3 scope lock · 20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md · Attempted · Blockers | `docs/sessions/20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md` |
| 234 | Community 234 | 8 | 7 | 0 | 0 | Windows toolchain gotchas — the recurring traps on this repo · 1. node/flutter are NOT on the base PATH · 2. Generated-plugin churn (phantom modified files) · 3. Write-tool NUL bytes (binary-looking files) | `.claude/skills/windows-toolchain-gotchas/SKILL.md` |
| 244 | Community 244 | 8 | 11 | 0 | 0 | deco_vine_corner_right.md · deco_vine_corner_right Review · Background Mode · deco_vine_corner_right.md | `assets/ui-generation/biomech-botanical/reviews/deco_vine_corner_right.md`<br/>`assets/ui-generation/biomech-botanical/prompts/deco_vine_corner_right.md` |
| 245 | Community 245 | 8 | 11 | 0 | 0 | empty_archive_specimen.md · empty_archive_specimen Review · Background Mode · empty_archive_specimen.md | `assets/ui-generation/biomech-botanical/reviews/empty_archive_specimen.md`<br/>`assets/ui-generation/biomech-botanical/prompts/empty_archive_specimen.md` |
| 246 | Community 246 | 8 | 11 | 0 | 0 | empty_notifications_flower.md · empty_notifications_flower Review · Background Mode · empty_notifications_flower.md | `assets/ui-generation/biomech-botanical/reviews/empty_notifications_flower.md`<br/>`assets/ui-generation/biomech-botanical/prompts/empty_notifications_flower.md` |
| 248 | Community 308 | 8 | 11 | 0 | 1 | Insights Neural Botanical Cluster · insights_neural_botanical_cluster · Fits Well · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/insights_neural_botanical_cluster.md`<br/>`docs/biotope/ui/ai-assets/reviews/insights_branching_node_system.md`<br/>`docs/biotope/ui/ai-assets/reviews/insights_neural_botanical_cluster.md` |
| 328 | Community 328 | 8 | 8 | 0 | 0 | verify.cli.integration.test.ts · agnesBody() · verifierReply() · CLAIMS | `tools/brain-ingest/tests/verify.cli.integration.test.ts` |
| 781 | Community 781 | 8 | 7 | 0 | 0 | architecture-context.md — Ourobion · architecture-context.md · Data Flow — the self-report loop · Database Table Overview | `docs/implemented/biotope/architecture-context.md` |
| 782 | Community 782 | 8 | 7 | 0 | 0 | Model training — isolated research workstreams · Workstreams · Compute — where these actually trained · Lifecycle | `docs/development/model-training/README.md` |
| 783 | Community 783 | 8 | 7 | 0 | 0 | Part 2: The Research Models · research-models.md · Part 1: The Swiss-Cheese Argument · Disagreement Pilot | `docs/hackathon/the_launchpad_challenge/plan/research-models.md` |
| 784 | Community 784 | 8 | 7 | 0 | 0 | Model-training run 2 — cockpit and today's training decision · Corrections that must land in Zebra before it trains · Cost · Decision: what to train today | `docs/development/model-training/run2/README.md` |
| 785 | Community 785 | 8 | 7 | 0 | 0 | Run 4 Orchestration Log · Active queue · Current documentation session · Evidence boundaries | `docs/development/run4/orchestration-log.md` |
| 786 | Community 786 | 8 | 7 | 0 | 0 | Run 4 product-envelope deviation (issue #264) · Alternatives rejected · Measurement · Owner decision (2026-07-30) | `docs/development/run4/product-envelope-deviation-264.md` |
| 787 | Community 787 | 8 | 7 | 0 | 0 | Run 4 provider-backed paper and Biotope insight test · Insights returned and rendered · Paper-derived relationship · Provider roles and spend | `docs/development/run4/provider-e2e-status.md` |
| 788 | Community 788 | 8 | 7 | 2 | 0 | Session 20260719T151130Z — agentjwork — claude — research-fixes-c5-cu… · Left (worklist, resume at F6) · 20260719T151130Z-agentjwork-claude-research-fixes-c5-cutoff.md · Attempted | `docs/sessions/20260719T151130Z-agentjwork-claude-research-fixes-c5-cutoff.md`<br/>`docs/sessions/20260719T154600Z-agentjwork-claude-research-fixes-lag2.md` |
| 789 | Community 789 | 8 | 7 | 0 | 0 | Evaluate codex's five-model plan review; open model-training run 2 · 20260727T071737Z-agentjwork-claude-model-training-run2-decision.md · Attempted · Blockers | `docs/sessions/20260727T071737Z-agentjwork-claude-model-training-run2-decision.md` |
| 790 | Community 790 | 8 | 7 | 0 | 0 | Rebuild Run 4 U0 fail-closed release gate · 20260727T135609Z-agentjwork-codex-run4-u0-fail-closed-gate.md · Attempted · Blockers | `docs/sessions/20260727T135609Z-agentjwork-codex-run4-u0-fail-closed-gate.md` |
| 791 | Community 791 | 8 | 7 | 0 | 0 | Complete the portable Zebra training bundle · 20260727T142254Z-agentjwork-claude-zebra-portable-bundle.md · Blockers · Changed | `docs/sessions/20260727T142254Z-agentjwork-claude-zebra-portable-bundle.md` |
| 792 | Community 792 | 8 | 7 | 0 | 0 | Run 4 landing-gate unit base advance · 20260728T034500Z-agentjwork-claude-run4-unit-base-advance.md · Attempted · Blockers | `docs/sessions/20260728T034500Z-agentjwork-claude-run4-unit-base-advance.md` |
| 793 | Community 793 | 8 | 7 | 0 | 0 | Run 4 landing-gate unit base advance for the Archive and Scan units · 20260728T070000Z-agentjwork-claude-run4-unit-base-advance-u9.md · Attempted · Blockers | `docs/sessions/20260728T070000Z-agentjwork-claude-run4-unit-base-advance-u9.md` |
| 794 | Community 794 | 8 | 7 | 0 | 0 | Scan tab scanning-motion restyle · 20260728T072000Z-agentjwork-claude-run4-scan-motion.md · Attempted · Blockers | `docs/sessions/20260728T072000Z-agentjwork-claude-run4-scan-motion.md` |
| 795 | Community 795 | 8 | 7 | 0 | 0 | Archive tab — historical trends alongside saved insights · 20260728T072500Z-agentjwork-claude-run4-archive-trends.md · Attempted · Blockers | `docs/sessions/20260728T072500Z-agentjwork-claude-run4-archive-trends.md` |
| 796 | Community 796 | 8 | 7 | 0 | 0 | Hackathon MVP CLOUD lane — hosted demo migration blocked by a Postgre… · 20260728T081013Z-uandiqueue-claude-hack-mvp-hosted-demo-migration.md · Attempted · Blockers | `docs/sessions/20260728T081013Z-uandiqueue-claude-hack-mvp-hosted-demo-migration.md` |
| 797 | Community 797 | 8 | 7 | 0 | 0 | Hackathon MVP biotope device demo, local fallback · 20260728T081214Z-uandiqueue-codex-hack-mvp-biotope-hosted-demo.md · Attempted · Blockers | `docs/sessions/20260728T081214Z-uandiqueue-codex-hack-mvp-biotope-hosted-demo.md` |
| 798 | Community 798 | 8 | 7 | 0 | 0 | Bound wearable authorization so a missing provider can't hang the Sca… · 20260728T102347Z-uandiqueue-claude-m3-wearable-auth-timeout.md · Attempted · Blockers | `docs/sessions/20260728T102347Z-uandiqueue-claude-m3-wearable-auth-timeout.md` |
| 799 | Community 799 | 8 | 7 | 0 | 0 | HTML UI visual-fidelity integration · 20260728T125339Z-uandiqueue-codex-html-ui-visual-fidelity.md · Attempted · Blockers | `docs/sessions/20260728T125339Z-uandiqueue-codex-html-ui-visual-fidelity.md` |
| 800 | Community 800 | 8 | 7 | 0 | 0 | Bundle the canonical Biotope logo · 20260728T131622Z-uandiqueue-codex-biotope-logo-bundle.md · Attempted · Blockers | `docs/sessions/20260728T131622Z-uandiqueue-codex-biotope-logo-bundle.md` |
| 801 | Community 801 | 8 | 7 | 0 | 0 | Run 4 landing-gate unit base advance for U10 · 20260728T133105Z-uandiqueue-claude-run4-unit-base-advance-u10.md · Attempted · Blockers | `docs/sessions/20260728T133105Z-uandiqueue-claude-run4-unit-base-advance-u10.md` |
| 802 | Community 802 | 8 | 7 | 0 | 0 | R4-U4 attestation re-record and PR #214 auth-survival proof · 20260728T150111Z-uandiqueue-claude-run4-u4-attestation-and-auth-survi… · Attempted · Blockers | `docs/sessions/20260728T150111Z-uandiqueue-claude-run4-u4-attestation-and-auth-survival.md` |
| 803 | Community 803 | 8 | 7 | 0 | 0 | R4-U1 correction — boundaries, secret scanning, and the product cap · 20260728T150859Z-altonmac-claude-run4-u1-boundary-secretscan-correcti… · Attempted · Blockers | `docs/sessions/20260728T150859Z-altonmac-claude-run4-u1-boundary-secretscan-correction.md` |
| 804 | Community 804 | 8 | 7 | 0 | 0 | R4-U1 reconciled — base re-advance past #199 · 20260728T161755Z-uandiqueue-claude-run4-u1-reconciled-base-readvance.… · Attempted · Blockers | `docs/sessions/20260728T161755Z-uandiqueue-claude-run4-u1-reconciled-base-readvance.md` |
| 805 | Community 805 | 8 | 7 | 0 | 0 | Reconcile Run 4 Zebra and Viceroy evidence package · 20260729T015436Z-agentjwork-codex-run4-pr216-evidence-reconcile.md · Attempted · Blockers | `docs/sessions/20260729T015436Z-agentjwork-codex-run4-pr216-evidence-reconcile.md` |
| 806 | Community 806 | 8 | 7 | 0 | 0 | Reconcile Run 4 U3 through PR 216 · 20260729T015820Z-agentjwork-codex-run4-reconcile-u3-through-216.md · Attempted · Blockers | `docs/sessions/20260729T015820Z-agentjwork-codex-run4-reconcile-u3-through-216.md` |
| 807 | Community 807 | 8 | 7 | 0 | 0 | Advance Run 4 unit base for final U3 landing · 20260729T024230Z-agentjwork-codex-run4-u3-base-advance.md · Attempted · Blockers | `docs/sessions/20260729T024230Z-agentjwork-codex-run4-u3-base-advance.md` |
| 808 | Community 808 | 8 | 7 | 0 | 0 | Final Run 4 U3 reconciliation · 20260729T032149Z-agentjwork-codex-run4-u3-final-reconcile.md · Attempted · Blockers | `docs/sessions/20260729T032149Z-agentjwork-codex-run4-u3-final-reconcile.md` |
| 809 | Community 809 | 8 | 7 | 0 | 0 | R4-U4 follow-on — trusted-edge plumbing for the U3 demo positive cont… · 20260729T064455Z-uandiqueue-claude-run4-u3-trust-plumbing.md · Attempted · Blockers | `docs/sessions/20260729T064455Z-uandiqueue-claude-run4-u3-trust-plumbing.md` |
| 810 | Community 810 | 8 | 7 | 0 | 0 | Regenerate Run 4 #229 derived deployment attestation · 20260729T091928Z-uandiqueue-codex-run4-229-derived-attestation.md · Attempted · Blockers | `docs/sessions/20260729T091928Z-uandiqueue-codex-run4-229-derived-attestation.md` |
| 811 | Community 811 | 8 | 7 | 0 | 0 | Run 4 PR 231 Nao identity reconciliation · 20260729T094351Z-uandiqueue-codex-run4-pr231-reconciliation.md · Attempted · Blockers | `docs/sessions/20260729T094351Z-uandiqueue-codex-run4-pr231-reconciliation.md` |
| 812 | Community 812 | 8 | 7 | 0 | 0 | Run 4 PR 231 Nao design secret fingerprint correction · 20260729T111905Z-uandiqueue-codex-run4-pr231-secret-fingerprint.md · Attempted · Blockers | `docs/sessions/20260729T111905Z-uandiqueue-codex-run4-pr231-secret-fingerprint.md` |
| 813 | Community 813 | 8 | 7 | 0 | 0 | Run 4 trust-plumbing attestation and source normalization · 20260729T114523Z-uandiqueue-codex-run4-trust-plumbing-attestation.md · Attempted · Blockers | `docs/sessions/20260729T114523Z-uandiqueue-codex-run4-trust-plumbing-attestation.md` |
| 814 | Community 814 | 8 | 7 | 0 | 0 | Run 4 source numstat recovery hardening · 20260729T120000Z-uandiqueue-codex-run4-trust-numstat-hardening.md · Attempted · Blockers | `docs/sessions/20260729T120000Z-uandiqueue-codex-run4-trust-numstat-hardening.md` |
| 815 | Community 815 | 8 | 7 | 0 | 0 | Run 4 trust numstat final review correction · 20260729T121216Z-uandiqueue-codex-run4-trust-numstat-review-correctio… · Attempted · Blockers | `docs/sessions/20260729T121216Z-uandiqueue-codex-run4-trust-numstat-review-correction.md` |
| 816 | Community 816 | 8 | 7 | 0 | 0 | Advance Run 4 unit base after PR 231 · 20260729T121914Z-uandiqueue-codex-run4-post231-unit-base-advance.md · Attempted · Blockers | `docs/sessions/20260729T121914Z-uandiqueue-codex-run4-post231-unit-base-advance.md` |
| 817 | Community 817 | 8 | 7 | 0 | 0 | Reconcile Run 4 U3 after PR 231 · 20260729T123313Z-uandiqueue-codex-run4-u3-post231-reconcile.md · Attempted · Blockers | `docs/sessions/20260729T123313Z-uandiqueue-codex-run4-u3-post231-reconcile.md` |
| 818 | Community 818 | 8 | 7 | 0 | 0 | Advance Run 4 trust unit base after accepted U3 · 20260729T124318Z-uandiqueue-codex-run4-u3-pretrust-unit-base-advance.… · Attempted · Blockers | `docs/sessions/20260729T124318Z-uandiqueue-codex-run4-u3-pretrust-unit-base-advance.md` |
| 819 | Community 819 | 8 | 7 | 0 | 0 | Refresh Run 4 U3 pretrust unit base CI provenance · 20260729T141500Z-agentjwork-codex-run4-u3-pretrust-unit-base-refresh.… · Attempted · Blockers | `docs/sessions/20260729T141500Z-agentjwork-codex-run4-u3-pretrust-unit-base-refresh.md` |
| 820 | Community 820 | 8 | 7 | 0 | 0 | Run 4 U3 trust reconciliation evidence · 20260729T153000Z-agentjwork-codex-run4-u3-trust-reconcile.md · Attempted · Blockers | `docs/sessions/20260729T153000Z-agentjwork-codex-run4-u3-trust-reconcile.md` |
| 821 | Community 821 | 8 | 7 | 0 | 0 | Run 4 U3 14+7 partial acceptance closeout · 20260729T183014Z-agentjwork-codex-run4-u3-14plus7-acceptance.md · Attempted · Blockers | `docs/sessions/20260729T183014Z-agentjwork-codex-run4-u3-14plus7-acceptance.md` |
| 822 | Community 822 | 8 | 7 | 0 | 0 | Local test-data seeder provenance safety · 20260730T025545Z-agentjwork-codex-seed-test-data-provenance.md · Attempted · Blockers | `docs/sessions/20260730T025545Z-agentjwork-codex-seed-test-data-provenance.md` |
| 823 | Community 823 | 8 | 7 | 0 | 0 | Complete Nao top-bar identity · 20260730T035516Z-agentjwork-codex-nao-topbar-identity.md · Attempted · Blockers | `docs/sessions/20260730T035516Z-agentjwork-codex-nao-topbar-identity.md` |
| 824 | Community 824 | 8 | 7 | 0 | 0 | Wire Run-now to the database seed catalog · 20260730T043428Z-agentjwork-codex-db-seed-catalog-ui.md · Attempted · Blockers | `docs/sessions/20260730T043428Z-agentjwork-codex-db-seed-catalog-ui.md` |
| 825 | Community 825 | 8 | 7 | 0 | 0 | Advance Run 4 unit base after PR 254 · 20260730T082446Z-agentjwork-codex-run4-255-base-advance.md · Attempted · Blockers | `docs/sessions/20260730T082446Z-agentjwork-codex-run4-255-base-advance.md` |
| 826 | Community 826 | 8 | 7 | 0 | 0 | Run 4 local-day projection architecture decision · 20260730T094431Z-agentjwork-codex-run4-local-day-projection-adr.md · Attempted · Blockers | `docs/sessions/20260730T094431Z-agentjwork-codex-run4-local-day-projection-adr.md` |
| 827 | Community 827 | 8 | 7 | 0 | 0 | Biotope and Nao product explainer surfaces · 20260730T132916Z-uandiqueue-claude-biotope-nao-explainer.md · Attempted · Blockers | `docs/sessions/20260730T132916Z-uandiqueue-claude-biotope-nao-explainer.md` |
| 828 | Community 828 | 8 | 7 | 0 | 0 | Privately upload and round-trip verify Zebra v1 and Viceroy v0 · 20260730T143059Z-uandiqueue-codex-private-model-artifact-upload.md · Attempted · Blockers | `docs/sessions/20260730T143059Z-uandiqueue-codex-private-model-artifact-upload.md` |
| 829 | Community 829 | 8 | 7 | 0 | 0 | Agnes explicit free pricing · 20260730T143816Z-agentjwork-codex-agnes-free-pricing.md · Attempted · Blockers | `docs/sessions/20260730T143816Z-agentjwork-codex-agnes-free-pricing.md` |
| 830 | Community 830 | 8 | 7 | 0 | 0 | Home hero and coverage artwork parity · 20260730T155205Z-agentjwork-codex-home-hero-parity.md · Attempted · Blockers | `docs/sessions/20260730T155205Z-agentjwork-codex-home-hero-parity.md` |
| 831 | Community 831 | 8 | 7 | 0 | 0 | Replace the pending model-artifact pointers with verified release evi… · 20260730T171020Z-uandiqueue-claude-verified-artifact-pointers-250.md · Attempted · Blockers | `docs/sessions/20260730T171020Z-uandiqueue-claude-verified-artifact-pointers-250.md` |
| 832 | Community 832 | 8 | 7 | 0 | 0 | Compute-baselines source NUL normalization · 20260730T202651Z-agentjwork-codex-compute-baselines-nul.md · Attempted · Blockers | `docs/sessions/20260730T202651Z-agentjwork-codex-compute-baselines-nul.md` |
| 833 | Community 833 | 8 | 7 | 0 | 0 | Issue 233 offline acceptance reconciliation · 20260731T045529Z-agentjwork-codex-issue233-offline-acceptance.md · Attempted · Blockers | `docs/sessions/20260731T045529Z-agentjwork-codex-issue233-offline-acceptance.md` |
| 834 | Community 834 | 8 | 7 | 0 | 0 | U6b wellbeing batch 1 reconciliation · 20260731T051008Z-agentjwork-codex-u6b-batch1-reconciliation.md · Attempted · Blockers | `docs/sessions/20260731T051008Z-agentjwork-codex-u6b-batch1-reconciliation.md` |
| 835 | Community 835 | 8 | 7 | 0 | 0 | Android Gradle memory envelope · 20260731T062147Z-agentjwork-codex-gradle-memory-envelope.md · Attempted · Blockers | `docs/sessions/20260731T062147Z-agentjwork-codex-gradle-memory-envelope.md` |
| 836 | Community 836 | 8 | 7 | 0 | 0 | Hackathon Biotope UI fidelity and demo hardening · 20260731T063330Z-agentjwork-codex-hackathon-biotope-ui.md · Attempted · Blockers | `docs/sessions/20260731T063330Z-agentjwork-codex-hackathon-biotope-ui.md` |
| 837 | Community 837 | 8 | 7 | 8 | 0 | Issue 221 Run 4 base reconciliation · 20260731T073421Z-agentjwork-codex-issue221-reconciliation.md · Attempted · Blockers | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 838 | Community 838 | 8 | 7 | 0 | 0 | Coverage card truthfulness · 20260731T100413Z-agentjwork-codex-coverage-card-truth-284.md · Attempted · Blockers | `docs/sessions/20260731T100413Z-agentjwork-codex-coverage-card-truth-284.md` |
| 839 | Community 839 | 8 | 7 | 0 | 0 | Registry-driven M5a trend-axis policy · 20260731T113848Z-agentjwork-codex-issue285-axis-policy.md · Attempted · Blockers | `docs/sessions/20260731T113848Z-agentjwork-codex-issue285-axis-policy.md` |
| 840 | Community 840 | 8 | 7 | 0 | 0 | Issue 290 Run 4 per-unit base advance · 20260731T130704Z-agentjwork-claude-issue290-unit-base-advance.md · Attempted · Blockers | `docs/sessions/20260731T130704Z-agentjwork-claude-issue290-unit-base-advance.md` |
| 841 | Community 841 | 8 | 7 | 0 | 0 | Issue 264 product-envelope deviation record + #222/#283/#275 deferrals · 20260731T165537Z-agentjwork-claude-issue264-envelope-deviation.md · Attempted · Blockers | `docs/sessions/20260731T165537Z-agentjwork-claude-issue264-envelope-deviation.md` |
| 842 | Community 842 | 8 | 7 | 0 | 0 | Issue 277 hackathon submission write-up refresh · 20260731T175135Z-agentjwork-claude-issue277-hackathon-submission.md · Attempted · Blockers | `docs/sessions/20260731T175135Z-agentjwork-claude-issue277-hackathon-submission.md` |
| 843 | Community 843 | 8 | 7 | 0 | 0 | Hackathon write-up model-truth correction · 20260731T180025Z-agentjwork-claude-writeup-model-truth.md · Attempted · Blockers | `docs/sessions/20260731T180025Z-agentjwork-claude-writeup-model-truth.md` |
| 844 | Community 844 | 8 | 7 | 0 | 0 | Run 4 brain/synthesis owner — land #292, then the #300 synthesis reva… · 20260731T182807Z-agent-j-claude-run4-brain-synthesis-owner.md · Attempted · Blockers | `docs/sessions/20260731T182807Z-agent-j-claude-run4-brain-synthesis-owner.md` |
| 845 | Community 845 | 8 | 7 | 0 | 0 | Submission evidence, seed coverage, and stale-doc audit · 20260731T183327Z-agentjwork-codex-submission-evidence-audit.md · Attempted · Blockers | `docs/sessions/20260731T183327Z-agentjwork-codex-submission-evidence-audit.md` |
| 846 | Community 846 | 8 | 7 | 0 | 0 | Biotope paper evidence-chain rendering · 20260731T230058Z-agentjwork-codex-issue319-evidence-chain.md · Attempted · Blockers | `docs/sessions/20260731T230058Z-agentjwork-codex-issue319-evidence-chain.md` |
| 847 | Community 847 | 8 | 7 | 0 | 0 | Run 4 — seed pool rebalance (#307 D5 / #297) · 20260801T012000Z-agent-j-claude-run4-seed-rebalance-307.md · Attempted · Blockers | `docs/sessions/20260801T012000Z-agent-j-claude-run4-seed-rebalance-307.md` |
| 848 | Community 848 | 8 | 7 | 0 | 0 | Run 4 — exclude app-measuring metrics from discovery (#307) · 20260801T014500Z-agent-j-claude-run4-exclude-app-metrics-307.md · Attempted · Blockers | `docs/sessions/20260801T014500Z-agent-j-claude-run4-exclude-app-metrics-307.md` |
| 849 | Community 849 | 8 | 7 | 0 | 0 | Run 4 — remove the product-union pin (#307 A5) · 20260801T015500Z-agent-j-claude-run4-remove-product-pin-307.md · Attempted · Blockers | `docs/sessions/20260801T015500Z-agent-j-claude-run4-remove-product-pin-307.md` |
| 850 | Community 850 | 8 | 7 | 0 | 0 | Run 4 — nao D1 ETL workflow, drafted for Session B (#307) · 20260801T021500Z-agent-j-claude-run4-nao-etl-draft-307.md · Attempted · Blockers | `docs/sessions/20260801T021500Z-agent-j-claude-run4-nao-etl-draft-307.md` |
| 851 | Community 851 | 8 | 7 | 0 | 0 | Run 4 — NAO D1 ETL workflow (#326 / #307) · 20260801T045355Z-agentjwork-codex-pr326-nao-d1-etl.md · Attempted · Blockers | `docs/sessions/20260801T045355Z-agentjwork-codex-pr326-nao-d1-etl.md` |
| 852 | Community 852 | 8 | 7 | 0 | 0 | Doc 4 — demo runbook, shot list and risk register (#328) · 20260801T052255Z-uandiqueue-claude-doc4-demo-runbook.md · Attempted · Changed | `docs/sessions/20260801T052255Z-uandiqueue-claude-doc4-demo-runbook.md` |
| 853 | Community 853 | 8 | 7 | 0 | 0 | Issue 307 Session A ingestion and grounded-edge handover · 20260801T064323Z-agentjwork-codex-session-a-ingestion.md · Attempted · Blockers | `docs/sessions/20260801T064323Z-agentjwork-codex-session-a-ingestion.md` |
| 854 | Community 854 | 8 | 7 | 0 | 0 | Issue 307 Session A no-spend edge artifact projection · 20260801T075623Z-agentjwork-codex-session-a-edge-projection.md · Attempted · Blockers | `docs/sessions/20260801T075623Z-agentjwork-codex-session-a-edge-projection.md` |
| 855 | Community 855 | 8 | 7 | 0 | 0 | Issue 345 evidence caveat and card source chain · 20260801T093544Z-uandiqueue-codex-issue-345-evidence-surfacing.md · Attempted · Blockers | `docs/sessions/20260801T093544Z-uandiqueue-codex-issue-345-evidence-surfacing.md` |
| 856 | Community 856 | 8 | 7 | 0 | 0 | Nao demo honesty: fabricated budget telemetry and paper-detail 404s · 20260801T120000Z-agent-j-claude-nao-demo-honesty-budget-telemetry-pap… · Attempted · Blockers | `docs/sessions/20260801T120000Z-agent-j-claude-nao-demo-honesty-budget-telemetry-papers-404.md` |
| 857 | Community 857 | 8 | 7 | 0 | 0 | Run 4 per-unit landing budget exhausted after #347 · 20260801T145500Z-agent-j-claude-run4-advance-unit-base-post347.md · Cause · Change | `docs/sessions/20260801T145500Z-agent-j-claude-run4-advance-unit-base-post347.md` |
| 858 | Community 858 | 8 | 7 | 0 | 0 | Regenerate the Run 4 local runtime attestation (post-#347, post-#351) · 20260801T160050Z-agent-j-claude-regenerate-attestation-post347.md · Attempted · Blockers | `docs/sessions/20260801T160050Z-agent-j-claude-regenerate-attestation-post347.md` |
| 859 | Community 859 | 8 | 7 | 0 | 0 | Regenerate the Run 4 local runtime attestation (post-#356) · 20260801T170352Z-agent-j-claude-regenerate-attestation-post356.md · Attempted · Blockers | `docs/sessions/20260801T170352Z-agent-j-claude-regenerate-attestation-post356.md` |
| 860 | Community 860 | 8 | 7 | 0 | 0 | A swiped card had no way back · 1 · Remove a saved insight (Archive tab) · 2 · Reset the weekly deck (Insights tab) · 20260802T031500Z-agent-j-claude-biotope-deck-recovery.md | `docs/sessions/20260802T031500Z-agent-j-claude-biotope-deck-recovery.md` |
| 861 | Community 861 | 8 | 7 | 0 | 0 | Hackathon attribution, GMI constraint, and submission corrections · 20260802T044842Z-uandiqueue-codex-hackathon-attribution-gmi-writeup.md · Attempted · Blockers | `docs/sessions/20260802T044842Z-uandiqueue-codex-hackathon-attribution-gmi-writeup.md` |
| 862 | Community 862 | 8 | 7 | 0 | 0 | Issue 385 live verifier corpus paths · 20260802T082430Z-agent-j-codex-live-verifier-corpus-paths.md · Attempted · Blockers | `docs/sessions/20260802T082430Z-agent-j-codex-live-verifier-corpus-paths.md` |
| 863 | Community 863 | 8 | 7 | 0 | 0 | Issue 387 R2 synthesis resume hydration · 20260802T090603Z-agent-j-codex-r2-resume-hydration.md · Attempted · Blockers | `docs/sessions/20260802T090603Z-agent-j-codex-r2-resume-hydration.md` |
| 864 | Community 864 | 8 | 7 | 0 | 0 | Issue 389 R2-to-local claims hydration · 20260802T093611Z-agent-j-codex-r2-local-hydration.md · Attempted · Blockers | `docs/sessions/20260802T093611Z-agent-j-codex-r2-local-hydration.md` |
| 865 | Community 865 | 8 | 7 | 0 | 0 | Viceroy Causal-Language-Risk v0 — training build log · build-log.md · Ledger · S0 findings — the corpus is not what the plan assumed (2026-07-27) | `docs/development/model-training/viceroy-training/build-log.md` |
| 235 | Community 293 | 7 | 6 | 0 | 1 | Biomech-botanical Asset Style · Asset Acceptance Workflow · Background Mode Prompting · Biotope Design Tokens | `docs/biotope/ui/ai-assets/asset-style-guide.md`<br/>`docs/biotope/ui/ai-assets/lessons/prompt-lessons.md`<br/>`docs/biotope/ui/ai-assets/lessons/rejected-assets.md` |
| 236 | Community 236 | 7 | 6 | 1 | 0 | Part A — Operating principles · A1. The three economies · A2. The three levers that decide every manual metric · A3. The tier ladder | `docs/implemented/biotope/metrics-catalog.md` |
| 237 | Community 237 | 7 | 6 | 1 | 0 | Part D — SG/MY localization deep-dive · D-i. Diet capture kit (replaces gram-level logging) · D-ii. Hydration without asking volume · D-iii. Climate & exposome priorities | `docs/implemented/biotope/metrics-catalog.md` |
| 239 | Community 239 | 7 | 7 | 2 | 0 | copy_guidelines.test.ts · copy_guidelines.ts · COPY_RULES · forbiddenWordPattern() | `shared/constants/copy_guidelines.ts`<br/>`tools/rules/tests/copy_guidelines.test.ts` |
| 243 | Community 243 | 7 | 7 | 0 | 0 | _ · AuthResult · errorMessage · failure | `apps/biotope/lib/modules/m1_core/models/auth_result.dart` |
| 247 | Community 247 | 7 | 6 | 0 | 0 | Where audit findings cluster in this repo · 1. The "shared schema is the only gate on foreign inputs" seam · 2. Contract-vs-reality drift on app-facing surfaces · 3. Projection lifecycle — rows that only ever accumulate, or vanish w… | `.claude/skills/record-only-audit/references/finding-hotspots.md` |
| 249 | Community 309 | 7 | 6 | 0 | 1 | scan_circular_bloom · Fits Well · Flutter Usage · Scan Biomechanical Orchid | `assets/ui-generation/biomech-botanical/reviews/scan_circular_bloom.md`<br/>`docs/biotope/ui/ai-assets/reviews/scan_biomech_orchid.md` |
| 250 | Community 250 | 7 | 6 | 0 | 0 | Session 20260601T000000Z — uandiqueue — team — historical-backfill · 20260601T000000Z-uandiqueue-team-historical-backfill.md · Attempted · Blockers / notes | `docs/sessions/20260601T000000Z-uandiqueue-team-historical-backfill.md` |
| 251 | Community 251 | 7 | 6 | 0 | 0 | Session 20260610T035536Z — uandiqueue — claude — pr-target-dev-phase2… · 20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md · Attempted · Blockers | `docs/sessions/20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md` |
| 252 | Community 252 | 7 | 6 | 0 | 0 | Session 20260610T042206Z — uandiqueue — claude — consolidate-onto-dev… · 20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md · Attempted · Blockers | `docs/sessions/20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md` |
| 253 | Community 253 | 7 | 6 | 0 | 0 | Session 20260611T070148Z — uandiqueue — claude — phase2-goals-feature… · 20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md · Attempted · Blockers | `docs/sessions/20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md` |
| 254 | Community 254 | 7 | 6 | 0 | 0 | Session 20260611T073034Z — uandiqueue — claude — docs-cleanup-stale-r… · 20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md · Attempted · Blockers | `docs/sessions/20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md` |
| 255 | Community 255 | 7 | 6 | 0 | 0 | Session 20260611T084236Z — uandiqueue — claude — phase2-integrated-pl… · 20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md · Attempted · Blockers | `docs/sessions/20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md` |
| 256 | Community 256 | 7 | 6 | 0 | 0 | Session 20260617T062023Z — uandiqueue — claude — graphify-hook-and-do… · 20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md · Attempted · Blockers | `docs/sessions/20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md` |
| 257 | Community 257 | 7 | 6 | 0 | 0 | Session 20260617T071616Z — uandiqueue — claude — graphify-prewire-cod… · 20260617T071616Z-uandiqueue-claude-graphify-prewire-codex-gemini.md · Attempted · Blockers | `docs/sessions/20260617T071616Z-uandiqueue-claude-graphify-prewire-codex-gemini.md` |
| 258 | Community 258 | 7 | 6 | 0 | 0 | Session 20260618T092022Z — uandiqueue — claude — graphify-claude-skill · 20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md · Attempted · Blockers | `docs/sessions/20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md` |
| 259 | Community 259 | 7 | 6 | 0 | 0 | Session 20260618T094117Z — uandiqueue — claude — readme-context-engin… · 20260618T094117Z-uandiqueue-claude-readme-context-engineering.md · Attempted · Blockers | `docs/sessions/20260618T094117Z-uandiqueue-claude-readme-context-engineering.md` |
| 260 | Community 260 | 7 | 6 | 0 | 0 | Session 20260618T094429Z — uandiqueue — claude — wikilinks-to-markdown · 20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md · Attempted · Blockers | `docs/sessions/20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md` |
| 261 | Community 261 | 7 | 6 | 0 | 0 | Session 20260619T020858Z — uandiqueue — claude — commit-metrics-regis… · 20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md · Attempted · Blockers | `docs/sessions/20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md` |
| 262 | Community 262 | 7 | 6 | 0 | 0 | Session 20260619T060221Z — uandiqueue — claude — metrics-registry-sha… · 20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md · Attempted · Blockers | `docs/sessions/20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md` |
| 263 | Community 263 | 7 | 6 | 0 | 0 | Session 20260620T161931Z — uandiqueue — claude — phase2-replan-metric… · 20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md · Attempted · Blockers | `docs/sessions/20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md` |
| 264 | Community 264 | 7 | 6 | 0 | 0 | Session 20260622T021945Z — uandiqueue — claude — w0-metric-platform-f… · 20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md · Attempted · Blockers | `docs/sessions/20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md` |
| 265 | Community 265 | 7 | 6 | 0 | 0 | Session 20260625T030745Z — uandiqueue — claude — brain-relationship-c… · 20260625T030745Z-uandiqueue-claude-brain-relationship-contract.md · Attempted · Blockers | `docs/sessions/20260625T030745Z-uandiqueue-claude-brain-relationship-contract.md` |
| 266 | Community 266 | 7 | 6 | 0 | 0 | Session 20260625T041011Z — uandiqueue — claude — rebrand-ourobion · 20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md · Attempted · Blockers | `docs/sessions/20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md` |
| 267 | Community 267 | 7 | 6 | 0 | 0 | Session 20260629T152720Z — agentjwork — claude — docs-feature-folders · 20260629T152720Z-agentjwork-claude-docs-feature-folders.md · Attempted · Blockers | `docs/sessions/20260629T152720Z-agentjwork-claude-docs-feature-folders.md` |
| 268 | Community 268 | 7 | 6 | 0 | 0 | Session 20260630T050141Z — agentjwork — claude — nao-design-doc · 20260630T050141Z-agentjwork-claude-nao-design-doc.md · Attempted · Blockers | `docs/sessions/20260630T050141Z-agentjwork-claude-nao-design-doc.md` |
| 269 | Community 269 | 7 | 6 | 0 | 0 | Session 20260630T071429Z — agentjwork — claude — nao-research-brief · 20260630T071429Z-agentjwork-claude-nao-research-brief.md · Attempted · Blockers | `docs/sessions/20260630T071429Z-agentjwork-claude-nao-research-brief.md` |
| 270 | Community 270 | 7 | 6 | 0 | 0 | Session 20260630T075152Z — agentjwork — claude — nao-env-convention · 20260630T075152Z-agentjwork-claude-nao-env-convention.md · Attempted · Blockers | `docs/sessions/20260630T075152Z-agentjwork-claude-nao-env-convention.md` |
| 271 | Community 271 | 7 | 6 | 0 | 0 | Session 20260701T031916Z — agentjwork — claude — readme-restructure · 20260701T031916Z-agentjwork-claude-readme-restructure.md · Attempted · Blockers | `docs/sessions/20260701T031916Z-agentjwork-claude-readme-restructure.md` |
| 272 | Community 272 | 7 | 6 | 0 | 0 | Session 20260701T052316Z — agentjwork — claude — brain-pipeline-decis… · 20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md · Attempted · Blockers | `docs/sessions/20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md` |
| 273 | Community 273 | 7 | 6 | 0 | 0 | Session 20260701T061754Z — agentjwork — claude — phase2-integrated-pl… · 20260701T061754Z-agentjwork-claude-phase2-integrated-plan-update.md · Attempted · Blockers | `docs/sessions/20260701T061754Z-agentjwork-claude-phase2-integrated-plan-update.md` |
| 274 | Community 274 | 7 | 6 | 0 | 0 | Session 20260701T062951Z — agentjwork — claude — metric-100-decision-… · 20260701T062951Z-agentjwork-claude-metric-100-decision-consolidate.md · Attempted · Blockers | `docs/sessions/20260701T062951Z-agentjwork-claude-metric-100-decision-consolidate.md` |
| 275 | Community 275 | 7 | 6 | 0 | 0 | Session 20260701T080448Z — agentjwork — claude — demo-scope-propagate · 20260701T080448Z-agentjwork-claude-demo-scope-propagate.md · Attempted · Blockers | `docs/sessions/20260701T080448Z-agentjwork-claude-demo-scope-propagate.md` |
| 276 | Community 276 | 7 | 6 | 0 | 0 | Session 20260702T080203Z — altogennn — claude — m2-standing-water-aud… · 20260702T080203Z-altogennn-claude-m2-standing-water-audit.md · Attempted · Blockers | `docs/sessions/20260702T080203Z-altogennn-claude-m2-standing-water-audit.md` |
| 277 | Community 277 | 7 | 6 | 0 | 0 | Session 20260703T065307Z — agentjwork — claude — nao-corpus-run-plus-… · 20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md · Attempted · Blockers | `docs/sessions/20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md` |
| 278 | Community 278 | 7 | 6 | 0 | 0 | Session 20260708T164343Z — altogennn — claude — biotope-nao-link-refi… · 20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md · Attempted · Blockers | `docs/sessions/20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md` |
| 279 | Community 279 | 7 | 6 | 0 | 0 | Session 20260715T134326Z — agentjwork — claude — phase2-run-orchestra… · 20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap… · Attempted · Blockers | `docs/sessions/20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap.md` |
| 280 | Community 280 | 7 | 6 | 0 | 0 | Session 20260715T135541Z — agentjwork — claude — l0-contract-extension · 20260715T135541Z-agentjwork-claude-l0-contract-extension.md · Attempted · Blockers | `docs/sessions/20260715T135541Z-agentjwork-claude-l0-contract-extension.md` |
| 281 | Community 281 | 7 | 6 | 0 | 0 | Session 20260715T140420Z — agentjwork — claude — storage-primitives · 20260715T140420Z-agentjwork-claude-storage-primitives.md · Attempted · Blockers | `docs/sessions/20260715T140420Z-agentjwork-claude-storage-primitives.md` |
| 282 | Community 282 | 7 | 6 | 0 | 0 | Session 20260715T143750Z — agentjwork — claude — brain-llm-router · 20260715T143750Z-agentjwork-claude-brain-llm-router.md · Attempted · Blockers | `docs/sessions/20260715T143750Z-agentjwork-claude-brain-llm-router.md` |
| 283 | Community 283 | 7 | 6 | 0 | 0 | Session 20260715T145734Z — agentjwork — claude — quotecheck-venue-loo… · 20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md · Attempted · Blockers | `docs/sessions/20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md` |
| 284 | Community 284 | 7 | 6 | 0 | 0 | Session 20260715T152517Z — agentjwork — claude — rules-as-data · 20260715T152517Z-agentjwork-claude-rules-as-data.md · Attempted · Blockers | `docs/sessions/20260715T152517Z-agentjwork-claude-rules-as-data.md` |
| 285 | Community 285 | 7 | 6 | 0 | 0 | Session 20260715T153917Z — agentjwork — claude — s2-view-s3-baseline-… · 20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md · Attempted · Blockers | `docs/sessions/20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md` |
| 286 | Community 286 | 7 | 6 | 0 | 0 | Session 20260716T024359Z — agentjwork — claude — s4-signals-s5-evalua… · 20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md · Attempted · Blockers | `docs/sessions/20260716T024359Z-agentjwork-claude-s4-signals-s5-evaluator.md` |
| 287 | Community 287 | 7 | 6 | 0 | 0 | Session 20260716T031048Z — agentjwork — claude — s6-edge-store-a11-lo… · 20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md · Attempted · Blockers | `docs/sessions/20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md` |
| 288 | Community 288 | 7 | 6 | 0 | 0 | Session 20260716T050639Z — agentjwork — claude — s7-composer-s8-cards · 20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md · Attempted · Blockers | `docs/sessions/20260716T050639Z-agentjwork-claude-s7-composer-s8-cards.md` |
| 289 | Community 289 | 7 | 6 | 0 | 0 | Session 20260718T033750Z — agentjwork — claude — chain-recovery-docs-… · 20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md · Attempted · Blockers | `docs/sessions/20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md` |
| 290 | Community 290 | 7 | 6 | 0 | 0 | Session 20260718T043726Z — agentjwork — claude — u22-snooze-stale-sig… · 20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md · Attempted · Blockers | `docs/sessions/20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md` |
| 291 | Community 291 | 7 | 6 | 0 | 0 | Session 20260718T062214Z — agentjwork — claude — backend-test-plan-br… · 20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md · Attempted · Blockers | `docs/sessions/20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md` |
| 292 | Community 292 | 7 | 6 | 0 | 0 | Session 20260718T163741Z — agentjwork — claude — skills-run-procedures · 20260718T163741Z-agentjwork-claude-skills-run-procedures.md · Attempted · Blockers | `docs/sessions/20260718T163741Z-agentjwork-claude-skills-run-procedures.md` |
| 293 | Community 293 | 7 | 6 | 0 | 0 | Session 20260719T102011Z — agentjwork — claude — skills-generality-re… · 20260719T102011Z-agentjwork-claude-skills-generality-refactor.md · Attempted · Blockers | `docs/sessions/20260719T102011Z-agentjwork-claude-skills-generality-refactor.md` |
| 294 | Community 294 | 7 | 6 | 0 | 0 | Session 20260719T161537Z — agentjwork — claude — research-fixes-compo… · 20260719T161537Z-agentjwork-claude-research-fixes-composite-calibrati… · Attempted · Blockers | `docs/sessions/20260719T161537Z-agentjwork-claude-research-fixes-composite-calibration.md` |
| 295 | Community 295 | 7 | 6 | 0 | 0 | Session 20260720T040750Z — agentjwork — claude — research-fixes-commi… · 20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-rev… · Attempted · Blockers | `docs/sessions/20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-review.md` |
| 296 | Community 296 | 7 | 6 | 0 | 0 | Session 20260720T054702Z — agentjwork — claude — phase2-unit-signoff-… · 20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md · Attempted · Blockers | `docs/sessions/20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md` |
| 297 | Community 297 | 7 | 6 | 0 | 0 | What was done · Run 2.0 U3 — contract hardening (O17 + O20; verdict B3 + H3) · 20260724T080239Z-agentjwork-claude-run2-u3-contract-hardening.md · Gate summary (all green) | `docs/sessions/20260724T080239Z-agentjwork-claude-run2-u3-contract-hardening.md` |
| 298 | Community 298 | 7 | 6 | 0 | 0 | Run-2 U11 — gap surfacing in nao (O9 demo slice / feature (d)) · 20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md · Decisions made autonomously (for review) · Gates | `docs/sessions/20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md` |
| 299 | Community 299 | 7 | 6 | 0 | 0 | Stacked PR chains — run, merge, recover · Branch-cleanup safety · Recovery · SKILL.md | `.claude/skills/stacked-pr-chain/SKILL.md` |
| 300 | Community 235 | 7 | 6 | 0 | 0 | Documentation Readiness · Truth Hierarchy · B-PL20 Documentation and Agent Safety Work · B-PL21 Shared Contract Debt | `docs/temp/documentation-freshness-audit-2026-07-26.md` |
| 321 | Community 397 | 7 | 10 | 0 | 0 | Scan Sensor Flower Closeup · scan_sensor_flower_closeup · Fits Well · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/scan_sensor_flower_closeup.md`<br/>`docs/biotope/ui/ai-assets/reviews/scan_sensor_flower_closeup.md` |
| 866 | Community 866 | 7 | 6 | 0 | 0 | structure-context.md — Ourobion Repository Structure · Dev toolchain is OUTSIDE the repo (Windows-native setup) · Directory Layout · Environment Files | `docs/development/structure-context.md` |
| 867 | Community 867 | 7 | 6 | 0 | 0 | Repository guide · Fast review route · How the pieces connect · Repository map | `docs/repository-guide.md` |
| 868 | Community 868 | 7 | 6 | 0 | 0 | Ourobion Nao — Brand Assets · Colours · Contents · Dark vs light | `assets/ourobion-nao-logo/README.md` |
| 869 | Community 869 | 7 | 6 | 0 | 0 | Brain-ingest seed coverage audit (issue #297) · Current `seed-queries` surface · Decision and remaining execution · Implemented 33-topic pool | `docs/development/run4/seed-coverage-audit-297.md` |
| 870 | Community 870 | 7 | 6 | 0 | 0 | R4-U6 progress ledger · Current findings · Human gates · Live baseline | `docs/development/run4/u6-progress.md` |
| 871 | Community 871 | 7 | 6 | 5 | 0 | Session 20260719T145507Z — agentjwork — claude — research-fixes-rho-l… · 20260719T145507Z-agentjwork-claude-research-fixes-rho-label.md · Attempted · Blockers | `docs/sessions/20260719T145507Z-agentjwork-claude-research-fixes-rho-label.md` |
| 872 | Community 872 | 7 | 6 | 1 | 0 | Session 20260719T152353Z — agentjwork — claude — research-fixes-edge-… · 20260719T152353Z-agentjwork-claude-research-fixes-edge-components.md · Attempted · Blockers | `docs/sessions/20260719T152353Z-agentjwork-claude-research-fixes-edge-components.md` |
| 873 | Community 873 | 7 | 6 | 5 | 0 | Session 20260719T153645Z — agentjwork — claude — research-fixes-deadb… · 20260719T153645Z-agentjwork-claude-research-fixes-deadbandk.md · Attempted · Blockers | `docs/sessions/20260719T153645Z-agentjwork-claude-research-fixes-deadbandk.md` |
| 874 | Community 874 | 7 | 6 | 5 | 0 | Session 20260719T155721Z — agentjwork — claude — research-fixes-xdf-s… · 20260719T155721Z-agentjwork-claude-research-fixes-xdf-seam.md · Attempted · Blockers | `docs/sessions/20260719T155721Z-agentjwork-claude-research-fixes-xdf-seam.md` |
| 875 | Community 875 | 7 | 6 | 5 | 0 | Session 20260719T160726Z — agentjwork — claude — research-fixes-impac… · 20260719T160726Z-agentjwork-claude-research-fixes-impacttier.md · Attempted · Blockers | `docs/sessions/20260719T160726Z-agentjwork-claude-research-fixes-impacttier.md` |
| 876 | Community 876 | 7 | 6 | 0 | 0 | Run-3 GMI custom-model training plan and document consolidation · 20260726T141532Z-agentjwork-codex-run3-gmi-training-plan.md · Attempted · Blockers | `docs/sessions/20260726T141532Z-agentjwork-codex-run3-gmi-training-plan.md` |
| 877 | Community 877 | 7 | 6 | 0 | 0 | Zebra model-training separation, documentation audit, and semantic gr… · 20260726T163505Z-agentjwork-codex-zebra-model-training-doc-split.md · Attempted · Blockers | `docs/sessions/20260726T163505Z-agentjwork-codex-zebra-model-training-doc-split.md` |
| 878 | Community 878 | 7 | 6 | 0 | 0 | Training plans for the remaining custom support models · 20260726T172257Z-agentjwork-claude-model-training-plans.md · Attempted · Blockers | `docs/sessions/20260726T172257Z-agentjwork-claude-model-training-plans.md` |
| 879 | Community 879 | 7 | 6 | 0 | 0 | Fix the semantic graph view's broken Details panel and rebuild it · 20260726T193058Z-agentjwork-claude-graph-view-newline-fix.md · Attempted · Blockers | `docs/sessions/20260726T193058Z-agentjwork-claude-graph-view-newline-fix.md` |
| 880 | Community 880 | 7 | 6 | 0 | 0 | Make the tracked graph view Markdown again and demote the HTML to a l… · 20260726T194652Z-agentjwork-claude-graph-view-markdown-canonical.md · Attempted · Blockers | `docs/sessions/20260726T194652Z-agentjwork-claude-graph-view-markdown-canonical.md` |
| 881 | Community 881 | 7 | 6 | 0 | 0 | Review all five custom-model training plans for workability · 20260727T065349Z-agentjwork-codex-five-model-plan-review.md · Attempted · Blockers | `docs/sessions/20260727T065349Z-agentjwork-codex-five-model-plan-review.md` |
| 882 | Community 882 | 7 | 6 | 0 | 0 | Run 4 prompt review, correction, and technical sign-off · 20260727T073714Z-agentjwork-codex-run4-prompt-signoff.md · Attempted · Blockers | `docs/sessions/20260727T073714Z-agentjwork-codex-run4-prompt-signoff.md` |
| 883 | Community 883 | 7 | 6 | 0 | 0 | Reconcile Run 4 with codex, add the exit gate, write the launch prompt · 20260727T093538Z-agentjwork-claude-run4-exit-gate-and-launch-prompt.md · Blockers · Changed | `docs/sessions/20260727T093538Z-agentjwork-claude-run4-exit-gate-and-launch-prompt.md` |
| 884 | Community 884 | 7 | 6 | 0 | 0 | Make the Run 4 launch prompt autonomous · 20260727T094231Z-agentjwork-claude-run4-prompt-autonomous.md · Attempted · Blockers | `docs/sessions/20260727T094231Z-agentjwork-claude-run4-prompt-autonomous.md` |
| 885 | Community 885 | 7 | 6 | 0 | 0 | Session 20260727T100212Z — agentjwork — codex — run4-preflight · 20260727T100212Z-agentjwork-codex-run4-preflight.md · Attempted · Blockers | `docs/sessions/20260727T100212Z-agentjwork-codex-run4-preflight.md` |
| 886 | Community 886 | 7 | 6 | 0 | 0 | Add interpretive context to the Zebra bundle · 20260727T145646Z-agentjwork-claude-zebra-bundle-context.md · Blockers · Changed | `docs/sessions/20260727T145646Z-agentjwork-claude-zebra-bundle-context.md` |
| 887 | Community 887 | 7 | 6 | 0 | 0 | Run 4 lineage repair — inherit Run 3 history · 20260727T153417Z-agentjwork-codex-run4-inherit-run3.md · Attempted · Blockers | `docs/sessions/20260727T153417Z-agentjwork-codex-run4-inherit-run3.md` |
| 888 | Community 888 | 7 | 6 | 0 | 0 | Run 4 â€” integrate completed MT3 history · 20260727T155122Z-agentjwork-codex-run4-integrate-mt3-history.md · Attempted · Blockers | `docs/sessions/20260727T155122Z-agentjwork-codex-run4-integrate-mt3-history.md` |
| 889 | Community 889 | 7 | 6 | 0 | 0 | Run 4 U1 — mechanical boundaries (O35) + fail-closed secret scanning … · 20260727T182752Z-agentjwork-claude-run4-u1-boundaries-secret-scan.md · Attempted · Blockers | `docs/sessions/20260727T182752Z-agentjwork-claude-run4-u1-boundaries-secret-scan.md` |
| 890 | Community 890 | 7 | 6 | 0 | 0 | Run 4 — advance `RUN4_UNIT_BASE_SHA` so the landing gate measures per… · 20260727T184703Z-agentjwork-claude-run4-gate-unit-base-advance.md · Attempted · Blockers | `docs/sessions/20260727T184703Z-agentjwork-claude-run4-gate-unit-base-advance.md` |
| 891 | Community 891 | 7 | 6 | 0 | 0 | Run 4 U5 — local single-paper authoring · 20260727T201745Z-agentjwork-codex-run4-u5-single-paper-authoring.md · Attempted · Blockers | `docs/sessions/20260727T201745Z-agentjwork-codex-run4-u5-single-paper-authoring.md` |
| 892 | Community 892 | 7 | 6 | 0 | 0 | Session: biomech-botanical UI reskin — part 2 (Home, Scan, Insights d… · 20260727T202926Z-uandiqueue-claude-biomech-botanical-reskin-part2.md · Attempted · Blockers | `docs/sessions/20260727T202926Z-uandiqueue-claude-biomech-botanical-reskin-part2.md` |
| 893 | Community 893 | 7 | 6 | 0 | 0 | Run 4 U2 — nao authorization and server-key boundary (O25) · 20260727T213405Z-agentjwork-claude-run4-u2-nao-authorization.md · Attempted · Blockers | `docs/sessions/20260727T213405Z-agentjwork-claude-run4-u2-nao-authorization.md` |
| 894 | Community 894 | 7 | 6 | 0 | 0 | Run 4 U1 security admission corrections · 20260727T221935Z-agentjwork-codex-run4-u1-security-fix.md · Attempted · Blockers | `docs/sessions/20260727T221935Z-agentjwork-codex-run4-u1-security-fix.md` |
| 895 | Community 895 | 7 | 6 | 0 | 0 | Run 4 U2 replacement-key and executable-auth correction · 20260727T230110Z-agentjwork-codex-run4-u2-key-correction.md · Attempted · Blockers | `docs/sessions/20260727T230110Z-agentjwork-codex-run4-u2-key-correction.md` |
| 896 | Community 896 | 7 | 6 | 0 | 0 | Run 4 U2 follow-up — truthful control-audit lifecycles · 20260727T232237Z-agentjwork-codex-run4-u2-audit-truth.md · Attempted · Blockers | `docs/sessions/20260727T232237Z-agentjwork-codex-run4-u2-audit-truth.md` |
| 897 | Community 897 | 7 | 6 | 0 | 0 | Run 4 U5 execution check and stop handoff · 20260728T005327Z-agentjwork-codex-run4-stop-handoff.md · Attempted · Blockers | `docs/sessions/20260728T005327Z-agentjwork-codex-run4-stop-handoff.md` |
| 898 | Community 898 | 7 | 6 | 0 | 0 | Run 4 provider-backed paper and Biotope insight test · 20260728T020913Z-agentjwork-codex-run4-provider-e2e.md · Attempted · Blockers | `docs/sessions/20260728T020913Z-agentjwork-codex-run4-provider-e2e.md` |
| 899 | Community 899 | 7 | 6 | 0 | 0 | UI continuation — close the five scoped gaps from #175 and ship the f… · 20260728T022632Z-agentjwork-claude-ui-biomech-botanical-full.md · Attempted · Blockers | `docs/sessions/20260728T022632Z-agentjwork-claude-ui-biomech-botanical-full.md` |
| 900 | Community 900 | 7 | 6 | 0 | 0 | Run 4 cockpit refresh and continuation entrypoint · 20260728T030109Z-agentjwork-codex-run4-cockpit-refresh.md · Attempted · Blockers | `docs/sessions/20260728T030109Z-agentjwork-codex-run4-cockpit-refresh.md` |
| 901 | Community 901 | 7 | 6 | 0 | 0 | Hackathon write-up drafted and moved into the repo · 20260728T093852Z-agentjwork-claude-hackathon-writeup-submission.md · Attempted · Blockers | `docs/sessions/20260728T093852Z-agentjwork-claude-hackathon-writeup-submission.md` |
| 902 | Community 902 | 7 | 6 | 0 | 0 | Publish Zebra v1 and Viceroy v0 results and artifact evidence · 20260728T100820Z-uandiqueue-codex-publish-zebra-viceroy-results.md · Attempted · Blockers | `docs/sessions/20260728T100820Z-uandiqueue-codex-publish-zebra-viceroy-results.md` |
| 903 | Community 903 | 7 | 6 | 0 | 0 | Run 4 U6 A5 daily-log options brief · 20260728T131600Z-agentjwork-codex-run4-u6-a5-options.md · Attempted · Blockers | `docs/sessions/20260728T131600Z-agentjwork-codex-run4-u6-a5-options.md` |
| 904 | Community 904 | 7 | 6 | 0 | 0 | U6a primitive daily-projection scaffold · 20260728T134636Z-agentjwork-codex-u6a-projection-scaffold.md · Attempted · Blockers | `docs/sessions/20260728T134636Z-agentjwork-codex-u6a-projection-scaffold.md` |
| 905 | Community 905 | 7 | 6 | 0 | 0 | Run 4 U6 metric-expansion orchestration · 20260728T135556Z-agentjwork-codex-run4-u6-orchestration.md · Attempted · Blockers | `docs/sessions/20260728T135556Z-agentjwork-codex-run4-u6-orchestration.md` |
| 906 | Community 906 | 7 | 6 | 0 | 0 | nao identity adoption (issue #223) · 20260728T135901Z-uandiqueue-claude-nao-identity-adoption.md · Attempted · Blockers | `docs/sessions/20260728T135901Z-uandiqueue-claude-nao-identity-adoption.md` |
| 907 | Community 907 | 7 | 6 | 0 | 0 | Record Run 4 U6b local-complete ledger state · 20260728T162254Z-agentjwork-codex-run4-u6b-ledger.md · Attempted · Blockers | `docs/sessions/20260728T162254Z-agentjwork-codex-run4-u6b-ledger.md` |
| 908 | Community 908 | 7 | 6 | 0 | 0 | Run 4 U3 reconciliation stopped at landing cap · 20260729T013500Z-agentjwork-codex-run4-u3-cap-stop.md · Attempted · Blockers | `docs/sessions/20260729T013500Z-agentjwork-codex-run4-u3-cap-stop.md` |
| 909 | Community 909 | 7 | 6 | 0 | 0 | R4-U3 trust plumbing — salvage commit · 20260729T082410Z-uandiqueue-claude-run4-u3-salvage-commit.md · Assessed (no code changed by me beyond the commit) · Committed and pushed | `docs/sessions/20260729T082410Z-uandiqueue-claude-run4-u3-salvage-commit.md` |
| 910 | Community 910 | 7 | 6 | 0 | 0 | Run 4 #229 review deviation and #215 retention record · 20260729T083844Z-uandiqueue-codex-run4-229-review-deviation.md · Attempted · Blockers | `docs/sessions/20260729T083844Z-uandiqueue-codex-run4-229-review-deviation.md` |
| 911 | Community 911 | 7 | 6 | 0 | 0 | Nao production build contract and local OpenNext evidence · 20260730T053537Z-agentjwork-codex-nao-production-build-contract.md · Attempted · Blockers | `docs/sessions/20260730T053537Z-agentjwork-codex-nao-production-build-contract.md` |
| 912 | Community 912 | 7 | 6 | 0 | 0 | Record Zebra and Viceroy artifact-publication deferral · 20260730T061240Z-agentjwork-codex-run4-215-publication-deferral.md · Attempted · Blockers | `docs/sessions/20260730T061240Z-agentjwork-codex-run4-215-publication-deferral.md` |
| 913 | Community 913 | 7 | 6 | 0 | 0 | Complete Run 4 U3 provider-safety acceptance plumbing · 20260730T065743Z-agentjwork-codex-run4-u3-provider-safety.md · Attempted · Blockers | `docs/sessions/20260730T065743Z-agentjwork-codex-run4-u3-provider-safety.md` |
| 914 | Community 914 | 7 | 6 | 0 | 0 | Fill the auth scaffold viewport · 20260730T090151Z-agentjwork-codex-auth-scaffold-viewport.md · Attempted · Blockers | `docs/sessions/20260730T090151Z-agentjwork-codex-auth-scaffold-viewport.md` |
| 915 | Community 915 | 7 | 6 | 0 | 0 | Citation canonical semantics · 20260731T104213Z-agentjwork-codex-citation-canonical-semantics.md · Attempted · Blockers | `docs/sessions/20260731T104213Z-agentjwork-codex-citation-canonical-semantics.md` |
| 916 | Community 916 | 7 | 6 | 0 | 0 | Issue #226 ? nao login UI and authenticated browser acceptance · 20260731T210955Z-agentjwork-codex-issue226-nao-login-browser.md · Attempted · Blockers | `docs/sessions/20260731T210955Z-agentjwork-codex-issue226-nao-login-browser.md` |
| 917 | Community 917 | 7 | 6 | 0 | 0 | Session: Issue #321 device, scale, and count UI resumption · 20260801T034529Z-agentjwork-codex-issue321-device-scales-counts.md · Attempted · Blockers | `docs/sessions/20260801T034529Z-agentjwork-codex-issue321-device-scales-counts.md` |
| 918 | Community 918 | 7 | 6 | 0 | 0 | Run 4 per-unit base advance after #329 · 20260801T054005Z-agentjwork-codex-issue330-run4-unit-base.md · Attempted · Blockers | `docs/sessions/20260801T054005Z-agentjwork-codex-issue330-run4-unit-base.md` |
| 919 | Community 919 | 7 | 6 | 0 | 0 | Nao bounded brain-pipeline operator control · 20260801T072437Z-agentjwork-codex-issue275-nao-brain-pipeline.md · Attempted · Blockers | `docs/sessions/20260801T072437Z-agentjwork-codex-issue275-nao-brain-pipeline.md` |
| 920 | Community 920 | 7 | 6 | 0 | 0 | Issue #344 — final ingest loop, A1 seed repair and live ingest · 20260801T094957Z-agent-j-codex-issue344-final-ingest-loop.md · Attempted · Blockers | `docs/sessions/20260801T094957Z-agent-j-codex-issue344-final-ingest-loop.md` |
| 921 | Community 921 | 7 | 6 | 0 | 0 | nao ingest seeds + brain-pipeline dispatch · Defect 1 — a nao-created seed was rejected as a typo · 20260801T182511Z-agent-j-claude-fix-ingest-seeds-and-pipeline-dispatc… · Defect 2 — why the dispatch button was not live | `docs/sessions/20260801T182511Z-agent-j-claude-fix-ingest-seeds-and-pipeline-dispatch.md` |
| 922 | Community 922 | 7 | 6 | 0 | 0 | The synthesis node's daily USD cap was too small for the work it was … · 20260802T003000Z-agent-j-claude-run4-router-day-cap.md · Gates · Owner instruction | `docs/sessions/20260802T003000Z-agent-j-claude-run4-router-day-cap.md` |
| 923 | Community 923 | 7 | 6 | 0 | 0 | Phase 4 — stale updates · 20260802T021752Z-uandiqueue-claude-phase4-stale-updates-328.md · Changed · Decided | `docs/sessions/20260802T021752Z-uandiqueue-claude-phase4-stale-updates-328.md` |
| 924 | Community 924 | 7 | 6 | 0 | 0 | Per-unit landing budget exhausted again, 17 lines over · 20260802T024500Z-agent-j-claude-run4-advance-unit-base-post362.md · Change · Gates | `docs/sessions/20260802T024500Z-agent-j-claude-run4-advance-unit-base-post362.md` |
| 925 | Community 925 | 7 | 7 | 0 | 0 | brainPipelineCopy.test.ts · assertCopyGate() · literalCopy() · COPY_FILES | `apps/nao/tests/brainPipelineCopy.test.ts` |
| 926 | Community 926 | 7 | 6 | 0 | 0 | local_schema_fixture.mjs · constraints · keys · migration | `supabase/tests/wellbeing-foundation/local_schema_fixture.mjs` |
| 184 | Community 228 | 6 | 5 | 4 | 0 | Windows Toolchain Gotchas · Accidental NUL Byte Hazard · Generated Plugin Churn · Local Deno Absence and Shell Syntax Constraints | `.claude/skills/windows-toolchain-gotchas/SKILL.md` |
| 303 | Community 303 | 6 | 5 | 0 | 0 | Tracked human semantic-graph view · Graph projection parity · Semantic graph-view implementation session · Graph-view tooling structure | `docs/temp/documentation-freshness-audit-2026-07-26.md`<br/>`docs/graph/README.md`<br/>`docs/sessions/20260726T163505Z-agentjwork-codex-zebra-model-training-doc-split.md` |
| 306 | Community 186 | 6 | 5 | 0 | 0 | Corpus as Durable Truth · Open-access Retrieval Pattern · paper_uid Identity Scheme · Resumable Ingest CLI | `docs/nao/brain-ingestion-design.md` |
| 307 | Community 307 | 6 | 5 | 0 | 0 | The Phase-2 reverse-cascade merge (2026-07-18) — the incident behind … · How the chain came to exist · Lessons encoded in the skill · phase2-reverse-cascade.md | `.claude/skills/stacked-pr-chain/references/phase2-reverse-cascade.md` |
| 308 | Community 308 | 6 | 5 | 0 | 0 | graphify reference: query, path, explain · For /graphify explain · For /graphify path · query.md | `.claude/skills/graphify/references/query.md` |
| 309 | Community 309 | 6 | 5 | 0 | 0 | archive_report_thumbnail_base · archive_report_thumbnail_base.md · Fits Well · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/archive_report_thumbnail_base.md` |
| 310 | Community 310 | 6 | 5 | 0 | 0 | deco_vine_corner_left Review · Background Mode · deco_vine_corner_left.md · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/deco_vine_corner_left.md` |
| 311 | Community 311 | 6 | 5 | 0 | 0 | empty_insights_seedpod Review · Background Mode · empty_insights_seedpod.md · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/empty_insights_seedpod.md` |
| 312 | Community 312 | 6 | 5 | 0 | 0 | empty_scan_bloom Review · Background Mode · empty_scan_bloom.md · Flutter Usage | `assets/ui-generation/biomech-botanical/reviews/empty_scan_bloom.md` |
| 313 | Community 313 | 6 | 5 | 0 | 0 | home_flower_cluster_card · Fits Well · Flutter Usage · home_flower_cluster_card.md | `assets/ui-generation/biomech-botanical/reviews/home_flower_cluster_card.md` |
| 314 | Community 314 | 6 | 5 | 0 | 0 | home_hero_robot_hand_alt_01 · Fits Well · Flutter Usage · home_hero_robot_hand_alt_01.md | `assets/ui-generation/biomech-botanical/reviews/home_hero_robot_hand_alt_01.md` |
| 315 | Community 315 | 6 | 5 | 0 | 0 | home_hero_robot_hand_main · Fits Well · Flutter Usage · home_hero_robot_hand_main.md | `assets/ui-generation/biomech-botanical/reviews/home_hero_robot_hand_main.md` |
| 316 | Community 316 | 6 | 5 | 0 | 0 | insights_biomech_heart_bloom · Fits Well · Flutter Usage · insights_biomech_heart_bloom.md | `assets/ui-generation/biomech-botanical/reviews/insights_biomech_heart_bloom.md` |
| 317 | Community 317 | 6 | 5 | 0 | 0 | insights_branching_node_system · Fits Well · Flutter Usage · insights_branching_node_system.md | `assets/ui-generation/biomech-botanical/reviews/insights_branching_node_system.md` |
| 318 | Community 318 | 6 | 5 | 0 | 0 | profile_botanical_crest Review · Background Mode · Flutter Usage · profile_botanical_crest.md | `assets/ui-generation/biomech-botanical/reviews/profile_botanical_crest.md` |
| 319 | Community 319 | 6 | 5 | 0 | 0 | profile_porcelain_camellia Review · Background Mode · Flutter Usage · profile_porcelain_camellia.md | `assets/ui-generation/biomech-botanical/reviews/profile_porcelain_camellia.md` |
| 320 | Community 320 | 6 | 5 | 0 | 0 | scan_biomech_orchid · Fits Well · Flutter Usage · scan_biomech_orchid.md | `assets/ui-generation/biomech-botanical/reviews/scan_biomech_orchid.md` |
| 322 | Community 400 | 6 | 5 | 0 | 3 | Run 2 U0 bootstrap session · Run 2 U1 router OpenAI session · Run 2 U2 verifier grounding session · Run 2 U3 contract hardening session | `docs/sessions/20260720T054702Z-agentjwork-claude-phase2-unit-signoff-review.md`<br/>`docs/sessions/20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md`<br/>`docs/sessions/20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md` |
| 323 | Community 323 | 6 | 5 | 0 | 0 | Session: Run 2.0 · U1 router OpenAI-only posture (TEST-MODE decorrela… · 20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md · Decisions taken inside the unit's mandate · Gate | `docs/sessions/20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md` |
| 324 | Community 402 | 6 | 5 | 0 | 0 | simulated health generator · planLoadRange · Run-2 U6 Nao Data Loader · loader API route | `docs/sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md` |
| 325 | Community 403 | 6 | 6 | 0 | 0 | ModelsPanel · llm router cap overrides · llm_router_spend projection · llm_router_status projection | `docs/sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md` |
| 326 | Community 404 | 6 | 5 | 0 | 0 | Project Context · One Health personal ecological health monitor · shared contract · graceful degradation | `docs/shared/project-context.md` |
| 329 | Community 329 | 6 | 8 | 0 | 0 | setup_agent_worktree.mjs · main() · parseArgs() · runCmd() | `tools/setup_agent_worktree.mjs` |
| 374 | Community 374 | 6 | 5 | 0 | 0 | lock · deno.json · imports · @supabase/functions-js | `supabase/functions/compute-baselines/deno.json` |
| 376 | Community 376 | 6 | 5 | 0 | 0 | lock · deno.json · imports · @supabase/functions-js | `supabase/functions/evaluate-signals/deno.json` |
| 377 | Community 377 | 6 | 5 | 0 | 0 | lock · deno.json · imports · @supabase/functions-js | `supabase/functions/generate-insights/deno.json` |
| 383 | Community 383 | 6 | 5 | 0 | 0 | lock · deno.json · imports · @supabase/functions-js | `supabase/functions/run-pipeline/deno.json` |
| 927 | Community 927 | 6 | 5 | 5 | 0 | @visibleForTesting · authorizeWithTimeout · buildFieldPatch · buildFullRowPayload | `apps/biotope/lib/modules/m2_self_report/impl/logging_controller.dart`<br/>`apps/biotope/lib/core/app_preferences.dart`<br/>`apps/biotope/lib/modules/m3_passive_health/impl/wearable_service.dart` |
| 928 | Community 928 | 6 | 5 | 0 | 0 | Biotope AI Image Assets · Continuation Workflow · Flutter Usage · README.md | `assets/ui-generation/biomech-botanical/README.md` |
| 929 | Community 929 | 6 | 5 | 0 | 0 | docs/graph — code-relationship awareness · How to add a real generated graph later (TODO) · README.md · Semantic context graph — graphify | `docs/graph/README.md` |
| 930 | Community 930 | 6 | 5 | 9 | 0 | Map · normaliser.dart · clamp · computeDqs | `apps/biotope/lib/modules/m2_self_report/impl/normaliser.dart` |
| 931 | Community 931 | 6 | 5 | 0 | 0 | Documentation freshness audit — 2026-08-01 · Brain and insight architecture · documentation-freshness-audit-2026-08-01.md · Plans, indexes, and Run 4 temp records | `docs/development/run4/documentation-freshness-audit-2026-08-01.md` |
| 932 | Community 932 | 6 | 5 | 0 | 0 | Run 4 deferral record — #222, #283, #275 · #222 — R4-U6c MEDIUM metric collector families · #275 — nao operator UI to trigger bounded brain synthesis + verificat… · #283 — Host biotope as a Flutter web app at biotope.ourobion.com | `docs/development/run4/run4-deferrals.md` |
| 933 | Community 933 | 6 | 5 | 0 | 0 | Land the portable Zebra bundle on dev-phase2-run4 · 20260727T142533Z-agentjwork-claude-zebra-bundle-onto-run4.md · Blockers · Left | `docs/sessions/20260727T142533Z-agentjwork-claude-zebra-bundle-onto-run4.md` |
| 934 | Community 934 | 6 | 5 | 1 | 0 | Continuation — rollback fixture privilege remediation · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 935 | Community 935 | 6 | 5 | 1 | 0 | Continuation — per-unit landing base advance · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 936 | Community 936 | 6 | 5 | 1 | 0 | Continuation — metric fixture dependency remediation · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 937 | Community 937 | 6 | 5 | 1 | 0 | Continuation — metric-view package ownership correction · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 938 | Community 938 | 6 | 5 | 1 | 0 | Continuation — metric-view runtime contract alignment · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 939 | Community 939 | 6 | 5 | 1 | 0 | Continuation — final hosted evidence and generated attestation · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 940 | Community 940 | 6 | 5 | 1 | 0 | Continuation — remote evidence fallback · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 941 | Community 941 | 6 | 5 | 1 | 0 | Continuation — hosted evidence remediation · Attempted · Blockers · Changed | `docs/sessions/20260731T073421Z-agentjwork-codex-issue221-reconciliation.md` |
| 942 | Community 942 | 6 | 5 | 0 | 0 | Repo instructions pointed contributors at a dead branch · 20260801T092733Z-agent-j-claude-run4-branch-refs-dev-phase2-run4.md · Gates · Known-remaining, not fixed here | `docs/sessions/20260801T092733Z-agent-j-claude-run4-branch-refs-dev-phase2-run4.md` |
| 943 | Community 943 | 6 | 5 | 0 | 0 | Judge-facing write-up · 20260802T032720Z-uandiqueue-claude-writeup-judge-facing.md · Changed · Constraints the event imposes | `docs/sessions/20260802T032720Z-uandiqueue-claude-writeup-judge-facing.md` |
| 944 | Community 944 | 6 | 5 | 0 | 0 | Refreshing hackathon-direction.md · 20260802T033528Z-uandiqueue-claude-hackathon-direction-refresh.md · Decided — three fabrications in the subagent's output, caught before … · Other staleness fixed | `docs/sessions/20260802T033528Z-uandiqueue-claude-hackathon-direction-refresh.md` |
| 945 | Community 945 | 6 | 5 | 0 | 0 | loginUx.test.ts · explainer · globals · HERE | `apps/nao/tests/loginUx.test.ts` |
| 946 | Community 946 | 6 | 7 | 0 | 0 | _child_env() · test_inference_imports.py · TestImportPurity · .test_cli_import_does_not_pull_inference_or_torch() | `model-training/tests/test_inference_imports.py` |
| 330 | Community 409 | 5 | 4 | 0 | 0 | Ourobion Pull Request Checklist · Code Boundary and Copy Gate · dev-phase2 Target Gate · Session Context Gate | `.github/PULL_REQUEST_TEMPLATE.md` |
| 331 | Community 331 | 5 | 4 | 0 | 0 | layout.tsx · jetbrainsMono · metadata · outfit | `apps/nao/src/app/layout.tsx` |
| 332 | Community 332 | 5 | 4 | 0 | 0 | SceneDelegate.swift · SceneDelegate · Flutter · FlutterSceneDelegate | `apps/biotope/ios/Runner/SceneDelegate.swift` |
| 333 | Community 333 | 5 | 4 | 2 | 0 | C1. Auto-fetchable `E` (E-1 … E-100) · Part C — The passive layer (zero logging budget) · External APIs keyed to location + time (E-58 … E-100) — all collectib… · Phone sensors & OS signals (E-1 … E-30) | `docs/implemented/biotope/metrics-catalog.md` |
| 334 | Community 413 | 5 | 4 | 0 | 0 | Singapore-Malaysia Localization · Local Diet Capture Kit · Hydration Proxy · Metrics Catalog | `docs/biotope/metrics-catalog.md` |
| 335 | Community 335 | 5 | 7 | 0 | 0 | setup.sh · setup.sh script · hint_docker() · hint_flutter() | `scripts/setup.sh` |
| 336 | Community 336 | 5 | 4 | 0 | 0 | hooks · settings.json · $schema · PreToolUse | `.claude/settings.json` |
| 337 | Community 169 | 5 | 4 | 0 | 0 | Insight-Engine Architecture · biotope Architecture Context · Brain Ingestion Design · Brain Synthesis and Verification Design | `docs/INDEX.md` |
| 340 | Community 340 | 5 | 4 | 0 | 0 | Rejected Assets · Needs Regeneration, Not Rejected · empty_scan_bloom - attempt 1 · home_flower_cluster_card - attempt 1 | `assets/ui-generation/biomech-botanical/lessons/rejected-assets.md` |
| 342 | Community 342 | 5 | 4 | 0 | 0 | eslint.config.mjs · __dirname · __filename · compat | `apps/nao/eslint.config.mjs` |
| 344 | Community 344 | 5 | 4 | 0 | 1 | empty_scan_bloom · empty_scan_bloom.md · scan_circular_bloom.md · Attempt 2 Refinement | `assets/ui-generation/biomech-botanical/prompts/empty_scan_bloom.md`<br/>`assets/ui-generation/biomech-botanical/prompts/scan_circular_bloom.md` |
| 345 | Community 427 | 5 | 4 | 1 | 0 | Audit Finding Hotspots · App-Facing Contract Drift · Foreign Artifact Schema Seam · Projection Lifecycle Ownership | `.claude/skills/record-only-audit/references/finding-hotspots.md` |
| 346 | Community 346 | 5 | 4 | 0 | 0 | The Phase-2 run — the proven instance behind this skill · Named incidents (with their D/B ids) · phase2-run-example.md · Primary records | `.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 347 | User Consent and Metrics Models | 5 | 5 | 0 | 0 | B-PL17 Semantic Graph Freshness · B-PL18 Semantic Graph Broad-Query Ranking · Freshness versus retrieval-quality ownership boundary · Local session-end semantic freshness checker | `docs/temp/run3/pending-build-register.md` |
| 348 | Community 433 | 5 | 4 | 0 | 1 | Phase 2 Integrated Plan Session · Metric 100 Decision Consolidation Session · Brain Pipeline Decision Session · Phase 2 Goals and Features Session | `docs/sessions/20260611T070148Z-uandiqueue-claude-phase2-goals-feature-list.md`<br/>`docs/sessions/20260611T084236Z-uandiqueue-claude-phase2-integrated-plan.md`<br/>`docs/sessions/20260701T052316Z-agentjwork-claude-brain-pipeline-decision.md` |
| 349 | Community 434 | 5 | 4 | 0 | 0 | A8 Synthesis Session · S6 Edge Store and A11 Loader Session · A10 Verifier Scaffold Session · Agentic Seeder Session | `docs/sessions/20260716T031048Z-agentjwork-claude-s6-edge-store-a11-loader.md`<br/>`docs/sessions/20260716T035351Z-agentjwork-claude-agentic-seeder.md`<br/>`docs/sessions/20260716T042500Z-agentjwork-claude-a8-synthesis.md` |
| 350 | verified edges | 5 | 4 | 0 | 0 | verified_edges · L6 One-Card End-to-End Slice · Biotope–nao Runtime Boundary · quoteCheck | `docs/shared/biotope-nao-link.md`<br/>`docs/shared/insight-slice-demo-runbook.md` |
| 354 | Community 354 | 5 | 4 | 0 | 0 | index.dart · impl/insight_service.dart · impl/knowledge_base_service.dart · impl/provenance_models.dart | `apps/biotope/lib/modules/m5b_insight_engine/index.dart` |
| 947 | Community 947 | 5 | 4 | 0 | 0 | Next Steps & Roadmap · Backlog · Immediate (do next) · Near-term by area | `docs/development/next-steps.md` |
| 948 | Community 948 | 5 | 4 | 0 | 0 | Temp — in-building and promotable docs · Active folders · Closed-run rule · Lifecycle | `docs/development/temp-lifecycle.md` |
| 949 | Community 949 | 5 | 4 | 0 | 0 | user_identity.dart · email · id · lastSignInAt | `apps/biotope/lib/modules/m1_core/models/user_identity.dart` |
| 950 | Community 950 | 5 | 4 | 0 | 0 | biotope's lockfile did not describe its declared dependency set · 20260802T021500Z-agent-j-claude-biotope-pubspec-lock-metrics-dep.md · Gates · What was wrong | `docs/sessions/20260802T021500Z-agent-j-claude-biotope-pubspec-lock-metrics-dep.md` |
| 951 | Community 951 | 5 | 4 | 0 | 0 | References · Prior approaches named in the write-up · references.md · Reliability framing | `docs/hackathon/the_launchpad_challenge/submission/references.md` |
| 952 | Community 952 | 5 | 6 | 0 | 0 | productionBuildContract.test.ts · read() · dotenvKeys() · parseLineCommentJson() | `apps/nao/tests/productionBuildContract.test.ts` |
| 351 | Community 351 | 4 | 3 | 1 | 0 | edge_score_components.test.ts · mk() · referenceScore() · TABLE | `tools/edge-loader/tests/edge_score_components.test.ts` |
| 352 | Community 352 | 4 | 3 | 1 | 0 | Part F — Logging reliability & accuracy · F1. Reliability ladder (most → least trustworthy) · F2. Quick reference · F3. Implications for the model | `docs/implemented/biotope/metrics-catalog.md` |
| 353 | Community 301 | 4 | 4 | 0 | 0 | Shared Contract Two-Reviewer Gate · Executable Semantic Data Couplings · Non-Diagnostic Copy Rule · HRV SDNN iOS-Only Signal | `docs/graph/couplings.yaml`<br/>`docs/memory/0002-shared-contract-two-reviewers.md`<br/>`docs/memory/0003-non-diagnostic-copy.md` |
| 355 | Community 218 | 4 | 3 | 0 | 1 | Bug Report Form · Feature Request Form · Module and Environment Triage · Phase Scope and Acceptance Gate | `.github/ISSUE_TEMPLATE/bug_report.yml`<br/>`.github/ISSUE_TEMPLATE/feature_request.yml` |
| 356 | Community 356 | 4 | 3 | 0 | 1 | 0005-pgcron-config-prereqs.md · 0009-local-test-data-seeding.md · Scheduled internal calls separate routing credentials from authorizat… · Simulated backdated data tests time-based behaviour | `docs/memory/0005-pgcron-config-prereqs.md`<br/>`docs/memory/0009-local-test-data-seeding.md` |
| 357 | Community 444 | 4 | 3 | 0 | 0 | 0006-wearable-sync-best-effort.md · iOS Build and HealthKit Constraints · Local Supabase Auth Constraints · Wearable sync is best-effort | `docs/memory/0006-wearable-sync-best-effort.md`<br/>`docs/memory/0010-ios-build-needs-mac-and-paid-account.md`<br/>`docs/memory/0011-local-supabase-auth-email-only.md` |
| 358 | Community 378 | 4 | 3 | 0 | 0 | Adversarial Edge Verification · Brain Pipeline and Support Models · 100-metric Collector-gated Expansion · L6 One-card Slice with Interim Verifier | `docs/memory/0012-brain-adversarial-edge-verification.md`<br/>`docs/memory/0013-brain-pipeline-and-support-models-decision.md`<br/>`docs/memory/0014-metric-catalog-100-expansion-decision.md` |
| 359 | Community 359 | 4 | 3 | 0 | 1 | home_hero_robot_hand_alt_01.md · home_hero_robot_hand_main.md · home_hero_robot_hand_alt_01 · home_hero_robot_hand_main | `assets/ui-generation/biomech-botanical/prompts/home_hero_robot_hand_alt_01.md`<br/>`assets/ui-generation/biomech-botanical/prompts/home_hero_robot_hand_main.md` |
| 360 | Community 360 | 4 | 3 | 0 | 1 | insights_branching_node_system.md · insights_neural_botanical_cluster.md · insights_branching_node_system · insights_neural_botanical_cluster | `assets/ui-generation/biomech-botanical/prompts/insights_branching_node_system.md`<br/>`assets/ui-generation/biomech-botanical/prompts/insights_neural_botanical_cluster.md` |
| 361 | Community 361 | 4 | 3 | 0 | 0 | graphify reference: add a URL and watch a folder · add-watch.md · For --watch · For /graphify add | `.claude/skills/graphify/references/add-watch.md` |
| 362 | Community 362 | 4 | 3 | 0 | 0 | Dispatch-brief anatomy — the proven build-agent brief skeleton · dispatch-brief-template.md · Filled example (condensed from the run's U24 dispatch) · Skeleton | `.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md` |
| 363 | Community 363 | 4 | 3 | 0 | 0 | graphify reference: commit hook and native CLAUDE.md integration · For git commit hook · For native CLAUDE.md integration · hooks.md | `.claude/skills/graphify/references/hooks.md` |
| 364 | Community 364 | 4 | 3 | 0 | 0 | graphify reference: incremental update and cluster-only · For --cluster-only · For --update (incremental re-extraction) · update.md | `.claude/skills/graphify/references/update.md` |
| 365 | Supabase Package | 4 | 3 | 0 | 0 | Run 3 Pending-Build Register · 100-Metric Expansion · Next-Build Optimizations · Superset Gap Map | `docs/temp/run3/pending-build-register.md` |
| 367 | Community 458 | 4 | 3 | 0 | 1 | Graphify Adoption Session · Graphify Codex and Gemini Prewire Session · Graphify Dart Probe Session · Graphify Hook and Docs Cleanup Session | `docs/sessions/20260610T093356Z-uandiqueue-claude-graphify-dart-probe.md`<br/>`docs/sessions/20260617T041218Z-uandiqueue-claude-graphify-adoption.md`<br/>`docs/sessions/20260617T062023Z-uandiqueue-claude-graphify-hook-and-docs-cleanup.md` |
| 368 | Community 459 | 4 | 3 | 0 | 1 | Metric Daily Values and Baseline V2 · Signal and Pairwise Evaluator · Continuity Storage Primitives · Rules as Data | `docs/sessions/20260715T140420Z-agentjwork-claude-storage-primitives.md`<br/>`docs/sessions/20260715T152517Z-agentjwork-claude-rules-as-data.md`<br/>`docs/sessions/20260715T153917Z-agentjwork-claude-s2-view-s3-baseline-v2.md` |
| 369 | Community 460 | 4 | 4 | 0 | 0 | Run 2 U9 claims human-verdict session · Run 2 U10 seeds-as-data session · Run 2 U11 gap-surfacing session · Run 2 U12 demo dry-run session | `docs/sessions/20260724T150900Z-agentjwork-claude-run2-u9-claims-human-verdict.md`<br/>`docs/sessions/20260724T152525Z-agentjwork-claude-run2-u10-seeds-as-data.md`<br/>`docs/sessions/20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md` |
| 406 | Community 406 | 4 | 3 | 0 | 0 | Verified rules auto-project; humans retain revocation authority · 0007-rules-as-data-two-tier.md · Constraints locked · The two-tier mechanism | `docs/memory/0007-rules-as-data-two-tier.md` |
| 953 | Community 953 | 4 | 3 | 0 | 0 | Frozen inference-input manifests · Model-native labels · README.md · Why these files are individually un-ignored | `model-training/inference-manifests/README.md` |
| 954 | Community 954 | 4 | 3 | 0 | 0 | Q: Locate the implementation surfaces for Run 3 U0 O24 exact-tip rele… · Answer · query_20260726_201228_locate_the_implementation_surfaces_for_run_3_u0… · Source Nodes | `graphify-out/memory/query_20260726_201228_locate_the_implementation_surfaces_for_run_3_u0_o2.md` |
| 955 | Community 955 | 4 | 3 | 0 | 0 | Q: How complete is the system right now, and what user test can be ru… · Answer · query_20260727_054832_how_complete_is_the_system_right_now__and_what_… · Source Nodes | `graphify-out/memory/query_20260727_054832_how_complete_is_the_system_right_now__and_what_use.md` |
| 956 | Community 956 | 4 | 3 | 0 | 0 | Q: Why cant we use the demo db directly on cloud supabase? · Answer · query_20260727_062005_why_cant_we_use_the_demo_db_directly_on_cloud_s… · Source Nodes | `graphify-out/memory/query_20260727_062005_why_cant_we_use_the_demo_db_directly_on_cloud_supa.md` |
| 957 | Community 957 | 4 | 3 | 0 | 0 | Q: The supabase credential in env rn is all for the demo db, you can … · Answer · query_20260727_063200_the_supabase_credential_in_env_rn_is_all_for_th… · Source Nodes | `graphify-out/memory/query_20260727_063200_the_supabase_credential_in_env_rn_is_all_for_the_d.md` |
| 958 | Community 958 | 4 | 3 | 0 | 0 | Q: The two auth user is for nao app if im not wrong, can verify. you … · Answer · query_20260727_064816_the_two_auth_user_is_for_nao_app_if_im_not_wron… · Source Nodes | `graphify-out/memory/query_20260727_064816_the_two_auth_user_is_for_nao_app_if_im_not_wrong.md` |
| 959 | Community 959 | 4 | 3 | 0 | 0 | Q: nao is live though? You cant find auth flow? · Answer · query_20260727_065155_nao_is_live_though__you_cant_find_auth_flow.md · Source Nodes | `graphify-out/memory/query_20260727_065155_nao_is_live_though__you_cant_find_auth_flow.md` |
| 960 | Community 960 | 4 | 3 | 0 | 0 | Q: Ok, give me instruction flow to migrate db · Answer · query_20260727_065731_ok__give_me_instruction_flow_to_migrate_db.md · Source Nodes | `graphify-out/memory/query_20260727_065731_ok__give_me_instruction_flow_to_migrate_db.md` |
| 961 | Community 961 | 4 | 3 | 0 | 0 | Q: ok maybe i fix this later, why not we test locally first? How to t… · Answer · query_20260727_072613_ok_maybe_i_fix_this_later__why_not_we_test_loca… · Source Nodes | `graphify-out/memory/query_20260727_072613_ok_maybe_i_fix_this_later__why_not_we_test_locally.md` |
| 962 | Community 962 | 4 | 3 | 0 | 0 | Q: do i need to change .env for this? Since currently all points to d… · Answer · query_20260727_072827_do_i_need_to_change__env_for_this__since_curren… · Source Nodes | `graphify-out/memory/query_20260727_072827_do_i_need_to_change__env_for_this__since_currently.md` |
| 963 | Community 963 | 4 | 3 | 0 | 0 | Q: Ok I updated the .env.public, guide me through the local test setu… · Answer · query_20260727_073406_ok_i_updated_the__env_public__guide_me_through_… · Source Nodes | `graphify-out/memory/query_20260727_073406_ok_i_updated_the__env_public__guide_me_through_the.md` |
| 964 | Community 964 | 4 | 3 | 0 | 0 | Q: For terminal 3, I am connected to an actual android, so dont need … · Answer · query_20260727_080018_for_terminal_3__i_am_connected_to_an_actual_and… · Source Nodes | `graphify-out/memory/query_20260727_080018_for_terminal_3__i_am_connected_to_an_actual_androi.md` |
| 965 | Community 965 | 4 | 3 | 0 | 0 | Q: ok build is done, I am in the app, but seems exactly the same as o… · Answer · query_20260727_082532_ok_build_is_done__i_am_in_the_app__but_seems_ex… · Source Nodes | `graphify-out/memory/query_20260727_082532_ok_build_is_done__i_am_in_the_app__but_seems_exact.md` |
| 966 | Community 966 | 4 | 3 | 0 | 0 | Q: Not working the sign in page, check status · Answer · query_20260727_083559_not_working_the_sign_in_page__check_status.md · Source Nodes | `graphify-out/memory/query_20260727_083559_not_working_the_sign_in_page__check_status.md` |
| 967 | Community 967 | 4 | 3 | 0 | 0 | Q: Sign-in status follow-up after done · Answer · query_20260727_084423_sign_in_status_follow_up_after_done.md · Source Nodes | `graphify-out/memory/query_20260727_084423_sign_in_status_follow_up_after_done.md` |
| 968 | Community 968 | 4 | 3 | 0 | 0 | Q: now debug nao webpage. Also I realise the current nao and biotope … · Answer · query_20260727_090441_now_debug_nao_webpage__also_i_realise_the_curre… · Source Nodes | `graphify-out/memory/query_20260727_090441_now_debug_nao_webpage__also_i_realise_the_current.md` |
| 969 | Community 969 | 4 | 3 | 0 | 0 | Q: I basically have this issue, I need to test a full test run from i… · Answer · query_20260727_091649_i_basically_have_this_issue__i_need_to_test_a_f… · Source Nodes | `graphify-out/memory/query_20260727_091649_i_basically_have_this_issue__i_need_to_test_a_full.md` |
| 970 | Community 970 | 4 | 3 | 0 | 0 | Q: What files and systems are affected by Run 4 units R4-U0 through R… · Answer · query_20260727_094812_what_files_and_systems_are_affected_by_run_4_un… · Source Nodes | `graphify-out/memory/query_20260727_094812_what_files_and_systems_are_affected_by_run_4_units.md` |
| 971 | Community 971 | 4 | 3 | 0 | 0 | Q: Trace the complete local Run 4 path from a paper through ingestion… · Answer · query_20260727_122820_trace_the_complete_local_run_4_path_from_a_pape… · Source Nodes | `graphify-out/memory/query_20260727_122820_trace_the_complete_local_run_4_path_from_a_paper_t.md` |
| 972 | Community 972 | 4 | 3 | 0 | 0 | Q: can you check github, are there any branch with the newest fully u… · Answer · query_20260728_164659_can_you_check_github__are_there_any_branch_with… · Source Nodes | `graphify-out/memory/query_20260728_164659_can_you_check_github__are_there_any_branch_with_th.md` |
| 973 | Community 973 | 4 | 3 | 0 | 0 | Q: Trace issue #228 seed catalog auth RLS UI and workflow dispatch pa… · Answer · query_20260730_041946_trace_issue__228_seed_catalog_auth_rls_ui_and_w… · Source Nodes | `graphify-out/memory/query_20260730_041946_trace_issue__228_seed_catalog_auth_rls_ui_and_work.md` |
| 974 | Community 974 | 4 | 3 | 0 | 0 | Q: Check Archive empty art and trend axes, dry-test cited paper links… · Answer · query_20260730_161718_check_archive_empty_art_and_trend_axes__dry_tes… · Source Nodes | `graphify-out/memory/query_20260730_161718_check_archive_empty_art_and_trend_axes__dry_test_c.md` |
| 975 | Community 975 | 4 | 3 | 0 | 0 | Q: How is Biotope coverage calculated and why did the demo show 82? · Answer · query_20260730_172457_how_is_biotope_coverage_calculated_and_why_did_… · Source Nodes | `graphify-out/memory/query_20260730_172457_how_is_biotope_coverage_calculated_and_why_did_the.md` |
| 976 | Community 976 | 4 | 3 | 0 | 0 | Q: What is the blast radius of the named-scale tick formatting defect… · Answer · query_20260731_195226_what_is_the_blast_radius_of_the_named_scale_tic… · Source Nodes | `graphify-out/memory/query_20260731_195226_what_is_the_blast_radius_of_the_named_scale_tick_f.md` |
| 977 | Community 977 | 4 | 3 | 0 | 0 | Q: Trace how regenerated seed-queries flow into one all-seed ingest p… · Answer · query_20260801_091309_trace_how_regenerated_seed_queries_flow_into_on… · Source Nodes | `graphify-out/memory/query_20260801_091309_trace_how_regenerated_seed_queries_flow_into_one_a.md` |
| 978 | Community 978 | 4 | 3 | 0 | 0 | Q: Which session or artifact records the prior unsupported Agnes veri… · Answer · query_20260802_060717_which_session_or_artifact_records_the_prior_uns… · Source Nodes | `graphify-out/memory/query_20260802_060717_which_session_or_artifact_records_the_prior_unsupp.md` |
| 979 | Community 979 | 4 | 3 | 0 | 0 | Q: What do PRs #383 and #384 achieve, what is their blast radius, and… · Answer · query_20260802_062858_what_do_prs__383_and__384_achieve__what_is_thei… · Source Nodes | `graphify-out/memory/query_20260802_062858_what_do_prs__383_and__384_achieve__what_is_their_b.md` |
| 980 | Community 980 | 4 | 3 | 0 | 0 | Q: How should the audited nao control event flow through the cloud ve… · Answer · query_20260802_064304_how_should_the_audited_nao_control_event_flow_t… · Source Nodes | `graphify-out/memory/query_20260802_064304_how_should_the_audited_nao_control_event_flow_thro.md` |
| 981 | Community 981 | 4 | 3 | 0 | 0 | Run 4 per-unit release-base advance (issue #290) · Consequences · Machine record · per-unit-release-base-290.md | `docs/development/run4/per-unit-release-base-290.md` |
| 982 | Community 982 | 4 | 3 | 0 | 0 | naoD1EtlWorkflow.test.ts · NAO_ROOT · readWorkflow() · WORKFLOW_PATH | `apps/nao/tests/naoD1EtlWorkflow.test.ts` |
| 983 | Community 983 | 4 | 3 | 0 | 0 | run4_u6b_evidence_workflow.test.mjs · metricViewFixture · wellbeingFixture · workflow | `tools/run4_u6b_evidence_workflow.test.mjs` |
| 176 | Community 213 | 3 | 3 | 0 | 1 | AI routing and review protocol · Commit message guidelines · Development workflow | `docs/shared/agent-protocol.md`<br/>`docs/shared/commit-conventions.md`<br/>`docs/shared/dev-workflow.md` |
| 371 | Community 371 | 3 | 2 | 0 | 0 | MainActivity · FlutterFragmentActivity · MainActivity.kt | `apps/biotope/android/app/src/main/kotlin/com/ourobion/app/MainActivity.kt` |
| 372 | Community 372 | 3 | 2 | 0 | 0 | FlutterWindow() · class · flutter_window.h | `apps/biotope/windows/runner/flutter_window.h` |
| 375 | Community 466 | 3 | 2 | 0 | 0 | Cross-Metric Rule Blueprints · Coincidence Condition Contract · Engine Refactor Gate for Cross Rules | `data/rules/cross/README.md` |
| 379 | Community 379 | 3 | 2 | 0 | 0 | Adversarial Edge Verification · Brain Knowledge Graph · Serving-Band Gating | `docs/nao/brain-synthesis-design.md` |
| 380 | Community 475 | 3 | 2 | 0 | 0 | Asset Generation Completion · Manifest-First Asset Planning · Resumable Asset Generation State | `docs/biotope/ui/ai-assets/progress/current-batch.md`<br/>`docs/biotope/ui/ai-assets/progress/next-actions.md`<br/>`docs/biotope/ui/ai-assets/progress/README.md` |
| 381 | Community 381 | 3 | 2 | 0 | 0 | graphify reference: GitHub clone and cross-repo merge · github-and-merge.md · Step 0 - Clone GitHub repo(s) (only if a GitHub URL was given) | `.claude/skills/graphify/references/github-and-merge.md` |
| 382 | Community 382 | 3 | 2 | 0 | 0 | graphify reference: transcribe video and audio · Step 2.5 - Transcribe video / audio files (only if video files detect… · transcribe.md | `.claude/skills/graphify/references/transcribe.md` |
| 385 | Community 485 | 3 | 2 | 0 | 1 | Local Test-Data Seeder · Next-Phase Rules-as-Data Plan · Windows-Native Toolchain | `docs/sessions/20260608T071424Z-uandiqueue-claude-windows-native-toolchain-setup.md`<br/>`docs/sessions/20260609T021240Z-uandiqueue-claude-next-phase-plan.md`<br/>`docs/sessions/20260610T021136Z-uandiqueue-claude-local-test-seeder.md` |
| 386 | Community 486 | 3 | 2 | 0 | 1 | Brain Safeguard Hardening · Projection Loader Hardening · Stacked-Chain Recovery | `docs/sessions/20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md`<br/>`docs/sessions/20260718T035658Z-agentjwork-claude-u19-brain-safeguard-hardening.md`<br/>`docs/sessions/20260718T050856Z-agentjwork-claude-u24-loader-hardening.md` |
| 387 | Community 487 | 3 | 2 | 0 | 1 | Skills Run Procedures Session · Skills Generality Refactor Session · U26 Budget Ledger Lifecycle Session | `docs/sessions/20260718T053625Z-agentjwork-claude-u26-budget-ledger-lifecycle.md`<br/>`docs/sessions/20260718T163741Z-agentjwork-claude-skills-run-procedures.md`<br/>`docs/sessions/20260719T102011Z-agentjwork-claude-skills-generality-refactor.md` |
| 388 | Community 488 | 3 | 2 | 0 | 0 | MetricSeriesService · Run-2 U7 Biotope Trend and Provenance · TrendChartPainter | `docs/sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md` |
| 389 | Phase 2 Demo Runbook | 3 | 2 | 0 | 0 | Phase 2 Demo Runbook · Decorrelated Full Run · Next Steps and Roadmap | `docs/shared/phase2-demo-runbook.md`<br/>`docs/shared/next-steps.md` |
| 399 | Community 399 | 3 | 2 | 0 | 0 | index.dart · impl/wearable_service.dart · ui/widgets/wearable_sync_row.dart | `apps/biotope/lib/modules/m3_passive_health/index.dart` |
| 984 | Community 984 | 3 | 2 | 0 | 0 | CLAUDE.md · CLAUDE.md · graphify | `CLAUDE.md` |
| 985 | Community 985 | 3 | 2 | 0 | 0 | GEMINI.md · GEMINI.md · graphify | `GEMINI.md` |
| 986 | Community 986 | 3 | 2 | 0 | 0 | Q: How does local Nao connect to Supabase and which data stores are c… · Answer · query_20260730_172346_how_does_local_nao_connect_to_supabase_and_whic… | `graphify-out/memory/query_20260730_172346_how_does_local_nao_connect_to_supabase_and_which_d.md` |
| 987 | Community 987 | 3 | 2 | 0 | 0 | docs/memory — durable, cross-device memory · Index · README.md | `docs/memory/README.md` |
| 988 | Community 157 | 3 | 2 | 4 | 0 | Phase-2 Multi-Unit Build Run · Phase-2 Record-Only Audit · L6 Hold-Band Interim Card | `.claude/skills/orchestrate-build-run/references/phase2-run-example.md` |
| 989 | Community 989 | 3 | 2 | 0 | 0 | Run 4 — Config Decisions · config-decisions.md · Decisions | `docs/development/run4/config-decisions.md` |
| 990 | Community 990 | 3 | 2 | 0 | 0 | Run 4 Unit Signoff Index · Gate and cap note · unit-signoff-index.md | `docs/development/run4/unit-signoff-index.md` |
| 373 | Community 373 | 2 | 1 | 0 | 0 | graphify-build.sh · graphify-build.sh script | `scripts/graphify-build.sh` |
| 390 | Community 378 | 2 | 1 | 0 | 1 | Claude Agent Guidance · Gemini Agent Guidance | `CLAUDE.md`<br/>`GEMINI.md` |
| 391 | Community 391 | 2 | 1 | 0 | 0 | EyebrowLabel.tsx · EyebrowLabel() | `apps/nao/src/components/EyebrowLabel.tsx` |
| 392 | Community 392 | 2 | 1 | 0 | 0 | data/rules/cross — cross-metric rule blueprints · README.md | `data/rules/cross/README.md` |
| 393 | Community 495 | 2 | 1 | 0 | 0 | Insight-engine ADR index · Paper-reliability scoring decision | `docs/shared/decisions/0003-paper-reliability.md`<br/>`docs/shared/decisions/README.md` |
| 394 | Community 394 | 2 | 1 | 0 | 0 | Insight-engine architecture decisions (ADRs) · README.md | `docs/development/decisions/README.md` |
| 395 | Community 497 | 2 | 1 | 0 | 1 | Phase 2 Plan · Project Context | `docs/INDEX.md` |
| 396 | Community 396 | 2 | 1 | 0 | 0 | FIXTURE edge artifacts — hand-authored, NEVER synthesized · README.md | `tools/edge-loader/tests/fixtures/edges/README.md` |
| 397 | Community 501 | 2 | 1 | 0 | 1 | Europe PMC full-text-not-found fixture · Minimal arXiv PDF fixture | `tools/brain-ingest/tests/fixtures/arxiv-2401.12345.pdf`<br/>`tools/brain-ingest/tests/fixtures/europepmc-fulltext-notfound.html` |
| 398 | Community 398 | 2 | 1 | 0 | 0 | impl/engagement_service.dart · index.dart | `apps/biotope/lib/modules/m6_engagement/index.dart` |
| 400 | Community 400 | 2 | 1 | 0 | 0 | Launch Screen Assets · README.md | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` |
| 401 | Community 401 | 2 | 1 | 0 | 0 | Style Drift Notes · style-drift-notes.md | `assets/ui-generation/biomech-botanical/lessons/style-drift-notes.md` |
| 402 | Community 402 | 2 | 1 | 0 | 0 | 0001-two-tier-truth.md · Two-tier truth, including mixed records | `docs/memory/0001-two-tier-truth.md` |
| 403 | Community 403 | 2 | 1 | 0 | 0 | 0002-shared-contract-two-reviewers.md · Shared contract changes normally need two reviewers | `docs/memory/0002-shared-contract-two-reviewers.md` |
| 404 | Community 404 | 2 | 1 | 0 | 0 | 0003-non-diagnostic-copy.md · Non-diagnostic language is mandatory for all user-facing copy | `docs/memory/0003-non-diagnostic-copy.md` |
| 405 | Community 405 | 2 | 1 | 0 | 0 | 0004-hrv-sdnn-ios-only.md · HRV SDNN is iOS-only | `docs/memory/0004-hrv-sdnn-ios-only.md` |
| 407 | Community 407 | 2 | 1 | 0 | 0 | 0010-ios-build-needs-mac-and-paid-account.md · iOS and HealthKit require Apple hardware and provisioning | `docs/memory/0010-ios-build-needs-mac-and-paid-account.md` |
| 408 | Community 408 | 2 | 1 | 0 | 0 | 0011-local-supabase-auth-email-only.md · Local Supabase defaults to email/password auth | `docs/memory/0011-local-supabase-auth-email-only.md` |
| 409 | Community 409 | 2 | 1 | 0 | 0 | 0012-brain-adversarial-edge-verification.md · Brain synthesis and verification use different provider families | `docs/memory/0012-brain-adversarial-edge-verification.md` |
| 410 | Community 410 | 2 | 1 | 0 | 0 | 0013-brain-pipeline-and-support-models-decision.md · Brain build, persistence, rule promotion, and serving boundaries | `docs/memory/0013-brain-pipeline-and-support-models-decision.md` |
| 412 | Community 412 | 2 | 1 | 0 | 0 | 0015-docs-taxonomy-and-enforcement.md · Documentation roles and lifecycle | `docs/memory/0015-docs-taxonomy-and-enforcement.md` |
| 414 | Community 414 | 2 | 1 | 0 | 0 | CloudflareEnv · env.d.ts | `apps/nao/env.d.ts` |
| 415 | Community 415 | 2 | 1 | 0 | 0 | next.config.mjs · nextConfig | `apps/nao/next.config.mjs` |
| 416 | Community 416 | 2 | 1 | 0 | 0 | Current Batch · current-batch.md | `assets/ui-generation/biomech-botanical/progress/current-batch.md` |
| 417 | Community 417 | 2 | 1 | 0 | 0 | Next Actions · next-actions.md | `assets/ui-generation/biomech-botanical/progress/next-actions.md` |
| 418 | Community 418 | 2 | 1 | 0 | 0 | AI Asset Generation Progress · README.md | `assets/ui-generation/biomech-botanical/progress/README.md` |
| 419 | Community 419 | 2 | 1 | 0 | 0 | archive_herbarium_specimen · archive_herbarium_specimen.md | `assets/ui-generation/biomech-botanical/prompts/archive_herbarium_specimen.md` |
| 420 | Community 420 | 2 | 1 | 0 | 0 | archive_preserved_flower_fragment · archive_preserved_flower_fragment.md | `assets/ui-generation/biomech-botanical/prompts/archive_preserved_flower_fragment.md` |
| 421 | Community 421 | 2 | 1 | 0 | 0 | deco_flower_cluster_white · deco_flower_cluster_white.md | `assets/ui-generation/biomech-botanical/prompts/deco_flower_cluster_white.md` |
| 422 | Community 422 | 2 | 1 | 0 | 0 | deco_leaf_brass_node · deco_leaf_brass_node.md | `assets/ui-generation/biomech-botanical/prompts/deco_leaf_brass_node.md` |
| 423 | Community 423 | 2 | 1 | 0 | 0 | deco_small_biomech_bloom · deco_small_biomech_bloom.md | `assets/ui-generation/biomech-botanical/prompts/deco_small_biomech_bloom.md` |
| 424 | Community 424 | 2 | 1 | 0 | 0 | deco_vine_corner_left · deco_vine_corner_left.md | `assets/ui-generation/biomech-botanical/prompts/deco_vine_corner_left.md` |
| 425 | Community 425 | 2 | 1 | 0 | 0 | empty_insights_seedpod · empty_insights_seedpod.md | `assets/ui-generation/biomech-botanical/prompts/empty_insights_seedpod.md` |
| 426 | Community 426 | 2 | 1 | 0 | 0 | home_flower_cluster_card · home_flower_cluster_card.md | `assets/ui-generation/biomech-botanical/prompts/home_flower_cluster_card.md` |
| 427 | Community 427 | 2 | 1 | 0 | 0 | insights_biomech_heart_bloom · insights_biomech_heart_bloom.md | `assets/ui-generation/biomech-botanical/prompts/insights_biomech_heart_bloom.md` |
| 428 | Community 428 | 2 | 1 | 0 | 0 | profile_botanical_crest · profile_botanical_crest.md | `assets/ui-generation/biomech-botanical/prompts/profile_botanical_crest.md` |
| 429 | Community 429 | 2 | 1 | 0 | 0 | scan_biomech_orchid · scan_biomech_orchid.md | `assets/ui-generation/biomech-botanical/prompts/scan_biomech_orchid.md` |
| 430 | Community 430 | 2 | 1 | 0 | 0 | scan_sensor_flower_closeup · scan_sensor_flower_closeup.md | `assets/ui-generation/biomech-botanical/prompts/scan_sensor_flower_closeup.md` |
| 431 | Community 431 | 2 | 1 | 0 | 0 | extraction-spec.md · graphify reference: extraction subagent prompt | `.claude/skills/graphify/references/extraction-spec.md` |
| 432 | Community 537 | 2 | 1 | 0 | 1 | Accepted Left Vine Overlay · Accepted Right Vine Overlay | `docs/biotope/ui/ai-assets/reviews/deco_vine_corner_left.md`<br/>`docs/biotope/ui/ai-assets/reviews/deco_vine_corner_right.md` |
| 433 | Community 538 | 2 | 1 | 0 | 1 | Alternate Home Hero · Primary Home Hero | `docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_alt_01.md`<br/>`docs/biotope/ui/ai-assets/reviews/home_hero_robot_hand_main.md` |
| 434 | Community 539 | 2 | 1 | 0 | 1 | Profile Porcelain Camellia · Profile Signature Flower | `docs/biotope/ui/ai-assets/reviews/profile_porcelain_camellia.md`<br/>`docs/biotope/ui/ai-assets/reviews/profile_signature_flower.md` |
| 435 | Agent Worktree Setup | 2 | 1 | 0 | 0 | B-PL20 Canonical Orientation Docs Lag Long-Horizon Builds · B-PL21 PaperRecord Shared Contract Debt | `docs/temp/run3/pending-build-register.md` |
| 436 | Community 436 | 2 | 1 | 0 | 0 | seed-test-data.ps1 · Write-Step() | `scripts/seed-test-data.ps1` |
| 437 | Community 437 | 2 | 1 | 0 | 0 | setup.ps1 · Step() | `scripts/setup.ps1` |
| 438 | Community 547 | 2 | 1 | 0 | 1 | Context-System Bootstrap · Historical Session Backfill | `docs/sessions/20260601T000000Z-uandiqueue-team-historical-backfill.md`<br/>`docs/sessions/20260608T045610Z-uandiqueue-claude-context-system-bootstrap.md` |
| 439 | Community 548 | 2 | 1 | 0 | 0 | Dev-Phase2 PR Target · Single Dev-Phase2 Integration Line | `docs/sessions/20260610T035536Z-uandiqueue-claude-pr-target-dev-phase2-alton.md`<br/>`docs/sessions/20260610T042206Z-uandiqueue-claude-consolidate-onto-dev-phase2.md` |
| 440 | Community 549 | 2 | 1 | 0 | 1 | Metrics Registry Design Session · Metrics Registry Shared Parity Session | `docs/sessions/20260619T020858Z-uandiqueue-claude-commit-metrics-registry-design.md`<br/>`docs/sessions/20260619T060221Z-uandiqueue-claude-metrics-registry-shared-parity.md` |
| 441 | Community 550 | 2 | 1 | 0 | 1 | Docs Feature Folders Session · Nao Design Document Session | `docs/sessions/20260629T152720Z-agentjwork-claude-docs-feature-folders.md`<br/>`docs/sessions/20260630T050141Z-agentjwork-claude-nao-design-doc.md` |
| 442 | Community 551 | 2 | 1 | 0 | 1 | Nao V1 Design Implementation Session · Readme Restructure Session | `docs/sessions/20260630T155323Z-agentjwork-claude-nao-design-implementation.md`<br/>`docs/sessions/20260701T031916Z-agentjwork-claude-readme-restructure.md` |
| 443 | Community 553 | 2 | 1 | 0 | 1 | Biotope Nao Link Refinement Session · Nao Corpus Run and Controls Session | `docs/sessions/20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md`<br/>`docs/sessions/20260708T164343Z-altogennn-claude-biotope-nao-link-refine.md` |
| 444 | Community 378 | 2 | 1 | 0 | 0 | Docs Consolidation and Hackathon Narrative · Docs Taxonomy and Enforcement | `docs/sessions/20260713T033718Z-agentjwork-claude-docs-consolidation-hackathon.md` |
| 445 | Community 554 | 2 | 1 | 0 | 0 | L0 Contract Extension Session · Phase 2 Run Orchestration Bootstrap Session | `docs/sessions/20260715T134326Z-agentjwork-claude-phase2-run-orchestration-bootstrap.md`<br/>`docs/sessions/20260715T135541Z-agentjwork-claude-l0-contract-extension.md` |
| 446 | Community 555 | 2 | 1 | 0 | 1 | Dual-Route LLM Router · QuoteCheck and Venue Lookup | `docs/sessions/20260715T143750Z-agentjwork-claude-brain-llm-router.md`<br/>`docs/sessions/20260715T145734Z-agentjwork-claude-quotecheck-venue-lookup.md` |
| 447 | Community 556 | 2 | 1 | 0 | 0 | L6 One-Card End-to-End Slice · Node Tool CI Matrix | `docs/sessions/20260716T060410Z-agentjwork-claude-l6-one-card-slice.md`<br/>`docs/sessions/20260716T061453Z-agentjwork-claude-ci-node-tool-suites.md` |
| 448 | Shared Memory Coordinator | 2 | 1 | 0 | 1 | Relationship Cards and UTC Expiry · Snooze and Stale-Signal Safety | `docs/sessions/20260718T043726Z-agentjwork-claude-u22-snooze-stale-signals.md`<br/>`docs/sessions/20260718T045102Z-agentjwork-claude-u21-relationship-cards-utc-expiry.md` |
| 449 | Community 557 | 2 | 1 | 0 | 1 | U25 DB Constraint Hygiene Session · U28 Nit Sweep Session | `docs/sessions/20260718T051721Z-agentjwork-claude-u25-db-constraint-hygiene.md`<br/>`docs/sessions/20260718T061213Z-agentjwork-claude-u28-nit-sweep.md` |
| 450 | Community 558 | 2 | 1 | 0 | 1 | U27 CI Deno and Migrations Session · U29 Deno Client Types Session | `docs/sessions/20260718T055159Z-agentjwork-claude-u27-ci-deno-migrations.md`<br/>`docs/sessions/20260718T160053Z-agentjwork-claude-u29-deno-client-types.md` |
| 451 | Community 559 | 2 | 1 | 0 | 0 | Research Fixes Rho Label Session · Research Fixes Run Setup Session | `docs/sessions/20260719T144911Z-agentjwork-claude-research-fixes-run-setup.md`<br/>`docs/sessions/20260719T145507Z-agentjwork-claude-research-fixes-rho-label.md` |
| 452 | Community 560 | 2 | 1 | 0 | 1 | C5 Medium Confidence Cutoff · Deadband Fire-Rate Instrumentation | `docs/sessions/20260719T151130Z-agentjwork-claude-research-fixes-c5-cutoff.md`<br/>`docs/sessions/20260719T153645Z-agentjwork-claude-research-fixes-deadbandk.md` |
| 453 | Community 561 | 2 | 1 | 0 | 1 | Lag-Two Coincidence Window · xDF Effective-N Seam | `docs/sessions/20260719T154600Z-agentjwork-claude-research-fixes-lag2.md`<br/>`docs/sessions/20260719T155721Z-agentjwork-claude-research-fixes-xdf-seam.md` |
| 454 | Community 562 | 2 | 1 | 0 | 0 | Research fixes commit evidence review session · Research fixes composite calibration session | `docs/sessions/20260719T161537Z-agentjwork-claude-research-fixes-composite-calibration.md`<br/>`docs/sessions/20260720T040750Z-agentjwork-claude-research-fixes-commit-evidence-review.md` |
| 455 | Community 245 | 2 | 1 | 0 | 0 | Brain Ingestion Workflow · Remote-Controlled Corpus Ingestion | `.github/workflows/brain-ingest.yml` |
| 991 | Community 991 | 2 | 1 | 0 | 0 | setup-macos.sh · setup-macos.sh script | `docs/development/model-training/viceroy-training/setup-macos.sh` |
| 992 | Community 992 | 2 | 1 | 0 | 0 | setup-macos.sh · setup-macos.sh script | `docs/development/model-training/zebra-training/setup-macos.sh` |
| 993 | Community 993 | 2 | 1 | 0 | 0 | __init__.py · Giraffe Study-Design v0 -- placeholder package (build unit MT2). Not … | `model-training/src/ourobion_model_lab/models/giraffe_study_design/__init__.py` |
| 994 | Community 994 | 2 | 1 | 0 | 0 | LegacyHowItWorksPage() · page.tsx | `apps/nao/src/app/how-it-works/page.tsx` |
| 995 | Community 995 | 2 | 1 | 0 | 0 | __init__.py · Private, offline, read-only research inference over frozen model rele… | `model-training/src/ourobion_model_lab/inference/__init__.py` |
| 996 | Community 996 | 2 | 1 | 0 | 0 | __init__.py · Leafcutter Sentence Role v0 -- placeholder package (build unit MT1). … | `model-training/src/ourobion_model_lab/models/leafcutter_sentence_role/__init__.py` |
| 997 | Community 997 | 2 | 1 | 0 | 0 | 0018 — Cloud Agnes verification is authorized through an audited nao … · 0018-cloud-verifier-authorization.md | `docs/memory/0018-cloud-verifier-authorization.md` |
| 998 | Community 998 | 2 | 1 | 0 | 0 | 0019-runtime-and-storage-topology.md · Runtime and storage topology | `docs/memory/0019-runtime-and-storage-topology.md` |
| 999 | Community 999 | 2 | 1 | 0 | 0 | 0020-five-custom-model-research-programme.md · Five-model research programme is non-serving by default | `docs/memory/0020-five-custom-model-research-programme.md` |
| 1000 | Community 1000 | 2 | 1 | 0 | 0 | 0021-nao-membership-is-not-health-data-authority.md · Nao membership is not health-data authority | `docs/memory/0021-nao-membership-is-not-health-data-authority.md` |
| 1001 | Community 1001 | 2 | 1 | 0 | 0 | 0022-owner-verification-is-an-authority-boundary.md · Owner verification is an authority boundary | `docs/memory/0022-owner-verification-is-an-authority-boundary.md` |
| 1002 | Community 1002 | 2 | 1 | 0 | 0 | 0023-hosted-state-is-timestamped-evidence.md · Hosted state and measurements expire | `docs/memory/0023-hosted-state-is-timestamped-evidence.md` |
| 1003 | Community 1003 | 2 | 1 | 0 | 0 | 0024-training-compute-is-local.md · Training compute is local Apple Silicon, not sponsor GPU | `docs/memory/0024-training-compute-is-local.md` |
| 1004 | Community 1004 | 2 | 1 | 0 | 0 | 0025-team-composition.md · Ourobion team composition and canonical roles | `docs/memory/0025-team-composition.md` |
| 1005 | Community 1005 | 2 | 1 | 0 | 0 | code-build-unit-index.md · Model-training code build — unit index | `docs/development/model-training/code-build-unit-index.md` |
| 1006 | Community 1006 | 2 | 1 | 0 | 0 | __init__.py · Per-model packages for build units MT1-MT5. Each subpackage below is … | `model-training/src/ourobion_model_lab/models/__init__.py` |
| 1007 | Community 1007 | 2 | 1 | 0 | 0 | README.md · Zebra v1 and Viceroy v0 publication results | `model-training/evidence/publication-results/README.md` |
| 1008 | Community 1008 | 2 | 1 | 0 | 0 | hack-mvp-prompt-app.md · Hackathon MVP · APP lane — biotope on the tethered phone | `docs/development/run4/hack-mvp-prompt-app.md` |
| 1009 | Community 1009 | 2 | 1 | 0 | 0 | hack-mvp-prompt-cloud.md · Hackathon MVP · CLOUD lane — hosted backend (critical path) | `docs/development/run4/hack-mvp-prompt-cloud.md` |
| 1010 | Community 1010 | 2 | 1 | 0 | 0 | orchestrator-prompt.md · Phase-2 Run 4 continuation orchestrator prompt | `docs/development/run4/orchestrator-prompt.md` |
| 1011 | Community 1011 | 2 | 1 | 0 | 0 | Run 4 launch prompt — superseded pointer · run4-launch-prompt.md | `docs/development/run4/run4-launch-prompt.md` |
| 1012 | Community 1012 | 2 | 1 | 0 | 0 | __init__.py · Model-native research runners. Import-time cost here is stdlib only; … | `model-training/src/ourobion_model_lab/inference/runners/__init__.py` |
| 1013 | Community 1013 | 2 | 1 | 0 | 0 | __init__.py · Salmon Relation/Direction v0 -- placeholder package (build unit MT4).… | `model-training/src/ourobion_model_lab/models/salmon_relation_direction/__init__.py` |
| 1014 | Community 1014 | 2 | 1 | 0 | 0 | brainPipelineWorkflow.test.ts · workflow | `tools/brain-ingest/tests/brainPipelineWorkflow.test.ts` |
| 1015 | Community 1015 | 2 | 1 | 0 | 0 | __init__.py · Viceroy Claim Kind v0 -- placeholder package (build unit MT5). Not ye… | `model-training/src/ourobion_model_lab/models/viceroy_claim_kind/__init__.py` |
| 1016 | Community 1016 | 2 | 1 | 0 | 0 | README.md · Viceroy v0 — demo release evidence | `model-training/evidence/viceroy-v0/README.md` |
| 1017 | Community 1017 | 2 | 1 | 0 | 0 | __init__.py · Zebra NLI Shadow v0 -- placeholder package (build unit MT3). Not yet … | `model-training/src/ourobion_model_lab/models/zebra_nli_shadow/__init__.py` |
| 1018 | Community 1018 | 2 | 1 | 0 | 0 | README.md · Zebra v1 — demo release evidence | `model-training/evidence/zebra-v1/README.md` |
| 40 | Parity Schema Tests | 1 | 0 | 0 | 0 | Phase 2 plan | `docs/shared/phase-2-plan.md` |
| 456 | Community 456 | 1 | 0 | 0 | 0 | build.gradle.kts | `apps/biotope/android/build.gradle.kts` |
| 457 | Community 457 | 1 | 0 | 0 | 0 | settings.gradle.kts | `apps/biotope/android/settings.gradle.kts` |
| 458 | Community 458 | 1 | 0 | 0 | 0 | build.gradle.kts | `apps/biotope/android/app/build.gradle.kts` |
| 459 | Community 568 | 1 | 0 | 0 | 0 | Nao application icon | `apps/nao/src/app/icon.png` |
| 460 | Community 569 | 1 | 0 | 0 | 0 | Flutter macOS app icon at 16 pixels | `apps/biotope/macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_16.png` |
| 461 | Community 570 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png` |
| 462 | Community 571 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@1x.png` |
| 463 | Community 572 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png` |
| 464 | Community 573 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@3x.png` |
| 465 | Community 574 | 1 | 0 | 0 | 0 | Flutter app icon | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@1x.png` |
| 466 | Community 575 | 1 | 0 | 0 | 0 | Flutter app icon at 29x29 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@2x.png` |
| 467 | Community 576 | 1 | 0 | 0 | 0 | Flutter app icon at 40x40 1x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png` |
| 468 | Community 577 | 1 | 0 | 0 | 0 | Flutter app icon at 60x60 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png` |
| 469 | Community 578 | 1 | 0 | 0 | 0 | Flutter app icon at 83.5x83.5 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-83.5x83.5@2x.png` |
| 470 | Community 470 | 1 | 0 | 0 | 0 | generated_plugin_registrant.h | `apps/biotope/linux/flutter/generated_plugin_registrant.h` |
| 471 | Community 471 | 1 | 0 | 0 | 0 | my_application.h | `apps/biotope/linux/runner/my_application.h` |
| 472 | Community 472 | 1 | 0 | 0 | 0 | generated_plugin_registrant.h | `apps/biotope/windows/flutter/generated_plugin_registrant.h` |
| 473 | Community 473 | 1 | 0 | 0 | 0 | win32_window.h | `apps/biotope/windows/runner/win32_window.h` |
| 474 | Community 584 | 1 | 0 | 0 | 0 | Biomechanical herbarium specimen | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_herbarium_specimen.png` |
| 475 | Community 585 | 1 | 0 | 0 | 0 | Mechanical preserved flower fragment | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_preserved_flower_fragment.png` |
| 476 | Community 586 | 1 | 0 | 0 | 0 | Botanical report thumbnail | `apps/biotope/assets/images/generated/biomech_botanical/archive/archive_report_thumbnail_base.png` |
| 477 | Community 477 | 1 | 0 | 0 | 0 | antibiotics_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/behaviour/antibiotics_logging.dart` |
| 478 | Community 478 | 1 | 0 | 0 | 0 | food_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/behaviour/food_logging.dart` |
| 479 | Community 594 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `apps/nao/public/brand/ourobion-lockup-dark.svg` |
| 480 | Community 595 | 1 | 0 | 0 | 0 | Ourobion dark mark | `apps/nao/public/brand/ourobion-mark-dark-512.png` |
| 481 | Community 596 | 1 | 0 | 0 | 0 | Ourobion dark mark | `apps/nao/public/brand/ourobion-mark-dark.svg` |
| 482 | Community 597 | 1 | 0 | 0 | 0 | Herbarium specimen candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_herbarium_specimen_attempt_1.png` |
| 483 | Community 598 | 1 | 0 | 0 | 0 | Preserved flower fragment candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_preserved_flower_fragment_attempt_1.png` |
| 484 | Community 599 | 1 | 0 | 0 | 0 | Archive report thumbnail candidate | `docs/biotope/ui/ai-assets/reviews/candidates/archive_report_thumbnail_base_attempt_1.png` |
| 485 | Community 600 | 1 | 0 | 0 | 0 | Blush flower cluster candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_flower_cluster_blush_attempt_1.png` |
| 486 | Community 601 | 1 | 0 | 0 | 0 | White flower cluster candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_flower_cluster_white_attempt_1.png` |
| 487 | Community 602 | 1 | 0 | 0 | 0 | Brass leaf node candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_leaf_brass_node_attempt_1.png` |
| 488 | Community 603 | 1 | 0 | 0 | 0 | Small biomechanical bloom candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_small_biomech_bloom_attempt_1.png` |
| 489 | Community 604 | 1 | 0 | 0 | 0 | Left vine corner candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_vine_corner_left_attempt_1.png` |
| 490 | Community 605 | 1 | 0 | 0 | 0 | Right vine corner candidate | `docs/biotope/ui/ai-assets/reviews/candidates/deco_vine_corner_right_attempt_1.png` |
| 491 | Community 606 | 1 | 0 | 0 | 0 | Empty archive specimen candidate | `docs/biotope/ui/ai-assets/reviews/candidates/empty_archive_specimen_attempt_1.png` |
| 492 | Community 607 | 1 | 0 | 0 | 0 | Pale green biomechanical seedpod on a curved stem with leaves and gol… | `docs/biotope/ui/ai-assets/reviews/candidates/empty_insights_seedpod_attempt_1.png` |
| 493 | Community 608 | 1 | 0 | 0 | 0 | Drooping white bell flower with botanical stem, leaf, and gold mechan… | `docs/biotope/ui/ai-assets/reviews/candidates/empty_notifications_flower_attempt_1.png` |
| 494 | Community 609 | 1 | 0 | 0 | 0 | White orchid bloom with buds and a cream mechanical ring | `docs/biotope/ui/ai-assets/reviews/candidates/empty_scan_bloom_attempt_1.png` |
| 495 | Community 610 | 1 | 0 | 0 | 0 | White orchid bloom with buds, long leaf, and cream mechanical arc | `docs/biotope/ui/ai-assets/reviews/candidates/empty_scan_bloom_attempt_2.png` |
| 496 | Community 611 | 1 | 0 | 0 | 0 | White biomechanical flowering branch cluster arranged in the lower-ri… | `docs/biotope/ui/ai-assets/reviews/candidates/home_flower_cluster_card_attempt_1.png` |
| 497 | Community 612 | 1 | 0 | 0 | 0 | Dense white and blush biomechanical flower cluster with branching gol… | `docs/biotope/ui/ai-assets/reviews/candidates/home_flower_cluster_card_attempt_2.png` |
| 498 | Community 613 | 1 | 0 | 0 | 0 | White robotic hand cradling a lush white botanical flower arrangement | `docs/biotope/ui/ai-assets/reviews/candidates/home_hero_robot_hand_alt_01_attempt_1.png` |
| 499 | Community 614 | 1 | 0 | 0 | 0 | Upraised white robotic hand holding white flowers and green botanical… | `docs/biotope/ui/ai-assets/reviews/candidates/home_hero_robot_hand_main_attempt_1.png` |
| 500 | Community 615 | 1 | 0 | 0 | 0 | Heart-shaped biomechanical frame filled with white and blush flowers | `docs/biotope/ui/ai-assets/reviews/candidates/insights_biomech_heart_bloom_attempt_1.png` |
| 501 | Community 616 | 1 | 0 | 0 | 0 | Branching biomechanical node network interwoven with white and blush … | `docs/biotope/ui/ai-assets/reviews/candidates/insights_branching_node_system_attempt_1.png` |
| 502 | Community 617 | 1 | 0 | 0 | 0 | Neural-like biomechanical node system woven through a white botanical… | `docs/biotope/ui/ai-assets/reviews/candidates/insights_neural_botanical_cluster_attempt_1.png` |
| 503 | Community 618 | 1 | 0 | 0 | 0 | Symmetrical botanical crest with central cream mechanical node and pa… | `docs/biotope/ui/ai-assets/reviews/candidates/profile_botanical_crest_attempt_1.png` |
| 504 | Community 619 | 1 | 0 | 0 | 0 | Porcelain camellia candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/profile_porcelain_camellia_attempt_1.png` |
| 505 | Community 620 | 1 | 0 | 0 | 0 | Signature flower candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/profile_signature_flower_attempt_1.png` |
| 506 | Community 621 | 1 | 0 | 0 | 0 | Biomechanical orchid candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/scan_biomech_orchid_attempt_1.png` |
| 507 | Community 622 | 1 | 0 | 0 | 0 | Circular bloom candidate one | `docs/biotope/ui/ai-assets/reviews/candidates/scan_circular_bloom_attempt_1.png` |
| 508 | Community 623 | 1 | 0 | 0 | 0 | Circular bloom candidate two | `docs/biotope/ui/ai-assets/reviews/candidates/scan_circular_bloom_attempt_2.png` |
| 509 | Community 624 | 1 | 0 | 0 | 0 | Sensor flower closeup candidate | `docs/biotope/ui/ai-assets/reviews/candidates/scan_sensor_flower_closeup_attempt_1.png` |
| 510 | Community 510 | 1 | 0 | 0 | 0 | daily_checkin.dart | `apps/biotope/lib/modules/m2_self_report/impl/checkin/daily_checkin.dart` |
| 511 | Community 626 | 1 | 0 | 0 | 0 | Blush mechanical flower cluster | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_flower_cluster_blush.png` |
| 512 | Community 627 | 1 | 0 | 0 | 0 | White mechanical flower cluster | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_flower_cluster_white.png` |
| 513 | Community 628 | 1 | 0 | 0 | 0 | Brass leaf node | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_leaf_brass_node.png` |
| 514 | Community 629 | 1 | 0 | 0 | 0 | Small biomechanical bloom | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_small_biomech_bloom.png` |
| 515 | Community 630 | 1 | 0 | 0 | 0 | Left biomechanical botanical corner vine decoration | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_vine_corner_left.png` |
| 516 | Community 631 | 1 | 0 | 0 | 0 | Right biomechanical botanical corner vine decoration | `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_vine_corner_right.png` |
| 517 | Community 368 | 1 | 0 | 0 | 0 | Hand-authored edge artifact fixtures | `tools/edge-loader/tests/fixtures/edges/README.md` |
| 518 | Community 632 | 1 | 0 | 0 | 0 | Pinned pressed-flower archive empty-state illustration | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_archive_specimen.png` |
| 519 | Community 633 | 1 | 0 | 0 | 0 | Seedpod empty-state illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_insights_seedpod.png` |
| 520 | Community 634 | 1 | 0 | 0 | 0 | Pendant bell-flower empty-state illustration for notifications | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_notifications_flower.png` |
| 521 | Community 635 | 1 | 0 | 0 | 0 | Biomechanical orchid empty-state illustration for scanning | `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_scan_bloom.png` |
| 522 | Community 636 | 1 | 0 | 0 | 0 | Ourobion circular teal apple touch icon at 180 pixels | `assets/ourobion-brand/favicon/apple-touch-icon-180.png` |
| 523 | Community 637 | 1 | 0 | 0 | 0 | Biotope touch icon | `assets/ourobion-biotope-logo/favicon/apple-touch-icon-180.png` |
| 524 | Community 638 | 1 | 0 | 0 | 0 | Ourobion circular teal favicon at 16 pixels | `assets/ourobion-brand/favicon/favicon-16.png` |
| 525 | Community 639 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon-16.png` |
| 526 | Community 640 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon-32.png` |
| 527 | Community 641 | 1 | 0 | 0 | 0 | Biotope favicon | `assets/ourobion-biotope-logo/favicon/favicon.svg` |
| 528 | Community 642 | 1 | 0 | 0 | 0 | Ourobion favicon | `assets/ourobion-brand/favicon/favicon.svg` |
| 529 | Community 529 | 1 | 0 | 0 | 0 | stool_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/gut/stool_logging.dart` |
| 530 | Community 530 | 1 | 0 | 0 | 0 | urine_logging.dart | `apps/biotope/lib/modules/m2_self_report/impl/gut/urine_logging.dart` |
| 532 | Community 646 | 1 | 0 | 0 | 0 | Launchpad 2026 hackathon rules | `docs/shared/hackathon/hackathon-rules.md` |
| 533 | Community 647 | 1 | 0 | 0 | 0 | Biomechanical flower cluster for a home card | `apps/biotope/assets/images/generated/biomech_botanical/home/home_flower_cluster_card.png` |
| 534 | Community 648 | 1 | 0 | 0 | 0 | Alternate home hero image of a robotic hand with blossoms | `apps/biotope/assets/images/generated/biomech_botanical/home/home_hero_robot_hand_alt_01.png` |
| 535 | Community 649 | 1 | 0 | 0 | 0 | Main home hero image of an upraised robotic hand with blossoms | `apps/biotope/assets/images/generated/biomech_botanical/home/home_hero_robot_hand_main.png` |
| 536 | Community 650 | 1 | 0 | 0 | 0 | Flutter web icon at 192 pixels | `apps/biotope/web/icons/Icon-192.png` |
| 537 | Community 651 | 1 | 0 | 0 | 0 | Flutter web icon at 512 pixels | `apps/biotope/web/icons/Icon-512.png` |
| 538 | Community 652 | 1 | 0 | 0 | 0 | Flutter maskable web icon at 192 pixels | `apps/biotope/web/icons/Icon-maskable-192.png` |
| 539 | Community 653 | 1 | 0 | 0 | 0 | Flutter web maskable icon | `apps/biotope/web/icons/Icon-maskable-512.png` |
| 540 | Community 654 | 1 | 0 | 0 | 0 | Biotope logo mark | `apps/biotope/assets/images/logo.png` |
| 541 | Community 655 | 1 | 0 | 0 | 0 | Heart-shaped biomechanical floral illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_biomech_heart_bloom.png` |
| 542 | Community 656 | 1 | 0 | 0 | 0 | Branching biomechanical node network for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_branching_node_system.png` |
| 543 | Community 657 | 1 | 0 | 0 | 0 | Neural botanical cluster illustration for insights | `apps/biotope/assets/images/generated/biomech_botanical/insights/insights_neural_botanical_cluster.png` |
| 544 | Community 658 | 1 | 0 | 0 | 0 | Blank white launch image at 2x scale | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png` |
| 545 | Community 659 | 1 | 0 | 0 | 0 | Blank white launch image | `apps/biotope/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png` |
| 546 | Community 546 | 1 | 0 | 0 | 0 | index.dart | `apps/biotope/lib/modules/m4_environmental/index.dart` |
| 547 | Community 547 | 1 | 0 | 0 | 0 | index.dart | `apps/biotope/lib/modules/m7_community/index.dart` |
| 548 | Community 378 | 1 | 0 | 0 | 0 | Docs Taxonomy and Enforcement | `docs/memory/0015-docs-taxonomy-and-enforcement.md` |
| 549 | Community 368 | 1 | 0 | 0 | 0 | Metrics registry contract | `shared/metrics/README.md` |
| 550 | Community 662 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-hdpi/ic_launcher.png` |
| 551 | Community 663 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-mdpi/ic_launcher.png` |
| 552 | Community 664 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` |
| 553 | Community 665 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` |
| 554 | Community 666 | 1 | 0 | 0 | 0 | Flutter launcher logo | `apps/biotope/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` |
| 555 | Community 555 | 1 | 0 | 0 | 0 | open-next.config.ts | `apps/nao/open-next.config.ts` |
| 556 | Community 556 | 1 | 0 | 0 | 0 | bool? |  |
| 557 | Community 670 | 1 | 0 | 0 | 0 | Biotope dark lockup | `assets/ourobion-biotope-logo/logo/png/biotope-lockup-dark-1024.png` |
| 558 | Community 671 | 1 | 0 | 0 | 0 | Biotope light lockup | `assets/ourobion-biotope-logo/logo/png/biotope-lockup-light-1024.png` |
| 559 | Community 672 | 1 | 0 | 0 | 0 | Biotope dark mark | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-1024.png` |
| 560 | Community 673 | 1 | 0 | 0 | 0 | Biotope dark logo mark at 256 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-256.png` |
| 561 | Community 674 | 1 | 0 | 0 | 0 | Biotope dark logo mark at 512 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-dark-512.png` |
| 562 | Community 675 | 1 | 0 | 0 | 0 | Biotope light logo mark at 1024 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-1024.png` |
| 563 | Community 676 | 1 | 0 | 0 | 0 | Biotope light logo mark at 256 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-256.png` |
| 564 | Community 677 | 1 | 0 | 0 | 0 | Biotope light logo mark at 512 pixels | `assets/ourobion-biotope-logo/logo/png/biotope-mark-light-512.png` |
| 565 | Community 678 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `assets/ourobion-brand/logo/png/ourobion-lockup-dark-1024.png` |
| 566 | Community 679 | 1 | 0 | 0 | 0 | Ourobion light lockup | `assets/ourobion-brand/logo/png/ourobion-lockup-light-1024.png` |
| 567 | Community 680 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-1024.png` |
| 568 | Community 681 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-256.png` |
| 569 | Community 682 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/png/ourobion-mark-dark-512.png` |
| 570 | Community 683 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-1024.png` |
| 571 | Community 684 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-256.png` |
| 572 | Community 685 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/png/ourobion-mark-light-512.png` |
| 573 | Community 686 | 1 | 0 | 0 | 0 | Botanical mechanical profile crest | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_botanical_crest.png` |
| 574 | Community 687 | 1 | 0 | 0 | 0 | Porcelain camellia profile flower | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_porcelain_camellia.png` |
| 575 | Community 688 | 1 | 0 | 0 | 0 | Signature mechanical flower | `apps/biotope/assets/images/generated/biomech_botanical/profile/profile_signature_flower.png` |
| 576 | Community 689 | 1 | 0 | 0 | 0 | Biomechanical botanical UI reference | `docs/biotope/ui/ai-assets/references/biomech-botanical-ui-seed.png` |
| 577 | Community 692 | 1 | 0 | 0 | 0 | Archive Empty-State Specimen | `docs/biotope/ui/ai-assets/reviews/empty_archive_specimen.md` |
| 578 | Community 693 | 1 | 0 | 0 | 0 | Insights Empty-State Seedpod | `docs/biotope/ui/ai-assets/reviews/empty_insights_seedpod.md` |
| 579 | Community 694 | 1 | 0 | 0 | 0 | Notifications Empty-State Flower | `docs/biotope/ui/ai-assets/reviews/empty_notifications_flower.md` |
| 580 | Community 695 | 1 | 0 | 0 | 0 | Scan Empty-State Bloom | `docs/biotope/ui/ai-assets/reviews/empty_scan_bloom.md` |
| 581 | Community 696 | 1 | 0 | 0 | 0 | Home Flower Card Accent | `docs/biotope/ui/ai-assets/reviews/home_flower_cluster_card.md` |
| 582 | Community 697 | 1 | 0 | 0 | 0 | Insights Heart Bloom | `docs/biotope/ui/ai-assets/reviews/insights_biomech_heart_bloom.md` |
| 583 | Community 698 | 1 | 0 | 0 | 0 | Profile Botanical Crest | `docs/biotope/ui/ai-assets/reviews/profile_botanical_crest.md` |
| 584 | Community 606 | 1 | 0 | 0 | 0 | B-BR4 Custom Support Models | `docs/temp/run3/pending-build-register.md` |
| 585 | Community 585 | 1 | 0 | 0 | 0 | Runner-Bridging-Header.h | `apps/biotope/ios/Runner/Runner-Bridging-Header.h` |
| 586 | Community 701 | 1 | 0 | 0 | 0 | Biomechanical orchid scan | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_biomech_orchid.png` |
| 587 | Community 702 | 1 | 0 | 0 | 0 | Circular biomechanical bloom scan | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_circular_bloom.png` |
| 588 | Community 703 | 1 | 0 | 0 | 0 | Sensor flower closeup | `apps/biotope/assets/images/generated/biomech_botanical/scan/scan_sensor_flower_closeup.png` |
| 589 | Community 589 | 1 | 0 | 0 | 0 | biotope-env.ps1 | `scripts/biotope-env.ps1` |
| 590 | Community 590 | 1 | 0 | 0 | 0 | graphify-build.ps1 | `scripts/graphify-build.ps1` |
| 591 | Community 706 | 1 | 0 | 0 | 0 | Docs Cleanup Session | `docs/sessions/20260611T073034Z-uandiqueue-claude-docs-cleanup-stale-redundant.md` |
| 592 | Community 707 | 1 | 0 | 0 | 0 | Graphify Setup and Readme Session | `docs/sessions/20260617T064658Z-uandiqueue-claude-graphify-setup-and-readme.md` |
| 593 | Community 708 | 1 | 0 | 0 | 0 | Graphify Claude Skill Session | `docs/sessions/20260618T092022Z-uandiqueue-claude-graphify-claude-skill.md` |
| 594 | Community 709 | 1 | 0 | 0 | 0 | Readme Context Engineering Session | `docs/sessions/20260618T094117Z-uandiqueue-claude-readme-context-engineering.md` |
| 595 | Community 710 | 1 | 0 | 0 | 0 | Wikilinks to Markdown Session | `docs/sessions/20260618T094429Z-uandiqueue-claude-wikilinks-to-markdown.md` |
| 596 | Community 711 | 1 | 0 | 0 | 0 | Phase 2 Metric Platform Replan Session | `docs/sessions/20260620T161931Z-uandiqueue-claude-phase2-replan-metric-platform.md` |
| 597 | Community 712 | 1 | 0 | 0 | 0 | W0 Metric Platform Foundation Session | `docs/sessions/20260622T021945Z-uandiqueue-claude-w0-metric-platform-foundation.md` |
| 598 | Community 713 | 1 | 0 | 0 | 0 | Ourobion Rebrand Session | `docs/sessions/20260625T041011Z-uandiqueue-claude-rebrand-ourobion.md` |
| 599 | Community 368 | 1 | 0 | 0 | 0 | Brain Ingest Pipeline Session | `docs/sessions/20260629T054330Z-agentjwork-claude-brain-ingest-pipeline.md` |
| 600 | Community 245 | 1 | 0 | 0 | 0 | Apps Monorepo Layout | `docs/sessions/20260630T065703Z-agentjwork-claude-apps-monorepo-layout.md` |
| 601 | Community 245 | 1 | 0 | 0 | 0 | Nao Architecture Research Snapshot | `docs/sessions/20260630T071429Z-agentjwork-claude-nao-research-brief.md` |
| 602 | Community 245 | 1 | 0 | 0 | 0 | Nao Environment Convention | `docs/sessions/20260630T075152Z-agentjwork-claude-nao-env-convention.md` |
| 603 | Community 552 | 1 | 0 | 0 | 0 | Demo Scope Propagation Session | `docs/sessions/20260701T080448Z-agentjwork-claude-demo-scope-propagate.md` |
| 604 | Community 714 | 1 | 0 | 0 | 0 | M2 Standing-water Audit Session | `docs/sessions/20260702T080203Z-altogennn-claude-m2-standing-water-audit.md` |
| 605 | Community 715 | 1 | 0 | 0 | 0 | Backend Test Plan Brief Session | `docs/sessions/20260718T062214Z-agentjwork-claude-backend-test-plan-brief.md` |
| 606 | Community 169 | 1 | 0 | 0 | 0 | Run 2 U13 decorrelated full-run session | `docs/sessions/20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md` |
| 607 | Run Three Build Register | 1 | 0 | 0 | 0 | Run-2 Adversarial Audit Session | `docs/sessions/20260726T045406Z-agentjwork-codex-run2-adversarial-audit.md` |
| 608 | NLI Support Model Pilot | 1 | 0 | 0 | 0 | Run-3 GMI Training-plan Session | `docs/sessions/20260726T141532Z-agentjwork-codex-run3-gmi-training-plan.md` |
| 610 | Community 716 | 1 | 0 | 0 | 0 | Ourobion shared contract context | `shared/SHARED-CONTEXT.md` |
| 611 | Community 717 | 1 | 0 | 0 | 0 | Ourobion Biotope dark lockup: gold six-petal botanical emblem encircl… | `assets/ourobion-biotope-logo/logo/svg/biotope-lockup-dark.svg` |
| 612 | Community 718 | 1 | 0 | 0 | 0 | Ourobion Biotope light lockup: gold six-petal botanical emblem and wh… | `assets/ourobion-biotope-logo/logo/svg/biotope-lockup-light.svg` |
| 613 | Community 719 | 1 | 0 | 0 | 0 | Biotope dark mark: gold six-petal botanical emblem inside a circular … | `assets/ourobion-biotope-logo/logo/svg/biotope-mark-dark.svg` |
| 614 | Community 720 | 1 | 0 | 0 | 0 | Biotope light mark: gold six-petal botanical emblem inside a white-ac… | `assets/ourobion-biotope-logo/logo/svg/biotope-mark-light.svg` |
| 615 | Community 721 | 1 | 0 | 0 | 0 | Ourobion dark lockup | `assets/ourobion-brand/logo/svg/ourobion-lockup-dark.svg` |
| 616 | Community 722 | 1 | 0 | 0 | 0 | Ourobion light lockup | `assets/ourobion-brand/logo/svg/ourobion-lockup-light.svg` |
| 617 | Community 723 | 1 | 0 | 0 | 0 | Ourobion dark mark | `assets/ourobion-brand/logo/svg/ourobion-mark-dark.svg` |
| 618 | Community 724 | 1 | 0 | 0 | 0 | Ourobion light mark | `assets/ourobion-brand/logo/svg/ourobion-mark-light.svg` |
| 619 | Community 725 | 1 | 0 | 0 | 0 | Flutter web favicon | `apps/biotope/web/favicon.png` |
| 1019 | Community 1019 | 1 | 0 | 0 | 0 | __init__.py | `docs/development/model-training/viceroy-training/tests/__init__.py` |
| 1020 | Community 1020 | 1 | 0 | 0 | 0 | __init__.py | `docs/development/model-training/zebra-training/tests/__init__.py` |
| 1021 | Community 1021 | 1 | 0 | 0 | 0 | native-process-probe.ps1 | `scripts/tests/fixtures/native-process-probe.ps1` |
| 1022 | Community 1022 | 1 | 0 | 0 | 0 | __init__.py | `model-training/tests/__init__.py` |
| 1023 | Community 1023 | 1 | 0 | 0 | 0 | Size |  |
| 1024 | Community 1024 | 1 | 0 | 0 | 0 | hackathon-rules.md | `docs/hackathon/the_launchpad_challenge/plan/hackathon-rules.md` |
| 1025 | Community 1025 | 1 | 0 | 0 | 0 | nao-local-staff.ps1 | `scripts/nao-local-staff.ps1` |
| 1026 | Custom Model Training | 1 | 0 | 0 | 0 | Model Training Plans Session | `docs/sessions/20260726T172257Z-agentjwork-claude-model-training-plans.md` |

</details>

## Interpretation limits

- Community labels and inferred links are probabilistic; they are navigation aids, not reviewed facts.
- Node and link counts depend on Graphify’s extractors and ignore rules, not just repository size.
- This view does not replace `docs/implemented/biotope/architecture-context.md`, `shared/` contracts, migrations,
  `docs/graph/couplings.yaml`, memory records, or accepted ADRs.
- Historical `docs/archive/` material and this generated file are excluded through `.graphifyignore`.
