// ourobion nao — trigger a real ingestion run via GitHub Actions.
//
// POST { seed?, limit? } → dispatches .github/workflows/brain-ingest.yml on
// GitHub's runners with those as workflow inputs (see lib/githubDispatch.ts
// for why nao can't run this itself). Checks the remote `paused` flag FIRST —
// a paused control document blocks this too, not just a hypothetical
// scheduler, so pause is a real safety switch for the button itself.
//
// AUTH (R4-U2 fix): before this unit, this file had NO auth code at all —
// "gated by src/middleware.ts like every route under (app); no extra auth
// code needed here" was the previous (incorrect) posture, and this triggers a
// REAL ingestion run on GitHub's runners, which is exactly the kind of action
// that must not depend solely on the middleware layer. Requires `curator`
// (operating the corpus/pipeline is the curator tier's job per the R4-U2
// design §A.1) via requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts).
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement, before
// `req.json()` and validateTriggerBody — running validation first handed a
// non-member a 400-vs-403 schema oracle over this endpoint's request shape.
import {
  NaoControlAuditError,
  NaoControlMutationError,
  NaoControlOutcomeUnknownError,
  controlAuditErrorResponse,
  controlOperationId,
  controlOutcomeUnknownErrorResponse,
  guardRole,
  redactText,
  runAuditedControlMutation,
} from '@/lib/authzServer';
import { getIngestControl, validateTriggerBody } from '@/lib/ingestControl';
import { dispatchIngestWorkflow } from '@/lib/githubDispatch';
import type { IngestTriggerBody } from '@/lib/types';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  let body: IngestTriggerBody;
  try {
    body = (await req.json()) as IngestTriggerBody;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const validationError = validateTriggerBody(body);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const control = await getIngestControl();
  if (control.paused) {
    return json({ error: 'Ingestion is paused — resume it first (Pipeline state panel) before triggering a run.' }, 409);
  }

  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    await runAuditedControlMutation({
      operationId: operation.operationId,
      action: 'ingest.trigger',
      target: body.seed ?? null,
      detail: { limit: body.limit },
      mutate: async () => {
        const result = await dispatchIngestWorkflow(body);
        if (!result.ok) {
          if (result.outcome === 'unknown') throw new Error('GitHub dispatch outcome unknown');
          throw new NaoControlMutationError('github_dispatch_failed', 'dispatch failed', 502);
        }
      },
    });
    return json({ ok: true, operationId: operation.operationId });
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    if (error instanceof NaoControlMutationError) {
      return json({ error: redactText(error.message), code: error.auditCode, operationId: operation.operationId }, error.status);
    }
    throw error;
  }
}
