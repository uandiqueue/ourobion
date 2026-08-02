---
title: Ourobion — project summary
summary: A standalone overview of what Ourobion is, how the research loop works, what is actually built and measured as of 2026-08-03, and what is deliberately not claimed — written for a reader arriving at the submission with no prior knowledge of the codebase.
type: reference
scope: repo
status: unverified
updated: 2026-08-03
---

# Ourobion — project summary

Companion to [`writeup.txt`](./writeup.txt), which is the 1,000-word judge-facing submission, and
[`appendix.md`](./appendix.md), which carries the evidence table. This page is the middle layer: the
whole picture in one read, without assuming the codebase.

Every figure below was measured, not asserted. Mutable figures carry the date they were read.

## What Ourobion is

Ourobion is a **non-diagnostic One Health personal health monitor** for the ASEAN market. A person
logs a small set of high-yield daily signals — gut comfort, hydration, behaviour, and optionally a
bounded set of wearable readings — and the system surfaces descriptive patterns in their own data.

It never diagnoses. Every user-facing string is observational by construction, enforced in code
rather than by review convention.

The thing that distinguishes it from a logging app is the layer underneath: a **research pipeline
that reads scientific papers and turns them into relationships between health measures**, each one
traceable back to the paper it came from and to the review that let it through.

## The problem we set out to solve

Health apps collect well and explain badly. After weeks of logging, most return a person's own
numbers to them. Explaining *why* a pattern might matter requires reading the literature — which is
what a health company hires a research department to do.

The obvious shortcut is to attach a language model and ask it. That is also the most dangerous thing
to put in front of a health claim: models state correlations as causes, reverse direction, and
generalise a mouse study onto a person. The hard part is not model access. It is **grounding the
interpretation when the best available tool is the least trustworthy component**.

## How the loop works

