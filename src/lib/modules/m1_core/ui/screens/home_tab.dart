import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../impl/auth_service.dart';
import '../../impl/profile_service.dart';
import '../../../m6_engagement/index.dart';
import 'sign_in_screen.dart';

class HomeTab extends StatefulWidget {
  final VoidCallback onLogTodayTap;
  const HomeTab({super.key, required this.onLogTodayTap});

  @override
  State<HomeTab> createState() => HomeTabState();
}

class HomeTabState extends State<HomeTab> with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;

  String _displayName = '';
  double? _todayDqs;
  EngagementState _engagement = EngagementState.zero;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _opacity = CurvedAnimation(parent: _anim, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _anim, curve: Curves.easeOut));
    _load();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  Future<void> _load({bool animate = true}) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final today = _dateStr(DateTime.now());

    final profile = await ProfileService(client).getProfile(userId);

    final todayRowFuture = client
        .from('daily_gut_rows')
        .select('log_completeness')
        .eq('user_id', userId)
        .eq('log_date', today)
        .maybeSingle();

    final engagementFuture =
        EngagementService(client).getEngagementState(userId);

    final todayRow = await todayRowFuture;
    final engagement = await engagementFuture;

    if (!mounted) return;
    setState(() {
      _displayName = profile?.displayName ?? '';
      _todayDqs = todayRow != null
          ? (todayRow['log_completeness'] as num?)?.toDouble()
          : null;
      _engagement = engagement ?? EngagementState.zero;
      _loading = false;
    });
    if (animate) _anim.forward();
  }

  Future<void> reload() => _load(animate: false);

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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
        backgroundColor: BiotopeColors.surface,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      backgroundColor: BiotopeColors.surface,
      body: SafeArea(
        child: FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _slide,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 24),

                  // ── Header ────────────────────────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _greeting.toUpperCase(),
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.6,
                                color: BiotopeColors.primary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _displayName.isNotEmpty ? _displayName : 'Biome',
                              style: GoogleFonts.manrope(
                                fontSize: 28,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.4,
                                color: BiotopeColors.onSurface,
                              ),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: _signOut,
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: BiotopeColors.surfaceLowest,
                            border: Border.all(color: BiotopeColors.outlineVariant),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.person_outline_rounded,
                            size: 20,
                            color: BiotopeColors.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 28),

                  // ── Today's log ───────────────────────────────────
                  _Eyebrow('TODAY'),
                  const SizedBox(height: 10),
                  _TodayCard(dqs: _todayDqs, onTap: widget.onLogTodayTap),

                  const SizedBox(height: 20),

                  // ── Streak ────────────────────────────────────────
                  _Eyebrow('YOUR STREAK'),
                  const SizedBox(height: 10),
                  _StreakCard(streak: _engagement.currentStreakDays),

                  const SizedBox(height: 20),

                  // ── Titles ────────────────────────────────────────
                  if (_engagement.totalLogs > 0) ...[
                    const SizedBox(height: 20),
                    _Eyebrow('TITLES'),
                    const SizedBox(height: 10),
                    _TitlesRow(
                      unlockedTitles: _engagement.unlockedTitles,
                    ),
                  ],

                  // ── Insights teaser ───────────────────────────────
                  const SizedBox(height: 20),
                  _Eyebrow('INSIGHTS'),
                  const SizedBox(height: 10),
                  _InsightsTeaser(streak: _engagement.currentStreakDays),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

