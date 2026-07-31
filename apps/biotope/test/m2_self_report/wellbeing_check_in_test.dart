import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/ui/widgets/likert_check_in_card.dart';

void main() {
  test(
    'whole-row payload carries all five optional values without adding DQS',
    () {
      final payload = DailyLogService.buildFullRowPayload(
        userId: 'user-a',
        logDate: '2026-07-31',
        context: const DailyLogRowContext(
          region: 'SG',
          onAntibiotics: false,
          gutWatchActive: false,
        ),
        input: const DailyLogInput(
          appetite: 1,
          anxiety: 2,
          brainClarity: 3,
          focus: 4,
          socialInteractionQuality: 5,
          logCompleteness: 0,
        ),
        now: DateTime.utc(2026, 7, 31),
      );
      expect(payload['appetite_score'], 1);
      expect(payload['anxiety_score'], 2);
      expect(payload['brain_clarity_score'], 3);
      expect(payload['focus_score'], 4);
      expect(payload['social_interaction_quality_score'], 5);
      expect(payload['log_completeness'], 0);
      expect(hasWellbeingCheckInValues(focus: 4), isTrue);
      expect(canSaveDailyLog(dqs: 0, hasWellbeingCheckIn: true), isTrue);
      expect(canSaveDailyLog(dqs: 0, hasWellbeingCheckIn: false), isFalse);
    },
  );

  testWidgets('Likert control exposes five accessible 44px choices', (
    tester,
  ) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => LikertCheckInCard(
              icon: Icons.tune,
              label: 'Mental clarity',
              lowLabel: 'Foggy',
              highLabel: 'Clear',
              value: selected,
              onChanged: (value) => setState(() => selected = value),
            ),
          ),
        ),
      ),
    );
    for (var score = 1; score <= 5; score++) {
      final choice = find.bySemanticsLabel('Mental clarity, $score of 5');
      expect(choice, findsOneWidget);
      expect(tester.getSize(choice).height, greaterThanOrEqualTo(44));
    }
    await tester.tap(find.bySemanticsLabel('Mental clarity, 3 of 5'));
    await tester.pump();
    expect(selected, 3);
  });
}
