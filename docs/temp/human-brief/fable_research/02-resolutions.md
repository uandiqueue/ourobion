# PHASE2-PLAN — resolutions

**Date:** 2026-07-05 · **Status:** Fable research — part 2 of 4.

One resolution per weakness in [`01-phase2-weaknesses.md`](01-phase2-weaknesses.md) — same IDs and order.
Each gives the concrete fix, its grounding, a named alternative, and a cost/who-absorbs note (feeding the
roles analysis in part 4). Team shorthand: **FE** (Flutter/UI dev), **MNT** (backend/research dev, also the
maintainer — Jayden), **JR** (junior backend dev). Grounding keys: **MKB** =
[`metric-knowledge-bridge`](../2026-07-04-metric-knowledge-bridge.md); **PSK** =
[`paper-to-structured-knowledge`](../2026-07-04-paper-to-structured-knowledge.md); **LINK** =
[`BIOTOPE-NAO-LINK.md`](../../../shared/BIOTOPE-NAO-LINK.md) (branch `origin/docs/biotope-nao-link-plan`); **IED** =
[`INSIGHTS-ENGINE-DESIGN.md`](../../../biotope/INSIGHTS-ENGINE-DESIGN.md); **CONTRACT** =
[`shared/brain/relationships.ts`](../../../../shared/brain/relationships.ts).

**No `RelationKind` / signed-edge contract change is needed anywhere** — every resolution is additive or
engine-side, consistent with MKB §10.

---

## CRITICAL

### C1 · Triangulation gate → three-branch graded signal
- **Resolution:** Delete the "cross-checks self-report against its passive correlate **before firing**"
  AND-gate. Replace with MKB §9's composition, surfaced as four explicit branches (agree / research-context
  / idiosyncratic / contradiction — UX in H3). Triangulation becomes a **confidence/ranking modulator**,
  never a fire condition. The personal leg's job is **multiple-comparisons noise control** (FDR, per M1),
  **not** causal corroboration: both legs are observational and share confounders, so agreement is
  *consistency*, not Lawlor-style triangulation. Bake in the honest premise — with real n=1 statistics the
  "agree" branch fires **rarely**; day-to-day value comes from research-context + idiosyncratic. Additive
  engine logic in IED §E, **no contract change**.
- **Grounding:** MKB §3.5 #3, §9, §10(a). File 01 C1.
- **Alternative:** a *soft* AND-gate (lower the personal-leg threshold). Rejected — still silences the app
  on modest real effects and still mislabels consistency as corroboration. Wins only if research-context
  cards later prove too noisy; then gate to {agree, idiosyncratic}, not "both must agree."
- **Cost:** Mostly **MNT** (branch logic + copy premises); *reduces* net build (no gate wiring). Forces
  **FE** to render 4 states not 1 (→ H3).

