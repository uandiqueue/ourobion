// insight_cards.status — the four-way cross-language contract (UI gap 4, the `archived` status).
//
// `status` is mirrored in FOUR places that no compiler or import links together:
//
//   1. the DB CHECK        supabase/migrations/*.sql (created 20260515110000, widened 20260728040000)
//   2. the shared contract shared/types/index.ts        InsightCard.status  ← 2-reviewer file
//   3. the Dart enum       .../m5b_insight_engine/impl/insight_service.dart InsightStatus
//   4. the engine's hold   supabase/functions/generate-insights/index.ts USER_HELD_STATUSES
//
// (4) is the dangerous one: it is not a type, it is a runtime allow-list, and a value missing from
// it fails SILENTLY — the nightly regeneration pass re-upserts the card `status: 'active'` and the
// user's archived card reappears in the deck with no error raised anywhere. Nothing else in the
// repo tests it, so it is tested here.
//
// Every assertion below PARSES THE REAL SOURCE FILES. No expected value list is hardcoded — a test
// that restated the four values would pass happily while the shipped files drifted apart.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';

import '../guards/guard_support.dart';

// ─── Source parsers ───────────────────────────────────────────────────────────────────────────

String _stripLineComments(String src, String marker) =>
    src.replaceAll(RegExp('${RegExp.escape(marker)}[^\n]*'), '');

Set<String> _quotedLiterals(String src) =>
    RegExp("['\"]([a-z_]+)['\"]").allMatches(src).map((m) => m.group(1)!).toSet();

/// The `status:` union of `export interface InsightCard` in shared/types/index.ts.
Set<String> tsStatusUnion(String tsSource) {
  final body = RegExp(r'export interface InsightCard\s*\{([^}]*)\}', dotAll: true)
      .firstMatch(tsSource)
      ?.group(1);
  if (body == null) throw StateError('interface InsightCard not found in shared/types/index.ts');
  // Strip `//` comments first: the surrounding doc comment quotes status values in prose.
  final decl = RegExp(r'^\s*status\s*:\s*([^;]+);', multiLine: true)
      .firstMatch(_stripLineComments(body, '//'))
      ?.group(1);
  if (decl == null) throw StateError('InsightCard.status declaration not found');
  return _quotedLiterals(decl);
}

/// The value names of `enum InsightStatus { ... }` in insight_service.dart.
Set<String> dartEnumValues(String dartSource) {
  final body = RegExp(r'^enum InsightStatus\s*\{([^}]*)\}', multiLine: true)
      .firstMatch(dartSource)
      ?.group(1);
  if (body == null) throw StateError('enum InsightStatus not found');
  return body
      .split(',')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toSet();
}

/// The body of the Dart method whose declaration starts with [signature], by brace matching from
/// its opening `{` (line-based slicing breaks on CRLF and on any reformat).
String dartMethodBody(String src, String signature) {
  final start = src.indexOf(signature);
  if (start < 0) throw StateError('method not found: $signature');
  final open = src.indexOf('{', start);
  if (open < 0) throw StateError('no body for: $signature');
  var depth = 0;
  for (var i = open; i < src.length; i++) {
    if (src[i] == '{') depth++;
    if (src[i] == '}') {
      depth--;
      if (depth == 0) return src.substring(open + 1, i);
    }
  }
  throw StateError('unbalanced braces after: $signature');
}

/// The literal members of `const USER_HELD_STATUSES = new Set([...])` in generate-insights.
Set<String> userHeldStatuses(String edgeFnSource) {
  final body = RegExp(
    r'const\s+USER_HELD_STATUSES\s*:[^=]*=\s*new\s+Set\(\s*\[([^\]]*)\]\s*\)',
  ).firstMatch(edgeFnSource)?.group(1);
  if (body == null) {
    throw StateError('USER_HELD_STATUSES declaration not found in generate-insights/index.ts');
  }
  return _quotedLiterals(body);
}

