// Deck recovery, at the query layer.
//
// The incident: 54 of 56 cards were swiped away on a device, including the one
// research-backed card. Swipe-right (`archived`) at least stayed visible in the
// Archive tab. Swipe-left (`dismissed`) was visible NOWHERE — getInsights
// filters `status = 'active'`, InsightService.archiveStatuses deliberately
// excludes `dismissed`, and generate-insights reports `dismissedSkipped`, so
// re-running the pipeline does not bring it back either. Recovery took a manual
// database PATCH.
//
// InsightService.resetCurrentPeriodDeck is the in-app way back, and it carries
// three promises that a fake service could only restate rather than prove:
//
//   1. it NEVER creates a row — it flips `status` on rows that already exist;
//   2. it NEVER resurrects a card past its `expires_at`;
//   3. it recovers `dismissed`, not just `archived`.
//
// So these tests drive the REAL query builder through an offline PostgREST
// endpoint that keeps an actual row store and interprets the filters the code
// emitted (same seam as m2_self_report/daily_log_partial_write_test.dart). The
// filter interpreter below reads the request's own query string; it does not
// restate the service's WHERE clause.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _userId = '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6';
const _otherUserId = '11111111-2222-3333-4444-555555555555';
final _now = DateTime.utc(2026, 8, 2, 9, 0);

Map<String, dynamic> _row({
  required int id,
  required String status,
  String? expiresAt,
  String userId = _userId,
  String title = 'Hydration pattern',
}) => {
  'id': id,
  'user_id': userId,
  'rule_id': 'hydration_dark_urine_$id',
  'generated_at': '2026-07-30T02:00:00.000Z',
  'title': title,
  'body': 'Your data shows a drift from your usual range this week.',
  'category': 'hydration',
  'severity': 'info',
  'contributing_metrics': <String>['urine_colour'],
  'confidence_score': 0.6,
  'confidence_sources': <String>['self_report'],
  'status': status,
  'expires_at': expiresAt,
  'phase_generated': 'p2s9',
};

// ─── Offline PostgREST with a real row store ──────────────────────────────────

class _Recorded {
  final String method;
  final Uri uri;
  final String body;
  const _Recorded(this.method, this.uri, this.body);
}

/// Interprets exactly the PostgREST filter grammar this service emits —
/// `col=eq.v`, `col=in.(a,b)`, and `or=(a.is.null,a.gt.v)` — against a row.
/// Anything else throws rather than silently matching, so a filter the tests do
/// not understand cannot quietly pass.
bool _matches(Map<String, dynamic> row, Map<String, String> params) {
  for (final entry in params.entries) {
    final key = entry.key;
    final value = entry.value;
    if (key == 'select' || key == 'columns') continue;

    if (key == 'or') {
      final inner = value.substring(1, value.length - 1); // strip ( )
      final any = inner
          .split(',')
          .any((clause) => _matchesClause(row, clause));
      if (!any) return false;
      continue;
    }

    if (!_matchesClause(row, '$key.$value')) return false;
  }
  return true;
}

bool _matchesClause(Map<String, dynamic> row, String clause) {
  final firstDot = clause.indexOf('.');
  final column = clause.substring(0, firstDot);
  final rest = clause.substring(firstDot + 1);

  if (rest == 'is.null') return row[column] == null;
  if (rest.startsWith('eq.')) return row[column] == rest.substring(3);
  if (rest.startsWith('gt.')) {
    final actual = row[column] as String?;
    if (actual == null) return false;
    return DateTime.parse(actual).isAfter(DateTime.parse(rest.substring(3)));
  }
  if (rest.startsWith('in.')) {
    final list = rest.substring(3);
    final members = list
        .substring(1, list.length - 1)
        .split(',')
        .map((m) => m.replaceAll('"', '').trim())
        .toSet();
    return members.contains(row[column]);
  }
  throw StateError('unsupported PostgREST clause in test interpreter: $clause');
}

/// Serves `insight_cards` out of [rows] and APPLIES writes to it, so a test can
/// assert on the store afterwards. Deliberately supports no INSERT path at all:
/// if the service ever POSTed, [creates] records it and the row store still
/// does not grow, which is the point.
class _OfflineInsightCards extends http.BaseClient {
  _OfflineInsightCards(List<Map<String, dynamic>> rows)
    : rows = [for (final r in rows) Map<String, dynamic>.from(r)];

  final List<Map<String, dynamic>> rows;
  final List<_Recorded> requests = [];

  Iterable<_Recorded> get creates =>
      requests.where((r) => r.method == 'POST' || r.method == 'PUT');
  Iterable<_Recorded> get deletes =>
      requests.where((r) => r.method == 'DELETE');

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final body = utf8.decode(await request.finalize().toBytes());
    requests.add(_Recorded(request.method, request.url, body));

    Object response = const <Object>[];
    if (request.url.path.endsWith('insight_cards')) {
      final params = request.url.queryParameters;
      final matched = rows.where((r) => _matches(r, params)).toList();
      if (request.method == 'PATCH') {
        final patch = jsonDecode(body) as Map<String, dynamic>;
        for (final r in matched) {
          r.addAll(patch);
        }
      }
      response = matched;
    }

