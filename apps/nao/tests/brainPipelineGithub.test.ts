import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dispatchBrainPipeline, inspectBrainPipeline } from '../src/lib/brainPipelineGithub.ts';

function response(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

function activeSequence(runs: unknown[] = []): typeof fetch {
  const responses = [
    response(200, { default_branch: 'main' }),
    response(200, { state: 'active' }),
    response(200, { workflow_runs: runs }),
  ];
  return (async () => responses.shift() ?? response(500)) as typeof fetch;
}

function responseSequence(responses: Response[]): typeof fetch {
  return (async () => responses.shift() ?? response(500)) as typeof fetch;
}

test('inspect: classifies absent default-branch workflow exactly', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    const urls: string[] = [];
    const responses = [response(200, { default_branch: 'main' }), response(404), response(404)];
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url));
      return responses.shift() ?? response(500);
    }) as typeof fetch;
    try {
      const result = await inspectBrainPipeline();
      assert.deepEqual(result, { ok: true, dispatchability: 'not_on_default_branch', defaultBranch: 'main', runs: [] });
      assert.match(urls[2], /contents\/\.github\/workflows\/brain-pipeline\.yml\?ref=main$/);
    } finally { globalThis.fetch = realFetch; }
  });
});

test('inspect: treats present-but-unregistered and disabled workflows as not dispatchable', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = responseSequence([response(200, { default_branch: 'main' }), response(404), response(200)]);
    try {
      assert.equal((await inspectBrainPipeline()).dispatchability, 'unregistered_or_invalid');
    } finally { globalThis.fetch = realFetch; }
    globalThis.fetch = responseSequence([response(200, { default_branch: 'main' }), response(200, { state: 'disabled_manually' })]);
    try {
      assert.equal((await inspectBrainPipeline()).dispatchability, 'unregistered_or_invalid');
    } finally { globalThis.fetch = realFetch; }
  });
});

test('inspect: returns only validated recent workflow_dispatch runs', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = activeSequence([
      { id: 42, status: 'completed', conclusion: 'success', html_url: 'https://github.com/uandiqueue/ourobion/actions/runs/42', created_at: '2026-08-01T00:00:00Z' },
      { id: 'bad', status: 'completed', html_url: 'https://attacker.example/runs/1' },
    ]);
    try {
      const result = await inspectBrainPipeline();
      assert.equal(result.dispatchability, 'active');
      assert.equal(result.runs.length, 1);
      assert.equal(result.runs[0]?.id, 42);
    } finally { globalThis.fetch = realFetch; }
  });
});

test('inspect: a failed recent-runs lookup degrades the list, never dispatchability', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = responseSequence([
      response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(500),
    ]);
    try {
      const result = await inspectBrainPipeline();
      assert.equal(result.ok, true);
      assert.equal(result.dispatchability, 'active');
      assert.deepEqual(result.runs, []);
    } finally { globalThis.fetch = realFetch; }
  });
});

test('inspect: names the failing step and its status instead of one opaque sentence', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = responseSequence([response(403)]);
    try {
      const result = await inspectBrainPipeline();
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /403.*repository/);
    } finally { globalThis.fetch = realFetch; }
    globalThis.fetch = responseSequence([response(200, { default_branch: 'main' }), response(401)]);
    try {
      const result = await inspectBrainPipeline();
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /401.*workflow/);
    } finally { globalThis.fetch = realFetch; }
  });
});

test('dispatch: posts only after preflight, pins ref to default branch, and returns validated 200 run identity', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    let dispatchBody = '';
    const responses = [
      response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(200, { workflow_runs: [] }),
      response(200, { workflow_run_id: 99, run_url: 'https://api.github.com/repos/uandiqueue/ourobion/actions/runs/99', html_url: 'https://github.com/uandiqueue/ourobion/actions/runs/99' }),
    ];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') dispatchBody = String(init.body);
      return responses.shift() ?? response(500);
    }) as typeof fetch;
    try {
      const inputs = { pair: 'a,b', papers: 'p1', artifact_revision: 'rev', dry_run: true };
      const result = await dispatchBrainPipeline(inputs);
      assert.deepEqual(result, { ok: true, outcome: 'accepted', defaultBranch: 'main', run: { id: 99, apiUrl: 'https://api.github.com/repos/uandiqueue/ourobion/actions/runs/99', htmlUrl: 'https://github.com/uandiqueue/ourobion/actions/runs/99' } });
      assert.deepEqual(JSON.parse(dispatchBody), { ref: 'main', inputs, return_run_details: true });
    } finally { globalThis.fetch = realFetch; }
  });
});

test('dispatch: accepts legacy 204 without inventing a run identity', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    const responses = [response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(200, { workflow_runs: [] }), response(204)];
    globalThis.fetch = (async () => responses.shift() ?? response(500)) as typeof fetch;
    try {
      assert.deepEqual(await dispatchBrainPipeline({ dry_run: true }), { ok: true, outcome: 'accepted', defaultBranch: 'main', run: null });
    } finally { globalThis.fetch = realFetch; }
  });
});

test('dispatch: treats a malformed 200 response as outcome unknown', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    const responses = [
      response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(200, { workflow_runs: [] }),
      response(200, { workflow_run_id: 99, run_url: 'https://attacker.example/runs/99', html_url: 'https://github.com/uandiqueue/ourobion/actions/runs/99' }),
    ];
    globalThis.fetch = (async () => responses.shift() ?? response(500)) as typeof fetch;
    try {
      const result = await dispatchBrainPipeline({ dry_run: true });
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.outcome, 'unknown');
    } finally { globalThis.fetch = realFetch; }
  });
});

test('dispatch: refuses an unavailable workflow and tags 4xx versus indeterminate outcomes', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = responseSequence([response(200, { default_branch: 'main' }), response(404), response(404)]);
    try {
      const unavailable = await dispatchBrainPipeline({ dry_run: true });
      assert.equal(unavailable.ok, false); if (!unavailable.ok) assert.equal(unavailable.outcome, 'rejected');
    } finally { globalThis.fetch = realFetch; }
    const responses = [response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(200, { workflow_runs: [] }), response(403)];
    globalThis.fetch = (async () => responses.shift() ?? response(500)) as typeof fetch;
    try {
      const rejected = await dispatchBrainPipeline({ dry_run: true });
      assert.equal(rejected.ok, false); if (!rejected.ok) assert.equal(rejected.outcome, 'rejected');
    } finally { globalThis.fetch = realFetch; }
    const uncertain = [response(200, { default_branch: 'main' }), response(200, { state: 'active' }), response(200, { workflow_runs: [] }), response(503)];
    globalThis.fetch = (async () => uncertain.shift() ?? response(500)) as typeof fetch;
    try {
      const result = await dispatchBrainPipeline({ dry_run: true });
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.outcome, 'unknown');
    } finally { globalThis.fetch = realFetch; }
  });
});

test('all failure messages redact remote response bodies and configured secrets', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'secret-token', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('secret-token remote details'); }) as typeof fetch;
    try {
      const result = await inspectBrainPipeline();
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.doesNotMatch(result.error, /secret-token|remote details/);
      }
    } finally { globalThis.fetch = realFetch; }
  });
});
