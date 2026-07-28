// Issue #200 copy gate: every new user-facing string ArchiveTab owns directly
// (the saved-insights eyebrow, and its own load-failure/retry copy) must pass
// the shared non-diagnostic copy validator — same pattern as
// insight_copy_gate_test.dart / trend_copy_gate_test.dart. The reused
// MetricTrendSection's own copy (TrendCopy) is already gated by
// test/m5a_baselines/trend_copy_gate_test.dart and is not duplicated here.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('ArchiveTab copy passes the non-diagnostic gate', () {
    test('every ArchiveTabCopy string validates', () {
      expect(ArchiveTabCopy.all, isNotEmpty);
      for (final s in ArchiveTabCopy.all) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  });
}