### C2 · "Paper → edge extraction" → the PSK §7 cascade, with the two undesigned stages named
- **Resolution:** Adopt PSK §7's minimal-but-sufficient cascade and name the two omitted stages:
  **stage 1 = section segmentation + sentence-role tagging** — the concrete `extract.ts` upgrade, from
  "flatten to one collapsed string" to "segment + tag + route," **JATS/PMC-XML-first**, **GROBID fallback**
  for PDF-only; **stage 4 = assertion/negation gate** — rules-based **NegEx/ConText (+ negspacy)**, needs no
  training, ships now, drops negated/speculative findings before synthesis. **Merge stages to fight error
  compounding (~0.9ᵏ):** ship PSK §8's slice — `segment(1) → tier(2) → claim+effect+assertion(3–4 merged) →
  synthesis(6) → NLI(7) → verifier(8) → human-on-disagreement(9)`. **Defer** full PICO + document-level RE
  support models to the GMI roadmap; **use the LLM for those extractions at cold start**. Guarantee stage 1
  emits character offsets so `quoteCheck` has spans and tiers can be set.
- **Grounding:** PSK §0, §3, §4, §7 (status column), §8, §10, §11-Q1/Q5. File 01 C2.
- **Alternative:** keep feeding the flattened blob to a larger-context synthesis LLM and lean on the
  verifier. Rejected — reproduces polarity blindness, no span provenance, can't set a tier, blows up token
  cost (PSK §1). JATS-first beats GROBID-everywhere (free where XML exists; GROBID only for PDF-only, ops
  posture per §11-Q1).
- **Cost:** Biggest hidden-scope insertion — sizes as *multiple stages*, not one line. Splittable: **JR**
  owns the deterministic pieces (JATS parser, NegEx/ConText module, effect-size regex — rules/lookups, no
  ML). **MNT** owns synthesis/verifier prompts + the stage-merge. High total; JR-absorbable share is real.

### C3 · Idiosyncratic lane as a first-class engine + UX pathway
- **Resolution:** Add MKB §9 branch 3: a **strong, stable personal correlation with no literature edge**
  surfaces as **"unusual for you — no research match," explicitly hypothesis-not-fact**. Gate with the n=1
  guards (shared with M1). **Remove "scoped to brain neighbours" as a hard literature-plausibility gate** —
  that is the mechanism that censors this signal. Its labelled lane keeps it from masquerading as science.
- **Grounding:** MKB §3.5 #4, §9 branch 3, §13-Q3. File 01 C3.
- **Alternative:** suppress no-literature correlations (the plan's implicit behaviour). Rejected — discards
  the differentiator. Ship with conservative min-n + stability window rather than omit the lane pending a
  "perfect" threshold.
- **Cost:** **MNT** (branch + n=1 stats, shared with M1) + **FE** (distinct card style + hypothesis label).
  Moderate. §13-Q3 (thresholds + exact copy) is an open MNT design decision.

---

## HIGH

### H1 · State that cross-metric cards ship at zero edges; decouple gate criterion 2 from the edge pipeline
- **Resolution:** State plainly: **cross-metric cards (gate criterion 2) ship on hand-authored static
  blueprints at ZERO edges.** "Brain-scoped" is an **offline authoring-time** decision — a human or the B4
  extract CLI picks the two `metricKeys` using the brain as *reference* (+ a `provenance.citation`); the
  blueprint is static JSON in `data/rules/cross/**`; the deterministic engine **never touches Neo4j**.
  Redraw the plan's dependency arrows so gate criterion 2 does **not** wait behind the XL edge pipeline.
  Only the presentation agent's *richer phrasing* needs served edges, and that read is **additive +
  degradable**.
- **Grounding:** LINK §2, §3 Fallback; IED "Determinism" invariant. File 01 H1.
- **Alternative:** read "scoped to brain neighbours" as a live Neo4j dependency during evaluation. Rejected
  — breaks the pure-function/no-IO invariant *and* blocks shippable cards behind an XL pipeline they don't
  need.
- **Cost:** Near-zero — a re-statement + arrow-decoupling (**MNT** doc edit) that *reduces* risk. Authoring
  a handful of cross blueprints = small **MNT** task.

### H2 · Servability boundary as a stated constraint (1-hop, monotonic-only); add lag
- **Resolution:** Make the boundary explicit: composition is **1-hop only** and **monotonic-only**.
  `modulates` edges are retrieved as **context only** — never a composed directional prediction — until
  biotope can supply an **absolute-scale reading** (MKB §13-Q2). Drop the "multiply-along-paths" framing
  (the graph is a neighbour lookup, not a path calculator). **Add `lag` (and `weight`) as additive fields**
  to the correlation blueprint and the edge contract — also fixes M1's lag half.
- **Grounding:** MKB §3.5 #1, #2, §5, §10; CONTRACT `RelationKind`. File 01 H2.
- **Alternative:** serve `modulates` via a z-score. Rejected — a z-score is also baseline-relative, so it
  can't locate the user on the dose-response curve. Viable only once biotope emits an absolute position.
- **Cost:** **MNT**, small — a constraint statement + one additive field. The `lag`/`weight` addition is a
  `shared/` change → 2-reviewer PR (Alton).

### H3 · Four presentation branches with copy / label / reliability cues; degrade to templates
- **Resolution:** Design each MKB §9 branch with its own copy, label, and reliability/citation cue:
  **agree** (shared-confounder caveat in copy — "consistent with research and with your data," not proof);
  **research-context** ("seen in research; not yet clear in your data" — the common case, never
  suppressed); **idiosyncratic** ("unusual for you — no research match," hypothesis-not-fact);
  **contradiction** ("flag for review" — never silently dropped). Attach a reliability/citation cue keyed
  to `servingBand`. **Degrade to the deterministic templated copy** when the brain read is empty or fails.
- **Grounding:** MKB §9, §3.5 #3; LINK §3; IED §E. File 01 H3.
- **Alternative:** one generic card style with the agent free-phrasing. Rejected — over-promises on the
  rare "agree," has nothing designed for the common cases, gives no uncertainty presentation.
- **Cost:** Main **FE** work item — four card variants + labels + reliability cues; moderate-to-large.
  **MNT** supplies copy strings + agent prompt. This is where the FE load concentrates.

### H4 · Cold-start = LLM extraction + review on survivors only; pull a minimal nao-v3 slice forward
- **Resolution:** State that cold-start rides on **LLM extraction + human review on survivors only**
  (synthesis/verifier disagreement, borderline NLI, ambiguous tier — PSK §8), not review everywhere.
  **Pull a minimal nao v3 curation slice forward** to when edges first appear (a `provenance:'human'`
  approve/reject surface), rather than sequencing it after the pipeline. Name who curates (**MNT** + **JR**
  share it) and size the labour as a *recurring* task.
- **Grounding:** PSK §8, §10; LINK §4. File 01 H4.
- **Alternative:** (a) keep nao v3 after the pipeline — rejected: edges emerge with no tool/owner to
  approve them. (b) trust the verifier, no human review — rejected: negation/tier edge cases need a human
  at cold start.
- **Cost:** *The* burden-shift flag. Adds (1) a recurring review task (**MNT** + **JR**) and (2) an earlier
  build item — a minimal approve/reject surface (**FE**/**JR**). Moderate build + **ongoing** human cost.

