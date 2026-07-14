> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# PHASE2-PLAN — the revised-plan delta

**Date:** 2026-07-05 · **Status:** ⚠️ **STALE — superseded, kept for history.**

> **Why STALE:** this is a line-by-line diff against `PHASE2-PLAN.md` produced by Wave 1, and it contains
> decisions that were later **reversed**: it adds a Neo4j sync job (later dropped — project straight to the
> force-graph, see `12` §6) and encodes the four-branch observational-language UX (later replaced by the
> attributed-claim register + one surfaced lane, see `06`). The current, decision-complete design is
> [`12-system-architecture.md`](12-system-architecture.md). Do **not** build from this file. See
> [`00-README.md`](00-README.md) for the reading order.

A precise, section-by-section diff to apply to [`PHASE2-PLAN.md`](../../../shared/PHASE2-PLAN.md), driven by the
resolutions in [`02-resolutions.md`](02-resolutions.md) (C1–C3, H1–H4, M1–M4, L1–L2). This is an
actionable delta — WHAT changes, WHERE (exact section/row/phrase), WHY (resolution ID) — not prose.
Line numbers reference the plan as it stands today; treat them as anchors, not guarantees.

---

## Part A — ADDITIONS / CHANGES (plan order)

**1. Location:** Metric platform · §4 "Reliability is a first-class weight" (~line 74), phrase *"triangulate
— a self-report agreeing with its passive correlate raises confidence; divergence flags bad data."*
**REWORD:** "Baselines and insights confidence-weight inputs by source reliability; triangulation is a
**confidence/ranking modulator over four graded branches (agree / research-context / idiosyncratic /
contradiction — see W2)**, never a fire condition. A self-report agreeing with its passive correlate raises
confidence within the *agree* branch; divergence routes to the *contradiction* branch for review, never
silent suppression."
**Why:** C1 — kills the implicit pre-fire AND-gate at its first (platform-level) occurrence.

**2. Location:** Goals table · **G3** row (~line 92), phrase *"…engine evaluates trend/threshold/correlation;
cards can say why they fired."*
**REWORD:** "…engine evaluates trend/threshold/correlation across **four graded signal branches (agree /
research-context / idiosyncratic / contradiction)**; deterministic cross-metric cards ship at zero edges;
cards can say why they fired."
**Why:** C1 + C3 + H1 — the goal statement implies a single triangulated path and an edge dependency,
neither of which hold.

**3. Location:** W2 · row **"Metric-relationship graph (the brain)"** (~line 136), phrase *"projected to
Neo4j for traversal."*
**REWORD:** "projected to Neo4j for **1-hop neighbour lookup** — not multi-hop path traversal; composition
is 1-hop-only, monotonic-only (see Cross-metric rules row)."
**Why:** H2 — drops the path-calculator implication; the graph is a neighbour lookup.

**4. Location:** W2 · row **"Cross-metric rules … scoped to brain neighbours with configurable lag windows"**
(~line 137).
**REPLACE:** "`correlation` condition over 2+ metrics, authored **offline at authoring-time** using the
brain as *reference* (a human or the B4 extract CLI picks `metricKeys` + a `provenance.citation`) into
static `data/rules/cross/**` blueprints — **the engine never touches Neo4j at evaluation time**. Servability
boundary: **1-hop only, monotonic-only**; `modulates` edges retrieve as **context only**, never a composed
directional prediction, until biotope supplies an absolute-scale reading. Blueprint carries a real **`lag`
(+ `weight`) field** — additive to the correlation contract, `shared/` 2-reviewer PR — replacing the
current same-day-only read."
**Why:** H1 + H2 + M1.

**5. Location:** W2 · new row, insert after "Cross-metric rules."
**ADD:** "**Idiosyncratic findings** | A strong, stable personal correlation with **no literature edge**
surfaces as its own branch — 'unusual for you — no research match,' explicitly hypothesis-not-fact. Gated by
n=1 guards (min effective-n + stability window, shared with the statistical evaluator). Never suppressed for
lacking a brain neighbour."
**Why:** C3 — the plan's differentiator is absent and actively censored by brain-neighbour scoping.

**6. Location:** W2 · row **"Data-driven engine"** (~line 138), after *"deterministic, non-diagnostic gates
at load + render."*
**ADD clause:** "Adds a **statistical evaluator**: autocorrelation-adjusted N_eff (Pyper–Peterman), FDR
across the candidate set (Benjamini–Hochberg), effect size + interval, minimum effective-n, and a named (if
minimal-for-slice) effect-size commensurability step before corroboration is summed."
**Why:** M1 — n=1 guards are currently unstated engine requirements.