/// The status values the DB CHECK on `insight_cards` allows AFTER the whole migration chain has
/// been applied in `ls | sort` order — i.e. the last `check (status in (...))` whose governing
/// `create table` / `alter table` names insight_cards. Other tables' `status` CHECKs (the `rules`
/// table's active/deprecated lifecycle, for one) are excluded by that governing-table test.
Set<String> effectiveInsightCardsStatusCheck() {
  final dir = Directory('${repoRoot().path}/supabase/migrations');
  final files = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.toLowerCase().endsWith('.sql'))
      .toList()
    ..sort((a, b) => a.uri.pathSegments.last.compareTo(b.uri.pathSegments.last));
  if (files.isEmpty) throw StateError('no migrations found');

  final checkRe = RegExp(r'check\s*\(\s*status\s+in\s*\(([^)]*)\)\s*\)', caseSensitive: false);
  final tableRe = RegExp(
    r'\btable\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)',
    caseSensitive: false,
  );

  Set<String>? last;
  for (final f in files) {
    // `--` comments would otherwise let prose (including this feature's own migration comment)
    // masquerade as a constraint.
    final sql = _stripLineComments(f.readAsStringSync(), '--');
    for (final m in checkRe.allMatches(sql)) {
      final before = sql.substring(0, m.start);
      final owners = tableRe.allMatches(before).toList();
      if (owners.isEmpty) continue;
      if (owners.last.group(1)!.toLowerCase() != 'insight_cards') continue;
      last = _quotedLiterals(m.group(1)!);
    }
  }
  if (last == null) throw StateError('no insight_cards status CHECK found in any migration');
  return last;
}

// ─── Tests ────────────────────────────────────────────────────────────────────────────────────

