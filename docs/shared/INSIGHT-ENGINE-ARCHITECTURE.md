# Insight-engine architecture — ground truth

**Purpose:** the single authoritative description of the insight engine end-to-end — the
deterministic serve path (biotope) and the offline authoring/loop pipeline (behind nao) — every
stage, every wire, every store.
**Status: authoritative ground truth.** This document states decided architecture. Where it
conflicts with older design docs, this document wins (see [What this supersedes](#12--what-this-supersedes)).

Related docs and contracts:

- [`../nao/BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) — brain rationale (synthesis/verification split).
- [`../nao/BRAIN-INGESTION-DESIGN.md`](../nao/BRAIN-INGESTION-DESIGN.md) — the ingest CLI this doc's A-stages extend.
- [`../biotope/INSIGHTS-ENGINE-DESIGN.md`](../biotope/INSIGHTS-ENGINE-DESIGN.md) — the rules-engine card producer (IED), retained as one producer among three.
- [`../../shared/brain/`](../../shared/brain/) — the TRUTH contract types and gating functions (`relationships.ts`, `index.ts`, `relationships.schema.ts`).

Scope: data-flow, interfaces, stores, and control planes. Domain terms are opaque labels
(metric = keyed numeric series; paper = document with tier/quote/scope provenance). The copy
filter (`validateCopyString`) is a fixed black-box invariant, not designed here. Every stage's
input is produced by a named upstream stage or store — no orphan inputs.

---

## 1 · Hard invariants

These are settled and are not re-argued anywhere downstream:

1. **Two-tier truth.** The authoring path may use LLMs; every LLM output is a rebuildable, derived
   projection of TRUTH-tier inputs (corpus + versioned prompts + git-tracked contracts). To change
   an edge, fix the input and re-run — never hand-edit the projection
   (`shared/brain/relationships.ts:9-16`).
2. **Serve path deterministic except cached phrasing.** Everything a user reads is produced by
   table reads and pure functions, except final copy-gated phrasing (S8/S9), which is generated
   fire-triggered, cached, and template-fallbacked — never per-render. U1 grades are likewise
   generated-and-cached; serve-time reads are deterministic table reads.
3. **Serving gate.** Only `supported|partial` verdicts serve, via `edgeScore`/`servingBand`
   (`shared/brain/index.ts:33,40-57`). Edge joins are **1-hop, monotonic-only**: only
   `increases|decreases` relations may set a card's direction; `modulates|correlates` edges attach
   as context-only citations, never a directional claim.
4. **Notability ≠ trust.** `impactTier` (venue weight) is kept separate from `evidenceTier`
   (design strength) (`relationships.ts:66-67`) and is **excluded from `edgeScore`**
   (`index.ts:40-48`) — a top venue can still run a weak design.
5. **Corroboration counts independent evidential roots.** Supporting papers that share a citation
   root collapse to one effective source (A4b/A6 `refGraph`, walked by A10) — copies of one voice
   are not corroboration.
6. **Registry-resolvable endpoints.** Every edge endpoint is an active
   `shared/metrics/registry.ts` key (`relationships.ts:18-21,35-36`).
7. **TS-native, one waiver.** The whole slice is JATS/structured-XML-first and all gates are
   TS-native. The one-language rule is waived for exactly ONE seam: PDF structuring runs a
   GROBID-style structure/reference parser as a CLI-orchestrated sidecar (A4). Everything
   downstream of the structured artifact is TS-native.

---

## 2 · TL;DR

Two paths share one truth substrate.

**Serve path (all deterministic until the last phrase):** raw day-rows (`daily_gut_rows`,
`wearable_daily` — already retained per-day) → a registry-driven **unpivot projection**
(`metric_daily_values`) → **baselines v2** (window-parameterised) → **3-state signals** → the
**n=1 evaluator** (D2, with N_eff + FDR) and the **composed-insight composer**, which joins a
fired signal to 1-hop servable D1 edges and classifies the branch. The `agree` branch becomes a
cited **card** (edge-joined via `edge_refs`); the `idiosyncratic` branch becomes a **second,
clearly-labelled "still researching this" card** — uncited, visually separate, explicitly an
unverified personal observation — AND still fires its gap-ledger event; `research-context` and
`contradiction` become **gap-ledger events only**. Cards are phrased by a cached presentation LLM
with a deterministic template fallback, then selected/clustered/charted into a weekly **report**
with an append-only surfaced history.

**Authoring + loop path (LLM-guarded-by-determinism):** the **gap ledger** classifies every
candidate pair → prioritised **queue** → delivered to the offline ingest CLI over the **existing
R2 control plane + GitHub Actions dispatch** (reusing `apps/nao/src/lib/githubDispatch.ts`) →
**pair→query generation** from an authored **metric↔literature term map** → retrieval →
**structure-with-offsets** (`extract.ts` v2; GROBID-style parser for PDF-only papers) →
**citation-block parse** (A4b: reference-style detect, reference-list parse, claim→reference map)
→ mention-tagging/co-occurrence (term map, reverse direction) → assertion gate → **synthesis**
(emits claim + quoteSpans + `derivation`) → deterministic **quote check** → **verifier with
corpus-first independent retrieval and a decorrelated non-Anthropic model** → edge artifacts in
R2 → a nao **loader cron** projects them into Postgres `verified_edges` (no Neo4j) → served next
report with a novelty boost. **Prepopulation runs this same pipeline off-API** via a
developer-run terminal LLM session (no metered budget); runtime queue runs are metered and
governed by the nao-editable budget in R2 `control/ingest-config.json`.

23 stages. One contract PR bundles `Citation.population`, `RelationshipClaim.derivation`, and
structured `QuoteSpan` offsets (see §7).

---

## 3 · Stage map

Compute classes: **DET** deterministic code · **RULES** authored rules/config · **TM** trained
model (deferred; LLM substitute named) · **LLM**. Generalization: **G** one implementation for all
metric keys · **M** needs per-key authored config (location given).

| # | Stage | Compute | Gen. | Model | Store (persisted output) |
|---|---|---|---|---|---|
| S1 | Capture (exists) | DET | M (registry) | — | `daily_gut_rows`, `wearable_daily` |
| S2 | Metric joint-series projection | DET | G (registry-driven) | — | `metric_daily_values` (view) |
| S3 | Baseline v2 | DET | G | — | `baseline_snapshots` (amended) |
| S4 | 3-state signal + pattern firing | DET + RULES | M (deadbands in registry ext.) | — | ephemeral (recomputed) |
| S5 | D2 n=1 evaluator | DET | G | — | `personal_signals` |
| S6 | D1 edge read store + gating | DET | G | — | `relationship_claims`, `edge_verifications`, `verified_edges` view |
| S7 | Composed-insight composer (+ completeness scorer) | DET + RULES | G | — | `composed_insights` |
| S8 | Card producer + phrasing (cited + "still researching" variants) | DET + LLM (phrase only) | G | Claude Haiku 4.5 (`claude-haiku-4-5`), cached; template fallback | `insight_cards` (amended) |
| S9 | Report composer | DET + LLM (narrative only) | G | Claude Sonnet 5 (`claude-sonnet-5`), constrained | `insight_reports`, `surfaced_cards` |
| U1 | Applicability transferability grader | **LLM** (graded at generation time, cached; serve reads DET) | G | Claude Sonnet 5 (`claude-sonnet-5`); optional decorrelated 2nd grader | `applicability_grades`, `user_attributes` |
| A1 | Gap ledger + status classifier | RULES | G | — | `gap_ledger` |
| A2 | Pair→query generation (term map, forward) | DET | M (`shared/metrics/terms.ts`) | — | — (in queue doc) |
| A3 | Queue transport + targeted retrieval | DET | G | — | R2 `control/ingest-queue.json`, corpus |
| A4 | Structure: segment + offsets + role tags (JATS DET; PDFs via GROBID-style sidecar) | DET + sidecar + TM | G | cold-start: Claude Haiku 4.5 role-tagger → swap to fine-tuned classifier | R2 `structured/<paperUid>.json` |
| A4b | Citation-block parse: style detect + reference list + claim→reference map | DET + RULES (citation-format library) | G | — | R2 `structured/<paperUid>.refs.json` |
| A5 | Evidence tiering | RULES + LLM assist | G | Claude Haiku 4.5 on methods section | field on structured paper |
| A6 | Mention tagging + co-occurrence/reference index (term map, reverse) | DET | M (same term map) | — | R2 `index/cooccurrence.json` (+ `refGraph`) |
| A7 | Assertion / negation gate | RULES | G | — | flags on structured sentences |
| A8 | Synthesis | LLM | G | Claude Sonnet 5 (`claude-sonnet-5`), `promptVersion`ed | R2 `edges/claims.jsonl` |
| A9 | Quote check | DET | G | — | field on verification |
| A10 | Verification (independent retrieval) | DET retrieval + LLM verdict | G | **decorrelated non-Anthropic frontier model** (GPT-tier or Gemini-tier), adversarial | R2 `edges/verifications.jsonl` |
| A11 | Edge loader (R2 → Postgres) | DET | G | — | S6 tables |
| A12 | Coverage metric | DET | G | — | `coverage_snapshots` |

Where LLMs run: A4 (role-tag cold start), A5, A8, A10 run in **two modes**: (a) **runtime** —
inside the ingest CLI on GitHub Actions runners, metered API calls, budget-guarded per
`tools/brain-ingest/src/types.ts:213-223` and governed by the nao-editable budget in R2
`control/ingest-config.json` (`control.ts:28`); (b) **prepopulation** — the same stages driven
interactively by a **developer-run terminal LLM session** (e.g. Claude Code), consuming **no
metered API budget** (see §8, budget split). S8/S9 phrasing runs **server-side at generation
time** (fire-triggered, cached — the IED presentation-agent discipline,
`docs/biotope/INSIGHTS-ENGINE-DESIGN.md:128-136`). U1 applicability grading runs **server-side at
S7 generation time** (fire-triggered, cached to `applicability_grades`; serve-time reads are
deterministic table reads, so the two-tier-truth invariant holds). Nothing else touches an LLM.
The consolidated per-stage model assignment is §10.

---

## 4 · Serve-path stages

### S1 · Capture (exists — unchanged)

1. **Purpose:** persist raw per-day metric values, governed by the metric registry.
2. **Input:** user entry / device sync (external). **Output shape:** one row per (user, day):
   `daily_gut_rows` unique `(user_id, log_date)`
   (`supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql:49`);
   `wearable_daily` PK `(user_id, date)`
   (`supabase/migrations/20260528100000_create_m3_wearable_daily.sql:16`). Column set == registry
   keys (`shared/metrics/registry.ts:41-42`, `table` field).
3. **Compute:** DET. 4. **Generalization:** M — per-key config IS the registry
   (`MetricDefinition`, `registry.ts:37-69`: `reliability`, `baselineApplicable`, `derivedFrom`,
   `dqs`).
5. **Transport out:** table read by S2. 6. **Store:** the two tables above; **retained
   indefinitely — no trim policy** (they are TRUTH-tier raw rows). If a trim policy is ever
   proposed, S5's 60-day window and the completeness windows set the floor. Idempotency:
   day-level upsert.
7. **Failure:** a missing day is a null in S2; never blocks downstream.

Day-level history is **already retained** here; the historical evaluator break was only that it
read `baseline_snapshots` aggregates. No new capture store is needed — S2 is the missing read
path.

### S2 · Metric joint-series projection — new

1. **Purpose:** one canonical long-format read surface for every metric's day-level series, so any
   pairwise/window computation has a single input shape.
2. **Input:** S1 tables. **Output shape:**
   ```sql
   create view public.metric_daily_values as
     -- registry-generated unpivot: one SELECT branch per active metric key
     select user_id, log_date as day, 'urine_colour'::text as metric_key,
            urine_colour::numeric as value from public.daily_gut_rows
     union all ... -- generated from registry.ts by tools/gen-metric-view.mjs
   ```
   `(user_id, metric_key, day, value numeric|null)`. The view SQL is **generated from the
   registry** (a couplings guard asserts every `baselineApplicable` key appears — same pattern as
   `apps/biotope/test/guards/`, `registry.ts:4-6`).
3. **Compute:** DET (a view; zero copy). 4. **Generalization:** G — one generator for all keys.
5. **Transport:** table read by S3, S5, S7-completeness. 6. **Store:** none — **stays a live
   view** (on-demand freshness), not a nightly materialized table. Materialisation (nightly,
   upsert key `(user_id, metric_key, day)`) is retained only as a future fallback if measured
   query cost demands it.
7. **Failure:** empty for a user → downstream sees zero rows → S3 emits `insufficient`, S5 emits
   nothing, completeness = 0.

### S3 · Baseline v2 (amends existing)

1. **Purpose:** per-(user, metric) statistical normal: mean/std/trend/confidence/days_of_data.
2. **Input:** S2 view. **Output shape:** `baseline_snapshots` amended:
   ```sql
   alter table public.baseline_snapshots
     add column window_days smallint not null default 7;
   -- re-document: days_of_data = days with non-null value WITHIN window_days
   -- re-base confidence on coverage ratio + total history:
   --   insufficient: days_of_data < 3
   --   low:          3 ≤ days_of_data < 5
   --   medium:       days_of_data ≥ 5 and total_history_days < 14
   --   high:         days_of_data ≥ 5 and total_history_days ≥ 14
   alter table public.baseline_snapshots add column total_history_days integer not null default 0;
   ```
   This fixes the contradiction that `days_of_data` is a ≤7 count
   (`supabase/migrations/20260515100000_create_m5a_baseline_snapshots.sql:20`) while
   `confidence='high'` demanded 14+ days (`:32`) — unreachable. `total_history_days` (all non-null
   days ever, from S2) carries the 14+ semantics; `days_of_data` stays the in-window count.
3. **Compute:** DET (nightly edge function `compute-baselines`, existing job amended).
4. **Generalization:** G — iterates `baselineApplicable` registry keys (`registry.ts:53-54`).
5. **Transport:** nightly cron (existing schedule migration `20260515100001`), writes table; S4/S7
   read it. 6. **Store:** `baseline_snapshots`, upsert `(user_id, metric_key)` (`:37`). History is
   **not** retained here — anything needing history reads S2 raw (raw-log aggregation chosen over
   a snapshot-history table; cheaper and can never drift from the raw rows).
7. **Failure:** `days_of_data < 3` → `confidence='insufficient'` → S4 emits `neutral`, S7 skips.

### S4 · 3-state signal + pattern firing

1. **Purpose:** classify each metric today as up / neutral / down vs baseline, with a per-metric
   deadband; emit "fired patterns" (the composer's trigger).
2. **Input:** S3 rows + today's S2 values. **Output shape (ephemeral):**
   ```ts
   interface MetricSignal { userId: string; metricKey: MetricKey; day: string;
     state: 'up'|'neutral'|'down'; zScore: number|null;
     baselineConfidence: 'insufficient'|'low'|'medium'|'high'; }
   interface FiredPattern { userId: string; day: string;
     kind: 'signal'|'trend'|'threshold';       // trend/threshold reuse IED leaf conditions
     metricKey: MetricKey; state: 'up'|'down'; // never neutral
     stats: { zScore: number|null; trend: string|null; windowDays: number }; }
   ```
3. **Compute:** DET + RULES. `state = |value − mean| ≤ deadband·std ? neutral : sign`.
4. **Generalization:** M — per-key deadband lives in a registry extension field
   `signal: { deadbandSigma: number }` (default 0.5) added to `MetricDefinition`
   (`registry.ts:37-69`; TRUTH-tier, part of the contract-extension PR bundle or a sibling
   registry PR).
5. **Transport:** pure function called in-process by S7's generation job. 6. **Store:** none —
   recomputable from S2+S3 (two-tier truth: don't persist a projection of a projection).
7. **Failure:** `insufficient` baseline → forced `neutral` → no pattern fires → no card; the
   *absence* is recorded by A1 as `blocked-completeness`.

The IED `correlation` leaf (a conjunction of two per-metric tests,
`docs/biotope/INSIGHTS-ENGINE-DESIGN.md:54`) is **renamed `coincidence`** in the blueprint
contract; genuine cross-metric relations are exclusively D1/D2 territory.

### S5 · D2 personal relations — the n=1 evaluator

1. **Purpose:** detect stable pairwise association in the user's own retained joint series;
   statistical guardrails against flukes.
2. **Input:** S2 view — the two aligned day-series of a pair. Pair set = active-metric pairs where
   both metrics are `baselineApplicable` and each has ≥ `minEffN` days. **Output shape:**
   ```sql
   create table public.personal_signals (
     user_id uuid not null references auth.users(id) on delete cascade,
     metric_a text not null, metric_b text not null,   -- lexicographic order, a < b
     window_days smallint not null default 60,
     n_days smallint not null,          -- joint non-null days in window
     n_eff numeric(6,2) not null,       -- Pyper–Peterman autocorrelation-adjusted N
     rho numeric(5,4) not null,         -- Spearman rank correlation
     ci_low numeric(5,4), ci_high numeric(5,4),
     q_value numeric(6,5) not null,     -- Benjamini–Hochberg FDR-adjusted p, per user per run
     stable boolean not null,           -- sign(rho) unchanged across last 3 runs & |rho| ≥ 0.3
     computed_at timestamptz not null default now(),
     runs_observed smallint not null default 1,
     primary key (user_id, metric_a, metric_b)
   );
   ```
   Evaluator I/O: `evaluatePair(seriesA: (number|null)[], seriesB: (number|null)[]) →
   {rho, nDays, nEff, ci, p}` — pure, unit-testable;
   `signal := q_value ≤ 0.05 ∧ n_eff ≥ 10 ∧ stable`.
3. **Compute:** DET (rank correlation + N_eff + BH — all TS-native). 4. **Generalization:** G.
5. **Transport:** weekly cron (Supabase scheduled function, same mechanism as
   `20260515100001_schedule_m5a_compute_baselines.sql`), upserting the table; read by S7 and A1.
6. **Store:** above; upsert key `(user_id, metric_a, metric_b)`; `runs_observed`/`stable` make
   re-evaluation cheap. Retention: overwrite-in-place is fine (recomputable from S2).
7. **Failure:** joint days < 10 → no row (distinguished from "flat": a row with `stable=false`,
   high q). A1 maps "no row + low completeness" → `blocked-completeness`, "row, flat, high
   completeness" → `personal-null`.

### S6 · D1 edge read store + gating

1. **Purpose:** the deterministic serving surface for population edges.
2. **Input:** A11 loader (below). **Output shape (DDL):**
   ```sql
   create table public.relationship_claims (
     edge_id text primary key,            -- relationKey(subject, relation, object), shared/brain/index.ts:20-22
     subject text not null, object text not null, relation text not null,
     claim jsonb not null,                -- full RelationshipClaim, schema-validated on load
     prompt_version text not null, synthesised_at timestamptz not null
   );
   create table public.edge_verifications (
     edge_id text not null references public.relationship_claims(edge_id),
     verified_at timestamptz not null,
     verification jsonb not null,         -- full EdgeVerification
     verdict text not null, status text not null,
     edge_score numeric(4,3) not null,    -- edgeScore(), precomputed at load (index.ts:40-48)
     serving_band text not null,          -- servingBand()  (index.ts:51-57)
     primary key (edge_id, verified_at)   -- append-only: "edge version" = (edge_id, verified_at)
   );
   create view public.verified_edges as   -- newest ACTIVE verification per edge
     select distinct on (c.edge_id) c.*, v.verified_at, v.verification, v.verdict,
            v.edge_score, v.serving_band
     from relationship_claims c join edge_verifications v using (edge_id)
     where v.status = 'active' order by c.edge_id, v.verified_at desc;
   ```
   Servability logic stays in `shared/brain/index.ts:25-69` — the loader precomputes
   `edge_score`/`serving_band` with those exact functions so reads never re-derive gating. **No
   Neo4j**: 1-hop lookup = `where subject = $k or object = $k` with two btree indexes; the IED
   line naming a Neo4j projection (`docs/biotope/INSIGHTS-ENGINE-DESIGN.md:22`) is amended.
3. **Compute:** DET. 4. **Generalization:** G. 5. **Transport:** table read by S7, A1; RLS:
   readable by authenticated users (population data, no user rows). 6. **Store:** above; claims
   upsert on `edge_id` (re-synthesis replaces, per `relationships.ts:99-101`); verifications
   append-only, prior rows flipped `status='superseded'` by the loader. 7. **Failure:** zero rows
   → S7 finds no edges → every fired pattern becomes a gap event, no cards — degraded but correct
   (prepopulation-by-pipeline prevents day-one emptiness).

### S7 · Composed-insight composer + completeness scorer

1. **Purpose:** join (fired pattern) × (1-hop servable D1 edges) × (D2 check) → branch-classified
   structured insight with attached stats and provenance refs; compute the deterministic
   completeness score.
2. **Input:** S4 `FiredPattern[]` (in-process), S6 `verified_edges` (table read), S5
   `personal_signals` (table read), S2 (completeness), U1 `applicability_grades` (table read —
   precomputed transferability grades per citation; missing grade → `'unknown'`).
   **Output shape:**
   ```ts
   interface ComposedInsight {
     insightId: string;                 // hash(userId, patternKey, edgeId|'none', periodStart)
     userId: string; period: { start: string; end: string };
     pattern: FiredPattern;
     edges: Array<{ edgeId: string; verifiedAt: string;      // edge version
                    servingBand: 'high'|'mid'; edgeScore: number;
                    direction: 'consistent'|'inconsistent';  // sign(edge.relation) vs pattern.state
                    citations: Citation[];                   // relationships.ts:76-85
                    applicability: Array<{ paperId: string; score: number | 'unknown';
                                           rationale: string | null }> }>;  // U1 grade + grader rationale
     personal: { rho: number; nEff: number; qValue: number; stable: boolean } | null;
     branch: 'agree' | 'research-context' | 'idiosyncratic' | 'contradiction';
     completeness: { score: number; daysPresent: number; windowDays: number;
                     perMetric: Record<MetricKey, number> };  // deterministic
   }
   ```
   **Branch rules (RULES, exhaustive):** servable consistent edge ∧ (personal null-or-consistent)
   → `agree`; servable edge ∧ no/unstable personal → `research-context`; stable personal ∧ no edge
   → `idiosyncratic`; servable edge ∧ stable personal with opposite sign → `contradiction`.
   `agree` proceeds to S8 as a **cited card** (triangulation is a *rank modulator*:
   agree-with-personal ranks above agree-without). `idiosyncratic` does BOTH: (a) proceeds to S8
   as a distinct, clearly-labelled **"still researching this" card** — uncited, visually separate,
   explicitly an unverified personal observation; AND (b) still writes its A1 gap event
   (`personal-signal-no-edge`) so the loop goes looking for papers. `research-context` and
   `contradiction` are **not surfaced** — gap events only (`research-context` →
   completeness-gated, `contradiction` → `needs-review` + `needsReview()` flag,
   `shared/brain/index.ts:75-81`).
   Only monotonic relations (`increases|decreases`) may set `direction`; `modulates|correlates`
   edges attach as context-only citations, never a directional claim.
   **Completeness:** `score = Σ_m w_m · daysPresent(m, window)/windowDays` over the pattern's
   contributing metrics, weights `w_m = dqs.weight`-normalised (`registry.ts:62-63`), computed
   **from S2 raw**, reproducible. Weights are provisional pending calibration (§11).
3. **Compute:** DET + RULES. 4. **Generalization:** G. 5. **Transport:** runs inside the nightly
   `generate-insights` edge function (existing job, refactored per IED §C,
   `docs/biotope/INSIGHTS-ENGINE-DESIGN.md:102-113`); writes `composed_insights`; emits gap events
   to A1 in the same transaction.
6. **Store:**
   ```sql
   create table public.composed_insights (
     insight_id text primary key, user_id uuid not null,
     period_start date not null, period_end date not null,
     branch text not null check (branch in ('agree','research-context','idiosyncratic','contradiction')),
     payload jsonb not null,            -- full ComposedInsight
     created_at timestamptz not null default now()
   );
   ```
   Append-only (insightId hash makes reruns idempotent). Retention: 12 months.
7. **Failure:** no fired patterns → no rows (report says "quiet period" via S9 fallback); no edges
   → no cited cards, but stable personal signals still surface as "still researching" cards;
   everything else is gap fuel.

### S8 · Card producer + phrasing (two card variants)

1. **Purpose:** render (a) an `agree` insight as a human-readable, copy-gated, grounded **cited
   card** joined to its edges; (b) an `idiosyncratic` insight as a distinct **"still researching
   this" card** — visually separate from cited cards, carries NO citation, states plainly it is an
   unverified personal observation the system is researching.
2. **Input:** S7 `agree` rows + S7 `idiosyncratic` rows. **Output shape / store amendment (the
   card-table migration):**
   ```sql
   alter table public.insight_cards
     add column producer text not null default 'rules'
       check (producer in ('rules','edge','personal')),   -- 'personal' = still-researching variant
     add column insight_id text references public.composed_insights(insight_id),
     add column edge_refs jsonb not null default '[]';  -- [{edgeId, verifiedAt}] — the card↔edge join
   alter table public.insight_cards drop constraint insight_cards_category_check;
   alter table public.insight_cards add constraint insight_cards_category_check
     check (category in ('hydration','gut','vector','behaviour','descriptive','relationship'));
   ```
   Rationale: **one table, three producers, disjoint key spaces.** The rules engine (IED §C) keeps
   `rule_id` = blueprint id; the edge pipeline writes `rule_id := 'edge:' || edge_id`; the
   still-researching variant writes `rule_id := 'personal:' || metricA || '|' || metricB` with
   `producer='personal'` and `edge_refs='[]'` ALWAYS (a CHECK enforces `producer='personal' →
   edge_refs='[]'` — this card variant can never acquire a citation without going back through the
   edge pipeline). All namespaced, collision-free with blueprint ids, preserving the
   `(user_id, rule_id)` upsert at
   `supabase/migrations/20260515110000_create_m5b_insight_cards.sql:34`. `edge_refs` (not a scalar
   FK) because one card may rest on several 1-hop edges. `category='relationship'` unblocks the
   CHECK rejection (`...110000...sql:23`). `confidence_sources` (`:28`) gains `'brain'`.
   Upsert ownership: each producer upserts only rows in its own `rule_id` namespace; novelty
   history is NOT this table's job (see `surfaced_cards`, S9) — the in-place refresh is by design.
3. **Compute:** DET assembly + **LLM phrasing** (Claude Haiku 4.5 presentation agent — grounded:
   prompt contains only the ComposedInsight payload; introduces no number/relation not in input;
   output through `validateCopyString`; cached per `(insight_id)`; fire-triggered not per-render —
   the IED §E discipline, `INSIGHTS-ENGINE-DESIGN.md:128-136`). Claim register: causal wording
   only inside quoted-citation framing; personal causal claims blocked by the copy gate (opaque
   here). The still-researching variant's phrasing prompt additionally REQUIRES the
   unverified-personal-observation framing and forbids any citation-like wording; its rendered
   template is visually distinct (separate lane/style token) from cited cards.
4. **Generalization:** G. 5. **Transport:** same nightly job as S7, function call; app reads via
   the existing service
   (`apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart:93-104`, which needs
   only the three new columns added to `fromJson`).
6. **Store:** `insight_cards` amended; upsert `(user_id, rule_id)`. 7. **Failure:** LLM down/over
   budget → deterministic template fallback (`"{metricA label} and {metricB label} moved together
   …"` from blueprint-style templates), card still ships; copy-gate failure → card dropped +
   logged (defense-in-depth, IED §C `render.ts` pattern).

### S9 · Report composer + surfaced history

1. **Purpose:** dated selection/clustering of cards + charts + completeness disclaimer; the
   novelty memory.
2. **Input:** S8 cards (table read), `surfaced_cards` history (below), S2 series for charts.
   **Output shape:**
   ```sql
   create table public.insight_reports (
     report_id uuid primary key default gen_random_uuid(),
     user_id uuid not null, period_start date not null, period_end date not null,
     narrative text,                       -- LLM paragraph, copy-gated; null on fallback
     chart_specs jsonb not null default '[]',  -- deterministic: [{metricKey, windowDays, kind:'trend'}]
     completeness_disclaimer jsonb not null,   -- roll-up of member cards' completeness
     created_at timestamptz not null default now(),
     unique (user_id, period_start)
   );
   create table public.surfaced_cards (      -- APPEND-ONLY: the novelty memory
     id bigint generated always as identity primary key,
     report_id uuid not null references public.insight_reports(report_id),
     user_id uuid not null, card_id bigint not null,
     insight_id text, edge_id text, verified_at timestamptz,  -- edge version = (edge_id, verified_at)
     surfaced_at timestamptz not null default now()
   );
   create index on public.surfaced_cards (user_id, edge_id, surfaced_at desc);
   ```
   **Selection (DET):** rank = `edgeScore × agree-with-personal boost × novelty`; novelty: pair
   surfaced within 3 reports with unchanged `(edge_id, verified_at)` → demote; edge new/re-verified
   since last report, or pair newly past a completeness threshold → boost. **Clustering:** cards
   sharing an edge endpoint (1-hop only); still-researching cards render in their own labelled
   lane, never interleaved with cited cards. **Narrative:** LLM (Claude Sonnet 5) constrained to
   selected cards' payloads; fallback = ordered card list, no paragraph.
   **Charts:** deterministic specs rendered client-side from S2 — no LLM numbers.
3. **Compute:** DET + LLM (narrative only). 4. **Generalization:** G. 5. **Transport:** trigger =
   on-open with a 7-day freshness check (generate if stale) — avoids cron fan-out; table read by
   the app. 6. **Store:** above; reports idempotent on `(user_id, period_start)`; `surfaced_cards`
   append-only forever (small). 7. **Failure:** zero cards → report with charts + "still
   researching N pairs" line fed by A12 coverage — silence-as-fuel made visible honestly.

### U1 · Applicability = LLM-graded transferability

Applicability is an **LLM-graded transferability score in [0,1]**: how well a paper's claimed
relation (between opaque entities X, Y) transfers to the served insight's relation (between the
user's entities X′, Y′), when the two relations are related-but-not-identical. Population match is
at most one input to that judgment, not the judgment. (A pure RULES token/range matcher of user
attributes against `population` strings was considered and rejected as the wrong definition.)

1. **Purpose:** the per-(paper claim, served relation) "how well does this evidence transfer" axis
   — the applicability plot's axis and its drill-down rationale.
2. **Input:** (a) the paper's claim tuple (subject, relation kind, object, quote spans,
   `Citation.population` — contract-extension field, §7); (b) the served insight's relation (the
   S7 pattern pair + edge relation); (c) optional user context from `user_attributes` (auxiliary
   input, table below). **Output shape:**
   ```sql
   create table public.user_attributes (           -- optional grader context only
     user_id uuid primary key references auth.users(id) on delete cascade,
     attrs jsonb not null default '{}',   -- {age_band?: string, sex?: string, ...} — opaque keys,
     updated_at timestamptz not null      -- vocabulary authored in shared/metrics/attributes.ts
   );
   create table public.applicability_grades (      -- the stored grade + rationale
     edge_id text not null, paper_id text not null,
     prompt_version text not null,
     score numeric(4,3),                  -- [0,1]; null == 'unknown'
     rationale text not null,             -- grader's short rationale — shown in plot drill-down
     grader_model text not null,          -- 'claude-sonnet-5'
     second_grade jsonb,                  -- {model, score} — optional decorrelated agreement check
     graded_at timestamptz not null default now(),
     primary key (edge_id, paper_id, prompt_version)
   );
   ```
   **Grading call (LLM, rubric-anchored):**
   ```ts
   function gradeApplicability(claim: PaperClaimTuple, served: ServedRelation,
                               userCtx?: Record<string, string>):
     { score: number | 'unknown'; rationale: string }
   // rubric-anchored prompt (anchor descriptions for 0 / 0.25 / 0.5 / 0.75 / 1);
   // 'unknown' when the transfer is too weak or the claim tuple is unparseable;
   // rationale is mandatory, copy-gated, stored, and rendered in the plot drill-down.
   ```
3. **Compute:** **LLM** — Claude Sonnet 5 (`claude-sonnet-5`) for the grade; **optionally a
   decorrelated non-Anthropic second grader** whose agreement/disagreement is stored in
   `second_grade` (disagreement > 0.3 → render as `unknown`, flag for review). Runs
   **fire-triggered at S7 generation time** for new `(edge_id, paper_id, prompt_version)` triples
   and is cached — serve-time reads are deterministic table reads, so the two-tier-truth invariant
   (serving path deterministic) is preserved; U1 joins S8/S9 in the "where LLMs run" list (§3,
   §10).
4. **Generalization:** G (one rubric prompt for all pairs). 5. **Transport:** grading inside the
   nightly S7 job; S7 reads the table. 6. **Store:** `applicability_grades` upsert on PK;
   `user_attributes` upsert `user_id`. 7. **Failure:** LLM down/over budget → `'unknown'`
   (honest), regraded next run; empty grades at cold start → plot renders all-`unknown`.

The applicability plot ships at cold start showing `'unknown'` honestly — no gating; the plot
axis is this transferability grade and its drill-down is the stored rationale. The grade's
calibration limits are listed in §11.

---

## 5 · Authoring + loop stages (the paper side)

### A1 · Gap ledger + status classifier

1. **Purpose:** per-pair record of *why* each candidate pair isn't served; the loop's demand
   signal.
2. **Input:** three producers: (a) registry `derivedFrom[]` (`registry.ts:57-58`), (b) A6
   co-occurrence index, (c) S5 `personal_signals`; plus S6 `verified_edges`, S7 gap events, S7
   completeness. **Output shape:**
   ```sql
   create table public.gap_ledger (
     metric_a text not null, metric_b text not null,       -- lexicographic
     scope text not null default 'aggregate',              -- 'aggregate' | user_id::text (personal rows)
     status text not null check (status in
       ('served','edge-below-band','personal-signal-no-edge','lit-candidate-no-edge',
        'personal-null','blocked-completeness','needs-review','retrieval-exhausted')),
     personal_signal jsonb,        -- {rho, nEff, qValue, stable} snapshot (personal rows only)
     lit_candidate jsonb,          -- {cooccurStrength, hasEdge, servingBand}
     completeness numeric(4,3),
     demand integer not null default 0,        -- aggregate fire-count, NO user ids (privacy)
     last_ingest_attempt jsonb,                -- {runId, at, outcome: 'edges'|'no-papers'|'no-claims'|'failed'}
     corpus_version text,                      -- watermark for cheap re-eval
     last_status_change timestamptz not null default now(),
     primary key (metric_a, metric_b, scope)
   );
   ```
   The dangerous-middle resolution keys off S7 completeness (low → `blocked-completeness`; high +
   servable-lit-mismatch → applicability note, not a target). `retrieval-exhausted` is set by
   A10's zero-result write-back, retried only when `corpus_version` advances (bounded spend).
3. **Compute:** RULES. 4. **Generalization:** G. 5. **Transport:** classifier runs in the weekly
   S5 cron (after personal signals refresh) + on A11 loader completion (edge-side changes); read
   by the queue builder (A3). 6. **Store:** above; upsert on PK; `demand` incremented
   aggregate-only.
7. **Failure:** empty ledger → queue empty → loop idles; classifier is total (every candidate pair
   gets exactly one status).

### A2 · Metric↔literature term map + pair→query generation

1. **Purpose:** the two-directional bridge between metric keys and literature vocabulary.
2. **Input:** authored data. **Shape (new TRUTH contract, `shared/metrics/terms.ts` — sibling of
   the registry, same 2-reviewer gate, `registry.ts:8-9`):**
   ```ts
   export interface MetricTermEntry {
     key: MetricKey;                       // must be an active registry key (guard)
     terms: readonly string[];             // exact phrases papers use (lowercased)
     meshLike: readonly string[];          // controlled-vocabulary ids where known
     excludeTerms: readonly string[];      // disambiguators
   }
   export const METRIC_TERMS: readonly MetricTermEntry[];
   // forward: pairToQueries(a, b, adapter) → string[]  — cross-product of top terms,
   //   adapter-specific syntax ("(termA1 OR termA2) AND (termB1 OR termB2)");
   // reverse: used by A6's matcher.
   ```
3. **Compute:** DET (the transforms); the map itself is authored (M — per-key config lives in this
   file). Coverage guard: every `baselineApplicable` active metric has ≥1 term.
4. **Generalization:** M (authored per key) with G transforms. 5. **Transport:** imported by the
   ingest CLI (A3/A6) and by the queue builder. 6. **Store:** git (TRUTH). 7. **Failure:** metric
   with no entry → its pairs are unqueueable → ledger rows stay `lit-candidate-no-edge` with
   `last_ingest_attempt.outcome='no-terms'` — visible, not silent. Known bounded limitation:
   entity-linking precision/recall floor — contained by authored maps + exclude terms (§11).

### A3 · Queue transport + targeted retrieval

1. **Purpose:** deliver the research to-do list to the offline CLI, run targeted discovery, write
   outcomes back — the wire that closes the circle.
2. **Input:** A1 spend-ranked rows (rank
   `f(personalSignal, litCandidate, demand, servability-gain)`). **Transport design, reusing
   shipped infrastructure:**
   - **Queue document:** nao (the Cloudflare Worker that already owns the control plane) reads
     `gap_ledger` (Supabase binding), builds `control/ingest-queue.json` in the **same R2 bucket**
     as the corpus — the surface both sides already share
     (`tools/brain-ingest/src/control.ts:2-8,28`):
     ```ts
     interface IngestQueueDoc { queueId: string; createdAt: string;
       items: Array<{ pair: [MetricKey, MetricKey]; priority: number;
                      queries: string[];            // from A2 pairToQueries, per adapter
                      reason: 'personal-signal-no-edge'|'lit-candidate-no-edge'|'edge-below-band';
                      maxPapers: number }>; }       // per-item spend cap
     ```
   - **Trigger:** nao fires `workflow_dispatch` on `.github/workflows/brain-ingest.yml` with input
     `queue=<queueId>` — exactly the shipped mechanism
     (`apps/nao/src/lib/githubDispatch.ts:41-79`). Cadence: weekly cron in nao + manual UI button.
     Pause/budget honored via the existing control doc (`types.ts:315-321`).
   - **CLI side:** new `--queue <queueId>` mode alongside `--seed` (`seeds.ts:55-64` static topics
     remain for corpus-wide discovery); loads the queue doc from R2, runs discovery per item's
     `queries` through the existing adapters + budget guard (`types.ts:213-223`), then snowball
     expansion from any hit.
   - **Write-back:** CLI writes `runs/<runId>/outcome.json`
     (`{queueId, perItem: [{pair, outcome, papersFetched, edgeIds}]}`) + edge artifacts (A8/A10)
     to R2. A **nao cron** polls `runs/` (or the workflow calls a nao HTTP callback on
     completion), updates `gap_ledger.last_ingest_attempt`, and invokes A11. Idempotency: `runId`
     recorded on the ledger row; re-delivered outcomes are no-ops.
3. **Compute:** DET. 4. **Generalization:** G. 5. **Transport:** as above (table read → R2 doc →
   workflow dispatch → R2 artifacts → cron write-back). 6. **Store:** R2 queue/outcome docs
   (retained 90 days); corpus `papers.jsonl` manifest as today (`types.ts:89-123`).
7. **Failure:** dispatch failure → nao surfaces error (existing `DispatchIngestResult`,
   `githubDispatch.ts:25-28`); run crash → no outcome doc → ledger attempt stays stamped
   `dispatched`, retried next cadence; zero papers found → `outcome:'no-papers'` →
   `retrieval-exhausted`.

### A4 · Structure: segmentation + offsets + role tagging (`extract.ts` v2)

1. **Purpose:** turn a fetched paper into span-anchored structured text — sections, sentences,
   char offsets, per-sentence role.
2. **Input:** fetched bytes/XML from A3 (via existing retrieval adapters, `types.ts:279-282`).
   **Output shape (R2 `structured/<paperUid>.json`):**
   ```ts
   interface StructuredPaper {
     paperUid: string;                       // == PaperRecord.paperUid == Citation.paperId (types.ts:92-94)
     canonicalText: string;                  // whitespace-normalised ONCE; all offsets index into this
     sections: Array<{ kind: 'title'|'abstract'|'intro'|'methods'|'results'|
                             'discussion'|'conclusion'|'other';
                       heading: string|null; charStart: number; charEnd: number }>;
     sentences: Array<{ idx: number; charStart: number; charEnd: number;
                        sectionIdx: number;
                        role: 'finding'|'method'|'background'|'hedge'|'other';
                        assertion: 'asserted'|'negated'|'hedged';   // filled by A7
                        mentions: MetricKey[] }>;                    // filled by A6
     evidenceTier: 1|2|3|4|5;                                        // filled by A5
     structureVersion: string;
   }
   ```
   Replaces the flattening path: `collapseWhitespace` (`tools/brain-ingest/src/extract.ts:33-35`)
   is applied once to build `canonicalText` and never again, so offsets stay stable;
   `mergePages:true` PDF flattening (`extract.ts:51`) and the JATS body walk (`:155-165`) both
   emit into this shape. JATS section kinds come free from `<sec>` tags (the current walker
   discards them, `:77-88`).
   **PDF-only papers (the one-language-rule waiver):** instead of heading-heuristic RULES, PDFs
   run through a **real structure/reference parser** (a GROBID-style service), deployed as a
   CLI-orchestrated sidecar; its TEI-like output is mapped into the same `StructuredPaper` shape
   (sections, sentences, offsets into `canonicalText`), and its reference/citation output feeds
   A4b. JATS stays the preferred path when available.
3. **Compute:** DET (JATS segmentation, sentence split) + sidecar service (PDF structure) +
   **TM (deferred)** for role tagging — cold-start substitute: Claude Haiku 4.5
   (`claude-haiku-4-5`) classifying sentences in batch (cheap, offline, budget-guarded); swap
   plan: distil the LLM's labels into a small TS-runnable classifier (logistic over n-grams or
   ONNX minilm) once ≥5k labelled sentences accumulate; `structureVersion` bump triggers
   re-structure.