**7. Location:** W2 · row **"Reliability weighting + triangulation"** (~line 139).
**REPLACE:** "**Three/four-branch graded signal** | Engine confidence-weights inputs by source reliability
and composes the personal (n=1, FDR-controlled) leg against the literature leg into **four branches — agree
/ research-context / idiosyncratic / contradiction** (MKB §9) — never a pre-fire AND-gate. Agreement is
*consistency*, not causal corroboration (both legs share confounders); day-to-day value comes from
research-context + idiosyncratic, not the rare 'agree' case."
**Why:** C1 — the exact row the weaknesses doc names as the disproven design; deletes the "before firing"
gate.

**8. Location:** W2 · row **"Why am I seeing this?"** (~line 140).
**ADD trailing clause:** "…path-traced over the brain (**1-hop only** — see the servability boundary in
Cross-metric rules)."
**Why:** H2.

**9. Location:** W2 · row **"Presentation agent (grounded NL)"** (~line 141) + pointer to INSIGHTS-ENGINE §E.
**REPLACE/EXPAND:** "…retrieves the relevant brain subgraph (**additive, degradable** — richer phrasing is
the only thing that needs served edges; cards themselves ship at zero edges) and a constrained LLM phrases
the wording per the **four branches**: *agree* (shared-confounder caveat — 'consistent with research and
with your data,' not proof); *research-context* ('seen in research; not yet clear in your data' — the common
case, never suppressed); *idiosyncratic* ('unusual for you — no research match,' hypothesis-not-fact);
*contradiction* ('flag for review' — never silently dropped). Each branch carries its own copy, label, and a
reliability/citation cue keyed to `servingBand`. Introduces no relationship/number outside the retrieved
set; copy-gated at render, cached, and **degrades to deterministic templated copy** when the brain read is
empty or fails."
**Why:** H3.

