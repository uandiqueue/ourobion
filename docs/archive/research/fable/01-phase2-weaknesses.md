> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# PHASE2-PLAN — weaknesses, gaps & vagueness

**Date:** 2026-07-05 · **Status:** Fable research — part 1 of 4.

The weaknesses in [`PHASE2-PLAN.md`](../../../shared/PHASE2-PLAN.md), ranked by severity and read through the two
2026-07-04 research briefs — [`metric-knowledge-bridge`](../2026-07-04-metric-knowledge-bridge.md)
(the semantic bridge) and [`paper-to-structured-knowledge`](../2026-07-04-paper-to-structured-knowledge.md)
(the corpus→graph input side) — plus the runtime-link doc
[`BIOTOPE-NAO-LINK.md`](../../../shared/BIOTOPE-NAO-LINK.md) (on branch `origin/docs/biotope-nao-link-plan`) and the
edge contract [`shared/brain/relationships.ts`](../../../../shared/brain/relationships.ts).

**Framing.** The hackathon scores *the brain* as the delta (HACKATHON_DIRECTION §0, §4.2). The most
severe weaknesses are therefore the ones that either **encode a brain design the briefs prove broken** or
**hide brain-side scope** — those are what a judge scoring the delta actually sees. The through-line: the
plan's brain-side language ("scoped to brain neighbours," "triangulation before firing," "paper → edge
extraction," "hand-authored if needed") consistently describes the *naive* version of each mechanism that
both briefs were written to correct. The plan predates the briefs and hasn't absorbed them; the contract
and the link doc are already the right shape.

---

## CRITICAL

