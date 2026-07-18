// U21 (audit A27): expiry filtering must be UTC-correct.
//
// getInsights: the PostgREST cutoff string must be an explicit-UTC instant —
// the old `DateTime.now().toIso8601String()` produced a zone-less LOCAL string
// that timestamptz comparison reads as UTC (~8h skew for SGT users).
//
// watchInsights: the cutoff must be re-evaluated per emission via the pure
// `filterEmission(rows, nowUtc)` — the old code froze `now` at subscription.
//
// Note on zone simulation: Dart cannot switch the process's local zone
// per-test, so the non-UTC case is simulated by feeding LOCAL DateTimes /
// zone-less strings derived from known UTC instants. On a non-UTC machine
// (dev machines run SGT, UTC+8) these assertions fail against the old naive
// code; on a UTC machine they still pin the contract.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';

Map<String, dynamic> _row({String? expiresAt, String status = 'active'}) => {
      'id': 1,
      'user_id': '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6',
      'generated_at': '2026-07-17T06:00:00.000Z',
      'title': 'Hydration check-in',
      'body': 'Your urine colour readings ran darker than your usual range.',
      'category': 'hydration',
      'severity': 'info',
      'contributing_metrics': ['urine_colour'],
      'confidence_score': 0.6,
      'confidence_sources': ['self_report'],
      'status': status,
      'expires_at': expiresAt,
      'rule_id': 'hydration_dark_urine',
      'phase_generated': 'p1s1',
    };

void main() {
  group('expiryCutoffUtcIso (A27, getInsights cutoff)', () {
    test('a local-zone now is converted to the same UTC instant with Z suffix', () {
      final utcInstant = DateTime.utc(2026, 7, 18, 3, 0);
      final localNow = utcInstant.toLocal(); // non-UTC wall clock on SGT machines

      final cutoff = InsightService.expiryCutoffUtcIso(localNow);

      expect(cutoff, '2026-07-18T03:00:00.000Z');
      expect(cutoff, endsWith('Z'),
          reason: 'timestamptz comparison reads a zone-less string as UTC — '
              'the cutoff must carry an explicit zone');
    });

    test('boundary: cards expiring 1min after/before the cutoff sort correctly', () {
      final nowUtc = DateTime.utc(2026, 7, 18, 3, 0);
      final cutoff = InsightService.expiryCutoffUtcIso(nowUtc.toLocal());

      final stillValid = nowUtc.add(const Duration(minutes: 1));
      final justExpired = nowUtc.subtract(const Duration(minutes: 1));

      // PostgREST evaluates `expires_at.gt.cutoff` as a timestamp comparison;
      // assert the instant relation the filter relies on.
      expect(stillValid.isAfter(DateTime.parse(cutoff)), isTrue);
      expect(justExpired.isAfter(DateTime.parse(cutoff)), isFalse);
    });
  });

  group('filterEmission (A27, watchInsights client-side filter)', () {
    final nowUtc = DateTime.utc(2026, 7, 18, 3, 0);

    test('keeps unexpired + null-expiry rows, drops expired and non-active', () {
      final rows = [
        _row(expiresAt: '2026-07-18T03:01:00.000Z'), // +1min → keep
        _row(expiresAt: '2026-07-18T02:59:00.000Z'), // -1min → drop
        _row(expiresAt: null), // never expires → keep
        _row(expiresAt: null, status: 'snoozed'), // not active → drop
      ];

      final cards = InsightService.filterEmission(rows, nowUtc);

      expect(cards, hasLength(2));
      expect(cards[0].expiresAt, DateTime.parse('2026-07-18T03:01:00.000Z'));
      expect(cards[1].expiresAt, isNull);
    });

    test('a zone-less expires_at is read as UTC, not local time', () {
      // 1min in the future in UTC; the old DateTime.parse-as-local reading
      // would misplace this by the machine offset (8h on SGT machines).
      final rows = [_row(expiresAt: '2026-07-18T03:01:00')];
      expect(InsightService.filterEmission(rows, nowUtc), hasLength(1));
      expect(
          InsightService.filterEmission(
              rows, nowUtc.add(const Duration(minutes: 2))),
          isEmpty);
    });

    test('cutoff advances across emissions instead of freezing at subscription', () {
      // Same rows delivered on successive emissions with an advancing clock —
      // exactly what watchInsights does now that it calls nowUtc() per emission.
      final rows = [_row(expiresAt: '2026-07-18T03:05:00.000Z')];

      final firstEmission = InsightService.filterEmission(rows, nowUtc);
      final laterEmission = InsightService.filterEmission(
          rows, nowUtc.add(const Duration(minutes: 10)));

      expect(firstEmission, hasLength(1),
          reason: 'card is still valid at subscription time');
      expect(laterEmission, isEmpty,
          reason: 'the same card must drop out once the clock passes expiry — '
              'a frozen subscription-time cutoff would keep it forever');
    });
  });
}