The design borrows from patient safety: no single check is trusted, so imperfect checks are stacked
until their holes stop lining up (Reason's Swiss-cheese model).

1. **Papers are discovered and retrieved** from open-access sources, given a stable identity, and
   stored in Cloudflare R2 with their extracted full text.
2. **A synthesis model drafts a relationship** between two health measures from one paper's text,
   carrying the exact quoted spans it rests on.
3. **Deterministic code checks the quotes** actually appear in the source paper, before any reviewer
   time is spent.
4. **An adversarial reviewer from a different vendor re-checks it**, prompted to refute rather than
   confirm, and required to retrieve its own evidence.
5. **A numeric serving gate** decides whether the relationship may reach a person: serve, serve with
   a qualifier, or withhold.
6. **A non-diagnostic language check** runs on the copy before anything is displayed.

Any layer can stop the run. Two of these are enforced in code rather than prompted:

- **Independent retrieval is mandatory.** If the reviewer did not fetch its own sources, the verdict
  is forced to `uncertain` — a "supported" verdict is unreachable
  ([`enforce.ts`](../../../../tools/brain-ingest/src/verify/enforce.ts)).
- **Vendor decorrelation fails closed.** The router resolves each model's vendor family at load; a
  model whose family cannot be determined throws rather than being assumed independent, and the
  `testMode` block that once downgraded this to a warning was removed, so a configuration still
  carrying one is refused
  ([`config.ts`](../../../../tools/llm-router/src/config.ts)).

Models are used only where interpretation is genuinely needed. Identity, quotation checking,
budgets, routing, copy constraints, and release are deterministic code that must behave identically
on every run.

## The three surfaces

| Surface | What it is |
|---|---|
| **Biotope** | The Flutter phone app — daily logging and the insight cards a person actually reads. |
| **Nao** | The research workbench, a Next.js app on an OpenNext Cloudflare Worker. Every proposed relationship can be opened to see its claim, quoted spans, citation, verdict, and the decision that followed. |
| **The site** | A static showcase page for `www.ourobion.com` ([`apps/site/`](../../../../apps/site/)) — a presentation surface, not an evidence source. |

Biotope and Nao **never call each other**. They meet only through shared identity, shared contracts
in [`shared/`](../../../../shared/), and a Postgres view of reviewed relationships. Nao's dashboards
read the research side only; membership in Nao grants no authority over anyone's personal health
rows.

## What is actually built — measured 2026-08-03

**Structure.** 45 database migrations with row-level security throughout; 4 Supabase edge functions
(`compute-baselines`, `evaluate-signals`, `generate-insights`, `run-pipeline`); 6 GitHub Actions
workflows; 24 metrics in the shared registry; 8 hand-authored rule blueprints, all uncited and
marked as such.

**Corpus.** 21,824 records discovered, 14,726 identified as open access, **911 with full text
extracted**, 894 of those over 5,000 characters. Discovery is not the achievement — extraction is
what the pipeline can actually read.

**The research loop, read from the hosted database.** 11 drafted relationships carried through to 11
reviewed edges. Current verdicts: 1 supported, 10 partial. **Ten clear the serving gate; one is
held back.** By relation: 4 correlates, 3 no-effect, 2 modulates, 1 decreases, 1 increases — the
no-effect results are kept rather than discarded.

**It runs unattended in the cloud.** The pipeline is dispatched from Nao to GitHub Actions, because
a Worker cannot hold a long run inside a web request. It has **completed successfully three times**,
most recently 2026-08-02T17:08Z. Three earlier runs failed and were fixed rather than hidden; the
failures remain in the public Actions history.

**It reaches a person.** Clearing the gate makes a relationship *eligible*, not visible — it surfaces
only when it also matches that person's own data. Of 59 insight cards on the demonstration profile,
**two cite a paper, and both are in the active deck** rather than an archive.

## The research models

Two small checkpoints were trained during the challenge, both on **local Apple Silicon** after the
requested GPU container did not arrive.

| Model | Task | Result |
|---|---|---|
| **Zebra v1** | does the evidence support the claim? | macro-F1 **0.599 ± 0.008** against a **pre-registered bar of 0.70** — it **failed**, and the code refuses to promote it |
| **Viceroy v0** | causal or merely correlational wording? | macro-F1 **0.866** against a keyword baseline of **0.507** |

Viceroy's figure carries an **unquantified optimistic bias**: exact-duplicate and boilerplate leakage
were controlled, but same-paper leakage could not be, because the released dataset ships no paper
identifier. It was measured on one frozen holdout, not completed cross-validation.

Both models were compared against Claude Haiku 4.5 on 96 real papers and disagreed substantially.
That comparison has **no adjudicated ground truth**, so it measures disagreement, not accuracy.

**Neither model serves the product.** Both remain `validated=false`, `serving_ready=false`,
`public_weights_cleared=false`. Three further models remain planned and untrained. Evidence is not
serving permission.

## What we do not claim

- **"Verified" is narrow.** It means a claim faithfully reads the paper it cites. It does not mean
  the wider literature agrees, and it is not clinical validation.
- **The full pipeline has not been compared against a single-call baseline.** Viceroy has a
  baseline; the reviewer does not yet.
- **Ten relationships are eligible but only two have surfaced.** We have not traced why the other
  eight have matched nobody's data.
- **The demonstration account's health data is seeded**, and so are the cards computed from it. Both
  are marked as simulated in the database itself, not merely described that way here. The engine and
  the relationships behind those cards are real; the readings are not anyone's record.
- **Environmental ingestion and the community surface are not built.** Neither has a migration.
- **iOS is unbuilt** — it needs a Mac and a paid Apple Developer account.
- Ourobion is non-diagnostic and is not a medical device.

## Inspecting it yourself

The [root README](../../../../README.md) is the front door: reviewer credentials, the Android demo
build, and the guided route through the repository. Nao is at `nao.ourobion.com`; the corpus, every
drafted relationship, and every verdict are open to inspection there.

Test totals and hosted counts are revision-bound. Where this document gives a number, it gives the
date it was measured — and where something was not measured, it says so instead of estimating.

## Team

Jayden (Project Lead & Systems Architect), Alton (Product Design & Submission Lead), and Janson
(Development Enablement & Technical Support). Three builders; unable to hire a research department,
we grew one.
