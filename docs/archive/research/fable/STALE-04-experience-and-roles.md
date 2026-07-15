> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# PHASE2-PLAN — roles & the app-user experience

**Date:** 2026-07-05 · **Status:** ⚠️ **STALE — superseded, kept for history.**

> **Why STALE:** §(c) describes the **four-branch, observational-language UX** that Jayden's 2026-07-05
> feedback rejected (only confident cited cards + a labelled "still researching" card are surfaced now; the
> rest become internal feedback — see `06` §4 and `12`). §(a)/(b) roles are superseded by the build-order
> and Model & compute assignment in [`12-system-architecture.md`](12-system-architecture.md). The
> *epistemic* facts here (1-hop, monotonic-only, no cross-user comparison, degradation-to-template) remain
> true. Do **not** take the UX or roles here as current. See [`00-README.md`](00-README.md).

Developer roles, maintainer roles, and the concrete app-user experience, based on the revised plan in
[`STALE-03-plan-changes.md`](STALE-03-plan-changes.md) (delta) and the cost/who-absorbs notes in
[`02-resolutions.md`](02-resolutions.md), grounded in
[`metric-knowledge-bridge`](../2026-07-04-metric-knowledge-bridge.md) §9/§3.5 and
[`BIOTOPE-NAO-LINK.md`](../../../shared/BIOTOPE-NAO-LINK.md) §3.

**Team (a hard constraint):** three people. **FE** — frontend dev (Flutter/UI). **MNT** — backend/research
dev who is *also* the maintainer (Jayden, both hats). **JR** — junior backend dev. Alton is an external
`shared/` second-reviewer only.

The revised delta is roughly flat-to-slightly-larger in total scope (file 03 Part C) but splits cleanly
along a **deterministic/no-ML vs LLM/stats-shaped** seam — that seam is the whole allocation logic
(file 02 L1).

---

## (a) Developer roles — who builds what

