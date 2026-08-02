---
title: What Ourobion actually is — measured system truth
summary: The measured state of the system as of 2026-08-02 — test counts, schema, corpus, brain-pipeline output and model status — with every figure taken from executed command output rather than assertion.
type: reference
scope: repo
status: unverified
updated: 2026-08-02
---

**Measured 2026-08-02 against `main` @ `5a5af7c`.**

Every number in this document comes from executed command output. Where something was not measured, it is stated plainly.

> **Read this as a dated snapshot, not current state (re-checked 2026-08-02).** A measurement is only
> true of the revision and the moment it was taken. `5a5af7c` is an ancestor of `main`, which has since
> advanced by **17 commits** to `94a2790`.
>
> **Still accurate at `main` @ `94a2790`** — re-verified: 44 migrations, 4 edge functions
> (`compute-baselines`, `evaluate-signals`, `generate-insights`, `run-pipeline`), 6 GitHub workflows,
> and 24 metrics in the shared registry.
>
> **The mutable figures below were re-measured on 2026-08-03 and HAVE moved.** The
> [`brain-pipeline.yml`](../../.github/workflows/brain-pipeline.yml) workflow completed three
> successful `workflow_dispatch` runs after this snapshot was taken. Superseding values, read
> directly from the hosted database:
>
> | Figure | This snapshot (`5a5af7c`) | Hosted, 2026-08-03 |
> |---|---|---|
> | verified edges | 14 | **11** (10 `high`, 1 `hold`) |
> | current verdicts | — | **1 supported, 10 partial** |
> | relations | 13 correlates, 1 decreases | **4 correlates, 3 no_effect, 2 modulates, 1 decreases, 1 increases** |
> | insight cards | 56 (53 personal / 2 rules / 1 edge) | **59** (53 personal / **5** rules / 1 edge) |
> | cards citing a paper | 1, **archived** | **2, both `active`** |
> | card statuses | active/dismissed/snoozed/archived | only **`active`** and **`dismissed`** now exist |
>
> The section "Why one card, and not fourteen" below is therefore **obsolete** — see the correction
> boxed inside it. Treat the test totals as revision-bound too: per `AGENTS.md` §8, a test count
> without its revision and branch conditions is not reusable evidence. The two "Not Measured" entries
> (D1 index, `rules` visibility) remain open.
>
> The test totals (2,605 pass) are likewise revision-bound: per `AGENTS.md` §8, a test count without
> its revision and branch conditions is not reusable evidence. The two "Not Measured" entries (D1
> index, `rules` visibility) remain open — they were not resolved by this reconciliation.

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

**Exactly 1 of the 56 cards carries an `edge_refs` citation** — and its status is `archived`, not `active`.

That distinction matters and is easy to get wrong. The card exists, was generated 2026-08-01T16:52Z, and is real:

```
rule_id : edge:gut_comfort_score|correlates|mood_score
title   : "Research-linked pattern: Gut comfort and Mood moved together"
status  : archived
```

But because it is archived it does not appear in the active insights deck. A user opening the app to their current insights sees **no** paper-derived card; the app's Archive surface is where this one lives. Any statement that the demo shows a research-backed card in the normal flow would be false.

> **⚠ CORRECTED 2026-08-03 — the paragraph above is no longer true, and it understated the system.**
> Re-measured against the hosted database: **two** cards carry an `edge_refs` citation and **both are
> `active`**, sitting in the normal deck rather than an archive. `archived` is no longer even a card
> status — only `active` and `dismissed` exist now. The two cited cards are:
>
> - `edge:gut_comfort_score|correlates|mood_score` — *"Research-linked pattern: Gut comfort and Mood
>   moved together"* (producer `edge`)
> - `hrv_rise_after_sleep_rise` — *"Recovery pattern: Sleep duration and Heart-rate variability
>   (SDNN) rising together"* (producer `rules`, a hand-authored blueprint that cites a brain edge)
>
> So the opposite of the sentence above now holds: **the demo does show research-backed cards in the
> normal flow.** The section below is retained as the historical record of why that was not the case
> on 2026-08-02.

### Why one card, and not fourteen — *(historical; superseded, see correction above)*

Two things are true at once and both belong in the same breath: **the chain works end to end, and it has so far produced exactly one cited card.**

What is measured: 13 of the 14 verified edges carry the relation `correlates`, and 1 carries `decreases`. The original card rule was directional — it matched only monotonic relations, which `correlates` is not — so for most of the run no correlational edge could produce a cited card at all.

A co-movement rendering path was added specifically to close that gap (`coMovementEdge` in the insight generator), so a correlational edge *can* now render a cited card without inventing a direction it does not have. It is deliberately constrained: it requires a coincidence pattern over exactly the edge's metric pair, with both endpoints observed moving the same way. A sign-free relation licenses nothing about opposite movement, so an up/down pairing correctly gets no card.

**What has not been established here is the precise reason the remaining edges have not yet produced cards** — whether no matching personal pattern exists in the demo user's 60 logged days, or whether another gate intervenes. That would need a per-edge trace, which was not run. It is recorded as open rather than guessed at.

The defensible claim is therefore narrow, and worth stating exactly: every stage of the pipeline has run on real data and produced one real, cited card — which is currently archived rather than in the active deck. Nothing stronger than that sentence is supported.

### What the serving gate does and does not check

Recorded here because it bounds what any cited card actually means.

The gate asks whether a claim is faithful to **the paper it cites** — real quotes, correct scope,
matching effect size. It does **not** ask whether the wider literature agrees. Cross-paper
corroboration, study-design tier and venue impact tier are still computed, still stored, still
projected to `edge_verifications` and still used to rank edges, but as of the 2026-08-01 decision they
can no longer withhold a card.

So a card can be served on the strength of a single paper. The only mechanism carrying that risk to
the user is the verification `caveat` field. This was an explicit owner decision, made after a live
run produced edges where every check against the cited paper passed and only the other-paper signals
were thin — the composite score banded them `hold`, which was a rejection with extra steps.

Two things did **not** change and are worth stating alongside it: retrieval is still mandatory for an
affirmative verdict to exist at all (`enforce.ts` forces `uncertain` when it was not performed), and
the deterministic quote gate remains a required member of the serving gate.

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

> **Updated 2026-08-03.** Re-measured on the hosted database: **two** cited cards out of 59, from 11
> verified edges (10 servable, 1 held) — and unlike the 2026-08-02 snapshot, both cited cards are
> **active**, not archived. The pipeline has since completed three successful cloud runs. Still
> small, and still stated as small; the difference is that the cited cards now reach the deck a user
> actually opens.

The safety properties are the part that is not small. Vendor-family decorrelation between synthesis and verification is enforced in configuration and fails closed, with the escape hatch removed rather than merely unused. Every table carries row-level security. Derived data is rebuildable from inputs rather than hand-maintained.

Where this document does not know something — the D1 index, the `rules` visibility, the per-edge reason more cards have not appeared — it says so instead of estimating.
