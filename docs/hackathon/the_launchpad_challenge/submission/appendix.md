---
title: Ourobion — Launchpad 2026 submission appendix
summary: Evidence backing each claim in writeup.txt — corpus, verdicts, model results, judge access, and the boundary between prior work and what was built during the challenge — written for a reader who has not seen the codebase. Appendices do not count against the 1,000-word cap.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# Appendix — From papers to product

Companion to [`writeup.txt`](./writeup.txt). Per the event rules, appendices do not count against the
1,000-word write-up cap. Citations live in [`references.md`](./references.md).

This document is written to be read without prior knowledge of the codebase. Where a technical term
is unavoidable it is defined in the [Glossary](#glossary) at the end.

For the fuller argument behind the layered design, and the complete reports on the two models we
trained, see [`research-models.md`](../plan/research-models.md) — it carries the Swiss-cheese
reasoning, the exact preregistered gates each model was measured against, and the limitations we do
not think a summary can fairly compress.

## Two words used throughout

A **relationship** is a single claimed link between two health measures — for example, *lower
hydration is associated with lower gut comfort* — drafted from one paper and carrying the exact
quotes it rests on. In the codebase these are stored as "edges."

The **serving gate** is the automatic check that decides whether a relationship is allowed to reach a
person. It reads the reviewer's verdict and confidence and returns serve, serve-with-qualifier, or
withhold. It is ordinary deterministic code, not a model.

## Evidence

| Claim in the write-up | What backs it | Where to look |
|---|---|---|
| A supported verdict requires fresh retrieval and a reviewer from a different company | Both halves are enforced in code, not policy. **Retrieval:** if the reviewer did not fetch its own sources, the verdict is forced to `uncertain` — it cannot return "supported" at all. **Decorrelation:** the router resolves each model's vendor family at load and *fails closed* — a model whose family cannot be determined throws rather than being assumed independent, and the `testMode` block that once downgraded this to a warning was removed, so a config still carrying one is refused outright. | [retrieval enforcement](../../../../tools/brain-ingest/src/verify/enforce.ts) · [router decorrelation guard](../../../../tools/llm-router/src/config.ts) · [router configuration](../../../../tools/llm-router/router.config.json) · [decision record](../../../memory/0012-brain-adversarial-edge-verification.md) · [Reliability by layers](../plan/research-models.md) |
| The corpus holds full text for 911 papers | 911 papers have machine-extracted full text; 894 of those exceed 5,000 characters. A wider 21,824 records were discovered and 14,726 identified as open access, but discovery is not the achievement — extraction is what the pipeline can actually read. | [Corpus tiers](../../../implemented/system-truth.md#paper-corpus-discovery-manifest-vs-extracted-text) |
| Eleven relationships, one withheld | Measured against the hosted database on **2026-08-03**: 11 drafted relationships, 11 carried through to reviewed edges. Current verdicts are 1 supported and 10 partial. **Ten pass the serving gate; one is held back and is not shown to anyone.** By relation: 4 correlates, 3 no-effect, 2 modulates, 1 decreases, 1 increases — including three the reviewer judged to show *no* effect, which are kept rather than discarded. | [Router configuration](../../../../tools/llm-router/router.config.json) · [nao](https://nao.ourobion.com) |
| The research pipeline runs end to end, in the cloud, on demand | It is not a local script. The pipeline is dispatched from nao as a GitHub Actions run — the dashboard cannot execute it inside a web request, so it hands the work to a scheduled job — and it has **completed successfully three times**, most recently 2026-08-02T17:08Z. A completed run drafts relationships from paper text, has them reviewed by a model from a different company, and projects the survivors into the database the app reads. The result is visible at the far end: **two insight cards in the demo profile's active deck cite a paper**, rather than sitting in an archive. Three earlier runs failed and were fixed rather than hidden; the failures are in the same public Actions history. | [`brain-pipeline.yml`](../../../../.github/workflows/brain-pipeline.yml) · [dispatch authorization](../../../memory/0018-cloud-verifier-authorization.md) · [nao](https://nao.ourobion.com) |
| Viceroy beat its baseline; Zebra failed its bar | Viceroy scored 0.866 against 0.507 for a keyword-matching baseline (macro-F1), measured on one fixed test set rather than repeated cross-validation. **That 0.866 carries an unquantified optimistic bias**: exact-duplicate and boilerplate leakage were controlled, but *same-paper* leakage could not be — the released dataset ships no paper identifier, so sentences from one paper may fall on both sides of the split. We record this because the bundle's own leakage note instructs anyone quoting the number to say so. Zebra scored 0.599 ± 0.008 against a bar of 0.70 written down before training — it failed, and a flag in the database blocks it from ever being used in the product. Both disagreed with Claude Haiku 4.5 on 96 real papers (42.7% and 47.9% of items; Cohen's kappa 0.236 and 0.205) with no adjudication, so that number measures disagreement, not correctness. | [Model reports](../plan/research-models.md#part-2-the-research-models) · [publication results](../../../../model-training/evidence/publication-results/README.md) |
| Judges can inspect all of it | **One credential opens both products: `test@ourobion.com` / `test123`.** **It is view-only in both.** In nao it has viewer authority — it can read the research surfaces but cannot approve, reject, or edit anything. In biotope it opens a demonstration profile so trends and research-backed cards can be inspected without logging for weeks; it cannot add logs or change the profile, so what one judge sees is what the next judge sees. A self-created account starts empty until the user logs, by design. **The health data behind that profile is seeded — see the row below.** | [README](../../../../README.md) |
| The demo account's health data and its cards are **seeded**, and no nao figure is derived from them | Every one of the demo account's 60 daily self-report rows and 60 wearable rows is **marked as simulated in the database itself** — `daily_gut_rows.data_origin = 'simulated:run4-demo'`, and the same marker on `wearable_daily.source`. `NULL` in that column means real user-entered data; the demo account has **zero** unmarked rows, so simulated and real data are separable by query rather than by our word. The insight cards on that profile are computed from those seeded rows, so **the cards are seeded-derived too** — the engine, the rules and the verified relationships behind them are real, but the readings they describe are not, and they are not any person's record. **Nothing on the nao dashboard counts or reports this data.** nao's surfaces read the research side — `relationship_claims`, `verified_edges`, `gap_ledger`, `ingestion_seeds`, the router spend/status tables — so no corpus, claim, verdict or edge figure anywhere in nao is derived from seeded health rows. The one place nao touches health tables at all is its demo loader, which *writes* the simulated days and stamps that marker; it is a recorded product-envelope deviation, not a reporting path. | [`data_origin` migration](../../../../supabase/migrations/20260724120000_add_daily_gut_rows_data_origin.sql) · [simulation provenance](../../../../supabase/migrations/20260729010000_nao_simulation_provenance.sql) · [nao has no cross-user health authority](../../../memory/0021-nao-membership-is-not-health-data-authority.md) |
| Costs are constrained, not assumed | Each constraint is a piece of code, not an intention. **Paid once, reused:** a file-backed per-source cache stores lookups — including negative answers, since "no source known for this ISSN" is itself an answer worth not re-buying. **Hard spending stop:** the router carries a `hardStopFraction` (0.95 shipped) and *refuses* the call that would cross it, rather than logging an overspend after the fact. **Memory ceiling:** a guard added after a run exhausted a machine's RAM. **Worker CPU limit:** the dashboard runs on a Cloudflare Worker with a per-request CPU cap, so long runs are dispatched to GitHub Actions instead of being forced into a web request. | [retrieval cache](../../../../tools/brain-ingest/src/venue/cache.ts) · [spend hard-stop](../../../../tools/llm-router/src/config.ts) · [memory guard](../../../../tools/brain-ingest/src/limits/memoryGuard.ts) · [worker target](../../../../apps/nao/open-next.config.ts) · [dispatched pipeline](../../../../.github/workflows/brain-pipeline.yml) |
| Both models trained locally | An H100 GPU container was requested from GMI Cloud on 27 July and did not arrive within the challenge window. The sponsor credit also covered hosted inference and CPU rather than a custom training job, so it would not have paid for this work in any case. Both models were therefore trained on local Apple Silicon, which bounded how large they could be and why Viceroy has one fixed test set rather than completed cross-validation. | [Training plans](../../../development/model-training/) |
| Simpler options were chosen where they won | The first ingestion control design — leaving a request file in object storage for a worker to notice — was abandoned because it could not actually start a run; a scheduled job replaced it. A dedicated graph database (Neo4j) was dropped in favour of a plain database lookup, because at a few dozen relationships a graph database is complexity without benefit. | [Direction doc §0.5](../plan/hackathon-direction.md) |
| Third-party work is credited | Models, datasets, platforms, code, fonts, and assets, plus the public record of mistakes found along the way. | [ATTRIBUTION.md](../../../../ATTRIBUTION.md) · [correction log](../../../development/what-we-got-wrong.md) |

### Want a populated account of your own?

`test@ourobion.com` is shared and deliberately frozen, so no judge can disturb what the next one
sees. If you would rather explore a **separate account pre-loaded with seeded health data** — enough
history for baselines, trends and insight cards to appear immediately, without logging for weeks —
email **agent.j.work@gmail.com** and we will provision one for you. Its data will be seeded and
marked as such in exactly the same way; we are offering convenience, not different evidence.

## What existed before, and what is new

The rules require this boundary to be stated plainly. It is checkable in commit dates rather than
taken on our word: commit dates are recorded when the work is done, and branches were merged without
squashing, so the original timeline survives in the history.

```bash
git log --until=2026-07-03 --oneline | wc -l   # 117 — prior work
git log --since=2026-07-03  --oneline | wc -l   # 700 — the delta
```

Boundary commit: `b5ad0f4`, 3 July 2026. No baseline tag was pushed, so the date is the boundary.

### Prior work — before 3 July 2026, 117 commits

- **The biotope app** — sign-in, daily self-report logging, personal baselines, insight cards driven
  by hardcoded rules, and the engagement loop.
- **The measurement platform** — the catalogue of health measures, data-quality scoring, and the
  checks keeping the phone app and the backend agreeing on the same definitions.
- **The research contract** — the shared data shapes and gating rules a relationship must satisfy.
  Written, but no relationship had yet been produced: the count at this point was zero.
- **Paper ingestion** — finding papers, removing duplicates, retrieving open-access full text, and
  storing it.
- **nao v1** — a dashboard for searching and inspecting paper metadata.
- Design and decision documents for all of the above.

### The delta — 3 July to 2 August 2026, 700 commits

| Area | What was built during the challenge |
|---|---|
| Request routing | A router that sends each step to a chosen model provider, refuses to run when drafter and reviewer share a company, caps daily spend, and records the prices actually charged rather than the prices we assumed. |
| Drafting relationships | An agent that decides which research questions to ask, the step that turns a paper into a drafted relationship, and a deterministic check that every quoted span really appears in the source paper before any reviewer time is spent. |
| Independent review | The adversarial reviewer itself: a model from another company, prompted to refute rather than confirm, required to fetch its own sources, and defaulting to "uncertain" when it cannot ground the claim. Agnes fills this role. |
| Storing and serving | The store of reviewed relationships, the projection that turns them into something the app can read, and the move of insight rules out of code and into version-controlled data files. |
| Insight engine | Detecting signals in a person's data, evaluating them, composing card text, and the card's life cycle — including a single relationship carried end to end from paper to a card in the app. |
| nao | The research dashboard rebuilt: paper search backed by a proper index, sign-in with a read-only viewer role, views onto the pipeline, and the evidence trail behind each relationship. |
| biotope | A full interface revamp — home screen, signal detail views, archive and trends, wearable labels — plus migration to a hosted demonstration environment. |
| Model training | The training setup, two models trained and evaluated (Zebra and Viceroy), a runner for using them offline, published results, and the deliberate decision not to ship either. |
| Corpus | Expansion to 911 papers with extracted full text, and the tooling to assemble a corpus suitable for real verification runs. |
| Safety and provenance | Signed records of what each automated run changed, secret scanning, and checks that stop a run on failure rather than continuing past it. |

Each working block is logged in [`docs/sessions/`](../../../sessions/); 229 of those logs fall inside
the challenge window, and each records what was attempted and what actually landed.

## Not claimed

- The full pipeline has **not** been compared against a single-call baseline. Viceroy has a baseline;
  the reviewer does not yet.
- The Viceroy and Zebra disagreement with Claude Haiku 4.5 is **unadjudicated** — nobody decided who
  was right, so it measures disagreement, not correctness. Neither model is used in the product.
- **"Verified" is narrow.** It means a claim faithfully reads the paper it cites. It does not mean
  the wider literature agrees, and it is not a clinical validation.
- The demonstration profile's health logs are **seeded**, and so are the insight cards computed from
  them. Both are marked as simulated in the database (`data_origin = 'simulated:run4-demo'`), not
  merely described as such here. The engine, the rules and the reviewed relationships behind those
  cards are real, but no claim is made that the readings describe a real person or that the pattern
  held for anyone. No figure reported anywhere in nao is derived from this data.
- Ourobion is non-diagnostic and is not a medical device.

## Glossary

| Term | Meaning |
|---|---|
| **Relationship** ("edge") | One claimed link between two health measures, drafted from a single paper, carrying the quotes it rests on. |
| **Serving gate** | The deterministic check that decides whether a relationship may reach a person: serve, serve-with-qualifier, or withhold. |
| **Model family / company** | Models from one company share training data and methods, so they tend to share blind spots. Requiring the reviewer to come from a different company is what makes the second opinion worth having. |
| **Macro-F1** | An accuracy score for classifiers that averages performance across all categories, so a rare category counts as much as a common one. 1.0 is perfect; a coin flip on balanced classes is near 0.5. |
| **Keyword-matching baseline** | The simplest possible comparison: decide by looking for tell-tale words. Viceroy had to beat it to be worth training. |
| **Cohen's kappa** | Agreement between two labellers, corrected for agreement that would happen by chance. 0 is chance-level; 1 is perfect. The 0.21–0.24 we measured is weak agreement. |
| **Held-out test set** | Data set aside before training and never learned from, used once to measure. Weaker evidence than repeated cross-validation, which we did not complete for Viceroy. |
| **Pre-registered bar** | A minimum score written down *before* training, so pass or fail could not be chosen after seeing the result. Zebra's was 0.70; it scored 0.599. |
| **Open access** | Papers licensed so their full text can be lawfully retrieved and stored. The pipeline only ingests these. |
| **Cloudflare Worker** | A hosting model that runs code close to users but caps CPU per request — which is why long ingestion runs are handed to a scheduled job instead. |
