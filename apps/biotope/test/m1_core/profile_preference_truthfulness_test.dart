// Every Profile preference row must state its actual effect — not what it
// looks like it should do.
//
// Verified against the code before writing any assertion (background facts
// for #282, re-confirmed against the merged ProfileTab):
//   * profiles.wearable_owned is written by ProfileTab._toggleWearableOwned
//     and read back only to render its own switch. It gates nothing —
//     WearableService.syncToday is called unconditionally by every Scan
//     sweep. The migration comment says "toggle only, no integration in
//     MVP". So the flag records ownership only; it does not enable, control
//     or gate syncing in any way.
//   * AppPreferences.backdropEnabled is a device-local ValueNotifier (no
//     network write) that only toggles a decorative animation on supported
//     hero screens.
//   * The daily-digest preference persists server-side
//     (profile_notification_prefs, via ProfileService.setDailyDigestEnabled)
//     but nothing in this repo composes or delivers a digest or notification.
//
// These tests assert the shipped ProfileTabCopy strings actually say all of
// that, rather than trusting a reviewer to notice a subtly false claim. Most
// of this contract is already pinned incidentally by profile_digest_test.dart
// (which exists to cover the toggle's optimistic-revert behaviour); this file
// is the dedicated, exhaustive pass over the three preference rows' copy.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/profile_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
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

    test('the subtitle does not claim the switch enables or controls syncing', () {
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
    });

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
      // The subtitle must not claim any effect on logged data, syncing or
      // account state — it is a rendering preference only.
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

    test(
      'the subtitle states both the real persistence and the real gap',
      () {
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
      },
    );

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
