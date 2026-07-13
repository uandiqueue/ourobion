# Insight-engine experience — the product-vision reframe

**Date:** 2026-07-05 · **Status:** Fable research — **Wave 2, part 1 of 3.** Opens a second wave triggered
by Jayden's 2026-07-05 UX-vision feedback. Wave 1 (`01`–`05`) revised `PHASE2-PLAN.md` *against the two
2026-07-04 briefs*. This wave revises a **premise the briefs themselves chose** — and that Wave 1 inherited
without questioning. Read `00-README.md` for how the two waves relate.

**Grounding keys:** **MKB** = [`metric-knowledge-bridge`](../2026-07-04-metric-knowledge-bridge.md); **PSK** =
[`paper-to-structured-knowledge`](../2026-07-04-paper-to-structured-knowledge.md); **LINK** =
[`BIOTOPE-NAO-LINK.md`](../../../shared/BIOTOPE-NAO-LINK.md) (branch `origin/docs/biotope-nao-link-plan`); **IED** =
[`INSIGHTS-ENGINE-DESIGN.md`](../../../biotope/INSIGHTS-ENGINE-DESIGN.md); **CONTRACT** =
[`shared/brain/relationships.ts`](../../../../shared/brain/relationships.ts) + `index.ts`; **HD** =
[`HACKATHON_DIRECTION.md`](../../../shared/hackathon/HACKATHON_DIRECTION.md); **HK** = [`HACKATHON.md`](../../../shared/hackathon/HACKATHON.md).

---

## 0 · The fork, precisely

MKB §9 made two **product** choices that are not forced by its **science**, and Wave 1 carried both forward
verbatim (`04` §(c); `02` C1/H3):

1. **Honesty via hedged copy.** Cards speak in "observational language only — no causes/will/should/treat"
   (MKB §9 step 6), framed as *"consistency, not proof."* The register is deliberately weak so it can't
   overclaim.
2. **Fill silence by lowering the bar.** Surface *four* branches, including the two weak ones —
   *research-context* ("seen in research; not yet clear in your data") and *idiosyncratic*
   ("hypothesis, not fact") — because *"with honest n=1 statistics the agree branch fires rarely… do not
   suppress \[research-context\], or the app goes silent"* (MKB §9, §3.5 #3a). The stated expectation is
   that the app's day-to-day value comes from the *weak* branches.

Jayden's feedback rejects both, on product grounds that are correct:

- **On (1):** *"users do not want to know what we see, they want meaning, inference, future action."* An
  engine that can only say "we observe X, but this is consistency, not proof" has **re-created the
  problem it exists to solve** — it is Apple Health's trend graph with a disclaimer bolted on. The whole
  reason to carry a paper corpus and cited rules is **to be allowed to make a claim.**
- **On (2):** *"not getting an insight should never be surfaced to the user."* Silence is not a UX failure
  to be papered over with weak cards — it is an **internal signal**. The honest response to "we can only
  defend 5 of the ~80 relationships your metrics could support" is to **surface the 5 as real claims** and
  **spend the other 75 as fuel for the brain to go find more papers** — not to show the user 75 shrugs.

This is a genuine premise-level fork, not a wording tweak. It changes what the engine *is for*.

---

## 1 · The organizing principle: honesty moves from the sentence to the substrate

The reframe is one move, and everything in `07`/`08` follows from it:

> **MKB puts honesty in the copy. We put it in the provenance layer.**

MKB keeps the engine honest by making every sentence hedge. The cost is that the sentence stops meaning
anything. The alternative — Jayden's — is to let the sentence **state the claim** (meaning, inference,
implication) and make it honest by **backing it with something the user can check**:

- a **source button** on every card → the papers behind it;
- a **reliability × applicability** map of those papers (`07` §2) — not one number, a picture of *how good
  the evidence is, for you*;
- the **exact verbatim sentences** the claim was derived from, with a plain explanation of the derivation
  (`07` §2), each already `quoteCheck`-verified against the real open-access text (CONTRACT `quoteCheck`);
