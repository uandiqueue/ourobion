> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# PHASE2-PLAN research pack (parts 1–4) — independent audit

**Date:** 2026-07-05 · **Status:** Fable independent audit of parts 1–4.

**Verdict: ADOPTABLE WITH FIXES.** The four docs are analytically strong and, on the substance, faithful
to the two 2026-07-04 briefs, the contract, and PHASE2-PLAN. The weakness→resolution→delta→roles chain is
complete (all 13 IDs traced end-to-end, no orphans), the load-bearing contract claim ("no
`RelationKind`/signed-edge change") is *true*, and the maintainer single-point-of-failure is flagged
honestly. But five issues must be fixed before adoption: a **team-model contradiction with the plan's own
Ownership section**, an **unacknowledged conflict with the standing "drop Neo4j" rescope call** while the
pack *adds* Neo4j scope, **open questions from the paper brief presented as settled JR deliverables in a
no-Python repo**, a **"scope is roughly flat" claim that under-counts net-new build**, and **pervasive
citation mislabelling** (HACKATHON vs HACKATHON_DIRECTION). None of these invalidate the analysis; all
distort feasibility or provenance and are cheap to fix.

---

## What holds up (verified against ground truth)

Stated up front so the findings below are read as fixes, not a takedown.

- **Contract claims are accurate.** `relationships.ts` `RelationKind` is unchanged by every resolution;
  `lag`/`weight` and the `corroboration` dependency-cluster field are genuinely *additive* (no such fields
  today). `edgeScore`/`servingBand` are correctly described (they live in `shared/brain/index.ts`, return
  `high`/`mid`/`hold`, `hold` never served) — the pack treats them as contract surface, which is fair since
  `shared/brain/` is the contract module. The L2 invariant is even stronger than claimed: `edgeScore()`
  **already excludes `impactTier`**, so "notability never enters the served probability" is substantially
  enforced in code today (doc 1 L2 slightly undersells this, saying only "the contract mostly protects
  this").
- **Plan quotes are accurate.** The triangulation "before firing" gate (W2 + §4), the "synthesis →
  quoteCheck → adversarial verifier → verified_edges → Neo4j (XL)" edge-pipeline row, "scoped to brain
  neighbours with configurable lag windows", IED §B1 `correlation` with `both:[leaf,leaf]` and **no lag
  field**, and W7 having a rules-reload trigger but **no brain sync job** — all verified verbatim.
- **Brief representation is faithful.** MKB §3.5 #1–7, §9's four branches, the "agree fires rarely" honest
  expectation, PSK §0/§7/§8's cascade and the two undesigned stages (segmentation, assertion gate) are
  represented without distortion. LINK §2 ("never touches Neo4j"), §4 (three provenance writers), §6 items
  5/6 (sync-job trigger and `insight_needs` shape both undecided) all check out on the
  `origin/docs/biotope-nao-link-plan` branch.
- **Traceability is complete.** Every weakness (C1–C3, H1–H4, M1–M4, L1–L2) has a resolution; every
  resolution lands in the doc-3 delta (mapped by `Why:` tag); doc 4's role split matches doc 2's
  cross-cutting section and doc 3 #21. No weakness is raised-then-dropped; no resolution is stranded.

---

## Findings (ranked by severity)

### F1 · HIGH — The team model contradicts PHASE2-PLAN's Ownership; the delta never reconciles it
**Docs:** 02 header + Cross-cutting; **04 (a)/(b) team block + role tables**; **03 #21.**
**Dimensions:** factual accuracy, internal consistency, feasibility.

Doc 4 defines the team as **FE** (an unnamed Flutter/UI dev), **MNT** (Jayden), **JR** (junior backend),
and states plainly: *"Alton is an external `shared/` second-reviewer only."* PHASE2-PLAN Ownership (lines
303–306) says the opposite: **"Track A (biotope) leans Alton (Flutter UI, M3 sensors/semi-passive)"** — i.e.
Alton is the primary front-end/Track-A owner, *and* second reviewer on `shared/` PRs. The plan names only
two builders (Alton, Jayden); the pack silently (a) introduces a third person (JR — fine, matches the real
team) but also (b) **demotes Alton from Track-A lead to "reviewer only"** and hands the entire front-end
load (the four-branch UX H3, the idiosyncratic card, the nao-v3a surface) to an unnamed "FE".

Two problems compound:
- **The doc-3 delta doesn't fix it.** #21 rewrites only the *Track B* ownership bullet (adding JR); it never
  touches "Track A leans Alton (Flutter UI)" and never writes "FE" into the Ownership section. Apply the
  delta as written and the plan still says Alton owns Track-A Flutter while doc 4 says a different FE builds
  the UX. The pack's central allocation logic is not actually written back into the plan it revises.
- **It hides a real feasibility risk.** If "FE" *is* Alton, then the person building the moderate-to-large
  four-branch UX (H3) is the same person already owning **all of Track A** (metric waves, env/M4, community,
  M3 sensors, semi-passive fetch). Doc 4 costs H3 as an isolated "main FE item"; it is not isolated if FE =
  Alton. The FE is potentially as overloaded as the MNT the pack rightly worries about — but the pack only
  audits MNT concentration, never FE concentration.

**Fix:** State the team model explicitly and reconcile it with PHASE2-PLAN. Either (a) FE = Alton — then
correct doc 4's "external reviewer only" line and audit FE's Track-A + H3 combined load the way MNT's is
audited; or (b) FE is a distinct new person — then doc-3 #21 must rewrite the Track-A Ownership bullet too,
and note the plan's stated ownership is superseded.

### F2 · HIGH — Paper-brief OPEN questions are presented as settled JR deliverables, in a no-Python repo
**Docs:** 02 C2, L1; **03 #10, #21; 04 (a) JR list, (b) feasibility read.**
**Dimensions:** feasibility/over-reach, honesty, completeness.

The pack assigns JR: a **JATS parser + GROBID fallback**, a **NegEx/ConText (+ negspacy)** assertion gate,
and an effect-size regex — described as "rules/lookups, no ML… ships now" and folded into the "JR-absorbable
~third of Track B." Two constraints the source brief raised are dropped:
- **PSK §11-Q1 is an OPEN question, not a settled choice:** *"is GROBID (a Java service) acceptable given
  the 'no Python, TS-first' rule?… confirm the ops posture."* IED line 22 states the repo rule outright:
  **"ourobion uses no Python."** GROBID is a Java service; **negspacy is a spaCy (Python) component**.
  Presenting "NegEx/ConText (+ negspacy)" and "GROBID fallback" as a ready JR module elides both the
  unresolved ops-posture question and a direct collision with the no-Python rule.
- **PSK §11-Q2 is also open:** the assertion gate "*needs a home (a support model vs a rules-only TS
  module)*." The pack resolves this to "rules-based TS, ships now" but via a Python-flavoured toolchain,
  without noting it is deciding an open question or that a TS reimplementation of NegEx/ConText is real
  build work — not the near-free "no training ⇒ trivial" it reads as.

Doc 4 (b) explicitly defends feasibility on the GPU axis ("no GPU anywhere") but never addresses the
language/ops axis, which is the actual landmine for a junior dev. The conflation of "no training" with
"cheap/settled" understates JR's load and the L1 mitigation's reliability.

**Fix:** Flag §11-Q1/Q2 as open in doc 2 C2 and doc 4. Commit to a **TS-native** assertion gate (drop
negspacy; NegEx/ConText as TS rules) or explicitly accept a Java GROBID sidecar as an ops exception, and
re-size JR's C2 share accordingly. Prefer **JATS/PMC-XML-only for the slice** (no GROBID) to sidestep the
question entirely, as the pack's own "JATS-first" preference already implies.

### F3 · MEDIUM-HIGH — Adds Neo4j sync-job scope while ignoring the standing "drop Neo4j" rescope call
**Docs:** 02 M3; **03 #3, #12; 04 (a) JR M3 plumbing, (c) degradation.**
**Dimensions:** completeness, feasibility, internal consistency (with a cited source).

Doc 2 M3 / doc 3 #12 add a **new Neo4j sync job** (hourly cron + manual trigger) as W7 plumbing, owned by
JR, and #3 keeps "projected to Neo4j for 1-hop neighbour lookup." But HACKATHON_DIRECTION **Priority 2**
(a source the pack cites elsewhere) says: *"**Drop Neo4j from the delta** — project the truth store straight
into the force-graph… At ~dozens of edges a graph DB reads as complexity-for-its-own-sake. **Rescoping call:
default to dropping it.**"* The pack sides with PHASE2-PLAN/LINK/BRAIN-DESIGN (keep Neo4j) — a defensible
choice — but **never acknowledges the explicit contrary recommendation**, and instead grows Neo4j scope.
For a 3-person, depth-first hackathon slice this is exactly the "breadth before depth" the direction doc
warns against, and it is net-new JR work that may be unnecessary.

**Fix:** Add one line reconciling with HACKATHON_DIRECTION Priority 2 — either adopt "drop Neo4j, project
straight to the force-graph for the slice" (removing the sync-job scope from M3/#12 entirely) or justify
keeping it at demo scale. Do not add the hourly sync job silently.

### F4 · MEDIUM — "Total scope roughly flat" under-counts net-new build
**Docs:** 03 Part C ("Net effect"); **04 intro + (b).**
**Dimensions:** honesty, over-claiming.

Doc 3 Part C concludes *"total engineering scope is roughly flat-to-slightly-larger (mostly making
already-necessary work visible)."* The additions are substantial and largely genuinely new: an n=1
statistical evaluator (N_eff/FDR/effect-size/commensurability), a four-branch presentation UX, the two
pre-synthesis cascade stages, the M4 cold-start slice, nao-v3a pulled forward, and W7 sync-job/`insight_needs`/deadband
plumbing. The *offsetting* removals are almost entirely notional — the triangulation AND-gate "was never
built" (so removing it reduces no real work) and the "Neo4j-at-evaluation coupling" is a deleted design
line. Netting real new build against never-started work to call it "flat" buries the trade-off. The honest
statement is: **real build scope grows meaningfully; the critical *path* shortens** (which the pack does say,
and is the stronger, true claim).

