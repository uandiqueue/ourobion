import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../widgets/daily_scale_visuals.dart';

const List<String> _kBriefs = [
  'Severe constipation',
  'Mild constipation',
  'Normal',
  'Ideal',
  'Low fibre intake',
  'Borderline loose',
  'Acute diarrhoea',
];

const List<String> _kDescriptions = [
  'Hard, separate pieces like nuts — often indicates severe constipation',
  'Sausage-shaped but lumpy — suggests mild constipation',
  'Like a sausage with some surface cracks — within normal range',
  'Smooth and soft, like a sausage or snake — the ideal stool form',
  'Soft blobs with clear edges — may suggest low fibre intake',
  'Fluffy pieces with ragged edges — borderline loose stool',
  'Entirely watery, no solid pieces — may indicate diarrhoea',
];

class StoolFormScreen extends StatefulWidget {
  final int? initialValue;
  const StoolFormScreen({super.key, this.initialValue});

  @override
  State<StoolFormScreen> createState() => _StoolFormScreenState();
}

class _StoolFormScreenState extends State<StoolFormScreen>
    with SingleTickerProviderStateMixin {
  int? _selected;

  late final AnimationController _enterCtrl;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialValue;
    _enterCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );
    final curve = CurvedAnimation(
      parent: _enterCtrl,
      curve: const Cubic(0.2, 0, 0, 1),
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(curve);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(curve);
    _enterCtrl.forward();
  }

  @override
  void dispose() {
    _enterCtrl.dispose();
    super.dispose();
  }

  void _confirm() => Navigator.of(context).pop(_selected);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      body: SafeArea(
        child: FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _slide,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 24),

                  // ── Nav row ──────────────────────────────────────────
                  //
                  // Back only — see urine_color_screen.dart for why the
                  // hardcoded '02 / 08' step counter that used to sit here was
                  // deleted rather than made real: there is no eight-step flow
                  // for it to describe.
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: OurobionColors.surfaceLowest,
                            border: Border.all(
                              color: OurobionColors.outlineVariant,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            size: 18,
                            color: OurobionColors.onSurface,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),

                  // ── Eyebrow ──────────────────────────────────────────
                  Text(
                    'GUT HEALTH',
                    style: GoogleFonts.manrope(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.6,
                      color: OurobionColors.primary,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // ── Headline ─────────────────────────────────────────
                  Text(
                    'How was your\nstool today?',
                    style: GoogleFonts.manrope(
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.4,
                      height: 1.2,
                      color: OurobionColors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Select the closest type on the Bristol scale.',
                    style: GoogleFonts.manrope(
                      fontSize: 14,
                      fontWeight: FontWeight.w400,
                      color: OurobionColors.outline,
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Bristol scale card ───────────────────────────────
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: OurobionColors.surfaceLowest,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: OurobionColors.outlineVariant,
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x0A000000),
                            blurRadius: 3,
                            offset: Offset(0, 1),
                          ),
                          BoxShadow(
                            color: Color(0x183c6752),
                            blurRadius: 24,
                            spreadRadius: -12,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '1',
                                  style: GoogleFonts.manrope(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.4,
                                    color: OurobionColors.outline,
                                  ),
                                ),
                                Text(
                                  'BRISTOL SCALE',
                                  style: GoogleFonts.manrope(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.6,
                                    color: OurobionColors.onSurfaceVariant,
                                  ),
                                ),
                                Text(
                                  '7',
                                  style: GoogleFonts.manrope(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.4,
                                    color: OurobionColors.outline,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Divider(
                            height: 1,
                            color: OurobionColors.outlineVariant,
                          ),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: const BorderRadius.vertical(
                                bottom: Radius.circular(24),
                              ),
                              child: ListView.separated(
                                padding: EdgeInsets.zero,
                                itemCount: 7,
                                separatorBuilder: (_, i) => const Divider(
                                  height: 1,
                                  indent: 20,
                                  endIndent: 20,
                                  color: OurobionColors.outlineVariant,
                                ),
                                itemBuilder: (context, i) {
                                  final type = i + 1;
                                  final isSelected = _selected == type;
                                  return GestureDetector(
                                    onTap: () =>
                                        setState(() => _selected = type),
                                    child: AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 180,
                                      ),
                                      curve: Curves.easeOut,
                                      color: isSelected
                                          ? OurobionColors.primaryFixed
                                                .withValues(alpha: 0.28)
                                          : Colors.transparent,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 20,
                                        vertical: 10,
                                      ),
                                      child: Row(
                                        children: [
                                          // Type badge
                                          AnimatedContainer(
                                            duration: const Duration(
                                              milliseconds: 180,
                                            ),
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: isSelected
                                                  ? OurobionColors.primary
                                                  : OurobionColors
                                                        .surfaceContainer,
                                            ),
                                            child: Center(
                                              child: Text(
                                                '$type',
                                                style: GoogleFonts.manrope(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: isSelected
                                                      ? OurobionColors.onPrimary
                                                      : OurobionColors
                                                            .onSurfaceVariant,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          // Shape icon
                                          CustomPaint(
                                            size: const Size(52, 32),
                                            painter: BristolShapePainter(
                                              type: type,
                                              color: isSelected
                                                  ? OurobionColors
                                                        .primaryContainer
                                                  : OurobionColors
                                                        .outlineVariant,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          // Label + brief
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  kBristolNames[i],
                                                  style: GoogleFonts.manrope(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w700,
                                                    color: isSelected
                                                        ? OurobionColors
                                                              .onPrimaryContainer
                                                        : OurobionColors
                                                              .onSurface,
                                                  ),
                                                ),
                                                const SizedBox(height: 1),
                                                Text(
                                                  _kBriefs[i],
                                                  style: GoogleFonts.manrope(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w400,
                                                    color: OurobionColors
                                                        .onSurfaceVariant,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          // Check indicator
                                          if (isSelected)
                                            const Icon(
                                              Icons.check_circle_rounded,
                                              size: 18,
                                              color: OurobionColors.primary,
                                            ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Selected description ──────────────────────────────
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: _selected != null
                        ? Container(
                            key: ValueKey(_selected),
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: OurobionColors.primaryFixed.withValues(
                                alpha: 0.28,
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  kBristolNames[_selected! - 1],
                                  style: GoogleFonts.manrope(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: OurobionColors.onPrimaryContainer,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _kDescriptions[_selected! - 1],
                                  style: GoogleFonts.manrope(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w400,
                                    color: OurobionColors.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : SizedBox(key: const ValueKey('empty'), height: 62),
                  ),

                  const SizedBox(height: 4),

                  // ── Skip ─────────────────────────────────────────────
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(null),
                      child: const Text('Skip for now'),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // ── CTA ──────────────────────────────────────────────
                  FilledButton(
                    onPressed: _selected != null ? _confirm : null,
                    child: const Text('Confirm →'),
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
