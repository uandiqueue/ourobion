import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme.dart';

// Armstrong Urine Color Scale — 1 (very pale) → 8 (dark brown)
const List<Color> _kColors = [
  Color(0xFFF5F0B8), // 1 — very pale
  Color(0xFFEEE060), // 2 — pale yellow
  Color(0xFFE8CE25), // 3 — yellow
  Color(0xFFD4A018), // 4 — dark yellow
  Color(0xFFC07818), // 5 — amber
  Color(0xFFA05010), // 6 — dark amber
  Color(0xFF7E3210), // 7 — orange-brown
  Color(0xFF501808), // 8 — dark brown
];

const List<String> _kLabels = [
  'Very pale',
  'Pale yellow',
  'Yellow',
  'Dark yellow',
  'Amber',
  'Dark amber',
  'Orange-brown',
  'Dark brown',
];

const List<String> _kDescriptions = [
  'Very light colour — typical for high fluid intake',
  'Light colour — within the normal range',
  'Typical yellow colour',
  'Slightly more concentrated than usual',
  'Noticeably concentrated — consider drinking water',
  'Quite dark — worth increasing fluids today',
  'Very dark colour observed',
  'Unusually dark colour observed',
];

class UrineColorScreen extends StatefulWidget {
  final int? initialValue;
  const UrineColorScreen({super.key, this.initialValue});

  @override
  State<UrineColorScreen> createState() => _UrineColorScreenState();
}

class _UrineColorScreenState extends State<UrineColorScreen>
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: OurobionColors.surfaceLowest,
                            border: Border.all(color: OurobionColors.outlineVariant),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            size: 18,
                            color: OurobionColors.onSurface,
                          ),
                        ),
                      ),
                      Text(
                        '01 / 08',
                        style: GoogleFonts.manrope(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.4,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),

                  // ── Eyebrow ──────────────────────────────────────────
                  Text(
                    'HYDRATION',
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
                    'How did your urine\nlook today?',
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
                    'Tap the closest colour on the scale.',
                    style: GoogleFonts.manrope(
                      fontSize: 14,
                      fontWeight: FontWeight.w400,
                      color: OurobionColors.outline,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Palette card ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: OurobionColors.surfaceLowest,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: OurobionColors.outlineVariant),
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
                      children: [
                        // Scale header
                        Row(
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
                              'ARMSTRONG SCALE',
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.6,
                                color: OurobionColors.onSurfaceVariant,
                              ),
                            ),
                            Text(
                              '8',
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.4,
                                color: OurobionColors.outline,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Swatch row
                        Row(
                          children: List.generate(8, (i) {
                            final level = i + 1;
                            final isSelected = _selected == level;
                            return Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _selected = level),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 180),
                                  curve: Curves.easeOut,
                                  margin: const EdgeInsets.symmetric(horizontal: 2),
                                  height: isSelected ? 60 : 44,
                                  decoration: BoxDecoration(
                                    color: _kColors[i],
                                    borderRadius: BorderRadius.circular(10),
                                    border: isSelected
                                        ? Border.all(color: Colors.white, width: 2.5)
                                        : null,
                                    boxShadow: isSelected
                                        ? [
                                            BoxShadow(
                                              color: _kColors[i].withValues(alpha: 0.55),
                                              blurRadius: 14,
                                              spreadRadius: 2,
                                            )
                                          ]
                                        : null,
                                  ),
                                  child: isSelected
                                      ? const Center(
                                          child: Icon(
                                            Icons.check_rounded,
                                            color: Colors.white,
                                            size: 16,
                                          ),
                                        )
                                      : null,
                                ),
                              ),
                            );
                          }),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

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
                              color: OurobionColors.primaryFixed.withValues(alpha: 0.28),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _kLabels[_selected! - 1],
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

                  const Spacer(),

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
