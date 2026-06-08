// Coupling guard: daily-gut-row-to-schema
// See docs/graph/couplings.yaml. Ties the DailyGutRow contract (shared/) to the daily_gut_rows table
// columns (supabase/migrations) and the M2 Flutter model. The Supabase client speaks dynamic JSON, so
// a renamed column or drifted field breaks the write/read path with no compile-time error.
// docs/memory/0001 (DailyGutRow is M2 source-of-truth).
//
// status: planned — runnable placeholder so the existence check in
// `node tools/context_sync.mjs --check` is honest now. Real assertions land in P1S2: assert the
// DailyGutRow field set == the daily_gut_rows column set == the M2 model field set.

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('coupling guard: daily-gut-row-to-schema', () {
    test('DailyGutRow fields match daily_gut_rows columns and the M2 model', () {
      // TODO(P1S2): parse the latest daily_gut_rows migration columns and assert they match the
      // DailyGutRow contract and the Flutter model field names.
    }, skip: 'Guard placeholder (status: planned) — see docs/graph/couplings.yaml.');
  });
}
