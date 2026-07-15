'use client';

// ourobion nao — Papers search box (Client Component).
//
// The in-page search on /papers. On submit it pushes ?q=… (preserving active
// facets + sort, resetting to page 1) so the server component re-queries
// D1/FTS5. Search runs server-side; this is just the control.
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('q') ?? '';
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/papers?${qs}` : '/papers');
  }

  return (
    <form className="searchbox" role="search" onSubmit={submit}>
      <span className="searchbox__icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title, authors, concepts, topic tags…"
        aria-label="Search the corpus"
      />
    </form>
  );
}
