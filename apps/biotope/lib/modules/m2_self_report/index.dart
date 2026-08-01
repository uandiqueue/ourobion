// app/lib/modules/m2_self_report/index.dart

/*
public interface (what other modules may use)

// Reading (for M5a, M6)
Future<DailyGutRow?> getRow(String userId, String date)
Future<List<DailyGutRow>> getRows(String userId, {int days = 30})
Future<double> getCompletenessScore(String userId, String date)  // 0–100 DQS

// Writing (internal — M2 only calls these)
// Other modules never write to daily_gut_rows
*/

export 'impl/logging_controller.dart';
export 'ui/widgets/daily_scale_visuals.dart';
export 'ui/widgets/daily_scale_value_visual.dart';
