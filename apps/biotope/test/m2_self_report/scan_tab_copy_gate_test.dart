// Copy gate for the Scan tab's user-facing strings.
//
// The reskin shipped five new tab screens with no copy-gate coverage at all —
// the existing gates (insight cards, provenance, baselines) never look at them.
// This unit adds a lot of new Scan-tab copy (gaps 1 and 5), so it gets the same
// non-diagnostic validator every other user-facing string in the app passes.
//
// The validator is imported by relative path across the package boundary, the
// same seam test/m5b_insight_engine/insight_copy_gate_test.dart uses.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('Scan tab copy passes the non-diagnostic gate', () {
    test('every ScanTabCopy string validates', () {
      expect(ScanTabCopy.all, isNotEmpty);
      for (final s in ScanTabCopy.all) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('the templated weight sentence validates at every real weight', () {
      // Rendered per gap card from kDailyCoreDqsWeights, so gate the whole range
      // rather than the one representative value in ScanTabCopy.all.
      for (final weight in [6, 7, 10, 20, 25]) {
        final s = ScanTabCopy.gapWeight(weight);
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('no string is empty or whitespace-only', () {
      for (final s in ScanTabCopy.all) {
        expect(s.trim(), isNotEmpty);
      }
    });
  });

  group('gap 1 copy stays honest', () {
    test('the environmental row does not promise a delivery', () {
      // "Coming soon" implies a date nobody has set. There is no M4 module,
      // table, edge function or environmental API in this repo.
      for (final s in [
        ScanTabCopy.environmentStatus,
        ScanTabCopy.environmentDetail,
        ScanTabCopy.environmentSemanticLabel,
      ]) {
        expect(s.toLowerCase(), isNot(contains('coming soon')));
        expect(s.toLowerCase(), isNot(contains('soon')));
      }
    });

    test('it says plainly that nothing is connected', () {
      expect(ScanTabCopy.environmentDetail.toLowerCase(),
          contains('no environmental data source is connected'));
      expect(ScanTabCopy.environmentSemanticLabel.toLowerCase(),
          contains('cannot be switched on'));
    });
  });
}
