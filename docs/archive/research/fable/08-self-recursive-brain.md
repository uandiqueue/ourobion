> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# The self-recursive brain — prepopulation, the gap ledger, and the ingestion loop

**Date:** 2026-07-05 · **Status:** Fable research — **Wave 2, part 3 of 3.** Defines the internal engine
behind two lines of the ideal UX: *"not getting an insight should never be surfaced to the user, but use as
internal feedback to let nao self-recursively improve by finding more paper"* and *"the next week… new
insights, from new paper, not the same repetitive stuff."* This is the piece Jayden flagged as *"very
complex and I have not thought it out."* It is also the piece with the **least** in the repo today: `08` §3
is the honest limit of what is currently thinkable.

**This doc is systems architecture, not biology.** The non-diagnostic / evidence-grading constraints are
treated as **fixed black-box invariants** inherited from the contract; they are not re-argued here.

**Grounding keys** as in `06`/`07`. Repo facts (all confirmed): `verified_edges` **does not exist** (decided
only, `BRAIN-DESIGN.md:161`); `insight_needs` **does not exist** (shape is itself an open question, MKB
§13-Q6); `extract.ts` flattens to one string (no spans); the seeder is a **static 6-topic list**
(`seeds.ts`), reads neither `derivedFrom[]` nor demand; no co-occurrence index, no references-graph, no
novelty mechanism; **zero edges** produced (HD §4.1).

---

## 0 · The model, in one picture

