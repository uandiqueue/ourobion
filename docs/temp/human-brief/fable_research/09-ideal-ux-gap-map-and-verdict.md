# Can the ideal insight-engine UX be built? — the gap map and the verdict

**Date:** 2026-07-05 · **Status:** Fable research — **Wave 2 capstone.** Answers the one question Jayden
asked directly: *"with everything in hand and design in hand, will I be able to achieve the ideal user
experience, or else what more design do I need?"* This is a **systems / data-flow gap analysis**, not a
biology review.

**Fixed constraint (black box, not re-argued).** The engine must stay non-diagnostic
([`0003`](../../../memory/0003-non-diagnostic-copy.md)) and two-tier-truth ([`0001`](../../../memory/0001-two-tier-truth.md)).
Treated here as an unchangeable input to the architecture — like a latency budget — not a topic. The
claim-register mechanics that satisfy it live in `06` §3; this doc does not revisit them.

**Legend.** **IN HAND** = code or a persisted schema exists today. **DESIGNED** = a design doc specifies it
but no code exists. **ABSENT** = neither. **DEFINED (this wave)** = `06`/`07`/`08` now specify the design;
build remains. Every status is from the three repo maps (biotope module, `shared/brain/`, ingestion,
migrations) — confirmed, not assumed.

---

## 0 · One-line verdict

**Yes — the ideal UX is architecturally achievable, and after this wave the design for every beat is in
hand.** But the honest picture has two parts:

1. **It is almost entirely unbuilt.** Of the eleven UX beats below, **two** are IN HAND, **one** is
   DESIGNED, and **eight** are ABSENT. The single largest missing thing is the **brain edge pipeline
   itself** (synthesis → verifier → `verified_edges` → served) — *zero edges exist* — and nearly every
   impressive beat depends on it.
2. **Three beats need more design than even `06`/`07`/`08` fully close** — the *applicability axis*, the
   *false-signal discrimination residue*, and the *completeness formula calibration*. These are called out
   in §4 as the design (and decisions) you still owe.

So: not blocked by any unknown invention (with one bounded exception, §4.2), but a substantial build, and
the demoable version needs the depth-first slice in §5, not the whole thing.

---

## 1 · The ideal UX, beat by beat → required capability → status → gap

Each row is one sentence of Jayden's walkthrough, decomposed into the system capability it demands.

| # | UX beat | Required capability | Status today | The gap / design |
|---|---|---|---|---|
| 1 | "dashboard looks like Apple Health trend graph" | per-metric trend series + baseline | **IN HAND** — `baseline_snapshots` (`days_of_data`, `mean/std/min/max`, `trend`), daily-log UI | none |
| 2 | "I try to **generate an insights report**" | a report generation action/trigger | **ABSENT** — only a flat `insights_tab` list of cards; no report object | `07` §1: report = compose over cards; a trigger (on-open or weekly) |
| 3 | "report has **paragraph + graph** telling what my data means" | narrative synthesis + chart rendering | **ABSENT** — per-card only; **no chart is rendered anywhere in the app** (only a bar-chart *icon*) | `07` §1 stages 4–5: constrained narrative LLM + deterministic chart specs from stored series |
| 4 | "some **link up different trends**, tell consequences / how metrics affect each other" | multi-card clustering + **served brain edges** (1-hop relationships) | **ABSENT** — presentation agent is **DESIGNED** (IED §E, LINK §3) but unbuilt; **zero edges** exist; no clustering | `07` §1 stage 3 (1-hop cluster narration) **+ the entire `08` edge pipeline** (the deep dependency) |
| 5 | "**source button** under each card" | provenance entry point in UI | **ABSENT in UI** — `confidence_sources[]` is *loaded but never rendered*; evidence-panel is **DESIGNED** (HD §4.2 item 7) | `07` §2: wire the source button to the edge's `citations[]` |
| 6 | "**2-D reliability × applicability** graph, dots = papers" | reliability axis + **applicability axis** + plot | **reliability IN HAND** (`Citation.evidenceTier` 1–5); **applicability ABSENT** (only claim-scope `population`, never matched to the user); **plot ABSENT** | `07` §2.1: per-(paper,user) applicability score `[0,1]|unknown`; reliability→scalar; scatter |
| 7 | "tap a paper: **exact page + sentences**, + **explanation of how they produce the insight**" | verbatim spans + structured locator + derivation text | **quote IN HAND** (`QuoteSpan.quote`, **verbatim-verified** by `quoteCheck`); **structured page/char offset ABSENT** (`extract.ts` flattens); **derivation explanation ABSENT** | `07` §2.2: derivation record; **structured offsets need the PSK stage-1 `extract.ts` upgrade** |
| 8 | "I go online — the **paper and sentences are real**" | verifiability guarantee | **foundation IN HAND** (`quoteCheck.allPresent` gates before verifier) but the pipeline that *produces* spans is **ABSENT** | `07` §2.2 invariant: show a span only if `quoteCheck`-verified + DOI resolves; depends on `08` pipeline |
| 9 | "disclaimer: **how many days, missing points, baseline from what, deterministic completeness score**" | insight-level completeness score | **inputs IN HAND** (`baseline_snapshots.days_of_data`, `confidence`); **insight-level score ABSENT** (`log_completeness` is *daily-logging* only) | `07` §3: deterministic score over contributing metrics + rendered disclaimer |
| 10 | "this **motivates me to log more data**" | completeness → logging prompt loop | **ABSENT** — no link between an insight's completeness and a logging nudge | `07` §3 job 2 + `08` §2 `blocked-completeness` status |
| 11 | "next week, **new insights from new paper, not repetitive**" | self-recursive ingestion loop + novelty | **ABSENT** — loop entirely unbuilt (static seeder, no `insight_needs`, no `verified_edges`, no synthesis/verifier); no novelty mechanism | `08` §4–§5: gap ledger → targeted retrieval → real pipeline → novelty boost |

