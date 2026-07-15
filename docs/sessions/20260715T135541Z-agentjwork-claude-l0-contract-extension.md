# Session 20260715T135541Z — agentjwork — claude — l0-contract-extension

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U1) · **Branch:**
  `feat/shared/l0-contract-extension` (cut from the run chain) · **Issue:** run chain (orchestrator opens PR)
- **Type:** Shared contract (TRUTH tier). The L0 contract-extension from
  `docs/shared/insight-engine-architecture.md` §7/§9 — the small shared/ PR that gates all
  insight-engine work (L0 gates L1).

## Attempted
- Implement the full L0 bundle: brain-contract fields (`Citation.population`, `QuoteSpan.charStart`/
  `charEnd`, `RelationshipClaim.derivation`) + the registry `signal` extension (`{ deadbandK }`),
  with zod mirrors, TS/Dart lockstep, and doc updates; run the full gate.

## Changed
- `shared/brain/relationships.ts` — `Citation.population: string | null` (per-paper studied
  population), `QuoteSpan.charStart`/`charEnd: number | null` (offsets into the canonical extracted
  text; null when unknown), `RelationshipClaim.derivation: string` (synthesis reasoning trace,
  required on every claim).
- `shared/brain/relationships.schema.ts` — mirrored all three in `citationSchema` /
  `quoteSpanSchema` / `relationshipClaimSchema`; new invariant: `charStart ≤ charEnd` when both
  non-null (offsets int + nonnegative); `derivation` min(1). `AssertExact<>` guards stay green.
- `shared/metrics/registry.ts` + `registry.dart` — `MetricDefinition.signal: { deadbandK: number } | null`
  (Dart: `MetricSignal? signal`); populated `{ deadbandK: 1.0 }` on all 16 `baselineApplicable`
  metrics, `null` on the 3 non-baselined ones (`symptom_flags`, `standing_water_present`, `notes`).
  TS and Dart mirrors in lockstep (same keys, order, values).
- `shared/metrics/registry.schema.ts` — `signal` mirrored (`deadbandK` positive, nullable object);
  new invariant: `baselineApplicable ⇒ signal != null`. `AssertExact<>` green.
- `shared/metrics/README.md` — `signal` row added to the canonical `MetricDefinition` field table
  (shape NOT restated in metrics-registry-design.md, per ownership rule).
- `shared/brain/README.md` — field-reference rows for `derivation`, `Citation.population`,
  `charStart`/`charEnd`.
- Guards in `apps/biotope/test/guards/` needed no changes — none asserts the full
  `MetricDefinition` field list (parity guard checks key/table/status/baselineApplicable only).

## Decided
- `deadbandK` (ADR-0002 name, robust σ̂ = MAD/0.6745 units, default 1.0), NOT the architecture
  doc's older `deadbandSigma` — per ADR-0002 / run decision D5.
- `population` added at the Citation level (per-paper studied population, U1 grader input)
  alongside the existing claim-level `RelationshipClaim.population` (claimed scope), which stays.
- Required (non-optional) `derivation` / `population` / offsets are safe: zero persisted
  RelationshipClaim/EdgeVerification instances exist, and no code constructs these types yet
  (docs/memory/0002 optional-with-default rule not triggered).
- Minimal invariants only: `charStart ≤ charEnd` (both non-null) and
  `baselineApplicable ⇒ signal != null`; no converse constraint (`signal ⇒ baselineApplicable`)
  to keep the schema minimal.
- `signal` placed between `dqs` and `ui` in the field order, identically in TS interface, zod
  schema, Dart class, and all 19 instances.

## Left
- Consumers of the new fields (A4 structure v2 offsets, A8 synthesis derivation, S4 deadband
  reader, U1 grader) are later sessions — this PR is contract-only.
- Architecture doc still says `deadbandSigma` in §S4/§7/appendix; superseded by ADR-0002/D5 —
  doc reconciliation left to the orchestrator/doc pass.

## Blockers
- None. Gate: `npx tsc --noEmit` (shared/) clean · `flutter analyze` clean · `flutter test`
  35/35 pass · `context_sync --check` pass.

memory: none