### FE — Flutter/UI (presentation load concentrates here)
- **The four-branch card UX (H3)** — the main FE item: four distinct card variants + labels + a per-branch
  reliability/citation cue keyed to `servingBand` (03 #9, #19). Covers gate criterion 4 across all four
  branches.
- **The idiosyncratic card style + hypothesis label (C3)** — a visually distinct "unusual for you — no
  research match" treatment so it can't masquerade as science (03 #5).
- **The degradation path** — render the plain deterministic template when the brain read is empty/fails
  (03 #9; LINK §3 Fallback). Build the card so richer phrasing is *additive over* the template, not a
  replacement.
- **nao-v3a approve/reject surface (H4)** — built *with JR*: a bare `provenance:'human'` approve/reject
  over LLM-proposed edges (03 #11, #17). FE owns the surface; JR wires the backend. **A pairing point.**

### JR — deterministic, no-ML slice (~a third of Track B; the L1 mitigation)
- **C2 stage 1 — JATS/PMC-XML parser** + section-segmentation/sentence-role tagging, GROBID fallback for
  PDF-only, emitting character offsets so `quoteCheck` has spans (03 #10). Rules/lookups, no ML.
- **C2 stage 4 — NegEx/ConText assertion/negation gate** (+ negspacy); rules-based, no training, ships now
  (03 #10).
- **C2 stage 3 — effect-size regex** extraction.
- **Rules loader.**
- **M3 plumbing** — `insight_needs` migration + Neo4j **sync-job scaffolding** (hourly cron + manual
  trigger) (03 #12). Deterministic, well-scoped.
- **L2 guard/test** — proves seeder notability never touches `edgeScore`/`servingBand` (03 #20).
- **Deterministic lag-window blueprint plumbing** for M1's `lag` field.
- **nao-v3a backend** (with FE).

### MNT — LLM / prompt / statistics-shaped work
- **The four-branch engine logic (C1)** — composes the personal (n=1, FDR-controlled) leg against the
  literature leg into agree / research-context / idiosyncratic / contradiction; deletes the pre-fire
  AND-gate wiring (03 #7). Additive engine logic, no contract change.
- **Idiosyncratic-branch engine logic (C3)** + its n=1 gating (03 #5).
- **M1 statistical evaluator** — N_eff (Pyper–Peterman), FDR (Benjamini–Hochberg), effect size + interval,
  minimum effective-n, the named minimal commensurability step (03 #6).
- **M2 corroboration clustering** — cluster by independent evidential root before summing; a minimal
  heuristic (shared first-author / DOI lineage) for the slice (03 #16).
- **C2 synthesis/verifier prompts + the stage-3–4 merge** (03 #10).
- **M4 cold-start extraction slice** — directed LLM sign+polarity extraction over co-occurring *result*
  sentences, verifier-confirmed, run on the demo slice; **ships first** as the demonstrable path
  (03 #13, #14).
- **H1/H2 doc edits + a handful of hand-authored `data/rules/cross/**` blueprints** — small tasks.

### Pairing / 2-reviewer forcing points
- **nao-v3a** — FE + JR pair (03 #11). **Survivor curation (H4)** — MNT + JR share (recurring; see (b)).
- **`shared/` 2-reviewer PRs, Alton as second reviewer** — exactly two additive changes, no
  `RelationKind`/signed-edge change anywhere (03 #22, Part C): (1) additive `lag` + `weight` on the
  correlation blueprint + edge contract (H2, also serves M1's lag half); (2) additive dependency-cluster
  id/count field on `corroboration` (M2). These are the only PRs that block on an external reviewer.

---

## (b) Maintainer roles — MNT's second hat, distinct from build

### The recurring human-review / curation burden (H4) — the headline
- **Survivor-only edge review is ongoing, not a one-time build cost** (03 #10, #21). Human review fires
  only on *survivors* of the pipeline — synthesis/verifier disagreement, borderline NLI, ambiguous tier;
  everything the verifier clears passes without a human. **Shared MNT + JR.** This is *the* burden-shift
  flag in the whole plan.

### Guarding the invariants (gates the build must not cross)
- **Two-tier-truth + non-diagnostic + copy gates** — every LLM-phrased card runs `validateCopyString` at
  render; the agent may not state a relationship/number outside the retrieved subgraph (LINK §3; 03 #9).
  MNT owns that these hold across all four branches (03 #19).
- **The `shared/` contracts** — registry v2, brain/rule contracts, chat contract, and the two new additive
  fields; each change a 2-reviewer PR with Alton (03 #21, #22).
- **Notability-vs-trust invariant (L2)** — notability ranks the seeder queue + `insight_needs` only, never
  `edgeScore`/`servingBand` (03 #15, #20, #23). JR writes the guard; MNT owns the invariant.
- **Budget/cost discipline** on LLM calls — haiku-tier, budgeted, usage-logged for both the presentation
  agent and cold-start extraction (LINK §3; 02 M4).

### Work that shifted LLM/agent → HUMAN — who absorbs it, and is it feasible
1. **Triangulation AND-gate → four-branch + survivor review (C1, H4).** The gate would have *silently
   suppressed* divergent data. Removing it routes the **contradiction branch to a human "flag for review"**
   instead of dropping it (03 #7). MNT+JR absorb an ongoing review queue. **Genuinely must be human** —
   negation/tier edge cases and contradiction adjudication at cold start need a person.
2. **"Review everywhere" → survivor-only (C2, H4).** This is the *mitigation*, not new burden — it narrows
   an unscoped review-everything implication to survivors only (03 Part B). Without it a 3-person team
   could not sustain the queue.
3. **Cold-start "hand-authored relationships" → real LLM extraction (M4).** Moves work *onto* the pipeline
   (MNT), off a human shortcut — reduces long-run human burden but concentrates it on MNT for the demo
   (03 #24).

### Must stay human now vs automatable later
- **Must be human now:** curation/adjudication of survivors; adversarial review of contradiction-branch
  survivors; **non-diagnostic copy judgement** (a judgement call, not a regex) (MKB §9 step 6; LINK §3).
- **Automatable later:** full PICO + document-level RE are deferred to GMI / support models; the LLM does
  those extractions at cold start meanwhile (03 #10). Full v3b curation UX (batch review, disagreement
  queues, audit trail) waits until survivor-review volume justifies it (03 #11).

### Single-point-of-failure — the honest feasibility read
- **The scored delta concentrates on MNT** (file 01 L1). MNT holds C1, C2-synthesis, C3, M1, M2, M4 —
  every ML/prompt/stats item *plus* the maintainer hat *plus* half the recurring review. A real single
  point of failure on precisely the hackathon-scored novel work.
- **Mitigations already in the plan:** carve ~a third of deterministic Track B to JR; ship the **M4
  cold-start slice first** to de-risk the XL edge pipeline early; decouple gate criterion 2 from the edge
  pipeline so a demoable card doesn't wait behind XL work (03 #13, #18, Part C).
- **Feasibility, 3 people, no GPU:** feasible *only because* (a) everything is no-training/rules-based or
  hosted-LLM (NegEx/ConText, negspacy, JATS parsing, haiku-tier calls — no GPU anywhere), (b) the
  deterministic third genuinely offloads to JR, and (c) survivor-only review keeps the human queue
  bounded. It stays fragile on MNT: if MNT is unavailable the scored delta stalls. The realistic posture is
  **scope discipline, not headcount** — ship the M4 slice + four-branch card as the demonstrable core, keep
  v3b and PICO/RE deferred.

---

## (c) App-user experience — what the user actually sees

> **⚠ SUPERSEDED ON SURFACING & REGISTER by Wave 2 (`06`–`09`).** This section renders the MKB §9
> *four-branch, observational-language* UX that Wave 1 inherited. Jayden's 2026-07-05 feedback rejects that
> premise: only the **agree/confident** lane is surfaced as a grounded *claim*; branches 2/3/4 become
> **internal feedback** to the self-recursive brain, never user cards (`06` §4). "Observational language
> only" becomes the attributed-claim register (`06` §3). The **epistemic** content below (1-hop,
> monotonic-only, no cross-user, no multi-hop, degradation) is **unchanged and still correct**. Read
> `09` for the reframed end-to-end UX and its build gaps.

**Anchor** (LINK §3 worked example): a user's HRV has trended **above their own personal baseline** (never
an absolute number, never cross-user) for several days. A `trend`/`threshold` rule fires on that user's
data alone — the brain plays no part in *detecting* it. Firing upserts an `insight_cards` row
(`contributing_metrics: ['hrv_ms']`); **only then** does the 1-hop read run, look up what relates to
`hrv_ms`, and phrase the card. Everything below is that card's wording, by branch. Each branch carries its
own copy, label, and a reliability/citation cue **keyed to `servingBand`** (high/mid; `hold` never served)
and evidence tier (03 #9). Observational language only — no "causes/will/should/treat."

### The four branches

**1. Agree (literature ✓ + personal ✓).**
- *Shown:* the personal pattern is consistent with a verified 1-hop literature edge.
- *Card line:* "Your HRV has been above your usual range this week — consistent with research on HRV and
  illness risk, and with your own recent data. This is consistency, not proof."
- *Cue:* highest band (`servingBand: high`), citation to the edge's quote span; **copy carries the
  shared-confounder caveat** — both legs are observational and may share confounders (MKB §9 branch 1,
  §3.5 #3).
- *How often:* **RARELY.** With honest n=1 statistics the agree branch fires seldom (MKB §9 "honest
  expectation"). The UX is *not* built around this jackpot.

**2. Research-context (literature ✓ + personal absent/weak).**
- *Shown:* a verified literature relationship, explicitly not (yet) confirmed in the user's own data.
- *Card line:* "Your HRV is above your usual range. Research links this pattern to illness risk — this
  isn't clear in your own data yet."
- *Cue:* citation to the edge; label "seen in research; not yet clear in your data."
- *How often:* **COMMON — a day-to-day workhorse.** Never suppressed, or the app goes silent
  (MKB §9 branch 2, §3.5 #3a).

**3. Idiosyncratic (personal ✓ + no literature edge).**
- *Shown:* a strong, stable personal correlation with **no literature match**, surviving the n=1 guards.
- *Card line:* "Unusual for you: your HRV reliably drops the day after [X]. No research match — this is a
  hypothesis, not a fact."
- *Cue:* distinct hypothesis-not-fact label + card style; **no citation** (there is no edge); gated by the
  M1/C3 n=1 guards.
- *How often:* **COMMON — the other day-to-day workhorse and the product's differentiator**
  (MKB §9 branch 3, §3.5 #4). Never suppressed for lacking a brain neighbour.

**4. Contradiction (literature ✓ but personal contradicts the predicted sign).**
- *Shown:* the most informative case — the user's data goes opposite to the 1-hop composed prediction.
- *Card line:* "Heads up: research would expect your HRV to move one way here, but your data shows the
  opposite — worth a look (possible data issue, confounder, or an individual exception)."
- *Cue:* "flag for review" label; routed to human review, **never silently dropped** (MKB §9 branch 4;
  03 #7).
- *How often:* uncommon but always surfaced when it occurs.

### What is explicitly NOT shown
- **No diagnosis / no clinical claim** — observational language only, `validateCopyString` at render
  (MKB §9 step 6; LINK §3).
- **No absolute-scale / dose-response directional claim** — `modulates` (non-monotonic) edges, e.g. the
  sleep-duration↔mortality U-curve, surface as **context only, never a composed directional prediction**,
  because biotope emits only baseline-relative direction and can't locate the user on the dose-response
  curve (MKB §3.5 #1, §9 step 2; 03 #4). The engine serves monotonic edges only.
- **No cross-user comparison** — everything relative to the user's own baseline, never a fixed absolute,
  never across users (LINK §3).
- **No multi-hop chains** — composition is **1-hop only**, a neighbour lookup, not a path calculator
  (MKB §3.5 #2; 03 #3, #8).
- **No relationship or number the retrieved subgraph doesn't contain** — the 1-hop subgraph (~5
  neighbours/metric, `high`/`mid` only) is the *entire* allowed input to the LLM (LINK §3; 03 #9).
- **Degradation case:** if Neo4j is unreachable, the retrieval is empty (very likely early on — most cards
  have no verified edge yet), or the agent call fails/times out → the card still renders with its **plain
  deterministic template**, no richer explanation; never a hard gate (LINK §3 Fallback; 03 #9). Early-life
  the user mostly sees deterministic single/cross-metric cards + idiosyncratic cards; research-context /
  agree richness grows only as the edge pipeline populates the brain.

---

### Consistency with files 01–03
Team constraint honored (three people, MNT both hats, Alton `shared/`-reviewer only). No
`RelationKind`/signed-edge contract change anywhere — the only two `shared/` changes are the additive
`lag`/`weight` and dependency-cluster fields. The "agree is rare" premise (MKB §9) drives both the engine
logic (a) and the UX weighting (c); the burden-shift (H4) and single-point-of-failure (L1) are named in
(b) exactly as the resolutions flag them.
