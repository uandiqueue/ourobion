// ProfileTab's LOAD path must fail visibly, never silently spin.
//
// Found by physical-device traversal on a Samsung SM-A165F: the Profile tab sat
// on a CircularProgressIndicator forever. The trigger was a backend read that
// threw (the daily-digest RPC was not yet in PostgREST's schema cache), but the
// DEFECT is the handling:
//
//   * `_load()` had no try/catch, so the exception escaped and `_loading` was
//     never cleared;
//   * the tab lives in the app shell's IndexedStack, which keeps its State
//     alive, so re-tapping Profile reused the same dead state;
//   * there was no retry, so the tab stayed broken FOR THE WHOLE SESSION even
//     after the backend recovered — only force-stopping the app cleared it.
//
// The write path already had this covered (`digestSaveFailed`, and a test that a
// failed write must not look successful). The read path did not.
//
// ProfileTab needs Supabase.instance, so — following the precedent of
// insight_status_contract_test.dart — these assertions PARSE THE REAL SOURCE
// rather than pumping the widget. A test that restated the expected strings
// would pass while the shipped file drifted.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/profile_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

String _source() {
  final file = File('lib/modules/m1_core/ui/screens/profile_tab.dart');
  expect(file.existsSync(), isTrue,
      reason: 'profile_tab.dart must exist at the path this test parses');
  return file.readAsStringSync();
}

/// The body of `Future<void> _load() async { ... }`, balanced-brace matched so a
/// nested block cannot end the capture early.
String _loadBody(String src) {
  final start = src.indexOf('Future<void> _load() async');
  expect(start, isNonNegative, reason: '_load() must still exist');
  final open = src.indexOf('{', start);
  var depth = 0;
  for (var i = open; i < src.length; i++) {
    if (src[i] == '{') depth++;
    if (src[i] == '}') {
      depth--;
      if (depth == 0) return src.substring(open, i + 1);
    }
  }
  fail('could not find the end of _load()');
}

void main() {
  group('ProfileTab load failure is handled', () {
    test('_load() catches read failures', () {
      final body = _loadBody(_source());

      expect(body.contains('catch'), isTrue,
          reason:
              'an uncaught throw in _load leaves _loading true forever — the '
              'stuck-spinner bug found on a physical device');
    });

    test('_load() clears _loading on the failure path too', () {
      final body = _loadBody(_source());
      final catchIndex = body.indexOf('catch');
      expect(catchIndex, isNonNegative);

      final catchBlock = body.substring(catchIndex);
      expect(catchBlock.contains('_loading = false'), isTrue,
          reason: 'the catch block must clear _loading, or the spinner persists '
              'even though the read already failed');
    });

    test('a failed load is distinguishable from a successful one', () {
      final src = _source();

      expect(src.contains('_loadFailed'), isTrue,
          reason: 'the tab must be able to tell "loaded" from "failed to load" — '
              'otherwise a failure renders as an empty but normal-looking tab');
      expect(src.contains('ProfileTabCopy.loadFailed'), isTrue,
          reason: 'the failure state must actually say something to the user');
    });

    test('the user can retry without restarting the app', () {
      final src = _source();

      expect(src.contains('_retryLoad'), isTrue,
          reason: 'the tab is kept alive in an IndexedStack, so without an '
              'explicit retry a transient failure is permanent for the session');
      expect(src.contains('onPressed: _retryLoad'), isTrue,
          reason: 'the retry must be reachable from the failure UI');
    });
  });

  group('failure copy', () {
    test('load-failure strings are registered in ProfileTabCopy.all', () {
      expect(ProfileTabCopy.all, contains(ProfileTabCopy.loadFailed));
      expect(ProfileTabCopy.all, contains(ProfileTabCopy.retry));
    });

    test('load-failure strings pass the non-diagnostic gate', () {
      for (final s in [ProfileTabCopy.loadFailed, ProfileTabCopy.retry]) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('the failure message reports the failure rather than implying success',
        () {
      expect(ProfileTabCopy.loadFailed.toLowerCase(), contains('could not'));
    });
  });
}
