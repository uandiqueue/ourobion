/**
 * Local-agent mailbox tests — the keyless route. Proves the fulfillment
 * contract round-trip with the response file written BY THE TEST (playing the
 * hosting agent session), timeout behaviour with an injected clock, error
 * responses, half-written-JSON tolerance, and usage estimation when the
 * fulfiller reports none. No network, no keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  requestLocalAgent,
  requestPath,
  responsePath,
  type MailboxRequestFile,
  type MailboxResponseFile,
} from '../src/routes/localAgent.js';
import { RouterTimeoutError } from '../src/errors.js';
import { estimateTokens, type LlmRequest } from '../src/types.js';

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'llm-mailbox-'));
}

/** Fulfiller-side atomic write, as the README contract prescribes. */
function writeResponse(dir: string, id: string, body: MailboxResponseFile): void {
  writeFileSync(responsePath(dir, id), JSON.stringify(body), 'utf8');
}

const req: LlmRequest = {
  nodeId: 'seeder',
  system: 'You seed research queries.',
  prompt: 'Given derivedFrom[] of hrv, propose 3 queries.',
  expectJson: true,
};

test('round-trip: request file matches the contract; response resolves the call', async () => {
  const dir = freshDir();
  try {
    // Injected sleep plays the fulfilling agent: on first poll-sleep, read the
    // request file, "answer" it, and write the response.
    const sleep = async (): Promise<void> => {
      const onDisk = JSON.parse(readFileSync(requestPath(dir, 'req-1'), 'utf8')) as MailboxRequestFile;
      // The contract's input half, exactly:
      assert.equal(onDisk.version, 1);
      assert.equal(onDisk.id, 'req-1');
      assert.equal(onDisk.nodeId, 'seeder');
      assert.equal(onDisk.model, 'claude-sonnet-5'); // the model HINT
      assert.equal(onDisk.system, req.system);
      assert.equal(onDisk.prompt, req.prompt);
      assert.equal(onDisk.maxOutputTokens, 8000);
      assert.equal(onDisk.expectJson, true);
      assert.ok(typeof onDisk.createdAt === 'string' && !Number.isNaN(Date.parse(onDisk.createdAt)));

      writeResponse(dir, 'req-1', {
        id: 'req-1',
        status: 'ok',
        text: '{"queries":["a","b","c"]}',
        model: 'claude-fable-5',
        usage: { inputTokens: 12, outputTokens: 34 },
      });
    };

    const res = await requestLocalAgent(req, 'claude-sonnet-5', 8000, {
      dir,
      timeoutMs: 5000,
      pollIntervalMs: 1,
      id: 'req-1',
      sleep,
    });

    assert.equal(res.text, '{"queries":["a","b","c"]}');
    assert.deepEqual(res.usage, { inputTokens: 12, outputTokens: 34 });
    assert.equal(res.model, 'claude-fable-5', 'fulfiller-reported model wins over the hint');
    assert.equal(res.route, 'local_agent');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing usage → estimated (~4 chars/token); missing model → the hint', async () => {
  const dir = freshDir();
  try {
    const replyText = 'no usage meter in an agent session';
    const sleep = async (): Promise<void> => {
      writeResponse(dir, 'req-2', { id: 'req-2', status: 'ok', text: replyText });
    };
    const res = await requestLocalAgent(req, 'claude-sonnet-5', 8000, {
      dir,
      timeoutMs: 5000,
      pollIntervalMs: 1,
      id: 'req-2',
      sleep,
    });
    assert.equal(res.model, 'claude-sonnet-5');
    assert.deepEqual(res.usage, {
      inputTokens: estimateTokens((req.system ?? '') + req.prompt),
      outputTokens: estimateTokens(replyText),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fulfiller error response → rejects with the reported reason', async () => {
  const dir = freshDir();
  try {
    const sleep = async (): Promise<void> => {
      writeResponse(dir, 'req-3', { id: 'req-3', status: 'error', error: 'prompt refused by host' });
    };
    await assert.rejects(
      requestLocalAgent(req, 'claude-sonnet-5', 8000, {
        dir,
        timeoutMs: 5000,
        pollIntervalMs: 1,
        id: 'req-3',
        sleep,
      }),
      /fulfiller reported an error.*prompt refused by host/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no response within timeoutMs → typed RouterTimeoutError (injected clock)', async () => {
  const dir = freshDir();
  try {
    // Clock advances 100 "ms" per poll-sleep; timeout 1000 → ~10 polls then throw.
    let clock = 0;
    const now = (): number => clock;
    const sleep = async (): Promise<void> => {
      clock += 100;
    };
    await assert.rejects(
      requestLocalAgent(req, 'claude-sonnet-5', 8000, {
        dir,
        timeoutMs: 1000,
        pollIntervalMs: 100,
        id: 'req-4',
        now,
        sleep,
      }),
      (err: unknown) =>
        err instanceof RouterTimeoutError && err.requestId === 'req-4' && err.timeoutMs === 1000,
    );
    // The unanswered request file stays behind for the fulfiller/audit.
    assert.doesNotThrow(() => readFileSync(requestPath(dir, 'req-4'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('half-written response JSON is tolerated (treated as not-ready), then read once valid', async () => {
  const dir = freshDir();
  try {
    let polls = 0;
    const sleep = async (): Promise<void> => {
      polls += 1;
      if (polls === 1) {
        // Simulate a fulfiller mid-write: invalid JSON on disk.
        writeFileSync(responsePath(dir, 'req-5'), '{"id":"req-5","status":"ok","text":"tru', 'utf8');
      } else if (polls === 2) {
        writeResponse(dir, 'req-5', { id: 'req-5', status: 'ok', text: 'complete now' });
      }
    };
    const res = await requestLocalAgent(req, 'claude-sonnet-5', 8000, {
      dir,
      timeoutMs: 5000,
      pollIntervalMs: 1,
      id: 'req-5',
      sleep,
    });
    assert.equal(res.text, 'complete now');
    assert.ok(polls >= 2, 'the invalid write forced at least one extra poll');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a response file with a mismatched id is ignored (keeps polling until the right one)', async () => {
  const dir = freshDir();
  try {
    let polls = 0;
    const sleep = async (): Promise<void> => {
      polls += 1;
      if (polls === 1) {
        writeResponse(dir, 'req-6', { id: 'someone-else', status: 'ok', text: 'not yours' });
      } else {
        writeResponse(dir, 'req-6', { id: 'req-6', status: 'ok', text: 'yours' });
      }
    };
    const res = await requestLocalAgent(req, 'claude-sonnet-5', 8000, {
      dir,
      timeoutMs: 5000,
      pollIntervalMs: 1,
      id: 'req-6',
      sleep,
    });
    assert.equal(res.text, 'yours');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
