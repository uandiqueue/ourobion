// ourobion nao — trigger a real ingestion run via GitHub Actions.
//
// POST { seed?, limit? } → dispatches .github/workflows/brain-ingest.yml on
// GitHub's runners with those as workflow inputs (see lib/githubDispatch.ts
// for why nao can't run this itself). Checks the remote `paused` flag FIRST —
// a paused control document blocks this too, not just a hypothetical
// scheduler, so pause is a real safety switch for the button itself.
//
// Auth: gated by src/middleware.ts like every route under (app); no extra
// auth code needed here.
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

  const result = await dispatchIngestWorkflow(body);
  if (!result.ok) {
    return json({ error: result.error ?? 'dispatch failed' }, 502);
  }
  return json({ ok: true });
}
