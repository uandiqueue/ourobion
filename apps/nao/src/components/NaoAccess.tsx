'use client';

// ourobion nao — the client half of the viewer read-only UX (R4).
//
// Carries the caller's capability tier down the tree and turns it into "is this
// control usable" via @/lib/naoAccess, which reads @/lib/authz's ROUTE_POLICY
// matrix. A control names the ROUTE it would call — `'POST /api/seeds'` — and
// nothing here knows or names a role, so when a route's required role changes in
// the matrix the UI follows without an edit.
//
// WHERE THE ROLE COMES FROM: the (app) layout resolves it SERVER-side with
// resolveNaoRole() (a fresh `nao_role()` database read per request, never a JWT
// claim) and hands it to <NaoAccessProvider>. It is never re-derived in the
// browser from a cookie, a claim, or a response body — a client that lies to
// itself only re-enables its own buttons, and the server still refuses the call.
//
// PRESENTATION ONLY. Disabling a control is a courtesy so a person is not
// invited to press something that cannot work. It is not an authorization
// boundary and must never be treated as one: every route keeps guardRole() as
// its first statement.
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import type { NaoRole } from '@/lib/authz';
import {
  controlAccess,
  firstBlockedControl,
  type ControlAccess,
  type RouteKey,
} from '@/lib/naoAccess';

/**
 * Defaults to `null` — the fail-closed tier. A control rendered outside the
 * provider therefore reads as unavailable rather than as fully permitted.
 */
const NaoRoleContext = createContext<NaoRole | null>(null);

export function NaoAccessProvider({
  role,
  children,
}: {
  role: NaoRole | null;
  children: ReactNode;
}) {
  return <NaoRoleContext.Provider value={role}>{children}</NaoRoleContext.Provider>;
}

/** The caller's tier as resolved by the server for THIS request. */
export function useNaoRole(): NaoRole | null {
  return useContext(NaoRoleContext);
}

/** Whether the caller may use `route`, and the short reason when they may not. */
export function useControlAccess(route: RouteKey): ControlAccess {
  return controlAccess(useNaoRole(), route);
}

/** Props a gated control spreads onto itself. */
export interface ControlGateProps {
  disabled: boolean;
  title?: string;
}

/**
 * The per-control gate. Returns a function so ONE hook call covers every control
 * in a panel:
 *
 *   const gate = useControlGate();
 *   <button {...gate('POST /api/seeds', busy || label === '')}>Add seed</button>
 *
 * `alsoDisabled` folds in the panel's own reasons (busy, empty form, paused
 * pipeline) so the spread can replace an existing `disabled=` outright rather
 * than fighting it. Spread LAST — a `disabled` written after it would win.
 *
 * The `title` is a convenience only; browsers do not fire hover events on a
 * disabled control, so the reason is also rendered visibly by {@link ControlNote}
 * / {@link ControlScope}. That visible line is the one a person actually reads.
 */
export function useControlGate(): (route: RouteKey, alsoDisabled?: boolean) => ControlGateProps {
  const role = useNaoRole();
  return useCallback(
    (route: RouteKey, alsoDisabled = false): ControlGateProps => {
      const { allowed, reason } = controlAccess(role, route);
      return allowed ? { disabled: alsoDisabled } : { disabled: true, title: reason ?? undefined };
    },
    [role],
  );
}

/** The visible reason line for a section whose controls are gated on `route`. Renders nothing when they are usable. */
export function ControlNote({ route }: { route: RouteKey }) {
  const { allowed, reason } = useControlAccess(route);
  if (allowed) {
    return null;
  }
  return <p className="fmt__cap control-note">{reason}</p>;
}

/**
 * Wrap a region whose controls all call `routes`. A native `<fieldset disabled>`
 * disables every button, input and select inside it — including ones added
 * later, and ones in components this file has never heard of — which is what
 * makes this adoptable by a panel in a single line.
 *
 * Wrap only the MUTATING region: a fieldset does not distinguish a read control
 * from a write one, so putting a refresh button inside would wrongly disable a
 * read the caller is entitled to.
 */
export function ControlScope({
  routes,
  children,
}: {
  routes: readonly RouteKey[];
  children: ReactNode;
}) {
  const blocked = firstBlockedControl(useNaoRole(), routes);
  return (
    <fieldset className="control-scope" disabled={blocked !== null}>
      {children}
      {blocked ? <p className="fmt__cap control-note">{blocked.reason}</p> : null}
    </fieldset>
  );
}
