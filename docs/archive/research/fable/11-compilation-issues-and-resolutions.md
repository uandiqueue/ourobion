> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# Insight engine — issues & resolutions compilation

**Date:** 2026-07-05 · **Status:** Stakeholder briefing. A single, self-contained compilation of every
problem and proposed resolution surfaced across the research pack (`01`–`10`), with newer findings
superseding older ones. Written for a non-developer reader.

**How to read this.** Every entry appears **twice**:
- **Plain** — understandable with no project or coding background. No file names, no jargon. Self-contained.
- **Technical** — the same point stated precisely, with exact file/line pointers for developers.

Only the *Technical* lines carry pointers. Severity: **Critical** (blocks the core experience) ·
**High** · **Medium**. Status: **Current** · **Superseded** (an older doc's position, now replaced) ·
**Decision needed** · **Unsolved core** (a genuinely hard problem, contained but not fully solvable today).

---

## Plain-language primer (read once; the rest builds on it)

- **The app** lets a person log daily health metrics (sleep, heart-rate variability, hydration, and so on)
  and see their trends — much like Apple Health.
- **The insights engine** is the flagship feature. Instead of only showing numbers, it explains *what the
  numbers mean*, and it backs each explanation with **real research papers**.
- **The research library** (internally, "the brain") is a store of **relationships** between metrics — e.g.
  "poor sleep tends to lower next-day recovery." Each relationship is tied to the papers that support it and
  is graded for how trustworthy it is.
- **An insight card** is one finding shown to the user.
- **The insights report** is a weekly write-up that combines several cards into readable paragraphs plus
  charts.
- **Sources / provenance** are the papers behind a card, down to the exact sentences used.
- **The completeness score** tells the user how much of *their own* logged data a finding rests on.
- **The self-improving loop** is the idea that when the app *can't* yet explain something, it goes and finds
  more papers so it can explain it next time.

---

## Section 1 — What the app should say (product philosophy)

### P1 · The engine was designed to hedge everything into meaninglessness · **High** · **Current (supersedes earlier position)**

**Plain — problem.** The original design made the app speak only in cautious "we observe X, but this may
just be coincidence" language. That defeats the entire point: a person can already see their own numbers.
They want to know what the numbers *mean*, what might follow, and what to consider doing. An app that only
narrates data with a disclaimer has re-created the ordinary health app it was meant to beat.

**Technical — problem.** The inherited stance (`04` §(c) "what is explicitly NOT shown"; source: metric-
knowledge-bridge brief §9 step 6, "observational language only — no causes/will/should") mandates hedged,
observational copy. Flagged and reversed in `06` §0–§3.

**Plain — resolution.** Let the card state a real, meaningful claim — but make it honest by *showing its
work* rather than by watering down its words. Under every card: a source button leading to the papers, the
exact sentences used, how trustworthy and how relevant-to-you each paper is, and a score for how much of
your own data backs it. The honesty lives in what the user can *check*, not in weasel words. Causal wording
is allowed only when it is quoting a paper ("research links poor sleep to lower recovery"), never asserted
about the person ("your poor sleep lowered your recovery"). Medical diagnosis and prescriptions stay
forbidden.

**Technical — resolution.** "Honesty moves from the sentence to the substrate" (`06` §1). Claim register
defined in `06` §3: causal/mechanistic language permitted only when carried by a citation; personal causal
claims stay forbidden; existing `validateCopyString` + `FORBIDDEN_WORDS` gates unchanged, plus a new
LLM-judge copy check on synthesized prose (`06` §3; `07` §1 stage 4). Non-diagnostic and two-tier-truth
constraints ([`0003`](../../../memory/0003-non-diagnostic-copy.md), [`0001`](../../../memory/0001-two-tier-truth.md))
treated as fixed invariants.

### P2 · Weak, low-value findings were shown to users instead of used to improve the app · **High** · **Current (supersedes earlier position)**

**Plain — problem.** The old design surfaced four kinds of card, including two weak ones: "research says
this, but it isn't clear in your data" and "this is unusual for you, but it's only a guess." Showing a
person a stream of shrugs makes the flagship feature feel empty. The instinct behind it — "we must show
*something* or the app looks silent" — is the wrong fix.

**Technical — problem.** The four-branch surfacing model (`01` H3; `02` C1; `04` §(c)) surfaces
research-context and idiosyncratic branches to the user. Superseded by `06` §4.

**Plain — resolution.** Show the user only the confident, well-supported findings — even if that's just a
few. The weak cases are not thrown away; they become *private signals telling the app what to go research
next*. "We see a strong pattern in your data but have no paper for it" is the single best cue to go find
papers — and if the app finds one, that becomes a real, cited insight the following week. Silence is turned
into fuel, not shown as a shrug.

**Technical — resolution.** Re-sort the four branches into one surfaced lane ("agree/confident") + three
internal feedback signals feeding the self-improving loop (`06` §4; `08` §2 status taxonomy). One open
product decision remains (P25).

---

## Section 2 — Getting the analysis right (the reasoning rules)

### P3 · A rigid "only fire if research AND personal data agree" rule would silence the app · **High** · **Current**

**Plain — problem.** A proposed rule said: only tell the user something if the research *and* their own data
both confirm it. In practice that almost never both happens for a single person over a few weeks, so the app
would stay silent — and when both *did* agree, it often means both were fooled by the same outside factor
(e.g., a hot season pushing two metrics at once), not that one truly causes the other.

**Technical — problem.** Triangulation encoded as a hard pre-fire AND-gate (`01` C1; metric-knowledge-bridge
§3.5 #3). Two failures: power asymmetry and shared-confounder legs.

**Plain — resolution.** Treat agreement as something that *raises confidence and ranking*, not as an on/off
switch. Agreement is described as "consistent with," never "proven."

**Technical — resolution.** Triangulation becomes a confidence/ranking modulator, not a gate (`02` C1;
`06` §2 keeps this as an epistemic guard).

### P4 · Some relationship types simply can't be served safely, and the design didn't say so · **Medium** · **Current**

**Plain — problem.** The app only knows whether a metric is *above or below the person's own normal*, not
where they sit on an absolute scale. For "U-shaped" relationships (where both too-little and too-much are
bad — like sleep duration), that's not enough to give a safe direction, and chaining several relationships
together compounds the ambiguity. The design treated all relationships as equally usable.

**Technical — problem.** `modulates` (non-monotonic) edges unservable from a baseline-relative signal;
multi-hop sign composition collapses to ambiguous (`01` H2; bridge §3.5 #1–2).

**Plain — resolution.** Only use straightforward "more-of-A goes with more/less-of-B" relationships, and
only look one step away (A directly to B), never long chains. U-shaped relationships are shown as background
context, never as a directional prediction.

**Technical — resolution.** 1-hop-only, monotonic-only servability boundary; `modulates` = context only
(`02` H2; `08` §6 read path is a 1-hop neighbour lookup).

### P5 · Nothing controlled for false alarms in the person's own data · **Medium** · **Current**

**Plain — problem.** If you test dozens of metric pairs for a coincidence, some will *look* related by pure
chance. Without statistical guardrails, the app would confidently report flukes.

**Technical — problem.** No n=1 statistics — autocorrelation-adjusted effective sample size, false-discovery
control, effect size + interval — over the active-metric pair set (`01` M1; bridge §9 step 4).

**Plain — resolution.** Add standard statistical safeguards that discount coincidences and account for the
fact that daily data points are not independent, before any personal pattern is reported.

**Technical — resolution.** Statistical evaluator: N_eff (Pyper–Peterman), FDR (Benjamini–Hochberg), effect
size + interval, minimum effective-n (`02` M1). Note: its data producer is broken — see P14.

### P6 · Trust was to be counted by "how many papers," which over-trusts echoes · **Medium** · **Current**

**Plain — problem.** Ten papers that all trace back to one original study are *one* piece of evidence, not
ten. Counting them as ten would make a relationship look far more certain than it is.

**Technical — problem.** Naive `Σsupport − Σcontradict` assumes paper independence (`01` M2; bridge §3.5 #6).

**Plain — resolution.** Group papers by their true independent origin before tallying support, so echoes and
citation chains don't inflate confidence.

**Technical — resolution.** Cluster corroboration by independent evidential root; additive dependency-cluster
field (`02` M2; paper-to-structured-knowledge §5).

### P7 · Fame could leak into trust · **Medium** · **Current**

**Plain — problem.** A heavily-cited, famous paper is not necessarily a *correct* one. If popularity quietly
boosted trust, the app could over-trust well-known but weak findings.

**Technical — problem.** Notability must not enter the served probability (`01` L2; bridge §7).

**Plain — resolution.** Use popularity only to decide *what to investigate*, never to decide *how much to
trust* what's shown.

**Technical — resolution.** Keep notability out of `edgeScore`/serving; add a guard test (`02` L2). Already
partly enforced — the trust score excludes venue impact.

---

## Section 3 — Turning papers into knowledge (ingestion)

### P8 · The step that turns papers into relationships was one line hiding a whole pipeline — and today it just mashes each paper into one blob · **Critical** · **Current**

**Plain — problem.** A research paper has structure: methods say how reliable it is, results carry the actual
finding, abstracts oversell. The current code throws all of that away and flattens each paper into one
undifferentiated wall of text before handing it to the AI. That makes it impossible to know how reliable a
finding is, to catch "no effect was found" (which reads identically to "an effect was found"), or to point
back to the exact sentence used.

**Technical — problem.** `extract.ts` flattens to one whitespace-collapsed string for both PDF and
structured XML, discarding sections and offsets (`tools/brain-ingest/src/extract.ts:50-54,155-165`,
`collapseWhitespace` `:33-35`). The plan compressed the whole cascade to one line (`01` C2; paper-to-
structured-knowledge §0, §7).

**Plain — resolution.** Rebuild this into clear stages: split the paper into its parts, tag what each
sentence is, grade reliability, and — crucially — filter out "no effect / maybe" findings before the AI ever
sees them. Keep enough location detail to quote the exact sentence later.

**Technical — resolution.** Named cascade: section segmentation + sentence-role tagging (the `extract.ts`
upgrade) → tiering → assertion/negation gate → synthesis → verification, with character offsets preserved
(`02` C2; `03` #10). Ops caveat unresolved — see P24.

### P9 · The tempting shortcut for launch would bypass the very thing being judged · **High** · **Current**

**Plain — problem.** To have *something* on day one, it's tempting to hand-write a few relationships. But
the whole value (and the thing the competition judges) is the automated paper-to-knowledge machine. Hand-
writing relationships demonstrates none of it.

**Technical — problem.** "Ships with hand-authored relationships if needed" bypasses the synthesis pipeline
(`01` M4; bridge §12). Priority-0 risk (HACKATHON_DIRECTION §0.5).

**Plain — resolution.** Fill the library ahead of launch by *actually running the real machine* over a
chosen set of papers, so the day-one library is genuinely produced by the pipeline. A tiny number of
hand-written entries are allowed only as emergency "don't show an empty screen" insurance, never as the
demonstrated capability.

**Technical — resolution.** Prepopulation-by-pipeline (`06` §5; `08` §4); hand-seeded `provenance:'seed'`
edges as anti-empty-graph insurance only (`02` M4).

---

## Section 4 — The self-improving library (the newest and least-built idea)

### P10 · "Early users get no insights, so the app looks broken" was going to be solved the wrong way · **High** · **Current**

**Plain — problem.** Early on the library is thin, so there's little to say. The old fix was to lower the bar
and show weak cards (see P2). The real issue is confusing two different "cold" things: the *library* being
thin vs. the *user's own data* being thin.

**Technical — problem.** Cold-start framed as a surfacing problem (`04` §(c)); reframed in `06` §5.

**Plain — resolution.** Fill the library before launch (P9) so it already knows plenty. What's genuinely
"cold" is the user's own data — and that's an opportunity, not a failure: the completeness score tells them
"log a couple more days and we can confirm this for you," which motivates them to keep logging.

**Technical — resolution.** Raise supply, not lower the bar; the user's data is the cold thing, carried by
the completeness motivation loop (`06` §5; `07` §3).

### P11 · The "find more papers automatically" loop was described but never designed · **High** · **Current**

**Plain — problem.** The appealing promise — "next week, new insights from new papers" — needs a machine
that notices what it *couldn't* explain, goes and researches exactly that, and adds it back. None of that
existed.

**Technical — problem.** No gap ledger, no demand-driven seeder, no closed loop; the seeder is a static
6-topic list (`tools/brain-ingest/src/seeds.ts:22-53`). Absent across `BRAIN-*` docs; designed in `08`.

**Plain — resolution.** Keep a private ledger of every metric pair worth explaining, each tagged with *why*
it isn't explained yet (no paper found / weak evidence / the user's data is too thin / genuinely unrelated).
Feed the "worth researching" ones into targeted paper-hunting, run them through the real machine, and surface
the new results as fresh insights. Track a simple "how many of the explainable relationships can we actually
explain" score over time to prove the app is improving.

**Technical — resolution.** Per-pair gap ledger + status taxonomy (`08` §2), prioritized ingestion queue →
targeted retrieval → real pipeline → novelty boost (`08` §4–§5); coverage = served/derivable (`08` §6).
Multiple producers for this are missing — see P14, P15, P21.

### P12 · Telling a real gap from a real dead-end is genuinely hard · **Medium** · **Unsolved core**

**Plain — problem.** When the app can't explain a pattern, it can't be sure whether (a) the right paper
exists and just hasn't been found, (b) there truly is no relationship, or (c) the user simply hasn't logged
enough yet. Chasing the wrong ones wastes effort or nags the user pointlessly. There is no perfect way to
tell these apart.

**Technical — problem.** False-signal discrimination residue (`08` §3; `10` unsolved core 1). Compounded by
imperfect text-to-metric linking (`10` core 2) and missing-scope cold-start (`10` core 3).

**Plain — resolution (containment, not a cure).** Use the completeness score to separate "not enough data"
from "no relationship," spend research effort only where there's positive evidence a relationship should
exist, cap how much is spent chasing uncertain leads, and cheaply re-check as more data and papers arrive.
Be honest in the write-up that this is a bounded, not solved, problem.

**Technical — resolution.** Decidable subset + heuristic middle + capped spend + re-evaluation (`08` §3);
completeness gate (`07` §3) resolves the ambiguous middle.

---

## Section 5 — Where the plumbing doesn't connect (from the independent Fable audit, `10`)

*These supersede the earlier claim that "the design for every beat is in hand" (`09` §0). They are the true
remaining design debt.*

### P13 · There is no way to connect a shown card back to the papers behind it — and two parts of the system both try to create cards · **Critical** · **Current (corrects `09`)**

**Plain — problem.** The entire "tap a card → see its sources" experience depends on a link between a card
and its evidence. That link does not exist. Worse, the card store was built for a different, older card
system and would literally reject the new evidence-based cards. And two separate parts of the system each
think they own card creation, with nothing saying how they fit together.

**Technical — problem.** `insight_cards` is keyed by `rule_id` (the rules-blueprint system), carries no
`edge_id`/citations, and its `category` CHECK rejects edge-derived cards
(`supabase/migrations/20260515110000_create_m5b_insight_cards.sql:23,28,34`). Rules engine (IED B1) and edge
pipeline (`08` §4) are two unreconciled card producers (`10` G1).

**Plain — resolution.** Decide how evidence-based cards are stored and how each links to its papers, and
settle which part of the system owns creating cards. This is the single biggest missing design and it blocks
most of the impressive experience.

**Technical — resolution.** Card↔edge unification design: producer topology, join column (`edge_id` FK or
`rule_id := relationKey(...)`), category mapping/CHECK migration, upsert ownership (`10` §3 item 1).

### P14 · The most important "improve the library" signal is computed from data that can't produce it · **Critical** · **Current (corrects `08`)**

**Plain — problem.** The top cue for what to research next is "the user shows a strong personal pattern we
can't explain." But the app only stores a *nightly summary* per metric that is overwritten each day. You
cannot detect a pattern *between two metrics* from separate summaries — you need their day-by-day history
kept side by side. The design assumed this data was already available; it isn't.

**Technical — problem.** `08` §1 claims the personal-correlation input "exists" in `baseline_snapshots`, but
that table stores one overwritten-nightly 7-day aggregate per (user, metric)
(`supabase/migrations/20260515100000_create_m5a_baseline_snapshots.sql:14-38`); pairwise correlation needs
retained joint day-level series (`10` G2).

**Plain — resolution.** Add a store of the raw day-by-day logs (kept over time), and define exactly how the
personal-pattern detector reads it and computes a reliable correlation.

**Technical — resolution.** Joint-series read path + n=1 evaluator spec: raw daily-log store, retention,
statistic/window/effective-N/stability predicate (`10` §3 item 2).

### P15 · Nothing translates between "a metric" and "the words papers use" · **High** · **Current**

**Plain — problem.** Papers talk in prose ("sleep quality," "resting heart rate"); the app talks in fixed
metric labels. To find papers about a given pair of metrics — or to notice which papers mention which
metrics — you need a translation layer both ways. It was assumed but never designed.

**Technical — problem.** Metric-key ↔ literature-term linking unspecified in both directions; only query
shape is a static topic slug + free text (`tools/brain-ingest/src/seeds.ts:22-53`) (`10` G3).

**Plain — resolution.** Build an authored dictionary mapping each metric to the words and synonyms papers use
for it, powering both "which papers mention this metric" and "search for papers about this pair."

**Technical — resolution.** Metric↔literature linking layer: per-metric synonym/term map extending the
registry, powering mention-tagging and pair→query generation (`10` §3 item 3).

### P16 · The "reliability vs. relevance-to-you" chart is missing both of its inputs · **High** · **Current**

**Plain — problem.** The envisioned source screen plots each paper by how *reliable* it is and how much it
*applies to this specific user*. Reliability exists, but "applies to you" needs two things that don't exist:
the population each paper studied (per paper), and a profile of the user to compare against. Without both,
there's nothing to plot on that axis.

**Technical — problem.** Applicability needs per-paper scope (`population` lives only at claim level,
`shared/brain/relationships.ts:115-116`; `Citation` `:76-85` has no scope field) and a user-attribute store
(none exists) (`10` G4).

**Plain — resolution.** Capture each paper's studied population, add a small user-profile store, and define
how the two are compared into an "applies to you" score — showing an honest "unknown" when a paper doesn't
state its population.

**Technical — resolution.** Per-citation scope field (contract change) + minimal user-attributes schema +
`[0,1]|unknown` scoring function (`10` §3 items 4, 5). Cold-start policy is a decision — see P26.

### P17 · The "here's how we derived this" explanation, and per-paper relevance, have nowhere to live — and adding them needs sign-off · **High** · **Current**

**Plain — problem.** Two of the trust-building details — the plain explanation of how a paper's sentences led
to the insight, and each paper's relevance-to-you — have no place to be stored. Adding storage for them
touches a shared, carefully-guarded contract that requires two-reviewer approval, and that work was never
scheduled.

**Technical — problem.** No `derivation` field on `RelationshipClaim` and no per-`Citation` scope field;
`shared/brain` is TRUTH-tier with a 2-reviewer PR gate (`shared/brain/relationships.ts:14-16,102-125`)
(`10` G5).

**Plain — resolution.** Schedule one bundled, reviewed change that adds both fields, stored at the moment the
relationship is created (so the explanation always matches what actually produced it).

**Technical — resolution.** One 2-reviewer PR adding `Citation.population` and `RelationshipClaim.derivation`
with schema mirrors/guards (`10` §3 item 4).

### P18 · The completeness score rests on a store that contradicts itself and forgets history · **High** · **Current (corrects `08`/`09`)**

**Plain — problem.** The score meant to say "based on X of your last N days" reads from a store whose own
rules don't add up: one field can only ever count up to 7 days, while another field's "high confidence"
requires 14+ days — which is therefore never reachable. And because it's overwritten nightly, it can't
answer "how many days back this insight" over any longer period.

**Technical — problem.** `days_of_data` is a ≤7 count (`...100000...sql:20`) while `confidence='high'`
requires 14+ days (`:32`) — unreachable; nightly overwrite loses history (`10` G6).

**Plain — resolution.** Fix the contradictory rules, and either keep a history of these daily summaries or
compute the score from the raw logs instead.

**Technical — resolution.** Correct `confidence`/`days_of_data` semantics + choose snapshot-history vs
raw-log aggregation (`10` §3 item 9).

### P19 · The safety gate is stricter than anything can currently satisfy — so nothing would ever be shown · **Critical** · **Current**

**Plain — problem.** There's a strict, already-built rule: a relationship is only shown if a second,
independent check re-finds supporting evidence on its own. But nothing in the system actually performs that
independent second search. The result: every relationship stays stuck at "unverified" and *nothing is ever
shown* — the whole feature silently produces zero results.

**Technical — problem.** `uncertain` never served and a servable verdict requires verifier-side
`independentRetrieval` (`shared/brain/relationships.ts:51-56,144-148`; `index.ts:33`), which no component
provides (`10` G7).

**Plain — resolution.** Design the independent second-search step: how it fetches its own evidence for each
relationship, and what to do when it finds nothing (rather than leaving it stuck forever).

**Technical — resolution.** Verifier retrieval design: shared-vs-verifier-owned retrieval + failure policy
(`10` §3 item 6). This is a prerequisite for the day-one demo slice.

### P20 · "New this week, not repetitive" needs a memory the system currently erases · **Medium** · **Current**

**Plain — problem.** To avoid repeating the same insights week after week, the app must remember what it
already showed. But the current card store overwrites its own record each time a card is regenerated, wiping
exactly that memory.

**Technical — problem.** `insight_cards` upserts on `(user_id, rule_id)` refreshing `generated_at` in place
(`...110000...sql:34`); no "edge version" concept (`10` G8).

**Plain — resolution.** Keep an add-only history of what was shown and when, so the app can tell what's
genuinely new.

**Technical — resolution.** Append-only surfaced-cards/report history table; define "edge version" as
`(edgeId, verifiedAt)` (`10` §3 item 7).

### P21 · The two halves of the loop have no wire between them · **Medium** · **Current**

**Plain — problem.** The part that decides *what to research* lives in the app's cloud database; the part
that *does the research* is a separate offline tool. Nothing connects them — no way to hand a research
to-do list across, run it, and send results back. The loop is drawn as a circle but the circle is open.

**Technical — problem.** `gap_ledger` is a Supabase table (`08` §2); ingestion is an offline Node CLI
(`seeds.ts:55-64`); no transport/trigger/write-back designed (`10` G9).

**Plain — resolution.** Define the hand-off: how the research to-do list is delivered to the tool, on what
schedule, and how results are written back.

**Technical — resolution.** Ledger↔ingest transport: queue schema, trigger, batch/idempotency, outcome
write-back (`10` §3 item 8).

---

## Section 6 — Missing screens (user-facing surfaces that don't exist yet)

### P22 · There is no insights report — only a flat list of cards · **High** · **Current**

**Plain — problem.** The vision is a weekly *report* with paragraphs and charts that connect several findings
into a story. Today there's only a plain scrolling list of separate cards, no narrative, and no charts
anywhere.

**Technical — problem.** No report object/generation; UI is a flat card list
(`apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insights_tab.dart`); no chart rendering (`10` C4,
C6). Presentation agent designed only (IED §E, `docs/biotope/INSIGHTS-ENGINE-DESIGN.md:128-136`).

**Plain — resolution.** Build the report as a composed piece: pick the best few findings, group related
ones, write a short connecting narrative over only those, and render charts from stored numbers. Keep it
minimal for the first demo.

**Technical — resolution.** Report composition pipeline: select/rank → 1-hop cluster → constrained narrative
→ chart specs → completeness disclaimer (`07` §1).

### P23 · The source button, the paper chart, and the exact-quotes view don't exist · **High** · **Current**

**Plain — problem.** The trust-building heart of the experience — tap a card, see its papers plotted, tap a
paper, read the exact sentences used and how they led to the insight — has no screens at all. Even the paper
data the card already carries is loaded but never shown.

**Technical — problem.** Source/evidence panel absent; `confidence_sources` parsed
(`apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:56`) but never rendered; no plot
surface (`10` C12, C16).

**Plain — resolution.** Build the source button → paper chart → paper detail flow, showing the exact
verbatim sentences (which are already verified to genuinely appear in the real paper) plus the plain
derivation explanation. Guarantee: only ever show a sentence that was checked to be really present in the
real paper.

**Technical — resolution.** Source-provenance experience + verifiability invariant (`07` §2); depends on the
contract fields in P17 and the pipeline in P8/P19.

### P24 · The completeness disclaimer and "log more" nudge aren't wired · **Medium** · **Current**

**Plain — problem.** The motivating detail — "this is based on 5 of 7 days; log a couple more and we can
confirm it" — isn't shown, and nothing links a finding's completeness to a prompt to log more.

**Technical — problem.** No insight-level completeness score or logging-nudge link (`10` C21, C22). A
daily-logging completeness score exists but is unrelated.

**Plain — resolution.** Compute a plain, reproducible completeness score per finding and show it as a
disclaimer, with a nudge to log more when it's low.

**Technical — resolution.** Deterministic completeness score over contributing metrics + nudge (`07` §3);
depends on the store fix in P18.

---

## Section 7 — Open decisions and cross-document contradictions to settle

### P25 · Should a strong personal pattern with no paper ever be shown? · **Decision needed**

**Plain.** When the app finds a strong pattern in someone's data but no research paper supports it, do we
(a) never show it and only use it to decide what to research, or (b) show it in a clearly-separate "we're
still researching this" style? The stated vision points at (a); it needs a yes.
**Technical.** `06` §4 decision; interacts with `08` §2 `personal-signal-no-edge` status.

### P26 · How much "unknown" relevance is acceptable at launch? · **Decision needed**

**Plain.** Many papers don't state who they studied, so early on the "applies to you" score will often be
"unknown." Do we show an honestly-mostly-unknown chart, or hold the chart back until we can fill it in? The
recommendation is to show "unknown" honestly.
**Technical.** `09` §4.1 applicability cold-start policy; `10` core 3.

### P27 · Keep or drop the graph database? · **Current (contradiction resolved toward "drop")**

**Plain — problem.** One document added a specialised "graph database" to store relationships; the strategy
guidance and later analysis both say that's needless complexity at this scale and should be dropped.
**Technical — problem.** `03` #12 adds a Neo4j sync job; `05` F3, `08` §6, and HACKATHON_DIRECTION Priority 2
say drop it. IED still names "a separate Neo4j projection" (`docs/biotope/INSIGHTS-ENGINE-DESIGN.md:22`) — a
live contradiction (`10` G9 minor).

**Plain — resolution.** For now, drop the specialised database and use the simpler store already planned;
update the one design doc that still assumes it.
**Technical — resolution.** Project the truth store straight to the force-graph; reconcile IED §22 wording
(`08` §6).

### P28 · The designed rules engine can't actually detect "how metrics affect each other" · **Medium** · **Current**

**Plain — problem.** One part of the design claims to find relationships between metrics, but what it actually
does is just check two metrics separately and require both — it never measures whether they move *together*.
Only the paper-driven library can genuinely do that.

**Technical — problem.** IED `correlation` condition is a conjunction of two per-metric leaf tests, not a
correlation (`docs/biotope/INSIGHTS-ENGINE-DESIGN.md:54`) (`10` G9 minor).

**Plain — resolution.** Rely on the research library for "how metrics affect each other," and either rename
this rule so it isn't mistaken for real correlation or replace it with a genuine one.

**Technical — resolution.** Route beat-4 "how metrics affect each other" to the edge pipeline; clarify or
replace the IED `correlation` leaf.

### P29 · Some proposed tooling clashes with the project's "no Python" rule · **Medium** · **Current**

**Plain — problem.** A couple of the recommended off-the-shelf tools for reading papers are built in Python
or Java, but the project has a rule to stay in one language (TypeScript). This was presented as settled
when it's actually an open question.

**Technical — problem.** GROBID (Java) and negspacy (Python) conflict with the "no Python, TS-first" rule
(IED states "ourobion uses no Python"); paper-to-structured-knowledge §11-Q1/Q2 are open (`05` F2).

**Plain — resolution.** For the first version, prefer papers that already come in a structured format (so no
special reader is needed), and rebuild the "no effect / maybe" filter in the project's own language — or
consciously accept running one separate helper service.
**Technical — resolution.** Structured-XML-first for the slice; TS-native assertion gate (drop negspacy); or
accept a Java sidecar explicitly (`05` F2).

### P30 · The whole scored deliverable rests on one person · **Medium** · **Current (delivery risk)**

**Plain — problem.** Nearly all of the judged, novel work sits with a single engineer. If that person is
unavailable, the core deliverable stalls.

**Technical — problem.** Track B concentration on MNT/Jayden (`01` L1; `05` F1 also flags a team-model
contradiction with the plan's stated ownership).

**Plain — resolution.** Split off the clearly-defined, mechanical pieces to a second developer, ship the
smallest end-to-end demo first to de-risk early, and reconcile who owns what in the plan.
**Technical — resolution.** Carve deterministic slice to JR; ship the one-card slice first (`02` L1; `09` §5).

---

## Priority read (if you only act on a few)

The experience cannot demo end-to-end until these are designed, in this order:

1. **P19** — the safety gate currently lets *nothing* through (zero results).
2. **P13** — no link between a card and its papers (blocks the entire source experience).
3. **P14** — the top "what to research next" signal can't be computed from today's data.
4. **P8** — papers are still mashed into one blob, so nothing downstream can be reliable or quotable.
5. **P17** — the trust-detail fields need one scheduled, reviewed contract change.

Everything else builds on these. The recommended proof is a single-card, end-to-end demo (`09` §5) — one
real finding, with its real sources, its real quotes, its completeness score, and one turn of the
self-improving loop — built only after items 1–5 above exist.