4. **Generalization:** G. 5. **Transport:** in-process within the CLI run (sidecar over local
   HTTP); artifact to R2.
6. **Store:** R2 `structured/`; idempotent on `(paperUid, structureVersion)`. 7. **Failure:**
   extraction failure → `PaperRecord.status='failed'` (`types.ts:86`), paper skipped, outcome
   records it; sidecar down → PDF papers deferred to next run (JATS papers unaffected).

### A4b · Citation-block parse: claim→reference mapping — new

1. **Purpose:** turn each paper's citation apparatus into data: detect the citation/reference
   style, parse the reference list, and map every in-text citation marker to the **text block
   (claim/sentence) that cites it**. This per-claim→reference mapping is what enables (a)
   **per-claim source tracking** — which paper backs which sentence — and (b) **reliability
   assessment via references-as-graph**: corroboration counted by *independent citation root*
   rather than by raw paper count (papers that all cite the same root are one voice, not many).
2. **Input:** A4 `StructuredPaper` (`canonicalText`, `sentences`) + the raw reference apparatus —
   JATS `<ref-list>`/`<xref>` for XML papers, the GROBID-style parser's reference output for PDFs.
   **Output shape (R2 `structured/<paperUid>.refs.json`):**
   ```ts
   interface CitationBlockIndex {
     paperUid: string;
     style: 'numeric'|'author-year'|'mixed'|'unknown';       // (i) detected citation format
     references: Array<{ refId: string; raw: string;         // (ii) parsed reference list
                         doi: string|null; title: string|null; year: number|null }>;
     claimCites: Array<{ sentenceIdx: number;                // (iii) the citing claim block
                         charStart: number; charEnd: number; //      offsets into canonicalText
                         refIds: string[] }>;                //      claim → references it cites
     refsVersion: string;
   }
   ```
