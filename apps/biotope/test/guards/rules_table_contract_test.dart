// Coupling guard: rules-table-to-insight-cards-parity
// See docs/graph/couplings.yaml. The `rules` table (the derived projection of the data/rules
// blueprints — rules-engine-design §B2) declares `category` and `severity` CHECK sets that must be
// CHARACTER-IDENTICAL to `insight_cards`': the engine copies a rule's category/severity straight
// onto the card, so any drift lets the loader accept a rule whose fired card the insight_cards
// CHECK would reject at insert time. No import links the two migrations — only this test does.
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

/// The raw comma-separated literal inside `check (<column> in ( ... ))` — compared verbatim so the
/// sets are character-identical, not merely equal as sets.
String checkListLiteral(String sql, String column) {
  final m = RegExp('check \\($column in \\(([^)]*)\\)\\)').firstMatch(sql);
  if (m == null) {
    throw StateError('check ($column in (...)) not found');
  }
  return m.group(1)!.trim();
}

void main() {
  group('coupling guard: rules-table-to-insight-cards-parity', () {
    final rulesSql = readRepoFile(
        'supabase/migrations/20260715151252_create_m5b_rules_table.sql');
    final cardsSql = readRepoFile(
        'supabase/migrations/20260515110000_create_m5b_insight_cards.sql');

    test('category CHECK sets are character-identical', () {
      expect(checkListLiteral(rulesSql, 'category'),
          checkListLiteral(cardsSql, 'category'),
          reason: 'rules.category CHECK must be character-identical to insight_cards.category');
    });

    test('severity CHECK sets are character-identical', () {
      expect(checkListLiteral(rulesSql, 'severity'),
          checkListLiteral(cardsSql, 'severity'),
          reason: 'rules.severity CHECK must be character-identical to insight_cards.severity');
    });

    test('severity values match the copy-guidelines severity ladder (memory 0003)', () {
      final ts = readRepoFile('shared/constants/copy_guidelines.ts');
      // SEVERITIES is an object literal, so parse its quoted values directly (comments stripped).
      final si = ts.indexOf('SEVERITIES');
      expect(si, greaterThanOrEqualTo(0), reason: 'SEVERITIES not found in copy_guidelines.ts');
      final open = ts.indexOf('{', si);
      final close = ts.indexOf('}', open);
      final block =
          ts.substring(open + 1, close).replaceAll(RegExp(r'//[^\n]*'), '');
      final severities =
          RegExp("'([^']+)'").allMatches(block).map((m) => m.group(1)).toList();
      final checkValues = RegExp("'([^']+)'")
          .allMatches(checkListLiteral(rulesSql, 'severity'))
          .map((m) => m.group(1))
          .toList();
      expect(checkValues, severities,
          reason: 'rules.severity CHECK must equal the copy-guidelines severity set');
    });
  });
}
