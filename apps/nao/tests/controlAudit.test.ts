import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NaoControlAuditError,
  NaoControlMutationError,
  NaoControlOutcomeUnknownError,
  requireKnownControlRpcCall,
  requireKnownControlRpcResult,
  resolveControlOperationId,
  runAuditedControlMutation,
  type ControlEventInput,
} from '../src/lib/controlAudit.ts';

const OPERATION_ID = '018f47a2-6c9b-7d31-8c6a-93fdf0c910a4';
const NAO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIFECYCLE_MIGRATION = readFileSync(
  path.resolve(
    NAO_ROOT,
    '..',
    '..',
    'supabase',
    'migrations',
    '20260728031000_nao_control_audit_lifecycle.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

test('audit-attempt failure prevents the mutation from starting and is typed/redacted', async () => {
  let mutationCalls = 0;
  await assert.rejects(
    runAuditedControlMutation({
      operationId: OPERATION_ID,
      action: 'ingest.trigger',
      append: async () => { throw new Error('db host and secret text'); },
      mutate: async () => { mutationCalls += 1; },
    }),
    (error) => {
      assert.ok(error instanceof NaoControlAuditError);
      assert.equal(error.code, 'audit_attempt_unavailable');
      assert.equal(error.operationId, OPERATION_ID);
      assert.doesNotMatch(error.message, /host|secret/i);
      return true;
    },
  );
  assert.equal(mutationCalls, 0);
});

test('a mutation failure records attempted then failed, never succeeded', async () => {
  const events: ControlEventInput[] = [];
  const failure = new NaoControlMutationError('github_dispatch_failed', 'dispatch failed', 502);
  await assert.rejects(
    runAuditedControlMutation({
      operationId: OPERATION_ID,
      action: 'ingest.trigger',
      target: 'gut-health',
      append: async (event) => { events.push(event); },
      mutate: async () => { throw failure; },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(events.map((event) => event.phase), ['attempted', 'failed']);
  assert.equal(events[1].errorCode, 'github_dispatch_failed');
  assert.equal(events.some((event) => event.phase === 'succeeded'), false);
});

test('response-loss ambiguity is typed and leaves only the durable attempt unresolved', async () => {
  const events: ControlEventInput[] = [];
  await assert.rejects(
    runAuditedControlMutation({
      operationId: OPERATION_ID,
      action: 'pipeline.run',
      append: async (event) => { events.push(event); },
      mutate: async () => { throw new Error('socket host and credential details'); },
    }),
    (error) => {
      assert.ok(error instanceof NaoControlOutcomeUnknownError);
      assert.equal(error.code, 'control_outcome_unknown');
      assert.equal(error.operationId, OPERATION_ID);
      assert.equal(error.status, 503);
      assert.doesNotMatch(error.message, /socket|host|credential/i);
      return true;
    },
  );
  assert.deepEqual(events.map((event) => event.phase), ['attempted']);
});

test('an unresolved response-loss attempt blocks blind retry of the same operation id', async () => {
  const keys = new Set<string>();
  let mutationCalls = 0;
  const input = {
    operationId: OPERATION_ID,
    action: 'pipeline.run' as const,
    append: async (event: ControlEventInput) => {
      const key = `${event.operationId}:${event.phase}`;
      if (keys.has(key)) throw new Error('duplicate phase');
      keys.add(key);
    },
    mutate: async () => {
      mutationCalls += 1;
      throw new Error('response connection reset');
    },
  };
  await assert.rejects(runAuditedControlMutation(input), NaoControlOutcomeUnknownError);
  await assert.rejects(
    runAuditedControlMutation(input),
    (error) => error instanceof NaoControlAuditError && error.code === 'audit_attempt_unavailable',
  );
  assert.equal(mutationCalls, 1);
  assert.deepEqual([...keys], [`${OPERATION_ID}:attempted`]);
});

test('lost or malformed transactional RPC responses are outcome-unknown with the stable id', () => {
  for (const [data, error] of [
    [null, new Error('fetch response lost')],
    [null, null],
    ['not-an-object', null],
    [[], null],
  ] as const) {
    assert.throws(
      () => requireKnownControlRpcResult(OPERATION_ID, data, error),
      (thrown) => {
        assert.ok(thrown instanceof NaoControlOutcomeUnknownError);
        assert.equal(thrown.operationId, OPERATION_ID);
        assert.equal(thrown.status, 503);
        return true;
      },
    );
  }
  const known = { ok: false, operationId: OPERATION_ID, errorCode: 'unknown_seed', status: 404 };
  assert.equal(requireKnownControlRpcResult(OPERATION_ID, known, null), known);
});

test('a thrown RPC response-loss after possible commit is outcome-unknown with the stable id', async () => {
  let remoteMayHaveCommitted = false;
  await assert.rejects(
    requireKnownControlRpcCall(OPERATION_ID, async () => {
      remoteMayHaveCommitted = true;
      throw new Error('connection reset before response');
    }),
    (error) => {
      assert.ok(error instanceof NaoControlOutcomeUnknownError);
      assert.equal(error.operationId, OPERATION_ID);
      assert.equal(error.status, 503);
      return true;
    },
  );
  assert.equal(remoteMayHaveCommitted, true);
});

test('success is recorded only after the mutation completes', async () => {
  const order: string[] = [];
  const result = await runAuditedControlMutation({
    operationId: OPERATION_ID,
    action: 'pipeline.run',
    append: async (event) => { order.push(`audit:${event.phase}`); },
    mutate: async () => { order.push('mutation'); return 42; },
  });
  assert.deepEqual(order, ['audit:attempted', 'mutation', 'audit:succeeded']);
  assert.deepEqual(result, { operationId: OPERATION_ID, value: 42 });
});

test('outcome persistence failure leaves the durable attempt unresolved and returns its id', async () => {
  const events: ControlEventInput[] = [];
  let mutationCalls = 0;
  await assert.rejects(
    runAuditedControlMutation({
      operationId: OPERATION_ID,
      action: 'ingest_control.patch',
      append: async (event) => {
        if (event.phase === 'succeeded') throw new Error('outcome store down');
        events.push(event);
      },
      mutate: async () => { mutationCalls += 1; },
    }),
    (error) => {
      assert.ok(error instanceof NaoControlAuditError);
      assert.equal(error.code, 'audit_outcome_unavailable');
      assert.equal(error.operationId, OPERATION_ID);
      return true;
    },
  );
  assert.equal(mutationCalls, 1);
  assert.deepEqual(events.map((event) => event.phase), ['attempted']);
});

test('retrying the same operation id is idempotently refused before a second mutation', async () => {
  const keys = new Set<string>();
  let mutationCalls = 0;
  const append = async (event: ControlEventInput) => {
    const key = `${event.operationId}:${event.phase}`;
    if (keys.has(key)) throw new Error('duplicate phase');
    keys.add(key);
  };
  const input = {
    operationId: OPERATION_ID,
    action: 'pipeline.run' as const,
    append,
    mutate: async () => { mutationCalls += 1; },
  };
  await runAuditedControlMutation(input);
  await assert.rejects(runAuditedControlMutation(input), NaoControlAuditError);
  assert.equal(mutationCalls, 1);
  assert.deepEqual([...keys], [`${OPERATION_ID}:attempted`, `${OPERATION_ID}:succeeded`]);
});

test('operation ids accept canonical UUIDs, normalize case, and reject arbitrary text', () => {
  assert.deepEqual(resolveControlOperationId(OPERATION_ID.toUpperCase()), {
    ok: true,
    operationId: OPERATION_ID,
  });
  assert.deepEqual(resolveControlOperationId('not-an-id'), {
    ok: false,
    error: 'X-Ourobion-Operation-Id must be a UUID',
  });
  const generated = resolveControlOperationId(null);
  assert.equal(generated.ok, true);
  if (generated.ok) assert.match(generated.operationId, /^[0-9a-f-]{36}$/);
});

test('migration keeps both audit writers under caller privileges', () => {
  for (const functionName of ['nao_record_control_event', 'nao_apply_control_mutation']) {
    const start = LIFECYCLE_MIGRATION.indexOf(`create or replace function public.${functionName}`);
    const end = LIFECYCLE_MIGRATION.indexOf('\n$$;', start);
    assert.notEqual(start, -1, `${functionName} must exist`);
    assert.notEqual(end, -1, `${functionName} body must be bounded`);
    const definition = LIFECYCLE_MIGRATION.slice(start, end);
    assert.match(definition, /security invoker/i);
    assert.doesNotMatch(definition, /security definer/i);
  }
  assert.match(LIFECYCLE_MIGRATION, /new\.actor_user_id := auth\.uid\(\)/);
  assert.match(LIFECYCLE_MIGRATION, /values \(p_target, 'reject',[\s\S]*auth\.uid\(\)\)/);
  assert.equal(
    (LIFECYCLE_MIGRATION.match(/from public, anon, service_role;/g) ?? []).length,
    2,
    'both RPCs must remove Supabase default EXECUTE grants before granting authenticated only',
  );
});

test('transactional RPC uses the closed database action set and attempt-before-mutation ordering', () => {
  const start = LIFECYCLE_MIGRATION.indexOf(
    'create or replace function public.nao_apply_control_mutation',
  );
  const end = LIFECYCLE_MIGRATION.indexOf('\n$$;', start);
  const definition = LIFECYCLE_MIGRATION.slice(start, end);
  for (const action of ['seeds.add', 'seeds.toggle', 'claims.reject', 'models.cap_override']) {
    assert.match(definition, new RegExp(`'${action.replace('.', '\\.')}'`));
  }
  assert.ok(
    definition.indexOf("p_action, 'attempted'") < definition.indexOf('insert into public.ingestion_seeds'),
    'durable attempt must precede the first mutation branch',
  );
  assert.ok(
    definition.indexOf("p_action, 'succeeded'") > definition.indexOf('on conflict (node) do update'),
    'success must follow the final mutation branch',
  );
  assert.doesNotMatch(
    definition,
    /returning\s+\*/i,
    'SECURITY INVOKER cannot RETURNING * across identity columns whose SELECT grant is revoked',
  );
  assert.doesNotMatch(
    definition,
    /to_jsonb\((?:v_seed|v_verdict|v_cap)\)/i,
    'response JSON must be built only from explicitly granted columns',
  );
});

test('migration exposes an RLS-preserving unresolved-operation reconciliation queue', () => {
  assert.match(
    LIFECYCLE_MIGRATION,
    /create or replace view public\.nao_unresolved_control_operations\s+with \(security_invoker = true\)/i,
  );
  assert.match(LIFECYCLE_MIGRATION, /a\.phase = 'attempted'/);
  assert.match(LIFECYCLE_MIGRATION, /o\.phase in \('succeeded', 'failed'\)/);
  assert.match(
    LIFECYCLE_MIGRATION,
    /create unique index nao_control_events_one_outcome_idx[\s\S]*phase in \('succeeded', 'failed'\)/i,
  );
  assert.match(
    LIFECYCLE_MIGRATION,
    /phase = 'failed' and error_code is not null and error_code ~/i,
    'a failed phase must carry a machine-readable error code (CHECK must not pass on SQL NULL)',
  );
});
