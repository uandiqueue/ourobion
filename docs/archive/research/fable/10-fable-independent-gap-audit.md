> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [insight-engine-architecture.md](../../../shared/insight-engine-architecture.md).

# Independent gap audit — pressure-testing `08`/`09` against the target UX

**Date:** 2026-07-05 · **Status:** Fable research — independent systems-architecture gap analysis.
Scope: data-flow and capability review only. Domain is treated abstractly (metrics = opaque keyed
series; papers = opaque documents with tier/quote/scope provenance). Non-diagnostic copy-filtering is a
fixed black-box invariant and is not evaluated. Evidence base: `08`, `09`, `shared/brain/*`,
`docs/biotope/INSIGHTS-ENGINE-DESIGN.md` (IED), `tools/brain-ingest/src/{extract,seeds}.ts`, the
`insight_cards` / `baseline_snapshots` migrations, and the `m5b_insight_engine` UI module. Nothing else.

---

## 0 · One-line verdict

**The target UX is architecturally buildable, but `09`'s claim that "the design for every beat is in
hand" is wrong — at least six load-bearing interfaces are undesigned or point at data that is never
produced, and two capabilities `08` marks as "data exists" rest on a store that cannot supply them.**

---

## 1 · Capability decomposition → status

Statuses: **IN HAND** (code or persisted schema exists) · **DESIGNED** (doc specifies, no code) ·
**ABSENT** (neither). Where a capability splits into contract vs. producer vs. consumer, each part is
scored separately — this is where `09`'s single-status-per-beat table hides breaks.

