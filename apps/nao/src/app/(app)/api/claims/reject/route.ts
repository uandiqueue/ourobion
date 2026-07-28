// ourobion nao — human REJECT of a verified edge (O13 / demo feature (b), run-2 U9).
//
// POST { edgeId, reason? } → validate (parseRejectBody) and INSERT an
// edge_human_verdicts row AS THE AUTHENTICATED USER (cookie-bound @supabase/ssr
// client — never the service role): the RLS INSERT policy requires
// created_by = auth.uid(), so the audit column cannot be forged. Dev posture
// per this run's D3 precedent (any authenticated user is one of the two
// ourobion devs).
//
// SEMANTICS (O13 locked): the reject is RECORDED, never a silent edit — the
// verifier's verdict rows are untouched; this row supersedes them FOR SERVING
// only (generate-insights excludes human-rejected edges for NEW cards;
// provenance on already-served cards keeps showing the edge, with the human
// verdict visible). 'reject' is the ONLY action this cycle — no approve, no
// restore/undo (append-only audit; corrections would be new rows in a later
// cycle's semantics).
//
// edge_human_verdicts deliberately has NO foreign key to relationship_claims
// (a loader rebuild must never clobber human truth), so THIS route is the
// existence guard: it 404s when the edgeId is not a known claim.
//
// AUTH (R4-U2): requires nao `curator` (recording verdicts is a
// corpus/pipeline operation, per the R4-U2 design §A.1) via
// requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts). `created_by`
// is never selected/returned (explicit column list + redactDeep()), layer-1
// redaction over the DB-layer column revoke Agent A is adding on the same
// table — this route does not assume that landed.
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement, before
// `req.json()` and parseRejectBody — running the parse first handed a non-member a
// 400-vs-403 schema oracle over this endpoint's request shape.
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
import { parseRejectBody } from '@/lib/claimsControl';

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
  const parsed = parseRejectBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { edgeId, reason } = parsed.value;
  const operation = controlOperationId(req);
  if (!operation.ok) return json({ error: operation.error }, 400);
  try {
    const result = await applyTransactionalControlMutation({
      operationId: operation.operationId,
      action: 'claims.reject',
      target: edgeId,
      detail: { reason },
      payload: { reason },
    });
    if (!result.ok) {
      const message = result.errorCode === 'unknown_edge'
        ? `unknown edge: ${edgeId}`
        : result.errorCode === 'duplicate_operation'
          ? 'this operationId was already accepted'
          : 'claim mutation failed';
      return json({ error: message, code: result.errorCode, operationId: result.operationId }, result.status);
    }
    return json(redactDeep({ ok: true, operationId: result.operationId, verdict: result.record }));
  } catch (error) {
    if (error instanceof NaoControlAuditError) return controlAuditErrorResponse(error);
    if (error instanceof NaoControlOutcomeUnknownError) return controlOutcomeUnknownErrorResponse(error);
    throw error;
  }

  // `reason` is operator free text, so it goes into the audit log through the
  // same redaction as a response body (recordControlEvent → redactDeep): a
  // pasted uuid or a secret-shaped key never lands in nao_control_events.detail.
  // Existence guard (stands in for the deliberately-absent FK — see header).
  // Explicit column list (layer-1 redaction): never select/return `created_by`
  // — the curator's raw uuid — even though the DB layer (Agent A) is also
  // revoking table-level SELECT on that column. Neither layer assumes the
  // other landed.
}
