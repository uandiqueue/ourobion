// ourobion nao — editable router caps (O10 DEMO EXCEPTION, run-2 U8).
//
// POST → validate { node, perDayUsdCap?, perRunTokenCap? } (null clears an
// override) and UPSERT llm_router_cap_overrides AS THE AUTHENTICATED USER
// (cookie-bound @supabase/ssr client — never the service role): the RLS
// INSERT/UPDATE policies require updated_by = auth.uid(), so the audit column
// cannot be forged.
//
// AUTH (R4-U2): requires nao `admin` — caps are policy-and-money, which the
// R4-U2 design §A.1 reserves for the admin tier — via
// requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts). The response
// never returns `updated_by` (explicit column list + redactDeep(), layer-1
// redaction over the DB-layer column revoke Agent A is adding on the same
// table — this route does not assume that landed).
//
// SCOPE (locked): caps ONLY. This is the single write surface the O10 demo
// exception allows — no source toggles, no model-id editing, nothing else.
// Bounds are enforced three times on purpose: here (parseCapsBody), the table
// CHECKs (per_day_usd_cap <= 5.00 / per_run_token_cap <= 200000), and again
// in the router's fail-soft consumer (tools/llm-router/src/overrides.ts).
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement, before
// `req.json()` and parseCapsBody — running the parse first handed a non-member a
// 400-vs-403 schema oracle over this endpoint's request shape.
import { parseCapsBody } from '@/lib/modelsControl';
import {
  NaoControlAuditError,
  NaoControlOutcomeUnknownError,
  applyTransactionalControlMutation,
  controlAuditErrorResponse,
  controlOperationId,
  controlOutcomeUnknownErrorResponse,
  guardRole,
  redactDeep,
} from '@/lib/authzServer';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('admin');
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseCapsBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { node, perDayUsdCap, perRunTokenCap } = parsed.value;

  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    const result = await applyTransactionalControlMutation({
      operationId: operation.operationId,
      action: 'models.cap_override',
      target: node,
      detail: { perDayUsdCap, perRunTokenCap },
      payload: { perDayUsdCap, perRunTokenCap },
    });
    if (!result.ok) {
      const message = result.errorCode === 'duplicate_operation'
        ? 'this operationId was already accepted'
        : 'cap mutation failed';
      return json({ error: message, code: result.errorCode, operationId: result.operationId }, result.status);
    }
    return json(redactDeep({ ok: true, operationId: result.operationId, override: result.record }));
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    throw error;
  }

}
