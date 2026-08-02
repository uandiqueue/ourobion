import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _userId = '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6';
const _logDate = '2026-07-28';
final _now = DateTime.utc(2026, 7, 28, 9, 30);
const _context = DailyLogRowContext(
  region: 'Singapore',
  onAntibiotics: true,
  gutWatchActive: false,
);
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
Map<String, dynamic> _applyWrite(
  Map<String, dynamic> stored,
  Map<String, dynamic> payload,
) => {...stored, ...payload};
Set<String> _permittedChanges(String metricKey) => {
  metricKey,
  'log_completeness',
  'updated_at',
};

class _RecordedRequest {
  final String method;
  final Uri uri;
  final String body;
  const _RecordedRequest(this.method, this.uri, this.body);
  Map<String, dynamic> get json => body.isEmpty
      ? const <String, dynamic>{}
      : jsonDecode(body) as Map<String, dynamic>;
}

class _OfflinePostgrestClient extends http.BaseClient {
  final List<_RecordedRequest> requests = [];
  final Map<String, dynamic>? existingRow;
  final Map<String, dynamic>? profileRow;
  final int profileStatusCode;

  _OfflinePostgrestClient({
    this.existingRow,
    this.profileRow = const {'region': 'Singapore'},
    this.profileStatusCode = 200,
  });

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final body = utf8.decode(await request.finalize().toBytes());
    final recorded = _RecordedRequest(request.method, request.url, body);
    requests.add(recorded);
    Object response = const <Object>[];
    var statusCode = 200;
    if (request.method == 'GET' &&
        request.url.path.endsWith('daily_gut_rows')) {
      response = existingRow == null ? const <Object>[] : [existingRow];
    } else if (request.method == 'GET' &&
        request.url.path.endsWith('profiles')) {
      response = profileRow ?? const <Object>[];
      statusCode = profileStatusCode;
    } else if (request.method == 'GET' &&
        request.url.path.endsWith('antibiotic_courses')) {
      response = const <Object>[];
    }
    final bytes = utf8.encode(jsonEncode(response));
    return http.StreamedResponse(
      Stream<List<int>>.value(bytes),
      statusCode,
      headers: {
        'content-type': 'application/json',
        'content-length': bytes.length.toString(),
      },
      request: request,
    );
  }
}

