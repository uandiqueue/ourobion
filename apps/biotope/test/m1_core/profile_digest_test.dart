// UI gap 2 — the "Daily digest" toggle now persists to
// profiles.daily_digest_enabled, and must never LOOK saved when it is not.
//
// ProfileTab needs Supabase.instance, so these pump DailyDigestToggle directly
// (it was split out for exactly that reason) with an injected writer standing in
// for ProfileService.updateProfile.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/models/user_profile.dart';
import 'package:src/modules/m1_core/ui/screens/profile_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

Widget _harness(Widget child) => MaterialApp(
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(16), child: child),
  ),
);

Finder get _switch => find.byType(Switch);
bool _switchValue(WidgetTester tester) => tester.widget<Switch>(_switch).value;

void main() {
  group('DailyDigestToggle — successful write', () {
    testWidgets('seeds from the loaded profile value', (tester) async {
      await tester.pumpWidget(
        _harness(DailyDigestToggle(initialValue: true, onWrite: (_) async {})),
      );

      expect(
        _switchValue(tester),
        isTrue,
        reason: 'the toggle used to reset to false on every remount',
      );
    });

    testWidgets('writes the new value and stays flipped', (tester) async {
      final writes = <bool>[];
      await tester.pumpWidget(
        _harness(
          DailyDigestToggle(
            initialValue: false,
            onWrite: (v) async => writes.add(v),
          ),
        ),
      );

      await tester.tap(_switch);
      await tester.pumpAndSettle();

      expect(writes, [true]);
      expect(_switchValue(tester), isTrue);
      expect(find.text(ProfileTabCopy.digestSubtitle), findsOneWidget);
    });

    testWidgets('no longer says "Not yet connected"', (tester) async {
      await tester.pumpWidget(
        _harness(DailyDigestToggle(initialValue: false, onWrite: (_) async {})),
      );

      expect(find.textContaining('Not yet connected'), findsNothing);
    });

    testWidgets('writes nothing on mount', (tester) async {
      // Seeding the switch is a read, never a write. An RPC fired on every
      // build would rewrite the row each time the tab is opened and would make
      // the failure banner appear for someone who touched nothing.
      final writes = <bool>[];
      await tester.pumpWidget(
        _harness(
          DailyDigestToggle(
            initialValue: true,
            onWrite: (v) async => writes.add(v),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(writes, isEmpty);
    });

    testWidgets('a second tap while saving does not queue a second write', (
      tester,
    ) async {
      final gate = Completer<void>();
      final writes = <bool>[];
      await tester.pumpWidget(
        _harness(
          DailyDigestToggle(
            initialValue: false,
            onWrite: (v) {
              writes.add(v);
              return gate.future;
            },
          ),
        ),
      );

      await tester.tap(_switch);
      await tester.pump();
      await tester.tap(_switch); // impatient second tap, write still in flight
      await tester.pump();

      expect(
        writes,
        [true],
        reason:
            'two RPCs racing on one row can land out of order and leave '
            'the column disagreeing with the switch',
      );

      gate.complete();
      await tester.pumpAndSettle();
      expect(_switchValue(tester), isTrue);
    });
  });

  group('DailyDigestToggle — failed write must not look successful', () {
    testWidgets('reverts the switch and says it did not save', (tester) async {
      // A gate, so the write is genuinely in flight for one frame — that is
      // when the optimistic state is observable.
      final gate = Completer<void>();
      await tester.pumpWidget(
        _harness(
          DailyDigestToggle(initialValue: false, onWrite: (_) => gate.future),
        ),
      );

      await tester.tap(_switch);
      await tester.pump(); // write pending

      expect(
        _switchValue(tester),
        isTrue,
        reason: 'the switch moves first so the tap feels immediate',
      );
      expect(find.text(ProfileTabCopy.digestSubtitle), findsOneWidget);

      gate.completeError(Exception('offline'));
      await tester.pumpAndSettle();

      expect(
        _switchValue(tester),
        isFalse,
        reason:
            'the column did not change, so the switch must not claim it '
            'did — this is the whole point of the failure path',
      );
      expect(find.text(ProfileTabCopy.digestSaveFailed), findsOneWidget);
      expect(find.text(ProfileTabCopy.digestSubtitle), findsNothing);
    });

    testWidgets('a later successful write clears the failure message', (
      tester,
    ) async {
      var shouldFail = true;
      await tester.pumpWidget(
        _harness(
          DailyDigestToggle(
            initialValue: false,
            onWrite: (_) async {
              if (shouldFail) throw Exception('offline');
            },
          ),
        ),
      );

      await tester.tap(_switch);
      await tester.pumpAndSettle();
      expect(find.text(ProfileTabCopy.digestSaveFailed), findsOneWidget);

      shouldFail = false;
      await tester.tap(_switch);
      await tester.pumpAndSettle();

      expect(_switchValue(tester), isTrue);
      expect(find.text(ProfileTabCopy.digestSaveFailed), findsNothing);
      expect(find.text(ProfileTabCopy.digestSubtitle), findsOneWidget);
    });
  });

  group('UserProfile does NOT carry the digest preference', () {
    Map<String, dynamic> row() => {
      'user_id': '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6',
      'display_name': 'Biome',
      'region': 'Singapore',
      'city': 'Singapore',
      'email': 'someone@example.com',
      'wearable_owned': true,
      'created_at': '2026-07-01T00:00:00.000Z',
      'updated_at': '2026-07-28T00:00:00.000Z',
    };

    test('toMap writes no daily_digest column to profiles', () {
      // Regression pin for the reworked gap 2: an earlier attempt put this on
      // `profiles`, which breaks R4-U2's nonreg column-privilege assertions
      // (443 → 441). The preference belongs in profile_notification_prefs,
      // reached only through the RPCs. If a `daily_digest_enabled` key ever
      // reappears in this map, the authz harness fails and this says why.
      expect(
        UserProfile.fromMap(row()).toMap().keys,
        isNot(contains('daily_digest_enabled')),
      );
    });

    test(
      'a legacy row that still has the column is read without complaint',
      () {
        // A dev database that applied the FIRST version of migration
        // 20260728040001 (the one that added the column to `profiles`, since
        // reworked) still has it, and `select *` will return it. fromMap reads
        // named keys, so an unexpected key must simply be ignored.
        final legacy = row()..['daily_digest_enabled'] = true;

        final profile = UserProfile.fromMap(legacy);

        expect(profile.wearableOwned, isTrue);
        expect(
          profile.toMap().keys,
          isNot(contains('daily_digest_enabled')),
          reason: 'reading a stale column must not start writing it back',
        );
      },
    );

    test('copyWith preserves every field it was not asked to change', () {
      final profile = UserProfile.fromMap(row());

      final flipped = profile.copyWith(wearableOwned: false);

      // The toggles used to rebuild UserProfile by hand, re-listing every field
      // at the call site — one field added later and it would be dropped
      // silently. copyWith keeps the copy exhaustive in one place.
      expect(flipped.wearableOwned, isFalse);
      expect(flipped.userId, profile.userId);
      expect(flipped.displayName, profile.displayName);
      expect(flipped.region, profile.region);
      expect(flipped.city, profile.city);
      expect(flipped.email, profile.email);
      expect(flipped.createdAt, profile.createdAt);
    });
  });

  group('Profile tab copy passes the non-diagnostic gate', () {
    test('every ProfileTabCopy string validates', () {
      expect(ProfileTabCopy.all, isNotEmpty);
      for (final s in ProfileTabCopy.all) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });

    test('the digest row admits nothing is sent yet', () {
      // The preference is real now; the delivery is not. Both must be on screen.
      expect(
        ProfileTabCopy.digestSubtitle.toLowerCase(),
        contains('saved to your account'),
      );
      expect(
        ProfileTabCopy.digestSubtitle.toLowerCase(),
        contains('no digest or notification is sent yet'),
      );
      expect(
        ProfileTabCopy.digestSubtitle,
        isNot(contains('Not yet connected')),
      );
    });

    test('the backdrop row says the choice is device-local', () {
      expect(
        ProfileTabCopy.backdropSubtitle.toLowerCase(),
        contains('on this device'),
      );
    });

    test(
      'the wearable row records ownership without claiming a connection',
      () {
        expect(ProfileTabCopy.wearableLabel, 'I use a wearable');
        expect(
          ProfileTabCopy.wearableSubtitle.toLowerCase(),
          contains('ownership only'),
        );
        expect(
          ProfileTabCopy.wearableSubtitle.toLowerCase(),
          contains('separately'),
        );
        expect(
          ProfileTabCopy.wearableSubtitle.toLowerCase(),
          isNot(contains('enables wearable syncing')),
        );
      },
    );
  });
}