3. **Compute:** DET + RULES — a **citation-format library** does (i) style detection and (ii)
   reference-list parsing; (iii) marker→sentence mapping is a DET walk over `canonicalText`
   offsets (JATS `<xref>` gives it free; numeric/author-year markers are
   regex-per-detected-style). No LLM. 4. **Generalization:** G. 5. **Transport:** in-process,
   immediately after A4; artifact to R2. **Consumers:** A6 (the co-occurrence index gains a
   `refGraph` leg keyed on resolved DOIs/refIds) and A10 (corroboration clustering counts support
   by independent citation root — complements the echo control); A8 receives `claimCites` so
   synthesis context carries which reference backs which sentence. 6. **Store:** R2, idempotent on
   `(paperUid, structureVersion, refsVersion)`. 7. **Failure:** style undetectable →
   `style:'unknown'`, `claimCites=[]` — the paper still flows (mentions, tiering, synthesis) but
   contributes nothing to the reference graph; logged for parser triage.

### A5 · Evidence tiering

1. **Purpose:** assign `EvidenceTier` 1–5 (`relationships.ts:58-64`) per paper.
2. **Input:** A4 structured paper (+ `PaperRecord.workType`, `types.ts:112-113`). **Output:**
   `evidenceTier` on the structured artifact.
