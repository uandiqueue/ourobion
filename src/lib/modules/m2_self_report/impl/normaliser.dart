// Pure DQS (Data Quality Score) normaliser for M2 self-report.
//
// Extracted out of the UI (daily_log_screen.dart) so the score is a pure,
// testable function with no Flutter / widget dependencies.

/// Daily-core (T1) DQS weights — the single source of truth is shared/metrics/registry.ts
/// (metrics with countsTowardDailyCompleteness: true). Kept in lockstep by the
/// metrics-registry-to-dqs guard. Weights sum to 100.
const Map<String, int> kDailyCoreDqsWeights = {
  'urine_colour': 25,
  'stool_form': 25,
  'outside_meals': 20,
  'mosquito_bites': 10,
  'energy_score': 7,
  'mood_score': 7,
  'gut_comfort_score': 6,
};

/// Computes the Data Quality Score (0..100) for a daily log.
///
/// Sums [kDailyCoreDqsWeights] for every daily-core key whose value in
/// [dailyCoreValues] is non-null. Tier-aware: only daily-core (T1) keys
/// contribute — passing event/period/passive values has no effect because
/// they are not in the weight map. The result is clamped to 0..100.
int computeDqs(Map<String, Object?> dailyCoreValues) {
  var pts = 0;
  for (final entry in kDailyCoreDqsWeights.entries) {
    if (dailyCoreValues[entry.key] != null) {
      pts += entry.value;
    }
  }
  return pts.clamp(0, 100);
}
