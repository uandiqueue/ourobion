
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/app_preferences.dart';
import 'package:src/modules/m1_core/impl/profile_service.dart';
import 'package:src/modules/m1_core/models/user_profile.dart';
import 'package:src/modules/m1_core/ui/screens/profile_tab.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../shared/constants/copy_guidelines.dart';

class _ProfileTabService extends ProfileService {
  _ProfileTabService(this.profile)
    : super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  final UserProfile profile;
  bool digestEnabled = false;
  final List<Map<String, dynamic>> profileWrites = [];
  final List<bool> digestWrites = [];

  @override
  Future<UserProfile?> getProfile(String userId) async => profile;

  @override
  Future<bool> getDailyDigestEnabled() async => digestEnabled;

  @override
  Future<void> updateProfile(
    String userId,
    Map<String, dynamic> updates,
  ) async {
    profileWrites.add({...updates, 'user_id': userId});
  }

  @override
  Future<void> setDailyDigestEnabled(bool enabled) async {
    digestWrites.add(enabled);
    digestEnabled = enabled;
  }
}

final _profile = UserProfile(
  userId: 'profile-test-user',
  displayName: 'Test Person',
  region: 'Singapore',
  city: 'Singapore',
  email: null,
  wearableOwned: false,
  createdAt: DateTime.utc(2026, 1, 1),
  updatedAt: DateTime.utc(2026, 1, 1),
);

Widget _profileHarness(_ProfileTabService service) => MaterialApp(
  home: ProfileTab(service: service, userId: _profile.userId),
);

void main() {
  group('the actual ProfileTab renders and wires every preference row', () {
    setUp(() => AppPreferences.resetForTest());
    tearDown(() => AppPreferences.resetForTest());

    testWidgets(
      'all three real rows render their constants and persist through their declared owners',
      (tester) async {
        final service = _ProfileTabService(_profile);
        await tester.pumpWidget(_profileHarness(service));
        await tester.pumpAndSettle();

        for (final copy in [
          ProfileTabCopy.wearableLabel,
          ProfileTabCopy.wearableSubtitle,
          ProfileTabCopy.backdropLabel,
          ProfileTabCopy.backdropSubtitle,
          ProfileTabCopy.digestLabel,
          ProfileTabCopy.digestSubtitle,
        ]) {
          expect(
            find.text(copy),
            findsOneWidget,
            reason: 'removing or disconnecting $copy must fail this test',
          );
        }

        await tester.tap(find.text(ProfileTabCopy.wearableLabel));
        await tester.pumpAndSettle();
        expect(service.profileWrites, [
          {'wearable_owned': true, 'user_id': _profile.userId},
        ]);
        expect(
          service.digestWrites,
          isEmpty,
          reason: 'wearable ownership is not the digest preference',
        );

        expect(AppPreferences.backdropEnabled.value, isTrue);
        await tester.tap(find.text(ProfileTabCopy.backdropLabel));
        await tester.pumpAndSettle();
        expect(
          AppPreferences.backdropEnabled.value,
          isFalse,
          reason: 'living backdrop must toggle the device-local visual value',
        );
        expect(
          service.profileWrites,
          hasLength(1),
          reason: 'backdrop must not become account/profile data',
        );

        await tester.tap(find.text(ProfileTabCopy.digestLabel));
        await tester.pumpAndSettle();
        expect(service.digestWrites, [true]);
        expect(
          service.profileWrites,
          hasLength(1),
          reason:
              'daily digest uses its own RPC-backed preference, not profiles',
        );
      },
    );
  });

  group('wearable row records ownership only — it does not gate syncing', () {
    test('the label does not claim an active connection', () {
      expect(
        ProfileTabCopy.wearableLabel.toLowerCase(),
        isNot(contains('connected')),
        reason:
            'nothing in this repo establishes or reports a live connection; '
            'the column is a one-off ownership flag',
      );
      expect(ProfileTabCopy.wearableLabel, 'I use a wearable');
    });

    test(
      'the subtitle does not claim the switch enables or controls syncing',
      () {
        final s = ProfileTabCopy.wearableSubtitle.toLowerCase();
        expect(
          s,
          isNot(contains('enables')),
          reason:
              'WearableService.syncToday runs unconditionally on every Scan '
              'sweep — this flag never gates or enables it',
        );
        expect(s, isNot(contains('sync')));
        expect(s, isNot(contains('controls')));
      },
    );

    test('the subtitle states the real, narrower effect', () {
      final s = ProfileTabCopy.wearableSubtitle.toLowerCase();
      expect(
        s,
        contains('ownership only'),
        reason: 'the true effect is recording ownership, nothing more',
      );
      expect(
        s,
        contains('separately'),
        reason:
            'Scan requesting provider access on its own is the real '
            'mechanism; this toggle is not it',
      );
    });
  });

  group('backdrop row states it is device-local and visual-only', () {
    test('the subtitle says the preference stays on this device', () {
      expect(
        ProfileTabCopy.backdropSubtitle.toLowerCase(),
        contains('on this device'),
      );
      expect(ProfileTabCopy.backdropSubtitle.toLowerCase(), contains('only'));
    });

    test('the subtitle describes a visual effect and nothing else', () {
      final s = ProfileTabCopy.backdropSubtitle.toLowerCase();
      expect(
        s,
        contains('drifting orbs'),
        reason: 'the described effect is decorative animation, not data',
      );
      expect(s, isNot(contains('data')));
      expect(s, isNot(contains('sync')));
      expect(s, isNot(contains('account')));
      expect(s, isNot(contains('log')));
    });
  });

  group('digest row cannot be read as "notifications are on"', () {
    test('the subtitle never implies a digest is delivered', () {
      final s = ProfileTabCopy.digestSubtitle.toLowerCase();
      expect(s, isNot(contains("you'll receive")));
      expect(s, isNot(contains('you will receive')));
      expect(s, isNot(contains('delivered')));
    });

    test('the subtitle states both the real persistence and the real gap', () {
      final s = ProfileTabCopy.digestSubtitle.toLowerCase();
      expect(
        s,
        contains('saved to your account'),
        reason: 'the preference genuinely persists server-side now',
      );
      expect(
        s,
        contains('no digest or notification is sent yet'),
        reason: 'nothing in this repo composes or delivers one',
      );
    });

    test('the failure copy reports the failure rather than a save', () {
      final s = ProfileTabCopy.digestSaveFailed.toLowerCase();
      expect(s, contains('not saved'));
      expect(s, isNot(contains('success')));
    });
  });

  group('every preference row is registered and passes the copy gate', () {
    test('all three rows\' strings are in ProfileTabCopy.all', () {
      for (final s in [
        ProfileTabCopy.wearableLabel,
        ProfileTabCopy.wearableSubtitle,
        ProfileTabCopy.backdropLabel,
        ProfileTabCopy.backdropSubtitle,
        ProfileTabCopy.digestLabel,
        ProfileTabCopy.digestSubtitle,
        ProfileTabCopy.digestSaveFailed,
      ]) {
        expect(ProfileTabCopy.all, contains(s));
      }
    });

    test('every ProfileTabCopy string passes validateCopyString', () {
      expect(ProfileTabCopy.all, isNotEmpty);
      for (final s in ProfileTabCopy.all) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  });
}