3. **Compute:** RULES first (workType `review`→5-candidate, registry of design keywords in
   methods/abstract: "randomized"→4, "cohort"→3, "cross-sectional"→2, "in vitro"→1) + LLM assist
   (haiku) only when rules are inconclusive. 4. **Generalization:** G. 5. **Transport:**
   in-process. 6. **Store:** field on `structured/`. 7. **Failure:** unknown → tier 2
   (conservative floor) + flag for review.

### A6 · Mention tagging + co-occurrence index (term map, reverse)

1. **Purpose:** tag sentences with metric keys; maintain the pair co-occurrence index that feeds
   candidate enumeration (A1 input b).
2. **Input:** A4 sentences + A2 `METRIC_TERMS` + A4b `CitationBlockIndex` (references).
   **Output:** `mentions` filled on sentences; R2 `index/cooccurrence.json`:
   `{version, pairs: Record<'a|b', {papers: number, findingSentences: number}>,
   refGraph: Record<paperUid, string[]>}` — pairs counted only over `role='finding'` sentences
   (high-precision leg); `refGraph` = each paper's resolved outgoing references (DOI-or-refId),
   from A4b — the reference graph A10's corroboration clustering walks to find independent roots.
3. **Compute:** DET (multi-pattern string match, exclude-term veto). 4. **Generalization:** M via
   the shared term map (no second authoring surface). 5. **Transport:** in-process; index
   re-emitted each run (rebuildable from `structured/`); `version` = corpus watermark consumed by
   `gap_ledger.corpus_version`. 6. **Store:** R2. 7. **Failure:** no mentions → paper contributes
   nothing; never blocks.

