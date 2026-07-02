/**
 * Host-memory guard tests (design note in `run.ts`'s docstring) — node:test, via tsx.
 *
 * NO real timers, NO real OS memory reads: `freemem`/`totalmem`/`sleep` are all
 * injected. Proves:
 *  - `checkMemory` classifies pressure by BOTH the fraction and absolute-byte
 *    thresholds (either one tripping counts as under pressure);
 *  - `waitForMemory` is a no-op (no sleep, no log) when memory is fine;
 *  - it rechecks up to `maxWaits` times and returns as soon as memory recovers;
 *  - it ALWAYS returns (never throws, never signals "skip this paper") even
 *    when pressure never eases — soft-fail by design, see module docstring.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkMemory, waitForMemory, formatMemoryStatus } from '../src/limits/memoryGuard.js';

const GB = 1024 * 1024 * 1024;

test('checkMemory: comfortable memory is not under pressure', () => {
  const status = checkMemory({
    freemem: () => 4 * GB,
    totalmem: () => 16 * GB,
  });
  assert.equal(status.underPressure, false);
  assert.ok(Math.abs(status.freeFraction - 0.25) < 1e-9);
});

test('checkMemory: below the fraction threshold trips pressure even with plenty of absolute bytes', () => {
  // 5% of a 64GB machine is 3.2GB — well above the 512MB absolute floor, but
  // still below the 10% fractional threshold.
  const status = checkMemory({
    freemem: () => 3.2 * GB,
    totalmem: () => 64 * GB,
  });
  assert.equal(status.underPressure, true);
});

test('checkMemory: below the absolute-byte floor trips pressure even with a healthy fraction', () => {
  // 20% of a 2GB machine is only 400MB — above the fractional threshold's
  // *ratio* but below the 512MB absolute floor.
  const status = checkMemory({
    freemem: () => 400 * 1024 * 1024,
    totalmem: () => 2 * GB,
    minFreeFraction: 0.1,
  });
  assert.ok(status.freeFraction > 0.1, 'fraction alone looks fine');
  assert.equal(status.underPressure, true, 'the absolute floor still trips');
});

test('checkMemory: custom thresholds are honored', () => {
  const status = checkMemory({
    freemem: () => 1 * GB,
    totalmem: () => 16 * GB,
    minFreeFraction: 0.5, // deliberately strict
    minFreeBytes: 0,
  });
  assert.equal(status.underPressure, true);
});

test('formatMemoryStatus renders MB and a percentage', () => {
  const text = formatMemoryStatus({ freeBytes: 500 * 1024 * 1024, totalBytes: 16 * GB, freeFraction: 0.03, underPressure: true });
  assert.match(text, /500 MB free/);
  assert.match(text, /3\.0%/);
});

test('waitForMemory: comfortable memory is a true no-op (no sleep, no log)', async () => {
  let slept = 0;
  const logs: string[] = [];
  await waitForMemory(
    { freemem: () => 8 * GB, totalmem: () => 16 * GB, sleep: async () => { slept++; } },
    (l) => logs.push(l),
  );
  assert.equal(slept, 0);
  assert.equal(logs.length, 0);
});

test('waitForMemory: recovers partway through and stops rechecking', async () => {
  let calls = 0;
  const logs: string[] = [];
  await waitForMemory(
    {
      // Under pressure for the first 2 reads, comfortable from the 3rd on.
      freemem: () => (++calls <= 2 ? 200 * 1024 * 1024 : 8 * GB),
      totalmem: () => 16 * GB,
      maxWaits: 5,
      sleep: async () => {},
    },
    (l) => logs.push(l),
  );
  // 1 initial check (pressure) + 2 more checks inside the loop (2nd still
  // pressured, 3rd recovers) = 3 reads of freemem total.
  assert.equal(calls, 3);
  assert.ok(logs.some((l) => l.includes('pausing')));
  assert.ok(logs.some((l) => l.includes('recovered')));
});

test('waitForMemory: gives up after maxWaits but still returns (soft-fail)', async () => {
  const logs: string[] = [];
  let sleepCount = 0;
  await waitForMemory(
    {
      freemem: () => 100 * 1024 * 1024, // always tight
      totalmem: () => 16 * GB,
      maxWaits: 3,
      sleep: async () => { sleepCount++; },
    },
    (l) => logs.push(l),
  );
  assert.equal(sleepCount, 3, 'waited exactly maxWaits times');
  assert.ok(logs.some((l) => l.includes('still tight')));
  assert.ok(logs.some((l) => l.includes('proceeding anyway')));
});

test('waitForMemory: maxWaits=0 checks once, logs once, never sleeps', async () => {
  const logs: string[] = [];
  let sleepCount = 0;
  await waitForMemory(
    {
      freemem: () => 100 * 1024 * 1024,
      totalmem: () => 16 * GB,
      maxWaits: 0,
      sleep: async () => { sleepCount++; },
    },
    (l) => logs.push(l),
  );
  assert.equal(sleepCount, 0);
  assert.ok(logs.some((l) => l.includes('proceeding anyway')));
});
