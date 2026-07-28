import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../impl/consent_service.dart';
import '../../models/consent_record.dart';
import 'profile_setup_screen.dart';

/// Every user-facing string this screen owns.
///
/// Enumerated in one place so the non-diagnostic copy gate can assert over the
/// whole set (test/m1_core/consent_copy_gate_test.dart), and so the honesty
/// claims below are checkable rather than reviewer-trusted.
abstract final class ConsentScreenCopy {
  static const appBarTitle = 'Privacy & Consent';

  static const intro =
      'Ourobion uses your logged data to surface patterns in your gut health '
      'and hydration. Your data shows observations only — we never diagnose.';

  /// Was: "You can update or withdraw consent any time in Settings." There is
  /// no settings or consent-management screen in this app — the Profile tab
  /// carries wearable / backdrop / daily-digest preferences and touches
  /// [ConsentService] nowhere. Promising a screen that does not exist is the
  /// kind of claim this copy set exists to stop.
  static const chooseWhatToShare =
      'Choose what you\'d like to share. Your choices are recorded when you '
      'continue — changing them later is not built into the app yet.';

  static const gutLabel = 'Gut & Hydration Tracking';
  static const gutSubtitle =
      'Log stool form, urine colour, and daily signals';

  static const behaviourLabel = 'Behaviour Tracking';
  static const behaviourSubtitle =
      'Log food, antibiotic use, and mosquito exposure';

  /// Wearable reading is BUILT and running — `WearableService.syncToday` reads
  /// Health Connect / HealthKit and upserts `wearable_daily`. The row here used
  /// to say 'Coming soon — sync data from fitness trackers' behind a disabled
  /// switch, which was the inverse of the truth.
  ///
  /// It is now a statement, not a control. Nothing in this repo consults
  /// `ConsentScope.wearableData`, so a switch here would be a control whose
  /// "off" position did not stop the collection it appears to govern — worse
  /// than no control at all. The real, user-facing gate today is the phone's
  /// own health-data permission prompt, which the copy names.
  static const wearableLabel = 'Wearable Data';
  static const wearableStatement =
      'Read from your phone\'s health data while you use the app. Your phone '
      'asks for that permission, and you can withdraw it in your phone\'s '
      'settings.';

  /// Was: "...by contacting us through the app." No contact affordance exists
  /// anywhere in `lib/` — no mail link, no support screen, no form. The right
  /// is real (PDPA); the in-app route is not, so the copy says so plainly
  /// instead of pointing at nothing.
  static const rights =
      'Your rights: You may request access to, correction of, or deletion of '
      'your personal data at any time. The app has no way to send that request '
      'yet, so it has to be raised outside the app.';

  static const saveFailed = 'Failed to save. Please try again.';
  static const continueLabel = 'Continue';

  static const all = <String>[
    appBarTitle,
    intro,
    chooseWhatToShare,
    gutLabel,
    gutSubtitle,
    behaviourLabel,
    behaviourSubtitle,
    wearableLabel,
    wearableStatement,
    rights,
    saveFailed,
    continueLabel,
  ];
}

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  final _consentService = ConsentService(Supabase.instance.client);

  /// Only the scopes this screen genuinely asks about are recorded.
  ///
  /// [ConsentScope.wearableData] is deliberately ABSENT. This screen used to
  /// append a `granted: false` record for it while `WearableService.syncToday`
  /// was reading the phone's health data and upserting `wearable_daily` — an
  /// append-only consent row that stated the opposite of what the app does.
  /// Writing nothing is truthful; writing `false` was not. Restoring the row
  /// means giving the scope a control that actually gates the sync, which is an
  /// owner decision (see this unit's session log), not a copy fix.
  ///
  /// [ConsentScope.communityData] stays: `granted: false` is accurate there —
  /// M7 does not exist and nothing community-shaped is collected.
  final Map<ConsentScope, bool> _consents = {
    ConsentScope.gutTracking: true,
    ConsentScope.behaviourTracking: true,
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
      setState(() { _isLoading = false; _errorMessage = ConsentScreenCopy.saveFailed; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(ConsentScreenCopy.appBarTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    ConsentScreenCopy.intro,
                    style: TextStyle(fontSize: 15),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    ConsentScreenCopy.chooseWhatToShare,
                    style: TextStyle(fontSize: 15),
                  ),
                  const SizedBox(height: 24),
                  SwitchListTile(
                    title: const Text(ConsentScreenCopy.gutLabel),
                    subtitle: const Text(ConsentScreenCopy.gutSubtitle),
                    value: _consents[ConsentScope.gutTracking]!,
                    onChanged: (v) => setState(() => _consents[ConsentScope.gutTracking] = v),
                  ),
                  const Divider(),
                  SwitchListTile(
                    title: const Text(ConsentScreenCopy.behaviourLabel),
                    subtitle: const Text(ConsentScreenCopy.behaviourSubtitle),
                    value: _consents[ConsentScope.behaviourTracking]!,
                    onChanged: (v) => setState(() => _consents[ConsentScope.behaviourTracking] = v),
                  ),
                  const Divider(),
                  const _WearableStatementRow(),
                  const SizedBox(height: 24),
                  const Text(
                    ConsentScreenCopy.rights,
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
                      : const Text(ConsentScreenCopy.continueLabel),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The wearable channel's row on the consent screen — a STATEMENT, not a
/// control, and the same honesty pattern as `EnvironmentRow` on the Scan tab
/// (scan_tab.dart) inverted.
///
/// EnvironmentRow labels a channel that does not exist. This one labels a
/// channel that DOES exist and is not governed from here: wearable reading is
/// live (`WearableService.syncToday` → `wearable_daily`), while nothing in this
/// repo reads `ConsentScope.wearableData`. So there is no switch — a switch
/// whose "off" position did not stop the sync would be a fake control, and
/// making it gate the sync is an owner decision, not a copy fix.
///
/// No `onTap`, no `GestureDetector`, no focusable descendant: it is exposed to
/// assistive tech as a single non-interactive node.
class _WearableStatementRow extends StatelessWidget {
  const _WearableStatementRow();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      enabled: false,
      label: '${ConsentScreenCopy.wearableLabel}. '
          '${ConsentScreenCopy.wearableStatement}',
      child: const ExcludeSemantics(
        child: ListTile(
          contentPadding: EdgeInsets.symmetric(horizontal: 16),
          leading: Icon(Icons.watch_outlined),
          title: Text(ConsentScreenCopy.wearableLabel),
          subtitle: Text(ConsentScreenCopy.wearableStatement),
        ),
      ),
    );
  }
}
