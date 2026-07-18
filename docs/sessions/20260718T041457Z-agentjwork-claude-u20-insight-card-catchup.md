# Session 20260718T041457Z — agentjwork — claude — u20-insight-card-catchup

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U20) · **Branch:**
  `fix/shared-types/insight-card-catchup` (cut from the chain tip `fix/shared-brain/safeguard-hardening`) ·
  **Issue:** #76 · **PR:** #77 (stacked on the chain tip; **shared/ retro-review** flag B8)
- **Type:** audit-fix unit U20 — **shared InsightCard contract catch-up**, findings A6 (medium),
  A20/A26 (low), A7 (nit) from `docs/temp/phase2-audit/audit-findings-register.md`, per sign-off
  decision D18 (REVIVE the shared Dart mirror; the app-side import + retirement of the app-local
  duplicate model is a later unit — `apps/biotope/lib` deliberately untouched here). Touches
  `shared/` ⇒ the PR carries the **shared/ retro-review** flag.

## Attempted
- Brought the TRUTH-tier `InsightCard` contract (TS interface + Dart mirror) up to what the DB
  (migration `20260716050639`) and the engine (`generate-insights`) actually write, extended the
  TS↔Dart parity guard to cover the new nested payload shape, and added a behavioural round-trip
  test on the shared Dart mirror.

## Changed (committed)
- `shared/types/index.ts`:
  - **A6:** `InsightCard` gains `producer?: 'rules'|'edge'|'personal'`, `insight_id?: string|null`,
    `edge_refs?: InsightCardEdgeRef[]`; new `InsightCardEdgeRef { edgeId: string; verifiedAt: string }`
    interface (named, not inline — the parity guard's `[^}]*` interface regex can't see past an
    inline object literal); `category` union gains `'relationship'` (matches the §S8 CHECK verbatim).
  - **A20:** `BaselineSnapshot.data_sources` → `('self_report'|'wearable'|'env'|'signal')[]`;
    `InsightCard.confidence_sources` → that set plus `'brain'`.
  - **A26:** `InsightCard.id: string` → `number` (column is `bigint generated always as identity`,
    migration `20260515110000:15`; PostgREST serializes bigint as a JSON number).
  - **A7:** stale comment `source: 'wearable'` → `source: 'sensor'` (the registry's `MetricSource`
    union has no 'wearable'; wearable metrics are `source: 'sensor'`).
- `shared/types/index.dart`: mirror of all of the above — `id` `String` → `int` via
  `(json['id'] as num).toInt()` (tolerates a decoder surfacing the JSON number as double, e.g. web
  jsonDecode / a JS re-serialization); new `InsightCardEdgeRef` class with fromJson/toJson; new
  `producer` / `insightId` / `edgeRefs` fields with constructor defaults and missing-key-tolerant
  fromJson (details under Decided).
- `shared/SHARED-CONTEXT.md`: the prose `InsightCard` / `BaselineSnapshot` blocks updated to the
  same shapes (id number, 'relationship', widened source unions, the three §S8 fields).
- `apps/biotope/test/guards/guard_support.dart`: `dartClassToJsonKeys` key regex widened
  `'([a-z0-9_]+)':` → `'([a-zA-Z0-9_]+)':` so camelCase jsonb-payload wire keys (`edgeId`,
  `verifiedAt`) are captured; snake_case column keys unaffected.
- `apps/biotope/test/guards/shared_types_parity_test.dart`: `InsightCardEdgeRef` added to
  `contractTypes` — the new InsightCard fields themselves are covered automatically by the existing
  field-name comparison mechanism (TS interface fields == Dart toJson keys).
- `apps/biotope/test/shared_types/insight_card_roundtrip_test.dart` (NEW): 3 behavioural tests on
  the shared mirror via relative import across the package boundary (`../../../../shared/types/index.dart`
  — the mirror has no package home until the app-side import unit): (1) realistic edge-producer row
  (numeric bigint id, `producer: 'edge'`, `edge_refs` object array, `'relationship'` category,
  `'brain'`+`'signal'` in confidence_sources) round-trips fromJson → toJson byte-equal; (2) id
  survives a double-surfacing decoder as `int`; (3) legacy pre-migration row (no producer keys)
  decodes with the DB-default values `'rules'` / null / `[]`.

