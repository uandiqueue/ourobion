import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';
import '../../../../shared/constants/copy_guidelines.dart';
const _bannedWords = ['thriving', 'balanced', 'healthy', 'wellness'];
const _sampleScores = <double?>[100, 85, 80, 70, 50, 20, null];
void main() {
  group('HomeCoverageCopy.bucket — pure threshold mapping', () {
    test('null (no coverage yet) reads distinctly from a real low score', () {
      expect(HomeCoverageCopy.bucket(null), 'No coverage yet');
      expect(HomeCoverageCopy.bucket(20), 'Early coverage');
      expect(
        HomeCoverageCopy.bucket(null),
        isNot(HomeCoverageCopy.bucket(20)),
        reason: 'no logged data at all must read differently from a little',
      );
    });
    test('the real numeric thresholds (80 / 60 / 40) are unchanged', () {
      expect(HomeCoverageCopy.bucket(80), 'High coverage');
      expect(HomeCoverageCopy.bucket(79.9), 'Steady coverage');
      expect(HomeCoverageCopy.bucket(60), 'Steady coverage');
      expect(HomeCoverageCopy.bucket(59.9), 'Partial coverage');
      expect(HomeCoverageCopy.bucket(40), 'Partial coverage');
      expect(HomeCoverageCopy.bucket(39.9), 'Early coverage');
    });
    test('every required sample score maps to the documented label', () {
      expect(HomeCoverageCopy.bucket(100), 'High coverage');
      expect(HomeCoverageCopy.bucket(85), 'High coverage');
      expect(HomeCoverageCopy.bucket(80), 'High coverage');
      expect(HomeCoverageCopy.bucket(70), 'Steady coverage');
      expect(HomeCoverageCopy.bucket(50), 'Partial coverage');
      expect(HomeCoverageCopy.bucket(20), 'Early coverage');
      expect(HomeCoverageCopy.bucket(null), 'No coverage yet');
    });
    test('only a genuine 100 could mean every channel was logged — no bucket '
        'label below it claims that', () {
      for (final v in [
        0.0,
        20.0,
        39.9,
        40.0,
        59.9,
        60.0,
        79.9,
        80.0,
        85.0,
        99.9,
      ]) {
        final label = HomeCoverageCopy.bucket(v).toLowerCase();
        expect(
          label,
          isNot(contains('every channel')),
          reason: '"$label" at $v must not claim every channel was logged',
        );
        expect(label, isNot(contains('all logged')));
        expect(label, isNot(contains('fully logged')));
        expect(
          label,
          isNot(contains('complete')),
          reason:
              'HomeCoverageCopy.bucket(80) == "High coverage": true and '
              'truthful, but a label reading "complete" at 80 would '
              'overclaim — energy(7)+mood(7)+gut comfort(6) = 20 points are '
              'still missing at exactly 80',
        );
      }
    });
    test(
      'the label at 80 is truthful ("High coverage", not a completeness claim)',
      () {
        expect(HomeCoverageCopy.bucket(80), 'High coverage');
        expect(
          HomeCoverageCopy.bucket(80).toLowerCase(),
          isNot(contains('every')),
        );
      },
    );
  });
  group('HomeCoverageCopy.bucketRange — pure threshold mapping', () {
    test('every required sample score maps to the documented range', () {
      expect(HomeCoverageCopy.bucketRange(100), '80–100 weighted points');
      expect(HomeCoverageCopy.bucketRange(85), '80–100 weighted points');
      expect(HomeCoverageCopy.bucketRange(80), '80–100 weighted points');
      expect(HomeCoverageCopy.bucketRange(70), '60–79 weighted points');
      expect(HomeCoverageCopy.bucketRange(50), '40–59 weighted points');
      expect(HomeCoverageCopy.bucketRange(20), '0–39 weighted points');
      expect(
        HomeCoverageCopy.bucketRange(null),
        'Log-weight score appears after your first entry',
      );
    });
  });
  group('no health-sounding word ever reaches the score/status area', () {
    testWidgets('the real hero renders the score basis and bucket explainer', (
      tester,
    ) async {
      for (final v in _sampleScores) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: SystemStatusHero(
                  key: ValueKey('hero-$v'),
                  statusWord: HomeCoverageCopy.bucket(v),
                  index: v?.round(),
                  scoreBasis: HomeCoverageCopy.sevenDayBasis,
                  bucketRange: HomeCoverageCopy.bucketRange(v),
                  streak: 0,
                  indexDelta: null,
                ),
              ),
            ),
          ),
        );
        expect(find.text(HomeCoverageCopy.bucket(v)), findsOneWidget);
        if (v == null) {
          expect(find.text('/100 weighted points'), findsNothing);
          expect(find.text(HomeCoverageCopy.sevenDayBasis), findsNothing);
        } else {
          expect(find.text('${v.round()}'), findsOneWidget);
          expect(find.text('/100 weighted points'), findsOneWidget);
          expect(
            find.textContaining(HomeCoverageCopy.sevenDayBasis),
            findsOneWidget,
          );
          expect(
            find.textContaining(HomeCoverageCopy.bucketRange(v)),
            findsOneWidget,
          );
        }
      }
    });
    test('no HomeCoverageCopy.bucket output contains a banned word', () {
      for (final v in _sampleScores) {
        final lower = HomeCoverageCopy.bucket(v).toLowerCase();
        for (final banned in _bannedWords) {
          expect(
            lower.contains(banned),
            isFalse,
            reason: 'bucket($v) = "$lower" must not contain "$banned"',
          );
        }
      }
    });
    test('no HomeCoverageCopy.bucketRange output contains a banned word', () {
      for (final v in _sampleScores) {
        final lower = HomeCoverageCopy.bucketRange(v).toLowerCase();
        for (final banned in _bannedWords) {
          expect(lower.contains(banned), isFalse);
        }
      }
    });
    test('the basis strings contain no banned word', () {
      for (final basis in [
        HomeCoverageCopy.sevenDayBasis,
        HomeCoverageCopy.todayBasis,
      ]) {
        final lower = basis.toLowerCase();
        for (final banned in _bannedWords) {
          expect(lower.contains(banned), isFalse);
        }
      }
    });
    testWidgets(
      'the rendered hero shows no banned word for any required sample score',
      (tester) async {
        for (final v in _sampleScores) {
          await tester.pumpWidget(
            MaterialApp(
              home: Scaffold(
                body: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: SystemStatusHero(
                    statusWord: HomeCoverageCopy.bucket(v),
                    index: v?.round(),
                    scoreBasis: HomeCoverageCopy.sevenDayBasis,
                    bucketRange: HomeCoverageCopy.bucketRange(v),
                    streak: 0,
                    indexDelta: null,
                  ),
                ),
              ),
            ),
          );
          for (final banned in _bannedWords) {
            expect(
              find.textContaining(RegExp(banned, caseSensitive: false)),
              findsNothing,
              reason:
                  'rendering the hero at score $v must not surface "$banned"',
            );
          }
        }
      },
    );
    testWidgets('the rendered hero at exactly 80 states "High coverage"', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: SystemStatusHero(
                statusWord: HomeCoverageCopy.bucket(80),
                index: 80,
                scoreBasis: HomeCoverageCopy.sevenDayBasis,
                bucketRange: HomeCoverageCopy.bucketRange(80),
                streak: 0,
                indexDelta: null,
              ),
            ),
          ),
        ),
      );
      expect(find.text('High coverage'), findsOneWidget);
      expect(find.text('80'), findsOneWidget);
      expect(find.textContaining('Complete'), findsNothing);
      expect(find.textContaining('every channel'), findsNothing);
    });
  });
  group('HomeCoverageCopy strings pass the non-diagnostic gate', () {
    test('the basis constants validate', () {
      for (final s in [
        HomeCoverageCopy.sevenDayBasis,
        HomeCoverageCopy.todayBasis,
      ]) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
    test('every bucket() and bucketRange() output validates', () {
      for (final v in _sampleScores) {
        for (final s in [
          HomeCoverageCopy.bucket(v),
          HomeCoverageCopy.bucketRange(v),
        ]) {
          expect(
            CopyRules.validateCopyString(s),
            isTrue,
            reason: 'diagnostic language detected in: "$s"',
          );
        }
      }
    });
  });
}
