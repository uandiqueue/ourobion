import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const _callbackUri = 'com.ourobion.app://login-callback/';
const _authService = 'lib/modules/m1_core/impl/auth_service.dart';
const _signUpScreen = 'lib/modules/m1_core/ui/screens/sign_up_screen.dart';
const _androidManifest = 'android/app/src/main/AndroidManifest.xml';

String _source(String path) {
  final file = File(path);
  expect(file.existsSync(), isTrue, reason: '$path must exist for this guard');
  return file.readAsStringSync();
}

void main() {
  group('email confirmation callback', () {
    test('sign-up requests the package-owned Biotope callback URI', () {
      final source = _source(_authService);

      expect(source, contains("'$_callbackUri'"));
      expect(source, contains('emailRedirectTo: emailConfirmationRedirectTo'));
    });

    test('Android exports a browsable VIEW callback to MainActivity', () {
      final manifest = _source(_androidManifest);
      final mainActivity = RegExp(
        r'<activity\s+android:name="\.MainActivity"[\s\S]*?</activity>',
      ).firstMatch(manifest)?.group(0);
      final callbackFilter = RegExp(
        r'<intent-filter>\s*'
        r'<action android:name="android\.intent\.action\.VIEW"/>\s*'
        r'<category android:name="android\.intent\.category\.DEFAULT"/>\s*'
        r'<category android:name="android\.intent\.category\.BROWSABLE"/>\s*'
        r'<data\s+android:scheme="com\.ourobion\.app"\s+'
        r'android:host="login-callback"/>\s*'
        r'</intent-filter>',
      );

      expect(
        mainActivity,
        isNotNull,
        reason: 'MainActivity must own the app callback intent filter',
      );
      expect(mainActivity, contains('android:exported="true"'));
      expect(mainActivity, contains(callbackFilter));
    });

    test('success copy explains verification and the return to Biotope', () {
      final source = _source(_signUpScreen).toLowerCase();

      expect(source, contains('account created'));
      expect(source, contains('check your email'));
      expect(source, contains('verify'));
      expect(source, contains('confirmation link will return you to biotope'));
      expect(source, isNot(contains('account created! please sign in.')));
    });
  });
}