### A7 · Assertion / negation gate

1. **Purpose:** mark each finding sentence asserted / negated / hedged so synthesis can't misread
   a null result as a positive one — and so studied nulls become `no_effect` edges
   (`relationships.ts:45`).
2. **Input:** A4/A6 finding sentences. **Output:** `assertion` field. 3. **Compute:** RULES —
   TS-native cue lexicon (negation: "no significant", "did not", "failed to"; hedges: "may",
   "suggests") with window scoping. 4. **Generalization:** G. 5. **Transport:** in-process.
   6. **Store:** field on `structured/`. 7. **Failure:** unmatched → `hedged` (conservative:
   hedged sentences are context, never claim evidence).

### A8 · Synthesis (LLM)

1. **Purpose:** propose `RelationshipClaim`s for a target pair from claim-bearing sentences.
2. **Input:** for a queue item's pair: all `asserted`+`finding` sentences mentioning both keys
   (from A6), + section context, + tier (A5). **Output:** `RelationshipClaim`
   (`relationships.ts:102-125`) **+ the contract-extension additions (§7):**
   ```ts
   // shared/brain/relationships.ts — ONE bundled 2-reviewer PR:
   interface Citation { /* existing :76-85 */ population: string | null; }   // per-paper scope
   interface QuoteSpan { /* existing :87-95 */ charStart: number | null; charEnd: number | null; }
     // offsets into StructuredPaper.canonicalText — upgrades locator (:94) from free-text-only
   interface RelationshipClaim { /* existing */ derivation: string; }
     // plain-language "how these sentences produce this claim", captured AT synthesis time
     // (never regenerated on view), copy-gated before storage
   ```
   `edgeId = relationKey(...)` (`index.ts:20-22`); `no_effect` claims emitted from negated
   findings.
