---
title: "Run-2 U4 — orientation-aware cards (O16), research-context gap-only (O18), gap_ledger (O9 slice)"
summary: "A directional card can no longer state the non-fired endpoint as having moved (O16: cardEdge/rendersCard in the pure composer); research-context/contradiction are gap-only per architecture (O18 decision (a)); the §A1 gap_ledger table + record_gap_events UPSERT-increment land with aggregate-only demand writes from generate-insights. 8-vector orientation matrix + live handler proof on the local stack."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U4 · Card semantics + gap ledger (O16 + O18 + the gap_ledger slice O9 needs)

Branch `feat/phase2-run-2/u4-card-semantics-gap-ledger` off `feat/phase2-run-2/u3-contract-hardening`.
Backlog items executed as locked: **O16** (orientation-aware cards, verdict B2), **O18** (research-context
gap-only, DECIDED (a) Jayden 2026-07-24), and the **gap_ledger table + serve-path writes** — the slice
both O18 and O9/feature-d need. Architecture §A1 shape followed VERBATIM (see divergence notes below).

## What changed

### O16 — a card never states the non-fired endpoint as having moved
- `supabase/functions/generate-insights/composer.ts`: `ClassifiedPattern` gains **`cardEdge`** — for a
  single-metric (fired signal) pattern, the best direction-consistent edge whose **SUBJECT is the fired
  metric** (subject-endpoint edges are also preferred as `topEdge`); null when the fired metric sits only
  on OBJECT endpoints. Pair (coincidence) patterns keep `cardEdge === topEdge` (both endpoints observed
  by construction). New pure **`rendersCard`** is the single surfacing policy: `agree` renders only with
  a `cardEdge`; `idiosyncratic` renders; `research-context`/`contradiction` never render.
- `supabase/functions/generate-insights/index.ts` fired-signal path: the edge card renders from
  `cardEdge` with `metric_a_label = label(<fired metric>)`, plus a defensive orientation check
  (`cardEdge.subject !== metricKey` → drop + `console.error`, never a wrong-metric card). The object-only
  case stores the composed row and writes a gap event instead of a card.

### O18 — research-context / contradiction are gap-only (decision (a))
- Coincidence-rule path: the render gate is now `rendersCard(classified)` — **only `agree` renders**;
  research-context/contradiction keep their composed row (`pushInsight` unchanged) and write an A1 gap
  event. Handler now agrees with the architecture §S7 text and the composed_insights migration comment.
- The `edge_refs` **all-pairEdges fallback is removed**: card `edge_refs` may only carry monotonic
  direction-consistent edges — `correlates`/`modulates` can never decorate a card (§1.3 invariant).

