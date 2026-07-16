// Coupling guard: brain-endpoint-to-registry (docs/graph/couplings.yaml). Edge endpoints
// (subject / object) are canonical shared/metrics registry keys with no import linking the
// artifacts to the registry (shared/brain/relationships.ts header: "every endpoint must resolve
// to an active registry metric"). Two layers hold that:
//   1. the loader pipeline itself hard-fails on a non-active endpoint (parseClaims), and
//   2. this guard proves both the enforcement and that the shipped fixtures resolve.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseClaims, metricsRegistry } from '../lib/artifacts.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'edges');
const claimsText = readFileSync(path.join(FIXTURES, 'claims.jsonl'), 'utf8');

test('every fixture edge endpoint resolves to an active shared/metrics registry key', () => {
  const { records, errors } = parseClaims(claimsText);
  assert.deepEqual(errors, []);
  assert.ok(records.length > 0);
  for (const { record } of records) {
    assert.ok(
      metricsRegistry.isActiveMetric(record.subject),
      `${record.edgeId}: subject '${record.subject}' not an active registry metric`,
    );
    assert.ok(
      metricsRegistry.isActiveMetric(record.object),
      `${record.edgeId}: object '${record.object}' not an active registry metric`,
    );
  }
});

test('the loader rejects endpoints the registry does not carry as active', () => {
  // Snake-case (passes zod) but not a registry key at all.
  const unknown = JSON.parse(claimsText.split('\n')[0]!);
  unknown.subject = 'made_up_metric';
  unknown.edgeId = `made_up_metric|${unknown.relation}|${unknown.object}`;
  const res = parseClaims(JSON.stringify(unknown));
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0]!.message, /subject 'made_up_metric' is not an active/);
});