**Fix:** Reword to "net build scope grows (statistical evaluator, four-branch UX, two cascade stages, M4
slice, curation surface, W7 plumbing); the removals are mostly work that had not started. The win is a
**shorter critical path to a demoable card**, not lower total effort."

### F5 · MEDIUM — Citation mislabelling: "HACKATHON §x" for content that lives in HACKATHON_DIRECTION
**Docs:** 01 framing, H1, H4, M4 (and downstream references).
**Dimension:** factual accuracy.

Sections §0.5/§4.1/§4.2 do **not** exist in `HACKATHON.md` (the raw challenge rules — unnumbered prose);
they are in `HACKATHON_DIRECTION.md`. Doc 1 cites "HACKATHON §4.1" (zero edges), "HACKATHON §4.2"
(strongest agentic-app surface), and "HACKATHON §0.5 Priority 0" — all mislabelled; the same doc *correctly*
writes "HACKATHON_DIRECTION §0, §4.2" in its framing line, so this is inconsistency, not ignorance. The
*content* is right: HACKATHON_DIRECTION §4.1 does say "*Zero edges exist*", §4.2 item 8 calls curation the
"Strongest agentic-app demo angle", and §0.5 Priority 0 is "protect the eval." Two minor content notes: (a)
"the strongest agentic-app surface" is verbatim from **PHASE2-PLAN W5**, not §4.2 (a paraphrase there); (b)
Priority 0 is about *shipping observed eval artifacts generally*, so "makes [hand-seeding bypass] the single
highest-leverage risk" is a reasonable but slightly over-tight reading of it.