### gap_ledger (§A1) + serve-path writes
- New migration `supabase/migrations/20260724090000_create_a1_gap_ledger.sql`: `gap_ledger` with the
  §A1 columns/status-enum/PK verbatim + `gap_ledger_pair_order` CHECK (metric_a < metric_b, enforcing
  §A1's lexicographic comment); RLS on with **authenticated SELECT restricted to scope='aggregate'**;
  `record_gap_events(jsonb)` — plpgsql UPSERT-increment (demand += per event, status last-write-wins,
  `last_status_change` bumped on transition), EXECUTE revoked from public/anon/authenticated, granted
  to service_role only.
- Handler gap writes (aggregate scope only, deduped per user per run, **no user id ever leaves the
  function** — demand counts demanding users per run):
  - O16 object-only agree → `personal-signal-no-edge` with `lit_candidate {hasEdge:true, servingBand,
    orientation:'object-only'}` (the pair HAS an edge; not in a servable orientation);
  - research-context (both paths) → `blocked-completeness` (§S7: "research-context → completeness-gated")
    with the pair completeness score;
  - contradiction (both paths) → `needs-review` (§S7 verbatim);
  - idiosyncratic sweep, gate-passing → **card AND** `personal-signal-no-edge` (§S7 "does BOTH");
  - idiosyncratic sweep, computed-but-non-gate-passing personal + no edge (branch-5 fuel) →
    `personal-null`, no card, no insight.
- Response JSON gains `gapLedger: { pairsTouched, demandByStatus }`.

### Tests
- `tools/rules/tests/engine_orientation_gap.test.ts` (new): the **8-vector O16 acceptance matrix**
  ({subject-only, object-only, both-consistent, both-inconsistent} × {increases, decreases}) plus
  corner vectors (object pattern with both endpoints observed; subject-endpoint edge preferred over a
  higher-scored object-endpoint edge; pair patterns keep cardEdge===topEdge), the O18 `rendersCard`
  policy, the `gapStatusFor` §A1 mapping, and a render-level fired-metric assertion.

## Live proof (local stack, actual outputs)

Seed (scratchpad `u4-seed.sql` piped into `docker exec -i supabase_db_ourobion psql`): edge
`sleep_duration_min|increases|hrv_sdnn_ms` (high, 0.9) + `energy_score|correlates|mood_score` (mid, 0.6);
user A = 20-day hrv baseline (50–54) + today 90, **no sleep data** (object-only signal — the reproduced
O16 bug input); user B = 20-day sleep baseline (400–404) + today 500 (subject signal) + personal pairs
(resting_hr_bpm|sleep_duration_min gate-passing, sleep_duration_min|step_count stable=false); user C =
energy/mood baseline snapshots + a coincidence rule on the correlates-only pair (research-context).

`npx supabase functions serve generate-insights` + POST with the local service-role key:

```json
{"ok":true,"day":"2026-07-24","users":3,"rules":{"loaded":1,"skippedAtLoad":[]},"firedPatterns":3,
 "insights":{"upserted":4,"byBranch":{"agree":2,"research-context":1,"idiosyncratic":1,"contradiction":0}},
 "cards":{"upserted":2,"byProducer":{"rules":0,"edge":1,"personal":1},"droppedAtRender":[],
 "dismissedSkipped":0,"snoozedSkipped":0},
 "gapLedger":{"pairsTouched":4,"demandByStatus":{"personal-signal-no-edge":2,"personal-null":1,"blocked-completeness":1}},
 "brainScopeSkips":[]}
```

SQL asserts (all ran green, `u4-assert.sql`):
1. Cards produced: exactly 2, both user B — the edge card
   `edge:sleep_duration_min|increases|hrv_sdnn_ms` with body **"Your sleep duration min data shifted
   upward today, and published research reports that sleep duration min tends to raise hrv sdnn ms.
   Worth watching, not a verdict."** (states the FIRED metric) + the personal card
   `personal:resting_hr_bpm|sleep_duration_min`.
2. **User A (object-only) has ZERO cards** (`count = 0`) and zero cards matching
   `body like '%sleep duration min data shifted%'` — the reproduced wrong-metric failure is gone.
3. Composed rows stored for ALL branches: A `agree` (`signal:hrv_sdnn_ms:up`), B `agree` +
   `idiosyncratic`, C `research-context` — object-only/gap-only lose the card, never the row.
4. User C (research-context) has ZERO cards; its composed row exists.
5. `gap_ledger` after run 1 (all scope='aggregate', **no user ids anywhere**):

```text
      metric_a      |      metric_b      |   scope   |         status          | demand | completeness |                             lit_candidate
--------------------+--------------------+-----------+-------------------------+--------+--------------+------------------------------------------------------------------------
 energy_score       | mood_score         | aggregate | blocked-completeness    |      1 |        0.000 | {"hasEdge": true, "servingBand": "mid"}
 hrv_sdnn_ms        | sleep_duration_min | aggregate | personal-signal-no-edge |      1 |        0.375 | {"hasEdge": true, "orientation": "object-only", "servingBand": "high"}
 resting_hr_bpm     | sleep_duration_min | aggregate | personal-signal-no-edge |      1 |        0.375 | {"hasEdge": false}
 sleep_duration_min | step_count         | aggregate | personal-null           |      1 |        0.375 | {"hasEdge": false}
```

6. Second invoke → all four rows `demand = 2` (UPSERT-increment proven).
7. Permission posture: anon RPC `record_gap_events` → `42501 permission denied for function
   record_gap_events`; anon `GET /rest/v1/gap_ledger` → `[]` (no anon policy).
8. `edge_refs` on every card resolve to `increases` relations only (fallback removal held).

## Gate summary

- `tools/rules` `npm test` — **82/82 pass** (includes the new 8-vector matrix + policy vectors).
- `tools/rules` `npx tsc --noEmit` (npm run typecheck) — clean.
- `npx supabase db reset` — clean; tail:

```text
Applying migration 20260716050639_create_m5b_composed_insights_and_card_producers.sql...
Applying migration 20260718051721_constraint_hygiene_checks_and_edge_score_precision.sql...
Applying migration 20260724090000_create_a1_gap_ledger.sql...
WARN: no files matched pattern: supabase/seed.sql
Restarting containers...
Finished supabase db reset on branch main.
```

- Live integration proof — executed, outputs above.
- Flutter guards: no guard references the new migration or enumerates the migrations directory
  (checked `apps/biotope/test/guards/*`); the category/severity CHECK guards are untouched by this
  migration — no guard update, no flutter run needed.
- `node tools/context_sync.mjs --check` — passed.
- `deno` absent locally (known): `index.ts` types are CI's deno-check gate; behavior validated live.

## Divergences / judgment calls (recorded)

- **Brief's suggested gap shape vs §A1:** the brief sketched
  `reason in ('no_edge','research_context','contradiction','object_only_signal')` + first_seen/last_seen
  + UNIQUE(subject,object,reason). Architecture §A1 specifies a concrete conflicting shape
  (metric_a/metric_b/scope PK, an 8-value `status` enum, `demand`, `last_status_change`) — **the
  architecture was followed**, as the brief instructs. The brief's reasons map onto §A1 statuses via
  `gapStatusFor` (research_context → blocked-completeness, contradiction → needs-review, no_edge →
  personal-signal-no-edge / personal-null); object-only is distinguishable inside `lit_candidate`
  (`orientation: 'object-only'`) rather than by a status value §A1 does not have.
- **Branch-4 ledgers demand:** §A1/§S7 explicitly say idiosyncratic does BOTH card and gap event —
  implemented as instructed by the architecture (the brief left this to §A1).
- **`scope` column kept** (§A1 reserves user-scope rows for the later weekly classifier), but the serve
  path writes aggregate-only and the authenticated read policy exposes `scope='aggregate'` only —
  belt over the privacy invariant.
- **Status is last-write-wins** in `record_gap_events`; the weekly §A1 classifier (later unit, U16) is
  the total status resolver. Demand deduped per (user, pair, status) per run — a counter, not
  idempotent across re-runs (aggregate fire-count semantics, §A1).
- `contradiction`'s `needsReview()` edge-side flag (shared/brain) NOT wired — shared/ is out of this
  unit's scope; the `needs-review` ledger status carries the signal. Flag for a later unit if wanted.
- `topEdge` now prefers subject-endpoint consistent edges (so card metadata and insight identity agree);
  composed_insights is append-only so re-runs simply mint the new deterministic ids.

memory: Run-2 U4 shipped O16+O18+gap_ledger — composer now exposes cardEdge/rendersCard/gapStatusFor as
the pure surfacing policy; gap_ledger follows architecture §A1 verbatim (aggregate demand, no user ids);
research-context/contradiction and object-only signals are gap-only.
