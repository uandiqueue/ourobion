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
import { getIngestControl, validateTriggerBody, validateTriggerBodyShape } from '@/lib/ingestControl';
import { dispatchIngestWorkflow } from '@/lib/githubDispatch';
import { readSeedCatalog } from '@/lib/seedCatalogServer';
import { INGEST_SEED_TOPICS } from '@/lib/types';
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const shapeError = validateTriggerBodyShape(body);
  if (shapeError) return json({ error: shapeError }, 400);
  const trigger = body as IngestTriggerBody;
  if (
    trigger.seed !== undefined &&
    !(INGEST_SEED_TOPICS as readonly string[]).includes(trigger.seed)
  ) {
    // Custom selectors fail closed: prove the row is visible through the
    // caller's cookie/RLS boundary and is both enabled and non-shadowed.
    const catalog = await readSeedCatalog();
    if (!catalog.ok) return json({ error: redactText(catalog.error) }, 500);
    const validationError = validateTriggerBody(trigger, catalog.seeds);
    if (validationError) return json({ error: validationError }, 400);
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
      target: trigger.seed ?? null,
      detail: { limit: trigger.limit },
      mutate: async () => {
        const result = await dispatchIngestWorkflow(trigger);
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
