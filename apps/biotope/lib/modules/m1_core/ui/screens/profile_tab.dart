import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/app_preferences.dart';
import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../impl/auth_service.dart';
import '../../impl/profile_service.dart';
import '../../models/user_profile.dart';
import 'sign_in_screen.dart';

/// Every user-facing string the Profile tab's preference rows own.
///
/// Enumerated in one place so the non-diagnostic copy gate can assert over the
/// whole set (test/m1_core/profile_digest_test.dart) instead of trusting a
/// reviewer to spot a banned word inline.
abstract final class ProfileTabCopy {
  static const backdropLabel = 'Living backdrop';
  static const backdropSubtitle =
      'Shows drifting orbs on supported hero screens. Saved on this device only.';

  static const digestLabel = 'Daily digest';

  /// Honest by construction: the preference genuinely persists now (gap 2) —
  /// server-side, in `profile_notification_prefs`, so it follows the account
  /// rather than the device — but nothing in this repo composes or sends a
  /// digest. The row says both. "Account" rather than "profile" because the
  /// value is deliberately NOT on the `profiles` table.
  static const digestSubtitle =
      'Saved to your account. No digest or notification is sent yet.';
  static const digestSaveFailed =
      'Not saved — check your connection and try again.';

  static const wearableLabel = 'I use a wearable';
  static const wearableSubtitle =
      'Records device ownership only. Scan requests provider access separately.';

  /// The read counterpart of [digestSaveFailed]. Without it a failed load left
  /// the tab on a spinner forever: the exception escaped `_load`, `_loading`
  /// was never cleared, and because the tab is kept alive in the shell's
  /// IndexedStack it could not recover even once the backend came back — only
  /// a full app restart cleared it.
  static const loadFailed =
      'Could not load your profile — check your connection and try again.';
  static const retry = 'Try again';

  /// Last-resort heading when the profile row carries no display name AND no
  /// account email. It must never be a name-shaped literal: this slot used to
  /// fall back to 'Biome', which rendered at 22pt as if the user had told us
  /// that was their name. An explicit empty state is the truthful option — the
  /// account email is preferred over it when one is known.
  static const noNameSet = 'No name set';

