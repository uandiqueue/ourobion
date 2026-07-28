// The Home knowledge-base row must report real counts, or nothing.
//
// It used to be `_tickerLines`: three hardcoded strings rotating on a 5s timer
// with no data behind them — no paper count, no ingest state. It implied live
// indexing that was not happening, which is the "fake control" the run's rules
// forbid. It now reads get_knowledge_base_stats() (migration 20260728050000).
//
// Two distinct failure states must stay distinguishable:
//   * an EMPTY corpus  — we read, and there is genuinely nothing;
//   * a FAILED read    — we never found out.
// Collapsing them would let the UI assert an empty corpus it never read.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';
import 'package:src/modules/m5b_insight_engine/index.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('KnowledgeBaseStats parsing', () {
    test('reads real counts and a timestamp', () {
      final s = KnowledgeBaseStats.fromMap({
        'studiesIndexed': 7,
        'edgesVerified': 12,
        'lastIndexedAt': '2026-07-28T06:26:45.324165+00:00',
      });
      expect(s.studiesIndexed, 7);
      expect(s.edgesVerified, 12);
      expect(s.lastIndexedAt, isNotNull);
      expect(s.hasContent, isTrue);
    });

    test('an empty corpus is content-free, not an error', () {
      final s = KnowledgeBaseStats.fromMap({
        'studiesIndexed': 0,
        'edgesVerified': 0,
        'lastIndexedAt': null,
      });
      expect(s.hasContent, isFalse,
          reason: 'a 0-study row must not render — the pulsing treatment would '
              'still imply activity');
      expect(s.lastIndexedAt, isNull);
    });

    test('a single verified relationship is still content', () {
      final s = KnowledgeBaseStats.fromMap(
          {'studiesIndexed': 0, 'edgesVerified': 1, 'lastIndexedAt': null});
      expect(s.hasContent, isTrue);
    });

    test('missing or malformed fields degrade to zero, never to a guess', () {
      final s = KnowledgeBaseStats.fromMap({});
      expect(s.studiesIndexed, 0);
      expect(s.edgesVerified, 0);
      expect(s.lastIndexedAt, isNull);
      expect(s.hasContent, isFalse);

      final bad = KnowledgeBaseStats.fromMap({'lastIndexedAt': 'not-a-date'});
      expect(bad.lastIndexedAt, isNull);
    });
  });

  group('copy is honest and non-diagnostic', () {
    test('one study is reported as one study, not rounded up', () {
      expect(KnowledgeBaseCopy.studies(1), '1 study indexed');
      expect(KnowledgeBaseCopy.studies(0), '0 studies indexed');
      expect(KnowledgeBaseCopy.studies(12), '12 studies indexed');
    });

    test('relationships are counted separately from studies', () {
      // An edge is a claim ABOUT papers. Conflating the two would overstate the
      // evidence base, since one paper commonly supports several edges.
      expect(KnowledgeBaseCopy.relationships(1), '1 verified relationship');
      expect(KnowledgeBaseCopy.relationships(3), '3 verified relationships');
    });

    test('every knowledge-base string passes the non-diagnostic gate', () {
      final strings = <String>[
        ...KnowledgeBaseCopy.all,
        KnowledgeBaseCopy.studies(1),
        KnowledgeBaseCopy.studies(4),
        KnowledgeBaseCopy.relationships(1),
        KnowledgeBaseCopy.relationships(4),
        KnowledgeBaseCopy.lastIndexed('2026-07-28'),
      ];
      for (final s in strings) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });
  });

  group('the fake ticker is gone and stays gone', () {
    late final String source =
        File('lib/modules/m1_core/ui/screens/home_tab.dart').readAsStringSync();

    test('no hardcoded ticker line list remains', () {
      expect(source.contains('_tickerLines'), isFalse,
          reason: 'the rotating hardcoded strings were the defect');
      for (final line in const [
        'Reviewing your last 7 days',
        'Cross-checking sleep and gut patterns',
        'Watching for new research matches',
      ]) {
        expect(source.contains(line), isFalse,
            reason: 'invented knowledge-base activity string still present: "$line"');
      }
    });

    test('the row is gated on real content', () {
      expect(source.contains('_kbStats?.hasContent'), isTrue,
          reason: 'the row must render only when a real read returned content');
    });

    test('stats come from the RPC, not from a literal', () {
      expect(source.contains('KnowledgeBaseService'), isTrue);
    });
  });

  group('the migration backing this exists and stays honest', () {
    late final String sql = File(
            '../../supabase/migrations/20260728050000_knowledge_base_stats_rpc.sql')
        .readAsStringSync();

    test('counts DISTINCT paperIds, not claim rows', () {
      expect(sql.contains('count(distinct'), isTrue,
          reason: 'one paper commonly supports several edges; counting claims '
              'would inflate the study count');
      expect(sql.contains("'paperId'"), isTrue);
    });

    test('is security invoker so it adds no readable surface', () {
      expect(sql.contains('security invoker'), isTrue);
      expect(sql.contains('security definer'), isFalse,
          reason: 'definer would grant strictly more than this read needs');
    });

    test('tolerates a malformed citations value instead of erroring', () {
      expect(sql.contains('jsonb_typeof'), isTrue,
          reason: 'a non-array citations must contribute nothing rather than '
              'failing the whole query');
    });
  });
}
