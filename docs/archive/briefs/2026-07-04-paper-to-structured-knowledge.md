> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../shared/insight-engine-architecture.md).

# Turning a chaotic paper corpus into graph-ready knowledge — RESEARCH BRIEF

**Date:** 2026-07-04 · **Status:** 🔬 **Research brief / options** — not yet a decision.
**Author:** Jayden (problem framing) · Claude (research synthesis) + a Fable-model review pass.
**Companion:** [`2026-07-04-metric-knowledge-bridge.md`](2026-07-04-metric-knowledge-bridge.md) (the
*representation* side — what the graph is). This brief is the **input** side — how raw papers become
graph-ready.
**Detail it feeds:** [`../nao/BRAIN-INGESTION-DESIGN.md`](../../nao/BRAIN-INGESTION-DESIGN.md) (stops at
"text + a `paper_uid`") · [`../nao/BRAIN-DESIGN.md`](../../nao/BRAIN-DESIGN.md) (synthesis + verifier) ·
[`../nao/BRAIN-MODELS-TRAINING.md`](../../nao/BRAIN-MODELS-TRAINING.md) (the support models) ·
`shared/brain/relationships.ts`.

**Question this brief answers:** the ingestion pipeline fetches papers and flattens each to plain text —
then hands a whole-paper blob to synthesis. But a paper is **chaotic and non-uniform**: an abstract is
for triage, Methods carry study design (reliability), Results carry the actual effect, References carry
provenance — and papers are **not linked to each other**. What structuring must happen **between "text on
R2" and "the synthesis LLM proposes an edge"**, and **how many stages** does that take to be efficient,
effective, and reliable?

---

## 0 · TL;DR

