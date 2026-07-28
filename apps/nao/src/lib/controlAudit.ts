// Pure control-mutation audit lifecycle. I/O is injected so ordering and every
// failure boundary are executable under node:test without a Next request.

export const CONTROL_OPERATION_HEADER = 'X-Ourobion-Operation-Id';

export type NaoControlAction =
  | 'ingest_control.patch'
  | 'ingest.trigger'
  | 'seeds.add'
  | 'seeds.toggle'
  | 'models.cap_override'
  | 'claims.reject'
  | 'loader.simulate'
  | 'pipeline.run';

export type NaoControlPhase = 'attempted' | 'succeeded' | 'failed';

export interface ControlEventInput {
  operationId: string;
  action: NaoControlAction;
  phase: NaoControlPhase;
  target: string | null;
  detail: Record<string, unknown>;
  errorCode: string | null;
}

export type AppendControlEvent = (event: ControlEventInput) => Promise<void>;

export class NaoControlAuditError extends Error {
  readonly code: 'audit_attempt_unavailable' | 'audit_outcome_unavailable';
  readonly operationId: string;

  constructor(stage: 'attempt' | 'outcome', operationId: string) {
    const code = stage === 'attempt' ? 'audit_attempt_unavailable' : 'audit_outcome_unavailable';
    super(code);
    this.name = 'NaoControlAuditError';
    this.code = code;
    this.operationId = operationId;
  }
}

export class NaoControlMutationError extends Error {
  readonly auditCode: string;
  readonly status: number;

  constructor(auditCode: string, publicMessage: string, status: number) {
    super(publicMessage);
    this.name = 'NaoControlMutationError';
    this.auditCode = auditCode;
    this.status = status;
  }
}

/**
 * The external request may have committed, but its response was not observed.
 * No terminal audit phase is written: the durable attempt is the reconciliation record.
 */
export class NaoControlOutcomeUnknownError extends Error {
  readonly code = 'control_outcome_unknown';
  readonly operationId: string;
  readonly status = 503;

  constructor(operationId: string) {
    super('control outcome is unknown');
    this.name = 'NaoControlOutcomeUnknownError';
    this.operationId = operationId;
  }
}

/**
 * A missing/malformed Supabase RPC result is indeterminate: the transaction
 * may have committed before its HTTP response was lost. Preserve the stable
 * operation id and require reconciliation instead of claiming "not started".
 */
export function requireKnownControlRpcResult<T extends object>(
  operationId: string,
  data: unknown,
  error: unknown,
): T {
  if (error !== null && error !== undefined) throw new NaoControlOutcomeUnknownError(operationId);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new NaoControlOutcomeUnknownError(operationId);
  }
  return data as T;
}

export async function requireKnownControlRpcCall<T extends object>(
  operationId: string,
  call: () => Promise<{ data: unknown; error: unknown }>,
): Promise<T> {
  try {
    const { data, error } = await call();
    return requireKnownControlRpcResult<T>(operationId, data, error);
  } catch (error) {
    if (error instanceof NaoControlOutcomeUnknownError) throw error;
    throw new NaoControlOutcomeUnknownError(operationId);
  }
}

export function resolveControlOperationId(value: string | null):
  | { ok: true; operationId: string }
  | { ok: false; error: string } {
  if (value === null) return { ok: true, operationId: crypto.randomUUID() };
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    return { ok: false, error: `${CONTROL_OPERATION_HEADER} must be a UUID` };
  }
  return { ok: true, operationId: normalized };
}

export interface AuditedMutationInput<T> {
  operationId: string;
  action: NaoControlAction;
  target?: string | null;
  detail?: Record<string, unknown>;
  append: AppendControlEvent;
  mutate: () => Promise<T>;
}

/**
 * Durable attempt first, external mutation second, terminal outcome last.
 *
 * An attempt write failure prevents `mutate` from running. If terminal write
 * fails after `mutate`, the attempted row is intentionally left unresolved;
 * callers get a typed error carrying the stable operation id for reconciliation.
 */
export async function runAuditedControlMutation<T>(
  input: AuditedMutationInput<T>,
): Promise<{ operationId: string; value: T }> {
  const target = input.target ?? null;
  const detail = input.detail ?? {};
  try {
    await input.append({
      operationId: input.operationId,
      action: input.action,
      phase: 'attempted',
      target,
      detail,
      errorCode: null,
    });
  } catch {
    throw new NaoControlAuditError('attempt', input.operationId);
  }

  let value: T;
  try {
    value = await input.mutate();
  } catch (error) {
    // Only an explicit, authoritative negative is eligible for `failed`.
    // A thrown transport/runtime error may mean the remote side committed and
    // its response was lost, so preserve the unresolved attempt instead.
    if (!(error instanceof NaoControlMutationError)) {
      throw new NaoControlOutcomeUnknownError(input.operationId);
    }
    try {
      await input.append({
        operationId: input.operationId,
        action: input.action,
        phase: 'failed',
        target,
        detail: {},
        errorCode: error.auditCode,
      });
    } catch {
      throw new NaoControlAuditError('outcome', input.operationId);
    }
    throw error;
  }

  try {
    await input.append({
      operationId: input.operationId,
      action: input.action,
      phase: 'succeeded',
      target,
      detail: {},
      errorCode: null,
    });
  } catch {
    throw new NaoControlAuditError('outcome', input.operationId);
  }
  return { operationId: input.operationId, value };
}