### C1 · Triangulation is encoded as a hard pre-fire gate — the exact design the bridge brief disproves
- **Lives in:** W2 row *"Reliability weighting + triangulation"* ("cross-checks self-report against its
  passive correlate **before firing**"); metric-platform §4 ("a self-report agreeing with its passive
  correlate raises confidence; divergence flags bad data").
- **Why:** Bridge §3.5 #3 — triangulation **cannot be a hard AND-gate**, for two independent reasons.
  (a) *Power asymmetry:* the literature leg is cheap to satisfy, but the personal leg run honestly
  (autocorrelation-corrected N_eff, FDR, effect+CI over ~8 weeks) rarely reaches significance for modest
  real effects, so a hard "both must agree before firing" gate degenerates to *almost nothing fires*.
  (b) *Shared biases:* personal observational data and observational literature carry the *same*
  confounders (season drives both sleep and mood → both agree, both wrong) — this is **consistency, not
  corroboration**, not the Lawlor-style triangulation that needs orthogonal biases. The brief's §9
  replaces the gate with a **three-branch graded signal**. The plan's "before firing" is precisely the
  gate the brief rejects.
- **Consequence:** Built as written, the engine goes silent (the "agree" branch is the *rare* case per
  §9's honest expectation) while every card it does fire overclaims corroboration. The central analytical
  mechanic is designed against its own research.

### C2 · "Paper → edge extraction" collapses a 9-stage cascade into one line — and starts at a stage whose input doesn't exist
- **Lives in:** W2 row *"Paper → rules/edge extraction"*; Track B row *"Edge pipeline — synthesis →
  `quoteCheck` → adversarial verifier → `verified_edges` → Neo4j (XL)"*.
- **Why:** The paper brief is explicit that `tools/brain-ingest/src/extract.ts` **today only flattens a
  paper to one whitespace-collapsed string** (§0, §9) — the anti-pattern. The plan's pipeline *begins at
  synthesis*, silently assuming synthesis receives structured, span-anchored input. The whole
  pre-synthesis funnel is missing: **section segmentation + sentence-role tagging (stage 1, "the
  `extract.ts` upgrade")** and the **assertion/negation gate (stage 4, "the dominant extraction
  error… cannot be left to verifier hope")** are called out as *not designed anywhere* (§7 status column;
  §11 open Q2). Without stage 1, `quoteCheck` has no span offsets and `evidenceTier`/`impactTier` can't be
  set (§1); without stage 4, negated findings ("no association between X and Y") enter synthesis as
  positives (§3 polarity blindness).
- **Consequence:** The XL estimate is optimistic against a pipeline that can't populate its own contract
  fields. Feeding flattened blobs to synthesis reproduces every failure the brief enumerates — the
  delta's headline artifact (a *grounded, tiered* verified edge) is unbuildable as scoped.

### C3 · The idiosyncratic-findings pathway — the product's actual differentiator — is absent, and the plan builds the gate that censors it
- **Lives in:** W2 *"Cross-metric rules … scoped to brain neighbours"*; gate criterion 2; the entire
  §E / presentation-agent row (only the literature-backed path is described).
- **Why:** Bridge §3.5 #4 / §9 branch 3 — a user whose HRV reliably crashes after a specific food/drug is
  an individual responder for whom *by definition no population edge exists*. "Scoped to brain neighbours"
  is the **hard literature-plausibility gate** the brief says "throws away exactly the personalized signal
  a per-user engine should find." The brief calls the idiosyncratic lane ("unusual for you — no research
  match," hypothesis-not-fact) "the product's actual differentiator, not noise." The plan has no lane for
  a strong stable personal correlation with no literature edge.
- **Consequence:** The plan simultaneously omits the one feature distinguishing ourobion from every other
  correlation app *and* hard-codes the mechanism (brain-neighbour scoping) that suppresses it.

---

## HIGH

### H1 · Cold-start dependency ordering isn't honest about what works at zero edges — and "scoped to brain neighbours" contradicts the runtime-link doc
- **Lives in:** Track B (critical path "LLM router → edge pipeline"; "edges unblock nao v2 and
  brain-grounded insights"); gate criterion 2 ("cross-metric cards including an env rule, from real user
  data"); W2 "scoped to brain neighbours."
- **Why:** The brain has **zero edges** (HACKATHON §4.1). Yet BIOTOPE-NAO-LINK §2 states plainly that
  "brain-scoped" cross-metric rules are decided **offline at authoring time** — a human/CLI picks the two
  metric keys using the brain as *reference*, the blueprint is static JSON, and "the engine **never
  touches Neo4j**." So cross-metric cards (gate criterion 2) do **not** require any served edge; only the
  presentation agent's *richer phrasing* does, and that is explicitly degradable (§3 Fallback). The plan
  never says this — its dependency arrows imply the insight product waits behind the XL edge pipeline when
  the deterministic cards do not.
- **Consequence:** Either the team blocks shippable cross-metric insights behind an XL pipeline they don't
  need for the gate, or "scoped to brain neighbours" is read as a live Neo4j dependency that the link doc
  says would break the engine's determinism invariant.

### H2 · The servability boundary — 1-hop-only, monotonic-only, `modulates` unservable — is not acknowledged
- **Lives in:** W2 *"Cross-metric rules … scoped to brain neighbours with configurable lag windows"*; the
  contract's `RelationKind` includes `modulates`.
- **Why:** Bridge §3.5 #1 — **`modulates` (non-monotonic) edges cannot be served from a baseline-relative
  signal at all**: a U-curve (sleep-duration↔mortality) needs the user's *absolute position* on a
  dose-response curve, but biotope emits only baseline-relative direction ("sleep is ↑ *for you*"), and a
  z-score is also baseline-relative, so 5h→6h (protective) is indistinguishable from 8h→9h (harmful).
  §3.5 #2 — multi-hop sign composition collapses to ambiguous at metabolic hubs → **1-hop only**. The plan
  treats "brain neighbours" as a uniform, fully-usable set.
- **Consequence:** Rules authored over `modulates` edges produce directionally wrong predictions presented
  as insights (a non-diagnostic-risk event); effort spent authoring rules the composition can't honestly
  serve. The boundary must be a stated constraint (`modulates` = context-only until biotope supplies an
  absolute-scale reading — bridge §13 open Q2).

### H3 · Presentation agent / UX is one line — the branches, refusal states, and reliability cues are undesigned
- **Lives in:** W2 *"Presentation agent (grounded NL)"*; INSIGHTS-ENGINE-DESIGN §E; gate criterion 4.
- **Why:** The plan describes the agent only mechanically (retrieves subgraph, constrained LLM phrases
  wording, copy-gated, cached, degradable). Bridge §9 says what the user must actually *see* is **four
  distinct branches** — agree (with a shared-confounder caveat in copy), research-context ("seen in
  research; not yet clear in your data" — *the common case*), idiosyncratic ("unusual for you — no
  research match"), and contradiction ("flag for review, never silently drop"). Each needs its own copy,
  label, and reliability/citation cue. §9's honest expectation: day-to-day value comes from the
  research-context and idiosyncratic branches, *not* the rare "agree" jackpot.
- **Consequence:** The built UX has no design for the branches that will dominate what users see, no
  refusal/uncertainty presentation, and no reliability-tier cues — the layer either over-promises or has
  nothing to render for the common cases.

### H4 · Human-review / curation burden is unaccounted, and the curation surface (nao v3) is deferred past when edges first need approving
- **Lives in:** Cross-cutting constraint 1 (support-model training deferred to GMI; "design + data-prep
  only"); W2 "human-reviewed, budget-capped"; W5 *"nao v3 human-in-the-loop curation → Later"*;
  Ownership.
- **Why:** With training deferred, cold-start rides **entirely on LLM extraction + human review** (paper
  brief §10; §8 "HITL on survivors"). The `provenance:'human'` write path exists the moment the pipeline
  emits edges (BIOTOPE-NAO-LINK §4). But the plan sequences the curation tool (nao v3) *after* the edge
  pipeline, never sizes the review labour, never names who curates, and never schedules the surface before
  edges arrive. The scored delta (Track B) leans on one engineer (Jayden).
- **Consequence:** Edges emerge from an XL pipeline with no tool and no owner to approve them on the
  timeline they appear — "human-reviewed" in W2 has no operational backing, and the curation demo ("the
  strongest agentic-app surface," HACKATHON §4.2) slips behind its own inputs.

---

## MEDIUM

### M1 · n=1 statistics, "configurable lag windows," and effect-size commensurability are stated as settled or omitted
- **Lives in:** W2 *"with configurable lag windows"*; INSIGHTS-ENGINE-DESIGN §B1 `correlation` condition
  (`both:[leaf,leaf]`, **no lag field**); gate criterion 2.
- **Why:** "Configurable lag windows" is asserted, but the correlation blueprint has **no lag parameter** —
  it reads two current `baseline_snapshots` rows. More seriously, bridge §9 step 4 requires the personal
  leg run with **honest n=1 statistics** — autocorrelation-adjusted N_eff (Pyper–Peterman), FDR
  (Benjamini–Hochberg), effect size + interval, minimum effective-n — none of which appear in the plan or
  engine design. And bridge §7 / §13-Q5: **effect-size commensurability** (reconciling units/scales/
  populations before corroboration is summed) is an unspecified prerequisite.
- **Consequence:** "Lag windows" is vaporware against the current contract; correlation without N_eff/FDR
  over dozens of active-metric pairs manufactures false-positive cards (the multiple-comparisons problem
  the personal leg is supposed to *control*).

### M2 · Corroboration is treated as a naive count — dependency-aware clustering is ignored
- **Lives in:** Track B "adversarial verifier → `verified_edges`"; contract
  `corroboration:{supporting,contradicting}` (integer counts); the "Brain correctness" risk.
- **Why:** Bridge §3.5 #6 + paper brief §5 — `Σw·support − Σw·contradict` **assumes paper independence,
  which is false**: shared cohorts re-analysed, citation cascades, author overlap all double-count.
  Corroboration must cluster by **independent evidential root** (a citation chain to one origin is *one*
  piece of evidence), which depends on the references-as-graph work (paper brief §5, §11-Q3) the plan
  never mentions. Tier multipliers are "illustrative, not GRADE point-weights."
- **Consequence:** An edge backed by a citation cascade to a single origin scores as N independent
  supports → over-trusted → served at `high`. The plan's only mitigation ("seed conservatively") doesn't
  touch the double-counting mechanism.

### M3 · Runtime plumbing the read path depends on is omitted: Neo4j sync-job trigger, `insight_needs` shape, the "=" deadband
- **Lives in:** W7 "Platform plumbing" (has rules-reload trigger + version stamp, but **no brain sync
  job**); gate criterion 5; W2 presentation agent.
- **Why:** BIOTOPE-NAO-LINK §6 flags three items the plan assumes settled: (5) **the Neo4j sync job's
  trigger/cadence "is not determined"** — yet it is the *only* path by which a written edge reaches
  biotope's read path; (6) **`insight_needs` table shape/ranking undecided** — the feedback signal the
  seeder consumes; and bridge §13-Q1 **the "=" deadband per metric is undefined** (the three-state
  signal's neutral band). None appear in any workstream.
- **Consequence:** Edges can be written and verified but never reach biotope (no scheduled projection);
  the seeder has no defined queue; the state discretization has no neutral band. The read path is
  specified end-to-end *except* for the job that feeds it.

### M4 · The cold-start fallback ("hand-authored relationships if needed") quietly bypasses the pipeline the hackathon scores
- **Lives in:** Risk *"No research corpus edges yet — ships with hand-authored relationships if needed"*;
  Brain-correctness risk.
- **Why:** Bridge §3.5 #7 / §12 and paper brief §6 — hand-seeding to make the bridge demo-able means
  **"the paper-synthesis pipeline — the novel part — is never exercised by the bridge."** HACKATHON §0.5
  Priority 0 makes this the single highest-leverage risk. The brief's alternative — **cheap directed LLM
  sign+polarity extraction over co-occurring *result* sentences**, verifier-confirmed, run on the demo
  slice — is not named in the plan; the plan offers only "hand-authored if needed" with no
  candidate-generation mechanism (PMI is called out as unstable at 1,200 papers).
- **Consequence:** The path of least resistance under time pressure produces a demo that bypasses the
  thesis it's judged on.

---

## LOW

### L1 · The entire scored delta rides on one engineer, and the plan doesn't flag the concentration
- **Lives in:** Ownership ("Track B leans Jayden"); Track B (LLM router + seeder + XL edge pipeline + nao
  v2/v3 + support-model data-prep — all Track B); cross-cutting constraint 1.
- **Why:** The scored delta is Track B in its entirety; with training deferred it is LLM-extraction-plus-
  review — one person's critical path with an XL item and no second reviewer for the brain's own logic
  (Alton is only second reviewer on `shared/` PRs).
- **Consequence:** Single point of failure on precisely the work the hackathon scores; no slack if the XL
  edge pipeline slips.

### L2 · Notability-vs-trust separation for the seeder isn't represented
- **Lives in:** Track B "Agentic seeder"; the "Brain correctness" risk.
- **Why:** Bridge §7 — two decoupled scores: **notability** (mentions/citations, for *surfacing*
  candidates) must **never enter the served probability** (Ioannidis: most-cited ≠ correct). The contract
  already separates `impactTier` from `evidenceTier`, but the plan's seeder description never states that
  its ranking signal is quarantined from serving trust.
- **Consequence:** Minor (the contract mostly protects this), but an unguarded seeder could leak
  citation-count into what reaches users; worth an explicit invariant.

---

## How the resolutions deliverable should treat these

- **Design-substitutions** (swap a broken mechanism for the brief's corrected one): C1, C3, H2, H3.
- **Hidden-scope insertions** (name work the plan collapses or omits): C2, H4, M3.
- **Correctness requirements to state explicitly** (n=1 guards, dependency clustering,
  exercise-the-pipeline cold-start): M1, M2, M4.
- **Team/ownership realities to surface honestly:** H4, L1.
