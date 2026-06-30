// ourobion nao — QualityBadge.
//
// v1 quality signal: derived from a paper's OA status + (optionally) its citation
// count — the corpus-level markers available today. The edge-level evidenceTier /
// servingBand markers from the brain contract are a v2 concern (NAO-DESIGN §6) and
// are deliberately NOT used here.
//
// Visual grammar (NAO-DESIGN §7): a small pill with a glowing 1px border. OA
// papers (gold/green/hybrid/bronze) read as "open" in the cyan high-state; closed
// reads muted; unknown reads mid/amber.
import type { CSSProperties } from 'react';
import type { OaStatus } from '@/lib/types';

/** OA statuses that count as openly retrievable (any OA tier). */
const OPEN_STATUSES: ReadonlySet<OaStatus> = new Set<OaStatus>([
  'gold',
  'green',
  'hybrid',
  'bronze',
]);

type Tone = 'high' | 'mid' | 'hold';

function toneForOa(status: OaStatus): Tone {
  if (OPEN_STATUSES.has(status)) return 'high';
  if (status === 'closed') return 'hold';
  return 'mid'; // unknown
}

const TONE_COLOR: Record<Tone, string> = {
  high: 'var(--state-high)',
  mid: 'var(--state-mid)',
  hold: 'var(--state-hold)',
};

function label(status: OaStatus): string {
  switch (status) {
    case 'gold':
      return 'OA · gold';
    case 'green':
      return 'OA · green';
    case 'hybrid':
      return 'OA · hybrid';
    case 'bronze':
      return 'OA · bronze';
    case 'closed':
      return 'Closed';
    case 'unknown':
    default:
      return 'OA unknown';
  }
}

export function QualityBadge({
  oaStatus,
  style,
}: {
  oaStatus: OaStatus;
  style?: CSSProperties;
}) {
  const tone = toneForOa(oaStatus);
  const color = TONE_COLOR[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.18rem 0.55rem',
        borderRadius: '999px',
        border: `1px solid ${color}`,
        boxShadow: `0 0 8px ${color}33`,
        color,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: '0.45rem',
          height: '0.45rem',
          borderRadius: '999px',
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {label(oaStatus)}
    </span>
  );
}
