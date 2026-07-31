import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../impl/antibiotic_service.dart';
import '../../impl/behaviour/mosquito_logging.dart';
import '../../impl/logging_controller.dart';
import '../../impl/normaliser.dart';
import '../../../m3_passive_health/index.dart';
import '../../../m6_engagement/index.dart';
import 'antibiotic_course_screen.dart';
import 'symptom_flags_screen.dart';
import 'urine_color_screen.dart';
import 'stool_form_screen.dart';
import '../widgets/likert_check_in_card.dart';

// Urine swatch colors — mirrors urine_color_screen.dart
const _kUrineColors = [
  Color(0xFFF5F0B8),
  Color(0xFFEEE060),
  Color(0xFFE8CE25),
  Color(0xFFD4A018),
  Color(0xFFC07818),
  Color(0xFFA05010),
  Color(0xFF7E3210),
  Color(0xFF501808),
];

const _kUrineLabels = [
  'Very pale', 'Pale yellow', 'Yellow', 'Dark yellow',
  'Amber', 'Dark amber', 'Orange-brown', 'Dark brown',
];

const _kStoolLabels = [
  'Separate lumps', 'Lumpy sausage', 'Cracked sausage', 'Smooth sausage',
  'Soft blobs', 'Fluffy pieces', 'Watery',
];

const _kDayNames = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];
const _kMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

class DailyLogScreen extends StatefulWidget {
  const DailyLogScreen({super.key});

  @override
  State<DailyLogScreen> createState() => _DailyLogScreenState();
}

class _DailyLogScreenState extends State<DailyLogScreen> {
  // ── Field state ────────────────────────────────────────────────
  int? _urineColour;
  int? _stoolForm;
  int? _stoolCount;
  int? _outsideMeals;
  int? _mosquitoBites;
  int? _energy;
  int? _mood;
  int? _gutComfort;
  int? _appetite;
  int? _anxiety;
  int? _brainClarity;
  int? _focus;
  int? _socialInteractionQuality;
  List<String> _symptomFlags = [];
  final _notesCtrl = TextEditingController();
  bool _isSaving = false;
  bool _isInitialLoading = true;
  AntibioticCourse? _activeCourse;
  bool? _standingWaterPresent;
  bool _standingWaterPromptDue = false;

  // ── DQS (Data Quality Score) ───────────────────────────────────
  // Pure logic lives in impl/normaliser.dart; weights are sourced from the
  // metrics registry (shared/metrics/registry.ts). See kDailyCoreDqsWeights.
  int get _dqs => computeDqs({
        'urine_colour': _urineColour,
        'stool_form': _stoolForm,
        'outside_meals': _outsideMeals,
        'mosquito_bites': _mosquitoBites,
        'energy_score': _energy,
        'mood_score': _mood,
        'gut_comfort_score': _gutComfort,
      });

  bool get _hasWellbeingCheckIn => hasWellbeingCheckInValues(
        appetite: _appetite,
        anxiety: _anxiety,
        brainClarity: _brainClarity,
        focus: _focus,
        socialInteractionQuality: _socialInteractionQuality,
      );

  bool get _canSave =>
      canSaveDailyLog(dqs: _dqs, hasWellbeingCheckIn: _hasWellbeingCheckIn);

  String get _saveCtaLabel => _dqs > 0
      ? 'Save log · $_dqs pts →'
      : _hasWellbeingCheckIn
          ? 'Save optional check-in →'
          : 'Save log →';

  Color get _dqsColor {
    final pts = _dqs;
    if (pts >= 60) return OurobionColors.primary;
    if (pts >= 40) return const Color(0xFFD4A018);
    return OurobionColors.outline;
  }

  // ── Helpers ────────────────────────────────────────────────────
  String get _todayLabel {
    final now = DateTime.now();
    return '${_kDayNames[now.weekday - 1]}, ${now.day} ${_kMonthNames[now.month - 1]}';
  }

  String get _logDate {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    _loadTodayData();
  }

  Future<void> _loadTodayData() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final date = _logDate;

