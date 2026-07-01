# nao brain pipeline & self-trained models — DECISION

**Date:** 2026-07-01 · **Status:** ✅ **DECISION — adopted 2026-07-01; this brief is the anchor (source of truth).**
**Detail:** [`../nao/BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) ·
[`../nao/BRAIN-INGESTION-DESIGN.md`](../nao/BRAIN-INGESTION-DESIGN.md) ·
[`../biotope/INSIGHTS-ENGINE-DESIGN.md`](../biotope/INSIGHTS-ENGINE-DESIGN.md) ·
[`../nao/BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md)

**Audience:** whoever is deciding how ourobion's brain pipeline is built and how the hackathon's GMI
training credits get spent.
**Question this brief answers:** is the proposed multi-agent brain pipeline the right shape, and — for
the three self-trained models we want — *what data actually goes in to train each one*?
**Method:** evaluation against the current design (`BRAIN-DESIGN.md`, `BRAIN-INGESTION-DESIGN.md`,
`INSIGHTS-ENGINE-DESIGN.md`, the `shared/brain/` + `shared/metrics/` contracts) + known public ML
datasets for scientific claim verification and biomedical relation extraction (mid-2026).

> **This is an adopted decision and the anchor** for how the brain pipeline is built — the agent roster
> (agentic seeder; two decorrelated LLMs: synthesis + verifier; a runtime presentation agent), the four
> small support models, and the **`verified_edges` truth store → Neo4j projection**. Where a design doc
> disagreed, the doc was reconciled to this anchor. Durable record:
> [memory 0013](../memory/0013-brain-pipeline-and-support-models-decision.md).
>
> **Docs reconciled (2026-07-01):** BRAIN-DESIGN (verifier-model + persistence open-decisions resolved),
> BRAIN-INGESTION-DESIGN (agentic seeder supersedes the static seed list), NAO-DESIGN (edge-store shape +
> source-reliability standard defined), INSIGHTS-ENGINE-DESIGN + PHASE2-PLAN (presentation agent named),
> BRAIN-MODELS-TRAINING (support-model recipes).

---

## 1 · Verdict at a glance

**The proposed pipeline's spine is right; it is over-agentified.** Of the ~6 agent roles sketched, only
**two are genuinely LLM work** (synthesis + adversarial verification) plus **one worth adding** (an
agentic seeder). The rest should stay deterministic — which is cheaper, safer, and (usefully for the
hackathon) a *stronger* agentic-app story: "we constrain the LLM to exactly two adversarial agents."

| Proposed step | Verdict | Note |
|---|---|---|
| brain agent reads biotope → synthesises research keywords | 🔁 **Keep, split out** | Genuinely agentic and an *improvement* over today's static seed list; required to scale to 360 metrics. Make it a standalone **planner/seeder agent**. |
| research agent "utilises ingestion pipeline" | ⚠️ **Not an agent** | Ingestion (`tools/brain-ingest/`) is deterministic TS: discovery → dedup/`paper_uid` → OA-location → fetch → R2. |
| conversion agent (haiku) → agent-readable text | ❌ **Drop** | JATS/CORE `fullText`/`unpdf` extract clean text deterministically; an LLM here adds error + cost. |
| research agent extracts rules from paper | ✅ **Keep = synthesis LLM** | Highest hallucination surface → strongest model. |
| verification agent stress-tests (citation + secondary sources) | ✅ **Keep = verifier LLM** | Preserve ordering: deterministic `quoteCheck` first (free), then verifier with **independent retrieval** + adversarial refutation. Use a **different model family** than synthesis. |
| verification "sends rules back" | ⚠️ **Graded, not binary** | Emits structured evidence → `edgeScore` → `servingBand (high/mid/hold)`; don't collapse to pass/fail. |
| brain agent "fits into DB + rebuilds Neo4j" | ⚠️ **Not an agent** | Deterministic projection job. `verified_edges` store = truth; Neo4j = rebuildable projection. |
| insights *engine* fires rules at runtime | ⚠️ **Keep deterministic** | The engine decides *what fires and the numbers*; the non-diagnostic copy gate depends on this. Not an LLM. |
| presentation agent (curated summaries, template copy) | ✅ **Keep — legitimate 3rd LLM role** | Grounded (renders only facts handed to it), gated (copy_guidelines at render), cached, degradable. Already in `INSIGHTS-ENGINE-DESIGN` (grounded synthesis + weekly summary). Haiku-tier. |
| *(missing)* human-in-the-loop curation in nao | ➕ **Add** | Agent proposes edge → curator approves. Best agentic-app demo angle. |
| *(missing)* `paper_uid` dedup spine, metered-API budget guardrails | ➕ **Add** | Already designed (ingestion §4, §5.1); the sketch omits them. |

