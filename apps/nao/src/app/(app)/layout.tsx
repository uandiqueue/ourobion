// ourobion nao — authenticated shell layout.
//
// Wraps the Overview / Papers / Detail routes with the persistent top bar +
// sub-nav. The /login route lives OUTSIDE this group, so it renders bare (no
// shell). Access is enforced by src/middleware.ts before any of these render.
//
// R4 viewer read-only UX: this layout is the ONE place the caller's capability
// tier enters the browser. It is read here with resolveNaoRole() — a fresh
// `nao_role()` database read on every request, never a JWT claim (see
// src/lib/authzServer.ts for why) — then handed to <ReadOnlyBanner> and to
// <NaoAccessProvider>, which is what lets a control ask whether the server would
// accept the call it makes. Client components never re-derive the tier from
// anything they hold; see src/components/NaoAccess.tsx.
//
// `force-dynamic` because that read touches request cookies: without it the
// statically-shelled pages in this group (/ingest, /claims, /models,
// /brain-pipeline) would be prerendered at build time, when there is no caller
// and therefore no tier — which would bake one visitor's banner state into
// everyone's HTML.
import type { ReactNode } from 'react';
import { TopBar } from '@/components/TopBar';
import { SubNav } from '@/components/SubNav';
import { NaoAccessProvider } from '@/components/NaoAccess';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { resolveNaoRole } from '@/lib/authzServer';

export const dynamic = 'force-dynamic';

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const role = await resolveNaoRole();
  return (
    <div className="shell">
      <TopBar />
      <SubNav />
      <ReadOnlyBanner role={role} />
      <NaoAccessProvider role={role}>
        <main className="shell__main">{children}</main>
      </NaoAccessProvider>
    </div>
  );
}
