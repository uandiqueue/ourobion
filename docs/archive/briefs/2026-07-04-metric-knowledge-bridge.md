# Bridging single-metric app data and chaotic paper knowledge — RESEARCH BRIEF

**Date:** 2026-07-04 · **Status:** 🔬 **Research brief / options** — evaluates a proposed design against
the existing contracts + external literature + an adversarial review. Not yet a decision.
**Author:** Jayden (proposal) · Claude (research synthesis) · reviewed by a Fable-model adversarial pass.
**Companion:** [`2026-07-04-paper-to-structured-knowledge.md`](2026-07-04-paper-to-structured-knowledge.md)
(the *input* side — how raw papers become graph-ready). This brief is the *representation/bridge* side.
**Detail it feeds:** [`../nao/BRAIN-DESIGN.md`](../../nao/BRAIN-DESIGN.md) ·
[`../biotope/INSIGHTS-ENGINE-DESIGN.md`](../../biotope/INSIGHTS-ENGINE-DESIGN.md) §E ·
[`../BIOTOPE-NAO-LINK.md`](../../shared/BIOTOPE-NAO-LINK.md) (on the `docs/biotope-nao-link-plan` branch) ·
the merged `shared/brain/relationships.ts` contract.

**Question this brief answers:** we have a defined route for *where paper knowledge goes* and *where app
data goes*, and (on the link branch) *how the two apps connect at runtime* — but **no definition of the
semantic bridge**: how a single-metric app signal and a chaotic literature corpus become one graph that
produces trustworthy insights. This brief takes Jayden's proposed definition, corrects it against the
existing contracts, five external research threads, and an adversarial review, and recommends a
reconciled model — **including where the naive version breaks.**

---

## 0 · TL;DR

- **The reframe that organizes everything:** two layers — a population-level **knowledge layer**
  (literature: *which* relationships are plausible) and a per-user **inference layer** (app data: whether
  a relationship *shows up for you*). The bridge is their **query-time composition.** This is real, but
  (per the review) it is *bookkeeping that clarifies*, not a solution — **the hard problems all live in
  the composition**, and they are enumerated honestly in §3.5.
- **Keep:** the 3-state app signal (as an interface); co-tagging → candidate generation (literature-based
  discovery); tracking supporting *and* rejecting papers (already in the contract); pruning candidate
  generation (but at the *offline authoring* scale, not per-user — §8).
- **Fix:** signed edges, not `(metric,direction)` nodes (the cost is **evidence fragmentation**, a
  constant factor — *not* an "explosion"; §5). Net **quality-weighted, dependency-aware** corroboration,
  not paper count — and cluster by **independent evidential root**, not per paper (§7).
