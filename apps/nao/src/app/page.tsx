// ourobion nao — corpus dashboard (v1).
//
// Server component. Reads the D1/FTS5 index (NEVER R2 per request, NEVER full
// text) for: the total paper count, faceted search, and a paginated paper list.
// Search + facets are driven entirely by URL search params, so every view is
// shareable/bookmarkable and the server re-queries D1 on each navigation.
//
// MUST be dynamic: it touches the D1 binding via getCloudflareContext(), so we
// force-dynamic to keep `next build` from executing the binding at build time.
import type { Metadata } from 'next';
import Link from 'next/link';
import { searchPapers, facetCounts } from '@/lib/d1';
import type { SearchFilters } from '@/lib/d1';
import { EyebrowLabel } from '@/components/EyebrowLabel';
import { SearchBar } from '@/components/SearchBar';
import { Facets } from '@/components/Facets';
import { PaperCard } from '@/components/PaperCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Corpus · ourobion nao',
  description: 'Inspect the ourobion paper corpus — count, search, facets.',
};

/** Next 15 delivers searchParams as a Promise of string | string[] | undefined. */
type RawParams = Record<string, string | string[] | undefined>;

/** First value of a (possibly repeated) search param, trimmed; undefined if empty. */
function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

/** Parse a positive integer param (page); falls back to 1 on bad input. */
function pageOf(v: string | string[] | undefined): number {
  const s = one(v);
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Map the URL params to the D1 SearchFilters shape (see Facets.tsx for the keys). */
function filtersFrom(params: RawParams): SearchFilters {
  const filters: SearchFilters = {};
  const oa = one(params.oa);
  const retr = one(params.retr);
  const type = one(params.type);
  const topic = one(params.topic);
  const yearStr = one(params.year);

  if (oa !== undefined) filters.oaStatus = oa;
  if (retr !== undefined) filters.retrievability = retr;
  if (type !== undefined) filters.workType = type;
  if (topic !== undefined) filters.topicTag = topic;
  if (yearStr !== undefined) {
    const y = Number.parseInt(yearStr, 10);
    if (Number.isFinite(y)) filters.year = y;
  }
  return filters;
}

const PAGE_SIZE = 25;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const page = pageOf(params.page);
  const filters = filtersFrom(params);

  // Two reads: the filtered/paginated result set, and the whole-corpus facet
  // counts (facets reflect the full index so users can always pivot).
  const [result, facets] = await Promise.all([
    searchPapers({ q, filters, page, pageSize: PAGE_SIZE }),
    facetCounts(),
  ]);

  const { rows, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastIndex = Math.min(total, page * PAGE_SIZE);

  // Build prev/next hrefs that preserve q + every active facet.
  const linkFor = (targetPage: number): string => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    for (const [k, v] of Object.entries(params)) {
      if (k === 'q' || k === 'page') continue;
      const val = one(v);
      if (val !== undefined) next.set(k, val);
    }
    if (targetPage > 1) next.set('page', String(targetPage));
    const qs = next.toString();
    return qs ? `/?${qs}` : '/';
  };

  return (
    <main className="dash">
      <header className="dash__header">
        <div>
          <EyebrowLabel>Ourobion · brain inspection</EyebrowLabel>
          <h1 className="dash__title">Corpus</h1>
        </div>
        <div className="dash__count">
          <span className="dash__count-num">{total.toLocaleString()}</span>
          <span className="dash__count-label">
            {q || Object.keys(filters).length > 0 ? 'papers matched' : 'papers ingested'}
          </span>
        </div>
      </header>

      <SearchBar />

      <div className="dash__body">
        <Facets facets={facets} />

        <section aria-label="Papers">
          <p className="dash__resultmeta">
            {total === 0
              ? 'No papers match the current filters.'
              : `Showing ${firstIndex.toLocaleString()}–${lastIndex.toLocaleString()} of ${total.toLocaleString()}`}
          </p>

          {rows.length === 0 ? (
            <div className="empty">
              <div className="empty__ring" aria-hidden />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                Nothing here yet
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Adjust the search or clear a filter to widen the results.
              </p>
            </div>
          ) : (
            <div className="paper-list">
              {rows.map((row) => (
                <PaperCard key={row.paperUid} row={row} />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="pager" aria-label="Pagination">
              {page > 1 ? (
                <Link className="pager__link" href={linkFor(page - 1)} rel="prev">
                  ← Prev
                </Link>
              ) : (
                <span className="pager__link" aria-disabled="true">
                  ← Prev
                </span>
              )}
              <span className="pager__status">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link className="pager__link" href={linkFor(page + 1)} rel="next">
                  Next →
                </Link>
              ) : (
                <span className="pager__link" aria-disabled="true">
                  Next →
                </span>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
