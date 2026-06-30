'use client';

// ourobion nao — facet rail (Client Component).
//
// Renders the seven facet dimensions (FACET_DIMS) from server-computed
// FacetCounts. Each value is a single-select toggle: clicking sets (or clears)
// its URL search param, resets to page 1, and navigates so the /papers server
// component re-queries D1. Search text (q) and sort are preserved. Single-select
// per dimension matches the D1 equality filters (one value per dimension).
import { useRouter, useSearchParams } from 'next/navigation';
import type { FacetBucket, FacetCounts } from '@/lib/d1';
import { FACET_DIMS } from '@/lib/facets';

/** Max buckets shown per dimension before collapsing the long tail. */
const BUCKET_LIMIT = 10;

export function Facets({ facets }: { facets: FacetCounts }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggle(param: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (next.get(param) === value) {
      next.delete(param);
    } else {
      next.set(param, value);
    }
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/papers?${qs}` : '/papers');
  }

  return (
    <aside className="facetrail" aria-label="Filters">
      {FACET_DIMS.map((dim) => {
        const buckets: FacetBucket[] = facets[dim.key] ?? [];
        if (buckets.length === 0) return null;
        const active = searchParams.get(dim.param);
        const shown = buckets.slice(0, BUCKET_LIMIT);
        return (
          <div key={dim.param} className="facetgroup">
            <div className="facetgroup__title">{dim.label}</div>
            <ul className="facetgroup__list">
              {shown.map((b) => {
                const on = active === b.value;
                return (
                  <li key={b.value}>
                    <button
                      type="button"
                      aria-pressed={on}
                      className={`facetopt ${on ? 'facetopt--on' : ''}`}
                      onClick={() => toggle(dim.param, b.value)}
                    >
                      <span className="facetopt__box" aria-hidden>
                        {on ? '✓' : ''}
                      </span>
                      <span className="facetopt__label">{b.value}</span>
                      <span className="facetopt__count">{b.count.toLocaleString()}</span>
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
