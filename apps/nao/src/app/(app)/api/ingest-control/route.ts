// ourobion nao — ingestion remote-control API.
//
// GET  → the current control/ingest-config.json (or DEFAULT_INGEST_CONTROL if
//        none exists yet).
// POST → validate + merge a patch over the current document and persist it
//        (see lib/ingestControl.ts's validatePatchBody/applyIngestControlPatch
//        for the pure logic — this handler is just I/O + auth glue).
//
// Auth: every route under (app) is already gated by src/middleware.ts (a valid
// Supabase session is required to reach this handler at all). We still read
// the session here (via the SAME cookie the middleware already validated)
// purely to stamp `updatedBy`/`requestedBy` with the actual user's email, not
// to re-authorize the request.
import { createServerSupabaseClient } from '@/lib/supabase-server';
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
  const control = await getIngestControl();
  return json(control);
}

export async function POST(req: Request): Promise<Response> {
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

  await putIngestControl(next);
  return json(next);
}
