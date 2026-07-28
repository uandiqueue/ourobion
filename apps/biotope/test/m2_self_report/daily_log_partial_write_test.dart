// UI gap 5 — the data-loss guard for the Scan tab's inline chip answers.
//
// THE RISK: `DailyLogService.saveDailyLog` upserts the WHOLE row. It names every
// column explicitly, including the ones the caller left null. That is correct
// for DailyLogScreen (which loads today's row and re-sends every field) and
// destructive for anything else — answering one chip through it would overwrite
// every other field logged today with null.
//
// THE GUARD: an inline answer goes through `buildFieldPatch`, which emits ONLY
// the answered column plus the two columns that are a function of it. Its safety
// property is an ABSENCE — the columns it does not name — so it is asserted here
// field by field against a fully populated row.
//
// Both payload builders are pure, so this runs with no database and no Supabase
// client. `_applyWrite` models PostgREST write semantics for both shapes at
// once: a write sets exactly the columns named in its payload (explicit nulls
// included) and leaves every other column untouched. The ONLY difference between
// the safe path and the destructive one is therefore which keys the payload
// carries — which is exactly what these tests measure.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';

const _userId = '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6';
const _logDate = '2026-07-28';
final _now = DateTime.utc(2026, 7, 28, 9, 30);

const _context = DailyLogRowContext(
  region: 'Singapore',
  onAntibiotics: true,
  gutWatchActive: false,
);

/// Today's row with EVERY column populated and distinguishable, except the one
/// the user is about to answer (`mood_score` — a gap card only appears for a
/// missing key). Column set taken from
/// supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql
/// plus the additive `data_origin` column (20260724120000).
Map<String, dynamic> _fullyPopulatedRow() => {
      'id': 42,
      'user_id': _userId,
      'log_date': _logDate,
      'region': 'Singapore',
      'urine_colour': 3,
      'stool_form': 4,
      'stool_count': 2,
      'stool_variability': 1,
      'outside_meals': 2,
      'mosquito_bites': 5,
      'energy_score': 4,
      'mood_score': null, // ← the gap being answered
      'gut_comfort_score': 5,
      'symptom_flags': ['bloating', 'cramping'],
      'notes': 'long walk after lunch',
      'standing_water_present': true,
      'on_antibiotics': true,
      'gut_watch_active': false,
      'log_completeness': 93.0,
      'data_origin': 'simulated:run2-demo',
      'created_at': '2026-07-28T00:00:00.000Z',
      'updated_at': '2026-07-28T01:00:00.000Z',
    };

/// Models a PostgREST write against an existing row: every key present in the
/// payload is assigned (a key mapped to null IS assigned null); keys absent from
/// the payload keep their stored value.
Map<String, dynamic> _applyWrite(
  Map<String, dynamic> stored,
  Map<String, dynamic> payload,
) =>
    {...stored, ...payload};

/// Columns an inline answer to [metricKey] is ALLOWED to change.
Set<String> _permittedChanges(String metricKey) =>
    {metricKey, 'log_completeness', 'updated_at'};