| # | Capability | Kind | Status | Evidence |
|---|---|---|---|---|
| C1 | Per-metric 7-day baseline/trend store | store | **IN HAND** | `supabase/migrations/20260515100000_create_m5a_baseline_snapshots.sql:14-38` |
| C2 | Deterministic per-metric card generation (rule → card) | producer | **IN HAND** (hardcoded) | `insight_cards` schema `...20260515110000...sql:14-35`; hardcoded 6-rule engine per IED (`INSIGHTS-ENGINE-DESIGN.md:9-12`) |
| C3 | Data-driven rules engine (blueprints → `rules` table → evaluators) | producer+store | **DESIGNED** | IED B1–C (`INSIGHTS-ENGINE-DESIGN.md:38-124`) |
| C4 | Report object + generation trigger | store+producer | **ABSENT** (design pointer only) | UI is a flat card list, `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/insights_tab.dart:75-85`; no report schema anywhere; `09:45` defers to `07 §1` |
| C5 | Narrative paragraph synthesis (presentation agent) | transform | **DESIGNED** | IED §E (`INSIGHTS-ENGINE-DESIGN.md:128-136`) — but its input interface to the edge store is unspecified (G7) |
| C6 | Chart rendering (any chart, anywhere) | UI | **ABSENT** | `insights_tab.dart` renders icons only (`:154-160`); `09:46` confirms "no chart is rendered anywhere" |
| C7 | Edge contract (claim + verification types) | contract | **IN HAND** | `shared/brain/relationships.ts:102-184` |
| C8 | Edge gating/scoring (score, bands, servability) | read-path code | **IN HAND** | `shared/brain/index.ts:25-69` |
| C9 | Edge production pipeline (segment→synthesis→verify) | producer | **ABSENT** | only `extract.ts` (text flattening, `tools/brain-ingest/src/extract.ts:50-54,155-165`) and a static seeder (`seeds.ts:22-53`) exist; zero edges (`08:16-17`) |
| C10 | Edge persistence (`verified_edges`) | store | **ABSENT** | no migration exists; `08:13-14` confirms decided-only |
| C11 | Card ↔ edge provenance join | schema/interface | **ABSENT + UNDESIGNED** | `insight_cards` has no edge reference — only `confidence_sources text[]` defaulting to `'{self_report}'` (`...110000...sql:28`); see G1 |
| C12 | Source button + evidence panel UI | UI | **ABSENT** | `confidence_sources` is parsed (`impl/insight_service.dart:56`) but never rendered in `insights_tab.dart:147-300` |
| C13 | Reliability axis (per-paper tier) | contract | **IN HAND** (type only, zero instances) | `Citation.evidenceTier`, `relationships.ts:81` |
| C14 | Applicability axis — per-paper scope capture | contract+producer | **ABSENT** | `population` exists only at claim level (`relationships.ts:115-116`); `Citation` (`:76-85`) carries no scope field — see G4 |
| C15 | Applicability axis — user-side profile input | store | **ABSENT + UNDESIGNED** | no user-attribute store exists in anything read; nothing in `08`/`09` names one — see G4 |
| C16 | 2-D reliability×applicability plot | UI | **ABSENT** | no plotting surface exists (C6) |
| C17 | Verbatim quote spans | contract / producer | contract **IN HAND** (`QuoteSpan`, `relationships.ts:87-95`); producer **ABSENT** (C9) | |
| C18 | Structured page/char locator | producer | **ABSENT** | `collapseWhitespace` destroys line/page structure (`extract.ts:33-35`); PDF pages merged (`:51`, `mergePages: true`); `locator` is free-text-or-null (`relationships.ts:94`) |
| C19 | Derivation explanation ("how the sentences produce the insight") | contract+producer | **ABSENT — no contract field** | `RelationshipClaim` (`relationships.ts:102-125`) and `EdgeVerification` (`:132-178`) have no explanation/derivation field — see G5 |
| C20 | Verifiability guarantee (`quoteCheck` gate) | contract / producer | contract **IN HAND** (`relationships.ts:139-143`); computed by nothing | |
| C21 | Insight-level completeness score | transform | **ABSENT**; inputs **partial** and internally inconsistent | `days_of_data` is a 7-day count (`...100000...sql:20`) yet `confidence='high'` requires 14+ days (`:32`) — see G6 |
| C22 | Completeness → logging-nudge loop | UI+transform | **ABSENT** | nothing links card completeness to a prompt; `09:53` agrees |
| C23 | Gap ledger (per-pair status store) | store | **ABSENT**; shape **DESIGNED** (`08 §2`, `:85-105`) but its `personalSignal` input is never produced — see G2 | |
| C24 | Personal pair-correlation evaluator (n=1) | producer | **ABSENT + MIS-SPECIFIED** | `08:67` claims "the data (`baseline_snapshots`) exists" — it does not suffice; see G2 |
| C25 | Metric-mention linking (paper text ↔ `MetricKey`) | transform | **ABSENT + UNDESIGNED (both directions)** | see G3 |
| C26 | Targeted pair retrieval (queue → search queries → papers) | producer | **ABSENT** | `Seed` = topic slug + one free-text query (`seeds.ts:22-53`); no pair-shaped input exists — see G3 |
| C27 | Novelty / already-surfaced ledger | store | **ABSENT**; and the existing upsert destroys the history it needs | `insight_cards` upserts on `(user_id, rule_id)` refreshing `generated_at` (`...110000...sql:4-5,34`) — see G8 |
| C28 | Coverage metric (S/D over time) | transform | **DESIGNED** (`08 §6:182-187`), depends on C23–C25 | |
| C29 | Loop orchestration (Supabase ledger ↔ Node ingest CLI) | interface | **ABSENT + UNDESIGNED** | `tools/brain-ingest` is an offline CLI; `gap_ledger` is specified as a Supabase table (`08:103-105`); no transport/trigger between them is designed — see G9 |

Tally: **7 IN HAND** (mostly contracts and one store), **4 DESIGNED**, **18 ABSENT**, of which **6 are
also undesigned** (C11, C15, C19, C24, C25, C29) — versus `09 §0`'s "after this wave the design for
every beat is in hand."

---

## 2 · Ranked gaps that `08`/`09` miss or hand-wave (most severe first)