3. **Compute:** LLM — Claude Sonnet 5 (`claude-sonnet-5`; generative, highest-stakes),
   `promptVersion`ed (`relationships.ts:123-124`), budget-guarded (runtime) or terminal-driven
   (prepopulation, §8), JSON-schema-validated output; invalid → retry once → drop.
4. **Generalization:** G (one prompt for all pairs; pair specificity comes from input selection).
5. **Transport:** in-process; appends R2 `edges/claims.jsonl`. 6. **Store:** R2 JSONL — the
   rebuildable-projection artifact (`relationships.ts:9-12`); idempotent per
   `(edgeId, promptVersion)`. 7. **Failure:** zero claim-bearing sentences → outcome
   `'no-claims'` → ledger `retrieval-exhausted` (papers existed; nothing extractable).

### A9 · Quote check (deterministic pre-verifier)

1. **Purpose:** literal-presence check of every `quoteSpan` before any verifier tokens are spent —
   the verifiability invariant behind the exact-quotes UI.
2. **Input:** A8 claims + A4 `canonicalText` per cited paper. **Output:**
   `EdgeVerification.quoteCheck` (`relationships.ts:139-143`): substring match at
   `charStart..charEnd` when present, whole-text search fallback. 3. **Compute:** DET.
   4. **Generalization:** G. 5. **Transport:** in-process, gates A10. 6. **Store:** merged into
   the verification record. 7. **Failure:** `allPresent=false` → claim rejected without LLM spend;
   logged for prompt triage.

### A10 · Verification with independent retrieval

1. **Purpose:** adversarial second pass; emit `EdgeVerification` satisfying the
   `independentRetrieval` invariant (`relationships.ts:144-148`) so edges can ever leave
   `uncertain`.
2. **Input:** one A8 claim (verdict target) — **not** the synthesis context. **The retrieval
   mechanism:** independence = *the verifier performs its own search*, not that results must
   differ. Two rungs, both CLI-side:
   - **Corpus-first (always available, free):** query the A6 co-occurrence index for the claim's
     pair → structured papers mentioning both keys → their `finding` sentences. Papers also cited
     by the claim are allowed in retrieval but excluded from `corroboration.supporting` counts
     (echo control). **Corroboration is additionally clustered by independent citation root**
     using the A6 `refGraph` (from A4b): supporting papers that share a citation root collapse to
     one effective source, so `corroboration.supporting` counts independent evidence lineages, not
     copies.
   - **Live top-up (budget-permitting):** A2 `pairToQueries` against discovery adapters for fresh
     sources beyond the corpus.
   The verifier LLM is a **decorrelated non-Anthropic frontier model (e.g. a GPT-tier or
   Gemini-tier model)** running an adversarial "refute-first" prompt; it sees only the retrieved
   sentences + the claim, and fills every check block (`relationships.ts:150-163`).
   **Decorrelation requirement (core design principle):** the verifier MUST be from a DIFFERENT
   vendor family than the synthesizer (A8 = Claude Sonnet 5). A same-family "does this look
   right?" re-ask shares the first model's blind spots and is not verification.
   **Zero-result policy:** retrieval performed + nothing found → `verdict='unsupported'` with
   `independentRetrieval.performed=true` (grounded absence — never served, `index.ts:33`), ledger
   → `retrieval-exhausted`, re-verified only when `corpus_version` advances or `promptVersion`
   bumps (`status='stale'`, `relationships.ts:70-73`). Retrieval *not performable* (pause/budget)
   → `uncertain` + automatic re-run next window. This converts the permanent-`uncertain` deadlock
   into a bounded retry.
3. **Compute:** DET retrieval + LLM verdict. 4. **Generalization:** G. 5. **Transport:**
   in-process; appends R2 `edges/verifications.jsonl`. 6. **Store:** R2 JSONL; append-only
   (versions = `(edgeId, verifiedAt)`). 7. **Failure:** LLM invalid output → retry once →
   `uncertain` (safe default, retried).

### A11 · Edge loader (R2 → Postgres projection)

1. **Purpose:** project edge artifacts into the S6 serving tables — the seam between the offline
   authoring world and the cloud serving world.
2. **Input:** R2 `edges/*.jsonl` (A8/A10). **Output:** S6 DDL rows; `edge_score`/`serving_band`
   precomputed via `edgeScore`/`servingBand` (`index.ts:40-57`); prior verifications of the same
   edge flipped to `superseded`. Schema-validate each line against the Zod mirrors
   (`relationships.schema.ts`, referenced at `relationships.ts:27`); invalid lines quarantined,
   run continues.
3. **Compute:** DET. 4. **Generalization:** G. 5. **Transport:** runs in nao (cron, or invoked by
   the A3 write-back callback) using nao's R2 binding + Supabase service key — the CLI never holds
   DB credentials. 6. **Store:** S6 tables; idempotent (claims upsert `edge_id`; verifications
   insert `on conflict do nothing` on `(edge_id, verified_at)`). Full-rebuild supported: truncate
   + reload from R2 (two-tier truth). 7. **Failure:** partial load → loader is per-line
   transactional; re-run completes.

### A12 · Coverage metric

1. **Purpose:** the self-improvement gauge: coverage = served / candidate-derivable, honest under
   a moving denominator.
2. **Input:** A1 ledger (statuses), A6 index version. **Output:**
   ```sql
   create table public.coverage_snapshots (
     computed_at timestamptz not null, scope text not null,       -- 'aggregate' | user
     served int not null, candidates int not null,
     denominator_version text not null,     -- corpus_version + registry version + terms version
     primary key (computed_at, scope)
   );
   ```
   Coverage deltas are reported **only within the same `denominator_version`** (the
   denominator-drift containment). 3. **Compute:** DET. 4. **Generalization:** G.
   5. **Transport:** computed in the A1 classifier run. 6. **Store:** append-only. 7. **Failure:**
   none (pure aggregate).

---

## 6 · Key interface decisions (consolidated)

