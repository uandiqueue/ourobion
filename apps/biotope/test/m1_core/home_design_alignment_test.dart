// Home's design alignment must not smuggle in invented data.
//
// The design file (Biotope Biomech Botanical.dc.html) shows a "▲ 4 PTS · 7-DAY"
// pill, a "/100 index" figure and a live knowledge-base ticker. Two of those are
// only renderable when the underlying number genuinely exists, and one of them
// is renamed on purpose. These assertions parse the real source so the file
// cannot drift back toward decoration.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  late final String source =
      File('lib/modules/m1_core/ui/screens/home_tab.dart').readAsStringSync();

  group('the 7-day delta pill is real or absent', () {
    test('the delta is null unless BOTH numbers exist', () {
      expect(source.contains('if (avg == null || today == null) return null;'), isTrue,
          reason: 'a missing baseline must yield no pill, not a fabricated delta');
    });

    test('a zero delta renders nothing rather than a flat arrow', () {
      expect(source.contains('return delta == 0 ? null : delta;'), isTrue,
          reason: '"▲ 0 PTS" would imply movement that did not happen');
    });

    test('the pill is gated on that value', () {
      expect(source.contains('if (indexDelta != null)'), isTrue);
    });
  });

  group('the coverage figure is not relabelled as a health index', () {
    test('reads "/100 coverage", not the design\'s "/100 index"', () {
      // The number is log_completeness. "index" would imply a composite health
      // score the app does not compute — a deliberate divergence from the
      // design in favour of the truth of the underlying field.
      expect(source.contains('/100 coverage'), isTrue);
      expect(source.contains('/100 index'), isFalse,
          reason: 'log_completeness is coverage, not a health index');
    });
  });

  group('ambient motion respects the OS reduce-motion setting', () {
    test('the hero breathe checks disableAnimations', () {
      expect(source.contains('MediaQuery.maybeDisableAnimationsOf(context)'), isTrue,
          reason: 'a continuous ambient loop is exactly what that setting exists '
              'to stop');
    });

    test('and renders the child still rather than animating anyway', () {
      expect(source.contains('if (reduced)'), isTrue);
    });
  });

  group('the header shows a real date', () {
    test('the eyebrow is derived from DateTime.now, not a literal', () {
      expect(source.contains('String get _dateEyebrow'), isTrue);
      expect(source.contains('final now = DateTime.now();'), isTrue,
          reason: 'the eyebrow must be derived from the clock, not the mock');
      expect(source.contains('days[now.weekday - 1]'), isTrue);
      expect(source.contains('months[now.month - 1]'), isTrue);
    });
  });
}
