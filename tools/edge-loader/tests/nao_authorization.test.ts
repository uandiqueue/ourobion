import assert from 'node:assert/strict';
import test from 'node:test';

import { validateNaoAuthorization } from '../lib/nao_authorization.mjs';

const operationId = '018f47a2-70d1-7cc9-a421-65b9df173712';
const artifactRevision = 'edges-2026-08-02.1';
const now = new Date('2026-08-02T06:30:00.000Z');

function rows() {
  const common = {
    actor_user_id: 'c781a48f-b180-49e8-a72d-a26d0d0c909f',
    actor_role: 'curator',
    action: 'ingest.trigger',
    target: `brain-pipeline:${artifactRevision}`,
  };
  return [
    {
      ...common,
      phase: 'attempted',
      occurred_at: '2026-08-02T06:29:00.000Z',
      detail: {
        control: 'brain-pipeline',
        artifactRevision,
        paperCount: 1,
        verificationCorpus: 'hydrated-manifest-echo-controlled',
        dryRun: false,
      },
    },
    {
      ...common,
      phase: 'succeeded',
      occurred_at: '2026-08-02T06:29:01.000Z',
      detail: {},
    },
  ];
}

const expected = { operationId, artifactRevision, paperCount: 1 };

test('accepts one fresh, matching, completed curator lifecycle', () => {
  const result = validateNaoAuthorization(rows(), expected, { now });
  assert.deepEqual(result, {
    operationId,
    artifactRevision,
    paperCount: 1,
    actorRole: 'curator',
    attemptedAt: '2026-08-02T06:29:00.000Z',
    succeededAt: '2026-08-02T06:29:01.000Z',
  });
});

for (const [name, mutate, pattern] of [
  ['missing outcome', (value: ReturnType<typeof rows>) => value.slice(0, 1), /exactly one attempted/],
  ['failed outcome', (value: ReturnType<typeof rows>) => [...value.slice(0, 1), { ...value[1]!, phase: 'failed' }], /phases/],
  ['different actor', (value: ReturnType<typeof rows>) => { value[1]!.actor_user_id = '107e2831-418b-48ad-a827-248ffb24c0d5'; return value; }, /actor/],
  ['viewer actor', (value: ReturnType<typeof rows>) => { value[0]!.actor_role = 'viewer'; return value; }, /curator or admin/],
  ['wrong revision', (value: ReturnType<typeof rows>) => { value[0]!.target = 'brain-pipeline:other'; return value; }, /revision/],
  ['wrong paper count', (value: ReturnType<typeof rows>) => { value[0]!.detail.paperCount = 2; return value; }, /detail/],
  ['dry run event', (value: ReturnType<typeof rows>) => { value[0]!.detail.dryRun = true; return value; }, /detail/],
  ['stale event', (value: ReturnType<typeof rows>) => { value[0]!.occurred_at = '2026-08-02T05:00:00.000Z'; return value; }, /stale/],
] as const) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateNaoAuthorization(mutate(rows()), expected, { now }), pattern);
  });
}
