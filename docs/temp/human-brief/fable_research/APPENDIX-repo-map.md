# Appendix — repo reference map (makes this folder self-contained)

Every document in this folder cites code, tables, and docs that live **elsewhere in the repo** by path
(and sometimes `file:line`). This appendix summarises each of those external locations — **what it stores or
does, and its data shape** — so a reader never has to open the repo to follow a pointer. When a doc writes
`shared/brain/relationships.ts:102` or "`baseline_snapshots`", look it up here.

**Status note:** the pack was written 2026-07-05/06. "Exists" / "does not exist" reflects the repo at that
time; **the brain had zero verified edges and the pipeline past text-extraction was unbuilt.** The
architecture in [`12-system-architecture.md`](12-system-architecture.md) is a *design*, not shipped code —
its "planned stores" (below) did not exist yet.

Legend: **EXISTS** = code/schema present · **DESIGN-ONLY** = a design doc specifies it, no code · **PLANNED**
= introduced by this pack's design, not yet built · **BRANCH** = only on a named git branch.

---

## 1 · The brain contract (`shared/brain/`) — EXISTS (TypeScript only; TRUTH-tier, 2-reviewer-gated; zero edges)

The typed contract for the knowledge graph's relationships. No database table, no Dart mirror — types only.

**`shared/brain/relationships.ts`** — the edge data shapes:

- `RelationKind` = `'increases' | 'decreases' | 'modulates' | 'correlates' | 'confounds' | 'no_effect'`
  (the signed relation; `modulates` = non-monotonic / U-shaped).
- `RelationshipClaim` = `{ edgeId, subject, object, relation: RelationKind, claimKind: 'causal'|'correlational'|'mechanistic', effect: {size, unit, ci}, population: string | null (verbatim claimed scope), citations: Citation[], quoteSpans: QuoteSpan[], synthesisModel, promptVersion, synthesisedAt }`.
- `Citation` = `{ paperId (DOI/internal), title, year, evidenceTier: 1|2|3|4|5 (study-design reliability), impactTier: 'high'|'moderate'|'low'|'preprint' (venue), stance: 'supports'|'refutes'|'mixed'|'mentions' }`.
- `QuoteSpan` = `{ paperId, quote (verbatim text, checked literally present before the verifier runs), locator: string | null (free-text "section/page/figure" — NO structured page/char offsets today) }`.
- `EdgeVerification` = `{ verdict, corroboration: {supporting: number, contradicting: number}, directionCheck, claimKindCheck, scopeCheck: {mismatch, supportedPopulation}, effectSizeCheck, quoteCheck: {spansFound, spansTotal, allPresent}, independentRetrieval: {performed, sources}, confidence: 0..1, dqs: {weight} }`.

**`shared/brain/index.ts`** — pure gating functions over an `EdgeVerification`:

- `edgeScore(v)` = `confidence * (0.6 + 0.25*tierWeight + 0.15*corroborationBoost)`, clamped `[0,1]`, where
  `tierWeight = evidenceTier/5` and `corroborationBoost` saturates at 3 net supporting sources. **`impactTier`
  (venue) is deliberately NOT in the score** — notability never enters served trust.
- `servingBand(v)` → `'high' | 'mid' | 'hold'` via `EDGE_GATES = {high: 0.8, mid: 0.5}`. `hold` is never served.
- `SERVABLE_VERDICTS = {supported, partial}` — `uncertain`/`unsupported`/`contradicted` never serve.

There is **no** applicability-to-user field, no structured span offset, no `derivation` field — those are the
additive contract changes the pack proposes.

---

## 2 · The metric registry (`shared/metrics/registry.ts`) — EXISTS

The single source of truth for what metrics exist (~100). `MetricDefinition` per key ≈
`{ key, table (which raw table it lives in), reliability (source-quality weight: device > ambient-API >
self-report), baselineApplicable (bool — can a per-user baseline be computed), derivedFrom: string[] (input
metric keys for a derived metric — "seeds the brain"), dqs (data-quality settings), ... }`. Used by the
serve path to enumerate metrics and by the authoring loop to seed candidate pairs.

---

## 3 · Data stores that EXIST (Supabase Postgres migrations)