---

## MEDIUM

### M1 · n=1 guards, lag, and commensurability as explicit engine requirements
- **Resolution:** Add as engine requirements: **autocorrelation-adjusted N_eff** (Pyper–Peterman),
  **FDR across the candidate set** (Benjamini–Hochberg), **effect size + interval**, and a **minimum
  effective-n**. **Add a `lag` field to the `correlation` blueprint** (today it reads two *current*
  `baseline_snapshots` rows — no lag) + the additive edge `lag` from H2. **Name the effect-size
  commensurability step** (reconcile units/scales/populations before summing corroboration) as a
  prerequisite, even if minimal for the slice.
- **Grounding:** MKB §9 step 4, §7, §13-Q5, §10(e/f); IED §B1 `correlation`. File 01 M1.
- **Alternative:** raw correlation over active-metric pairs with no N_eff/FDR. Rejected — over dozens of
  pairs it manufactures false-positive cards, the exact multiple-comparisons failure the personal leg is
  meant to control.
- **Cost:** **MNT** — statistical evaluator, moderate. **JR** can take the deterministic lag-window
  blueprint plumbing. Commensurability can be a named stub for the slice but must not be silently omitted.

### M2 · Corroboration clustered by independent evidential root; additive dependency-cluster field
- **Resolution:** Cluster corroboration by **independent evidential root** before summing (a citation chain
  to one origin = **one** piece of evidence): collapse shared authors/labs, down-weight papers that merely
  cite vs reproduce, dedupe preprint↔published by embedding similarity, flag citation cartels. Add an
  **additive dependency-cluster field** to `corroboration` (keep the counts; add cluster id/count). Note
  the tier multipliers are **illustrative, not GRADE point-weights**.
- **Grounding:** MKB §3.5 #6, §7, §10; PSK §5, §11-Q3. File 01 M2.
- **Alternative:** naive count + "seed conservatively." Rejected — a citation cascade to one origin scores
  as N independent supports → over-trusted → served at `high`. For *how* roots are computed: compute
  on-demand from OpenAlex references (cheaper, recommended for the slice) vs persist a citation-graph store
  (§11-Q3) — persist later.
- **Cost:** **MNT**, moderate; depends on PSK §5 references-as-graph. For the slice, a minimal heuristic
  (cluster by shared first-author / DOI lineage) suffices. Additive field → `shared/` 2-reviewer PR.

### M3 · Concrete recommendations: sync-job trigger, `insight_needs` shape, "=" deadband
- **Resolution:**
  - **Neo4j sync-job trigger** — a **scheduled deterministic projection**: low-cadence cron (e.g. hourly)
    rebuilding/incrementally updating Neo4j from `verified_edges`, **plus a manual trigger**. Unlike
    rules-reload (CI-on-change, no cron — IED open item 3), edges *do* need a scheduled job; hourly bounds
    staleness and fits the no-push posture.
  - **`insight_needs` shape** — an **aggregate upsert table** `(metric_key pk, hit_count, last_hit)`, **no
    per-user identifier** (so no RLS/consent), ranked by **decayed hit-count**.
  - **"=" deadband** — a **per-metric z-score band tied to `reliability`**; default symmetric (e.g.
    `|z| < 0.5`), configurable per metric.
