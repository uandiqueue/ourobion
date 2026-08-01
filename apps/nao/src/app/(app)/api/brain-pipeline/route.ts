import { parseBrainPipelineRequest } from '@/lib/brainPipelineControl';
import { dispatchBrainPipeline, inspectBrainPipeline } from '@/lib/brainPipelineGithub';
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

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const inspection = await inspectBrainPipeline();
  if (!inspection.ok) return json(inspection, 503);
  return json(inspection);
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
  const parsed = parseBrainPipelineRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    const result = await runAuditedControlMutation({
      operationId: operation.operationId,
      action: 'ingest.trigger',
      target: `brain-pipeline:${parsed.value.artifactRevision}`,
      detail: {
        control: 'brain-pipeline',
        pair: parsed.value.pair,
        paperCount: parsed.value.papers.length,
        artifactRevision: parsed.value.artifactRevision,
        corpus: parsed.value.corpus || null,
        dryRun: parsed.value.dryRun,
      },
      mutate: async () => {
        const dispatched = await dispatchBrainPipeline(parsed.workflowInputs);
        if (!dispatched.ok) {
          if (dispatched.outcome === 'unknown') throw new Error('GitHub dispatch outcome unknown');
          throw new NaoControlMutationError(
            'brain_pipeline_dispatch_rejected',
            dispatched.error,
            409,
          );
        }
        return dispatched;
      },
    });
    return json({ ok: true, operationId: result.operationId, dispatch: result.value });
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    if (error instanceof NaoControlMutationError) {
      return json(
        { error: redactText(error.message), code: error.auditCode, operationId: operation.operationId },
        error.status,
      );
    }
    throw error;
  }
}
