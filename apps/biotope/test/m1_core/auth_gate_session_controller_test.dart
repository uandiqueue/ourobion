import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/widgets/auth_gate_recovery_screen.dart';
import 'package:src/modules/m1_core/ui/widgets/auth_gate_session_controller.dart';

import '../../../../shared/constants/copy_guidelines.dart';

String _mainSource() {
  final file = File('lib/main.dart');
  expect(file.existsSync(), isTrue);
  return file.readAsStringSync();
}

void main() {
  group('AuthGateSessionController', () {
    test('a password sign-in event becomes signed in immediately', () {
      final controller = AuthGateSessionController();

      controller.receiveSession('new-session-user');

      expect(controller.phase, AuthGateSessionPhase.signedIn);
      expect(controller.userId, 'new-session-user');
    });

    test('a restored session starts signed in', () {
      final controller = AuthGateSessionController(
        initialUserId: 'restored-user',
      );

      expect(controller.phase, AuthGateSessionPhase.signedIn);
      expect(controller.userId, 'restored-user');
    });

    test('a null auth event signs out the current user', () {
      final controller = AuthGateSessionController(
        initialUserId: 'signed-in-user',
      );

      controller.receiveSession(null);

      expect(controller.phase, AuthGateSessionPhase.signedOut);
      expect(controller.userId, isNull);
    });

    test('an auth error is visible until retry', () {
      final controller = AuthGateSessionController(
        initialUserId: 'signed-in-user',
      );

      controller.receiveError(StateError('stream unavailable'));
      expect(controller.phase, AuthGateSessionPhase.recoverableError);

      controller.retry();
      expect(controller.phase, AuthGateSessionPhase.signedIn);
    });
  });

  test('first password sign-in does not wait for a later stream event', () {
    final source = _mainSource();

    expect(source, contains('onSignedIn: _handlePasswordSignIn'));
    expect(source, contains('void _handlePasswordSignIn(String userId)'));
    expect(source, contains('state.session?.user.id'));
  });

  test('the gate routes auth and onboarding failures to recovery', () {
    final source = _mainSource();

    expect(source, contains('onError: _handleAuthError'));
    expect(source, contains('snapshot.hasError'));
    expect(
      source,
      contains('AuthGateRecoveryScreen(onRetry: _retryOnboarding)'),
    );
  });

  test('the auth service clears a confirmed-invalid cached session', () {
    final authService = File('lib/modules/m1_core/impl/auth_service.dart');
    final source = authService.readAsStringSync();

    expect(source, contains('validateCurrentSession'));
    expect(source, contains('_client.auth.getUser(session.accessToken)'));
    expect(source, contains("case '401':"));
    expect(source, contains("case '403':"));
    expect(source, contains("case '404':"));
    expect(_mainSource(), contains('await _authService.signOut()'));
  });

  test('recovery copy stays concise and non-diagnostic', () {
    for (final copy in AuthGateRecoveryCopy.all) {
      expect(CopyRules.validateCopyString(copy), isTrue);
    }
  });
}
