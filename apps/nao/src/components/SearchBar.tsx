'use client';

// ourobion nao — SearchBar (Client Component).
//
// An interactive search box that drives the dashboard via URL search params. On
// submit it pushes `?q=...` (preserving any active facet filters, resetting to
// page 1) so the server component re-queries D1/FTS5. The actual search runs
// server-side; this is just the control.
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('q') ?? '';
  const [value, setValue] = useState(current);

  // Keep the input in sync if the URL changes from elsewhere (e.g. a facet click
  // that preserves q, or back/forward navigation).
  useEffect(() => {
    setValue(current);
  }, [current]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();
    if (trimmed) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }
    params.delete('page'); // new query → back to page 1
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  function clear() {
    setValue('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  return (
    <form onSubmit={submit} role="search" className="searchbar">
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title, author, topic, concept…"
        aria-label="Search the corpus"
        className="searchbar__input"
      />
      {value ? (
        <button type="button" onClick={clear} className="searchbar__clear" aria-label="Clear search">
          ×
        </button>
      ) : null}
      <button type="submit" className="searchbar__submit">
        Search
      </button>
    </form>
  );
}
