const ALLOWED_ROLES = new Set(['curator', 'admin']);
const REQUIRED_PHASES = new Set(['attempted', 'succeeded']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(message) {
  throw new Error(`nao authorization rejected: ${message}`);
}

/**
 * Validate the complete append-only lifecycle that authorized one live brain
 * workflow. Actor identity is compared but never returned or logged.
 */
export function validateNaoAuthorization(rows, expected, options = {}) {
  const nowMs = (options.now ?? new Date()).getTime();
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000;
  if (!Array.isArray(rows) || rows.length !== 2) {
    fail('expected exactly one attempted row and one succeeded row');
  }

  const byPhase = new Map();
  for (const row of rows) {
    if (!isRecord(row) || !REQUIRED_PHASES.has(row.phase) || byPhase.has(row.phase)) {
      fail('lifecycle phases are incomplete or ambiguous');
    }
    byPhase.set(row.phase, row);
  }
  const attempted = byPhase.get('attempted');
  const succeeded = byPhase.get('succeeded');
  if (!attempted || !succeeded) fail('both attempted and succeeded phases are required');

  if (
    typeof attempted.actor_user_id !== 'string' ||
    attempted.actor_user_id.length === 0 ||
    attempted.actor_user_id !== succeeded.actor_user_id
  ) {
    fail('lifecycle actor does not match');
  }
  for (const row of [attempted, succeeded]) {
    if (!ALLOWED_ROLES.has(row.actor_role)) fail('actor was not curator or admin');
    if (row.action !== 'ingest.trigger') fail('action is not the brain ingestion trigger');
    if (row.target !== `brain-pipeline:${expected.artifactRevision}`) {
      fail('artifact revision does not match the audited target');
    }
  }

  const detail = attempted.detail;
  if (
    !isRecord(detail) ||
    detail.control !== 'brain-pipeline' ||
    detail.artifactRevision !== expected.artifactRevision ||
    detail.paperCount !== expected.paperCount ||
    detail.verificationCorpus !== 'hydrated-manifest-echo-controlled' ||
    detail.dryRun !== false
  ) {
    fail('audited request detail does not match this live workflow');
  }

  const attemptedAt = Date.parse(String(attempted.occurred_at));
  const succeededAt = Date.parse(String(succeeded.occurred_at));
  if (!Number.isFinite(attemptedAt) || !Number.isFinite(succeededAt) || succeededAt < attemptedAt) {
    fail('lifecycle timestamps are invalid');
  }
  if (attemptedAt > nowMs + 60_000 || nowMs - attemptedAt > maxAgeMs) {
    fail('authorization is stale or from the future');
  }

  return {
    operationId: expected.operationId,
    artifactRevision: expected.artifactRevision,
    paperCount: expected.paperCount,
    actorRole: attempted.actor_role,
    attemptedAt: new Date(attemptedAt).toISOString(),
    succeededAt: new Date(succeededAt).toISOString(),
  };
}
