import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../impl/auth_service.dart';
import 'sign_in_screen.dart';
import '../../../m2_self_report/ui/screens/urine_color_screen.dart';
import '../../../m2_self_report/ui/screens/stool_form_screen.dart';
import '../../../m2_self_report/ui/screens/daily_log_screen.dart';

/// Temporary home screen — placeholder until the full app shell is built.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    await Supabase.instance.client.auth.signOut();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => SignInScreen(
          authService: AuthService(Supabase.instance.client),
        ),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ourobion'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () => _signOut(context),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.eco, size: 64),
            const SizedBox(height: 16),
            const Text('You\'re in!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(
              user?.email ?? '',
              style: const TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            const Text(
              'Home screen — coming soon.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            // DEBUG: preview M2 screens before app shell is wired
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const UrineColorScreen()),
              ),
              child: const Text('[DEV] Urine Color Screen'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const StoolFormScreen()),
              ),
              child: const Text('[DEV] Stool Form Screen'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const DailyLogScreen()),
              ),
              child: const Text('[DEV] Daily Log Screen'),
            ),
          ],
        ),
      ),
    );
  }
}
