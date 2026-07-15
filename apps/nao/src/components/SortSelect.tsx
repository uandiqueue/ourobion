'use client';

// ourobion nao — sort control for the Papers list (Client Component).
// Changing the order sets ?sort=… (preserving q + facets) and navigates.
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';

const OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'citedByCount', label: 'Most cited' },
  { value: 'year', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'fetchedAt', label: 'Recently fetched' },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('sort') ?? 'citedByCount';

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const v = e.target.value;
    if (v && v !== 'citedByCount') params.set('sort', v);
    else params.delete('sort');
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/papers?${qs}` : '/papers');
  }

  return (
    <div className="sortwrap">
      <span className="sortwrap__label">Sort</span>
      <select className="sortselect" value={current} onChange={onChange} aria-label="Sort papers">
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
