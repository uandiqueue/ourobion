// ourobion nao — data-viz colour maps.
//
// The factual dimensions (OA status, retrievability, work type, pipeline status)
// are coloured from the brand coil ramp, exactly as the approved design mock.
// These are FACTS, never quality grades. Pure constants — safe in both Server and
// Client Components. Keep the ramp values in sync with src/lib/theme.css.

const TEAL = '#2bc4be';
const CYAN = '#2fb7d6';
const BLUE = '#3fa2e6';
const INDIGO = '#5e8df0';
const SLATE = '#46606b'; // closed / unknown / no-data
export const MUTED = '#5b727a';

export const OA_COLOR: Record<string, string> = {
  gold: TEAL,
  green: CYAN,
  hybrid: BLUE,
  bronze: INDIGO,
  closed: SLATE,
  unknown: SLATE,
};

export const RETRIEVABILITY_COLOR: Record<string, string> = {
  pdf: TEAL,
  html: BLUE,
  paywalled: INDIGO,
  unknown: SLATE,
};

export const WORKTYPE_COLOR: Record<string, string> = {
  article: BLUE,
  preprint: INDIGO,
  review: CYAN,
};

export const STATUS_COLOR: Record<string, string> = {
  fetched: TEAL,
  discovered: BLUE,
  failed: SLATE,
};

export function oaColor(v: string | null | undefined): string {
  return (v && OA_COLOR[v]) || MUTED;
}
export function retrievabilityColor(v: string | null | undefined): string {
  return (v && RETRIEVABILITY_COLOR[v]) || MUTED;
}
export function workTypeColor(v: string | null | undefined): string {
  return (v && WORKTYPE_COLOR[v]) || MUTED;
}
export function statusColor(v: string | null | undefined): string {
  return (v && STATUS_COLOR[v]) || MUTED;
}

/** Human "X.Y MB" / "N KB" / "≈ N GB" from a byte count. */
export function humanBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  const gb = n / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = n / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Compact human count: 184000000 → "184M", 12480 → "12,480". */
export function humanCount(n: number | null | undefined): string {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  return n.toLocaleString('en-US');
}
