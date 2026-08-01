// ourobion nao — ingestion control SETTINGS API (pause, budget).
//
// GET  → the current control/ingest-config.json (or DEFAULT_INGEST_CONTROL if
//        none exists yet).
// POST → validate + merge a settings patch (paused, openalexDailyUsd) over the
//        current document and persist it (see lib/ingestControl.ts's
//        validatePatchBody/applyIngestControlPatch for the pure logic — this
//        handler is just I/O + auth glue).
//
// Triggering an actual run is a SEPARATE endpoint: POST /api/ingest-control/trigger
// (it calls out to GitHub, not just R2).
//
// AUTH (R4-U2 fix): this control document lives in R2/D1, not Postgres, so it
// has no RLS to fall back on — before R4-U2, BOTH handlers relied solely on
// src/middleware.ts's "any authenticated user" gate, with zero re-check in
// the handler itself. That is exactly the "middleware as the only enforcement
// layer" defect this unit closes: GET now requires `viewer`, POST requires
// `admin` (pause/budget IS policy-and-money, the admin tier's job per the
// R4-U2 design §A.1) via requireRole()/guardRole() (apps/nao/src/lib/
// authzServer.ts), which independently calls the `nao_role()` database
// function — so even a direct call to this route bypassing middleware (there
// is none, but the guard no longer depends on that being true) is denied.
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement of
// POST, before `req.json()` and before validatePatchBody. It used to run after
// validation, which handed a non-member a 400-vs-403 schema oracle: an
// authenticated Biotope-only account could map this endpoint's request schema
// (and the validator's exact messages) without any nao access at all.
//
// RESPONSE REDACTION (R4-U2 review finding 3): the control document stamps
// `updatedBy` with the acting admin's EMAIL ADDRESS (see currentUserEmail()
// below and lib/ingestControl.ts:46,96), and both handlers returned it to any
// nao `viewer`. Both now return `redactDeep(...)`, which drops `updatedBy`
// (`updatedBy` folds to the same canonical key as `updated_by` — see
// authz.ts's isDenyKey) and scrubs email-shaped values generally. Who changed
// the setting is recorded in the admin-only public.nao_control_events log
// instead (recordControlEvent below), which is exactly what
// 20260728010002_nao_redaction_grants.sql's column comments claim.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  NaoControlAuditError,
  NaoControlOutcomeUnknownError,
  controlAuditErrorResponse,
  controlOperationId,
  controlOutcomeUnknownErrorResponse,
  guardRole,
  redactDeep,
  runAuditedControlMutation,
} from '@/lib/authzServer';
import { getIngestControl, putIngestControl, validatePatchBody, applyIngestControlPatch } from '@/lib/ingestControl';
import type { IngestControlPatch } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function currentUserEmail(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.email ?? session?.user?.id ?? 'unknown';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const control = await getIngestControl();
  return json(redactDeep(control));
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('admin');
  if (!gate.ok) return gate.response;

  let body: IngestControlPatch;
  try {
    body = (await req.json()) as IngestControlPatch;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const validationError = validatePatchBody(body);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const email = await currentUserEmail();
  const now = new Date().toISOString();
  const current = await getIngestControl();
  const next = applyIngestControlPatch(current, body, email, now);

  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    await runAuditedControlMutation({
      operationId: operation.operationId,
      action: 'ingest_control.patch',
      target: 'ingest-control',
      detail: { paused: body.paused, openalexDailyUsd: body.openalexDailyUsd },
      mutate: async () => putIngestControl(next),
    });
    return json(redactDeep({ ...next, operationId: operation.operationId }));
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    throw error;
  }
}