- **`baseline_snapshots`** (`supabase/migrations/20260515100000_...sql`) — per-(user, metric) statistical
  baseline. Columns: `user_id, metric_key, computed_at, days_of_data (smallint, ≤7 by definition), mean,
  std_dev, min, max (numeric), trend ('rising'|'falling'|'stable'), confidence
  ('insufficient'|'low'|'medium'|'high'), data_sources text[]`; `unique(user_id, metric_key)`. **One row per
  pair, overwritten nightly** — holds no day-level history, so pairwise correlation can't be derived from it
  (see the pack's P14). Note the internal contradiction the pack flags: `days_of_data` maxes at 7 but
  `confidence='high'` was documented as needing 14+ days (unreachable).
- **`insight_cards`** (`supabase/migrations/20260515110000_...sql`) — one row per fired rule. Columns:
  `id, user_id, rule_id, generated_at, title, body, category (CHECK: hydration/gut/vector/behaviour/
  descriptive — rejects edge-derived categories), severity, contributing_metrics text[], confidence_score
  numeric(4,3), confidence_sources text[] (loaded but never rendered in the UI), status
  (active/snoozed/dismissed), expires_at (7-day), phase_generated`; `unique(user_id, rule_id)`. Keyed by
  `rule_id` (the deterministic rules system) — **no edge reference** (the pack's P13).
- **`daily_gut_rows`** (`supabase/migrations/20260513_...sql`) — raw per-day self-report rows;
  `unique(user_id, log_date)`. **Retained indefinitely** → the real day-level history the personal-
  correlation evaluator needs.
- **`wearable_daily`** (`supabase/migrations/20260528100000_...sql`) — raw per-day wearable rows;
  PK `(user_id, date)`. Retained indefinitely.

---

## 4 · Ingestion tool (`tools/brain-ingest/src/`) — EXISTS through text-extraction only

- **`extract.ts`** — today **flattens each paper to one whitespace-collapsed string** (PDF via `unpdf`
  `mergePages`; JATS XML walked but section structure discarded). No section segmentation, no sentence
  roles, no char/page offsets. This is the stage the pack rebuilds ("A4").
- **`seeds.ts`** — a hard-coded **6-topic** free-text seed list; does not read `derivedFrom[]` or any demand
  signal. The pack replaces this with a demand-driven queue.
- **`control.ts` / `types.ts`** — the R2 ingest **control plane**: `control/ingest-config.json` ≈
  `{ paused: bool, limits: IngestLimits, updatedAt, updatedBy }`. The pack extends this with a runtime LLM
  budget field, made editable/checkable in the nao app.
- Everything downstream of "text + `paper_uid`" (synthesis, verifier, `quoteCheck`, edge storage) **does not
  exist** — it is the scored delta the pack designs.

---

## 5 · Data stores the pack's design INTRODUCES (PLANNED — see `12`)

Not in the repo; defined in [`12-system-architecture.md`](12-system-architecture.md):

- **`metric_daily_values`** (live DB **view**, registry-generated) — long-format `(user_id, metric_key, day,
  value)` unpivot of the raw day tables; the single input shape for baselines and pairwise correlation.
- **`personal_signals`** — output of the n=1 evaluator: per-user pair correlations `{strength, N_eff,
  stable}` after autocorrelation + FDR control.
- **`verified_edges`** (+ `relationship_claims`, `edge_verifications`) — the served projection of accepted
  edges (the truth store; no Neo4j — projected straight to the force-graph).
- **`gap_ledger`** — per candidate metric-pair, a status row (`served` / `edge-below-band` /
  `personal-signal-no-edge` / `lit-candidate-no-edge` / `personal-null` / `blocked-completeness`) driving the
  ingestion queue.
- **`applicability_grades`** — cached LLM transferability grade `[0,1]|'unknown'` + rationale, per (edge,
  paper), read deterministically at serve time.
- **`coverage_snapshots`** — served ÷ derivable over time (the "getting smarter" metric).
- **`insight_reports` / `surfaced_cards`** — the weekly report + an append-only surfaced-history ledger
  (novelty / anti-repetition).
- **`user_attributes`** — optional context fed to the applicability grader.
- **R2 artifacts** — `structured/<paperUid>.json` (segmented paper + offsets), `structured/<paperUid>.refs.json`
  (citation-block → reference map), `index/cooccurrence.json` (co-occurrence + reference graph),
  `edges/claims.jsonl`, `edges/verifications.jsonl`, `control/ingest-queue.json`.

---

## 6 · Design & strategy docs referenced (elsewhere in the repo)

- **`docs/biotope/INSIGHTS-ENGINE-DESIGN.md`** (IED) — DESIGN of the deterministic rules engine. Rule
  blueprint = a Zod discriminated union of `trend` / `threshold` / `correlation` conditions;
  `correlation = {metricKeys, both, minConfidence}` (**no lag field**, and it is a conjunction of two
  per-metric leaf tests, not a real correlation). §E = the presentation agent (haiku-tier, grounded,
  copy-gated). `validateCopyString` + `FORBIDDEN_WORDS` = the non-diagnostic copy gate.
- **`docs/BIOTOPE-NAO-LINK.md`** (LINK) — **BRANCH** `origin/docs/biotope-nao-link-plan`. The runtime read
  path: 1-hop neighbour retrieval, the presentation agent as the *sole* live brain read, three
  `verified_edges` provenance writers (`llm` / `human` / `seed`), the "engine never touches Neo4j at
  evaluation" invariant, and the (then-undecided) sync-job trigger and `insight_needs` shape.
- **`docs/nao/BRAIN-DESIGN.md`** — DESIGN of synthesis + the second, decorrelated adversarial verifier;
  decided `verified_edges` as the truth store (not built).
- **`docs/nao/BRAIN-INGESTION-DESIGN.md`** — DESIGN of acquisition (discover → OA-locate → fetch → extract →
  manifest); deliberately stops at "text + `paper_uid`".
- **`docs/nao/BRAIN-MODELS-TRAINING.md`** — DESIGN of four support models (NLI claim-support; study-design →
  `evidenceTier`; venue → `impactTier`, which is a deterministic lookup, no training; relation/direction).
  All deferred pending GPU credits; the pack uses LLMs as cold-start substitutes.
- **`docs/PHASE2-PLAN.md`** — the phase-2 plan that Wave 1 (`01`, `02`, `STALE-03`) revises.
- **`docs/HACKATHON.md`** — the challenge rules: five pillars scored 1–5 (Problem · Approach · Evidence ·
  Constraints · Honesty & Trajectory); "**judges score the delta**"; "a modest claim, proven, beats a grand
  claim, asserted."
- **`docs/HACKATHON_DIRECTION.md`** (HD) — strategy: the scored delta = "the brain"; **depth over breadth**
  ("Priority 0 — protect the eval"); **Priority 2 — drop Neo4j**, project the truth store into the
  force-graph; §4.1 "zero edges exist."

---

## 7 · The two source briefs (this folder's parent, `docs/human-briefs/`)

Cited constantly as **MKB** and **PSK**. Both are 🔬 research briefs ("options, not yet a decision").

- **MKB** = `docs/human-briefs/2026-07-04-metric-knowledge-bridge.md` — the *semantic bridge*. Its load-
  bearing ideas: two layers (population **knowledge** from literature vs per-user **inference** from app
  data), composed at query time; triangulation is a **graded signal, not a hard gate**; composition is
  **1-hop and monotonic-only** (`modulates` = context only); a labelled **idiosyncratic** pathway; **n=1
  statistics** (N_eff, FDR, effect+CI) as false-positive control; **corroboration clustered by independent
  evidential root**; **notability ≠ trust**. §9 defines the four branches (agree / research-context /
  idiosyncratic / contradiction) and the "agree fires rarely" honest expectation. **This is the brief whose
  *product stance* Wave 2 overturns** (see `06`).
- **PSK** = `docs/human-briefs/2026-07-04-paper-to-structured-knowledge.md` — the *ingestion* side. Its
  cascade: `segment + role-tag → tier → PICO/effect → assertion/negation gate → synthesis → NLI → verifier →
  human-on-disagreement`, where every stage exists to fill one `RelationshipClaim` tuple. Also: sections
  carry different epistemic value (Methods = reliability, Results = effect, Abstract = spin-to-flag);
  **references-as-graph** for corroboration; error compounds (~0.9ᵏ) so prefer fewer precise stages.

---

*If a pointer in any doc isn't covered here, it resolves within this folder (the `01`–`12` document IDs — see
[`00-README.md`](00-README.md) for the ID → filename map).*
