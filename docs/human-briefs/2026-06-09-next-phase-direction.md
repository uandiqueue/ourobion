# Human Brief — ourobion Next-Phase Direction

**Date:** 2026-06-09 · **Status:** Approved plan, not yet built · **Tracking:** issue #3 ·
**Detail:** [`../INSIGHTS-ENGINE-DESIGN.md`](../INSIGHTS-ENGINE-DESIGN.md) (engine design) + [`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) (current plan)

*(The next phase = clear the remaining P1S2 backlog first, then the deep health-metric analysis
pipeline. This brief focuses on the analysis pipeline, the headline of the phase.)*

## The problem in one line
Ourobion's health "analysis" today is shallow: only **6 fixed rules**, each looking at **one metric at a
time**, hard-coded into the backend. Adding or changing a rule means a developer editing and redeploying
code, and we **cannot** yet spot patterns that span two metrics (e.g. "energy down **and** gut comfort
down together").

## What we're going to build
A pipeline that turns **health research into rules the app can apply**, in three parts:

1. **Ingest** — read a research paper (PDF) and draft candidate "rules" from it (with a human reviewing
   and approving each one before it counts).
2. **Store rules as data** — keep the approved rules as plain, version-controlled files (the source of
   truth) that load into a database table. Rules become **data you can edit and review**, not code.
3. **An analysis engine** — read those rules and the user's recent data, and generate the insight cards
   users see. It can now handle **cross-metric** patterns, not just single metrics.

Think of it like the sister project **NUSPlan**: it reads official requirement documents into structured,
reviewable rules, then a deterministic engine applies them. We're reusing that proven shape, adapted to
ourobion's database.

## What stays true to ourobion's principles
- **Still non-diagnostic.** Every rule's wording passes the existing "observational language only" check
  in three places. No diagnoses, ever.
- **The engine is deterministic — no AI in the live path.** Same data + same rules = same result, every
  time. AI is used **only** offline to *draft* candidate rules from a paper, and a human approves them.
- **AI-written summaries are a LATER phase.** The engine works fully without any AI. We're explicitly
  **not** building AI summarization now.
- **Raw data stays the asset.** Rules and insight cards are rebuildable views; the user's logged data and
  the rule files are the truth.

## The order of work (important)
The owner's instruction: **the analysis engine comes LAST.** First we set up context tooling and the
rule-ingestion foundations; the engine refactor is the final step. AI summaries come after that.

1. **graphify** (a knowledge-graph helper for managing context) — *design how we'll use it first*, install later.
2. **Rule foundations** — the rule file format, the database table, the loader, the (skeleton) paper-reader, and tests that keep them all in sync.
3. **The engine** — rewrite insight generation to run on the rules table, including cross-metric rules. **(last)**
4. *(Later, separate)* optional AI summaries of the generated insights.

## What changes for users (eventually)
Richer, more relevant insight cards — including ones that connect **two** signals — that the team can
expand by adding rule files instead of shipping code. No change to the non-diagnostic, gentle tone.

## What we need from the owner
- **The research paper(s).** The rule-drafting step is built as a ready-but-idle skeleton until a paper is
  provided. Everything else can proceed without it.
- A couple of small confirmations (where the graph files live; rules stay backend-only; how often rules
  reload). Defaults are proposed in the plan.

## Main risks / watch-items
- **Scope:** this is a multi-session effort. We deliberately chunk it (foundations → engine → AI later).
- **Cross-language sync:** the rule format is a shared contract (needs 2 reviewers) and the non-diagnostic
  wording check is duplicated for the backend runtime — both are kept honest by automated guard tests.
- **Cost (later):** the paper-reading step uses a paid AI model — it ships with a hard budget cap, a cheap
  default model, and usage logging.
- **Reference gap:** we have NUSPlan locally but **not** the other sister repo (aeroplus-datum); some
  patterns are taken second-hand from NUSPlan's notes.
