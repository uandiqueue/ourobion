import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AttemptJournal,
  acceptanceAuthorizationHash,
  logicalCallIdSha256,
  type AttemptReservationInput,
} from '../src/attemptJournal.js';
import { RouterAttemptJournalError } from '../src/errors.js';
import { authorizationBinding, testAuthorization } from './helpers.js';

const CHILD_SOURCE = String.raw`
const { existsSync, writeFileSync } = await import('node:fs');
const { setTimeout: delay } = await import('node:timers/promises');
const { AttemptJournal, acceptanceAuthorizationHash } = await import('./src/attemptJournal.ts');
const { AJ_JOURNAL_PATH: journalPath, AJ_BARRIER_PATH: barrierPath } = process.env;
const mode = process.env.AJ_MODE ?? 'reserve';
const logicalCallId = process.env.AJ_LOGICAL_CALL_ID ?? 'verifier:shared-edge';
const reserved = process.env.AJ_RESERVED_USD ?? '1.5';
if (!journalPath || !barrierPath) throw new Error('journal and barrier paths required');

if (mode === 'crash-lock') {
  writeFileSync(journalPath + '.lock', JSON.stringify({ version: 1, pid: process.pid,
    nonce: 'crashed-' + process.pid, startedAt: new Date(Date.now() - 60_000).toISOString() }), 'utf8');
  process.exit(0);
}

while (!existsSync(barrierPath)) await delay(2);
const authorization = { version: 1, authorizationId: 'child-authorization',
  authorizationBasis: 'Child-process finite test authorization; no currency conversion.',
  issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z',
  providers: {
    anthropic: { maxPostStarts: 100, maxReservedUsd: 5, priorPostStarts: 0, priorReservedUsd: 0 },
    openai: { maxPostStarts: 3, maxReservedUsd: 5, priorPostStarts: 0, priorReservedUsd: 0 },
    agnes: { maxPostStarts: 3, maxReservedUsd: 0, priorPostStarts: 0, priorReservedUsd: 0 } } };
const journal = new AttemptJournal(journalPath);
const input = { authorization, authorizationId: authorization.authorizationId,
  authorizationHash: acceptanceAuthorizationHash(authorization),
  authorizationBasis: authorization.authorizationBasis,
  acceptanceRunId: 'process-run', logicalCallId, nodeId: 'synthesis',
  providerFamily: 'anthropic', model: 'claude-test-model', promptHash: 'sha256:' + 'a'.repeat(64),
  inputByteCeiling: 24_000, outputTokenCeiling: 3_072, reservedUsd: Number(reserved),
  price: { billingMode: 'metered', inputUsdPerMTok: 1, outputUsdPerMTok: 1,
    provisional: false, pricingProvenance: 'child test fixture',
    effectiveFrom: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z' } };

for (let retry = 0; retry < 1_000; retry++) {
  try {
    const reservation = journal.reserveAndStart(input); process.stdout.write(JSON.stringify({ ok: true, attempt: reservation.attempt }));
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/lock .*live|cannot create lock|could not be recovered safely|lock .*malformed|invalid shape|cannot read lock/.test(message)) { await delay(2); continue; }
    process.stdout.write(JSON.stringify({ ok: false, message }));
    process.exit(0);
  }
}
throw new Error('lock contention retry budget exhausted');
`;
const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);

function input(overrides: Partial<AttemptReservationInput> = {}): AttemptReservationInput {
  return {
    ...authorizationBinding(),
    acceptanceRunId: 'run-1',
    logicalCallId: 'verifier:edge-1',
    nodeId: 'verifier',
    providerFamily: 'agnes',
    model: 'agnes-test-model',
    promptHash: `sha256:${'b'.repeat(64)}`,
    inputByteCeiling: 24_000,
    outputTokenCeiling: 3_072,
    ...overrides,
    reservedUsd: overrides.reservedUsd ?? 1.5,
    price: overrides.price ?? {
      billingMode: 'metered',
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 1,
      provisional: false,
      pricingProvenance: 'test fixture',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    },
  };
}

function tempJournal(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'attempt-journal-'));
  return { dir, path: join(dir, 'attempts.jsonl') };
}

