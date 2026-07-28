/**
 * Tests for the GitHub Actions dispatch helper (`src/lib/githubDispatch.ts`).
 * No real network — `globalThis.fetch` is stubbed. Run: node --test (Node >=26).
 *
 * Asserts:
 *  - missing GH_ACTIONS_TOKEN/GH_REPO fails fast with no fetch call at all;
 *  - a successful dispatch (204) posts the right URL/headers/body and reports ok;
 *  - a 4xx is an authoritative rejection, while 5xx/unexpected statuses are unknown;
 *  - a thrown network error is tagged outcome-unknown.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dispatchIngestWorkflow } from '../src/lib/githubDispatch.ts';

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const prior: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) prior[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('dispatchIngestWorkflow: missing GH_ACTIONS_TOKEN/GH_REPO fails fast, no fetch call', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: undefined, GH_REPO: undefined }, async () => {
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('should not be called');
    }) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({ seed: 'hydration' });
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('expected a rejected dispatch');
      assert.equal(result.outcome, 'rejected');
      assert.match(result.error, /not configured/);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: a successful dispatch (204) posts the right request and reports ok', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion', GH_ACTIONS_REF: 'dev-phase2' }, async () => {
    const realFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return { status: 204, text: async () => '' } as Response;
    }) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({ seed: 'hydration', limit: 20 });
      assert.equal(result.ok, true);
      assert.equal(
        capturedUrl,
        'https://api.github.com/repos/uandiqueue/ourobion/actions/workflows/brain-ingest.yml/dispatches',
      );
      assert.equal(capturedInit?.method, 'POST');
      const headers = capturedInit?.headers as Record<string, string>;
      assert.equal(headers['Authorization'], 'Bearer tok_123');
      const body = JSON.parse(String(capturedInit?.body)) as { ref: string; inputs: Record<string, string> };
      assert.equal(body.ref, 'dev-phase2');
      assert.deepEqual(body.inputs, { seed: 'hydration', limit: '20' });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: omitted seed/limit send an empty inputs object', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { status: 204, text: async () => '' } as Response;
    }) as typeof fetch;
    try {
      await dispatchIngestWorkflow({});
      const body = JSON.parse(String(capturedInit?.body)) as { inputs: Record<string, string> };
      assert.deepEqual(body.inputs, {});
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: a 4xx response is an authoritative rejection', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return { status: 404, text: async () => 'Not Found' } as Response;
    }) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({ seed: 'hydration' });
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('expected a rejected dispatch');
      assert.equal(result.outcome, 'rejected');
      assert.match(result.error, /404/);
      assert.match(result.error, /Not Found/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: a 5xx response is outcome unknown, never definitive rejection', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    let bodyReads = 0;
    globalThis.fetch = (async () => {
      return {
        status: 503,
        text: async () => {
          bodyReads += 1;
          throw new Error('response body lost');
        },
      } as unknown as Response;
    }) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({ seed: 'hydration' });
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('expected an unknown dispatch outcome');
      assert.equal(result.outcome, 'unknown');
      assert.match(result.error, /503/);
      assert.equal(bodyReads, 0, 'a 5xx body cannot make the remote outcome authoritative');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: unexpected non-204 2xx is also outcome unknown', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ status: 202, text: async () => '' }) as Response) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({});
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('expected an unknown dispatch outcome');
      assert.equal(result.outcome, 'unknown');
      assert.match(result.error, /202/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test('dispatchIngestWorkflow: a thrown network error is reported as outcome unknown', async () => {
  await withEnv({ GH_ACTIONS_TOKEN: 'tok_123', GH_REPO: 'uandiqueue/ourobion' }, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    try {
      const result = await dispatchIngestWorkflow({ seed: 'hydration' });
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('expected an unknown dispatch outcome');
      assert.equal(result.outcome, 'unknown');
      assert.match(result.error, /ECONNRESET/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
