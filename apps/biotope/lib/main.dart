import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/app_preferences.dart';
import 'core/session_refresh_retry.dart';
import 'core/theme.dart';
import 'modules/m1_core/impl/auth_service.dart';
import 'modules/m1_core/impl/consent_service.dart';
import 'modules/m1_core/impl/profile_service.dart';
import 'modules/m1_core/models/consent_record.dart';
import 'modules/m1_core/ui/screens/sign_in_screen.dart';
import 'modules/m1_core/ui/screens/consent_screen.dart';
import 'modules/m1_core/ui/screens/profile_setup_screen.dart';
import 'modules/m1_core/ui/screens/app_shell.dart';
import 'modules/m1_core/ui/screens/waking_screen.dart';
import 'modules/m1_core/ui/widgets/auth_gate_recovery_screen.dart';
import 'modules/m1_core/ui/widgets/auth_gate_session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  await dotenv.load(fileName: '.env.public');

  // Device-local display preferences, restored before the first frame so the
  // waking screen never flashes the default backdrop and then correct itself.
  await AppPreferences.restore();

  final supabaseUrl = dotenv.env['SUPABASE_URL'];
  final supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'];
  if (supabaseUrl == null ||
      supabaseUrl.isEmpty ||
      supabaseAnonKey == null ||
      supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.public.',
    );
  }

  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  runApp(const OurobionApp());
}

class OurobionApp extends StatelessWidget {
  const OurobionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ourobion',
      debugShowCheckedModeBanner: false,
      theme: ourobionTheme(),
      home: const AuthGate(),
    );
  }
}

// ─── Onboarding state ────────────────────────────────────────────────────────

enum _OnboardStep { consent, profile, done }

Future<_OnboardStep> _checkOnboarding(String userId) async {
  final client = Supabase.instance.client;
  final hasConsent = await ConsentService(
    client,
  ).hasConsented(userId, ConsentScope.gutTracking);
  if (!hasConsent) return _OnboardStep.consent;

  final profile = await ProfileService(client).getProfile(userId);
  if (profile == null || profile.displayName.isEmpty) {
    return _OnboardStep.profile;
  }

  return _OnboardStep.done;
}

/// Races the real onboarding check against a minimum display time so the
/// [WakingScreen] never just flashes on a fast connection.
Future<_OnboardStep> _checkOnboardingWithMinDisplay(String userId) async {
  final results = await Future.wait([
    retryAfterSessionRefresh(() => _checkOnboarding(userId)),
    Future.delayed(const Duration(milliseconds: 1800)),
  ]);
  return results[0] as _OnboardStep;
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final AuthService _authService;
  late final AuthGateSessionController _session;
  StreamSubscription<AuthState>? _authSubscription;
  Future<_OnboardStep>? _onboardingFuture;
  String? _onboardingUserId;

  @override
  void initState() {
    super.initState();
    final client = Supabase.instance.client;
    _authService = AuthService(client);
    _session = AuthGateSessionController(
      initialUserId: client.auth.currentSession?.user.id,
    );
    _startOnboardingFor(_session.userId);
    _listenForAuthChanges();
  }

  void _listenForAuthChanges() {
    _authSubscription = _authService.onAuthStateChange.listen(
      _handleAuthState,
      onError: _handleAuthError,
    );
  }

  void _handleAuthState(AuthState state) {
    if (!mounted) return;
    final userId = state.session?.user.id;
    setState(() {
      final changedUser = _session.userId != userId;
      // Use this event's session rather than reading a global session again.
      // This makes a password sign-in transition in the same turn Supabase
      // publishes it, and treats a null event as sign-out.
      _session.receiveSession(userId);
      if (changedUser) _startOnboardingFor(userId);
    });
  }

  void _handleAuthError(Object error, StackTrace _) {
    if (!mounted) return;
    setState(() => _session.receiveError(error));
  }

  void _startOnboardingFor(String? userId) {
    if (_onboardingUserId == userId && _onboardingFuture != null) return;
    _onboardingUserId = userId;
    _onboardingFuture = userId == null
        ? null
        : _checkOnboardingWithMinDisplay(userId);
  }

  void _retryOnboarding() {
    final userId = _session.userId;
    if (userId == null) return;
    setState(() {
      _onboardingUserId = null;
      _startOnboardingFor(userId);
    });
  }

  void _retryAuthStream() {
    setState(_session.retry);
    unawaited(_restartAuthListener());
  }

  Future<void> _restartAuthListener() async {
    await _authSubscription?.cancel();
    if (!mounted) return;
    _listenForAuthChanges();
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (_session.phase) {
      case AuthGateSessionPhase.recoverableError:
        return AuthGateRecoveryScreen(onRetry: _retryAuthStream);
      case AuthGateSessionPhase.signedOut:
        return SignInScreen(authService: _authService);
      case AuthGateSessionPhase.signedIn:
        final onboardingFuture = _onboardingFuture;
        if (onboardingFuture == null) {
          return AuthGateRecoveryScreen(onRetry: _retryOnboarding);
        }
        return FutureBuilder<_OnboardStep>(
          future: onboardingFuture,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return AuthGateRecoveryScreen(onRetry: _retryOnboarding);
            }
            if (!snapshot.hasData) return const WakingScreen();
            switch (snapshot.data!) {
              case _OnboardStep.consent:
                return const ConsentScreen();
              case _OnboardStep.profile:
                return const ProfileSetupScreen();
              case _OnboardStep.done:
                return const AppShell();
            }
          },
        );
    }
  }
}
