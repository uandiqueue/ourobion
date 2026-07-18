// supabase/functions/evaluate-signals/lifecycle.ts
//
// S5 personal_signals lifecycle — the pure half of the audit-A19 fix. `personal_signals` is a
// projection tier: it must be a pure function of the CURRENT data (the loaders' upsert+prune
// model, sign-off D13), so a pair that once earned a row and later loses eligibility (a metric
// drops below the 14-day in-window floor, joint days fall under `minJointDays`, or the metric
// leaves the evaluated set) must have its row DELETED, not left to feed the S7 composer forever.
//
// This module computes WHICH rows are stale; index.ts performs the scoped delete. Like stats.ts
// and config.ts it is DELIBERATELY dependency-free and free of Deno/Node globals so the node
// test suite in tools/engine-stats/tests/ imports it directly via tsx — one source file, no
// mirror, no drift. Pure deterministic functions only.
//
// BH-coherence note: q-values are computed per user per run over THAT run's evaluated pair
// family (see index.ts). A pruned pair was, by definition, not in the current run's family, so
// deleting its row never invalidates the q-values stored on the surviving rows — those were
// adjusted over a family that already excluded it.

/** The identifying columns of an existing `personal_signals` row (metric_a < metric_b). */
export interface PairRowRef {
  user_id: string
  metric_a: string
  metric_b: string
}

/** A stale pair to delete for one user. */
export interface StalePair {
  metricA: string
  metricB: string
}

/** Canonical membership key for a (user, pair) — pairs are stored lexicographic a < b. */
export function pairEligibilityKey(userId: string, metricA: string, metricB: string): string {
  return `${userId} ${metricA} ${metricB}`
}

/**
 * Diff the run's eligible pair set against the rows currently in `personal_signals`:
 * every existing row whose (user, pair) key is NOT in `eligible` is stale and must be
 * deleted. Users with existing rows but no eligible pairs this run (stopped logging,
 * left the window entirely) naturally have ALL their rows returned as stale.
 *
 * @param eligible keys built with `pairEligibilityKey` for every row upserted this run
 * @param existing the (user_id, metric_a, metric_b) of every row currently in the table
 * @returns stale pairs grouped per user (empty map = nothing to prune)
 */
export function computeStalePairs(
  eligible: ReadonlySet<string>,
  existing: readonly PairRowRef[],
): Map<string, StalePair[]> {
  const staleByUser = new Map<string, StalePair[]>()
  for (const row of existing) {
    if (eligible.has(pairEligibilityKey(row.user_id, row.metric_a, row.metric_b))) continue
    let pairs = staleByUser.get(row.user_id)
    if (!pairs) staleByUser.set(row.user_id, (pairs = []))
    pairs.push({ metricA: row.metric_a, metricB: row.metric_b })
  }
  return staleByUser
}