    final bytes = utf8.encode(jsonEncode(response));
    return http.StreamedResponse(
      Stream<List<int>>.value(bytes),
      200,
      headers: {
        'content-type': 'application/json',
        'content-length': bytes.length.toString(),
      },
      request: request,
    );
  }
}

InsightService _service(_OfflineInsightCards backend) => InsightService(
  SupabaseClient(
    'http://offline.test',
    'test-key',
    httpClient: backend,
    authOptions: const AuthClientOptions(autoRefreshToken: false),
  ),
  nowUtc: () => _now,
);

/// This period = still inside its serving window at [_now].
final _inWindow = _now.add(const Duration(days: 4)).toIso8601String();

/// Past its window — the engine stopped serving it days ago.
final _pastWindow = _now.subtract(const Duration(days: 2)).toIso8601String();

void main() {
  // InsightService's session status overlay is static — it is shared across the
  // three tabs that each construct their own service. That makes it outlive a
  // single test, so a case that saves or dismisses a card would otherwise leak
  // into the next one. Cleared before every test to keep these hermetic.
  setUp(InsightService.resetSessionOverrides);

  group('resetCurrentPeriodDeck recovers held cards', () {
    test('a dismissed card — the unrecoverable one — comes back active', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _inWindow),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored.map((c) => c.id), [1]);
      expect(
        backend.rows.single['status'],
        'active',
        reason:
            'swipe-left is the state nothing else can undo: not getInsights, '
            'not archiveStatuses, not generate-insights (dismissedSkipped). '
            'If reset cannot reach it, the card is still only recoverable by '
            'writing to the database by hand.',
      );
    });

    test('archived and legacy snoozed saves come back too', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'archived', expiresAt: _inWindow),
        _row(id: 2, status: 'snoozed', expiresAt: _inWindow),
        _row(id: 3, status: 'dismissed', expiresAt: _inWindow),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored.map((c) => c.id).toSet(), {1, 2, 3});
      expect(backend.rows.every((r) => r['status'] == 'active'), isTrue);
    });

    test('a null-expiry card is in scope (it never left its window)', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed'),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored.map((c) => c.id), [1]);
    });

    test('an already-active card is untouched, and re-running is a no-op', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'active', expiresAt: _inWindow),
        _row(id: 2, status: 'dismissed', expiresAt: _inWindow),
      ]);
      final service = _service(backend);

      final first = await service.resetCurrentPeriodDeck(_userId);
      final second = await service.resetCurrentPeriodDeck(_userId);

      expect(first.map((c) => c.id), [2]);
      expect(
        second,
        isEmpty,
        reason: 'nothing is held any more, so the second reset moves no row',
      );
      expect(backend.rows.length, 2);
    });

    test("another user's held card is not in the statement's scope", () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _inWindow),
        _row(
          id: 2,
          status: 'dismissed',
          expiresAt: _inWindow,
          userId: _otherUserId,
        ),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored.map((c) => c.id), [1]);
      expect(
        backend.rows.firstWhere((r) => r['id'] == 2)['status'],
        'dismissed',
        reason:
            'RLS is what actually enforces this in production; the statement '
            'must still narrow to the caller rather than lean on the policy',
      );
    });
  });

  group('resetCurrentPeriodDeck never resurrects an expired card', () {
    test('an expired dismissed card stays dismissed', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _pastWindow),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored, isEmpty);
      expect(
        backend.rows.single['status'],
        'dismissed',
        reason:
            'getInsights would not serve it even as active, so flipping it '
            'would move a row for no visible effect — and would contradict '
            'the expiry cutoff the deck applies',
      );
    });

    test('an expired archived card stays in the archive', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'archived', expiresAt: _pastWindow),
      ]);

      await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(backend.rows.single['status'], 'archived');
    });

    test('expired and unexpired rows are separated within one reset', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _pastWindow),
        _row(id: 2, status: 'dismissed', expiresAt: _inWindow),
        _row(id: 3, status: 'archived', expiresAt: _pastWindow),
        _row(id: 4, status: 'archived'),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(restored.map((c) => c.id).toSet(), {2, 4});
      expect(
        {for (final r in backend.rows) r['id']: r['status']},
        {1: 'dismissed', 2: 'active', 3: 'archived', 4: 'active'},
      );
    });

    test('the expiry boundary matches getInsights exactly, to the minute', () async {
      final backend = _OfflineInsightCards([
        _row(
          id: 1,
          status: 'dismissed',
          expiresAt: _now.add(const Duration(minutes: 1)).toIso8601String(),
        ),
        _row(
          id: 2,
          status: 'dismissed',
          expiresAt: _now.subtract(const Duration(minutes: 1)).toIso8601String(),
        ),
        _row(id: 3, status: 'dismissed', expiresAt: _now.toIso8601String()),
      ]);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(
        restored.map((c) => c.id),
        [1],
        reason:
            'the cutoff is `expires_at > now`, so a card expiring exactly now '
            'is already out — same relation getInsights and filterEmission use',
      );
    });

    test('reset and getInsights send the SAME expiry predicate', () async {
      // The guarantee behind "reset cannot resurrect an expired card" is not a
      // second, similar filter — it is literally the same one. Assert the two
      // requests carry an identical `or=` parameter rather than two strings
      // that happen to agree today.
      final backend = _OfflineInsightCards([]);
      final service = _service(backend);
      await service.getInsights(_userId);
      await service.resetCurrentPeriodDeck(_userId);

      final read = backend.requests.firstWhere((r) => r.method == 'GET');
      final write = backend.requests.firstWhere((r) => r.method == 'PATCH');

      expect(read.uri.queryParameters['or'], isNotNull);
      expect(
        write.uri.queryParameters['or'],
        equals(read.uri.queryParameters['or']),
      );
      expect(
        write.uri.queryParameters['or'],
        contains(InsightService.expiryCutoffUtcIso(_now)),
      );
    });
  });

  group('resetCurrentPeriodDeck cannot create or destroy a row', () {
    test('the row store is the same size and the same ids afterwards', () async {
      final rows = [
        _row(id: 1, status: 'dismissed', expiresAt: _inWindow),
        _row(id: 2, status: 'archived', expiresAt: _pastWindow),
        _row(id: 3, status: 'active', expiresAt: _inWindow),
      ];
      final backend = _OfflineInsightCards(rows);

      final restored = await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(
        backend.rows.map((r) => r['id']).toList(),
        [1, 2, 3],
        reason:
            'a reset that could conjure a row would be inventing an insight — '
            'the one thing this system exists not to do',
      );
      expect(
        restored.map((c) => c.id).toSet().difference({1, 2, 3}),
        isEmpty,
        reason: 'every restored card must be a row that already existed',
      );
    });

    test('the wire verb is PATCH — no INSERT, upsert or DELETE is issued', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _inWindow),
      ]);

      await _service(backend).resetCurrentPeriodDeck(_userId);

      expect(
        backend.creates,
        isEmpty,
        reason:
            'POST/PUT to PostgREST is insert/upsert. Reset must be an UPDATE '
            'with a WHERE clause, which structurally cannot add a card.',
      );
      expect(backend.deletes, isEmpty);
      expect(
        backend.requests.map((r) => r.method).toSet(),
        {'PATCH'},
        reason: 'one statement, one verb',
      );
    });

    test('the patch body writes status and nothing else', () async {
      final backend = _OfflineInsightCards([
        _row(id: 1, status: 'dismissed', expiresAt: _inWindow),
      ]);

      await _service(backend).resetCurrentPeriodDeck(_userId);

      final patch =
          jsonDecode(backend.requests.single.body) as Map<String, dynamic>;
      expect(
        patch,
        {'status': 'active'},
        reason:
            'reset restores servability. Rewriting generated_at, expires_at or '
            'body would be re-dating a card the engine produced days ago — a '
            'quieter way of fabricating one.',
      );
    });

    test('the reset request narrows on user, status and expiry — all three', () async {
      final backend = _OfflineInsightCards([]);

      await _service(backend).resetCurrentPeriodDeck(_userId);

      final params = backend.requests.single.uri.queryParameters;
      expect(params['user_id'], 'eq.$_userId');
      expect(params['status'], startsWith('in.'));
      for (final held in InsightService.resettableStatuses) {
        expect(params['status'], contains(InsightService.statusValue(held)));
      }
      expect(
        params['status'],
        isNot(contains('active')),
        reason:
            'matching active rows too would rewrite rows that need no change',
      );
      expect(params['or'], isNotNull);
    });
  });

  group('InsightCard.isExpiredAt (the Archive remove confirmation)', () {
    InsightCard card(String? expiresAt) =>
        InsightCard.fromJson(_row(id: 1, status: 'archived', expiresAt: expiresAt));

    test('a null expires_at never closes', () {
      expect(card(null).isExpiredAt(_now), isFalse);
    });

    test('one minute before the cutoff is still in window', () {
      expect(
        card(
          _now.add(const Duration(minutes: 1)).toIso8601String(),
        ).isExpiredAt(_now),
        isFalse,
      );
    });

    test('exactly at the cutoff is expired', () {
      expect(card(_now.toIso8601String()).isExpiredAt(_now), isTrue);
    });

    test('past the cutoff is expired', () {
      expect(card(_pastWindow).isExpiredAt(_now), isTrue);
    });

    test('it agrees with the deck filter on the same row', () {
      // isExpiredAt drives user-facing copy; filterEmission drives what the deck
      // shows. If they ever disagreed, the confirmation would promise a return
      // the deck refuses to honour (or warn about one it would have honoured).
      for (final expiry in [
        null,
        _inWindow,
        _pastWindow,
        _now.toIso8601String(),
      ]) {
        final row = _row(id: 1, status: 'active', expiresAt: expiry);
        final servable = InsightService.filterEmission([row], _now).isNotEmpty;
        expect(
          InsightCard.fromJson(row).isExpiredAt(_now),
          !servable,
          reason: 'disagreement for expires_at = $expiry',
        );
      }
    });
  });
}