- **Grounding:** LINK §6 items 5, 6, §4; MKB §13-Q1; IED open item 3. File 01 M3.
- **Alternative:** event/webhook-driven sync — rejected (link doc commits to no-push; scheduled is
  simpler). Fixed *absolute* deadband — rejected (signal is baseline-relative, must stay per-metric).
- **Cost:** **MNT** small-to-moderate plumbing. **JR** can own the `insight_needs` migration + sync-job
  scaffolding (deterministic, well-scoped).

### M4 · Cold-start via directed LLM sign+polarity extraction, run ON the demo slice
- **Resolution:** Cold-start candidate generation = **cheap directed LLM sign+polarity extraction over
  co-occurring *result* sentences** (signed candidates immediately), **verifier-confirmed, run ON the demo
  slice so the synthesis→verifier pipeline is actually exercised**. Hand-seed a few `provenance:'seed'`
  edges from registry `derivedFrom[]` **only** to avoid an empty graph — never as the demonstrated path.
  Do **not** use unsigned PMI (unstable at 1,200 papers). Demo shows composition **+ a refusal + the
  idiosyncratic branch**.
- **Grounding:** MKB §3.5 #7, §12; PSK §6, §10. File 01 M4 (HACKATHON §0.5 Priority 0).
- **Alternative:** the plan's "hand-authored relationships if needed." Rejected — bypasses the
  paper-synthesis pipeline, the novel part the hackathon scores. PMI rejected (variance-dominated).
  Hand-seeding wins *only* as anti-empty-graph insurance.
- **Cost:** **MNT** — the core Track B demo; moderate (extraction prompt + running on the slice). Small
  incremental over what's already planned since the verifier exists. Highest-leverage risk retired.

---

## LOW

### L1 · Single-engineer concentration — mitigate by scope discipline
- **Resolution:** Flag the concentration, then carve off the deterministic, no-ML work **JR** can absorb:
  the JATS parser (C2 stage 1), the NegEx/ConText assertion module (C2 stage 4), the effect-size regex (C2
  stage 3), the rules loader, the `insight_needs` migration + sync-job scaffolding (M3), and the minimal
  nao-v3 approve/reject surface (H4). Reserve **MNT** for the synthesis/verifier prompts, the three-branch
  engine logic, and the n=1 stats. Alton stays second reviewer on `shared/` PRs. Ship the M4 cold-start LLM
  path **first** as the demonstrable slice to de-risk the XL single-point-of-failure.
- **Grounding:** File 01 L1; PSK §8/§10; Ownership.
- **Alternative:** leave as-is. Rejected — single point of failure on precisely the scored delta.
- **Cost:** This resolution *is* the mitigation — shifts ~a third of deterministic Track B onto **JR**,
  freeing **MNT** for the ML/prompt-shaped work.

### L2 · Keep notability out of the served score
- **Resolution:** State an invariant: **notability** (mentions/citations/venue reach) may rank the
  **seeder queue** and `insight_needs` only — it **never enters the served probability**
  (`edgeScore`/`servingBand`). The contract already separates `impactTier` from `evidenceTier`; add the
  one-line invariant + a guard/test.
- **Grounding:** MKB §7, §10(d); CONTRACT. File 01 L2.
- **Alternative:** let citation count raise served confidence. Rejected — leaks notability into trust; no
  case where it should.
- **Cost:** Near-zero — a stated invariant + a guard test. **MNT** trivial; **JR** can add the test.

---

## Cross-cutting (feeds part 4)

The burden-shifting resolutions cluster on the three people distinctly:
- **FE** absorbs H3 (four card variants) and part of H4 (approve/reject surface).
- **JR** absorbs the deterministic C2 stages, M3 plumbing, and the L2 guard.
- **MNT** retains all LLM/prompt/statistics-shaped work (C1, C2 synthesis, C3, M1, M2, M4).

Two additive `shared/` changes (H2 `lag`/`weight`, M2 dependency-cluster field) each trigger a 2-reviewer
PR (Alton). No signed-edge contract change is needed anywhere.