For a user with N active metrics there is a space of metric-pair relationships that *could* become cited
insights. Call the count **D** (Jayden's "~80 derivable"). Of these, only some pass the epistemic gate and
get surfaced — call it **S** (the "5"). The rest, **D − S**, are the **gap**. The self-recursive brain is
the machine that (a) **measures** the gap, (b) **classifies** each gap by *why* it's a gap, (c) **spends the
real ones** as targeted ingestion, and (d) **feeds new verified edges back** so next week S is larger and
different.

```
  metric catalog + user's active metrics
        │
        ▼
  [1] enumerate candidate pairs  ──►  D  (candidate-derivable set — an ESTIMATE, §1)
        │
        ▼
  [2] classify each pair          ──►  the GAP LEDGER (§2)  ── status per pair
        │                                         │
   served (S)                                     │  real gaps only (§3 discrimination)
        │                                         ▼
        ▼                              [3] prioritized ingestion queue (§4)
   this week's report (07 §1)                     │
        ▲                                         ▼
        │                              [4] targeted retrieval → REAL pipeline (§4)
        │                                         │   (snowball/SPECTER → segment → tier →
        │                                         │    assertion → synthesis → NLI → verifier)
        └──────── novelty boost ◄──── new verified edges ◄┘   (§5 closes the loop)
```

Everything except the contract and the acquisition front-end is **new build**. This is the delta.

---

## 1 · Enumerating the candidate-derivable set (the "D")

**The honest framing first:** D is **not** a known count of true relationships. It is a **candidate**
estimate — pairs with *some* reason to relate. Overclaiming "your metrics support 80 relationships and we
found 5" would be false; the honest statement is "80 *candidate* pairs are worth investigating; 5 currently
clear the bar." I flag this because it is the difference between a defensible Evidence-pillar claim and a
grand-claim-asserted red flag (HK: "a modest claim, proven, beats a grand claim, asserted").

**Three candidate sources (union them):**

| Source | Signal | Status in repo |
|---|---|---|
| **Literature co-occurrence** | two metrics co-tagged / co-occurring in result sentences ⇒ *maybe* related (MKB §6, high-recall/low-precision) | **absent** — no co-occurrence index (`seeds.ts` is static) |
| **Personal correlation** | the n=1 evaluator finds a stable pair correlation in the user's own `baseline_snapshots` | evaluator **absent**; the data (`baseline_snapshots`) exists |
| **Registry `derivedFrom[]`** | authored "input-of-a-derived-metric" hints ("seeds the brain") | **exists as data** (`registry.schema.ts`), read by nothing |

**Bounding.** This is the *offline authoring* scale, not per-user query (MKB §8): the union over the metric
catalog, pruned by promiscuous-node caps and co-occurrence smoothing (MKB §6, §3.5 #5). Per user at query
time it is a flat scan over active metrics (dozens) — trivial (MKB §8).

---

## 2 · The gap ledger (structured, per-pair — the thing `insight_needs` should have been)

`insight_needs` as sketched in LINK §5 is a flat `(metric_key, hit_count)` append-log — too coarse to drive
targeted ingestion, and its shape is explicitly undecided (MKB §13-Q6). Replace it with a **per-candidate-
pair ledger** whose key contribution is a **status that says *why* the pair is not served** — because that
"why" is what decides whether to spend ingestion on it.

**Row (per candidate pair, per relevant scope):** `(metricA, metricB)`, `status` (below), `personalSignal`
{strength, N_eff, stable?}, `litCandidate` {cooccurStrength, hasEdge?, servingBand}, `completeness`
(from `07` §3), `demand` (how often/for how many users this pair would fire), `lastIngestAttempt`,
`lastStatusChange`.

**Status taxonomy** — the core of the design:

| status | meaning | action |
|---|---|---|
| `served` | high/mid edge exists **and** surfaced | none — it's an S. Track for novelty (§5). |
| `edge-below-band` | edge exists but `servingBand = hold` | ingest **better** papers (raise corroboration/tier). |
| `personal-signal-no-edge` | strong stable personal correlation, **no** literature edge (the reclassified "idiosyncratic", `06` §4) | **highest-priority** ingest — the user literally shows this; go find papers. If found → fresh insight next week. |
| `lit-candidate-no-edge` | co-occurrence/`derivedFrom` candidate, never extracted | ingest — run the pipeline on this pair. |
| `personal-null` | personal data **complete** (`07` §3 high) **and** shows no relationship; lit weak/absent | **de-prioritize** — likely a genuine non-relationship. Don't spend ingestion. |
| `blocked-completeness` | can't evaluate the personal leg — data too thin (`07` §3 low) | **not** an ingestion target; a **user-logging prompt** target (the motivation loop). |

The `personal-null` and `blocked-completeness` rows are the whole reason the completeness score (`07` §3)
is load-bearing: **without it you cannot tell "no relationship" from "not enough data," and the brain
wastes ingestion chasing the latter.**

**Contract/schema.** A new `gap_ledger` table (Supabase), aggregate/no per-user identifier for the demand
count (LINK §6's privacy constraint), plus per-user rows only where a personal signal exists. Supersedes
the undecided `insight_needs` shape.

---

## 3 · Real signal vs. false signal (the hard part — honestly bounded)

Jayden's explicit hard question: *"which are actual signals which are false."* There is **no clean
solution**, and I will not pretend otherwise. Here is the decidable subset, a defensible heuristic for the
middle, and the residue I'm marking **open**.

**Decidable (spend ingestion — positive evidence a relationship should exist):**
- `personal-signal-no-edge` — the user's own data shows it. Strongest trigger.
- `lit-candidate-no-edge` with co-occurrence above a smoothed threshold — the literature nominates it.

**Decidable (do not spend — evidence against):**
- `personal-null` with **high** completeness and no literature candidate — the data is complete and flat,
  and nothing in the corpus suggests otherwise. Treat as a genuine non-relationship for this user.

**The dangerous middle (a personal null *with* a literature candidate):** could be (a) a real relationship
the user's data is too thin to show, (b) a real relationship that genuinely doesn't hold *for this user*
(an applicability mismatch — `07` §2.1), or (c) corpus noise. **Resolution rule:**
- completeness **low** → case (a) → `blocked-completeness` → prompt the user to log, don't ingest yet;
- completeness **high** → lean (b) → record an **applicability note** ("seen in \[population\]; not in your
  data"), *not* an ingestion target and *not* a user card;
- co-occurrence very weak → (c) → drop.

**The open residue (state as a known limitation — HD §11 Honesty win):** we **cannot** perfectly separate
"no relationship exists" from "we haven't found the paper yet" from "the effect is real but below the user's
current statistical power." The ledger records the *evidence state* per pair so ingestion is spent where
evidence points, but a `personal-null` can always be a false negative, and a `lit-candidate` can always be
corpus noise. The mitigation is **cheap re-evaluation** (a null re-checks as data accrues; a candidate
re-checks as the corpus grows) plus **bounding ingestion by evidence strength** so noise-chasing is capped —
not a claim to have solved discrimination. This residue is the honest ceiling of the self-recursive idea as
currently thinkable.

---

## 4 · Closing the loop — ledger → ingestion → new edges

1. **Prioritize.** Rank the "spend" rows by `f(personalSignal, litCandidate, demand, expected-servability-
   gain)`. This generalizes the seeder's intended `insight_needs` read (LINK §5) to a real queue.
2. **Targeted retrieval.** For each queued pair, expand from any seed paper by **snowballing + SPECTER/SciNCL
   ANN** (PSK §5) — currently **unwired** (`05` F6 flagged this cut; it must be un-cut for the loop to
   function, since the static `seeds.ts` cannot chase a specific pair).
3. **Run the REAL pipeline** (PSK §7 cascade): `segment(1) → tier(2) → claim+effect+assertion(3–4) →
   synthesis(6) → NLI(7) → verifier(8) → human-on-disagreement(9)`. This is the pipeline that **does not
   exist past `extract.ts` today** — building it is the scored delta (HD §4.2 item 5, the verifier as
   "intellectual center").
4. **New verified edges** land in `verified_edges` (also to-build) → projected to the read store → visible
   to next week's report selection (`07` §1 stage 2) with a **novelty boost** (§5).

**Prepopulation is this same loop, run once, offline, before any user opens the app** (`06` §5): seed the
queue from the metric catalog's high-value pairs (registry `derivedFrom[]` + co-occurrence) and run the
real pipeline over a curated starter corpus. The output is real, cited, verified edges — so the brain isn't
empty on day one. **Critical:** this must be the *pipeline*, not hand-authored edges. Hand-seeded
`provenance:'seed'` edges stay anti-empty-graph insurance only (MKB §12, PSK §6). Prepopulation-by-pipeline
is scored as the delta; prepopulation-by-hand is the bypass the hackathon penalizes.

---

## 5 · Novelty / freshness (why next week differs)

Two mechanisms, both cheap:
- **Already-surfaced ledger.** Every surfaced card is recorded with the edge version behind it. Stage-2
  selection (`07` §1) **de-prioritizes** a pair surfaced recently with no new evidence, and **boosts**:
  (a) edges *newly created or upgraded* by the loop since the last report, and (b) pairs that *newly crossed
  a completeness threshold* (the user logged enough to confirm a previously-`blocked` pair). `insight_cards`
  today upserts on `(user_id, rule_id)` with a 7-day expiry but has **no** cross-week novelty — this is the
  missing mechanism.
- **The loop supplies the novelty.** "New paper → new edge → new card" is only real if step §4 actually ran
  between reports. Freshness is therefore a *consequence* of the loop, not a separate feature — which is why
  the loop is the load-bearing build, not the report UI.

---

## 6 · The self-improvement metric (and the demo)

Define **coverage = S / D** (served over candidate-derivable) per user and in aggregate, tracked over time.
This is how nao "knows" where to spend and whether it's improving — and it is exactly the **observed,
measured, delta-side result** the hackathon demands ("the delta must produce OBSERVED results," HD §0.5
Priority 0). The demo writes itself: *"this pair was a `personal-signal-no-edge` gap last week; the loop
queued it, ingested 3 papers, the verifier passed one at `mid` — now it's a cited insight. Coverage went
from 5/80 to 6/80."* That is the agentic center and the Evidence pillar in one sentence.

**Neo4j (reconciling `03` #12 / `05` F3 / HD Priority 2):** the loop and the report need only a **1-hop
neighbour lookup**, not graph traversal. For the slice, **drop Neo4j and project `verified_edges` straight
into the force-graph store** (HD Priority 2: *"Rescoping call: default to dropping it"*). Do not build the
hourly sync job Wave 1 added. If Neo4j is kept, it must be justified at demo scale, not defaulted to.

---

## 7 · Open questions (what is genuinely unresolved)

1. **False-negative discrimination (§3)** — the open residue; the deepest one. No clean solution; bounded,
   not solved.
2. **D's stability** — the candidate set shifts as the corpus and the user's active metrics change; how is
   coverage-over-time reported honestly when the denominator moves?
3. **Ingestion budget allocation** — how much of the (budget-guarded) LLM spend goes to prepopulation vs
   per-user demand-driven ingestion vs re-verification?
4. **Snowball/SPECTER wiring** (PSK §5, §11-Q3) — on-demand from OpenAlex references vs a persisted
   citation store; the loop needs *some* form of it (the static seed list can't chase a pair).
5. **Gap-ledger privacy** — per-user personal-signal rows vs aggregate demand rows; the aggregate must carry
   no per-user identifier (LINK §6).
6. **Prepopulation corpus curation** — which pairs, how many papers, what quality bar, to get a non-empty
   day-one brain without it becoming a breadth sink (HD Priority 0).

`09` turns all of this — plus `06`/`07` — into the single answer Jayden asked for: **beat by beat, can the
ideal UX be built with what's in hand + designed, and what more design is needed.**