**Fix:** Global replace the three "HACKATHON §x.x" refs with "HACKATHON_DIRECTION §x.x"; attribute the
"strongest agentic-app surface" quote to PHASE2-PLAN W5.

### F6 · LOW-MEDIUM — Two source-brief threads and two direction-doc brain corrections are dropped
**Docs:** 02 M2, M4; whole pack.
**Dimension:** completeness.

- **PSK §5 corpus-expansion half is lost.** M2 correctly adopts §5's *corroboration-by-independent-root*
  clustering, but §5's other half — **snowballing + SPECTER/SciNCL retrieval to find more papers** — is
  never carried into the delta (the seeder still only reads `derivedFrom[]`/`insight_needs`). Defensible as a
  slice cut, but it is an *unacknowledged* cut, presented as if M2 covers all of §5.
- **HACKATHON_DIRECTION Priority 2's brain-side corrections are absent.** The direction doc flags
  `edgeScore` weights + `EDGE_GATES` (0.8/0.5) as "unjustified magic numbers" needing calibration, and the
  `independentRetrieval` boolean as self-reported (needs binding `performed:true → sources ≥ 1`). Doc 1
  reads PHASE2-PLAN "through the briefs" and cites the direction doc, so these known brain weaknesses are in
  scope, yet neither appears in the weaknesses or resolutions.