**Net roster:** 3 LLM roles — synthesis + verifier (decorrelated, ingestion-time) + presentation
(runtime, grounded) — plus 1 agentic seeder and the nao curation loop.

---

## 2 · Pipeline evaluation, decision-by-decision

**2.1 Agentic seeding — the one genuine upgrade.** Today discovery runs off a static seed list
(`src/seeds.ts`) + the metric registry keys. An agent that reads the **metric registry** (esp.
`derivedFrom[]`, which already encodes candidate relationships) plus biotope's insight needs and emits
targeted research queries is a real improvement and is what makes 360 metrics tractable. This is where
"agentic" earns its keep.

**2.2 Keep the LLM surface at two steps.** The design's core discipline is that the LLM is the highest
hallucination surface, so it's minimized to synthesis + verification and its cost is paid once at
ingestion. Turning ingestion/conversion/projection/runtime into agents reverses that: more cost, more
nondeterminism, more hallucination surface, no benefit. Text extraction especially must stay
deterministic — an LLM "conversion agent" is strictly worse than JATS/CORE/`unpdf`.

**2.3 Verification must be *independent* and *adversarial*, in that order.** The schema
(`relationships.schema.ts`) already enforces the property that makes the second pass non-theatre: a
verdict of `supported`/`contradicted` **requires `independentRetrieval.performed === true`** — no
independent retrieval ⇒ verdict can only be `uncertain`. The cheap deterministic `quoteCheck` runs
*before* the verifier LLM spends a token. Synthesis and verifier should be **different model families**
— error decorrelation is the entire justification for a second pass.

**2.4 Trust is graded.** `EdgeVerification` carries one field per failure mode (`directionCheck`,
`claimKindCheck.supportedKind`, `scopeCheck`, `effectSizeCheck`) plus `confidence` and `evidenceTier`,
rolled up by `edgeScore()` → `servingBand()` (high ≥0.8 / mid ≥0.5 / hold). Contradicted edges are
suppressed *and* flagged `needsReview`. Don't reduce this to a boolean gate — the graded score is what
lets the product serve "limited-evidence" edges with a qualifier and route the rest to humans.

**2.5 Truth vs projection.** The `verified_edges` store is truth; Neo4j is a projection rebuilt by a
sync job. Losing Neo4j costs only a re-projection. The sketch treats Neo4j as the DB — keep the split.

**2.6 Model tiers.** Three LLM roles, on two different clocks. **Ingestion-time (paid once, amortized):**
the strongest/highest-reasoning model for **synthesis**; a **different family** for **verification**
(decorrelation). No haiku conversion/ingestion agent — extraction is deterministic. **Runtime
(per user, per view):** a haiku-tier **presentation agent** (§2.7). The insights *engine* itself stays
deterministic — it decides what fires and the numbers; the LLM never does.

**2.7 The presentation agent — valuable, with one hard line.** Turning deterministic insight cards into
readable, warm, non-clinical prose (curated summaries, populated template copy) is high-value UX and is
already the "grounded synthesis / weekly summary" layer in `INSIGHTS-ENGINE-DESIGN`. The rule that keeps
it safe: **separate *what is true* from *how it is shown*.** The engine owns the facts; the presentation
agent only rephrases and arranges them. Concretely:

- **Grounded** — input is the deterministic trend package + retrieved brain subgraph; it may introduce
  **no** relationship, threshold, or number not in that input (same guardrail as W2 synthesis).
- **Gated** — free text is the highest risk of implying diagnosis with zero forbidden words, so its
  output runs through `copy_guidelines` at render like every user-facing string.