function child(
  journal: string,
  barrier: string,
  mode = 'reserve',
  logicalCallId?: string,
  reservedUsd = 0.1,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', CHILD_SOURCE],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: {
          ...process.env,
          AJ_JOURNAL_PATH: journal,
          AJ_BARRIER_PATH: barrier,
          AJ_MODE: mode,
          AJ_LOGICAL_CALL_ID: logicalCallId ?? 'verifier:shared-edge',
          AJ_RESERVED_USD: String(reservedUsd),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += String(chunk); });
    proc.stderr.on('data', (chunk) => { stderr += String(chunk); });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('real child-process barrier: exactly three starts survive contention with a valid chain and totals', async () => {
  const { dir, path } = tempJournal();
  try {
    const barrier = join(dir, 'go');
    const children = Array.from({ length: 9 }, () => child(path, barrier));
    await new Promise((resolve) => setTimeout(resolve, 100));
    writeFileSync(barrier, 'go', 'utf8');
    const results = await Promise.all(children);
    for (const result of results) assert.equal(result.code, 0, result.stderr);
    const values = results.map((result) => JSON.parse(result.stdout) as { ok: boolean; attempt?: number; message?: string });
    const successes = values.filter((value) => value.ok);
    assert.equal(successes.length, 3);
    assert.deepEqual(new Set(successes.map((value) => value.attempt)), new Set([1, 2, 3]));
    assert.equal(values.filter((value) => /exhausted its 3 retry-safety POST starts/.test(value.message ?? '')).length, 6);

    const events = new AttemptJournal(path).readEvents();
    assert.equal(events.length, 6);
    assert.deepEqual(events.map((event) => event.sequence), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(new Set(events.map((event) => event.kind)), new Set(['reserved', 'started']));
    assert.ok(Math.abs(events.filter((event) => event.kind === 'reserved').reduce((sum, event) => sum + event.reservedUsd, 0) - 0.3) < 1e-9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('concurrent distinct logical ids cannot race a runtime provider US$5 ceiling', async () => {
  const { dir, path } = tempJournal();
  try {
    const barrier = join(dir, 'go');
    const children = Array.from(
      { length: 6 },
      (_, index) => child(path, barrier, 'reserve', `verifier:distinct-${index}`, 0.9),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    writeFileSync(barrier, 'go', 'utf8');
    const values = (await Promise.all(children)).map((result) => {
      assert.equal(result.code, 0, result.stderr);
      return JSON.parse(result.stdout) as { ok: boolean; message?: string };
    });
    assert.equal(values.filter((value) => value.ok).length, 5);
    assert.equal(values.filter((value) => /would exceed anthropic reserved USD/.test(value.message ?? '')).length, 1);
    const reserved = new AttemptJournal(path).readEvents()
      .filter((event) => event.kind === 'reserved')
      .reduce((sum, event) => sum + event.reservedUsd, 0);
    assert.ok(Math.abs(reserved - 4.5) < 1e-9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime provider cap spans acceptance run ids and prompt/identity are frozen per logical call', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const authorization = testAuthorization((value) => { value.providers.agnes.maxReservedUsd = 5; });
    journal.reserveAndStart(input({ ...authorizationBinding(authorization), reservedUsd: 2.6 }));
    assert.throws(
      () => journal.reserveAndStart(input({ ...authorizationBinding(authorization), acceptanceRunId: 'run-2', logicalCallId: 'synthesis:edge-2', reservedUsd: 2.6 })),
      /would exceed agnes reserved USD/,
    );
    assert.throws(
      () => journal.reserveAndStart(input({ ...authorizationBinding(authorization), promptHash: `sha256:${'c'.repeat(64)}` })),
      /changed identity, prompt, or ceilings/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime authorization requires non-empty provenance, is finite, and hashes provenance changes', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path, { now: () => NOW });
    const valid = testAuthorization();
    const changed = testAuthorization((value) => { value.authorizationBasis = 'Different owner directive and conversion rationale.'; });
    assert.notEqual(acceptanceAuthorizationHash(valid), acceptanceAuthorizationHash(changed));

    const blank = testAuthorization((value) => { value.authorizationBasis = '   '; });
    assert.throws(
      () => journal.reserveAndStart(input({ ...authorizationBinding(blank) })),
      /authorization version\/id is invalid/,
    );
    const expired = testAuthorization((value) => { value.expiresAt = '2026-07-30T00:00:00.000Z'; });
    assert.throws(
      () => journal.reserveAndStart(input({ ...authorizationBinding(expired) })),
      /authorization is not effective/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime provider accounting includes declared prior starts and prior spend', () => {
  const starts = tempJournal();
  const spend = tempJournal();
  try {
    const startAuthorization = testAuthorization((value) => {
      value.providers.agnes = { maxPostStarts: 2, maxReservedUsd: 3, priorPostStarts: 1, priorReservedUsd: 2.5 };
    });
    const startJournal = new AttemptJournal(starts.path);
    const first = startJournal.reserveAndStart(input({ ...authorizationBinding(startAuthorization), reservedUsd: 0.4 }));
    assert.equal(first.authorizationBasis, startAuthorization.authorizationBasis);
    assert.throws(
      () => startJournal.reserveAndStart(input({
        ...authorizationBinding(startAuthorization), logicalCallId: 'verifier:second', reservedUsd: 0.05,
      })),
      /would exceed agnes POST starts.*including prior starts/,
    );

    const spendAuthorization = testAuthorization((value) => {
      value.providers.agnes = { maxPostStarts: 100, maxReservedUsd: 5, priorPostStarts: 0, priorReservedUsd: 4.9 };
    });
    assert.throws(
      () => new AttemptJournal(spend.path).reserveAndStart(input({
        ...authorizationBinding(spendAuthorization), reservedUsd: 0.2,
      })),
      /would exceed agnes reserved USD.*including prior spend/,
    );
  } finally {
    rmSync(starts.dir, { recursive: true, force: true });
    rmSync(spend.dir, { recursive: true, force: true });
  }
});

test('zero-dollar reservations require complete immutable free-price metadata', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const freePrice = {
      billingMode: 'free' as const,
      inputUsdPerMTok: 0,
      outputUsdPerMTok: 0,
      provisional: false as const,
      pricingProvenance: 'owner-confirmed free plan',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    };
    const reservation = journal.reserveAndStart(input({ reservedUsd: 0, price: freePrice }));
    assert.equal(reservation.reservedUsd, 0);
    assert.deepEqual(journal.readEvents().map((event) => event.price), [freePrice, freePrice]);
    assert.throws(
      () => journal.reserveAndStart(input({
        logicalCallId: 'verifier:metered-zero',
        reservedUsd: 0,
      })),
      /price metadata or reservedUsd is invalid/,
    );
    assert.throws(
      () => journal.reserveAndStart(input({
        logicalCallId: 'verifier:free-positive',
        reservedUsd: 0.01,
        price: freePrice,
      })),
      /price metadata or reservedUsd is invalid/,
    );
    assert.throws(
      () => journal.reserveAndStart(input({
        logicalCallId: 'verifier:free-no-source',
        reservedUsd: 0,
        price: { ...freePrice, pricingProvenance: '   ' },
      })),
      /price metadata or reservedUsd is invalid/,
    );
    assert.throws(
      () => journal.reserveAndStart({
        ...input({ logicalCallId: 'verifier:null-price', reservedUsd: 0 }),
        price: null,
      } as unknown as AttemptReservationInput),
      /price metadata or reservedUsd is invalid/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime family caps include prior starts and frozen family/model cannot widen them', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const authorization = testAuthorization((value) => {
      value.providers.agnes = { maxPostStarts: 10, maxReservedUsd: 100, priorPostStarts: 0, priorReservedUsd: 0 };
      value.providers.anthropic = { maxPostStarts: 3, maxReservedUsd: 100, priorPostStarts: 0, priorReservedUsd: 0 };
    });
    let tenth;
    for (let index = 1; index <= 10; index++) tenth = journal.reserveAndStart(input({
      ...authorizationBinding(authorization), acceptanceRunId: `agnes-run-${index}`,
      logicalCallId: `verifier:agnes-${index}`, reservedUsd: 0.1,
    }));
    assert.equal(tenth!.attempt, 1);
    assert.throws(() => journal.reserveAndStart(input({
      ...authorizationBinding(authorization), acceptanceRunId: 'agnes-run-11',
      logicalCallId: 'verifier:agnes-11', reservedUsd: 0.1,
    })), /would exceed agnes POST starts/);
    const anthropic = {
      logicalCallId: 'synthesis:stable', nodeId: 'synthesis' as const,
      providerFamily: 'anthropic' as const, model: 'claude-test-model', reservedUsd: 0.1,
    };
    let third;
    for (let index = 1; index <= 3; index++) third = journal.reserveAndStart(input({
      ...authorizationBinding(authorization), ...anthropic, logicalCallId: `synthesis:stable-${index}`,
      acceptanceRunId: `anthropic-run-${index}`,
    }));
    assert.equal(third!.attempt, 1);
    assert.throws(() => journal.reserveAndStart(input({
      ...authorizationBinding(authorization), ...anthropic, logicalCallId: 'synthesis:stable-4', acceptanceRunId: 'anthropic-run-4',
    })), /would exceed anthropic POST starts/);

    const frozen = tempJournal();
    const frozenJournal = new AttemptJournal(frozen.path);
    const stable = input({ ...authorizationBinding(authorization), ...anthropic });
    frozenJournal.reserveAndStart(stable);
    assert.throws(() => frozenJournal.reserveAndStart(input({ ...authorizationBinding(authorization), ...anthropic, providerFamily: 'agnes', model: 'agnes-forged' })),
      /changed identity, prompt, or ceilings/);
    assert.throws(() => frozenJournal.reserveAndStart(input({ ...authorizationBinding(authorization), ...anthropic, model: 'claude-forged' })),
      /changed identity, prompt, or ceilings/);
    rmSync(frozen.dir, { recursive: true, force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real pair and edge ids are stably hashed into bounded ids before reserve/start', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const pairId = logicalCallIdSha256('synthesis', 'pair:a|b');
    const edgeId = logicalCallIdSha256('verifier', 'subject|correlates|object');
    assert.match(pairId, /^synthesis:[0-9a-f]{64}$/);
    assert.match(edgeId, /^verifier:[0-9a-f]{64}$/);
    journal.reserveAndStart(input({
      logicalCallId: pairId,
      nodeId: 'synthesis',
      providerFamily: 'anthropic',
      model: 'claude-test-model',
      reservedUsd: 0.1,
    }));
    journal.reserveAndStart(input({ logicalCallId: edgeId, reservedUsd: 0.1 }));
    assert.equal(journal.readEvents().filter((event) => event.kind === 'started').length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt, truncated, tampered, and unreadable old journals all fail closed', () => {
  const { dir, path } = tempJournal();
  try {
    writeFileSync(path, '{not json}\n', 'utf8');
    assert.throws(() => new AttemptJournal(path).readEvents(), /invalid JSON/);

    writeFileSync(path, '{}', 'utf8');
    assert.throws(() => new AttemptJournal(path).readEvents(), /truncated final line/);

    rmSync(path, { force: true });
    const valid = new AttemptJournal(path);
    valid.reserveAndStart(input());
    writeFileSync(path, readFileSync(path, 'utf8').replace('"reservedUsd":1.5', '"reservedUsd":1.6'), 'utf8');
    assert.throws(() => new AttemptJournal(path).readEvents(), /hash mismatch/);

    const denied = Object.assign(new Error('denied'), { code: 'EACCES' });
    const unreadable = new AttemptJournal(path, {
      readText: (target) => target === path ? (() => { throw denied; })() : readFileSync(target, 'utf8'),
    });
    assert.throws(() => unreadable.reserveAndStart(input()), /cannot read journal/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('malformed, future, unexpired, and expired-but-live locks fail closed', () => {
  const cases: Array<{ name: string; lock: unknown; pattern: RegExp; alive?: boolean }> = [
    { name: 'malformed', lock: '{', pattern: /malformed/ },
    { name: 'future', lock: { version: 1, pid: 999999, nonce: 'n', startedAt: new Date(NOW + 1).toISOString() }, pattern: /future-dated/ },
    { name: 'unexpired', lock: { version: 1, pid: 999999, nonce: 'n', startedAt: new Date(NOW).toISOString() }, pattern: /live/ },
    { name: 'live-pid', lock: { version: 1, pid: 42, nonce: 'n', startedAt: new Date(NOW - 60_000).toISOString() }, pattern: /still live/, alive: true },
  ];
  for (const c of cases) {
    const { dir, path } = tempJournal();
    try {
      writeFileSync(`${path}.lock`, typeof c.lock === 'string' ? c.lock : JSON.stringify(c.lock), 'utf8');
      const journal = new AttemptJournal(path, {
        now: () => NOW,
        lockTtlMs: 30_000,
        isPidAlive: () => c.alive === true,
      });
      assert.throws(() => journal.reserveAndStart(input()), c.pattern, c.name);
      assert.equal(existsSync(`${path}.lock`), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('a crashed child leaves a stale lock that is recovered only after its pid is dead', async () => {
  const { dir, path } = tempJournal();
  try {
    const barrier = join(dir, 'unused');
    const crashed = await child(path, barrier, 'crash-lock');
    assert.equal(crashed.code, 0, crashed.stderr);
    assert.equal(existsSync(`${path}.lock`), true);
    const reservation = new AttemptJournal(path, { lockTtlMs: 1 }).reserveAndStart(input());
    assert.equal(reservation.attempt, 1);
    assert.equal(existsSync(`${path}.lock`), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('expired-lock recovery never unlinks a nonce replacement observed mid-check', () => {
  const { dir, path } = tempJournal();
  try {
    const old = { version: 1, pid: 999999, nonce: 'old', startedAt: new Date(NOW - 60_000).toISOString() };
    const replacement = { ...old, nonce: 'replacement' };
    writeFileSync(`${path}.lock`, JSON.stringify(old), 'utf8');
    let lockReads = 0;
    const journal = new AttemptJournal(path, {
      now: () => NOW,
      isPidAlive: () => false,
      readText: (target) => {
        if (target !== `${path}.lock`) return readFileSync(target, 'utf8');
        lockReads++;
        if (lockReads === 2) writeFileSync(target, JSON.stringify(replacement), 'utf8');
        return readFileSync(target, 'utf8');
      },
    });
    assert.throws(() => journal.reserveAndStart(input()), /changed during expired-lock recovery/);
    assert.equal(JSON.parse(readFileSync(`${path}.lock`, 'utf8')).nonce, 'replacement');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fsync failure denies the reservation and never permits an unjournaled start', () => {
  const { dir, path } = tempJournal();
  try {
    let syncs = 0;
    const journal = new AttemptJournal(path, {
      fsync: () => {
        syncs++;
        if (syncs === 2) throw new Error('fsync injected failure');
      },
    });
    assert.throws(() => journal.reserveAndStart(input()), /fsync injected failure/);
    assert.equal(new AttemptJournal(path).readEvents().filter((event) => event.kind === 'reserved').length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unknown reservation outcomes are retained and count in full', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const reservation = journal.reserveAndStart(input());
    journal.record(reservation, 'unknown', { errorClass: 'TypeError' });
    const events = journal.readEvents();
    assert.deepEqual(events.map((event) => event.kind), ['reserved', 'started', 'unknown']);
    assert.equal(events[2]!.errorClass, 'TypeError');
    assert.throws(
      () => journal.record({ ...reservation, attempt: 2 }, 'failed'),
      (error: unknown) => error instanceof RouterAttemptJournalError && /unknown attempt/.test(error.message),
    );
    assert.throws(
      () => journal.record(reservation, 'response'),
      /already has a terminal outcome/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('terminal outcomes cannot mutate any immutable reservation field', () => {
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const reservation = journal.reserveAndStart(input());
    const mutations: Array<[string, typeof reservation]> = [
      ['acceptanceRunId', { ...reservation, acceptanceRunId: 'run-other' }],
      ['authorizationBasis', { ...reservation, authorizationBasis: 'changed basis' }],
      ['logicalCallId', { ...reservation, logicalCallId: 'verifier:other' }],
      ['nodeId', { ...reservation, nodeId: 'synthesis' }],
      ['providerFamily', { ...reservation, providerFamily: 'anthropic' }],
      ['model', { ...reservation, model: 'other-model' }],
      ['attempt', { ...reservation, attempt: 2 }],
      ['promptHash', { ...reservation, promptHash: `sha256:${'c'.repeat(64)}` }],
      ['inputByteCeiling', { ...reservation, inputByteCeiling: 23_999 }],
      ['outputTokenCeiling', { ...reservation, outputTokenCeiling: 3_071 }],
      ['reservedUsd', { ...reservation, reservedUsd: 0.01 }],
      ['price mode', { ...reservation, price: { ...reservation.price, billingMode: 'free' } }],
      ['price input', { ...reservation, price: { ...reservation.price, inputUsdPerMTok: 2 } }],
      ['price output', { ...reservation, price: { ...reservation.price, outputUsdPerMTok: 2 } }],
      ['price source', { ...reservation, price: { ...reservation.price, pricingProvenance: 'changed' } }],
    ];
    for (const [field, mutated] of mutations) {
      assert.throws(
        () => journal.record(mutated, 'response'),
        /unknown attempt|changed immutable reservation fields/,
        field,
      );
    }
    assert.doesNotThrow(() => journal.record(reservation, 'response'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy positive-price journals replay, while legacy zero-price lines fail closed', () => {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  const rewriteAsLegacy = (path: string, reservedUsd?: number): void => {
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, unknown>);
    let previousHash: string | null = null;
    for (const line of lines) {
      delete line.price;
      if (reservedUsd !== undefined) line.reservedUsd = reservedUsd;
      line.previousHash = previousHash;
      const withoutHash = { ...line };
      delete withoutHash.eventHash;
      line.eventHash = `sha256:${createHash('sha256').update(canonical(withoutHash)).digest('hex')}`;
      previousHash = line.eventHash as string;
    }
    writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
  };

  const positive = tempJournal();
  const zero = tempJournal();
  try {
    new AttemptJournal(positive.path).reserveAndStart(input());
    rewriteAsLegacy(positive.path);
    assert.equal(new AttemptJournal(positive.path).readEvents().length, 2);

    new AttemptJournal(zero.path).reserveAndStart(input());
    rewriteAsLegacy(zero.path, 0);
    assert.throws(() => new AttemptJournal(zero.path).readEvents(), /invalid shape or chain position/);
  } finally {
    rmSync(positive.dir, { recursive: true, force: true });
    rmSync(zero.dir, { recursive: true, force: true });
  }
});

test('replay rejects a terminal line whose re-hashed identity conflicts with its reservation', () => {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  const { dir, path } = tempJournal();
  try {
    const journal = new AttemptJournal(path);
    const reservation = journal.reserveAndStart(input());
    journal.record(reservation, 'response');
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, unknown>);
    const terminal = lines.at(-1)!;
    terminal.model = 'agnes-mutated-model';
    const withoutHash = { ...terminal };
    delete withoutHash.eventHash;
    terminal.eventHash = `sha256:${createHash('sha256').update(canonical(withoutHash)).digest('hex')}`;
    writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
    assert.throws(
      () => new AttemptJournal(path).readEvents(),
      /duplicate, conflicting, or premature terminal outcome/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('router-owned root rejects out-of-root paths and junction/symlink aliases', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'attempt-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'attempt-outside-'));
  try {
    assert.throws(
      () => new AttemptJournal(join(outside, 'attempts.jsonl'), { allowedRoot: root }).reserveAndStart(input()),
      /outside its router-owned runtime root/,
    );
    const alias = join(root, 'alias');
    try {
      symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        t.skip('host does not permit creating a junction/symlink');
        return;
      }
      throw error;
    }
    const aliased = new AttemptJournal(join(alias, 'attempts.jsonl'), { allowedRoot: root });
    let fetches = 0;
    assert.throws(
      () => {
        aliased.assertRouterOwnedRoot(root);
        fetches++;
      },
      /symlink, junction, or alias/,
    );
    assert.equal(fetches, 0, 'junction is rejected before a caller could fetch');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
