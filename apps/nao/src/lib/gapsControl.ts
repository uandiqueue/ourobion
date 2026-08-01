// ourobion nao — knowledge-gap surfacing helpers (O9 demo slice / feature (d), run-2 U11).
//
// Pure, IO-free logic for the /ingest "Knowledge gaps" section and the
// /api/gaps route (nao's ingestControl/seedsControl convention: route handlers
// are IO glue over unit-tested pure functions).
//
// The read surface is the A1 gap_ledger (migration 20260724090000): aggregate
// per-pair records of WHY a candidate metric pair is not served — the demand
// signal for gap-driven research. This slice is DETECTION + SURFACING only:
// biotope detects the gap, the ledger records it (U4), nao SHOWS it here. The
// autonomous gap→research→verify loop (A3 queue, dispatch, ranking, auto-
// research) stays gated on B5 + U16 — nothing in this module acts on a gap.
// The only bridge is a HUMAN one: "Add as seed" prefills the O14 manual seed
// form with a label derived from the pair.
//
// PRIVACY (§A1 / O9 locked): the ledger's demand is an aggregate fire-count
// with NO user ids; the RLS SELECT policy exposes scope='aggregate' rows only,
// and the route re-asserts that filter. Nothing here is per-user data.
//
// HONESTY: status labels describe RESEARCH COVERAGE of a metric pair — what
// the knowledge graph does or doesn't hold — never anything diagnostic or
// medical about a person.

/** The eight §A1 gap_ledger statuses (mirrors the table CHECK, hand-synced). */
export const GAP_LEDGER_STATUSES = [
  'served',
  'edge-below-band',
  'personal-signal-no-edge',
  'lit-candidate-no-edge',
  'personal-null',
  'blocked-completeness',
  'needs-review',
  'retrieval-exhausted',
] as const;

export type GapLedgerStatus = (typeof GAP_LEDGER_STATUSES)[number];

/**
 * Plain-language label per §A1 status. Each describes the research-coverage
 * state of a metric PAIR (edges, literature, data sufficiency) — deliberately
 * no diagnostic/medical language.
 */
export const GAP_STATUS_LABELS: Record<GapLedgerStatus, string> = {
  served: 'Served — a verified research edge covers this pair',
  'edge-below-band': 'Research edge exists but sits below the serving band',
  'personal-signal-no-edge': 'Personal pattern found, no research edge',
  'lit-candidate-no-edge': 'Literature candidate, no verified edge yet',
  'personal-null': 'Pair evaluated — no strong personal pattern, no research edge',
  'blocked-completeness': 'Research context blocked on data completeness',
  'needs-review': 'Contradictory evidence — needs review',
  'retrieval-exhausted': 'Literature retrieval exhausted without a verified edge',
};

/** Label for a status; unknown values (future statuses) fall back to the raw string. */
export function gapStatusLabel(status: string): string {
  return (GAP_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/** Metric-key tokens rendered as acronyms instead of lowercase words. */
const METRIC_ACRONYM_TOKENS: Record<string, string> = {
  hrv: 'HRV',
  sdnn: 'SDNN',
  rhr: 'RHR',
  rmssd: 'RMSSD',
  co2: 'CO2',
};

/**
 * Human-readable form of a registry metric key: underscores become spaces and
 * known acronym tokens are upper-cased (`hrv_sdnn_ms` → "HRV SDNN ms").
 */
export function humanizeMetricKey(key: string): string {
  return key
    .split('_')
    .filter((t) => t !== '')
    .map((t) => METRIC_ACRONYM_TOKENS[t] ?? t)
    .join(' ');
}

/**
 * Seed label the "Add as seed" bridge prefills into the O14 form, derived from
 * the gap's metric pair (e.g. "HRV SDNN ms and sleep duration min"). The seed
 * stays a discovery TOPIC — deriveSeedSlug turns this into a plain topic slug;
 * it never becomes a C9 candidate pair.
 */
export function deriveGapSeedLabel(metricA: string, metricB: string): string {
  return `${humanizeMetricKey(metricA)} and ${humanizeMetricKey(metricB)}`;
}

/** gap_ledger columns the surface reads (aggregate rows only). */
export interface GapLedgerRow {
  metric_a: string;
  metric_b: string;
  status: string;
  demand: number;
  completeness: number | string | null;
  lit_candidate: unknown;
  last_status_change: string;
}

/** One rendered row of the Knowledge gaps table. */
export interface GapViewRow {
  metricA: string;
  metricB: string;
  pairLabel: string;
  status: string;
  statusLabel: string;
  demand: number;
  lastStatusChange: string;
  /** Compact orientation/context from lit_candidate + completeness, or null. */
  context: string | null;
  /** Prefill label for the human "Add as seed" bridge. */
  seedLabel: string;
}

/**
 * Compact context string from a row's `lit_candidate` jsonb + `completeness`:
 * edge presence (with serving band when known), orientation when the writer
 * recorded one (O16 object-only), completeness when present. Null when there
 * is nothing to say.
 */
export function describeGapContext(
  litCandidate: unknown,
  completeness: number | string | null,
): string | null {
  const parts: string[] = [];
  if (litCandidate !== null && typeof litCandidate === 'object' && !Array.isArray(litCandidate)) {
    const lit = litCandidate as Record<string, unknown>;
    if (lit.hasEdge === true) {
      parts.push(
        typeof lit.servingBand === 'string'
          ? `edge in read store (band: ${lit.servingBand})`
          : 'edge in read store',
      );
    } else if (lit.hasEdge === false) {
      parts.push('no edge in read store');
    }
    if (typeof lit.orientation === 'string') {
      parts.push(`orientation: ${lit.orientation}`);
    }
  }
  const c = completeness === null || completeness === undefined ? NaN : Number(completeness);
  if (Number.isFinite(c)) {
    parts.push(`completeness ${c.toFixed(2)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Deterministic table order: demand DESC (the ledger's whole point is that
 * demand ranks the gaps), then the pair ascending as a stable tie-break.
 */
export function compareGapDemand(a: GapLedgerRow, b: GapLedgerRow): number {
  if (a.demand !== b.demand) return b.demand - a.demand;
  if (a.metric_a !== b.metric_a) return a.metric_a < b.metric_a ? -1 : 1;
  if (a.metric_b !== b.metric_b) return a.metric_b < b.metric_b ? -1 : 1;
  return 0;
}

/** Shape ledger rows for the table: sorted by {@link compareGapDemand}, labeled. */
export function shapeGapRows(rows: readonly GapLedgerRow[]): GapViewRow[] {
  return [...rows].sort(compareGapDemand).map((r) => ({
    metricA: r.metric_a,
    metricB: r.metric_b,
    pairLabel: `${humanizeMetricKey(r.metric_a)} × ${humanizeMetricKey(r.metric_b)}`,
    status: r.status,
    statusLabel: gapStatusLabel(r.status),
    demand: r.demand,
    lastStatusChange: r.last_status_change,
    context: describeGapContext(r.lit_candidate, r.completeness),
    seedLabel: deriveGapSeedLabel(r.metric_a, r.metric_b),
  }));
}

/** Page size for the gaps read — "showing top N" is stated honestly in the UI. */
export const GAPS_PAGE_SIZE = 50;