**Fix:** Add a one-line "explicitly deferred for the slice" note for §5 corpus expansion, and either fold
the two Priority-2 brain corrections into doc 1/2 or note they are tracked elsewhere.

### F7 · LOW — Minor amplifications and unsourced illustrative numbers
**Docs:** 01 C3 consequence; 04 (c).
**Dimension:** honesty/over-claiming (mild).

- Doc 1 C3 escalates the brief's "the product's actual differentiator, not noise" (MKB §3.5 #4) to "the one
  feature distinguishing ourobion from **every other correlation app**" — a stronger, unsourced claim.
- Doc 4 (c) states "~5 neighbours/metric" for the 1-hop subgraph; this figure is not in MKB/PSK/the contract
  (LINK may support it, unverified here). Harmless as illustration but should be marked as such.

**Fix:** Soften C3's "every other correlation app" to the brief's wording; mark "~5 neighbours" illustrative.

---

## Prioritized required fixes

1. **(F1) Reconcile the team model with PHASE2-PLAN Ownership.** Decide whether FE = Alton or a new person;
   correct doc 4's "Alton = reviewer only" line accordingly; make doc-3 #21 rewrite the *Track-A* Ownership
   bullet, not just Track B. If FE = Alton, add an FE-concentration feasibility note beside the MNT one.
2. **(F2) De-risk the JR C2 slice.** Flag PSK §11-Q1/Q2 as open; commit to a TS-native assertion gate (drop
   negspacy) and JATS-only-for-the-slice (drop GROBID), or accept a Java sidecar explicitly; re-size JR's
   share. Address the no-Python constraint in doc 4's feasibility read.
3. **(F3) Reconcile Neo4j with HACKATHON_DIRECTION Priority 2.** Either drop the added sync-job scope and
   project straight to the force-graph for the slice, or justify keeping Neo4j at demo scale — do not add it
   silently.
4. **(F4) Reword the "scope roughly flat" claim** to "net build grows; critical path shortens."
5. **(F5) Fix the HACKATHON → HACKATHON_DIRECTION citation labels** (three refs) and re-attribute the
   "strongest agentic-app surface" quote to PHASE2-PLAN W5.
6. **(F6/F7) Note the deferred PSK §5 corpus-expansion and the Priority-2 brain corrections;** soften the two
   mild over-claims.

Fixes 1–3 are substantive (feasibility/scope); 4–7 are provenance/honesty hygiene. With 1–3 resolved the
pack is fully adoptable as the basis for the PHASE2-PLAN revision.