**Reading the table:** beats 1 and 9-inputs are the only things that exist. Beats 4, 8, and 11 all reduce
to *the same missing spine* — **the brain edge pipeline** (`08` §4 step 3). Build that spine and beats 4/8
become wiring; leave it unbuilt and no amount of UI work produces an impressive report.

---

## 2 · The dependency spine (what everything hangs off)

Ordered by how many UX beats collapse if it's missing:

1. **The edge pipeline** (`extract.ts` upgrade → segment/tier/assertion → synthesis → NLI → verifier →
   `verified_edges` → served store). **Blocks beats 3, 4, 5, 6, 7, 8, 11.** Zero edges today. This is *the*
   build. It is also exactly the hackathon's scored delta (HD §4.2 item 5) — so the effort is aligned, not
   wasted.
2. **The completeness score** (`07` §3). **Enables beats 9, 10** directly and is the **hidden linchpin** of
   beat 11 (§3 below).
3. **The applicability axis** (`07` §2.1). **Enables beat 6** and sharpens beat 11's discrimination. The
   only beat that needs a genuinely new concept with no contract home.
4. **The report composition layer** (`07` §1). **Enables beats 2, 3, 4.** Cheap once edges + completeness
   exist; it's a composition, not new truth.

---

## 3 · The three gaps a shallower pass would miss

Jayden's worry — *"the current opus model will miss some."* These are the non-obvious ones; each is a place
where a plausible-looking design silently fails.

- **The completeness score is not a UI nicety — it is what makes the self-recursive loop *correct*.** It
  reads like beat 9's disclaimer. But without it, `08` §3 **cannot distinguish "no relationship" from "not
  enough data yet,"** so the brain either wastes ingestion chasing noise (`personal-null` misread as a gap)
  or nags the user about relationships that don't hold. Miss this coupling and beat 11 quietly degrades into
  a noise generator. It is beat 9 *and* the discrimination gate for beat 11.
- **"New insights each week" (beat 11) is a *consequence* of the loop, not a feature you can build
  separately.** A tempting shortcut is a "novelty" ranker over existing cards. But if the loop (`08` §4)
  didn't actually ingest a new paper between reports, there is no new edge to surface — the ranker just
  reshuffles the same cards. Freshness is real only if step §4 ran. So the load-bearing build is the loop,
  and novelty is a two-line boost on top (`08` §5) — the opposite of where UI-first instinct puts the
  effort.
- **The derivation explanation (beat 7) must be captured at synthesis time, not regenerated on view.** If
  you generate "how the sentence became the insight" when the user taps, you (a) pay LLM latency per view,
  (b) risk a *different* explanation than the one that actually produced the edge, breaking the verifiability
  promise of beat 8. It has to be a stored by-product of the synthesis step (`07` §2.2) — a data-model
  decision that's invisible until it bites.