- **There is a real gap.** `tools/brain-ingest/src/extract.ts` today produces one whitespace-collapsed
  string per paper. Feeding that whole blob to an LLM is the anti-pattern: context overflow, cost scaling
  with corpus size, lost provenance (the edge can't point to the sentence/number that justifies it), and
  no way to assign an evidence tier.
- **The organizing principle is a cascade:** cheap, high-recall, deterministic/small-model steps first;
  the expensive LLMs last, on a maximally reduced, structured input. "Put an LLM where a regex, a
  classifier, or a lookup suffices" is the failure mode.
- **Reframe every stage around producing one tuple** (the Fable review's key point): the goal is not to
  "parse a paper" but to emit
  **`⟨subject, object, signed relation, claimKind, effect+CI, population/scope, evidenceTier, assertion-polarity, provenance-span+citation⟩`** —
  which is *exactly* a `RelationshipClaim` in the existing contract. Section segmentation, extraction, and
  linking are all *in service of* that tuple.
- **Sections carry different epistemic value:** Methods → design/scope (reliability tier); Results →
  effect size/CI (magnitude); Abstract/Discussion → triage + **spin to flag, never trust**; References →
  provenance + corroboration graph.
- **Papers must be linked into a graph:** citation / co-citation / bibliographic coupling + snowballing +
  document embeddings (SPECTER/SciNCL) both **find more relevant papers** and let corroboration be scored
  by **independent evidential roots**, not paper count.
- **Fewer high-precision stages beat a deep chain.** Error compounds (~0.9ᵏ), so the right question is
  *"what is the one irreducible extraction, and the cheapest precise path to it?"* — with human review on
  survivors, not everywhere.
- **Much of this is already designed** as the four support models in `BRAIN-MODELS-TRAINING.md` (NLI
  claim-support, relation/direction, study-design, venue). This brief sequences them and adds the
  section-aware front end that `extract.ts` currently lacks.

---

## 1 · Why whole-paper-to-LLM fails (the case for pre-structuring)

Sending a flattened paper straight to synthesis produces predictable failures (Wadden et al. SciFact 2020
exists precisely to force sentence-level grounding):

- **Cost blowup** — paying frontier rates per token for whole papers, most tokens boilerplate.
- **Context overflow** — multi-paper synthesis exceeds the window → lossy truncation.
- **Lost provenance** — a claim generated from a 30-page blob can't be traced to a span, so `quoteSpan`
  grounding (the contract's near-free `quoteCheck`) is impossible.
- **Hallucination** — unfiltered noise + no evidence anchor lets the model invent relationships, flip
  directions, and read negated findings as positive.
- **No evidence tier** — without extracted study design + venue, an RCT and a preprint case report look
  identical, so `evidenceTier`/`impactTier` can't be set.

Pre-structuring is what makes the expensive stages both cheap and trustworthy.

---

## 2 · The target: every stage serves one tuple

Organize the pipeline around **producing a `RelationshipClaim`**, not around parsing document anatomy.
The tuple and where each field comes from:

| Field (contract) | Comes from | Technique |
|---|---|---|
| `subject`, `object` | entity recognition + normalization | small model + ontology lookup |
| `relation` (signed) + `claimKind` | directed relation extraction | small model (BioRED/BC5CDR) + SemRep predications |
| `effect{size,ci}` | **Results** section numbers | deterministic regex (literals) + small-model attachment |
| `population` / scope | **Methods** | PICO span model |
| `evidenceTier` | study design | MeSH/publication-type prior + small classifier |
| `impactTier` | venue | deterministic lookup (OpenAlex/SJR — the planned `b2`) |
| assertion polarity | negation/speculation | rules (NegEx/ConText) + BioScope classifier |
| `citations[]`, `quoteSpans[]` | provenance | section offsets + reference parsing |

If a stage doesn't move a field of this tuple closer to done, it doesn't belong.

---

## 3 · Sections carry different epistemic value (route, don't flatten)

Flattening destroys exactly the signal reliability grading needs (IMRaD: Introduction, Methods, Results,
Discussion + Abstract + References):

- **Methods → design + population/scope = the reliability tier.** RCT vs cohort vs cross-sectional vs
  review maps onto the evidence hierarchy (GRADE; Oxford CEBM). Sample size, inclusion criteria, exposure/
  outcome definitions, confounder handling live here. **Caveat (review):** papers *misdescribe* their own
  design — take the design **prior from MeSH / PubMed publication types**, not from prose.
- **Results → effect size + CI + significance = magnitude/precision.** Mine the number and its precision
  here, with far less author framing than elsewhere.
- **Abstract → fast triage, systematically overstated.** ~40–60% of RCT abstracts with null primary
  outcomes use "spin" (Boutron et al. *JAMA* 2010; propagates to press/news, Boutron & Ravaud). Use the
  abstract as a *pointer* for retrieval/triage; **quarantine it from final-claim scoring**, run a spin
  flag.
- **Discussion → inflated causal language** — "associated with" silently becomes "reduces." Harvest for
  author-stated limitations/mechanism, but **flag causal verbs as interpretation, not evidence.**
- **References → provenance + corroboration** (§5).

**Segmentation tooling:** prefer **JATS/PMC XML** when it exists (`<sec>`, `<abstract>`, `<ref-list>`
already delimited) and **PubMed structured abstracts** (labelled BACKGROUND/METHODS/RESULTS/CONCLUSIONS).
For PDF-only, **GROBID** (best-in-class, reference-F1 ≈ 0.89; CERMINE/ScienceParse alternatives). Then
**sentence-role classification** to normalize inconsistent headings: **SciBERT** (Beltagy et al. 2019)
sequential-sentence-classification trained on **PubMed-200k-RCT** (Dernoncourt & Lee 2017) / **CSAbstruct**
(Cohan et al. 2019). **This is the concrete upgrade `extract.ts` needs** — from "flatten to one string" to
"segment + tag + route."

---

## 4 · Pre-synthesis extraction steps (push determinism + small models upstream)

Ordered, each with the right technique (general rule: *reserve the LLM for cross-document reasoning; do
everything else deterministically or with a small fine-tuned model that emits span offsets*):

1. **Study-design classification + venue tiering** — small model + deterministic lookup. Design from
   **MeSH/pub-types** (RobotReviewer / Marshall et al. 2016 for RCTs; PubMed-200k for sentence roles);
   venue via OpenAlex/SJR (the planned `b2`, no training). → `evidenceTier` / `impactTier`.
2. **PICO extraction** — small BERT token-classifier on **EBM-NLP** (Nye et al. 2018); SciBERT/PubMedBERT
   encoders; Trialstreamer (Marshall et al. 2020) is the at-scale precedent. → `population`/scope.
3. **Effect-size extraction** — **hybrid**: deterministic regex/grammar for the numeric literals (CI
   brackets, p-values, %) — the source of truth for digits, so no hallucinated numbers — + a small model
   to *attach* each number to its PICO outcome/arm. → `effect{size,ci}`.
4. **Assertion / negation / speculation gate** — **mandatory** (the dominant extraction error, per the
   review). Rules (NegEx/ConText, Chapman 2001 / Harkema 2009; negspacy) for explicit cues + a
   **BioScope** (Vincze et al. 2008) / i2b2-2010 (Uzuner 2011) classifier for scope. Marks each candidate
   **asserted / negated / speculative**; discard non-asserted *before* synthesis. → assertion polarity.
5. **Entity normalization + directed relation extraction** — normalize entities to a controlled
   vocabulary **early** (the SemRep/MetaMap lesson — Aronson 2001; Kilicoglu 2012/2020), then a
   document-level RE model (**BioRED**, Luo et al. 2022; **BC5CDR**, Li et al. 2016) + SemRep predications
   (predicate encodes direction — where a naive LLM most often flips subject/object). → `subject`,
   `object`, signed `relation`, `claimKind`.

Only **then** does synthesis run — over compact, span-anchored records, not PDFs. This cuts token cost
1–2 orders of magnitude and removes whole hallucination classes (fabricated numbers, flipped directions,
negation errors).

---

## 5 · Link the papers into a graph (not a flat bag)

Today the corpus is a manifest of independent `PaperRecord`s. Linking them enables both *finding more* and
*trusting better*:

- **Three relatedness signals:** direct **citation** (lineage/forward influence), **co-citation** (Small
  1973 — foundational pairs the field treats as linked), **bibliographic coupling** (Kessler 1963 — shared
  references → contemporary siblings, good for new papers with no citations yet).
- **Snowballing** (Wohlin 2014) — from a seed set that states a relationship, run 1–2 rounds of backward
  (reference lists) + forward (citing papers) chasing; more precise than keyword search because inclusion
  is mediated by an already-relevant paper.
- **Document embeddings** — **SPECTER** (Cohan et al. 2020) / **SciNCL** (Ostendorff et al. 2022) embed
  papers from citation signals using only title+abstract, so they retrieve semantically related work even
  across citation-disconnected clusters (ANN over FAISS/HNSW). Recall complement to snowballing's
  precision.
- **Corroboration by independent evidential root, not paper count** (this is what the companion brief's §7
  scoring depends on): collapse papers sharing **authors/labs** into one source; **down-weight papers that
  merely cite** a primary finding vs reproduce it (a citation chain to one origin is *one* piece of
  evidence); reward support that spans **different co-citation/coupling clusters and datasets**;
  **deduplicate** preprint↔published and re-analyses by embedding similarity; **flag citation cartels**
  (dense reciprocal citation among a closed author set). Citation count ≠ validity (amyloid Aβ*56, the
  retracted MMR–autism paper — both heavily cited).

---

## 6 · What to search for, and how to start

- **Seeding queries** (already designed): the **agentic seeder** reads registry `derivedFrom[]` + biotope
  `insight_needs` + the **co-occurrence candidate index** (companion brief §6) to choose which metric
  pairs to research. Snowballing + SPECTER-ANN (§5) then expand each seed set.
- **Where in the paper to read:** route per §3 — abstract to *decide relevance*, Results for the *number*,
  Methods for the *tier*, references to *corroborate*. Never score a claim from the abstract or discussion.
- **Cold start (zero edges):** don't wait for a full support-model stack. Run **cheap directed LLM
  sign+polarity extraction over co-occurring *result* sentences** on the demo slice (gives signed
  candidate edges immediately), verifier-confirmed — the companion brief's §12 recommendation. The small
  models replace the LLM extraction later for cost/consistency.

---

## 7 · The pipeline — a minimal-but-sufficient cascade

Mapped to what's **built** (`tools/brain-ingest` §10.1–10.7) vs **planned** (synthesis, verifier, support
models). Cheap/deterministic and small-model stages form the *pre-brain funnel*; the two LLM calls run on
a maximally reduced input:

| # | Stage | Type | Rationale | Status |
|---|---|---|---|---|
| 0 | Discover → OA-retrieve → **plain text** | deterministic | acquire corpus | ✅ built (`brain-ingest`) |
| 1 | **Section segmentation + sentence-role tagging** | cheap + small-model | route to the right extractor; kill boilerplate | ❌ **the `extract.ts` upgrade** |
| 2 | Study-design + venue tiering | small-model + lookup | `evidenceTier`/`impactTier`; MeSH prior, not prose | 🟡 designed (`b1`,`b2`) |
| 3 | PICO / claim-span + effect extraction | small-model + regex | scope + magnitude, span-anchored | 🟡 partly (support models) |
| 4 | **Assertion/negation gate** | rules + small-model | drop negated/speculative — dominant error | ❌ not yet designed |
| 5 | Entity normalization + candidate-pair generation | lookup + small-model | bind to ontology + source span; bounded pair set | 🟡 (co-tag index, companion §6) |
| 6 | **Synthesis LLM** | **LLM (RAG-scoped)** | assert `RelationshipClaim` over spans, not papers | 🟡 planned (`BRAIN-DESIGN`) |
| 7 | NLI claim-support check | small-model | cheap gate: is the claim entailed by its span? | 🟡 support model `a` |
| 8 | **Adversarial verifier LLM** | **LLM** | expensive precision on survivors only | 🟡 planned (`BRAIN-DESIGN`) |
| 9 | Human-in-the-loop | human | adjudicate *disagreement / low-confidence* only | 🟡 nao v3 |

Precedent for the shape: retrieve-then-rerank cascades (Wang et al. 2011; cross-encoder rerank, Nogueira &
Cho 2019); RAG chunking to feed spans not documents (Lewis et al. 2020 — chunk granularity governs
hallucination); SemRep/SemMedDB's normalize-early rule pipeline; and the LLM-KG **Extract-Define-
Canonicalize** pattern (Zhang & Soh, EMNLP 2024) + small verifier models (Han et al. 2024).

---

## 8 · How many stages? — fewer, precise, with HITL on survivors

The review's sharpest architectural point: **error compounds multiplicatively.** A 6-stage chain at 90%
per stage is ~0.9⁶ ≈ 53% end-to-end. So the goal is **not** "more stages" — it's:

- **Identify the one irreducible extraction** (the signed, asserted, span-grounded relation) and the
  **cheapest precise path** to it.
- **Merge stages** where a single model can emit multiple tuple fields; avoid a long brittle chain.
- **Make each stage high-recall early, high-precision late** (never discard a true claim you can't
  recover; let the verifier + human kill false positives).
- **Place humans on survivors only** — where synthesis/verifier disagree, NLI is borderline, or the tier
  is ambiguous — and feed those decisions back as training data for the small models. Not at the wide
  cheap top, not blindly at the bottom.
- **Guard the assertion gate hardest** (stage 4): negation/hedging is the dominant error and cannot be
  left to "verifier hope."

A defensible minimum for the hackathon slice: **segment (1) → tier (2) → claim+effect+assertion (3–4
merged) → synthesis (6) → NLI (7) → verifier (8) → human on disagreement (9)** — deferring full PICO and
document-level RE to the support-model roadmap, using the LLM for extraction at cold start.

---

## 9 · Reconciliation with existing docs

- **`BRAIN-INGESTION-DESIGN.md`** deliberately stops at "text + a `paper_uid`." This brief defines the
  **next segment** (structuring), which that doc lists as out-of-scope. The manifest already captures
  `venue`, `abstract`, `concepts`, `citedByCount`, `workType` — useful priors for stages 2/5 — but **not**
  section structure or references-as-graph.
- **`extract.ts`** currently only flattens (PDF/JATS → collapsed string). **Stage 1 is its concrete
  upgrade** — preserve JATS `<sec>`/`<ref-list>` structure instead of discarding it.
- **`BRAIN-MODELS-TRAINING.md`** already designs the four support models — **NLI claim-support (stage 7),
  relation/direction (stage 5), study-design (stage 2), venue (stage 2)**. This brief *sequences* them and
  adds the two gaps not yet designed: **section segmentation (stage 1)** and the **assertion/negation gate
  (stage 4)**.
- **`shared/brain/relationships.ts`** is the output contract — the tuple in §2 *is* a `RelationshipClaim`.
  No contract change; the structuring fills its fields with provenance.

---

## 10 · Constraints & cold-start reality

- **No GPU/GMI credits yet** → the support models (stages 2,5,7) are design + data-prep only; **use the
  LLM for those extractions at cold start**, swap in trained models when credits land (matches the
  standing Phase-2 constraint). Stage 4's rule layer (NegEx/ConText) needs no training and ships now.
- **OA-only corpus** → some Methods/Results detail is missing for paywalled items (abstract-only); the
  tier defaults conservatively and the paper is flagged, never silently upgraded.
- **Cost discipline** carries over from ingestion: budget-guarded, usage-logged LLM calls; the whole point
  of stages 1–5 is to shrink what stages 6/8 pay for.

---

## 11 · Open questions

1. **Section segmentation build** — JATS-first parser upgrade to `extract.ts` + GROBID for PDF-only; is
   GROBID (a Java service) acceptable given the "no Python, TS-first" rule? (It's a separate service, not
   a language dep — confirm the ops posture.)
2. **Assertion gate** (stage 4) — not yet in any design doc; needs a home (a support model vs a rules-only
   TS module).
3. **References-as-graph** — do we persist a citation graph (new store) or compute corroboration on demand
   from OpenAlex references? Affects §5 independent-root scoring.
4. **Stage merging** — how few stages can emit the full tuple at acceptable precision for the slice (§8)?
5. **Provenance offsets through segmentation** — guarantee character offsets survive JATS/GROBID →
   sentence-tagging so `quoteSpan` locators stay exact.

---

## 12 · Sources (external research)

- **Sections / spin / segmentation:** Boutron et al. *JAMA* 2010 (spin); Dernoncourt & Lee 2017
  (PubMed-200k-RCT); Cohan et al. 2019 (sequential sentence classification / CSAbstruct); Beltagy et al.
  2019 (SciBERT); GROBID (Lopez); CERMINE (Tkaczyk et al. 2015); JATS/NISO.
- **Extraction:** Nye et al. 2018 (EBM-NLP/PICO); Marshall et al. 2016/2020 (RobotReviewer, Trialstreamer);
  Kiritchenko et al. 2010 (ExaCT); Vincze et al. 2008 (BioScope); Chapman 2001 / Harkema 2009 (NegEx/
  ConText); Uzuner et al. 2011 (i2b2 assertions); Luo et al. 2022 (BioRED); Li et al. 2016 (BC5CDR);
  Aronson 2001 (MetaMap); Kilicoglu et al. 2012/2020 (SemMedDB/SemRep).
- **Linking:** Kessler 1963 (bibliographic coupling); Small 1973 (co-citation); Wohlin 2014 (snowballing);
  Cohan et al. 2020 (SPECTER); Ostendorff et al. 2022 (SciNCL).
- **Pipeline architecture:** Wang et al. 2011 (cascade ranking); Nogueira & Cho 2019 (rerank); Lewis et al.
  2020 (RAG); Zhang & Soh EMNLP 2024 (Extract-Define-Canonicalize); Han et al. 2024 (verifier models);
  Wadden et al. 2020 (SciFact) / 2022 (MultiVerS).

*Synthesized from four parallel research passes + one adversarial (Fable) review, 2026-07-04.*
