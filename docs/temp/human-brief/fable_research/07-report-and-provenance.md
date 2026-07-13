# The insight report, the source-provenance experience, and the completeness score

**Date:** 2026-07-05 · **Status:** Fable research — **Wave 2, part 2 of 3.** Defines the user-facing
architecture the reframe (`06`) requires but that does not exist in code or design today. Every "ABSENT"
below is confirmed against the repo (biotope insight module, `shared/brain/`, the migrations).

**Grounding keys** as in `06`. New anchors this doc cites verbatim from the repo:
`shared/brain/relationships.ts` (`Citation` :76–85, `QuoteSpan` :88–95, `RelationshipClaim` :102–125),
`shared/brain/index.ts` (`edgeScore` :40–48, `servingBand`/`EDGE_GATES` :25–57),
`supabase/migrations/20260515100000_create_m5a_baseline_snapshots.sql` (`days_of_data`, `confidence`),
`supabase/migrations/20260515110000_create_m5b_insight_cards.sql`.

**Method note.** For each surface: *what it is → the data/artifact it needs → deterministic vs LLM →
what's already in the contract vs a (purely additive) contract change → open questions.* The recurring
finding: **the reliability axis, the verbatim quote, and the completeness inputs already exist**; the
*applicability axis, structured span offsets, the derivation explanation, and every synthesis/report
surface* do not.

---

## 1 · The weekly insight report (narrative + graphs)

**Today:** `insights_tab.dart` renders a flat `ListView` of independent `insight_cards`, each a
title/body/confidence-chip. There is **no report** — no multi-card synthesis, no narrative, no graphs, no
cross-card rollup (confirmed; IED describes only per-card generation). The presentation agent (IED §E,
LINK §3) phrases *one* card, not a report.

**What it is.** A periodic (weekly) artifact = a **ranked, clustered set of surfaced cards** + a
**narrative that connects them** + **supporting charts** + a **completeness disclaimer**. It is a composed
document, not a feed. Jayden: *"paragraph as well as graph… some link up different trends and tell me
consequences, or how some metrics affect the other."*

**The composition pipeline** (deterministic until the last synthesis step — the honesty lives upstream of
the LLM):