class _Eyebrow extends StatelessWidget {
  final String label;
  const _Eyebrow(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: BiotopeColors.primary,
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  final double? dqs;
  final VoidCallback onTap;
  const _TodayCard({required this.dqs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final logged = dqs != null;
    final streakWorthy = (dqs ?? 0) >= 60;

    return GestureDetector(
      onTap: streakWorthy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: BiotopeColors.surfaceLowest,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: streakWorthy
                ? BiotopeColors.primaryContainer
                : BiotopeColors.outlineVariant,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A191c1c),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: logged
            ? Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: streakWorthy
                          ? BiotopeColors.primaryFixed
                          : BiotopeColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      streakWorthy
                          ? Icons.check_circle_rounded
                          : Icons.edit_note_rounded,
                      color: streakWorthy
                          ? BiotopeColors.primary
                          : BiotopeColors.outline,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          streakWorthy ? 'Streak-worthy log ✓' : 'Partially logged',
                          style: GoogleFonts.manrope(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: BiotopeColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          streakWorthy
                              ? '${dqs!.toInt()} pts — great work today'
                              : '${dqs!.toInt()} / 100 pts — log more to reach 60',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            color: BiotopeColors.outline,
                          ),
                        ),
                        if (!streakWorthy) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Complete →',
                            style: GoogleFonts.manrope(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: BiotopeColors.primary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              )
            : Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: BiotopeColors.primaryFixed,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.edit_note_rounded,
                      color: BiotopeColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "You haven't logged today",
                          style: GoogleFonts.manrope(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: BiotopeColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Takes under 30 seconds',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            color: BiotopeColors.outline,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'Log now →',
                    style: GoogleFonts.manrope(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: BiotopeColors.primary,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _StreakCard extends StatelessWidget {
  final int streak;
  const _StreakCard({required this.streak});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: BiotopeColors.surfaceLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BiotopeColors.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A191c1c),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: streak > 0
                  ? BiotopeColors.primaryFixed
                  : BiotopeColors.surfaceContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.local_fire_department_rounded,
              color: streak > 0 ? BiotopeColors.primary : BiotopeColors.outline,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                streak > 0 ? '$streak day${streak == 1 ? '' : 's'}' : 'No streak yet',
                style: GoogleFonts.manrope(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                  color: streak > 0
                      ? BiotopeColors.onSurface
                      : BiotopeColors.outline,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                streak > 0
                    ? 'consecutive streak-worthy days'
                    : 'Log 60+ pts to start your streak',
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  color: BiotopeColors.outline,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TitlesRow extends StatelessWidget {
  final List<String> unlockedTitles;
  const _TitlesRow({required this.unlockedTitles});

  @override
  Widget build(BuildContext context) {
    final chips = kTitleRegistry
        .map((t) => _TitleChip(
              label: t.label,
              subtitle: t.subtitle,
              icon: t.icon,
              earned: unlockedTitles.contains(t.id),
            ))
        .toList();

    return Column(
      children: [
        for (int i = 0; i < chips.length; i += 2)
          Padding(
            padding: EdgeInsets.only(bottom: i + 2 < chips.length ? 10 : 0),
            child: Row(
              children: [
                Expanded(child: chips[i]),
                const SizedBox(width: 10),
                if (i + 1 < chips.length)
                  Expanded(child: chips[i + 1])
                else
                  const Expanded(child: SizedBox()),
              ],
            ),
          ),
      ],
    );
  }
}

class _TitleChip extends StatelessWidget {
  final String label;
  final String subtitle;
  final IconData icon;
  final bool earned;
  const _TitleChip({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.earned,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: earned
            ? BiotopeColors.primaryFixed
            : BiotopeColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: earned
              ? BiotopeColors.primaryContainer
              : BiotopeColors.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: earned ? BiotopeColors.primary : BiotopeColors.outlineVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: earned
                        ? BiotopeColors.primary
                        : BiotopeColors.outlineVariant,
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    color: earned
                        ? BiotopeColors.onSurfaceVariant
                        : BiotopeColors.outlineVariant,
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

class _InsightsTeaser extends StatelessWidget {
  final int streak;
  const _InsightsTeaser({required this.streak});

  @override
  Widget build(BuildContext context) {
    const kGoal = 7;
    final progress = (streak / kGoal).clamp(0.0, 1.0);
    final unlocked = streak >= kGoal;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: BiotopeColors.surfaceLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BiotopeColors.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A191c1c),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: unlocked
                      ? BiotopeColors.primaryFixed
                      : BiotopeColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  unlocked
                      ? Icons.lightbulb_rounded
                      : Icons.lock_outline_rounded,
                  color: unlocked
                      ? BiotopeColors.primary
                      : BiotopeColors.outline,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      unlocked ? 'Insights available' : 'Insights locked',
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: BiotopeColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      unlocked
                          ? 'Check the Insights tab'
                          : '$streak / $kGoal streak-worthy days',
                      style: GoogleFonts.manrope(
                        fontSize: 12,
                        color: BiotopeColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!unlocked) ...[
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress),
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOut,
                builder: (context, value, child) => LinearProgressIndicator(
                  value: value,
                  minHeight: 5,
                  backgroundColor: BiotopeColors.surfaceContainer,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    BiotopeColors.secondary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