  static const all = <String>[
    backdropLabel,
    backdropSubtitle,
    digestLabel,
    digestSubtitle,
    digestSaveFailed,
    wearableLabel,
    wearableSubtitle,
    loadFailed,
    retry,
    noNameSet,
  ];
}

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  UserProfile? _profile;
  bool _digestEnabled = false;
  bool _loading = true;
  bool _loadFailed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Never let a failed read leave the tab on a spinner. Either read can throw
  /// — the digest RPC is a second round trip, and the app shell keeps this tab
  /// alive, so an uncaught failure here is permanent for the session. Clear
  /// `_loading` on every path and offer an explicit retry.
  Future<void> _load() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final service = ProfileService(client);
    // The digest preference lives in its own table behind an RPC, so it is a
    // second round trip; issue it alongside the profile read rather than after.
    try {
      final results = await Future.wait([
        service.getProfile(userId),
        service.getDailyDigestEnabled(),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = results[0] as UserProfile?;
        _digestEnabled = results[1] as bool;
        _loading = false;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadFailed = true;
      });
    }
  }

  Future<void> _retryLoad() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    await _load();
  }

  Future<void> _toggleWearableOwned(bool value) async {
    setState(() => _profile = _profile?.copyWith(wearableOwned: value));
    final client = Supabase.instance.client;
    await ProfileService(
      client,
    ).updateProfile(client.auth.currentUser!.id, {'wearable_owned': value});
  }

  /// Both preference rows write through [ProfileService] — the wearable toggle
  /// via `updateProfile` (a `profiles` column), the digest via
  /// `setDailyDigestEnabled` (an RPC over a separate table). Different storage,
  /// one service; neither row opens a second client of its own.
  Future<void> _writeDigestEnabled(bool value) async {
    final client = Supabase.instance.client;
    await ProfileService(client).setDailyDigestEnabled(value);
    if (mounted) _digestEnabled = value;
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Sign out?',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w600),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text('Sign out', style: GoogleFonts.manrope()),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await Supabase.instance.client.auth.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) =>
            SignInScreen(authService: AuthService(Supabase.instance.client)),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: OurobionColors.background,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_loadFailed) {
      return Scaffold(
        backgroundColor: OurobionColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  ProfileTabCopy.loadFailed,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: _retryLoad,
                  child: Text(ProfileTabCopy.retry),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final profile = _profile;

    // The heading must only ever show something the account actually told us:
    // the display name, else the account email, else an explicit empty state.
    // Never a name-shaped literal — a null/blank profile read used to render
    // 'Biome' here at 22pt, indistinguishable from a real name the user chose.
    final accountEmail = profile?.email;
    final displayName = profile?.displayName ?? '';
    final heading = displayName.isNotEmpty
        ? displayName
        : (accountEmail ?? ProfileTabCopy.noNameSet);

    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          // Mirrors the 390px reference's 22px side gutter while remaining a
          // normal responsive scroll surface on compact devices.
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ACCOUNT',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 9),
              Text(
                'Profile',
                style: GoogleFonts.manrope(
                  fontSize: 27,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.7,
                  color: OurobionColors.onSurface,
                ),
              ),

              const SizedBox(height: 22),
              _ProfileIdentityCard(
                heading: heading,
                city: profile?.city ?? '',
                region: profile?.region ?? '',
                email: accountEmail != heading ? accountEmail : null,
              ),

              const SizedBox(height: 20),
              Text(
                'PREFERENCES',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 10),
              _ToggleRow(
                label: ProfileTabCopy.wearableLabel,
                subtitle: ProfileTabCopy.wearableSubtitle,
                value: profile?.wearableOwned ?? false,
                onChanged: _toggleWearableOwned,
              ),

              const SizedBox(height: 9),
              ValueListenableBuilder<bool>(
                valueListenable: AppPreferences.backdropEnabled,
                builder: (context, enabled, child) => _ToggleRow(
                  label: ProfileTabCopy.backdropLabel,
                  subtitle: ProfileTabCopy.backdropSubtitle,
                  value: enabled,
                  onChanged: AppPreferences.setBackdropEnabled,
                ),
              ),
              const SizedBox(height: 9),
              DailyDigestToggle(
                // Keyed on the loaded value so a reload re-seeds the switch
                // instead of leaving stale local state on screen.
                key: ValueKey(_digestEnabled),
                initialValue: _digestEnabled,
                onWrite: _writeDigestEnabled,
              ),

              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _signOut,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                    side: BorderSide(
                      color: Theme.of(
                        context,
                      ).colorScheme.error.withValues(alpha: 0.4),
                    ),
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(kButtonRadius),
                    ),
                  ),
                  child: const Text('Sign out'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The account identity is deliberately a wide, decorative card rather than a
/// generic avatar stack. It matches the reference composition while preserving
/// the profile values already loaded by [ProfileTab]: a real name/email and a
/// real city/region when either is available. The camellia is ornamental only;
/// it does not communicate an account state or introduce a new preference.
class _ProfileIdentityCard extends StatelessWidget {
  final String heading;
  final String city;
  final String region;
  final String? email;

  const _ProfileIdentityCard({
    required this.heading,
    required this.city,
    required this.region,
    required this.email,
  });

  @override
  Widget build(BuildContext context) {
    final location = [city, region].where((part) => part.isNotEmpty).join(', ');
    final detail = location.isNotEmpty ? location : email;

    return Container(
      height: 102,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [OurobionColors.surfaceLowest, Color(0xFFFAF6EC)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: OurobionColors.primary.withValues(alpha: 0.45),
        ),
        boxShadow: [
          BoxShadow(
            color: OurobionColors.primary.withValues(alpha: 0.14),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -24,
            bottom: -30,
            width: 140,
            height: 140,
            child: Opacity(
              opacity: 0.6,
              child: Image.asset(
                BiotopeGeneratedAssets.profilePorcelainCamellia,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stack) => const SizedBox(),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  width: 62,
                  height: 62,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: OurobionColors.surfaceLowest,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: OurobionColors.primary.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Image.asset(
                    BiotopeGeneratedAssets.profileBotanicalCrest,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stack) => const Icon(
                      Icons.person_outline_rounded,
                      size: 28,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        heading,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.manrope(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          color: OurobionColors.onSurface,
                        ),
                      ),
                      if (detail != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          detail,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.manrope(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: OurobionColors.outline,
                          ),
                        ),
                      ],
                      if (location.isNotEmpty && email != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          email!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.manrope(
                            fontSize: 10,
                            color: OurobionColors.outline,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The account-level daily-digest preference, persisted via the caller's
/// [onWrite] — which [ProfileTab] points at
/// `ProfileService.setDailyDigestEnabled`, an RPC over
/// `public.profile_notification_prefs` (profile_service.dart). It is NOT a
/// `profiles` column and does NOT go through `updateProfile`: R4-U2's
/// non-regression suite pins the `profiles` column-privilege map, so the
/// preference lives in its own table behind an RPC instead (see the header of
/// migration 20260728040001_profile_daily_digest.sql and the note on
/// [UserProfile]). The wearable toggle beside it is the one that writes a
/// `profiles` column.
///
/// Split out of [ProfileTab] so the FAILURE behaviour is testable without a
/// live Supabase, because that is the part worth pinning: the switch moves
/// optimistically, and if the write throws it moves BACK and says so. It must
/// never sit in the "on" position while the column still reads false.
class DailyDigestToggle extends StatefulWidget {
  final bool initialValue;
  final Future<void> Function(bool value) onWrite;

  const DailyDigestToggle({
    super.key,
    required this.initialValue,
    required this.onWrite,
  });

  @override
  State<DailyDigestToggle> createState() => _DailyDigestToggleState();
}

class _DailyDigestToggleState extends State<DailyDigestToggle> {
  late bool _value = widget.initialValue;
  bool _saving = false;
  bool _failed = false;

  Future<void> _set(bool next) async {
    if (_saving) return;
    final previous = _value;
    setState(() {
      _value = next;
      _saving = true;
      _failed = false;
    });
    try {
      await widget.onWrite(next);
      if (!mounted) return;
      setState(() => _saving = false);
    } catch (_) {
      // Offline, RLS rejection, anything: the column did not change, so the
      // switch must not pretend it did.
      if (!mounted) return;
      setState(() {
        _value = previous;
        _saving = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ToggleRow(
      label: ProfileTabCopy.digestLabel,
      subtitle: _failed
          ? ProfileTabCopy.digestSaveFailed
          : ProfileTabCopy.digestSubtitle,
      subtitleIsError: _failed,
      value: _value,
      onChanged: _set,
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool subtitleIsError;
  const _ToggleRow({
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.subtitleIsError = false,
  });

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      radius: 14,
      onTap: () => onChanged(!value),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    color: subtitleIsError
                        ? Theme.of(context).colorScheme.error
                        : OurobionColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: Colors.white,
            activeTrackColor: OurobionColors.primary,
          ),
        ],
      ),
    );
  }
}
