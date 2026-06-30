// ourobion nao — Papers list (v1). Search · facets · sort · paginate.
//
// Server component. Reads the D1/FTS5 index (NEVER R2 per request, NEVER full
// text) for a filtered/paginated page of papers + whole-corpus facet counts.
// Everything is driven by URL search params so each view is shareable and the
// server re-queries D1 on navigation.
//
// MUST be dynamic: it touches the D1 binding via getCloudflareContext().
import type { Metadata } from 'next';
import Link from 'next/link';
import { searchPapers, facetCounts } from '@/lib/d1';
import type { SearchFilters, SortKey } from '@/lib/d1';
import { SearchBar } from '@/components/SearchBar';
import { SortSelect } from '@/components/SortSelect';
import { ActiveChips } from '@/components/ActiveChips';
import { Facets } from '@/components/Facets';
import { PaperCard } from '@/components/PaperCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Papers · ourobion nao',
  description: 'Search and filter the ourobion paper corpus.',
};

type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

function pageOf(v: string | string[] | undefined): number {
  const s = one(v);
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const SORT_KEYS: ReadonlySet<string> = new Set(['citedByCount', 'year', 'title', 'fetchedAt']);
function sortOf(v: string | string[] | undefined): SortKey | undefined {
  const s = one(v);
  return s !== undefined && SORT_KEYS.has(s) ? (s as SortKey) : undefined;
}

/** Map URL params → D1 SearchFilters (param names mirror src/lib/facets.ts). */
function filtersFrom(params: RawParams): SearchFilters {
  const filters: SearchFilters = {};
  const oa = one(params.oa);
  const retr = one(params.retr);
  const type = one(params.type);
  const topic = one(params.topic);
  const status = one(params.status);
  const via = one(params.via);
  const method = one(params.method);

  if (oa !== undefined) filters.oaStatus = oa;
  if (retr !== undefined) filters.retrievability = retr;
  if (type !== undefined) filters.workType = type;
  if (topic !== undefined) filters.topicTag = topic;
  if (status !== undefined) filters.status = status;
  if (via !== undefined) filters.discoveredVia = via;
  if (method !== undefined) filters.method = method;
  return filters;
}

const PAGE_SIZE = 20;

export default async function PapersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const page = pageOf(params.page);
  const sort = sortOf(params.sort);
  const filters = filtersFrom(params);

  const [result, facets] = await Promise.all([
    searchPapers({ q, filters, page, pageSize: PAGE_SIZE, sort }),
    facetCounts(),
  ]);

  const { rows, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Whole-corpus size: every paper has a (non-null) status, so the status facet
  // sums to the full indexed count regardless of the active filters.
  const corpusTotal = facets.status.reduce((sum, b) => sum + b.count, 0) || total;

  const linkFor = (targetPage: number): string => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === 'page') continue;
      const val = one(v);
      if (val !== undefined) next.set(k, val);
    }
    if (targetPage > 1) next.set('page', String(targetPage));
    const qs = next.toString();
    return qs ? `/papers?${qs}` : '/papers';
  };

  return (
    <div className="papers">
      <Facets facets={facets} />

      <section aria-label="Papers">
        <div className="papers__toolbar">
          <SearchBar />
          <SortSelect />
        </div>

        <div className="papers__meta">
          <span className="papers__count">
            <b>{total.toLocaleString()}</b> of {corpusTotal.toLocaleString()} papers
          </span>
          <ActiveChips />
        </div>

        {rows.length === 0 ? (
          <p className="papers__empty">No papers match these filters.</p>
        ) : (
          <div className="paperlist">
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
  );
}
