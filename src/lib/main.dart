import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/theme.dart';
import 'modules/m1_core/impl/auth_service.dart';
import 'modules/m1_core/impl/consent_service.dart';
import 'modules/m1_core/impl/profile_service.dart';
import 'modules/m1_core/models/consent_record.dart';
import 'modules/m1_core/ui/screens/sign_in_screen.dart';
import 'modules/m1_core/ui/screens/consent_screen.dart';
import 'modules/m1_core/ui/screens/profile_setup_screen.dart';
import 'modules/m1_core/ui/screens/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  await dotenv.load(fileName: '.env.public');

  final supabaseUrl = dotenv.env['SUPABASE_URL'];
  final supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'];
  if (supabaseUrl == null || supabaseUrl.isEmpty ||
      supabaseAnonKey == null || supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.public.',
    );
  }

  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  );
  runApp(const BiotopeApp());
}

class BiotopeApp extends StatelessWidget {
  const BiotopeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Biotope',
      debugShowCheckedModeBanner: false,
      theme: biotopeTheme(),
      home: const AuthGate(),
    );
  }
}

// ─── Onboarding state ────────────────────────────────────────────────────────

enum _OnboardStep { consent, profile, done }

Future<_OnboardStep> _checkOnboarding(String userId) async {
  final client = Supabase.instance.client;
  final hasConsent = await ConsentService(client)
      .hasConsented(userId, ConsentScope.gutTracking);
  if (!hasConsent) return _OnboardStep.consent;

  final profile = await ProfileService(client).getProfile(userId);
  if (profile == null || profile.displayName.isEmpty) return _OnboardStep.profile;

  return _OnboardStep.done;
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = AuthService(Supabase.instance.client);

    return StreamBuilder<AuthState>(
      stream: authService.onAuthStateChange,
      builder: (context, snapshot) {
        final session = Supabase.instance.client.auth.currentSession;

        if (session == null) {
          return SignInScreen(authService: authService);
        }

        return FutureBuilder<_OnboardStep>(
          future: _checkOnboarding(session.user.id),
          builder: (context, snap) {
            if (!snap.hasData) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            switch (snap.data!) {
              case _OnboardStep.consent:
                return const ConsentScreen();
              case _OnboardStep.profile:
                return const ProfileSetupScreen();
              case _OnboardStep.done:
                return const AppShell();
            }
          },
        );
      },
    );
  }
}
