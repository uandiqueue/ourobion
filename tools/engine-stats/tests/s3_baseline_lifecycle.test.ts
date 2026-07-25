// Vectors holding the S3 baseline_snapshots lifecycle helper
// (supabase/functions/compute-baselines/lifecycle.ts) to the O19 fix (verdict H2): the
// stale-snapshot diff that keeps baseline_snapshots a pure function of the current S2
// projection (delete-on-loss, the D13 upsert+prune model — the personal_signals lifecycle
// pattern mirrored onto snapshots). The handler's scoped DELETE consumes this module's output;
// the delete itself is exercised live (see the U5 session log) — this suite pins the pure
// decision logic, including the THREE mandatory O19 scenarios: last-row deletion, metric
// deprecation, partial user loss.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStaleSnapshots,
  snapshotKey,
  type SnapshotRowRef,
} from '../../../supabase/functions/compute-baselines/lifecycle.ts';

const row = (user_id: string, metric_key: string): SnapshotRowRef => ({ user_id, metric_key });

test('snapshotKey is injective across its two parts', () => {
  // Space-delimited: user ids are UUIDs and metric keys are ^[a-z0-9_]+$ — neither contains
  // a space, so distinct (user, metric) pairs can never collide.
  assert.equal(snapshotKey('u1', 'hrv_sdnn_ms'), 'u1 hrv_sdnn_ms');
  assert.notEqual(snapshotKey('u1', 'a'), snapshotKey('u2', 'a'));
  assert.notEqual(snapshotKey('u1', 'a'), snapshotKey('u1', 'b'));
});

test('O19 gate · last-row deletion: a metric whose raw rows are all gone loses its snapshot', () => {
  // u1 once logged sleep (snapshot exists); every raw sleep row was deleted, so the current
  // projection has no (u1, sleep) series at all → the snapshot is stale.
  const current = new Set([snapshotKey('u1', 'hrv_sdnn_ms')]); // only hrv survives this run
  const existing = [row('u1', 'hrv_sdnn_ms'), row('u1', 'sleep_duration_min')];
  const stale = computeStaleSnapshots(current, existing);
  assert.deepEqual([...stale.keys()], ['u1']);
  assert.deepEqual(stale.get('u1'), ['sleep_duration_min']);
});

test('O19 gate · metric deprecation: a metric removed from the projection is pruned for EVERY user', () => {
  // The registry deprecates mood_score (status flips off active / baselineApplicable), so no
  // user's current projection contains it — every user's mood snapshot is stale, nothing else.
  const current = new Set([
    snapshotKey('u1', 'sleep_duration_min'),
    snapshotKey('u2', 'sleep_duration_min'),
  ]);
  const existing = [
    row('u1', 'sleep_duration_min'),
    row('u1', 'mood_score'),
    row('u2', 'sleep_duration_min'),
    row('u2', 'mood_score'),
  ];
  const stale = computeStaleSnapshots(current, existing);
  assert.deepEqual(stale.get('u1'), ['mood_score']);
  assert.deepEqual(stale.get('u2'), ['mood_score']);
});

test('O19 gate · partial user loss: user keeps metric A, loses metric B → only B pruned', () => {
  const current = new Set([
    snapshotKey('u1', 'sleep_duration_min'), // A: still projected
    // (u1, hrv_sdnn_ms) absent — B lost
    snapshotKey('u2', 'hrv_sdnn_ms'), // another user's hrv is untouched
  ]);
  const existing = [
    row('u1', 'sleep_duration_min'),
    row('u1', 'hrv_sdnn_ms'),
    row('u2', 'hrv_sdnn_ms'),
  ];
  const stale = computeStaleSnapshots(current, existing);
  assert.deepEqual([...stale.keys()], ['u1']);
  assert.deepEqual(stale.get('u1'), ['hrv_sdnn_ms']);
  assert.equal(stale.has('u2'), false);
});

test('still-current snapshots are never stale (empty map when nothing was lost)', () => {
  const current = new Set([snapshotKey('u1', 'a'), snapshotKey('u1', 'b')]);
  const stale = computeStaleSnapshots(current, [row('u1', 'a'), row('u1', 'b')]);
  assert.equal(stale.size, 0);
});

test('a user with existing snapshots but nothing in the current projection loses ALL rows', () => {
  const current = new Set([snapshotKey('u1', 'a')]);
  const existing = [row('u2', 'a'), row('u2', 'b')];
  const stale = computeStaleSnapshots(current, existing);
  assert.deepEqual(stale.get('u2'), ['a', 'b']);
});

test('empty existing set → nothing to prune (empty map)', () => {
  const stale = computeStaleSnapshots(new Set([snapshotKey('u1', 'a')]), []);
  assert.equal(stale.size, 0);
});

test('empty current set marks every existing row stale (handler guards the zero-row case)', () => {
  // The pure diff is total: with no current snapshots, everything is stale. The HANDLER
  // refuses to run the prune when the S2 read returned zero rows (successful-empty-input
  // policy, the A14 lesson) — that guard lives in index.ts, not here.
  const existing = [row('u1', 'a'), row('u2', 'b')];
  const stale = computeStaleSnapshots(new Set(), existing);
  assert.equal(stale.size, 2);
  assert.deepEqual(stale.get('u1'), ['a']);
  assert.deepEqual(stale.get('u2'), ['b']);
});