- **Downgrade from a hard rule to a graded signal:** triangulation ("fire only if literature *and*
  personal data agree") **cannot be a hard AND-gate** — it would silence the app, and the two legs share
  biases so agreement isn't true corroboration (§3.5 #3, §9). Use it as a **confidence/ranking modulator**
  with three explicit branches, including a **labelled pathway for idiosyncratic personal findings with
  no literature match** — which are the product's actual differentiator, not noise (§3.5 #4).
- **Composition is 1-hop-reliable only** (multi-hop QPN propagation collapses to ambiguous), and
  **non-monotonic (`modulates`) edges can't be served from a baseline-relative signal at all** — a real
  boundary on what the bridge can do (§3.5 #1–2).
- **Defer** latent embeddings (cold-start; needs a dense graph). Cold-start candidate generation is better
  done by **cheap directed LLM sign+polarity extraction over co-occurring result sentences** than by
  unsigned PMI (unstable at 1,200 papers) (§12).
- **Good news:** `shared/brain/relationships.ts` and `BIOTOPE-NAO-LINK.md` are already the right shape.
  This mostly *confirms* them and fills the composition hole — with eyes open about where it breaks.

---

## 1 · The gap, precisely

- **Biotope** produces, per metric, a **personal baseline + trend**, discretized to three states relative
  to that baseline: **↑ above / = at / ↓ below**. Isolated facts about one metric for one user. **Zero
  relational content.**
- **Nao's corpus** (~1,200 papers) is *unstructured* knowledge: associations, mechanisms, single-metric
  observations, reviews touching dozens of variables — chaotic, not shaped like metrics.
- **The engine's promise** is to *analyse and evaluate*, not merely present. That needs **relations** —
  which neither input supplies: the app gives isolated metrics, the corpus gives prose.
- **The undefined piece:** the structure that turns "sleep is ↑ for this user" + "papers about sleep and
  fatigue" into a trustworthy, cited, reliability-graded insight.

The `docs/biotope-nao-link-plan` branch already answers the *plumbing* (shared auth, shared
`shared/brain` contract, `verified_edges` → Neo4j, the presentation agent as the one live read). It does
**not** answer the *semantics* — this brief.

---

## 2 · The proposal (faithful restatement)

1. Biotope provides baseline + trend per metric, in three states: increase / same / decrease.
2. Categorise papers by **tagging them with metrics** (not relationships) — co-tagging two metrics on one
   paper implies they probably relate. (Distinct from search seeds.)
3. A schema where **each node is a three-state metric** (↑/=/↓), the graph is directed, each **edge is a
   cause** (`sleep↑ → fatigue↓`); each edge stores the papers that support or reject it.
4. A **probability edge**: as more papers involve an edge (regardless of support/reject), its probability
   rises, so it surfaces; low-citation edges stay low and get filtered.
5. Because users submit metrics incompletely, treat each valid trend as an **event**; events prune the
   search. Proposed mechanism: **latent-space / force-directed embedding** where distance encodes
   relatedness (proximity-without-a-link = a missing link), with events as **hyperedges** (star expansion).

Every point has a correct instinct inside it; three carry a load-bearing error. The brief separates them.

---

## 3 · The reframe — two layers, not one graph

| | **Knowledge layer (the brain)** | **Inference layer (the engine, per user)** |
|---|---|---|
| Scope | Population — everyone | One user, right now |
| Source | Literature corpus | The user's logged metrics |
| Nodes | **Metric keys** (`sleep`, `fatigue`) | The user's **active metrics + ↑/=/↓ states** |
| Edges | **Signed, typed relationships**, evidence-weighted | none stored — states *activate* the graph |
| Truth type | TRUTH-tier, rebuildable projection | ephemeral, recomputed per run |

The bridge is the **query-time composition** of the two. This dissolves the *bookkeeping* confusions
(state as node; which graph "events" belong to). It does **not** dissolve the *semantic* problems — those
are §3.5, and they are the real work.

---

## 3.5 · Adversarial review — the seven places the naive version breaks

An independent Fable-model review confirmed the brief's contract facts but found the reasoning thinnest
exactly at the composition. These are now first-class content (and, usefully, honest Approach/Honesty
material):

1. **Non-monotonic (`modulates`) edges cannot be served from a baseline-relative signal.** A
   region-conditioned sign (S+ below an optimum, S− above — e.g. the sleep-duration↔mortality U-curve)
   needs the user's **absolute position** on a population dose-response curve. Biotope emits only
   *baseline-relative* direction ("sleep is ↑ *for you*"), and a z-score is *also* baseline-relative — so
   we cannot tell 5h→6h (protective) from 8h→9h (harmful). **Boundary condition:** the bridge can only
   serve monotonic (`increases`/`decreases`) edges until biotope can supply an absolute-scale reading.
   `modulates` edges surface as context, never as a composed directional prediction.
2. **Multi-hop sign composition collapses to "ambiguous."** QPN fan-in of mixed `+`/`−` yields `S?`
   (Wellman's documented weakness), and metabolic hubs (fatigue, HRV, CRP, mood) have many signed
   parents — so multi-hop products are ambiguous almost everywhere. **Commit to 1-hop composition only**
   (which is exactly what `BIOTOPE-NAO-LINK.md`'s 1-hop retrieval already does); drop the
   "multiply-along-paths" framing. The graph is a *neighbour lookup*, not a path calculator.
3. **Triangulation is not a valid hard AND-gate.** Two failures compound: (a) **power asymmetry** — the
   literature leg is cheap to satisfy; the personal leg, run honestly (autocorrelation-corrected N_eff,
   FDR, effect+CI, ~8-week window) rarely reaches significance for modest real effects, so a hard gate
   degenerates to *almost nothing fires* — a product failure, not a virtue. (b) **The two legs share
   biases** — personal observational data and observational literature have the *same* confounders
   (season drives both sleep and mood → both agree, both wrong). That is **not** Lawlor-style
   triangulation, which requires *orthogonal* biases. So agreement buys less than claimed. → §9 recasts
   triangulation as a **graded prior**, not a gate, and treats the personal leg mainly as
   multiple-comparisons **noise control**, not causal corroboration.
4. **A hard literature-plausibility gate censors the app's differentiator.** A user whose HRV reliably
   crashes after a specific food/drug is an *individual* responder — by definition **no population edge
   exists**. Blanket-suppressing "personal correlation with no literature match" throws away exactly the
   personalized signal a per-user engine should find. → §9 adds a distinct, clearly-labelled pathway for
   strong, stable idiosyncratic findings ("unusual for you — no research match").
5. **"Explosion" was rhetorical inflation.** Stateful nodes are `3n` nodes / `~3m` edges — a **constant
   factor**, linear, not exponential. The real cost is **evidence fragmentation** (§5) — lead with that.
   And the O(n²) *pair* search is over the user's **active** metrics (dozens: 50 → 1,225 pairs, trivially
   enumerable), so **at query time a flat scan + servingBand filter is fine**; spreading-activation /
   PageRank machinery is premature there. Traversal/candidate-generation matters at the **offline
   authoring** scale (the full metric catalogue), not the per-user read (§8).
6. **Net corroboration must be dependency-aware, and GRADE has no point-weights.** `Σ w·support −
   Σ w·contradict` assumes paper independence — false (shared cohorts re-analysed, citation cascades,
   author overlap double-count). Cluster by **independent evidential root** (ties directly to the
   citation-linking work in the companion brief) before summing. The tier multipliers (in-vitro 0.1 …
   meta 1.0) are **illustrative, not "the GRADE hierarchy"** (GRADE is qualitative up/downgrade). And
   net corroboration presupposes an **effect-size commensurability** step (reconciling units/scales/
   populations) that must be specified (§7).
7. **Cold-start: PMI is unstable and the demo can bypass the thesis.** Document-level PMI over 1,200
   papers leaves most pairs with counts 0–3 (variance-dominated; needs add-k/shrinkage). Worse,
   hand-seeding edges to make the bridge demo-able means the *paper-synthesis pipeline — the novel part —
   is never exercised by the bridge.* → §12: prefer **cheap directed LLM sign+polarity extraction over
   co-occurring result sentences** (gives *signed* candidates immediately, verifier-confirmed) and run it
   on the demo slice so the pipeline is actually exercised.

---

## 4 · Point-by-point verdict (updated post-review)

| # | Proposal | Verdict | Why (short) |
|---|---|:--:|---|
| 1 | 3-state app signal | ✅ **Keep as interface** | Correct contract; define the "=" deadband; keep magnitude+confidence. **But** it cannot serve non-monotonic edges (§3.5 #1). |
| 2 | Co-tag ⇒ relationship | 🟡 **Candidate generation only** | Literature-based discovery: high-recall, low-precision; never the edge/direction/cause itself (§6). |
| 3 | (metric,state) nodes; store support/reject | 🔴 **Fix nodes; keep support/reject** | Signed edges + 1-hop composition. Fragmentation, not explosion. Support/reject already = `Citation.stance` + `corroboration` (§5, §7). |
| 4 | Probability ∝ paper count | 🔴 **Invert & make dependency-aware** | Net quality-weighted corroboration, clustered by independent root; notability ≠ trust (§7). |
| 5 | Events → embeddings/hyperedges | 🟡 **Right goal, wrong+premature mechanism** | Prune by 1-hop graph scoping (offline authoring); query-time is a flat scan; embeddings deferred; events are *activations*, not literature hyperedges (§8). |

---

## 5 · Knowledge representation — signed edges, 1-hop composition

**Option B (signed edges) is correct**, confirmed by four literatures: **Qualitative Probabilistic
Networks** (Wellman 1990; sign propagation, Druzdzel & Henrion 1993); **QSIM** (Kuipers 1986/1994 —
*one* monotonic constraint `M−(sleep,fatigue)` licenses both directions); **signed directed graphs**
(effect = product of edge signs); **causal Bayesian networks** (Pearl 1988/2000 — a QPN is the
qualitative abstraction).

**The cost of stateful `(metric,state)` nodes is evidence fragmentation, not explosion:**

| | Nodes | Edges | Evidence per relationship |
|---|---|---|---|
| **A — stateful** | 2n–3n (constant factor) | ~2m–4m | **fragmented across 2–4 edges** |
| **B — signed** | n | m | **pooled on 1 edge** |

`sleep↑→fatigue↓` and `sleep↓→fatigue↑` are **one physiological fact**. Stateful nodes split every
citation/weight/confidence for it across two edges — halving power, forcing hand-mirrored updates, and
permitting contradictory signs for one fact. A signed edge pools it. Composition recovers directional
queries: `observed ⊗ edge_sign` — but **1-hop only** (§3.5 #2), and **not for `modulates`** (§3.5 #1).

**Maps onto the existing contract as-is:** `RelationKind` *is* the sign (`increases`=S+, `decreases`=S−,
`no_effect`=S0, `modulates`=non-monotonic, `correlates`/`confounds`=direction-agnostic). **No contract
change needed.** Optional additive: an edge `weight` + `lag`. Record: signs discard magnitude/threshold/
lag — keep numeric weight + lag on the edge; edge orientation is a causal claim (from verified
literature, never co-movement).

---

## 6 · Corpus → edges — co-tagging is candidate generation, not truth

The instinct is **literature-based discovery** (Swanson's ABC model: fish-oil→Raynaud's 1986;
magnesium→migraine 1988; ARROWSMITH 1997). Co-tagging is **high-recall, low-precision** — it nominates
pairs to investigate; it does not establish existence, direction, or causality. Failure modes (all caught
by the verification stage):

1. **Review-paper O(n²) explosion** — a 40-metric review fabricates 780 pairs. The dominant noise source.
2. **Mention-in-passing / methods / covariates.**
3. **Promiscuous-node confounding** — age, BMI, CRP co-occur with everything.
4. **Polarity blindness** — "no association between X and Y" co-occurs identically to a positive finding.

For scale: even careful semantic extraction (SemRep/SemMedDB) benchmarks ~0.55 precision / 0.34 recall
(Kilicoglu et al. 2020); document-level co-occurrence sits below that. **Recommendations:** use co-tagging
only to *nominate*; weight by an association measure with **smoothing** (PMI/log-likelihood/Jaccard +
add-k — §3.5 #7), penalise promiscuous metrics + cap papers contributing > N metrics; prefer
sentence/section-scoped co-occurrence; **verify every survivor independently** (the existing
synthesis→`quoteCheck`→verifier pipeline — polarity/negation filtered *there*); evaluate by **time-slice**
(Yetisgen-Yildiz & Pratt 2009). See the companion brief for the extraction detail.

---

## 7 · Trust vs. notability — corrected scoring

Proposal §4 inverts trust (counting a contradicting paper as positive) and commits the **vote-counting
fallacy** (Borenstein et al. 2009). Two decoupled scores:

1. **Notability (recall / surfacing)** — monotonic in mentions/citations/venue reach. Nominates
   candidates only. Count raising notability is fine.
2. **Evidence-quality (validity / serving)** — the number you trust. Per-source design-tier weight
   (**illustrative, not GRADE point-weights** — GRADE is qualitative: Guyatt et al. 2008), scaled by
   risk-of-bias/precision; **net signed evidence clustered by independent evidential root** (not per
   paper — shared cohorts/citation-cascades/author-overlap double-count: §3.5 #6), logistic-squashed, with
   penalties for heterogeneity / publication-bias asymmetry / indirectness. Prerequisite: an **effect-size
   commensurability** step. A single meta-analysis outweighs many weak papers; contradictions pull below
   0.5.

**Already the merged contract:** `Citation.stance`, net `corroboration.{supporting,contradicting}`,
`evidenceTier` separate from `impactTier`, `edgeScore`/`servingBand`. So §4 should be *dropped*, not
built — plus the dependency-clustering + commensurability additions above. Notability may be *added* as a
separate seeder surfacing score; it must never enter the served probability. (Ioannidis *JAMA* 2005:
most-cited ≠ correct.)

---

## 8 · Search pruning — two different scales

- **Offline authoring scale (the full metric catalogue, hundreds of metrics → O(n²)):** *here* candidate
  generation matters. Use the **co-occurrence candidate index** (§6) + registry `derivedFrom[]` +
  `insight_needs` to decide which pairs the synthesis pipeline investigates. Optional 1-hop graph scoping
  once edges exist. **Not** latent embeddings — cold-start (near-zero edges) makes latent positions
  unidentifiable; they beat cheap heuristics only at avg-degree ≳ 5 and thousands of edges (Liben-Nowell
  & Kleinberg 2007; Hoff et al. 2002; Bordes et al. 2013). Adamic-Adar/resource-allocation *as edges
  accrue*; embeddings much later, if ever.
- **Per-user query scale (the user's *active* metrics, dozens):** the O(n²) worry is overstated (§3.5 #5).
  50 active metrics = 1,225 pairs — a **flat scan filtered to `servingBand ∈ {high,mid}` neighbours** is
  simplest and sufficient. Spreading activation / personalized PageRank (Collins & Loftus 1975; Crestani
  1997; Haveliwala 2002) is available if the active set ever grows large, but is premature now.
- **On "events as hyperedges":** an event (metrics co-moving in *one user's* logs) is evidence in a
  *personal* graph, not the *literature* graph — using personal co-movement to propose literature edges is
  a category error at n=1. **Events are activations over the knowledge graph, not hyperedges added to
  it.** The hyperedge/embedding idea is a credible Phase-3 Insight-Lab / population-mining feature — park
  it there.

---

## 9 · The bridge — composition as a graded signal (not a gate)

Revised per the review. The personal leg **modulates confidence and controls false positives**; it is not
a hard AND-gate, and it is not causal corroboration.

1. **App emits states.** Per active metric: `↑ / = / ↓` (+ underlying effect size + confidence; "=" a
   defined deadband).
2. **Retrieve 1-hop neighbours.** From the knowledge graph, `servingBand ∈ {high,mid}`, flat scan over
   active metrics — the personalized candidate set (§8). **Monotonic edges only** compose directionally;
   `modulates` edges are retrieved as context, not predictions (§3.5 #1).
3. **Predict by 1-hop sign composition.** `observed ⊗ edge_sign` → expected partner direction.
4. **Check the user's own data.** The deterministic correlation evaluator tests the relationship over a
   lag window on personal data, with **honest n=1 statistics**: autocorrelation-adjusted N_eff (Pyper &
   Peterman 1998), FDR across the candidate set (Benjamini–Hochberg 1995), effect size + interval,
   minimum effective-n.
5. **Three explicit branches (not one gate):**
   - **Literature ✓ + personal ✓ (agree):** highest-confidence card. *Caveat, stated in copy:* both legs
     are observational and may share confounders (season, illness) — this is consistency, **not** proof
     (§3.5 #3). Frame as "consistent with research and with your data."
   - **Literature ✓ + personal absent/weak:** surface as **general research context**, clearly labelled
     "seen in research; not (yet) clear in your data." This is the common case — do *not* suppress it, or
     the app goes silent (§3.5 #3a).
   - **Personal ✓ + no literature edge:** the **idiosyncratic pathway** (§3.5 #4). If the personal
     correlation is strong, stable, and survives the n=1 guards, surface it as **"unusual for you — no
     research match,"** explicitly hypothesis-not-fact. This is a feature, not noise — and its own
     labelled lane keeps it from masquerading as science.
   - **Literature ✓ but personal *contradicts* the predicted sign:** the most informative case — flag for
     review (possible data issue, confounder, or a genuine individual exception); never silently drop.
6. **Explain + phrase.** The presentation agent retrieves the edge's quote spans/citations and phrases a
   **grounded, copy-gated, non-diagnostic** card (`BIOTOPE-NAO-LINK.md` §3) — observational language only,
   no "causes/will/should/treat."

**Honest expectation:** with proper n=1 statistics, the "agree" branch will fire rarely; the product's
day-to-day value comes mostly from the *research-context* and *idiosyncratic* branches. Design the UX
around that, not around a triangulation jackpot.

---

## 10 · Reconciliation with what exists

- **`shared/brain/relationships.ts` (merged):** signed edges, tier separation, net corroboration, `stance`,
  `modulates` — **no contract change**. Additive: edge `weight`+`lag`; dependency-cluster field for
  corroboration.
- **`BIOTOPE-NAO-LINK.md`:** runtime read path (1-hop retrieval, grounded phrasing, brain informs
  *authoring* not live evaluation). This brief supplies the composition semantics — and confirms 1-hop was
  the right call (§3.5 #2).
- **`INSIGHTS-ENGINE-DESIGN.md`:** the `correlation` blueprint + deterministic evaluators are steps 3–4;
  add the three-branch logic + n=1 guards as engine requirements.
- **Companion brief** (`2026-07-04-paper-to-structured-knowledge.md`): the corpus→edge extraction that
  populates the knowledge layer, including the independent-evidential-root clustering §7 depends on.

**Genuinely new / to decide:** (a) the three-branch composition (not a hard gate); (b) the idiosyncratic
pathway + its copy; (c) 1-hop-only + monotonic-only servability boundary; (d) notability-vs-trust split
for the seeder; (e) dependency-aware corroboration + commensurability; (f) n=1 guards (N_eff, FDR) as
engine requirements.

---

## 11 · The two "explosion" worries, answered honestly

- **State "explosion":** a misnomer — stateful nodes are a linear constant factor. The real reason to use
  signed edges is **evidence fragmentation** (§5).
- **Search "explosion":** real only at *offline authoring* scale (full catalogue); handled by co-occurrence
  candidate generation + 1-hop scoping. At *per-user query* scale (dozens of active metrics) it's a
  trivial flat scan — no embeddings, no activation machinery needed now (§8).

---

## 12 · Cold-start recommendation for the hackathon slice

1. Hand-seed a few `provenance:'seed'` edges from registry `derivedFrom[]` so the graph isn't empty —
   **but do not stop there.**
2. **Run the actual synthesis→verifier pipeline on the demo slice** so the novel part is exercised (§3.5
   #7). For candidate generation, prefer **cheap directed LLM sign+polarity extraction over co-occurring
   *result* sentences** (signed candidates immediately) over unsigned PMI (unstable at 1,200 papers;
   needs add-k smoothing if used).
3. Implement **1-hop sign composition + the three-branch logic** (§9) on that slice.
4. Show the composition *and* a refusal *and* the idiosyncratic branch — a demo that includes its own
   false-negative story reads as confidence.
5. **Do not** build embeddings, latent spaces, or stateful nodes. Declaring them *considered and
   deferred* (with the cold-start reasoning) is the Approach-pillar win — but don't over-claim the
   deferral itself as an achievement.

---

## 13 · Open questions

1. **"=" deadband** per metric (z-score band; ties to `reliability`).
2. **Absolute-scale readings** — can biotope ever supply the absolute position needed to serve
   `modulates` edges (§3.5 #1)? If not, they stay context-only.
3. **Idiosyncratic-pathway thresholds** — how strong/stable must a no-literature personal correlation be
   to surface, and exactly how is it labelled (§9)?
4. **Dependency clustering** — how are independent evidential roots computed (author/cohort/citation
   overlap — see companion brief §5)?
5. **Effect-size commensurability** — where does unit/scale/population reconciliation happen before
   corroboration is summed (§7)?
6. **`insight_needs` ↔ co-tagging** — one ranked seeder queue or separate signals?

---

## 14 · Sources (external research)

- **Signed/qualitative graphs:** Wellman (QPNs) *AI* 1990; Druzdzel & Henrion AAAI 1993; Kuipers (QSIM)
  *AI* 1986 & MIT Press 1994; Pearl 1988 / 2000.
- **Literature-based discovery:** Swanson 1986/1988; Swanson & Smalheiser (ARROWSMITH) *AI* 1997;
  Kilicoglu et al. (SemMedDB) *Bioinformatics* 2012 & (SemRep eval) *BMC Bioinformatics* 2020; Jenssen et
  al. (PubGene) *Nat. Genet.* 2001; Yetisgen-Yildiz & Pratt 2009.
- **Evidence aggregation:** Borenstein et al. 2009 (vote-counting); Guyatt et al. (GRADE) *BMJ* 2008;
  DerSimonian & Laird 1986; Higgins et al. (I²) *BMJ* 2003; Ioannidis *JAMA* 2005 & *PLoS Med* 2005;
  Egger et al. *BMJ* 1997.
- **Link prediction / cold start:** Hoff, Raftery & Handcock *JASA* 2002; Bordes et al. (TransE) 2013;
  Grover & Leskovec (node2vec) 2016; Liben-Nowell & Kleinberg 2007; Lü & Zhou 2011; Church & Hanks (PMI)
  1990.
- **Activation / pruning / n=1:** Collins & Loftus 1975; Crestani 1997; Haveliwala (PPR) 2002; Edge et al.
  (GraphRAG) 2024; Benjamini & Hochberg (FDR) 1995; Pyper & Peterman 1998; Lawlor, Tilling & Davey Smith
  (triangulation) *IJE* 2016 — *cited with the caveat (§3.5 #3) that shared-bias legs are not valid
  triangulation*; Schork 2015; Kravitz & Duan / AHRQ 2014.

*Synthesized from five parallel research passes + one adversarial (Fable) review, 2026-07-04. Some older
page numbers (Zucker, Pyper–Peterman) unverified against primary PDFs — confirm before external
publication.*