## Decided / judgment calls
- **edge_refs shape modeled as `[{edgeId, verifiedAt}]` objects, NOT a string array.** The unit
  brief guessed "likely a string array of edge ids"; the ground truth disagrees — the engine writes
  `edge_refs: [{ edgeId, verifiedAt }]` (`generate-insights/index.ts:614-617,695`, CardRow interface
  :160) and the migration comment pins the same shape ("[{edgeId, verifiedAt}] — an edge VERSION per
  §S6"). Keys stay **camelCase on the wire** (jsonb payload, not table columns) — mirrored verbatim.
- **Defaults strategy (memory 0002 optional-with-default).** Existing serialized instances exist
  (local insight_cards rows predate the migration; the migration backfills with `producer` default
  `'rules'`, `edge_refs` default `'[]'`, `insight_id` null). Exact choice: **TS** — the three new
  fields are *optional* (`?`), the TS spelling of optional-with-default (rows read post-migration
  always carry them; pre-migration serialized JSON still type-checks). **Dart** — non-nullable
  fields with constructor defaults (`producer = 'rules'`, `edgeRefs = const []`, `insightId` nullable)
  and fromJson tolerating missing keys with those same DB-default values; `toJson()` always emits
  all three keys (so a re-serialized legacy card carries the §S8 shape explicitly, and the parity
  guard sees the keys). All pre-existing fields unchanged in optionality.
- **confidence_sources union is the data_sources vocabulary + 'brain'.** Verified writers: the S2
  view emits `'self_report'` / `'wearable'` (wide branches) and `'signal'` (signals branch,
  `tools/metric-view/lib/view.mjs:85`); compute-baselines copies view sources into
  `data_sources`; generate-insights copies snapshot sources into `confidence_sources` and appends
  `'brain'` on edge-corroborated cards (`index.ts:608,689`). `'env'` has no writer yet (no env view
  branch) but stays in the union — removing it would be a breaking narrow; commented as reserved.
- **Where the audit/spec got it wrong (recorded per brief):** (1) the edge_refs string-array guess,
  above; (2) the orchestration-log U20 worklist row bundled "app imports it, retire the app-local
  duplicate" into U20 — the D18 execution split defers that app-side half to a later unit, so this
  unit ships the revived mirror only (row annotated); (3) A7 pulled forward out of the U28 nit
  sweep into this unit since it lives on the same file (U28 row adjusted). Also confirmed A26's
  claim precisely: the old `json['id'] as String` would throw a cast error on every real row.
- **Nested-type guard coverage needed a one-character regex widening** in `guard_support.dart`
  (uppercase allowed in toJson keys) — without it `InsightCardEdgeRef` could not join
  `contractTypes` because its wire keys are camelCase. Judged safe: no other toJson uses camelCase
  keys, so no existing assertion changes meaning.

## Gate results (all green)
- `npx tsc --noEmit` in `shared/` — clean. Nothing in `supabase/functions` or `tools/` imports
  `shared/types` (grepped; the engine keeps its own structural `CardRow`), so no downstream TS suite
  is affected.
- `flutter analyze` — no issues; `flutter test` — **52/52** (was 48; +1 InsightCardEdgeRef parity
  test, +3 round-trip tests). All 8 shared-types parity assertions green incl. the extended ones.
- `node tools/context_sync.mjs --check` — consistent (docs/temp index-exempt; no `--fix-index`
  needed — no indexed docs touched).

## Left / follow-ups (not this unit)
- App-side: import the revived shared mirror, retire
  `apps/biotope/lib/modules/m5b_insight_engine`'s duplicate `InsightCard`, and surface
  producer/edge_refs in the UI (A25/A27 seam) — the D18 second half, queued with the app units.
- A5-style stricter identity guard for these unions is TS-side only and already shipped in U19.

## Blockers
- None.

memory: none
