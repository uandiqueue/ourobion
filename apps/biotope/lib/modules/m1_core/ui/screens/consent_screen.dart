import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../impl/consent_service.dart';
import '../../models/consent_record.dart';
import 'profile_setup_screen.dart';

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  final _consentService = ConsentService(Supabase.instance.client);

  final Map<ConsentScope, bool> _consents = {
    ConsentScope.gutTracking: true,
    ConsentScope.behaviourTracking: true,
    ConsentScope.wearableData: false,
    ConsentScope.communityData: false,
  };

  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleContinue() async {
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      await _consentService.updateMultipleConsents(userId, _consents);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ProfileSetupScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() { _isLoading = false; _errorMessage = 'Failed to save. Please try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Consent')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Ourobion uses your logged data to surface patterns in your gut health and hydration. Your data shows observations only — we never diagnose.',
                    style: TextStyle(fontSize: 15),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Choose what you\'d like to share. You can update or withdraw consent any time in Settings.',
                    style: TextStyle(fontSize: 15),
                  ),
                  const SizedBox(height: 24),
                  SwitchListTile(
                    title: const Text('Gut & Hydration Tracking'),
                    subtitle: const Text('Log stool form, urine colour, and daily signals'),
                    value: _consents[ConsentScope.gutTracking]!,
                    onChanged: (v) => setState(() => _consents[ConsentScope.gutTracking] = v),
                  ),
                  const Divider(),
                  SwitchListTile(
                    title: const Text('Behaviour Tracking'),
                    subtitle: const Text('Log food, antibiotic use, and mosquito exposure'),
                    value: _consents[ConsentScope.behaviourTracking]!,
                    onChanged: (v) => setState(() => _consents[ConsentScope.behaviourTracking] = v),
                  ),
                  const Divider(),
                  // Wearable — greyed out, coming soon
                  SwitchListTile(
                    title: const Text('Wearable Data'),
                    subtitle: const Text('Coming soon — sync data from fitness trackers'),
                    value: _consents[ConsentScope.wearableData]!,
                    onChanged: null, // disabled in MVP
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Your rights: You may request access to, correction of, or deletion of your personal data at any time by contacting us through the app.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isLoading ? null : _handleContinue,
                  child: _isLoading
                      ? const SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Continue'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