- **Cached + fire-triggered** — unlike ingestion, this runs per-view, so generate on insight-fire (not
  every render) and cache (a week's summary is stable) to keep haiku-tier cost flat at scale.
- **Degradable** — model down/slow ⇒ fall back to deterministic templated copy (graceful degradation is
  a product principle); the summary layer is never on the safety path.
- **Template *selection* stays deterministic** — data-shape → template is a lookup; the LLM fills the
  template's prose slots, it does not choose chart types.

---

## 3 · The three self-trained models — what data goes in

**Headline: do not train from in-house data — it does not exist.** The contracts define perfect labels
(`verdict`, `supportedKind`, `directionCheck`, `evidenceTier`…) but there are **zero edge/verification
instances** and only ~190 papers. Generating labelled data in-house means running the very
synthesis+verification LLM pipeline these models are meant to cheapen (see §4). So **all three are
fine-tunes of small biomedical encoders on existing public labelled datasets**; our own verified edges
become a held-out eval set + a late-stage fine-tune as they accrue.

> **The concrete training recipe — real data shapes, label-mapping tables, and how each model plugs into
> the pipeline — is in [`../nao/BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md)** (grounded in
> live samples pulled 2026-07-01). Summary of the data-fit per model below.

### Model (a) — Claim-support / NLI  *(highest leverage)*
*(claim + quote span → supported / contradicted / uncertain)*

- **In-house target mapping:** X = `RelationshipClaim` (subject/object, `relation`, `claimKind`) +
  `QuoteSpan.quote` + `Citation.evidenceTier/impactTier`; y = `EdgeVerification.verdict`
  (filter to `independentRetrieval.performed === true`). Their `SUPPORT/CONTRADICT/NOINFO` ≈ our
  `supported/contradicted/uncertain`.
- **Public training data:** **SciFact** & **SciFact-Open** (scientific claim + abstract evidence),
  **HealthVer**, **PubHealth**, **COVID-Fact**; general NLI warm-start from **MultiNLI / ANLI / SciNLI**.
- **Base model:** **PubMedBERT / BioLinkBERT / DeBERTa-v3**.
- **Payoff:** directly replaces most verifier-LLM calls at scale → the clearest GMI-credits win.

### Model (b) — Source reliability  *(reframe before training)*
*(paper metadata → reliability)*

- **The trap:** metadata → `evidenceTier` fights the design's own thesis — venue prestige and
  study-design strength are **deliberately separate** (`impactTier` vs `evidenceTier`). A high-impact
  venue still publishes weak designs.
- **Split into two:**
  - **impactTier (venue weight):** derivable from metadata — likely **no model needed**, a deterministic
    **SJR + OpenAlex `citedByCount`** lookup/formula. X = `PaperRecord.journal.*`,
    `metrics.citedByCount`, `workType`, `year`, `oa.status`. (JCR/Impact Factor is dropped — it's the only
    paid/closed source; SJR + OpenAlex cover venue weight for free.)
  - **evidenceTier (study design):** the *trainable* half — **study-design classification from the
    abstract** (RCT / meta-analysis / cohort / observational / mechanistic → tiers 4/5/3/2/1).
    Public data: **PubMed publication-type / MeSH tags**, **Cochrane RCT-classifier / RobotReviewer**
    corpora. Base: PubMedBERT.

### Model (c) — Claim-kind / direction / relation classifier
*(quote/abstract → causal|correlational|mechanistic + A→B direction + relation kind)*

- **In-house target mapping:** X = `QuoteSpan.quote` + `RelationshipClaim.population/effect` +
  `Citation.title/abstract`; y = `EdgeVerification.claimKindCheck.supportedKind`,
  `directionCheck.matchesClaim`, `RelationshipClaim.relation` (6-way), `scopeCheck.mismatch`.
- **Public training data:** biomedical relation extraction — **BioRED, ChemProt, DDI, GAD, EU-ADR**
  (typed + directed relations); **SemEval-2010 Task 8** (Cause-Effect + direction); causal-language
  corpora for causal-vs-correlational.
- **Base model:** PubMedBERT.

**Consolidation:** (a) and (c) can be **one multi-task claim-analysis head** (entailment + claim-kind +
direction) rather than two separate models — often more sample-efficient. (b)-impactTier is
deterministic; (b)-evidenceTier is its own study-design classifier.

**Priority for the credits:** (a) → (c) → (b-as-study-design); (b)-impactTier needs no training.

---

## 4 · The bootstrapping problem & sequencing

The models presuppose a labelled edge corpus that doesn't exist. The escape is that **none of them
needs our data to start** — public scientific-NLI and biomedical-RE datasets are large and on-point.
Sequencing that avoids the chicken-and-egg:

1. **Fine-tune (a)/(c) on public data now** (GMI credits). No dependency on Track B.
2. **Stand up Track B minimally** (synthesis + verifier LLMs + `verified_edges` store) to produce a few
   hundred in-house `(claim, quote, verdict)` tuples — used as a **held-out eval set**, not training.
3. **Late fine-tune** on those in-house tuples once they exist; swap the trained (a) in as a
   pre-filter/first-pass verifier to cut LLM spend as the corpus grows toward 360 metrics.

For the demo, depth beats breadth: a few metric pairs, ~30–50 papers, fully synthesised + verified +
visualised in nao is more convincing than a huge shallow corpus. (Note: 360 metrics is **not**
360k papers — edges share papers many-to-many; 360k×2MB would also blow past R2's free 10 GB.)

---

## 5 · Recommended target shape

Two kinds of model appear below: **LLM-1 / LLM-2** are the two decorrelated brain LLMs (synthesis +
verifier); **model (a)/(b1)/(b2)/(c)** are the small fine-tuned support models from §3 (b2 is a lookup,
not trained). The support models tag papers and cross-check the LLM so the expensive LLM does less.

```
[planner/seeder AGENT]  reads metric registry (derivedFrom[]) + biotope needs → research queries
        │
        ▼
[ingestion  DETERMINISTIC]  discover → paper_uid dedup → OA-location → fetch → R2   (budget-guarded)
        │
        ▼
[extract    DETERMINISTIC]  JATS / CORE fullText / unpdf → text
        │                    └─ per paper → model (b1) study-design ⇒ evidenceTier
        │                                    model (b2) OpenAlex/SJR lookup ⇒ impactTier
        ▼
[synthesis  LLM-1 · strong]  text → RelationshipClaim (+ quoteSpans)
        │
        ▼
[quoteCheck DETERMINISTIC]  verbatim span present?  (free hallucination catch)
        │
        ├─ model (c) relation/direction/kind ⇒ cross-checks the claim
        │             (feeds directionCheck, claimKindCheck; catches flip / correlation-as-causation)
        ├─ model (a) NLI claim-support ⇒ cheap first-pass verdict (pre-filter)
        ▼
[verifier   LLM-2 · different family]  independent retrieval + adversarial refute → EdgeVerification (graded)
        │                                (evidenceTier/impactTier from b1/b2 flow into the Citations)
        ▼
[verified_edges store  TRUTH]  ──sync job (DETERMINISTIC)──►  Neo4j (PROJECTION)
        │                                                          │
        ▼                                                          ▼
[nao: view + human-in-the-loop curation AGENT-ASSISTED]   [biotope insights ENGINE  DETERMINISTIC]
                                                                   │  (what fires + the numbers)
                                                                   ▼
                                                          [presentation AGENT · haiku]
                                                           grounded · copy-gated · cached · degradable
                                                           (curated summary + template copy; no new facts)
```

---

## 6 · Risks & caveats

- **Domain gap on public NLI/RE data** — SciFact/BioRED skew biomedical-abstract; our metric pairs
  (hydration, vector exposure, env context) may be under-represented. Mitigate with the late in-house
  fine-tune (§4.3) and eval on held-out ourobion edges.
- **evidenceTier is not learnable from metadata** — must come from abstract text (study design), not
  journal prestige. Keep the impactTier/evidenceTier split or the model launders venue bias into
  evidence strength.
- **Non-diagnostic gate** — any trained/LLM output that reaches user-facing copy must still pass the
  copy gate; keep runtime deterministic.
- **Over-scoping training for a demo** — three models is a lot. If time-boxed, ship (a) trained + (b)
  as a deterministic lookup and describe (c) as roadmap.

## 7 · Sources (mid-2026)

- Scientific claim verification: SciFact / SciFact-Open, HealthVer, PubHealth, COVID-Fact; SciNLI, ANLI.
- Biomedical relation extraction: BioRED, ChemProt (BioCreative VI), DDI Extraction 2013, GAD, EU-ADR;
  SemEval-2010 Task 8 (relation classification, incl. Cause-Effect + direction).
- Study-design / venue signals: PubMed publication types & MeSH; Cochrane RCT classifier / RobotReviewer;
  SCImago Journal Rank (SJR), OpenAlex `works` (`cited_by_count`, host venue).
- Base encoders: PubMedBERT, BioLinkBERT, DeBERTa-v3.
- Internal: `shared/brain/relationships.ts` (contract shapes), `relationships.schema.ts` (invariants),
  `index.ts` (`edgeScore`/`servingBand`), `shared/metrics/registry.ts`,
  `tools/brain-ingest/src/types.ts` (`PaperRecord`).
