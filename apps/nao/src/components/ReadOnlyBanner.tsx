// ourobion nao — the read-only notice at the top of the console (R4).
//
// Server Component (no 'use client'): the (app) layout already resolved the
// caller's tier from the database for this request, so the banner is decided
// server-side and shipped as plain markup.
//
// It renders ONLY for a caller who cannot change anything — asked of the route
// matrix by isReadOnlyRole(), not by comparing against the string 'viewer'. A
// curator or admin sees nothing at all, because a notice that everyone sees
// stops being read.
import { isReadOnlyRole, READ_ONLY_BANNER_BODY, READ_ONLY_BANNER_LABEL } from '@/lib/naoAccess';
import type { NaoRole } from '@/lib/authz';

export function ReadOnlyBanner({ role }: { role: NaoRole | null }) {
  if (!isReadOnlyRole(role)) {
    return null;
  }
  return (
    <div className="access-banner" role="status">
      <span className="eyebrow access-banner__label">{READ_ONLY_BANNER_LABEL}</span>
      <p className="access-banner__body">{READ_ONLY_BANNER_BODY}</p>
    </div>
  );
}
