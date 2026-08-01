'use client';

// ourobion nao — top bar (Client Component).
//
// Brand mark (→ Overview), a global corpus search that routes to
// /papers?q=…, and the signed-in identity + sign-out. The email is read from the
// browser Supabase session (getUser) so we don't have to thread it through the
// server layout; sign-out clears the session and bounces to /login.
//
// Brand: /brand/nao-mark-dark.svg (the knowledge-graph nucleus mark) at a
// fixed 40px — see the "40px rule" comment in shell.css. Its alt text is the
// button's sole accessible name and includes the destination; there is no
// reconstructed HTML wordmark or competing button aria-label.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export function TopBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active && data.user?.email) setEmail(data.user.email);
      })
      .catch(() => {
        /* unauthenticated reads are a no-op here; the middleware gates access */
      });
    return () => {
      active = false;
    };
  }, []);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/papers?q=${encodeURIComponent(q)}` : '/papers');
  }

  async function signOut() {
    try {
      await createBrowserClient().auth.signOut();
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        onClick={() => router.push('/overview')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="topbar__mark" src="/brand/nao-mark-dark.svg" alt="ourobion nao — Overview" />
      </button>

      <div className="topbar__searchwrap">
        <form className="topbar__search" role="search" onSubmit={onSearch}>
          <span className="topbar__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the corpus — title, author, concept…"
            aria-label="Search the corpus"
          />
          <span className="topbar__kbd" aria-hidden>
            ⏎
          </span>
        </form>
      </div>

      <div className="topbar__right">
        {email ? <span className="topbar__email">{email}</span> : null}
        <button type="button" className="topbar__signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