    final rowFuture = DailyLogService(client).getTodayLog(userId, date);
    final courseFuture = AntibioticService(client).getActiveCourse(userId);
    final lastStandingWaterFuture =
        StandingWaterService(client).getLastAnsweredDate(userId);
    WearableService(client).syncToday(userId).ignore();
    final row = await rowFuture;
    final course = await courseFuture;
    final lastStandingWaterCheck = await lastStandingWaterFuture;

    if (!mounted) return;
    setState(() {
      _isInitialLoading = false;
      _activeCourse = course;
      _standingWaterPromptDue =
          isStandingWaterPromptDue(lastStandingWaterCheck, DateTime.now());
      if (row != null) {
        _urineColour = row['urine_colour'] as int?;
        _stoolForm   = row['stool_form'] as int?;
        _stoolCount  = row['stool_count'] as int?;
        _outsideMeals  = row['outside_meals'] as int?;
        _mosquitoBites = row['mosquito_bites'] as int?;
        _energy     = row['energy_score'] as int?;
        _mood       = row['mood_score'] as int?;
        _gutComfort = row['gut_comfort_score'] as int?;
        _appetite = row['appetite_score'] as int?;
        _anxiety = row['anxiety_score'] as int?;
        _brainClarity = row['brain_clarity_score'] as int?;
        _focus = row['focus_score'] as int?;
        _socialInteractionQuality =
            row['social_interaction_quality_score'] as int?;
        _symptomFlags = (row['symptom_flags'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList() ?? [];
        _notesCtrl.text = row['notes'] as String? ?? '';
        _standingWaterPresent = row['standing_water_present'] as bool?;
      }
    });
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  // ── Navigation ─────────────────────────────────────────────────
  Future<void> _openUrine() async {
    final result = await Navigator.of(context).push<int?>(
      MaterialPageRoute(builder: (_) => UrineColorScreen(initialValue: _urineColour)),
    );
    if (result != null) setState(() => _urineColour = result);
  }

  Future<void> _openStool() async {
    final result = await Navigator.of(context).push<int?>(
      MaterialPageRoute(builder: (_) => StoolFormScreen(initialValue: _stoolForm)),
    );
    if (result != null) setState(() => _stoolForm = result);
  }

  Future<void> _openSymptomFlags() async {
    final result = await Navigator.of(context).push<List<String>?>(
      MaterialPageRoute(
        builder: (_) => SymptomFlagsScreen(initialFlags: _symptomFlags),
      ),
    );
    if (result != null) setState(() => _symptomFlags = result);
  }

  Future<void> _openAntibiotics() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const AntibioticCourseScreen()),
    );
    if (!mounted) return;
    final client = Supabase.instance.client;
    final course = await AntibioticService(client)
        .getActiveCourse(client.auth.currentUser!.id);
    if (!mounted) return;
    setState(() => _activeCourse = course);
  }

  // ── Save ───────────────────────────────────────────────────────
  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;
      await DailyLogService(client).saveDailyLog(
        userId,
        _logDate,
        DailyLogInput(
          urineColour: _urineColour,
          stoolForm: _stoolForm,
          stoolCount: _stoolCount,
          outsideMeals: _outsideMeals,
          mosquitoBites: _mosquitoBites,
          energy: _energy,
          mood: _mood,
          gutComfort: _gutComfort,
          appetite: _appetite,
          anxiety: _anxiety,
          brainClarity: _brainClarity,
          focus: _focus,
          socialInteractionQuality: _socialInteractionQuality,
          symptomFlags: _symptomFlags,
          notes: _notesCtrl.text,
          standingWaterPresent: _standingWaterPresent,
          logCompleteness: _dqs.toDouble(),
        ),
      );
      await EngagementService(client).updateOnLogWrite(userId, _logDate, _dqs.toDouble());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _dqs > 0 ? 'Log saved — $_dqs pts' : 'Optional check-in saved',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w600, color: Colors.white),
          ),
          backgroundColor: OurobionColors.primary,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Save failed: $e', style: GoogleFonts.manrope()),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),

            // ── Header ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DAILY LOG',
                          style: GoogleFonts.manrope(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            letterSpacing: 1.6, color: OurobionColors.primary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _todayLabel,
                          style: GoogleFonts.manrope(
                            fontSize: 20, fontWeight: FontWeight.w600,
                            letterSpacing: -0.2, color: OurobionColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _DqsBadge(pts: _dqs, color: _dqsColor),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // ── Progress bar ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: _ProgressCard(pts: _dqs, color: _dqsColor),
            ),

            // ── Scrollable body ───────────────────────────────────
            Expanded(
              child: _isInitialLoading
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [

                    // ── GUT SIGNALS ──────────────────────────────
                    const _SectionLabel('GUT SIGNALS'),

                    _NavigatorCard(
                      icon: Icons.water_drop_outlined,
                      label: 'Urine colour',
                      valueWidget: _urineColour != null
                          ? Row(children: [
                              Container(
                                width: 14,
                                height: 14,
                                decoration: BoxDecoration(
                                  color: _kUrineColors[_urineColour! - 1],
                                  borderRadius: BorderRadius.circular(3),
                                  border: Border.all(color: OurobionColors.outlineVariant),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _kUrineLabels[_urineColour! - 1],
                                style: GoogleFonts.manrope(
                                  fontSize: 12, fontWeight: FontWeight.w600,
                                  color: OurobionColors.onSurface,
                                ),
                              ),
                            ])
                          : null,
                      onTap: _openUrine,
                    ),

                    _NavigatorCard(
                      icon: Icons.bar_chart_rounded,
                      label: 'Stool form',
                      valueWidget: _stoolForm != null
                          ? Text(
                              'Type $_stoolForm — ${_kStoolLabels[_stoolForm! - 1]}',
                              style: GoogleFonts.manrope(
                                fontSize: 12, fontWeight: FontWeight.w600,
                                color: OurobionColors.onSurface,
                              ),
                            )
                          : null,
                      onTap: _openStool,
                    ),

                    _StepperCard(
                      icon: Icons.format_list_numbered_rounded,
                      label: 'Stool count',
                      value: _stoolCount,
                      max: 10,
                      onChanged: (v) => setState(() => _stoolCount = v),
                    ),

                    // ── BEHAVIOUR ────────────────────────────────
                    const _SectionLabel('BEHAVIOUR'),

                    _SegmentCard(
                      icon: Icons.restaurant_rounded,
                      label: 'Outside meals',
                      options: const [0, 1, 2, 3],
                      value: _outsideMeals,
                      onChanged: (v) => setState(
                        () => _outsideMeals = _outsideMeals == v ? null : v,
                      ),
                    ),

                    _StepperCard(
                      icon: Icons.pest_control_rounded,
                      label: 'Mosquito bites',
                      value: _mosquitoBites,
                      max: 20,
                      onChanged: (v) => setState(() => _mosquitoBites = v),
                    ),

                    if (_standingWaterPromptDue)
                      _YesNoCard(
                        icon: Icons.water_outlined,
                        label: 'Standing water nearby',
                        sublabel: 'Weekly check — buckets, trays, blocked drains',
                        value: _standingWaterPresent,
                        onChanged: (v) => setState(() => _standingWaterPresent = v),
                      ),

                    _NavigatorCard(
                      icon: Icons.warning_amber_rounded,
                      label: 'Symptom signals',
                      valueWidget: _symptomFlags.isNotEmpty
                          ? Text(
                              '${_symptomFlags.length} signal${_symptomFlags.length == 1 ? '' : 's'} noted',
                              style: GoogleFonts.manrope(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: OurobionColors.onSurface,
                              ),
                            )
                          : null,
                      onTap: _openSymptomFlags,
                    ),

                    // ── DAILY CHECK-IN ────────────────────────────
                    const _SectionLabel('DAILY CHECK-IN'),

                    _LikertCard(
                      icon: Icons.bolt_rounded,
                      label: 'Energy',
                      lowLabel: 'Drained',
                      highLabel: 'Energised',
                      value: _energy,
                      onChanged: (v) => setState(
                        () => _energy = _energy == v ? null : v,
                      ),
                    ),

                    _LikertCard(
                      icon: Icons.sentiment_satisfied_alt_outlined,
                      label: 'Mood',
                      lowLabel: 'Low',
                      highLabel: 'Great',
                      value: _mood,
                      onChanged: (v) => setState(
                        () => _mood = _mood == v ? null : v,
                      ),
                    ),

                    _LikertCard(
                      icon: Icons.favorite_border_rounded,
                      label: 'Gut comfort',
                      lowLabel: 'Uncomfortable',
                      highLabel: 'Comfortable',
                      value: _gutComfort,
                      onChanged: (v) => setState(
                        () => _gutComfort = _gutComfort == v ? null : v,
                      ),
                    ),

                    const _SectionLabel('WELLBEING CHECK-IN (OPTIONAL)'),
                    LikertCheckInCard(
                      icon: Icons.restaurant_outlined,
                      label: 'Appetite',
                      lowLabel: 'Less appetite',
                      highLabel: 'More appetite',
                      value: _appetite,
                      onChanged: (v) => setState(
                        () => _appetite = _appetite == v ? null : v,
                      ),
                    ),
                    LikertCheckInCard(
                      icon: Icons.self_improvement_outlined,
                      label: 'Feeling anxious',
                      lowLabel: 'Not at all',
                      highLabel: 'Very',
                      value: _anxiety,
                      onChanged: (v) => setState(
                        () => _anxiety = _anxiety == v ? null : v,
                      ),
                    ),
                    LikertCheckInCard(
                      icon: Icons.visibility_outlined,
                      label: 'Mental clarity',
                      lowLabel: 'Foggy',
                      highLabel: 'Clear',
                      value: _brainClarity,
                      onChanged: (v) => setState(
                        () => _brainClarity = _brainClarity == v ? null : v,
                      ),
                    ),
                    LikertCheckInCard(
                      icon: Icons.center_focus_strong_outlined,
                      label: 'Focus',
                      lowLabel: 'Hard to focus',
                      highLabel: 'Easy to focus',
                      value: _focus,
                      onChanged: (v) => setState(
                        () => _focus = _focus == v ? null : v,
                      ),
                    ),
                    LikertCheckInCard(
                      icon: Icons.people_outline_rounded,
                      label: 'Social interaction quality',
                      lowLabel: 'Unsatisfying',
                      highLabel: 'Satisfying',
                      value: _socialInteractionQuality,
                      onChanged: (v) => setState(
                        () => _socialInteractionQuality =
                            _socialInteractionQuality == v ? null : v,
                      ),
                    ),

                    // ── NOTES ────────────────────────────────────
                    const _SectionLabel('NOTES'),
                    _NotesCard(controller: _notesCtrl),

                    // ── MEDICATIONS ──────────────────────────────
                    const _SectionLabel('MEDICATIONS'),
                    if (_activeCourse != null)
                      _ActiveCourseCard(course: _activeCourse!),
                    _NavigatorCard(
                      icon: Icons.medication_rounded,
                      label: 'Antibiotic course',
                      onTap: _openAntibiotics,
                    ),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // ── Save CTA ─────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
              child: FilledButton(
                onPressed: _canSave && !_isSaving ? _save : null,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_saveCtaLabel),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

class _DqsBadge extends StatelessWidget {
  final int pts;
  final Color color;
  const _DqsBadge({required this.pts, required this.color});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        '$pts pts',
        style: GoogleFonts.manrope(
          fontSize: 12, fontWeight: FontWeight.w700, color: color,
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  final int pts;
  final Color color;
  const _ProgressCard({required this.pts, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: OurobionColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'LOG COMPLETENESS',
                style: GoogleFonts.manrope(
                  fontSize: 10, fontWeight: FontWeight.w700,
                  letterSpacing: 1.4, color: OurobionColors.onSurfaceVariant,
                ),
              ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Text(
                  pts >= 60 ? 'Streak-worthy ✓' : '$pts / 100',
                  key: ValueKey(pts >= 60),
                  style: GoogleFonts.manrope(
                    fontSize: 11, fontWeight: FontWeight.w700, color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: pts / 100),
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOut,
              builder: (_, value, child) => LinearProgressIndicator(
                value: value,
                minHeight: 6,
                backgroundColor: OurobionColors.surfaceContainer,
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
      child: Text(
        label,
        style: GoogleFonts.manrope(
          fontSize: 10, fontWeight: FontWeight.w700,
          letterSpacing: 1.6, color: OurobionColors.primary,
        ),
      ),
    );
  }
}

class _NavigatorCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget? valueWidget;
  final VoidCallback onTap;

  const _NavigatorCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.valueWidget,
  });

  @override
  Widget build(BuildContext context) {
    final logged = valueWidget != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: OurobionColors.surfaceLowest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: logged ? OurobionColors.primaryContainer : OurobionColors.outlineVariant,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18,
                color: logged ? OurobionColors.primary : OurobionColors.outline),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: OurobionColors.onSurface,
                    ),
                  ),
                  if (logged) ...[
                    const SizedBox(height: 3),
                    valueWidget!,
                  ] else ...[
                    const SizedBox(height: 2),
                    Text(
                      'Tap to log',
                      style: GoogleFonts.manrope(
                        fontSize: 11, color: OurobionColors.outline,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              logged ? Icons.check_circle_rounded : Icons.chevron_right_rounded,
              size: 20,
              color: logged ? OurobionColors.primary : OurobionColors.outlineVariant,
            ),
          ],
        ),
      ),
    );
  }
}

