---
id: "0004"
title: Local-Day Projection for Event and State Primitives
summary: Defines the additive local_day_v1 calendar, raw timezone provenance, explicit per-metric reducers, one exclusive projection watermark, half-open non-overlapping state bands, and absent quiet days for S1-to-S2 daily projection.
type: decision
status: accepted
decided: 2026-07-30
updated: 2026-07-30
---

# Local-day projection for event and state primitives — architecture decision

> **Status: authoritative ground truth** · Date: 2026-07-30 · Refines: S1 / S2 / R4-U6 A4
> Part of the insight-engine architecture — see
> [`../insight-engine-architecture.md`](../insight-engine-architecture.md). Registry contract:
> [`../../../shared/metrics/README.md`](../../../shared/metrics/README.md).

## Context

The `events` and `state_bands` raw-storage primitives exist, and the merged A4-S0 scaffold proves a
fail-closed UTC projection shape. It deliberately activates no production metric. The remaining
decision is how an occurrence or span becomes a human calendar day without silently changing meaning
near midnight or when a person travels.

UTC bucketing is deterministic but does not reliably represent the day on which a person experienced
or recorded something. Conversely, converting historical instants with the user's *current* profile
timezone rewrites history after travel or a timezone-setting change. State bands add two further
ambiguities: an open interval needs a bounded end for a reproducible read, and overlapping intervals
need either a priority rule or rejection. A generic payload cast is also unsafe because the primitive
tables intentionally store heterogeneous JSON.

The owner approved the conservative local-day policy on issue #220. This ADR makes that policy exact.
It is a decision record only: the S1 schema, shared registry contract, S2 generator, collectors, and
production metric activation remain separate forward implementation slices.

## Decision

### 1. Calendar policy is explicit and versioned

- Retain `calendar: 'utc'` as the legacy policy. Existing UTC fixtures and any explicitly UTC metric
  are not silently reinterpreted or backfilled.
- Add `calendar: 'local_day_v1'` additively. It is the intended policy for user-experienced
  event/state metrics whose meaning follows the person's local calendar.
- Every production `events` or `state_bands` metric selects its calendar and reducer explicitly in
  `MetricDefinition.dailyProjection`. Nothing infers them from metric type, source, tier, or table.
- Missing or invalid `local_day_v1` provenance never falls back to UTC. Preserve the raw row, omit it
  from that derived projection, and surface the validation failure for repair.

The version suffix is intentional: a future semantic change gets a new calendar identifier rather
than changing historical `local_day_v1` output in place.

### 2. Local day is captured as raw provenance, not reconstructed from a profile

- An event retains its absolute `occurred_at` instant **and** captures the local calendar date and
  stable timezone identity that applied at occurrence.
- A state-band segment retains its absolute endpoints and captures local-date/timezone provenance for
  each present endpoint. One segment has one stable timezone identity.
- If the timezone changes while a state is active, the writer closes the old segment and opens an
  adjacent segment at the same absolute instant under the new timezone. The half-open interval rule
  below prevents the boundary from being counted twice.
- Editing the user's current timezone never rewrites historical raw provenance. S2 consumes the
  captured provenance; it does not ask the current profile what yesterday meant.

Exact column names and validation constraints belong to the S1 forward-migration slice. That slice
must preserve the absolute timestamps as truth and add provenance; it must not rewrite the landed
primitive migration or hand-edit an S2 projection.

### 3. One exclusive S1 watermark bounds one projection evaluation

S1 exposes one immutable timestamp watermark `W` for the entire S2 evaluation, which runs against
one consistent database snapshot. Every branch uses the
same `W`, and `W` is an **exclusive** upper bound:

- events are eligible only when `occurred_at < W`;
- state segments are eligible only when `started_at < W`;
- a closed band is evaluated as `[started_at, min(ended_at, W))`;
- an open band is evaluated as `[started_at, W)`.

No branch samples its own clock. Rows at or after `W`, and changes that arrive after the accepted
snapshot, are handled by the next evaluation. This gives open bands a reproducible end and prevents a
single projection from mixing different notions of “now.”

### 4. Reducers are per metric and closed-set

For `events`, the first supported reducers remain:

- `count` — count accepted event rows; ignore payload;
- `sum` — sum valid numeric JSON payloads;
- `mean` — average valid numeric JSON payloads;
- `latest` — take the valid numeric payload with the greatest `(occurred_at, id)` ordering so ties are
  deterministic.

For `state_bands`, the first supported reducer is `presence`: emit numeric `1` for each local day
touched by an accepted band segment.

Invalid payloads fail closed for payload reducers; they are never coerced from text or boolean. A new
payload-valued state reducer or any reducer with different semantics requires an additive contract and
decision update before a metric can select it.

### 5. State intervals are half-open and overlaps are invalid

- State segments use `[started_at, ended_at)`. Adjacent segments are valid; the shared endpoint belongs
  only to the later segment.
- An open segment has `ended_at = null` and is clipped to the exclusive watermark as described above.
- Overlapping segments for the same `(user, metric)` are rejected. There is no stacking order,
  last-write-wins behavior, implicit union, or priority rule.
- A timezone change is represented by adjacent segments, never overlapping ones.

The existing UTC scaffold's defensive presence collapse is not permission to accept overlapping
production truth. The implementation slice must reject overlaps before production metric activation
and must not invent a precedence rule for legacy-invalid data.

### 6. Quiet days are absent

If no accepted event or state-band segment contributes to a day, S2 emits **no row** for that
primitive metric/day. It does not manufacture `0` for `count`, `sum`, `mean`, `latest`, or `presence`.
Consumers calendar-align the sparse series and treat the missing point as absent/unknown, not as a
measured zero. This preserves graceful degradation and avoids turning non-collection into a health
claim.

## Two-tier truth and product boundaries

- Absolute instants, captured local-date/timezone provenance, event payloads, and state segments are
  TRUTH-tier raw data.
- `metric_daily_values` is a rebuildable DERIVED projection. Change raw input or deterministic
  projection logic and rerun; never hand-edit projected day values.
- Calendar assignment and reducers are deterministic. No LLM, diagnosis, risk inference, or
  user-facing medical interpretation enters S1/S2.
- PDPA/RLS ownership is unchanged: every raw row remains user-owned, and the projection cannot broaden
  access.

## Implementation sequence and acceptance boundary

This ADR unblocks design, not production activation:

1. **S1 provenance/constraint slice:** forward-only migration for local-date/timezone provenance,
   one-watermark semantics, and overlap rejection; rollback/runtime tests; no shared contract change.
2. **Shared/S2 slice:** add `local_day_v1` to TS/Dart/schema parity and generate the local-day branches;
   preserve `utc`; prove watermark, timezone split, half-open boundaries, overlap rejection, malformed
   provenance, and quiet-day absence. This is a `shared/` contract PR and follows its review rule.
3. **Metric/collector activation slice:** select a concrete metric's explicit policy only with a real
   collector that writes the required provenance, then run full product, database, and device evidence.

Issue #220 remains open until the relevant production slices land and are proven. This ADR alone does
not claim that a production event/state metric is visible in `metric_daily_values`.
