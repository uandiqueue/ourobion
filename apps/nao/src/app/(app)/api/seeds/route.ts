// ourobion nao — seeds-as-data API (O14 / demo feature (c), run-2 U10).
//
// GET   → the seed catalog: the six built-in topics (INGEST_SEED_TOPICS, the
//         hand-synced mirror of brain-ingest's static seeds.ts) + every
//         ingestion_seeds row, read AS THE AUTHENTICATED USER (RLS SELECT).
// POST  → { label, slug?, queryHint? } → INSERT a human-added seed AS THE
//         AUTHENTICATED USER (cookie-bound @supabase/ssr client — never the
//         service role): the RLS INSERT policy requires created_by =
//         auth.uid(), so the audit column cannot be forged. Dev posture per
//         this run's D3 precedent.
// PATCH → { slug, enabled } → toggle a db seed. The migration's column-level
//         grant lets authenticated users update ONLY `enabled` — disable,
//         don't erase (no DELETE surface).
//
// SEMANTICS (O14 locked): seeds are added AS DATA — never by editing
// seeds.ts. A seed is a discovery TOPIC/query, never a metric pair: C9's
// candidate list stays the only pair source and verifier-gating on resulting
// edges is unchanged. The pipeline reads this table fail-soft with
// static-wins-on-collision (tools/brain-ingest/src/seeder/dbSeeds.ts).
//
// AUTH (R4-U2): GET requires nao `viewer`; POST and PATCH require `curator`
// (operating the corpus/pipeline, per the R4-U2 design §A.1) via
// requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts). `created_by` (a
// raw curator uuid) is never selected/returned by any handler — explicit
// column list + redactDeep(), layer-1 redaction over the DB-layer column
// revoke Agent A is adding on the same table; this route does not assume that
// landed.
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement of POST
// and of PATCH, before `req.json()` and the body parsers — running the parse
// first handed a non-member a 400-vs-403 schema oracle over both request shapes.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  NaoControlAuditError,
  NaoControlOutcomeUnknownError,
  applyTransactionalControlMutation,
  controlAuditErrorResponse,
  controlOperationId,
  controlOutcomeUnknownErrorResponse,
  guardRole,
  redactDeep,
  redactText,
} from '@/lib/authzServer';
import { buildSeedCatalog, parseAddSeedBody, parseToggleSeedBody } from '@/lib/seedsControl';
import type { DbSeedRow } from '@/lib/seedsControl';
import { INGEST_SEED_TOPICS } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Explicit column list shared by every query below — never `created_by` (a
// raw curator uuid). Layer-1 redaction over the DB-layer column revoke Agent
// A is adding on the same table; this route does not assume that landed.
const SEED_COLUMNS = 'id, slug, label, query_hint, enabled, created_at';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingestion_seeds')
    .select(SEED_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) return json({ error: redactText(error.message) }, 500);

  return json(
    redactDeep({ ok: true, seeds: buildSeedCatalog(INGEST_SEED_TOPICS, (data ?? []) as DbSeedRow[]) }),
  );
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
  const parsed = parseAddSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { slug, label, queryHint } = parsed.value;

  // Honest guard: a slug shadowing a built-in would be silently ignored by the
  // pipeline (static wins on collision) — refuse it here instead.
  if ((INGEST_SEED_TOPICS as readonly string[]).includes(slug)) {
    return json({ error: `'${slug}' is a built-in seed topic — pick a different slug` }, 409);
  }

  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    const result = await applyTransactionalControlMutation({
      operationId: operation.operationId,
      action: 'seeds.add',
      target: slug,
      detail: { label, queryHint },
      payload: { label, queryHint },
    });
    if (!result.ok) {
    // 23505 = unique_violation on slug — a duplicate, not a server fault.
      const message = result.errorCode === 'duplicate_seed'
        ? `seed '${slug}' already exists`
        : result.errorCode === 'duplicate_operation'
          ? 'this operationId was already accepted'
          : 'seed mutation failed';
      return json({ error: message, code: result.errorCode, operationId: result.operationId }, result.status);
    }
    return json(redactDeep({ ok: true, operationId: result.operationId, seed: result.record }));
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    throw error;
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseToggleSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { slug, enabled } = parsed.value;
  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    const result = await applyTransactionalControlMutation({
      operationId: operation.operationId,
      action: 'seeds.toggle',
      target: slug,
      detail: { enabled },
      payload: { enabled },
    });
    if (!result.ok) {
      const message = result.errorCode === 'unknown_seed'
        ? `unknown seed: ${slug}`
        : result.errorCode === 'duplicate_operation'
          ? 'this operationId was already accepted'
          : 'seed mutation failed';
      return json({ error: message, code: result.errorCode, operationId: result.operationId }, result.status);
    }
    return json(redactDeep({ ok: true, operationId: result.operationId, seed: result.record }));
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    throw error;
  }

}