class _StepperCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final int? value;
  final int max;
  final ValueChanged<int?> onChanged;

  const _StepperCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.max,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final logged = value != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: logged ? OurobionColors.primaryContainer : OurobionColors.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18,
              color: logged ? OurobionColors.primary : OurobionColors.outline),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 13, fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          ),
          // −
          _StepBtn(
            icon: Icons.remove_rounded,
            onTap: logged
                ? (value! > 0
                    ? () => onChanged(value! - 1)
                    : () => onChanged(null))
                : null,
          ),
          SizedBox(
            width: 40,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 150),
              child: Text(
                logged ? '$value' : '—',
                key: ValueKey(value),
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(
                  fontSize: 16, fontWeight: FontWeight.w700,
                  color: logged
                      ? OurobionColors.onSurface
                      : OurobionColors.outlineVariant,
                ),
              ),
            ),
          ),
          // +
          _StepBtn(
            icon: Icons.add_rounded,
            onTap: !logged
                ? () => onChanged(1)
                : (value! < max ? () => onChanged(value! + 1) : null),
          ),
        ],
      ),
    );
  }
}

class _StepBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _StepBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: enabled
              ? OurobionColors.surfaceContainer
              : OurobionColors.surfaceLow,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled
              ? OurobionColors.onSurface
              : OurobionColors.outlineVariant,
        ),
      ),
    );
  }
}