void main() {
  group('buildFieldPatch — an inline chip answer never nulls an unrelated field',
      () {
    test('every other column is byte-identical after the write', () {
      final before = _fullyPopulatedRow();

      final patch = DailyLogService.buildFieldPatch(
        existingRow: before,
        metricKey: 'mood_score',
        value: 4,
        now: _now,
      );
      final after = _applyWrite(before, patch);

      // Nothing appears or disappears.
      expect(after.keys.toSet(), equals(before.keys.toSet()));

      final permitted = _permittedChanges('mood_score');
      for (final column in before.keys) {
        if (permitted.contains(column)) continue;
        expect(
          jsonEncode(after[column]),
          equals(jsonEncode(before[column])),
          reason: 'column "$column" changed during a mood_score chip answer. '
              'An inline answer must touch only the answered column '
              '(+ log_completeness, updated_at).',
        );
      }

      // And the answer itself did land.
      expect(after['mood_score'], 4);
      expect(after['log_completeness'], 100.0,
          reason: '93 + mood_score weight (7) = 100');
    });

    test('the same holds for every inline-answerable metric', () {
      for (final entry in kInlineAnswerableOptions.entries) {
        final metricKey = entry.key;
        // Blank out just this metric so it reads as the day's open gap.
        final before = _fullyPopulatedRow()
          ..['mood_score'] = 3
          ..[metricKey] = null;

        final after = _applyWrite(
          before,
          DailyLogService.buildFieldPatch(
            existingRow: before,
            metricKey: metricKey,
            value: entry.value.last,
            now: _now,
          ),
        );

        final permitted = _permittedChanges(metricKey);
        for (final column in before.keys) {
          if (permitted.contains(column)) continue;
          expect(
            jsonEncode(after[column]),
            equals(jsonEncode(before[column])),
            reason: 'column "$column" changed while answering "$metricKey"',
          );
        }
        expect(after[metricKey], entry.value.last);
      }
    });

    test('the patch names only three columns — the absence IS the guard', () {
      final patch = DailyLogService.buildFieldPatch(
        existingRow: _fullyPopulatedRow(),
        metricKey: 'mood_score',
        value: 4,
        now: _now,
      );

      expect(
        patch.keys.toSet(),
        equals({'mood_score', 'log_completeness', 'updated_at'}),
        reason: 'any extra column here becomes a column the UPDATE overwrites',
      );
    });

    test('completeness is recomputed from the merged row, not the answer alone',
        () {
      // Only urine_colour (25) already logged; answering mood (7) gives 32.
      final sparse = {
        'urine_colour': 3,
        'stool_form': null,
        'outside_meals': null,
        'mosquito_bites': null,
        'energy_score': null,
        'mood_score': null,
        'gut_comfort_score': null,
      };

      final patch = DailyLogService.buildFieldPatch(
        existingRow: sparse,
        metricKey: 'mood_score',
        value: 4,
        now: _now,
      );

      expect(patch['log_completeness'],
          (kDailyCoreDqsWeights['urine_colour']! + kDailyCoreDqsWeights['mood_score']!).toDouble());
    });

    test('no row yet today: completeness comes from the single answer', () {
      final patch = DailyLogService.buildFieldPatch(
        existingRow: null,
        metricKey: 'energy_score',
        value: 5,
        now: _now,
      );

      expect(patch['energy_score'], 5);
      expect(patch['log_completeness'],
          kDailyCoreDqsWeights['energy_score']!.toDouble());
    });

    test('refuses a column that is not a daily-core DQS key', () {
      expect(
        () => DailyLogService.buildFieldPatch(
          existingRow: _fullyPopulatedRow(),
          metricKey: 'notes',
          value: 'nope',
          now: _now,
        ),
        throwsArgumentError,
      );
    });
  });

  group('proof the naive approach fails: the whole-row upsert DOES null out '
      'unrelated fields', () {
    // This is the implementation an inline answer would have had if it reused
    // saveDailyLog's payload with only the answered field set — the exact
    // mistake buildFieldPatch exists to prevent. Same stored row, same
    // simulated write; only the payload shape differs.
    test('a one-field DailyLogInput wipes every other logged value', () {
      final before = _fullyPopulatedRow();

      final naivePayload = DailyLogService.buildFullRowPayload(
        userId: _userId,
        logDate: _logDate,
        context: _context,
        input: const DailyLogInput(mood: 4, logCompleteness: 7),
        now: _now,
      );
      final after = _applyWrite(before, naivePayload);

      // Every one of these was populated before the write.
      expect(after['urine_colour'], isNull);
      expect(after['stool_form'], isNull);
      expect(after['stool_count'], isNull);
      expect(after['outside_meals'], isNull);
      expect(after['mosquito_bites'], isNull);
      expect(after['energy_score'], isNull);
      expect(after['gut_comfort_score'], isNull);
      expect(after['notes'], isNull);
      expect(after['standing_water_present'], isNull);
      expect(after['symptom_flags'], isEmpty);
      expect(after['log_completeness'], 7);

      // Counted: the damage is broad, not a one-column slip.
      final clobbered = before.keys
          .where((c) => !_permittedChanges('mood_score').contains(c))
          .where((c) => jsonEncode(after[c]) != jsonEncode(before[c]))
          .toList();
      expect(clobbered.length, greaterThanOrEqualTo(9),
          reason: 'expected widespread clobbering, got: $clobbered');
    });

    test('the safe patch leaves every column the naive payload destroyed', () {
      final before = _fullyPopulatedRow();

      final naive = _applyWrite(
        before,
        DailyLogService.buildFullRowPayload(
          userId: _userId,
          logDate: _logDate,
          context: _context,
          input: const DailyLogInput(mood: 4, logCompleteness: 7),
          now: _now,
        ),
      );
      final safe = _applyWrite(
        before,
        DailyLogService.buildFieldPatch(
          existingRow: before,
          metricKey: 'mood_score',
          value: 4,
          now: _now,
        ),
      );

      // Both wrote the same answer...
      expect(naive['mood_score'], 4);
      expect(safe['mood_score'], 4);

      // ...but only one of them still has the rest of the day's log.
      for (final column in ['urine_colour', 'stool_form', 'notes', 'symptom_flags']) {
        expect(naive[column], anyOf(isNull, isEmpty),
            reason: 'sanity: the naive path is expected to have lost "$column"');
        expect(jsonEncode(safe[column]), jsonEncode(before[column]),
            reason: 'the safe path must have kept "$column"');
      }
    });
  });

  group('kInlineAnswerableOptions', () {
    test('every inline key is a daily-core DQS key', () {
      for (final key in kInlineAnswerableOptions.keys) {
        expect(kDailyCoreDqsWeights.containsKey(key), isTrue,
            reason: '"$key" is offered inline but does not count toward '
                'log_completeness, so buildFieldPatch would reject it');
      }
    });

    test('lossy metrics stay off the inline path and keep routing to the form',
        () {
      // urine_colour: 8 swatches; stool_form: 7 Bristol types with descriptions;
      // mosquito_bites: 0..20. None can be expressed by a short chip row without
      // narrowing the answer, so they must remain full-form only.
      for (final key in ['urine_colour', 'stool_form', 'mosquito_bites']) {
        expect(kInlineAnswerableOptions.containsKey(key), isFalse,
            reason: '"$key" cannot be answered losslessly by chips');
      }
    });

    test('chip options cover the column CHECK range exactly', () {
      // Ranges from the daily_gut_rows migration.
      expect(kInlineAnswerableOptions['outside_meals'], [0, 1, 2, 3]);
      for (final key in ['energy_score', 'mood_score', 'gut_comfort_score']) {
        expect(kInlineAnswerableOptions[key], [1, 2, 3, 4, 5],
            reason: '$key is CHECKed between 1 and 5');
      }
    });
  });
}