| # | Stage | Type | What it does |
|---|---|---|---|
| 1 | **Candidate generation** | deterministic | the existing engine fires all trend/threshold/correlation cards for the window; each already carries `servingBand` + n=1 stats. This is the *pool*, not the report. |
| 2 | **Selection / ranking** | deterministic | rank by a **surfacing score** = f(edge reliability `edgeScore`, **applicability-to-user** §2, personal-signal strength, **novelty-vs-last-report** `08` §4, **completeness** §3). Take top-K. **This is where "only the good 5" happens** — a strict cut, not a hedge. |
| 3 | **Clustering** | deterministic | group selected cards by shared metric / 1-hop neighbourhood so the narrative can "link up trends" (e.g. sleep↓·HRV↓·mood↓ told as one connected story). **Grouping of co-occurring 1-hop links — NOT a multi-hop inference** (respects MKB §3.5 #2). The narrative *describes* adjacent edges; it never *composes* a 3-hop chain into a claim. |
| 4 | **Narrative synthesis** | **LLM (constrained)** | the presentation agent writes prose over **only** the selected cards' retrieved subgraphs + quote spans, in the attributed-claim register (`06` §3). Introduces no relationship or number outside the retrieved set (LINK §3 invariant). Then the **LLM-judge copy check** (`06` §3) runs refute-by-default on personal-causation / diagnosis / prescription. |
| 5 | **Graph selection** | deterministic | each card/cluster → a chart spec: the metric's trend series (already in `baseline_snapshots`) overlaid with the relationship it participates in. Charts are *rendered from stored numbers*, never LLM-drawn. |
| 6 | **Completeness disclaimer** | deterministic | attach the §3 score to the report and to each card. |

**Freshness / non-repetition.** The report diffs against the **already-surfaced ledger** (`08` §4). A card
re-fired with no new evidence is de-prioritized in stage 2; **newly-verified edges** (from the loop, `08`
§5) and **newly-crossed completeness thresholds** get a novelty boost. This is what makes "next week…
new insights, not the same repetitive stuff" real — and it is *observable* (a demoable metric), which the
hackathon rewards (HD §0.5 Priority 0).

**Degradation** (LINK §3 Fallback, unchanged). If the brain read is empty (very likely early), Neo4j/store
unreachable, or the agent call fails: the report degrades to the **deterministic templated cards** with no
narrative. Never a hard gate. Early-life, the report is short and honest, carried by the completeness
motivation loop — *not* padded with weak cards (`06` §4).

**Contract/schema impact.** The report is a *composition over existing rows* — no new truth. Additive
only: a `reports` row (or ephemeral compute) referencing the selected `insight_cards.id`s + the narrative
string + the report-level completeness score. `insight_cards` already has `contributing_metrics[]`,
`confidence_sources[]` (loaded but **never rendered today** — the report is where they finally surface).

**Hackathon posture (`06` §6).** Build stage 1–3 + 6 for real (deterministic, cheap, they *are* the
selection honesty); build stage 4 as one genuine narrative over one real cluster for the demo; stage 5 can
reuse the existing trend widgets. Do **not** build a polished multi-screen report product for the
hackathon — that's breadth.

**Open questions.** Report cadence & trigger (weekly cron vs on-open); K (how many cards); whether the
narrative is one prose block or per-cluster paragraphs; whether reports persist for week-over-week diffing
(needed for freshness — lean yes, minimal).

---

## 2 · The source-provenance experience

Jayden's walkthrough: *source button → a 2-D reliability-vs-applicability graph of the papers → tap a
paper → the exact page and sentences, with an explanation of how they produced the insight → I check
online, the paper and sentences are real.* This is three artifacts. Two axes and the verbatim quote
already exist; applicability, offsets, and the explanation do not.

### 2.1 · The reliability × applicability plot

**Today:** every `Citation` carries **`evidenceTier` (1–5)** — the reliability coordinate, already there —
and **`impactTier`** (venue; deliberately *not* in `edgeScore`, `index.ts`). There is **no applicability
axis and no plot data** (confirmed ABSENT). `scopeCheck` compares evidence-to-*claim*, never fit-to-*user*.

**Reliability axis (exists, needs a per-paper scalar).** Map each supporting `Citation` to `[0,1]` from
`evidenceTier` (study-design ladder) optionally scaled by the edge's risk-of-bias/precision. This is the
brain's existing notion of trust, per paper. Deterministic.

**Applicability axis (NEW — the genuinely novel concept, and the one that makes it feel personal).** "How
much does *this paper's* finding apply to *this user*?" Score `[0,1]` by matching the paper's `population`
(CONTRACT `RelationshipClaim.population`, the verbatim claimed scope — currently a free string) against the
user's profile:

- **components:** demographic match (age/sex band), health-status match, measurement-method match (was HRV
  measured the way biotope measures it?), context match (setting/region where relevant);
- **deterministic where the population is structured** (once PSK stage-2 PICO extraction fills structured
  fields); **small-model/LLM where it's prose**, at cold start;
- **per-(paper, user)** — the *same* paper plots at a *different* x for a different user. This is what makes
  the plot personal rather than a generic evidence chart;
- **honest "unknown."** OA-only corpus means many papers are abstract-only with no stated population (PSK
  §10). Applicability is then **`unknown`**, plotted in a distinct band — *never faked to a number.* This
  honesty is the point, not a defect.

**The plot.** Papers as dots in reliability (y) × applicability (x). Top-right = strong evidence that
applies to you; an `unknown`-applicability column sits to the side. The user sees, at a glance and
honestly, *how good the evidence is for them* — which no health app does today, and which serves the
Evidence pillar directly.

### 2.2 · The derivation trace (tap a paper)

**Today:** `QuoteSpan` carries **`quote`** (verbatim text, **already checked literally present before the
verifier runs** — CONTRACT `quoteCheck.allPresent`) and **`locator: string | null`** (free-text
"section/page/figure"). So *"the exact sentences, and they're real"* is **already contract-supported** — the
quote is verbatim and verified. What's missing is (a) **structured** page/sentence offsets and (b) the
**explanation of how the sentence became the insight**.

**The artifact.** Per supporting paper on an edge, a **derivation record**:

- `quoteSpans[]` — the verbatim sentence(s) + **structured locator** (page + section + char offset). The
  char offsets require the **PSK stage-1 `extract.ts` upgrade** (segment + preserve offsets instead of
  flatten; PSK §3, §11-Q5) — today `extract.ts` collapses everything to one string, destroying offsets.
  Until then, the free-text `locator` carries "Results, p.4" and the verbatim quote carries verifiability.
- the extracted **claim tuple** (subject, object, signed relation, effect+CI, population) — already the
  synthesis output (PSK §2 = a `RelationshipClaim`).
- a short **derivation explanation** — "how this sentence → this claim → this card." Produced **once, at
  synthesis/verify time, and stored** (not regenerated per view), and itself grounded (it may only
  reference the span it explains). This is the "explanation of how they actually produce that insight"
  Jayden wants, and it's a *by-product* of the synthesis step, not new inference.

**The verifiability guarantee (state as an invariant).** We display a span **only if** `quoteCheck`
confirmed it verbatim-present in the resolved OA text, **and** the citation resolves to a real DOI/OA URL.
So "I went online and checked, the sentences are real" is *guaranteed by construction*, not hoped for.
This invariant is the entire trust proposition; it is cheap because `quoteCheck` already exists in the
contract.

### 2.3 · Contract impact (all additive, no `RelationKind` change)

- **applicability**: an additive per-`Citation` (or per-edge-per-user, computed at read time) applicability
  score `[0,1] | 'unknown'` + a one-line "why it (partly) applies to you." Read-time-computed is cheaper
  and avoids storing per-user data on the edge → **recommended**.
- **structured locator**: additive fields on `QuoteSpan` (`page`, `charStart`, `charEnd`) — a `shared/`
  2-reviewer PR (Alton), gated behind the `extract.ts` upgrade.
- **derivation explanation**: additive `derivation: string` on the claim/verification, written at synthesis.

None of these change `RelationKind` or the signed-edge model (consistent with MKB §10, and Wave 1's
load-bearing "no contract change" claim, `05`).

---

## 3 · The deterministic data-completeness score

**Today:** `log_completeness` (a 0–100 DQS) exists but scores **daily-logging** (normaliser / daily-log
screen) — *not* insights. There is **no insight-level completeness score** (confirmed ABSENT). But the
inputs exist: `baseline_snapshots` already stores **`days_of_data`** and **`confidence`
(insufficient/low/medium/high)** per user-metric.

**What it is.** A per-insight (and per-report) **deterministic** score + a plain disclaimer, exactly as
Jayden described: *"based on how many days of health data, with missing datapoint and baseline is built
from what, and a deterministic score on my data completeness."*

**Inputs (all already stored per contributing metric):** days of data in the window; expected-vs-present
datapoints (missingness); baseline maturity (`baseline_snapshots.days_of_data` + which method); the
`confidence` enum. **Output:** a score (e.g. 0–100) + a rendered disclaimer — "based on 5 of 7 days;
baseline from 21 days; HRV missing 2 days." **Deterministic and no LLM** — this is a *promise the user can
act on*; it must be reproducible, not phrased.

**Its four jobs:**

1. **Honesty** — the disclaimer under every card and the report (Evidence pillar: "sample sizes, variance").
2. **Motivation loop** — "log 2 more days and we can confirm this research-backed pattern for you." This is
   the cold-start experience `06` §5 promises: the *user's data* is what's cold, and this tells them how to
   warm it. Jayden: *"this motivates me to log in more data."*
3. **Surfacing rank** — low completeness lowers the stage-2 rank or holds the card (a research-backed edge
   we *can't yet confirm personally* shouldn't outrank one we can).
4. **Gap classification** — the crucial internal use: it lets `08` §3 distinguish *"we can't confirm this
   because the data is thin"* (→ prompt the user to log) from *"the data is complete and the relationship
   just doesn't hold for this user"* (→ an applicability note / genuine null, **not** an ingestion target).
   Without a completeness score, those two look identical and the brain wastes ingestion chasing noise.

**Contract/schema impact.** Additive: a completeness score persisted on `insight_cards` (or computed at
read time from `baseline_snapshots`). No brain-contract change. Purely deterministic biotope-side work.

**Open questions.** The exact formula/weights (declare provisional-pending-calibration, mirroring HD's
Priority-2 warning about unjustified magic numbers — do **not** ship uncalibrated weights silently); the
window definition; how baseline-method provenance is surfaced in one line.

---

## 4 · Summary — build order for the slice

Ranked by *scored-delta value per unit build* (`06` §6), depth-first:

1. **The verifiability guarantee + derivation trace on one real edge** (§2.2) — cheapest (quoteCheck +
   verbatim quote already exist), highest trust payoff, directly the Evidence/Honesty pillars.
2. **The deterministic completeness score** (§3) — cheap (inputs already stored), carries the whole
   cold-start experience, feeds the gap ledger.
3. **The reliability axis of the plot** (§2.1) — free from `evidenceTier`; the applicability axis follows
   once population extraction exists (or shows `unknown` honestly meanwhile).
4. **Report selection/clustering (stages 1–3, 6)** (§1) — the "only the good 5" logic; deterministic.
5. **Narrative synthesis + LLM-judge copy check** (§1 stage 4; `06` §3) — the register change; **ship the
   judge check with it, never without.**
6. **The plot screen and polished report UI** — *demo-depth only* for the hackathon (`06` §6). Product-real,
   not judging-real.

The internal machinery that makes the *report* worth reading week over week — prepopulation, the gap
ledger, and the loop that supplies "new papers, new insights" — is `08`.
