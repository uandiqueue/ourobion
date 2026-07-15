'use client';

// ourobion nao — active filter chips (Client Component).
//
// Lists the currently-applied facet values as removable pills (one per active
// facet param), plus a "Clear all" that drops every facet but keeps the search
// text + sort. Renders nothing when no facet is active.
import { useRouter, useSearchParams } from 'next/navigation';
import { FACET_PARAMS } from '@/lib/facets';

export function ActiveChips() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active = FACET_PARAMS.flatMap((param) => {
    const value = searchParams.get(param);
    return value ? [{ param, value }] : [];
  });

  if (active.length === 0) return null;

  function go(next: URLSearchParams) {
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/papers?${qs}` : '/papers');
  }

  function remove(param: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    go(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const q = searchParams.get('q');
    const sort = searchParams.get('sort');
    if (q) next.set('q', q);
    if (sort) next.set('sort', sort);
    go(next);
  }

  return (
    <>
      <span className="papers__meta-divider" />
      {active.map(({ param, value }) => (
        <button key={param} type="button" className="activechip" onClick={() => remove(param)}>
          {value}
          <span className="activechip__x" aria-hidden>
            ×
          </span>
        </button>
      ))}
      <button type="button" className="papers__clear" onClick={clearAll}>
        Clear all
      </button>
    </>
  );
}