**10. Location:** W2 · row **"Paper → rules/edge extraction"** (~line 142) AND Track B · row **"Edge
pipeline"** (~line 250).
**REPLACE W2 row:** "The ingestion pipeline is a **named cascade**: **stage 1 — section segmentation +
sentence-role tagging** (the `extract.ts` upgrade: JATS/PMC-XML-first, GROBID fallback for PDF-only, emits
character offsets so `quoteCheck` has spans and tiers can be set) → tier(2) → claim+effect+assertion
(**stage 3–4 merged**; stage 4 = the **assertion/negation gate** — rules-based NegEx/ConText + negspacy, no
training, drops negated/speculative findings before synthesis) → synthesis(6) → NLI(7) → verifier(8) →
**human review on survivors only** (disagreement, borderline NLI, ambiguous tier). Stages merged to fight
error compounding (~0.9ᵏ). Full PICO + document-level RE deferred to GMI; **LLM does those extractions at
cold start**."
**REPLACE Track B row:** "**Edge pipeline** — `segment → tier → claim/effect/assertion (merged) → synthesis
→ NLI → verifier → verified_edges store → Neo4j projection`, human-reviewed **on survivors only** | paper
corpus + brain contract + LLM router | XL"
**Why:** C2 — names the two previously-undesigned stages + the merge; narrows "human-reviewed" to
survivors-only (feeds H4).

**11. Location:** W5 · nao phasing table (~lines 179–182), row **"v3 human-in-the-loop curation → Later."*
**REPLACE with two rows:** "**v3a minimal curation slice** | Pulled forward to **when edges first appear**,
not after the pipeline: a bare `provenance:'human'` approve/reject surface over LLM-proposed edges. FE/JR
build item. || **v3b full curation UX** → Later | Batch review, disagreement queues, audit trail — once
survivor-review volume justifies it."
**Why:** H4.

**12. Location:** W7 · Platform plumbing table (~lines 194–199), append rows.
**ADD:** "**Neo4j sync-job trigger** | Scheduled deterministic projection: low-cadence cron (hourly)
rebuilding/incrementally updating Neo4j from `verified_edges`, plus a manual trigger. || **`insight_needs`
table** | Aggregate upsert `(metric_key pk, hit_count, last_hit)`, no per-user identifier (no RLS/consent),
ranked by decayed hit-count — the seeder's queue. || **'=' deadband** | Per-metric z-score band tied to
`reliability`; default symmetric (`|z| < 0.5`), configurable per metric."
**Why:** M3 — the only path a written edge reaches biotope's read path; currently absent from any
workstream.

**13. Location:** Track B intro sentence (~line 242), *"Critical path: LLM router → edge pipeline (edges
unblock nao v2 and brain-grounded insights)."*
**REWORD:** "Critical path: **LLM router → M4 cold-start LLM-extraction slice** (ships first, exercises
synthesis→verifier on the demo slice) **→ edge pipeline** (edges unblock nao v2 + the presentation agent's
richer phrasing — cross-metric cards ship at zero edges, see Gate criterion 2 / W2)."
**Why:** H1 + M4 + L1.

**14. Location:** Track B table (~lines 244–251), new row before "Agentic seeder."
**ADD row** (between "b2 venue lookup" and "Agentic seeder"): "**Cold-start candidate generation (M4
slice)** | Cheap directed LLM sign+polarity extraction over co-occurring *result* sentences,
verifier-confirmed, run **on the demo slice** so synthesis→verifier is actually exercised. A handful of
`provenance:'seed'` edges hand-seeded from registry `derivedFrom[]` **only** as anti-empty-graph insurance,
never the demonstrated path. Not unsigned PMI (unstable at 1,200 papers). | paper corpus + LLM router | M"
**Why:** M4 + H1/L1.

**15. Location:** Track B table, row **"Agentic seeder"** (~line 249).
**ADD trailing clause:** "…notability (mentions/citations/venue reach) ranks this queue and `insight_needs`
**only** — never the served probability (`edgeScore`/`servingBand`)."
**Why:** L2.

**16. Location:** Track B table, row **"Edge pipeline"** (~line 250) — combine with #10's replacement.
**ADD:** "Corroboration clusters by **independent evidential root** before summing (collapse shared
authors/labs, down-weight cite-vs-reproduce, dedupe preprint↔published, flag citation cartels) — additive
dependency-cluster id/count field on `corroboration`, `shared/` 2-reviewer PR. Tier multipliers are
illustrative, not GRADE point-weights."
**Why:** M2.

**17. Location:** "What to start now, and what waits" · **Deferred** bullet (~line 272), *"nao v2/v3 (behind
the edge pipeline)."*
**REWORD:** "nao v2 (behind the edge pipeline); **nao v3a's minimal curation ships when edges first appear —
not deferred with v2**."
**Why:** H4.

**18. Location:** Gate · **criterion 2** (~lines 287–288).
**REPLACE:** "Cards generate for **single AND cross-metric** rules — cross-metric cards run on
**hand-authored static blueprints in `data/rules/cross/**`, satisfiable at ZERO edges** (engine never
touches Neo4j at evaluation) — including at least one env-involving rule and at least one
**idiosyncratic-branch** card gated by the n=1 guards, from real (non-seeded) user data on Android devices."
**Why:** H1 + C3 + M1.

**19. Location:** Gate · **criterion 4** (~lines 290–291).
**REWORD:** "…including any LLM-phrased text **across all four presentation branches (agree /
research-context / idiosyncratic / contradiction)**; `flutter analyze`…"
**Why:** H3.

**20. Location:** Gate — append to criterion list.
**ADD "2a.":** "The notability-vs-trust invariant holds: a guard/test proves the seeder's notability ranking
never influences `edgeScore`/`servingBand`."
**Why:** L2.

**21. Location:** Ownership (~lines 305–306), Track B bullet.
**REWORD/EXPAND:** "…with Alton as second reviewer on the `shared/` PRs (registry v2, brain/rule contracts,
chat contract, **the additive `lag`/`weight` and dependency-cluster fields**). **JR** absorbs the
deterministic, no-ML slice: the JATS parser (C2 stage 1), NegEx/ConText module (C2 stage 4), effect-size
regex (C2 stage 3), rules loader, `insight_needs` migration + sync-job scaffolding (W7), the L2 guard/test,
and the minimal nao-v3a approve/reject surface (with FE) — roughly a third of deterministic Track B, freeing
MNT for LLM/prompt/statistics work (C1, C2 synthesis, C3, M1, M2, M4). The **recurring human-review burden**
(survivor-only curation, H4) is ongoing, not a one-time build cost, shared MNT + JR."
**Why:** L1 + H4.

**22. Location:** Constraints · bullet *"`shared/` changes = 2-reviewer PRs (registry v2, contracts, chat
contract)."* (~line 322).
**REWORD:** "…(registry v2, contracts, chat contract, **the additive correlation-blueprint/edge
`lag`+`weight` fields, the `corroboration` dependency-cluster field**)."
**Why:** H2 + M2.

**23. Location:** Risks · **"Brain correctness"** (~lines 335–336).
**ADD clause:** "…seed conservatively, grow from adversarially-verified extraction; **corroboration must
cluster by independent evidential root before summing — naive counting over-trusts citation cascades** (M2);
**notability ranks the seeder queue only, never the served probability** (L2)."
**Why:** M2 + L2.

**24. Location:** Risks · **"No research corpus edges yet"** (~lines 340–341).
**REPLACE:** "**Cold-start exercises the real pipeline, not a bypass** — candidate generation is cheap
directed LLM sign+polarity extraction over co-occurring result sentences, verifier-confirmed, run **on the
demo slice** (synthesis→verifier actually exercised); a handful of `provenance:'seed'` edges from registry
`derivedFrom[]` only guard against an empty graph, **never** the demonstrated path; unsigned PMI rejected
(unstable at 1,200 papers). nao v2 + richer grounded synthesis wait on the XL edge pipeline; nao **v3a's
minimal curation does not** (H4)."
**Why:** M4.

---

## Part B — REDUCE / REMOVE

- **W2 "before firing" AND-gate** — remove "cross-checks self-report against its passive correlate **before
  firing**" (~line 139) and the platform-level echo at §4 (~line 74). Superseded by the four-branch
  modulator (#1, #7). **Why:** C1.
- **"Traversal" / unbounded brain-neighbour framing** — remove the multi-hop path-composition implication
  (~line 136 "traversal"; the un-hop-bounded "scoped to brain neighbours" ~line 137). Replace with explicit
  1-hop, monotonic-only scoping (#3, #4). **Why:** H2.
- **"Hand-authored relationships if needed" as the cold-start stance** — delete from Risks (~lines 340–341);
  it is the exact bypass the hackathon scoring penalizes. Replace per #24. **Why:** M4.
- **Any phrasing implying cross-metric cards block on the edge pipeline** — remove from the Track B intro
  (~line 242) and soften the diagram's single-terminus framing (~lines 216–217, where "edge pipeline
  ───────┘" feeds MERGE with no earlier branch for deterministic cards). **Why:** H1.
- **"Scoped to brain neighbours" as a hard literature-plausibility gate** — remove as a gating mechanism
  outright (not just reworded); it suppresses the idiosyncratic lane (#5). Retain "brain neighbours" only as
  an authoring-time reference, never a runtime filter. **Why:** C3, H1.
- **Implicit "review everywhere" scope in "human-reviewed, budget-capped"** — narrow to "on survivors only"
  (#10); do not carry the unscoped review-everything phrasing forward. **Why:** H4, C2.

---

## Part C — Migration note

Two changes are `shared/` 2-reviewer PRs (reviewed by Alton per Constraints): the additive `lag`/`weight`
fields on the correlation blueprint + edge contract (H2, feeds M1's lag requirement), and the additive
dependency-cluster id/count field on `corroboration` (M2) — both purely additive, no `RelationKind` change.
Pure doc edits (no code): the C1 triangulation reword, the H2 servability-boundary statement, the H1
gate-decoupling and diagram/critical-path rewording, the M4 risk-line replacement, and the Ownership/L1
carve-out — these remove a mis-designed dependency and name existing intent. New build scope added: the
idiosyncratic-branch engine logic + n=1 statistical evaluator (C3, M1), the four-branch presentation UX
(H3, FE-heavy), the two named pre-synthesis stages (C2 — real, previously-hidden, JR-absorbable), the M4
cold-start extraction slice, the nao-v3a curation surface pulled forward (H4), and W7's
sync-job/`insight_needs`/deadband plumbing (M3). Scope removed: the triangulation AND-gate's wiring (never
built — net reduction) and any live Neo4j-at-evaluation coupling for cross-metric cards (a deleted
dependency). **Net effect:** total engineering scope is roughly flat-to-slightly-larger (mostly making
already-necessary work visible), but the **critical path to a demoable insight card shortens** — gate
criterion 2 no longer waits behind the XL edge pipeline, and the M4 slice de-risks Track B's single point of
failure earlier.