| Seam | Decision (schema in the stage above) | One-line summary |
|---|---|---|
| Card↔edge join (S8) | `insight_cards` migration: `producer`, `insight_id` FK, `edge_refs jsonb`, category CHECK + `'relationship'`; edge cards use `rule_id = 'edge:'||edge_id` | One table, three producers, namespaced key spaces; composer (S7→S8) owns edge-card upserts; rules engine untouched |
| Evaluator input (S2/S5) | `metric_daily_values` view over already-retained day rows (`...20260513...sql:49`, `...20260528...sql:16`); S5 evaluator I/O: Spearman ρ, Pyper–Peterman N_eff, BH q-value, 60-day window, 3-run stability | No new capture store — a missing read path, not missing data |
| Term map (A2/A6) | `shared/metrics/terms.ts` (TRUTH, guard-coupled to registry): forward `pairToQueries`, reverse A6 matcher | One authored map powers both directions |
| Applicability (U1) | Applicability = **LLM-graded transferability** `[0,1]\|'unknown'` + stored grader rationale (Claude Sonnet 5, graded at S7 generation time, cached in `applicability_grades`); `user_attributes` kept as optional grader context; the plot axis = this grade, drill-down = the rationale | `'unknown'` rendered honestly at cold start — show, no gating |
| Contract extension (§7) | One 2-reviewer PR: `Citation.population`, `RelationshipClaim.derivation`, `QuoteSpan.charStart/charEnd` + Zod mirrors + guards | Bundled; derivation captured at synthesis time only |
| Baseline semantics (S3) | `window_days` + `total_history_days` columns; confidence re-based; completeness computed from S2 raw, never from snapshots | Raw-log aggregation chosen over snapshot history |
| Verifier independence (A10) | Verifier-owned retrieval = corpus-first (co-occurrence index) + live top-up; corroboration clustered by independent citation root (A4b/A6 `refGraph`); zero-result → `unsupported` + `retrieval-exhausted` with corpus-watermark retry; not-performable → `uncertain` + auto re-run | Independence = verifier's own search + decorrelated non-Anthropic verifier model, echo-controlled corroboration counts |
| Novelty memory (S9) | `surfaced_cards` append-only; edge version := `(edge_id, verified_at)` (matches S6 PK) | Novelty memory decoupled from the card upsert |
| Loop transport (A3) | Supabase ledger → nao builds R2 `control/ingest-queue.json` → `workflow_dispatch` (`githubDispatch.ts:41-79`) → CLI `--queue` → R2 `runs/<runId>/outcome.json` + edge JSONL → nao cron write-back + A11 load | Reuses the shipped R2 control plane (`control.ts:28`) and dispatch path; CLI stays DB-credential-free |

---

## 7 · The contract-extension PR

One bundled 2-reviewer PR to `shared/brain/relationships.ts` (+ Zod mirrors in
`relationships.schema.ts` + guards):

- `Citation.population: string | null` — per-paper claimed scope (U1 grader input).
- `QuoteSpan.charStart/charEnd: number | null` — offsets into `StructuredPaper.canonicalText`;
  upgrades `locator` (`relationships.ts:94`) from free-text-only and makes A9's check exact.
- `RelationshipClaim.derivation: string` — plain-language "how these sentences produce this
  claim", captured AT synthesis time (never regenerated on view), copy-gated before storage.

A sibling registry PR (or the same bundle) adds `signal: { deadbandSigma: number }` to
`MetricDefinition` (S4).

---

## 8 · Control flow

### (a) Serve path — capture → report (all deterministic except two phrasing calls)

```
user/device ─► S1 tables ─(view)─► S2 metric_daily_values
  nightly cron: S3 baselines ─► S4 signals+patterns ─┐
  weekly  cron: S5 personal_signals ─────────────────┤
  table read:   S6 verified_edges ◄─(A11 loader)     │
  table read:   U1 applicability_grades (pre-graded, cached)
                                                     ▼
                     S7 composer: join + branch + completeness
                        ├─ agree ─► S8 cited card (haiku phrase → copy gate) ─► insight_cards
                        ├─ idiosyncratic ─► S8 "still researching" card (uncited, labelled
                        │                   unverified personal observation) ─► insight_cards
                        │                   AND A1 gap event (personal-signal-no-edge)
                        └─ research-context / contradiction ─► A1 gap events (not surfaced)
  on-open (stale>7d): S9 report — select (novelty via surfaced_cards) → cluster →
                        narrative (LLM, constrained) → chart specs (DET) → disclaimer
                        └─ append surfaced_cards + insight_reports
```

LLM locations: S8 Claude Haiku 4.5 (cached, fallback template), S9 narrative Claude Sonnet 5
(fallback: card list), U1 transferability grades (pre-graded at generation time into
`applicability_grades`; serve-time is a table read). Everything else is table reads + pure
functions.

### (b) Authoring + loop path — gap → served

```
S7 gap events + S5 signals + registry derivedFrom + A6 index
        ─► A1 gap_ledger classify (RULES, weekly)
        ─► nao queue builder: rank spend rows → A2 pairToQueries →
           R2 control/ingest-queue.json → workflow_dispatch(brain-ingest.yml, queue=id)
GitHub Actions runner (the CLI):
        control check (pause/budget, control.ts) → per queue item:
        discovery+snowball → retrieve bytes → A4 structure (DET JATS / GROBID-style
        PDF sidecar + Haiku 4.5 role-tags) → A4b citation-block parse (DET)
        → A5 tier → A6 mentions/co-occurrence/refGraph → A7 assertion gate
        → A8 synthesis (Claude Sonnet 5) → A9 quote check (DET gate)
        → A10 verify (DET corpus retrieval + decorrelated non-Anthropic adversarial verdict)
        → R2: structured/, index/, edges/claims.jsonl, edges/verifications.jsonl,
               runs/<runId>/outcome.json
nao cron: outcome write-back → gap_ledger.last_ingest_attempt
        → A11 loader → S6 tables → A12 coverage snapshot
        → next S9 report: novelty boost surfaces the new edge   (loop closed)
```

### Budget split

- **Prepopulation is OFF-API.** The initial edge set is produced by running this exact pipeline —
  same stages, same contracts, same R2 artifacts, same gates — with the LLM stages (A4 role-tags,
  A5, A8, A10) driven **manually via a developer-run terminal LLM session** (e.g. Claude Code / an
  interactive terminal model session) instead of metered API calls. This consumes **no metered API
  budget**. It still EXERCISES the real pipeline: edges are pipeline-produced (A9 quote gate, A10
  decorrelated verification, A11 load all run for real), NOT hand-authored; hand-seeded
  `provenance:'seed'` rows remain anti-empty insurance only. Curated queue seeded from
  `derivedFrom[]` pairs.
- **Runtime (demand-driven ingestion from the gap queue) is METERED.** LLM/API spend is governed
  by a budget setting that is **modifiable and checkable in the nao app**, carried on the existing
  R2 control plane: extend `control/ingest-config.json` (`tools/brain-ingest/src/control.ts:28`) —
  `IngestLimits` (`types.ts:302-305`) gains an `llmDailyUsd?` override alongside
  `openalexDailyUsd?`, normalized by `normalizeIngestControl` (`control.ts:35-45`), enforced by
  the CLI's fail-closed `BudgetGuard` (`types.ts:213-223`), and surfaced/editable in nao's
  existing ingestion-controls UI.

---

## 9 · Build-order dependency graph

```
L0  contract-extension PR ────────┐        S2 view + generator ─┐
    (population/derivation/offsets)│                            │
L1  A4 structure v2 (needs offsets; GROBID-style PDF sidecar)   S3 baseline fix ── S4 signals
    A4b citation-block parse (needs A4)
    A2 terms.ts ──► A6 mentions / A7 gate (A6 refGraph needs A4b)         │
L2  A8 synthesis ──► A9 quote check               S5 n=1 evaluator (needs S2)
         │                                        │
L3  A10 verifier (needs A6 corpus index)          │
L4  S6 edge tables + A11 loader                   │
L5  S7 composer (needs S4, S5, S6, U1-grader stub returning 'unknown') + S8 card migration
    (incl. 'personal' producer for the still-researching variant)
L6  ONE-CARD END-TO-END SLICE: one pair through A2→A11, one agree card,
    source panel data present (quotes+derivation+applicability), completeness score
L7  S9 report + surfaced_cards          A1 ledger + A3 transport + A12 coverage
L8  full loop demo: gap → queue → dispatch → new edge → next report (novelty boost)
```

Parallelizable tracks: the entire right-hand column (S2–S5, S7 skeleton, migrations) is
deterministic, spec-complete work assignable to a second developer; the left column (A4–A10) is
the LLM-adjacent scored delta. L0 gates L1; nothing else blocks starting both columns immediately.

---

## 10 · Model & compute assignment (consolidated)

### 10.1 LLM invocations

