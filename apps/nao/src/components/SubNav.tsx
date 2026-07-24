'use client';

// ourobion nao — sub navigation (Client Component).
//
// Overview / Papers tabs with an active state derived from the pathname (the
// per-paper detail route counts as "Papers"). The right side shows a quiet
// "corpus index" status light — purely ambient.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: ReadonlyArray<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: '/', label: 'Overview', match: (p) => p === '/' },
  {
    href: '/papers',
    label: 'Papers',
    match: (p) => p === '/papers' || p.startsWith('/papers/') || p.startsWith('/paper/'),
  },
  { href: '/ingest', label: 'Ingestion', match: (p) => p === '/ingest' || p.startsWith('/ingest/') },
  { href: '/loader', label: 'Data Loader', match: (p) => p === '/loader' || p.startsWith('/loader/') },
  { href: '/models', label: 'Models', match: (p) => p === '/models' || p.startsWith('/models/') },
  { href: '/claims', label: 'Claims', match: (p) => p === '/claims' || p.startsWith('/claims/') },
];

export function SubNav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="subnav" aria-label="Sections">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`subnav__item ${active ? 'subnav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
      <span className="subnav__spacer" />
      <span className="subnav__status">CORPUS INDEX</span>
      <span className="subnav__dot" aria-hidden />
    </nav>
  );
}
