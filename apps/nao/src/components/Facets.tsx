'use client';

// ourobion nao — Facets (Client Component).
//
// Renders the facet filter rail from server-computed FacetCounts. Each bucket is
// a toggle: clicking sets (or clears) the matching URL search param, resets to
// page 1, and navigates so the server component re-queries D1. Active buckets get
// the cyan high-state + glow. Search text (`q`) is always preserved.
//
// URL param ↔ SearchFilters mapping (see app/page.tsx):
//   oa=<oaStatus> · retr=<retrievability> · type=<workType> · year=<year> · topic=<topicTag>
import { useRouter, useSearchParams } from 'next/navigation';
import type { FacetBucket, FacetCounts } from '@/lib/d1';

/** The five facet dimensions, in display order, with their URL param + label. */
const DIMENSIONS: ReadonlyArray<{
  key: keyof FacetCounts;
  param: string;
  label: string;
}> = [
  { key: 'oaStatus', param: 'oa', label: 'OA status' },
  { key: 'retrievability', param: 'retr', label: 'Retrievability' },
  { key: 'workType', param: 'type', label: 'Work type' },
  { key: 'year', param: 'year', label: 'Year' },
  { key: 'topicTags', param: 'topic', label: 'Topic tags' },
];

/** Max buckets shown per dimension before collapsing the long tail. */
const BUCKET_LIMIT = 8;

export function Facets({ facets }: { facets: FacetCounts }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(next: URLSearchParams) {
    next.delete('page'); // any facet change → page 1
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  function toggle(param: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (next.get(param) === value) {
      next.delete(param);
    } else {
      next.set(param, value);
    }
    navigate(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) next.set('q', q); // keep the search text, drop every facet + page
    navigate(next);
  }

  const anyActive = DIMENSIONS.some((d) => searchParams.get(d.param) !== null);

  return (
    <aside className="facets" aria-label="Filters">
      <div className="facets__head">
        <span className="eyebrow">Filters</span>
        {anyActive ? (
          <button type="button" className="facets__clear" onClick={clearAll}>
            Clear all
          </button>
        ) : null}
      </div>

      {DIMENSIONS.map((dim) => {
        const buckets: FacetBucket[] = facets[dim.key] ?? [];
        if (buckets.length === 0) return null;
        const active = searchParams.get(dim.param);
        // Year reads better newest-first; the rest stay count-ordered from D1.
        const ordered =
          dim.key === 'year'
            ? [...buckets].sort((a, b) => Number(b.value) - Number(a.value))
            : buckets;
        const shown = ordered.slice(0, BUCKET_LIMIT);

        return (
          <div key={dim.param} className="facets__group">
            <h4 className="facets__group-title">{dim.label}</h4>
            <ul className="facets__list">
              {shown.map((b) => {
                const isActive = active === b.value;
                return (
                  <li key={b.value}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      className={`facet ${isActive ? 'facet--active' : ''}`}
                      onClick={() => toggle(dim.param, b.value)}
                    >
                      <span className="facet__value">{b.value}</span>
                      <span className="facet__count">{b.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
