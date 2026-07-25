// supabase/functions/compute-baselines/lifecycle.ts
//
// S3 baseline_snapshots lifecycle — the pure half of the O19 fix (verdict H2). baseline_snapshots
// is a projection tier: it must be a pure function of the CURRENT S2 data (the loaders'
// upsert+prune model, sign-off D13 / audit A19 — the exact pattern evaluate-signals/lifecycle.ts
// established for personal_signals), so a (user, metric) pair that once earned a snapshot and no
// longer appears in the projection (raw rows deleted, metric deprecated out of the registry set,
// user gone) must have its snapshot DELETED, not left to feed generate-insights forever.
//
// This module computes WHICH snapshots are stale; index.ts performs the scoped delete (and holds
// the A14 empty-input guard — see the handler). Like evaluate-signals' lifecycle.ts it is
// DELIBERATELY dependency-free and free of Deno/Node globals so the node test suite in
// tools/engine-stats/tests/ imports it directly via tsx — one source file, no mirror, no drift.
// Pure deterministic functions only.

/** The identifying columns of an existing `baseline_snapshots` row. */
export interface SnapshotRowRef {
  user_id: string
  metric_key: string
}

/**
 * Canonical membership key for a (user, metric) snapshot identity. Space-delimited, the
 * evaluate-signals `pairEligibilityKey` convention: user ids are UUIDs and metric keys are
 * ^[a-z0-9_]+$ — neither contains a space, so distinct pairs can never collide. (index.ts's
 * in-memory series grouping uses a NUL separator instead; the two keyspaces never meet.)
 */
export function snapshotKey(userId: string, metricKey: string): string {
  return `${userId} ${metricKey}`
}

/**
 * Diff the run's freshly-projected snapshot set against the rows currently in
 * `baseline_snapshots`: every existing row whose (user, metric) key is NOT in `current` is
 * stale and must be deleted. A user with existing rows but no metric in the current projection
 * (deleted all raw data) naturally has ALL their rows returned as stale — the HANDLER refuses
 * to act on that when the whole S2 read was empty (A14 guard, index.ts).
 *
 * @param current keys built with `snapshotKey` for every snapshot upserted this run
 * @param existing the (user_id, metric_key) of every row currently in the table
 * @returns stale metric keys grouped per user (empty map = nothing to prune)
 */
export function computeStaleSnapshots(
  current: ReadonlySet<string>,
  existing: readonly SnapshotRowRef[],
): Map<string, string[]> {
  const staleByUser = new Map<string, string[]>()
  for (const row of existing) {
    if (current.has(snapshotKey(row.user_id, row.metric_key))) continue
    let keys = staleByUser.get(row.user_id)
    if (!keys) staleByUser.set(row.user_id, (keys = []))
    keys.push(row.metric_key)
  }
  return staleByUser
}
