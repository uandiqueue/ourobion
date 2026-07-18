// Coupling guard: rules-table-to-insight-cards-parity
// See docs/graph/couplings.yaml. The `rules` table (the derived projection of the data/rules
// blueprints — rules-engine-design §B2) declares `category` and `severity` CHECK sets the engine
// copies straight onto fired cards, so insight_cards must accept every value rules can hold.
// Since the §S8 card-producer migration, insight_cards' category CHECK is the rules set PLUS
// 'relationship' (the composer producers' category — never written by the rules producer), so
// the guard holds: severity character-identical; cards.category == rules.category + the one
// composer value, verbatim. No import links the migrations — only this test does.
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
    // The §S8 migration re-declares insight_cards' category CHECK (adds 'relationship').
    final producersSql = readRepoFile(
        'supabase/migrations/20260716050639_create_m5b_composed_insights_and_card_producers.sql');

    test('cards category CHECK is exactly the rules CHECK plus the composer value', () {
      final rulesSet = checkListLiteral(rulesSql, 'category');
      final cardsSet = checkListLiteral(producersSql, 'category');
      expect(cardsSet, "$rulesSet, 'relationship'",
          reason: 'insight_cards.category must stay the rules set (verbatim) plus '
              "'relationship' — the engine copies rule categories onto cards unchanged");
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
