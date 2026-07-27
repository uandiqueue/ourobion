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

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  UserProfile? _profile;
  bool _loading = true;
  bool _digestEnabled = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final profile = await ProfileService(client).getProfile(userId);
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  Future<void> _toggleWearableOwned(bool value) async {
    setState(() => _profile = _profile == null
        ? null
        : UserProfile(
            userId: _profile!.userId,
            displayName: _profile!.displayName,
            region: _profile!.region,
            city: _profile!.city,
            email: _profile!.email,
            wearableOwned: value,
            createdAt: _profile!.createdAt,
            updatedAt: DateTime.now(),
          ));
    final client = Supabase.instance.client;
    await ProfileService(client)
        .updateProfile(client.auth.currentUser!.id, {'wearable_owned': value});
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
        builder: (_) => SignInScreen(
          authService: AuthService(Supabase.instance.client),
        ),
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
    final profile = _profile;

    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PROFILE',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 20),

              Center(
                child: Column(
                  children: [
                    Container(
                      width: 84,
                      height: 84,
                      decoration: BoxDecoration(
                        color: OurobionColors.surfaceLowest,
                        shape: BoxShape.circle,
                        border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.5)),
                        boxShadow: [
                          BoxShadow(
                            color: OurobionColors.primary.withValues(alpha: 0.2),
                            blurRadius: 28,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          BiotopeGeneratedAssets.profileBotanicalCrest,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) => const Icon(
                            Icons.person_outline_rounded,
                            size: 32,
                            color: OurobionColors.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      profile?.displayName.isNotEmpty == true ? profile!.displayName : 'Biome',
                      style: GoogleFonts.manrope(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                    if (profile != null && (profile.city.isNotEmpty || profile.region.isNotEmpty)) ...[
                      const SizedBox(height: 4),
                      Text(
                        [profile.city, profile.region].where((s) => s.isNotEmpty).join(', '),
                        style: GoogleFonts.manrope(
                          fontSize: 13,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (profile?.email != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        profile!.email!,
                        style: GoogleFonts.manrope(
                          fontSize: 12,
                          color: OurobionColors.outline,
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 28),
              Text(
                'DEVICES',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 10),
              _ToggleRow(
                label: 'Wearable connected',
                subtitle: 'Enables wearable syncing on the Scan tab',
                value: profile?.wearableOwned ?? false,
                onChanged: _toggleWearableOwned,
              ),

              const SizedBox(height: 20),
              Text(
                'APPEARANCE',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 10),
              ValueListenableBuilder<bool>(
                valueListenable: AppPreferences.backdropEnabled,
                builder: (context, enabled, child) => _ToggleRow(
                  label: 'Living backdrop',
                  subtitle: 'Drifting color orbs on sign-in and load screens',
                  value: enabled,
                  onChanged: (v) => AppPreferences.backdropEnabled.value = v,
                ),
              ),
              const SizedBox(height: 9),
              _ToggleRow(
                label: 'Daily digest',
                subtitle: 'Not yet connected — preference only',
                value: _digestEnabled,
                onChanged: (v) => setState(() => _digestEnabled = v),
              ),

              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _signOut,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                    side: BorderSide(color: Theme.of(context).colorScheme.error.withValues(alpha: 0.4)),
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kButtonRadius)),
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

class _ToggleRow extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _ToggleRow({
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
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
                    color: OurobionColors.onSurfaceVariant,
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
