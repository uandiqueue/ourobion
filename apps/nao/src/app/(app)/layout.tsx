// ourobion nao — authenticated shell layout.
//
// Wraps the Overview / Papers / Detail routes with the persistent top bar +
// sub-nav. The /login route lives OUTSIDE this group, so it renders bare (no
// shell). Access is enforced by src/middleware.ts before any of these render.
import type { ReactNode } from 'react';
import { TopBar } from '@/components/TopBar';
import { SubNav } from '@/components/SubNav';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <TopBar />
      <SubNav />
      <main className="shell__main">{children}</main>
    </div>
  );
}
