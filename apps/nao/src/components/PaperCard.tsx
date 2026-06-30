// ourobion nao — PaperCard.
//
// One row in the paginated paper list. Server component: pure presentation of a
// PaperRow (the D1-index projection). Dark surface, glowing 1px border on hover,
// links to the per-paper detail page. NEVER renders or links to full text.
import Link from 'next/link';
import type { PaperRow } from '@/lib/d1';
import { QualityBadge } from '@/components/QualityBadge';

/** Render up to `max` authors, then "+N more". */
function authorLine(authors: string[], max = 4): string {
  if (authors.length === 0) return 'Unknown authors';
  if (authors.length <= max) return authors.join(', ');
  return `${authors.slice(0, max).join(', ')} +${authors.length - max} more`;
}

export function PaperCard({ row }: { row: PaperRow }) {
  const metaBits = [row.venue, row.year !== null ? String(row.year) : null].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );

  return (
    <Link href={`/paper/${encodeURIComponent(row.paperUid)}`} className="paper-card">
      <div className="paper-card__head">
        <h3 className="paper-card__title">{row.title || 'Untitled'}</h3>
        <QualityBadge oaStatus={row.oaStatus} />
      </div>

      <p className="paper-card__authors">{authorLine(row.authors)}</p>

      {metaBits.length > 0 ? (
        <p className="paper-card__meta">{metaBits.join(' · ')}</p>
      ) : null}

      <div className="paper-card__tags">
        {row.workType ? <span className="chip chip--muted">{row.workType}</span> : null}
        {row.topicTags.slice(0, 4).map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
        {row.citedByCount !== null ? (
          <span className="chip chip--metric">{row.citedByCount.toLocaleString()} citations</span>
        ) : null}
      </div>
    </Link>
  );
}