| Stage | Model (exact ID) | Purpose | Where it runs | Cost tier |
|---|---|---|---|---|
| A4 role-tagging (cold start) | Claude Haiku 4.5 (`claude-haiku-4-5`) | Batch-classify sentence roles (finding/method/background/hedge/other) until the trained tagger ships | Ingest CLI on GitHub Actions (runtime, metered) · developer terminal session (prepopulation, off-API) | Cheapest |
| A5 tiering assist | Claude Haiku 4.5 (`claude-haiku-4-5`) | Evidence-tier call on methods section only when RULES are inconclusive | Ingest CLI (runtime) · developer terminal (prepopulation) | Cheapest |
| A8 synthesis | Claude Sonnet 5 (`claude-sonnet-5`) | Propose `RelationshipClaim`s + `derivation` from claim-bearing sentences | Ingest CLI (runtime, metered) · developer terminal (prepopulation, off-API) | Mid |
| A10 verification | **Decorrelated non-Anthropic frontier model (e.g. a GPT-tier or Gemini-tier model)** — MUST be a different vendor family than A8's synthesizer; a same-family re-ask shares its blind spots | Adversarial refute-first verdict over verifier-retrieved sentences; fills all check blocks | Ingest CLI (runtime, metered) · developer terminal (prepopulation, off-API) | Mid (frontier) |
| U1 applicability grading | Claude Sonnet 5 (`claude-sonnet-5`); optional decorrelated non-Anthropic second grader for agreement | Rubric-anchored transferability grade `[0,1]\|'unknown'` + mandatory rationale, per (edge, paper) | Server-side at S7 generation time; cached to `applicability_grades`; serve-time reads are DET | Mid |
| S8 card phrasing | Claude Haiku 4.5 (`claude-haiku-4-5`) | Grounded card copy (cited + still-researching variants), copy-gated, cached per insight; DET template fallback | Server-side at generation time (nightly job) | Cheapest |
| S9 narrative | Claude Sonnet 5 (`claude-sonnet-5`) | Report paragraph constrained to selected cards' payloads; fallback = ordered card list | Server-side on report generation (on-open, stale>7d) | Mid |

Off-API terminal rows: during **prepopulation**, A4/A5/A8/A10 are driven by a developer-run
terminal LLM session (e.g. Claude Code) instead of metered API — same prompts, same contracts,
same artifacts (§8). No stage requires the highest tier (Claude Opus 4.8 / Claude Fable 5) today;
escalate A8 only if synthesis quality gates fail.

### 10.2 Trained ("own") models — deferred, with named substitutes

| Stage | Trained to do | Training dataset (from this design) | Cold-start LLM substitute | Swap plan |
|---|---|---|---|---|
| A4 sentence-role tagger | Classify each sentence: finding/method/background/hedge/other | The cold-start LLM's own role labels accumulated on `structured/` artifacts (target ≥5k labelled sentences) | Claude Haiku 4.5 (`claude-haiku-4-5`) | Distil into a small TS-runnable classifier (logistic over n-grams or ONNX minilm); `structureVersion` bump re-structures the corpus |
| A5 study-design→evidenceTier classifier | Map methods text + `workType` → `EvidenceTier` 1–5 | Rules-resolved tiers + LLM-assist labels on structured papers (rules stay as prior) | Claude Haiku 4.5 (`claude-haiku-4-5`), methods section only | Train once the labelled corpus covers all five tiers; keep RULES as the first pass, model only for the inconclusive residue |
| NLI claim-support checker (inside A10's check blocks; NOT A9 — A9 is the DET quote gate) | Judge sentence↔claim support/contradict/neutral | (claim, retrieved-sentence, verdict-block) triples accumulated from A10 runs | The A10 verifier LLM itself (decorrelated non-Anthropic) fills the check blocks today | Swap the per-sentence support call to the trained NLI model; keep the frontier LLM for the final verdict roll-up |
| Relation/direction extractor | Extract (subject, relation kind, direction) tuples from finding sentences | A8's accepted claims paired with their source sentences (synthesis-labelled, quote-checked by A9) | Claude Sonnet 5 (`claude-sonnet-5`) — today this lives inside A8's synthesis prompt | Split extraction out of synthesis once enough verified claim↔sentence pairs exist; A8 then composes over extractor output |
| Venue→impactTier lookup | — deterministic table lookup (venue → tier), **no training** | — | — | Stays DET forever; listed here only to close the "own models" inventory |

---

## 11 · Hyperparameter registry (all values provisional)

Every magic constant in the system, enumerated once, so each can be exposed and calibrated later
**without hunting it down**. All current values are declared-provisional dummies; none has a
derivation, citation, or calibration behind it yet.

| Constant | Where it lives | Current dummy value | What it controls |
|---|---|---|---|
| `EDGE_GATES.high` | `shared/brain/index.ts:27` | 0.8 | Edge score floor to serve plainly (high band) |
| `EDGE_GATES.mid` | `shared/brain/index.ts:29` | 0.5 | Edge score floor to serve with "limited evidence" qualifier |
| `edgeScore` confidence weight | `shared/brain/index.ts:46` | 0.6 | Dominance of verifier confidence in edge trust |
| `edgeScore` tier weight | `shared/brain/index.ts:46` | 0.25 | Study-design (evidence tier) shading of edge trust |
| `edgeScore` corroboration weight | `shared/brain/index.ts:46` | 0.15 | Net-corroboration shading of edge trust |
| Corroboration saturation | `shared/brain/index.ts:44` | 3 net sources | Cap on the corroboration boost |
| S4 deadband σ | registry ext. `signal.deadbandSigma` (S4 §4) | 0.5 | Width of the `neutral` band per metric |
| S5 FDR threshold | S5 signal rule (`q_value`) | q ≤ 0.05 | False-discovery gate on personal signals |
| S5 effective-N floor | S5 signal rule (`n_eff`) | N_eff ≥ 10 | Minimum autocorrelation-adjusted sample |
| S5 correlation floor | S5 `stable` rule (`rho`) | \|ρ\| ≥ 0.3 | Minimum association strength |
| S5 window | S5 `window_days` | 60 days | Joint-series evaluation window |
| S5 stability runs | S5 `stable` rule | 3 runs | Sign-stability requirement |
| S3 confidence cutoffs | S3 DDL comment (`baseline_snapshots`) | 3 / 5 / 14 days | `insufficient`/`low`/`medium`/`high` baseline confidence |
| Completeness weights | registry `dqs.weight` (`shared/metrics/registry.ts:62-63`), consumed in S7 §2 | per-key, provisional | Per-metric weighting of the completeness score |
| S9 novelty-demotion window | S9 selection rule | 3 reports | Repeat-surfacing demotion of unchanged edge versions |
| S9 staleness trigger | S9 transport | 7 days | Report regeneration on open |
| U1 `unknown` cutoff | U1 grading prompt/rubric | rubric-anchored, TBD | When a transfer is "too weak" → `'unknown'` instead of a score |
| U1 second-grader disagreement | U1 §3 | 0.3 | Grade divergence that demotes to `'unknown'` + review flag |
| Applicability plot bands | plot spec (U1) | 0.33 / 0.66 | Low/mid/high banding of the transferability axis |
| Budget hard-stop line | `tools/brain-ingest/src/types.ts:214` (`wouldExceed95`) | 95% of daily cap | Fail-closed metered-source cutoff |
| A3 per-item spend cap | `IngestQueueDoc.items[].maxPapers` (A3 §2) | per-item, TBD | Bounded spend per queue pair |

**Hyperparameter provenance surface (stub — DEFERRED).** There is currently **no user-facing layer
that exposes how any of these numbers was derived, its value, or a citation.** Future design: a
`hyperparameter_provenance` table the nao app could render — one row per constant:
`(constant, current_value, rationale text, citation text|null, calibrated_at, calibration_method)`
— populated from this registry, editable only through the same 2-reviewer TRUTH gate as the
registry. Deferred; this registry section is its authoring source when it lands.

### Known bounded limitations (not open decisions)

- **U1 transferability calibration:** the LLM-graded applicability score has no calibration
  baseline or ground truth — numerically unvalidatable today. Contained by: (a) rubric-anchored
  grading prompt, (b) optional decorrelated non-Anthropic second grader for agreement, (c) the
  stored rationale exposed to the user (auditable, not trusted blind), (d) `'unknown'` when the
  transfer is too weak.
- **Hyperparameter values (above):** all dummies; calibration method and data per constant still
  open.
- False-signal discrimination, entity-linking error floor (A2/A6), applicability inference on
  scope-less papers, coverage-denominator drift — all bounded by the mechanisms above
  (`retrieval-exhausted` + watermark retry, exclude-terms, `'unknown'`, `denominator_version`),
  none solvable to zero.

---

## 12 · What this supersedes

- **`docs/biotope/INSIGHTS-ENGINE-DESIGN.md` (IED), serve-side design:** the rules engine (IED §C)
  survives as ONE of three card producers in `insight_cards`; this doc adds the edge and personal
  producers (S7/S8), amends the IED's Neo4j-projection line (S6 replaces it with Postgres
  `verified_edges`), and renames the IED `correlation` leaf to `coincidence` (S4). The IED's
  presentation-agent discipline (§E) and copy-gate defense-in-depth (§C) are inherited unchanged.
- **`docs/nao/BRAIN-DESIGN.md` / `docs/nao/BRAIN-INGESTION-DESIGN.md`:** remain accurate for the
  contract rationale and the shipped ingest CLI; this doc is the authority on the stages layered
  on top (A1–A12, A4b), the queue transport (A3), the loader (A11), and the budget split.
- Any earlier scattered design notes on the insight engine, the gap loop, or the edge-serving
  path. Where those conflict with this document, this document wins.