void main() {
  final tsShared = readRepoFile('shared/types/index.ts');
  final dartService = readRepoFile(
      'apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart');
  final edgeFn = readRepoFile('supabase/functions/generate-insights/index.ts');

  group('generate-insights USER_HELD_STATUSES (the silent un-archive)', () {
    test('holds every non-active status the DB CHECK allows', () {
      final held = userHeldStatuses(edgeFn);
      final allowed = effectiveInsightCardsStatusCheck();
      final mustHold = allowed.difference({'active'});

      expect(
        held,
        equals(mustHold),
        reason: 'generate-insights only skips regeneration for statuses in USER_HELD_STATUSES. '
            'Any allowed status missing from it is re-upserted `status: active` by the nightly '
            'pass, silently discarding the user\'s choice. '
            'Allowed-but-not-held: ${mustHold.difference(held)}; '
            'held-but-not-allowed: ${held.difference(mustHold)}',
      );
    });

    test("holds 'archived' specifically", () {
      // Named separately from the set-equality test above so the failure output says exactly
      // which regression happened when someone re-adds `archived` everywhere but here.
      expect(
        userHeldStatuses(edgeFn),
        contains('archived'),
        reason: 'without this, every card the user saves to the Archive tab is quietly '
            'un-archived back to `active` on the next generate-insights run',
      );
    });

    test('never holds `active` (that would freeze the whole deck)', () {
      expect(userHeldStatuses(edgeFn), isNot(contains('active')));
    });
  });

  group('cross-language status parity', () {
    test('shared/types/index.ts union == Dart InsightStatus enum', () {
      final ts = tsStatusUnion(tsShared);
      final dart = dartEnumValues(dartService);
      expect(ts, isNotEmpty);
      expect(
        dart,
        equals(ts),
        reason: 'TS/Dart drift on insight_cards.status. '
            'TS-only: ${ts.difference(dart)}; Dart-only: ${dart.difference(ts)}',
      );
    });

    test('DB CHECK == shared/types/index.ts union', () {
      final sql = effectiveInsightCardsStatusCheck();
      final ts = tsStatusUnion(tsShared);
      expect(
        sql,
        equals(ts),
        reason: 'the migration chain and the shared contract disagree. '
            'SQL-only: ${sql.difference(ts)}; TS-only: ${ts.difference(sql)}',
      );
    });

    test("the DB CHECK accepts 'archived'", () {
      expect(
        effectiveInsightCardsStatusCheck(),
        contains('archived'),
        reason: 'the insight_cards status CHECK must allow archived or every save is rejected '
            'by Postgres at write time (23514)',
      );
    });

    test('the Dart enum name of each value IS its DB literal', () {
      // statusValue() is the only place Dart turns the enum into the wire value; if a name and
      // its literal diverge the parity tests above would still pass while writes broke.
      for (final s in InsightStatus.values) {
        expect(InsightService.statusValue(s), s.name,
            reason: 'InsightStatus.${s.name} serialises as '
                '"${InsightService.statusValue(s)}"');
      }
    });
  });

  group('InsightCard.fromJson status parsing', () {
    Map<String, dynamic> row(String status) => {
          'id': 1,
          'user_id': 'u-1',
          'rule_id': 'r-1',
          'generated_at': '2026-07-28T00:00:00.000Z',
          'title': 'Hydration pattern',
          'body': 'Your data shows a drift in your usual range.',
          'category': 'hydration',
          'severity': 'info',
          'contributing_metrics': <String>['urine_colour'],
          'confidence_score': 0.5,
          'confidence_sources': <String>['self_report'],
          'status': status,
          'expires_at': null,
          'phase_generated': 'p2s9',
        };

    test('every DB literal round-trips to its own enum value', () {
      // _parseStatus falls through to `active` for anything it does not recognise, so a missing
      // switch arm does NOT throw — an archived row would just render as an active one. This is
      // the assertion that catches that.
      for (final value in effectiveInsightCardsStatusCheck()) {
        final parsed = InsightCard.fromJson(row(value)).status;
        expect(InsightService.statusValue(parsed), value,
            reason: 'the DB allows status "$value" but InsightCard.fromJson parsed it as '
                '"${InsightService.statusValue(parsed)}" — _parseStatus is missing an arm');
      }
    });
  });

  group('Archive tab query surface', () {
    test('archiveStatuses is exactly {archived, snoozed}', () {
      // archived = written by the deck today. snoozed = only so cards saved before migration
      // 20260728040000 (which deliberately does not relabel them) stay visible.
      expect(
        InsightService.archiveStatuses.map(InsightService.statusValue).toSet(),
        equals({'archived', 'snoozed'}),
      );
    });

    test('archiveStatuses shows nothing the user did not save', () {
      final shown = InsightService.archiveStatuses.toSet();
      expect(shown, isNot(contains(InsightStatus.active)));
      expect(shown, isNot(contains(InsightStatus.dismissed)));
    });

    test('every archive status is also user-held by the engine', () {
      final held = userHeldStatuses(edgeFn);
      for (final s in InsightService.archiveStatuses) {
        expect(held, contains(InsightService.statusValue(s)),
            reason: 'the Archive tab lists ${s.name}, so generate-insights must never '
                'regenerate over it');
      }
    });

    test('getArchivedInsights filters on archiveStatuses, not a bare status literal', () {
      // Source-text guard (same technique as test/guards/): the widget test below proves the tab
      // CALLS getArchivedInsights, but only the query itself decides which rows come back, and a
      // fake service cannot observe a PostgREST filter. Reverting the method body to
      // `.eq('status', 'snoozed')` would leave every other test in this file green.
      // Whitespace-collapsed so a failure prints the whole body on one line (matcher's
      // prettyPrint truncates multi-line strings to their first line).
      final body = dartMethodBody(
              dartService, 'Future<List<InsightCard>> getArchivedInsights(String userId)')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      expect(body, contains('archiveStatuses'),
          reason: 'the archive query must be driven by archiveStatuses');
      expect(body, isNot(contains(RegExp(r"\.eq\(\s*'status'"))),
          reason: 'a single-value .eq() filter cannot return both archived and legacy snoozed '
              'rows — the pre-migration saves would vanish from the Archive tab');
    });
  });
}
