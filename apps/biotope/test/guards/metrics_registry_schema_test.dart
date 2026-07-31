// Coupling guard: metrics-registry-to-schema
// See docs/graph/couplings.yaml. Ties the metrics registry to the actual tables in
// supabase/migrations. Two storage shapes, two semantics:
//
//  - Legacy wide tables (daily_gut_rows, wearable_daily): every active registry key for the
//    table must be a real column, and every non-system column must be a registry metric — so a
//    migration can't add/rename a metric column without a matching registry entry (and vice versa).
//
//  - Continuity primitives (events, state_bands, signals, derived_metrics): tall/narrow — a
//    metric needs NO dedicated column (rows carry its registry key as metric_key). The guard
//    instead asserts the primitive's migration exists and contains the core columns
//    (metric_key, the time column, value).
//
// Every table an active registry entry declares must be covered by one of the two maps.
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-schema', () {
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));

    // Legacy wide tables: one column per metric.
    const tableToMigration = {
      'daily_gut_rows':
          'supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql',
      'wearable_daily':
          'supabase/migrations/20260528100000_create_m3_wearable_daily.sql',
    };

    // Continuity primitives: table -> (migration, core columns every instance row relies on).
    const primitivesMigration =
        'supabase/migrations/20260715140420_create_continuity_storage_primitives.sql';
    const primitiveCoreColumns = {
      'events': ['metric_key', 'occurred_at', 'value'],
      'state_bands': ['metric_key', 'started_at', 'value'],
      'signals': ['metric_key', 'ts', 'value'],
      'derived_metrics': ['metric_key', 'as_of', 'value'],
    };

    tableToMigration.forEach((table, migration) {
      test('$table registry keys == metric columns in migration', () {
        final cols = table == 'daily_gut_rows'
            ? migrationColumnsWithAdditions(readRepoFile(migration), table, [
                readRepoFile(
                  'supabase/migrations/20260730020001_add_u6b_wellbeing_metrics.sql',
                ),
              ])
            : migrationColumns(readRepoFile(migration), table);
        final metricCols = cols.difference(systemOrDerivedColumns);
        final regKeys = activeKeysFor(registry, table);
        expect(
          metricCols,
          equals(regKeys),
          reason:
              'registry vs $table columns drift. '
              'registry-only: ${regKeys.difference(metricCols)}; '
              'column-only: ${metricCols.difference(regKeys)}',
        );
      });
    });

    primitiveCoreColumns.forEach((table, coreColumns) {
      test('$table primitive migration exists and has core columns', () {
        // readRepoFile throws if the migration file is missing.
        final cols = migrationColumns(readRepoFile(primitivesMigration), table);
        for (final col in coreColumns) {
          expect(
            cols,
            contains(col),
            reason:
                '$table is a tall/narrow continuity primitive — its migration must '
                'declare core column `$col` (metrics store rows keyed by metric_key, '
                'not dedicated columns)',
          );
        }
      });
    });

    test(
      'every table declared by an active registry metric has schema coverage',
      () {
        final declared = registry
            .where((e) => e.status == 'active')
            .map((e) => e.table)
            .toSet();
        final covered = {
          ...tableToMigration.keys,
          ...primitiveCoreColumns.keys,
        };
        expect(
          declared.difference(covered),
          isEmpty,
          reason:
              'active registry metrics declare table(s) with no migration mapping in this '
              'guard — add the table to tableToMigration (wide) or primitiveCoreColumns '
              '(continuity primitive)',
        );
      },
    );
  });
}
