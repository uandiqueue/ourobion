// The onboarding surfaces must not claim more than the app can do.
//
// Every defect pinned here shipped past a clean `flutter analyze` and a green
// widget suite, because none of them is a crash — they are sentences and
// controls that describe features this repo does not contain. A reviewer has to
// know the whole codebase to spot one, so they are asserted instead.
//
// These screens all need `Supabase.instance` (unavailable under `flutter test`),
// so — following the precedent of profile_load_failure_test.dart and
// insight_status_contract_test.dart — the structural assertions PARSE THE REAL
// SOURCE rather than pumping the widget. A test that restated the expected
// strings would pass while the shipped file drifted.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/consent_screen.dart';
import 'package:src/modules/m1_core/ui/screens/profile_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

/// The file's CODE, with comments stripped.
///
/// Stripping matters: several of the assertions below look for the ABSENCE of a
/// string ('Forgot password', 'Privacy Policy'), and the removals they pin are
/// each explained in a comment at the deletion site — naming the thing that was
/// taken out. Matching raw source would fail on the explanation and, worse,
/// would pressure the next author to delete the reasoning to get green.
String _source(String relativePath) {
  final file = File(relativePath);
  expect(file.existsSync(), isTrue,
      reason: '$relativePath must exist at the path this test parses');
  return _stripComments(file.readAsStringSync());
}

String _stripComments(String src) {
  final out = StringBuffer();
  var i = 0;
  var inSingle = false; // '...'
  var inDouble = false; // "..."
  while (i < src.length) {
    final c = src[i];
    final next = i + 1 < src.length ? src[i + 1] : '';
    if (inSingle || inDouble) {
      out.write(c);
      if (c == r'\') {
        if (next.isNotEmpty) out.write(next);
        i += 2;
        continue;
      }
      if (inSingle && c == "'") inSingle = false;
      if (inDouble && c == '"') inDouble = false;
      i++;
      continue;
    }
    if (c == "'") {
      inSingle = true;
      out.write(c);
      i++;
      continue;
    }
    if (c == '"') {
      inDouble = true;
      out.write(c);
      i++;
      continue;
    }
    if (c == '/' && next == '/') {
      while (i < src.length && src[i] != '\n') {
        i++;
      }
      continue;
    }
    if (c == '/' && next == '*') {
      i += 2;
      while (i + 1 < src.length && !(src[i] == '*' && src[i + 1] == '/')) {
        i++;
      }
      i += 2;
      continue;
    }
    out.write(c);
    i++;
  }
  return out.toString();
}

const _signIn = 'lib/modules/m1_core/ui/screens/sign_in_screen.dart';
const _signUp = 'lib/modules/m1_core/ui/screens/sign_up_screen.dart';
const _consent = 'lib/modules/m1_core/ui/screens/consent_screen.dart';
const _profileTab = 'lib/modules/m1_core/ui/screens/profile_tab.dart';
const _urine = 'lib/modules/m2_self_report/ui/screens/urine_color_screen.dart';
const _stool = 'lib/modules/m2_self_report/ui/screens/stool_form_screen.dart';
const _badgeChip = 'lib/core/widgets/badge_chip.dart';

