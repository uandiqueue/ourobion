// Coupling guard: metrics-registry-to-schema
// See docs/graph/couplings.yaml. Ties the metrics registry to the actual table columns in
// supabase/migrations. Every active registry key for a table must be a real column, and every
// non-system column must be a registry metric — so a migration can't add/rename a metric column
// without a matching registry entry (and vice versa).
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-schema', () {
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));

    const tableToMigration = {
      'daily_gut_rows':
          'supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql',
      'wearable_daily': 'supabase/migrations/20260528100000_create_m3_wearable_daily.sql',
    };

    tableToMigration.forEach((table, migration) {
      test('$table registry keys == metric columns in migration', () {
        final cols = migrationColumns(readRepoFile(migration), table);
        final metricCols = cols.difference(systemOrDerivedColumns);
        final regKeys = activeKeysFor(registry, table);
        expect(metricCols, equals(regKeys),
            reason: 'registry vs $table columns drift. '
                'registry-only: ${regKeys.difference(metricCols)}; '
                'column-only: ${metricCols.difference(regKeys)}');
      });
    });
  });
}