SupabaseClient _offlineSupabase(_OfflinePostgrestClient client) =>
    SupabaseClient(
      'http://offline.test',
      'test-key',
      httpClient: client,
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
_RecordedRequest _onlyWrite(_OfflinePostgrestClient client) =>
    client.requests.singleWhere(
      (request) =>
          request.uri.path.endsWith('daily_gut_rows') &&
          request.method != 'GET',
    );
_RecordedRequest _dailyRead(_OfflinePostgrestClient client) => client.requests
    .firstWhere((request) => request.uri.path.endsWith('daily_gut_rows'));
void main() {
  group(
    'buildFieldPatch — an inline chip answer never nulls an unrelated field',
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
        expect(after.keys.toSet(), equals(before.keys.toSet()));
        final permitted = _permittedChanges('mood_score');
        for (final column in before.keys) {
          if (permitted.contains(column)) continue;
          expect(
            jsonEncode(after[column]),
            equals(jsonEncode(before[column])),
            reason:
                'column "$column" changed during a mood_score chip answer. '
                'An inline answer must touch only the answered column '
                '(+ log_completeness, updated_at).',
          );
        }
        expect(after['mood_score'], 4);
        expect(
          after['log_completeness'],
          100.0,
          reason: '93 + mood_score weight (7) = 100',
        );
      });
      test('the same holds for every inline-answerable metric', () {
        for (final entry in kInlineAnswerableOptions.entries) {
          final metricKey = entry.key;
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
          reason:
              'any extra column here becomes a column the UPDATE overwrites',
        );
      });
      test(
        'completeness is recomputed from the merged row, not the answer alone',
        () {
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
          expect(
            patch['log_completeness'],
            (kDailyCoreDqsWeights['urine_colour']! +
                    kDailyCoreDqsWeights['mood_score']!)
                .toDouble(),
          );
        },
      );
      test('no row yet today: completeness comes from the single answer', () {
        final patch = DailyLogService.buildFieldPatch(
          existingRow: null,
          metricKey: 'energy_score',
          value: 5,
          now: _now,
        );
        expect(patch['energy_score'], 5);
        expect(
          patch['log_completeness'],
          kDailyCoreDqsWeights['energy_score']!.toDouble(),
        );
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
    },
  );
  group('proof the naive approach fails: the whole-row upsert DOES null out '
      'unrelated fields', () {
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
      final clobbered = before.keys
          .where((c) => !_permittedChanges('mood_score').contains(c))
          .where((c) => jsonEncode(after[c]) != jsonEncode(before[c]))
          .toList();
      expect(
        clobbered.length,
        greaterThanOrEqualTo(9),
        reason: 'expected widespread clobbering, got: $clobbered',
      );
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
      expect(naive['mood_score'], 4);
      expect(safe['mood_score'], 4);
      for (final column in [
        'urine_colour',
        'stool_form',
        'notes',
        'symptom_flags',
      ]) {
        expect(
          naive[column],
          anyOf(isNull, isEmpty),
          reason: 'sanity: the naive path is expected to have lost "$column"',
        );
        expect(
          jsonEncode(safe[column]),
          jsonEncode(before[column]),
          reason: 'the safe path must have kept "$column"',
        );
      }
    });
  });
  group('every one of the seven metrics, at BOTH ends of its range', () {
    for (final metricKey in kDailyCoreDqsWeights.keys) {
      final options = kInlineAnswerableOptions[metricKey]!;
      for (final entry in {
        'lowest': options.first,
        'highest': options.last,
      }.entries) {
        final bound = entry.key;
        final value = entry.value;
        test('$metricKey at its $bound value ($value) patches only three '
            'columns', () {
          final patch = DailyLogService.buildFieldPatch(
            existingRow: _fullyPopulatedRow()..[metricKey] = null,
            metricKey: metricKey,
            value: value,
            now: _now,
          );
          expect(
            patch.keys.toSet(),
            equals({metricKey, 'log_completeness', 'updated_at'}),
            reason: 'any extra key here is a column the UPDATE overwrites',
          );
          expect(
            patch[metricKey],
            value,
            reason: 'the stored value must be the answer, unclamped',
          );
        });
        test('$metricKey at its $bound value ($value) names none of the other '
            'columns of an existing row', () {
          final before = _fullyPopulatedRow()..[metricKey] = null;
          final patch = DailyLogService.buildFieldPatch(
            existingRow: before,
            metricKey: metricKey,
            value: value,
            now: _now,
          );
          for (final column in before.keys) {
            if (_permittedChanges(metricKey).contains(column)) continue;
            expect(
              patch.containsKey(column),
              isFalse,
              reason:
                  'answering "$metricKey" would write "$column" as well — '
                  'that column belongs to whatever else the user logged today',
            );
          }
        });
        test('$metricKey at its $bound value ($value) leaves the stored row '
            'byte-identical everywhere else', () {
          final before = _fullyPopulatedRow()..[metricKey] = null;
          final after = _applyWrite(
            before,
            DailyLogService.buildFieldPatch(
              existingRow: before,
              metricKey: metricKey,
              value: value,
              now: _now,
            ),
          );
          expect(after.keys.toSet(), equals(before.keys.toSet()));
          for (final column in before.keys) {
            if (_permittedChanges(metricKey).contains(column)) continue;
            expect(
              jsonEncode(after[column]),
              equals(jsonEncode(before[column])),
              reason:
                  'column "$column" changed while answering "$metricKey" '
                  'with its $bound value',
            );
          }
          expect(after[metricKey], value);
        });
        test('$metricKey at its $bound value ($value) counts toward '
            'completeness', () {
          final before = _fullyPopulatedRow()
            ..['mood_score'] = 3
            ..[metricKey] = null;
          final patch = DailyLogService.buildFieldPatch(
            existingRow: before,
            metricKey: metricKey,
            value: value,
            now: _now,
          );
          expect(
            patch['log_completeness'],
            100.0,
            reason: value == 0
                ? '0 is a real answer for "$metricKey"; a falsy check here '
                      'would drop ${kDailyCoreDqsWeights[metricKey]} points'
                : 'every other daily-core column is already logged',
          );
        });
        test('$metricKey at its $bound value ($value) is the same patch with '
            'no row yet today', () {
          final patch = DailyLogService.buildFieldPatch(
            existingRow: null,
            metricKey: metricKey,
            value: value,
            now: _now,
          );
          expect(
            patch.keys.toSet(),
            equals({metricKey, 'log_completeness', 'updated_at'}),
          );
          expect(patch[metricKey], value);
          expect(
            patch['log_completeness'],
            kDailyCoreDqsWeights[metricKey]!.toDouble(),
            reason: 'completeness comes from the single answer alone',
          );
        });
      }
    }
    test('the seven metrics covered above are the seven daily-core keys', () {
      expect(kDailyCoreDqsWeights.length, 7);
      expect(
        kInlineAnswerableOptions.keys.toSet(),
        equals(kDailyCoreDqsWeights.keys.toSet()),
        reason:
            'a metric answerable inline but not looped here would be '
            'untested at its bounds',
      );
    });
    test('updated_at is stamped, and is the only clock the patch touches', () {
      final patch = DailyLogService.buildFieldPatch(
        existingRow: _fullyPopulatedRow(),
        metricKey: 'energy_score',
        value: 5,
        now: _now,
      );
      expect(patch['updated_at'], _now.toIso8601String());
      expect(patch.containsKey('created_at'), isFalse);
    });
  });
  group('kInlineAnswerableOptions', () {
    test('every inline key is a daily-core DQS key', () {
      for (final key in kInlineAnswerableOptions.keys) {
        expect(
          kDailyCoreDqsWeights.containsKey(key),
          isTrue,
          reason:
              '"$key" is offered inline but does not count toward '
              'log_completeness, so buildFieldPatch would reject it',
        );
      }
    });
    test('longer scalar ranges stay on the complete inline path', () {
      for (final key in ['urine_colour', 'stool_form', 'mosquito_bites']) {
        expect(
          kInlineAnswerableOptions.containsKey(key),
          isTrue,
          reason: '"$key" must expose its complete accepted inline range',
        );
      }
    });
    test('chip options cover the column CHECK range exactly', () {
      expect(kInlineAnswerableOptions['urine_colour'], [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
      ]);
      expect(kInlineAnswerableOptions['stool_form'], [1, 2, 3, 4, 5, 6, 7]);
      expect(kInlineAnswerableOptions['outside_meals'], [
        for (var value = 0; value <= 10; value++) value,
      ]);
      expect(kInlineAnswerableOptions['mosquito_bites'], [
        for (var value = 0; value <= 20; value++) value,
      ]);
      for (final key in ['energy_score', 'mood_score', 'gut_comfort_score']) {
        expect(kInlineAnswerableOptions[key], [
          1,
          2,
          3,
          4,
          5,
        ], reason: '$key is CHECKed between 1 and 5');
      }
    });
  });
  group('saveFieldAnswer â€” real offline PostgREST persistence path', () {
    for (final metricKey in kDailyCoreDqsWeights.keys) {
      final options = kInlineAnswerableOptions[metricKey]!;
      for (final value in [options.first, options.last]) {
        test(
          '$metricKey=$value PATCHes only its column on an existing row',
          () async {
            final stored = _fullyPopulatedRow()
              ..['mood_score'] = 3
              ..[metricKey] = null;
            final recorder = _OfflinePostgrestClient(existingRow: stored);
            final service = DailyLogService(_offlineSupabase(recorder));
            final completeness = await service.saveFieldAnswer(
              _userId,
              _logDate,
              metricKey,
              value,
            );
            final read = _dailyRead(recorder);
            expect(read.method, 'GET');
            expect(read.uri.queryParameters['user_id'], 'eq.$_userId');
            expect(read.uri.queryParameters['log_date'], 'eq.$_logDate');
            final write = _onlyWrite(recorder);
            expect(
              write.method,
              'PATCH',
              reason:
                  'an existing row must not be inserted or whole-row upserted',
            );
            expect(write.uri.queryParameters['user_id'], 'eq.$_userId');
            expect(write.uri.queryParameters['log_date'], 'eq.$_logDate');
            final patch = write.json;
            expect(
              patch.keys.toSet(),
              equals({metricKey, 'log_completeness', 'updated_at'}),
              reason: 'the actual HTTP PATCH must not name unrelated columns',
            );
            expect(patch[metricKey], value);
            expect(completeness, 100.0);
            final after = _applyWrite(stored, patch);
            for (final column in stored.keys) {
              if (_permittedChanges(metricKey).contains(column)) continue;
              expect(
                jsonEncode(after[column]),
                jsonEncode(stored[column]),
                reason: '$column changed in the persisted $metricKey write',
              );
            }
          },
        );
      }
    }
    test(
      'zero is persisted and counted rather than dropped as false',
      () async {
        for (final metricKey in ['outside_meals', 'mosquito_bites']) {
          final stored = _fullyPopulatedRow()
            ..['mood_score'] = 3
            ..[metricKey] = null;
          final recorder = _OfflinePostgrestClient(existingRow: stored);
          final completeness = await DailyLogService(
            _offlineSupabase(recorder),
          ).saveFieldAnswer(_userId, _logDate, metricKey, 0);
          expect(_onlyWrite(recorder).json[metricKey], 0);
          expect(completeness, 100.0);
        }
      },
    );
    test('inserts only when the initial daily-row lookup is empty', () async {
      final recorder = _OfflinePostgrestClient();
      final completeness = await DailyLogService(
        _offlineSupabase(recorder),
      ).saveFieldAnswer(_userId, _logDate, 'energy_score', 5);
      final write = _onlyWrite(recorder);
      expect(write.method, 'POST');
      expect(write.json['user_id'], _userId);
      expect(write.json['log_date'], _logDate);
      expect(write.json['energy_score'], 5);
      expect(
        write.json['log_completeness'],
        kDailyCoreDqsWeights['energy_score']!.toDouble(),
      );
      expect(completeness, kDailyCoreDqsWeights['energy_score']!.toDouble());
      expect(
        recorder.requests.where((request) => request.method == 'PATCH'),
        isEmpty,
        reason: 'the absent-row path must not pretend an update succeeded',
      );
    });
    test(
      'missing profile falls back to an empty region and still inserts',
      () async {
        final recorder = _OfflinePostgrestClient(profileRow: null);
        await DailyLogService(
          _offlineSupabase(recorder),
        ).saveFieldAnswer(_userId, _logDate, 'energy_score', 5);

        final write = _onlyWrite(recorder);
        expect(write.method, 'POST');
        expect(
          write.json['region'],
          '',
          reason:
              'an absent ancillary profile must not block the raw daily log',
        );
      },
    );
    test(
      'profile fetch failures are not treated as an absent profile',
      () async {
        final recorder = _OfflinePostgrestClient(
          profileStatusCode: 503,
          profileRow: const {
            'code': 'PGRST000',
            'details': null,
            'hint': null,
            'message': 'profile service unavailable',
          },
        );

        await expectLater(
          DailyLogService(
            _offlineSupabase(recorder),
          ).rowContext(_userId, _logDate),
          throwsA(isA<PostgrestException>()),
        );
      },
    );
  });
}