### G1 · There is no designed path from an edge to a card — and two rival card producers
The whole provenance UX (source button → papers → quotes) hangs on a join that does not exist and is
never specified. `insight_cards` is keyed by `(user_id, rule_id)` (`...110000...sql:34`) where
`rule_id` belongs to the **rules-blueprint truth system** (IED B1, `INSIGHTS-ENGINE-DESIGN.md:45`), not
the brain graph; the row carries no `edge_id`, no citations, no quote refs — only
`confidence_sources text[]` (`:28`). `09` beat 5 (`09:48`) says "wire the source button to the edge's
`citations[]`" — wire it *through what column*? Concrete break: an edge-derived card cannot even be
**inserted** — `category` is CHECK-constrained to five fixed values (`...110000...sql:23`), and no
mapping from `edgeId` to a `rule_id` is defined. Deeper: IED builds a deterministic
blueprint-rules→cards producer while `08 §4` builds an edge-pipeline→cards producer; both claim the
same output surface and no doc reconciles whether an edge becomes a blueprint, a new card type, or a
second table. This is the single largest undesigned interface and it blocks UX beats 4, 5, 6, 7, 8.

### G2 · The gap ledger's strongest signal is computed from a store that cannot supply it
`08 §2` makes `personal-signal-no-edge` the "highest-priority" ingestion trigger (`08:94`), fed by
`personalSignal {strength, N_eff, stable?}` from an "n=1 evaluator" over `baseline_snapshots`
(`08:67`: "the data … exists"). It does not: `baseline_snapshots` holds **one row per (user, metric)**
of 7-day **aggregates** (mean/std/min/max/trend), **overwritten nightly** (`...100000...sql:4-5,14-38`).
Pairwise correlation requires the joint day-level series of both metrics with history retained; no
aggregate-per-metric snapshot can yield it. The evaluator's real input (a raw-daily-log read path with
retention) is never named, and the algorithm (window, effective-N under autocorrelation, stability
test) is never specified. Without this producer the ledger's discrimination logic (`08 §3`) — the
"hard part" the doc spends most effort on — has no input for its most important row.

### G3 · Metric-key ↔ literature-term linking is unspecified in both directions
Every loop stage assumes a translation layer that no document defines. Forward: the co-occurrence
candidate source needs "two metrics co-tagged in result sentences" (`08:66`) — i.e., tagging free
paper text with canonical `MetricKey`s (`relationships.ts:35-36` requires registry-resolvable keys).
Backward: targeted retrieval must turn a queued **pair of metric keys** into per-adapter search
queries, but the only query shape in the codebase is `Seed` = one topic slug + one hand-written
free-text string (`seeds.ts:22-53`). `08 §4` step 2 names snowball/SPECTER for *expansion*, but
expansion presupposes a seed paper *for that pair* — which only the missing key→query transform can
find. Without this layer, step [1] (enumerate D), step [3] (queue), and step [4] (retrieve) of `08 §0`'s
own diagram have no connecting data format. `08` files this under "no co-occurrence index" as if it
were an unbuilt index; it is an undesigned transform.

### G4 · The applicability axis is missing both of its inputs, not just its formula
`09 §4.1` treats applicability as "method + cold-start policy" open. The break is earlier: (a)
**granularity** — the plot needs one applicability value **per dot = per paper**, but `population`
lives only on the claim (`relationships.ts:115-116`); `Citation` (`:76-85`) has no scope field, so a
multi-citation edge cannot place its dots — a contract change `09` never lists; (b) **the second
argument** — applicability is per-(paper, **user**), and no user-attribute/profile store exists or is
designed anywhere in the audited surface. A scoring function whose both inputs are never produced is
not "a formula decision"; it is two missing producers plus a contract amendment.

### G5 · The derivation explanation has no contract home — and the contract is change-gated
`09 §3` correctly requires the explanation to be **stored at synthesis time**. But
`RelationshipClaim` (`relationships.ts:102-125`) has no field for it, and the contract is TRUTH-tier
with a 2-reviewer PR gate (`relationships.ts:14-16`). So beat 7 requires a shared-contract amendment
(field + schema mirror + guard) that neither `08` nor `09` schedules. Same omission for G4(a)'s
per-citation scope field. These are cheap but **blocking and process-gated** — exactly the kind of
dependency an optimistic pass forgets.