void main() {
  group('consent-screen copy passes the non-diagnostic gate', () {
    test('every ConsentScreenCopy string validates', () {
      expect(ConsentScreenCopy.all, isNotEmpty);
      for (final s in ConsentScreenCopy.all) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('no string is empty or whitespace-only', () {
      for (final s in ConsentScreenCopy.all) {
        expect(s.trim(), isNotEmpty);
      }
    });

    test('the screen renders only strings from the enumerated set', () {
      // Keeps the gate honest: an inline literal added later would escape it.
      final src = _source(_consent);
      final inlineTexts = RegExp(r"Text\(\s*'").allMatches(src).length +
          RegExp(r'Text\(\s*"').allMatches(src).length;
      expect(inlineTexts, 0,
          reason: 'user-facing text on the consent screen must come from '
              'ConsentScreenCopy so the copy gate can see it');
    });
  });

  group('consent screen promises nothing that does not exist', () {
    test('it does not point the user at a Settings screen', () {
      // There is no settings or consent-management screen anywhere in lib/. The
      // Profile tab carries wearable / backdrop / daily-digest preferences and
      // never touches ConsentService.
      for (final s in ConsentScreenCopy.all) {
        expect(s.toLowerCase(), isNot(contains('in settings')));
      }
      expect(ConsentScreenCopy.chooseWhatToShare.toLowerCase(),
          isNot(contains('withdraw consent')));
      expect(ConsentScreenCopy.chooseWhatToShare.toLowerCase(),
          contains('not built into the app yet'));
    });

    test('it does not offer an in-app contact route', () {
      // No mail link, support screen or form exists in lib/.
      expect(ConsentScreenCopy.rights.toLowerCase(),
          isNot(contains('contacting us')));
      expect(ConsentScreenCopy.rights.toLowerCase(),
          isNot(contains('through the app')));
      expect(ConsentScreenCopy.rights.toLowerCase(),
          contains('no way to send that request'));
    });

    test('the wearable row is not labelled "coming soon"', () {
      // Inverted claim: wearable reading is BUILT and running
      // (WearableService.syncToday → wearable_daily).
      expect(ConsentScreenCopy.wearableStatement.toLowerCase(),
          isNot(contains('coming soon')));
      expect(ConsentScreenCopy.wearableStatement.toLowerCase(),
          isNot(contains('soon')));
      expect(ConsentScreenCopy.wearableStatement.toLowerCase(),
          contains('permission'));
    });

    test('the wearable row renders no switch and no tap target', () {
      // A switch here would be a fake control: nothing in this repo reads
      // ConsentScope.wearableData, so "off" would not stop the sync it appears
      // to govern.
      final src = _source(_consent);
      final start = src.indexOf('class _WearableStatementRow');
      expect(start, isNonNegative,
          reason: 'the wearable row must stay a statement widget');
      final row = src.substring(start);
      for (final control in [
        'SwitchListTile',
        'Switch(',
        'onChanged',
        'onTap',
        'GestureDetector',
        'Button',
      ]) {
        expect(row, isNot(contains(control)),
            reason: 'the wearable consent row must not look operable ($control)');
      }
    });

    test('it records no consent value for the wearable scope', () {
      // It used to append `granted: false` for wearable_data while the sync ran
      // — an append-only record stating the opposite of the app's behaviour.
      final src = _source(_consent);
      final start = src.indexOf('final Map<ConsentScope, bool> _consents');
      expect(start, isNonNegative);
      final map = src.substring(start, src.indexOf('};', start));
      expect(map, isNot(contains('ConsentScope.wearableData')),
          reason: 'writing granted:false for a scope the app collects anyway is '
              'a false record; write nothing until the scope actually gates '
              'WearableService.syncToday');
      expect(map, contains('ConsentScope.gutTracking'));
      expect(map, contains('ConsentScope.behaviourTracking'));
    });
  });

  group('sign-in offers no control it cannot honour', () {
    test('there is no "Forgot password?" affordance', () {
      final src = _source(_signIn);
      expect(src, isNot(contains('Forgot password')),
          reason: 'it was an enabled TextButton with `onPressed: () {}` on the '
              'first screen of the app; AuthService still has no reset path');
    });

    test('no button on the screen has an empty callback', () {
      final src = _source(_signIn);
      expect(RegExp(r'onPressed:\s*\(\)\s*\{\s*\}').hasMatch(src), isFalse,
          reason: 'an empty onPressed renders an operable-looking dead control');
    });
  });

  group('sign-up claims no document that does not exist', () {
    test('the consent note does not reference Terms or a Privacy Policy', () {
      final src = _source(_signUp);
      for (final claim in ['Terms and Privacy', 'Privacy Policy', 'our Terms']) {
        expect(src, isNot(contains(claim)),
            reason: 'no such document, route or tap target exists in this repo');
      }
    });

    test('what remains — the next-step sentence — is true of AuthGate', () {
      expect(_source(_signUp),
          contains("You'll set your data permissions in the next step."));
      // main.dart's AuthGate routes an un-consented session to ConsentScreen.
      expect(_source('lib/main.dart'), contains('ConsentScreen()'));
    });
  });

  group('the self-report detail screens show no fabricated step counter', () {
    test('no "NN / 08" position is rendered', () {
      // There is no eight-step flow: DailyLogScreen is one scrolling form that
      // pushes four optional detail screens.
      final counter = RegExp(r"'\s*\d+\s*/\s*\d+\s*'");
      for (final path in [_urine, _stool]) {
        final src = _source(path);
        expect(counter.hasMatch(src), isFalse,
            reason: '$path must not present a position in a flow that does not '
                'exist');
      }
    });

    test('the back control survives', () {
      for (final path in [_urine, _stool]) {
        expect(_source(path), contains('Icons.arrow_back_rounded'),
            reason: 'removing the counter must not remove the way back');
      }
    });
  });

  group('the profile heading never invents a name', () {
    test("the 'Biome' literal is gone", () {
      expect(_source(_profileTab), isNot(contains("'Biome'")),
          reason: 'an empty/null profile read rendered it at 22pt, '
              'indistinguishable from a name the user chose');
    });

    test('the fallback is the account email, then an explicit empty state', () {
      final src = _source(_profileTab);
      expect(src, contains('accountEmail ?? ProfileTabCopy.noNameSet'));
      expect(ProfileTabCopy.all, contains(ProfileTabCopy.noNameSet));
      expect(CopyRules.validateCopyString(ProfileTabCopy.noNameSet), isTrue);
    });

    test('the empty state is not name-shaped', () {
      // It has to read as an absence, not as a value.
      final s = ProfileTabCopy.noNameSet.toLowerCase();
      expect(s.contains('no ') || s.contains('not '), isTrue,
          reason: 'a bare word in this slot reads as the user\'s name');
    });
  });

  group('BadgeChip.disabled cannot default to a promise', () {
    test('label is required', () {
      final src = _source(_badgeChip);
      expect(src, isNot(contains("label = 'Coming soon'")),
          reason: 'a "Coming soon" default is one omitted argument away from '
              'promising a delivery nobody has scheduled');
      expect(src, contains('BadgeChip.disabled({super.key, required this.label})'));
    });
  });
}