class _SegmentCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final List<int> options;
  final int? value;
  final ValueChanged<int> onChanged;

  const _SegmentCard({
    required this.icon,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final logged = value != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: logged ? OurobionColors.primaryContainer : OurobionColors.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18,
                color: logged ? OurobionColors.primary : OurobionColors.outline),
            const SizedBox(width: 12),
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 13, fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Row(
            children: List.generate(options.length, (i) {
              final opt = options[i];
              final isSelected = value == opt;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(opt),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: EdgeInsets.only(
                      right: i < options.length - 1 ? 6 : 0,
                    ),
                    height: 36,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? OurobionColors.primary
                          : OurobionColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '$opt',
                        style: GoogleFonts.manrope(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: isSelected
                              ? OurobionColors.onPrimary
                              : OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _YesNoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;
  final bool? value;
  final ValueChanged<bool> onChanged;

  const _YesNoCard({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final logged = value != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: logged ? OurobionColors.primaryContainer : OurobionColors.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18,
                color: logged ? OurobionColors.primary : OurobionColors.outline),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: OurobionColors.onSurface,
                    ),
                  ),
                  Text(
                    sublabel,
                    style: GoogleFonts.manrope(
                      fontSize: 11, color: OurobionColors.outline,
                    ),
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(false),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 6),
                    height: 36,
                    decoration: BoxDecoration(
                      color: value == false
                          ? OurobionColors.primary
                          : OurobionColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        'No',
                        style: GoogleFonts.manrope(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: value == false
                              ? OurobionColors.onPrimary
                              : OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(true),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    height: 36,
                    decoration: BoxDecoration(
                      color: value == true
                          ? OurobionColors.primary
                          : OurobionColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        'Yes',
                        style: GoogleFonts.manrope(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: value == true
                              ? OurobionColors.onPrimary
                              : OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LikertCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String lowLabel;
  final String highLabel;
  final int? value;
  final ValueChanged<int> onChanged;

  const _LikertCard({
    required this.icon,
    required this.label,
    required this.lowLabel,
    required this.highLabel,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final logged = value != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: logged ? OurobionColors.primaryContainer : OurobionColors.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18,
                color: logged ? OurobionColors.primary : OurobionColors.outline),
            const SizedBox(width: 12),
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 13, fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Row(
            children: List.generate(5, (i) {
              final val = i + 1;
              final isSelected = value == val;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(val),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: EdgeInsets.only(right: i < 4 ? 6 : 0),
                    height: 36,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? OurobionColors.primary
                          : OurobionColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '$val',
                        style: GoogleFonts.manrope(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: isSelected
                              ? OurobionColors.onPrimary
                              : OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(lowLabel, style: GoogleFonts.manrope(
                fontSize: 10, color: OurobionColors.outline,
              )),
              Text(highLabel, style: GoogleFonts.manrope(
                fontSize: 10, color: OurobionColors.outline,
              )),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActiveCourseCard extends StatelessWidget {
  final AntibioticCourse course;
  const _ActiveCourseCard({required this.course});

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);
    final daysLeft = course.endDate.difference(todayDate).inDays + 1;
    final dayOf = course.durationDays - daysLeft + 1;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: OurobionColors.primaryContainer.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: OurobionColors.primaryContainer),
      ),
      child: Row(
        children: [
          const Icon(Icons.medication_rounded, size: 18, color: OurobionColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course.drugName,
                  style: GoogleFonts.manrope(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Day $dayOf of ${course.durationDays} · $daysLeft day${daysLeft == 1 ? '' : 's'} remaining',
                  style: GoogleFonts.manrope(
                    fontSize: 11, color: OurobionColors.primary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: OurobionColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'ACTIVE',
              style: GoogleFonts.manrope(
                fontSize: 9, fontWeight: FontWeight.w700,
                letterSpacing: 1.2, color: OurobionColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotesCard extends StatefulWidget {
  final TextEditingController controller;
  const _NotesCard({required this.controller});

  @override
  State<_NotesCard> createState() => _NotesCardState();
}

class _NotesCardState extends State<_NotesCard> {
  void _onChanged() => setState(() {});

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final len = widget.controller.text.length;
    final hasText = len > 0;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasText
              ? OurobionColors.primaryContainer
              : OurobionColors.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          TextField(
            controller: widget.controller,
            maxLength: 140,
            maxLines: 3,
            minLines: 1,
            style: GoogleFonts.manrope(
              fontSize: 14, fontWeight: FontWeight.w400,
            ),
            decoration: InputDecoration(
              hintText: 'Anything unusual today? (optional)',
              counterText: '',
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              contentPadding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 0, 16, 10),
            child: Text(
              '$len / 140',
              style: GoogleFonts.manrope(
                fontSize: 10, fontWeight: FontWeight.w600,
                color: len > 120
                    ? Theme.of(context).colorScheme.error
                    : OurobionColors.outline,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