### G6 · The completeness score is specified over an inconsistent, history-free store
Beat 9's disclaimer ("how many days of my data, missing datapoints, what the baseline is built from")
and `08 §2`'s `blocked-completeness` both consume completeness. Two breaks: (a) internal schema
inconsistency — `days_of_data` counts "how many of the 7 days" (`...100000...sql:20`, `smallint`,
max 7 by definition) while `confidence` defines `'high'` as "14+ days" (`:32`) — `'high'` is
unreachable as documented, so the in-hand "inputs" `09:52` cites are self-contradictory; (b) the
snapshot is overwritten nightly, so "how many days of data *back this insight*" over any window longer
than 7 days cannot be answered from it. The deterministic score needs either a retained snapshot
history or a raw-log aggregation path — neither is designed. Since `09 §3` itself declares completeness
"the discrimination gate for beat 11," this inconsistency propagates into the loop's correctness.

### G7 · Verifier deadlock: the gate requires a retrieval capability nothing provides
Gating is in-hand and strict: `uncertain` is never served (`relationships.ts:51-56`;
`SERVABLE_VERDICTS`, `index.ts:33`), and a grounded verdict requires the verifier's **own independent
retrieval** (`relationships.ts:144-148`). But the only retrieval machinery in the repo is the static
6-topic discovery seeder (`seeds.ts`), and `08 §4`'s snowball/SPECTER wiring is flagged unwired for
*ingestion* only. No component — designed or built — gives the **verifier** per-pair retrieval. Net
effect: even after building synthesis, every edge scores `uncertain` → `hold` → zero servable edges.
The in-hand code's invariants are stricter than any designed producer can satisfy; `08`/`09` never
connect these two facts.

### G8 · The novelty mechanism needs history that the current write path destroys
`08 §5` requires "every surfaced card recorded with the edge version behind it" and de-prioritizing
"a pair surfaced recently." The only card store upserts on `(user_id, rule_id)` and refreshes
`generated_at` in place (`...110000...sql:4-5,34`) — each regeneration overwrites the evidence of
prior surfacing. Additionally, "edge version" is undefined: `VerifiedEdge` has no version field
(nearest proxies: `promptVersion`, `verifiedAt`, `relationships.ts:123-124,174-176`). The surfaced-
ledger table, its keys, and the version semantics all need schemas `08` does not give.

### G9 · The loop's control seam (cloud ledger ↔ offline CLI) is undesigned
`gap_ledger` is specified as a Supabase table (`08:103-105`); the ingestion pipeline is an offline
Node CLI with a `--seed` selector over static topics (`seeds.ts:55-64`). `08 §4` step 1→2 hands "the
queue" to "targeted retrieval" with no transport, trigger, batch shape, idempotency, or result
write-back defined. This is a classic stage-whose-input-is-never-delivered break, independent of G3's
format problem.

Minor (noted, not ranked): the IED `correlation` condition is a conjunction of two per-metric leaf
tests (`INSIGHTS-ENGINE-DESIGN.md:54`), not a correlation computation — so the *designed* rules engine
cannot produce beat 4's "how metrics affect each other" either; only the edge pipeline can. IED also
still names the graph "a separate Neo4j projection" (`INSIGHTS-ENGINE-DESIGN.md:22`) while `08 §6`
directs dropping Neo4j — a live doc-level contradiction to resolve when the read store is designed.

---

## 3 · The specific additional design required (beyond `08`/`09`)

1. **Card↔edge unification design** (fixes G1): decide the producer topology (edge-derived cards as a
   second producer into `insight_cards` vs. a new `edge_cards` table); define the join column
   (`edge_id` FK or `rule_id := relationKey(...)` convention), the category mapping or CHECK
   relaxation migration, and which producer owns upsert semantics.
