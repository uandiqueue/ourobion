// Vectors holding the S5 personal_signals lifecycle helper
// (supabase/functions/evaluate-signals/lifecycle.ts) to the audit-A19 fix: the stale-pair
// diff that keeps personal_signals a pure function of the current data (delete-on-loss,
// the D13 upsert+prune model). The handler's scoped DELETE consumes this module's output;
// the delete itself is exercised live (see the U22 session log) — this suite pins the pure
// decision logic.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStalePairs,
  pairEligibilityKey,
  type PairRowRef,
} from '../../../supabase/functions/evaluate-signals/lifecycle.ts';

const row = (user_id: string, metric_a: string, metric_b: string): PairRowRef => ({
  user_id,
  metric_a,
  metric_b,
});

test('pairEligibilityKey is injective across its three parts', () => {
  // Space-delimited: user ids are UUIDs and metric keys are ^[a-z0-9_]+$ — neither contains
  // a space, so distinct triples can never collide.
  assert.equal(pairEligibilityKey('u1', 'a', 'b'), 'u1 a b');
  assert.notEqual(pairEligibilityKey('u1', 'a', 'b'), pairEligibilityKey('u1', 'b', 'a'));
  assert.notEqual(pairEligibilityKey('u1', 'a', 'b'), pairEligibilityKey('u2', 'a', 'b'));
});

test('still-eligible pairs are never stale; lost pairs are', () => {
  const eligible = new Set([
    pairEligibilityKey('u1', 'sleep', 'steps'),
    pairEligibilityKey('u1', 'hrv', 'sleep'),
  ]);
  const existing = [
    row('u1', 'sleep', 'steps'), // still eligible → kept
    row('u1', 'hrv', 'sleep'), // still eligible → kept
    row('u1', 'mood', 'steps'), // lost eligibility → stale
  ];
  const stale = computeStalePairs(eligible, existing);
  assert.deepEqual([...stale.keys()], ['u1']);
  assert.deepEqual(stale.get('u1'), [{ metricA: 'mood', metricB: 'steps' }]);
});

test('a user with existing rows but nothing eligible this run loses ALL rows', () => {
  const eligible = new Set([pairEligibilityKey('u1', 'sleep', 'steps')]);
  const existing = [row('u2', 'hrv', 'sleep'), row('u2', 'mood', 'steps')];
  const stale = computeStalePairs(eligible, existing);
  assert.deepEqual(stale.get('u2'), [
    { metricA: 'hrv', metricB: 'sleep' },
    { metricA: 'mood', metricB: 'steps' },
  ]);
});

test('stale sets are scoped per user: same pair, different users, independent verdicts', () => {
  const eligible = new Set([pairEligibilityKey('u1', 'sleep', 'steps')]);
  const existing = [row('u1', 'sleep', 'steps'), row('u2', 'sleep', 'steps')];
  const stale = computeStalePairs(eligible, existing);
  assert.equal(stale.has('u1'), false); // u1's pair is current
  assert.deepEqual(stale.get('u2'), [{ metricA: 'sleep', metricB: 'steps' }]); // u2's is not
});

test('empty existing set → nothing to prune (empty map)', () => {
  const stale = computeStalePairs(new Set([pairEligibilityKey('u1', 'a', 'b')]), []);
  assert.equal(stale.size, 0);
});

test('empty eligible set marks every existing row stale (handler guards the no-users case)', () => {
  // The pure diff is total: with no eligible pairs, everything is stale. The HANDLER refuses
  // to run the prune when the S2 view returned zero users (suspect input, A14 lesson) — that
  // guard lives in index.ts, not here.
  const existing = [row('u1', 'a', 'b'), row('u2', 'a', 'b')];
  const stale = computeStalePairs(new Set(), existing);
  assert.equal(stale.size, 2);
  assert.equal(stale.get('u1')!.length, 1);
  assert.equal(stale.get('u2')!.length, 1);
});