- a **deterministic data-completeness score** (`07` §3) — "based on 5 of 7 days; baseline from 21 days;
  HRV missing 2 days" — so the user knows exactly how much of the claim rests on how much of their data.

This is **more** auditable than hedged copy, not less. Hedged copy asks the user to *distrust*; the
provenance layer lets them *verify*. And it is exactly what the hackathon's Evidence and Honesty pillars
reward — "every claim backed by a measurement… evidence appropriate to the claim" (HK five pillars; the
evidence-panel angle is already blessed in HD §4.2 item 7: *"click an edge → quote spans, citations,
`evidenceTier`/`servingBand`"*).

---

## 2 · What MKB actually proved, and what it only assumed

MKB conflates two separable things. Keeping them apart is what lets us honor the science *and* the vision.

| | **Epistemic gating** — what we may *believe/serve* | **Surfacing & register** — what we *show*, and how it *reads* |
|---|---|---|
| MKB's content | n=1 stats (N_eff, FDR, effect+CI); reliability tiers; dependency-aware corroboration; **1-hop, monotonic-only** composition; `servingBand`; notability≠trust | four branches all shown; observational-only language; "consistency not proof"; UX built around the weak branches |
| Status | **Proven** — real statistical and graph-theoretic constraints (MKB §3.5 #1–7). **KEEP ALL OF IT.** | **Assumed** — a product choice MKB never defends as forced. **This is the fork.** |

The vision touches **only the right column.** Nothing in `06`–`08` weakens a single epistemic guard: n=1
control still runs, `edgeScore`/`servingBand` still gate (CONTRACT `index.ts:40–57`), `modulates` edges
still can't be served directionally (MKB §3.5 #1), composition is still 1-hop (MKB §3.5 #2). We change
**which gated edges get surfaced, and how they're phrased** — nothing about the gate.

Read this way, "5 of 80" is not a new mechanism. It is the *same* strict gate MKB already specified,
plus a decision about the losers: **surface the winners as claims; route the losers to the brain, not the
user.**

---

## 3 · The claim register (reconciling "make claims" with non-diagnostic)

"Make claims" does **not** mean "assert personal causation." There is a usable register between the two
failure modes, and defining it is the whole game:

```
 too weak (MKB)                 the target register                      forbidden (unchanged)
 "we observe your HRV is up"  →  "research links elevated HRV to X;   →  "your HRV is up because Y"
                                  your week fits that pattern;            "you have Z" / "take W"
                                  people often find A helps"              "this will…" / cross-user compare
```

**The rule that keeps it safe:** *causal and mechanistic language is permitted only when it is carried by a
citation, never when it is asserted of the user.* "Research shows poor sleep reduces next-day recovery" is
a **reportable fact about the literature** (the paper's claim, cited, tier-graded). "Your poor sleep
reduced your recovery" is a **personal causal claim** and stays forbidden. The user gets meaning and
implication; the app never diagnoses.

This is fully compatible with the standing guards — it *tightens* them rather than relaxing:

- **Two-tier-truth** ([`0001`](../../../memory/0001-two-tier-truth.md)) — the claim is still only as strong as
  a TRUTH-tier verified edge; nothing is phrased beyond the retrieved subgraph (LINK §3 grounding
  invariant).
- **Non-diagnostic copy** ([`0003`](../../../memory/0003-non-diagnostic-copy.md)) — `validateCopyString` +
  `FORBIDDEN_WORDS` still run at load/blueprint/render (IED §B3/§B5/§C). The forbidden set is **unchanged**;
  we are widening the *interpretive* register (attributed research + non-prescriptive implication), not the
  *diagnostic* one.
- **New burden on the copy gate.** The gate now has a harder job: permit "research links… / people often
  find…" while still blocking "you have / take / will / cure." A `FORBIDDEN_WORDS` denylist is necessary
  but no longer sufficient — the register needs an **LLM-judge copy check** on the report's synthesized
  prose (a decorrelated model asked "does this sentence assert personal causation, diagnosis, or
  prescription? refute-by-default"). This mirrors the brain's own two-LLM discipline (HD §0) and is `07`
  §1's most important safety item. **Flagged as the primary risk this reframe introduces — §6.**

---

## 4 · The four branches → one surfaced lane + three feedback signals

MKB's four branches don't disappear; they **re-sort** into "surface" vs "feed the brain." This is
Jayden's point 3, made concrete.

| MKB §9 branch | MKB does | **This reframe does** | Goes to |
|---|---|---|---|
| **Agree** (lit ✓ + personal ✓) | surface, hedged | **SURFACE** as a grounded claim — the confident card | user (the "5") |
| **Research-context** (lit ✓ + personal absent/weak) | surface, "not clear in your data yet" | **do not surface as a shrug.** Split by *why* the personal leg is weak → completeness loop or gap ledger | internal (`07` §3, `08` §3) |
| **Idiosyncratic** (personal ✓ + no lit edge) | surface, "hypothesis not fact" | **do not surface** (no paper ⇒ no source button ⇒ breaks the trust model). Becomes a **top-priority ingestion trigger** | internal → `08` §3/§5 |
| **Contradiction** (lit ✓, personal opposite) | flag for human review | **do not surface.** Route to human review *and* to applicability learning (maybe the research population isn't the user) | internal (`08` §3) |

The payoff is the loop Jayden described: a strong personal signal with **no** paper is exactly the
highest-value thing to research; if ingestion later finds support, **next week it becomes a real cited
insight** — "new insights, from new paper, not the same repetitive stuff." The weak branches are not
thrown away; they are **redirected from the user to the brain**, where they belong.

**One genuine decision, not resolved here (surfaced in §6):** MKB calls the idiosyncratic branch *"the
product's actual differentiator."* This reframe demotes it from a user card to an ingestion trigger,
because the trust model is paper-cited and an idiosyncratic finding has no paper. If a true individual
responder exists for whom **no** paper will ever match, this reframe *never surfaces it* — a real loss
against MKB's stated differentiator. The options are (a) accept the loss (purity of the cited-claim model),
or (b) keep a **clearly-separate** "we noticed this in your data — still researching" lane that is visibly
not a cited insight. Jayden's own wording ("not getting an insight should never be surfaced") points at
(a); I recommend (a) for the hackathon slice and revisiting (b) post-hackathon. **Your call.**

---

## 5 · The cold-start story, inverted

MKB solves "the app goes silent" by **lowering the surfacing bar** (show weak cards). This reframe solves
it by **raising supply** and being honest about *which* thing is actually cold:

- **The brain is prepopulated** by *running the real pipeline* on a starter corpus over the metric
  catalog's high-value pairs (`08` §2) — so a brand-new user's brain already knows enough to say the
  confident few. This is **not** the hand-seeding the briefs warn against (MKB §12; PSK §6): hand-authored
  `provenance:'seed'` edges remain anti-empty-graph insurance only, never the demonstrated path. "Prepopulate
  the brain" = "exercise synthesis→verifier ahead of time," which is precisely the delta the hackathon
  scores (HD §0, §4.2 item 5).
- **What's cold is the *user's* data, not the brain.** Early on the user has few days logged, so the
  personal leg is under-powered. That is not silence to hide — it is the **completeness score** doing its
  job (`07` §3): "log 2 more days and we can confirm this research-backed pattern for you." The cold-start
  experience is *motivation*, not *shrugs*.
- **The gap between derivable and served drives the brain to improve itself** (`08`). Silence measured is
  silence made useful.

---

## 6 · Honest tensions — where the vision fights the science, and the hackathon

I am not going to pretend the vision is free. Three real conflicts, stated so the decision is informed:

1. **Overclaim risk is real and this reframe increases it.** Moving from hedged to interpretive copy is
   exactly the move a careless health app makes right before it says something it shouldn't. The mitigation
   is structural, not attitudinal: the grounding invariant (nothing outside the retrieved subgraph), the
   unchanged diagnostic denylist, **and** the new LLM-judge copy check (§3). If we ship the register change
   *without* the judge check, we have traded a safe-but-useless app for a useful-but-unsafe one. Do not
   split them.

2. **The hackathon does not reward this UX — and warns against its shell.** Judges score *the delta = the
   brain* (HD §0), **depth over breadth** ("protect the eval, even at the cost of breadth," HD §0.5
   Priority 0), and UX is *"essentially absent as a scored concern"* (the Applications track was ruled out
   because the delta has no live users, HD §2). Red flags include *"complexity for its own sake."* So:
   - The vision's **substance** is squarely the scored delta: grounded claims, the provenance/derivation
     trace (Evidence + the trust thesis), the completeness score (Evidence: "sample sizes, variance"), and
     the self-recursive loop (Approach: the agentic center; Honesty: trajectory; and it **produces observed
     results** — exactly what Priority 0 demands). **Build these.**
   - The vision's **presentation shell** — the weekly narrative report as a polished screen, the 2D plot as
     a finished feature, the motivation UI — is **breadth risk** for the hackathon. Build it as a *thin demo
     surface* over the real machinery, not a build sink. It is right for the *product*; it is not what wins
     the *judging*.
   - **Recommendation:** treat `07`'s report/plot as demo-depth-1 (enough to show one real card with its
     real sources and real completeness score), and put the engineering into `08`'s loop, because the loop
     is the observed-delta story that moves the score from 16 to ~19–20 (HD §0.5).

3. **The self-recursive loop's hardest sub-problem is genuinely unsolved.** Distinguishing "a real gap we
   should ingest papers for" from "a genuine non-relationship / a false signal" (Jayden's *"which are
   actual signals which are false"*) has no clean answer. `08` §3 defines the decidable subset and a
   defensible heuristic for the rest, and **marks the residue open** rather than pretending it's solved.
   This is the honest limit of the vision as currently thinkable — and naming it is itself the
   Honesty-pillar win (HD §11).

---

## 7 · What this revises in Wave 1

Wave 1 stays valid as an analysis of the *plan vs the briefs*; these are the specific conclusions the
reframe supersedes. `00-README.md` carries the map; the one directly-contradicted user-facing section
(`04` §(c)) gets a banner pointing here.

- **`04` §(c) "the four branches" and "what is explicitly NOT shown."** SUPERSEDED on surfacing + register:
  branches 2/3/4 become internal feedback (§4), not user cards; "observational language only" becomes the
  attributed-claim register (§3). The *epistemic* content of `04` (1-hop, monotonic-only, no cross-user, no
  multi-hop) is **unchanged**.
- **`02` C1 / H3** and **`01` H3** (the four-branch presentation as the UX design). REFRAMED: the branch
  *logic* survives as internal classification; the branch *UX* collapses to one surfaced lane + a
  provenance layer + a completeness disclaimer (`07`).
- **`02` C3 / `03` #5** (idiosyncratic as a first-class user card). REFRAMED to an ingestion trigger (§4),
  with the surfacing decision left open (§6 decision).
- **`03` #12 / `05` F3** (add a Neo4j sync job). Aligns with `05`'s own F3 and HD Priority 2: for the
  slice, **drop Neo4j — project the truth store straight into the force-graph** (`08` §6). The reframe does
  not need graph-DB traversal; a 1-hop neighbour lookup over the projected store suffices.
- **`03` Part C "scope roughly flat"** (already flagged by `05` F4). The reframe *reduces* net UX build
  (one lane, not four) while *adding* the provenance layer and the loop — net still grows; the win remains
  a **shorter critical path to a demoable, trustworthy card**, not lower effort.

The two companion docs turn this into architecture: `07` defines the report + provenance + completeness
surfaces; `08` defines the prepopulation + gap ledger + self-recursive loop that makes "fresh insights
every week" real.
