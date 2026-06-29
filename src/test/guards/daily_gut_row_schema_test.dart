// Coupling guard: daily-gut-row-to-schema
// See docs/graph/couplings.yaml. Ties the DailyGutRow contract (shared/) to the daily_gut_rows table
// columns (supabase/migrations). The Supabase client speaks dynamic JSON, so a renamed column or
// drifted field breaks the write/read path with no compile-time error. docs/memory/0001.
//
// status: active — asserts the DailyGutRow contract field set (TS == Dart) equals the daily_gut_rows
// migration column set. (The contract field is `log_date`, matching the table column.)

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: daily-gut-row-to-schema', () {
    test('DailyGutRow contract fields == daily_gut_rows columns (TS + Dart)', () {
      final tsFields = tsInterfaceFields(readRepoFile('shared/types/index.ts'), 'DailyGutRow');
      final dartKeys = dartClassToJsonKeys(readRepoFile('shared/types/index.dart'))['DailyGutRow'];
      final cols = migrationColumns(
        readRepoFile(
          'supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql',
        ),
        'daily_gut_rows',
      );

      expect(dartKeys, isNotNull, reason: 'DailyGutRow has no toJson() in index.dart');
      expect(dartKeys, equals(tsFields), reason: 'TS/Dart DailyGutRow field drift');
      expect(
        cols,
        equals(tsFields),
        reason: 'DailyGutRow vs daily_gut_rows column drift — '
            'contract-only: ${tsFields.difference(cols)}; column-only: ${cols.difference(tsFields)}',
      );
    });
  });
}
