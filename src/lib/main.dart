import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'modules/m1_core/impl/auth_service.dart';
import 'modules/m1_core/ui/screens/sign_in_screen.dart';

/// ──────────────────────────────────────────────────────────────
/// Biotope — main entry point
/// ──────────────────────────────────────────────────────────────

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables from .env file
  await dotenv.load(fileName: '.env');

  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  runApp(const BiotopeApp());
}

/// Root application widget.
class BiotopeApp extends StatelessWidget {
  const BiotopeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Biotope',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4CAF50), // Green – health/wellness feel
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

/// Decides whether to show the Sign-In screen or the Home screen
/// based on the current Supabase session.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = AuthService(Supabase.instance.client);

    return StreamBuilder<AuthState>(
      stream: authService.onAuthStateChange,
      builder: (context, snapshot) {
        // If a session exists, show the placeholder home screen.
        final session = Supabase.instance.client.auth.currentSession;
        if (session != null) {
          return const _HomeScaffold();
        }
        // Otherwise, show the sign-in screen.
        return SignInScreen(authService: authService);
      },
    );
  }
}

/// Temporary home screen placeholder — will be replaced with full
/// app shell + tab navigation in a later step.
class _HomeScaffold extends StatelessWidget {
  const _HomeScaffold();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Biotope')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Welcome! You are signed in.'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                await Supabase.instance.client.auth.signOut();
              },
              child: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }
}
