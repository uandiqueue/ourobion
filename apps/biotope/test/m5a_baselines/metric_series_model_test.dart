// U7 trend view: parsing for the `metric_daily_values` rows (S2 joint-series
// projection view — columns log_date, metric_key, value, source) and the
// window/picker helpers. Pure functions driven with wire-shaped JSON.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';

void main() {
  group('MetricDailyPoint / parseSeriesRows', () {
    test('parses PostgREST rows into a typed series', () {
      final rows =
          jsonDecode('''
      [
        {"log_date": "2026-07-04", "value": 4, "source": "self_report"},
        {"log_date": "2026-07-05", "value": 3.5, "source": "self_report"},
        {"log_date": "2026-07-24", "value": 2, "source": "wearable"}
      ]
      ''')
              as List<dynamic>;

      final points = parseSeriesRows(rows);
      expect(points, hasLength(3));
      expect(points.first.date, DateTime.utc(2026, 7, 4));
      expect(points.first.value, 4.0); // JSON integer → double
      expect(points.first.source, 'self_report');
      expect(points[1].value, 3.5);
      expect(points.last.date, DateTime.utc(2026, 7, 24));
      expect(points.last.source, 'wearable');
    });

    test('date parses as UTC midnight, never local time', () {
      final d = MetricDailyPoint.parseDateOnly('2026-07-24');
      expect(d.isUtc, isTrue);
      expect(d, DateTime.utc(2026, 7, 24));
    });

    test('missing source is tolerated as empty', () {
      final points = parseSeriesRows([
        {'log_date': '2026-07-04', 'value': 1},
      ]);
      expect(points.single.source, '');
    });
  });

  group('distinctMetricKeys', () {
    test('dedupes and sorts the bare metric_key projection', () {
      final keys = distinctMetricKeys([
        {'metric_key': 'mood_score'},
        {'metric_key': 'gut_comfort_score'},
        {'metric_key': 'mood_score'},
        {'metric_key': 'energy_score'},
        {'metric_key': 'gut_comfort_score'},
      ]);
      expect(keys, ['energy_score', 'gut_comfort_score', 'mood_score']);
    });

    test('empty rows yield an empty list', () {
      expect(distinctMetricKeys([]), isEmpty);
    });
  });

  group('windowStartDateIso', () {
    test('30-day window includes today (today - 29)', () {
      expect(windowStartDateIso(DateTime.utc(2026, 7, 24), 30), '2026-06-25');
    });

    test('1-day window starts today', () {
      expect(windowStartDateIso(DateTime.utc(2026, 7, 24), 1), '2026-07-24');
    });

    test('local instants are converted to the UTC day first', () {
      // 2026-07-25T07:00+08:00 == 2026-07-24T23:00Z → UTC day is the 24th.
      final sgt = DateTime.parse('2026-07-25T07:00:00+08:00');
      expect(windowStartDateIso(sgt, 1), '2026-07-24');
    });

    test('pads month and day', () {
      expect(windowStartDateIso(DateTime.utc(2026, 1, 9), 1), '2026-01-09');
    });
  });

  group('metricDisplayLabel', () {
    test('humanises snake_case keys', () {
      expect(metricDisplayLabel('gut_comfort_score'), 'Gut comfort score');
      expect(metricDisplayLabel('hrv_sdnn_ms'), 'Hrv sdnn ms');
      expect(metricDisplayLabel('mood_score'), 'Mood score');
    });

    test('single word is capitalised', () {
      expect(metricDisplayLabel('steps'), 'Steps');
    });
  });
}
