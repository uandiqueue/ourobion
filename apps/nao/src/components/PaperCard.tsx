// ourobion nao — PaperCard (server component).
//
// One row in the paginated paper list. Pure presentation of a PaperRow (the
// D1-index projection): topic eyebrow, title, byline, factual chips (OA status,
// retrievability, work type, pipeline status — coloured FACTS, never a quality
// grade), the extraction marker, citation count + topic tags, and the DOI.
// Links to the per-paper detail page. NEVER renders or links to full text.
import Link from 'next/link';
import type { PaperRow } from '@/lib/d1';
import { oaColor, retrievabilityColor, workTypeColor, statusColor } from '@/lib/palette';

function byline(row: PaperRow): string {
  const lead =
    row.authors.length === 0
      ? 'Unknown authors'
      : row.authors.length === 1
        ? row.authors[0]
        : `${row.authors[0]} et al.`;
  return [lead, row.year !== null ? String(row.year) : null, row.venue]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ');
}

function FactChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="fact-chip">
      <span className="fact-chip__dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export function PaperCard({ row }: { row: PaperRow }) {
  const primaryTopic = row.topicTags[0] ?? row.workType ?? 'paper';
  const extractLabel = row.fullTextExtracted
    ? `text ✓ · ${row.fullTextMethod ?? 'ok'}`
    : 'no text';

  return (
    <Link href={`/paper/${encodeURIComponent(row.paperUid)}`} className="pcard">
      <div className="pcard__head">
        <div className="pcard__main">
          <div className="pcard__topic">{primaryTopic}</div>
          <h3 className="pcard__title">{row.title || 'Untitled'}</h3>
          <div className="pcard__byline">{byline(row)}</div>
          <div className="pcard__chips">
            <FactChip label={row.oaStatus} color={oaColor(row.oaStatus)} />
            <FactChip label={row.retrievability} color={retrievabilityColor(row.retrievability)} />
            {row.workType ? (
              <FactChip label={row.workType} color={workTypeColor(row.workType)} />
            ) : null}
            <FactChip label={row.status} color={statusColor(row.status)} />
            <span
              className="pcard__extract"
              style={{
                color: row.fullTextExtracted ? 'var(--accent-1)' : 'var(--text-ghost)',
              }}
            >
              {extractLabel}
            </span>
          </div>
        </div>

        <div className="pcard__aside">
          {row.citedByCount !== null ? (
            <div className="pcard__cited">
              <div className="pcard__cited-num">{row.citedByCount.toLocaleString()}</div>
              <div className="pcard__cited-cap">cited</div>
            </div>
          ) : (
            <span />
          )}
          {row.topicTags.length > 0 ? (
            <div className="pcard__tags">
              {row.topicTags.slice(0, 3).map((t) => (
                <span key={t} className="pcard__tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {row.doi ? <div className="pcard__foot">{row.doi}</div> : null}
    </Link>
  );
}