A fourth, smaller one: **beat 7's "exact page" needs structured offsets that `extract.ts` destroys today.**
The verbatim *quote* is verifiable now; the *page number* is not, until the PSK stage-1 upgrade. Ship beat 7
with the verbatim quote + free-text locator first; "exact page" is a later increment, not a blocker.

---

## 4 · What more DESIGN you still need (beyond build)

`06`/`07`/`08` define the architecture. These three items need design *decisions from you* before build,
because they can't be resolved from the code:

### 4.1 · Applicability scoring — method + cold-start policy
The axis is defined (`07` §2.1) but its *scoring function* is open: which population components (age/sex/
health-status/method/context), how weighted, and — the real decision — **how much shows `unknown` at cold
start.** With an OA-only, abstract-heavy corpus, many papers have no stated population, so the honest plot
may be mostly `unknown` early. Decide: is a mostly-`unknown` plot acceptable (honest but underwhelming), or
do you gate the plot until PICO extraction (PSK stage 2) matures? **Recommendation:** ship with `unknown`
shown honestly; it demonstrates the axis and the honesty in one move.

### 4.2 · The false-signal discrimination residue (the one bounded unknown)
`08` §3 defines the decidable subset and a heuristic for the middle, but **the residue is genuinely
unsolved**: "no relationship" vs "paper not found yet" vs "real but under-powered" cannot be perfectly
separated. This is the only place the ideal UX rests on something not fully designable today. It is
*bounded*, not fatal — cheap re-evaluation + evidence-strength-capped ingestion keep it from running away —
but you should decide the ingestion budget cap and re-evaluation cadence, and **state the residue as a known
limitation** (which is itself the Honesty-pillar win, HD §11).

### 4.3 · Completeness formula calibration + the idiosyncratic surfacing decision
- The completeness score's weights (`07` §3) must be declared **provisional-pending-calibration**, not
  shipped as silent magic numbers (HD Priority 2 warns about exactly this for `edgeScore`/`EDGE_GATES`).
- The one product decision `06` §4 left to you: does a strong personal signal with **no** paper ever get
  surfaced (a visibly-separate "still researching" lane), or is it purely an ingestion trigger? Your own
  wording points at "purely a trigger"; confirm it.

Everything else the UX needs is *build against a settled design*, not open design.

---

## 5 · The verdict, and the critical path to a demoable version

**Verdict.** The ideal UX is **achievable** — no beat requires an unknown invention except the bounded
residue in §4.2, and after this wave every beat has a design. But it is a **large build dominated by one
spine** (the edge pipeline), and three beats (6, and the correctness of 9→11) need the design decisions in
§4 first. It is *not* a small increment on what exists; it is most of the brain delta plus a provenance
layer plus a loop.

**The depth-first slice that demonstrates the *whole* UX on one real card** (this is what to build for the
hackathon, per `06` §6 — depth over breadth, HD Priority 0):

1. **One real edge, end to end** — run the real pipeline (`08` §4) on **one** metric pair over a handful of
   curated papers: `extract`-with-spans → assertion gate → synthesis → verifier → one `verified_edges` row
   at `high`/`mid`. (Beats 4, 8, 11's mechanism.)
2. **One card with its source button → derivation trace** — verbatim quote + free-text locator + stored
   derivation explanation, verifiability invariant enforced. (Beats 5, 7, 8.)
3. **The reliability × applicability plot for that card's papers** — reliability from `evidenceTier`;
   applicability scored, `unknown` shown where population is absent. (Beat 6.)
4. **The deterministic completeness score** on that card, with the logging nudge. (Beats 9, 10.)
5. **The loop shown once** — a `personal-signal-no-edge` gap → queue → ingest → the edge from step 1 appears
   → coverage 5/80 → 6/80. (Beat 11, and the observed-delta the score needs, HD §0.5.)
6. **A minimal report shell** — the one card, one narrative paragraph over it, one trend chart. Not a
   product; a demo surface. (Beats 2, 3.)

That slice exercises **every beat of the ideal UX** while building **one** of each — which is exactly the
"modest claim, proven, beats a grand claim, asserted" posture the challenge rewards, and the honest answer
to "can I get there": *yes, and here is the one-card version that proves the whole experience is real before
scaling it to all D pairs.*
