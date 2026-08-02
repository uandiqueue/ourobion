---
title: What Ourobion actually is — measured system truth
summary: The measured state of the system as of 2026-08-02 — test counts, schema, corpus, brain-pipeline output and model status — with every figure taken from executed command output rather than assertion.
type: reference
scope: repo
status: canonical
updated: 2026-08-02
---

**Measured 2026-08-02 against `main` @ `5a5af7c`.**

Every number in this document comes from executed command output. Where something was not measured, it is stated plainly.

## Test Coverage

The system is proven by 2,605 passing tests across five suites, with no failures:

| Suite | Count | Status |
|-------|-------|--------|
| biotope (Flutter) | 827 pass, 26 skipped | all pass |
| nao (Node 26) | 407 pass, 1 skipped | all pass |
| node tools (6 packages) | 993 pass total | all pass |
| root suites (3 packages) | 78 pass | all pass |
| model-training (Python) | 300 pass | all pass |
| **TOTAL** | **2,605 pass, 27 skipped** | **0 failures** |

The shared package (`shared/`) carries no runtime test script. Its exports are validated by `tsc --noEmit` (clean) and its `.typetest.ts` files are compile-time assertions.

## Infrastructure Schema

**Database:** 44 migrations deployed, resulting in 31 tables. All tables have row-level security enabled: 63 RLS policies in total.

**Compute:** 4 edge functions deployed to Supabase (compute-baselines, evaluate-signals, generate-insights, run-pipeline).

**CI/CD:** 6 GitHub workflows.

**Metrics:** 24 metrics defined in the shared registry (read from the exported `METRICS` array).

## The Brain Pipeline: End-to-End Working with Limited Output

The brain pipeline completes all stages and produces measurable output. However, the output volume is constrained by upstream architecture, not pipeline failure.

### Pipeline Input: Verified Edges

The system ingests and verifies the following edges:

- **14 verified edges** drawn from relationship claims
- **Composition:** 13 edges carry the relation `correlates`; 1 carries `decreases`
- **Baseline infrastructure:** 14 baseline snapshots; 60 daily gut rows logged

### Pipeline Output: Cards and Citations

The pipeline generates 56 insight cards:
- 53 produced by the personal feed engine
- 2 produced by the rules engine
- 1 produced by the verified-edge engine

**Critically, exactly 1 of the 56 cards carries an `edge_refs` citation.** This is the only user-visible card in the hosted demo that is cited to a verified edge.

### Why one card, and not fourteen

Two things are true at once and both belong in the same breath: **the chain works end to end, and it has so far produced exactly one cited card.**

What is measured: 13 of the 14 verified edges carry the relation `correlates`, and 1 carries `decreases`. The original card rule was directional — it matched only monotonic relations, which `correlates` is not — so for most of the run no correlational edge could produce a cited card at all.

A co-movement rendering path was added specifically to close that gap (`coMovementEdge` in the insight generator), so a correlational edge *can* now render a cited card without inventing a direction it does not have. It is deliberately constrained: it requires a coincidence pattern over exactly the edge's metric pair, with both endpoints observed moving the same way. A sign-free relation licenses nothing about opposite movement, so an up/down pairing correctly gets no card.

**What has not been established here is the precise reason the remaining edges have not yet produced cards** — whether no matching personal pattern exists in the demo user's 60 logged days, or whether another gate intervenes. That would need a per-edge trace, which was not run. It is recorded as open rather than guessed at.

The defensible claim is therefore narrow and worth stating exactly: every stage of the pipeline has run on real data and produced a real, cited, user-visible card. One of them.

## Paper Corpus: Discovery Manifest vs. Extracted Text

The corpus is stored as a discovery manifest in Cloudflare R2 (bucket `ourobion-corpus`, object `manifest/papers.jsonl`):

| Count | Category |
|-------|----------|
| 21,824 | Total manifest rows (discovery scope) |
| 14,726 | Open access (of manifest scope) |
| 911 | Full text extracted (status: `fetched`) |
| 894 | Substantial: >5,000 characters |
| 874 | Substantial: >10,000 characters |

**Extraction breakdown:** jats 608, pdf 291, directOa 8, core 4.

**Critical clarification:** These numbers represent a discovery manifest, not 21,824 usable full texts. The honest summary is: **911 papers with extracted full text, 894 of them substantial (>5,000 characters), drawn from a 21,824-row discovery manifest of which 14,726 are open access.**

## Model Decorrelation and Safety

The system enforces independent model vendors to prevent synthesis-verifier collusion:

- **Synthesis node:** gpt-5 (vendor family: openai)
- **Verifier node:** agnes-2.5-flash (vendor family: agnes)
- **Status:** Decorrelation OK — confirmed by running `llm-router check-config`

The `testMode` configuration escape hatch that could downgrade this guarantee was removed in release R4-U3. There is no path in current code to disable vendor-family enforcement.

## Not Measured or Not Built

| Item | Status |
|------|--------|
| Cloudflare D1 search index (ourobion-nao-index) | No API token available on measuring machine; not verified |
| `rules` table visibility | Returned 0 rows to the querying role; a hosted session log records 8 rules loaded. Most likely RLS scoping. Status: unresolved. |

## Summary

The two consumer-facing surfaces, the schema and the tooling are built and exercised by 2,605 passing tests with none failing. The brain pipeline has run every stage on real data — a corpus fetched and extracted, claims synthesised, verdicts produced by a verifier on a different vendor family, edges projected, and a card rendered and cited back to its evidence.

It has produced **one** such card, out of 56 cards and 14 verified edges. That is small, and it is stated here as small. What it is not is theoretical: the path from a paper in the corpus to a sentence a user reads has been walked, end to end, and it holds.

The safety properties are the part that is not small. Vendor-family decorrelation between synthesis and verification is enforced in configuration and fails closed, with the escape hatch removed rather than merely unused. Every table carries row-level security. Derived data is rebuildable from inputs rather than hand-maintained.

Where this document does not know something — the D1 index, the `rules` visibility, the per-edge reason more cards have not appeared — it says so instead of estimating.