2. **Joint-series read path + n=1 evaluator spec** (fixes G2, G6b): name the raw daily-log store the
   evaluator reads; define retention; specify the correlation statistic, window, effective-N
   correction, and stability predicate that emit `personalSignal {strength, N_eff, stable}`.
3. **Metric↔literature linking layer** (fixes G3): a per-metric synonym/term map (an authored
   extension of the registry) powering (a) mention tagging for the co-occurrence index and (b)
   deterministic pair→query generation replacing the static `Seed` shape.
4. **Contract amendments, one 2-reviewer PR** (fixes G4a, G5): `Citation.population: string | null`
   (or a per-citation scope object) and `RelationshipClaim.derivation: string` (stored at synthesis),
   with schema mirrors/guards.
5. **User-scope input store** (fixes G4b): a minimal user-attributes schema (whatever fields the
   applicability function consumes) + the `[0,1]|unknown` scoring function over
   (citation-scope, user-attributes).
6. **Verifier retrieval design** (fixes G7): specify how `independentRetrieval` is satisfied per pair
   (shared retrieval service with ingestion vs. verifier-owned search), and the failure policy when
   retrieval returns nothing (today: permanent `uncertain`).
7. **Surfacing-history + report schemas** (fixes G8, C4): an append-only `surfaced_cards` (or
   `insight_reports` + join) table capturing card, edge id, verification `verifiedAt`/`promptVersion`,
   and report timestamp; define "edge version" as `(edgeId, verifiedAt)`.
8. **Ledger↔ingest transport** (fixes G9): queue rows' schema, the trigger (cron/dispatch), batch
   claim semantics, and the write-back of attempt outcomes to `lastIngestAttempt`.
9. **Completeness-store fix** (fixes G6a): correct or re-derive the `confidence`/`days_of_data`
   semantics (widen the window or re-document), and choose snapshot-history vs. raw-log aggregation as
   the completeness input.

---

## 4 · Unsolved cores (bounded/unsolved, not merely unbuilt)

1. **False-signal discrimination residue** — `08 §3`'s own admission stands: "no relationship" vs.
   "paper not yet found" vs. "under-powered" is not perfectly separable. Bounded by cheap
   re-evaluation + evidence-capped spend (`08:135-138`, `09 §4.2`). Genuinely unsolved; correctly
   flagged by the prior pass.
2. **Literature-term ↔ metric-key linking quality (G3)** — entity linking from free text to a private
   key registry has an irreducible precision/recall error floor; it is a *bounded* hard problem
   (authored synonym maps + thresholds contain it) but its error rate propagates into D, the
   co-occurrence candidates, and coverage-metric honesty. Neither `08` nor `09` registers it as a
   risk at all.
3. **Applicability inference at cold start** — with claim/citation scope frequently absent from
   abstract-heavy sources, per-paper applicability is often undecidable; bounded by an honest
   `unknown` rendering (`09 §4.1`'s recommendation is the right containment), but the underlying
   inference is not designable to completion today.
4. **Coverage denominator stability** — `08 §7-2`'s open question stands: D moves as corpus, linking
   maps (core 2), and active metrics change, so "coverage improved" needs a versioned-denominator
   reporting convention; bounded, undesigned.

---

## 5 · Verdict restated

Buildable — the contracts (`shared/brain`), gating code, and the two persisted stores are a real
foundation, and no gap above requires an invention beyond unsolved cores 1–4, all bounded. But the
prior pass's "design in hand for every beat" does not survive contact with the schemas: six interfaces
(G1–G5, G9) are undesigned, one signal producer points at a store that cannot feed it (G2), one
persisted schema is internally inconsistent on the exact field the completeness design leans on (G6),
and the in-hand gating logic deadlocks any pipeline lacking verifier-side retrieval (G7). The nine
design items in §3 are the true remaining design debt; the depth-first one-card slice in `09 §5`
remains the right build order **after** items 1, 2, 4, and 6 exist, because the slice's step 1
(one real edge, served) is impossible without them.
