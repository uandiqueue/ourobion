import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme.dart';

const List<String> _kLabels = [
  'Separate lumps',
  'Lumpy sausage',
  'Cracked sausage',
  'Smooth sausage',
  'Soft blobs',
  'Fluffy pieces',
  'Watery',
];

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
                        '02 / 08',
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
                          const Divider(height: 1, color: OurobionColors.outlineVariant),
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
                                    onTap: () => setState(() => _selected = type),
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 180),
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
                                            duration: const Duration(milliseconds: 180),
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: isSelected
                                                  ? OurobionColors.primary
                                                  : OurobionColors.surfaceContainer,
                                            ),
                                            child: Center(
                                              child: Text(
                                                '$type',
                                                style: GoogleFonts.manrope(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: isSelected
                                                      ? OurobionColors.onPrimary
                                                      : OurobionColors.onSurfaceVariant,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          // Shape icon
                                          CustomPaint(
                                            size: const Size(52, 32),
                                            painter: _ShapePainter(
                                              type: type,
                                              color: isSelected
                                                  ? OurobionColors.primaryContainer
                                                  : OurobionColors.outlineVariant,
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
                                                  _kLabels[i],
                                                  style: GoogleFonts.manrope(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w700,
                                                    color: isSelected
                                                        ? OurobionColors.onPrimaryContainer
                                                        : OurobionColors.onSurface,
                                                  ),
                                                ),
                                                const SizedBox(height: 1),
                                                Text(
                                                  _kBriefs[i],
                                                  style: GoogleFonts.manrope(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w400,
                                                    color: OurobionColors.onSurfaceVariant,
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

// ── Bristol shape icons ────────────────────────────────────────────────────────

class _ShapePainter extends CustomPainter {
  final int type;
  final Color color;

  const _ShapePainter({required this.type, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    switch (type) {
      case 1:
        _type1(canvas, fill);
        break;
      case 2:
        _type2(canvas, fill);
        break;
      case 3:
        _type3(canvas, fill);
        break;
      case 4:
        _type4(canvas, fill);
        break;
      case 5:
        _type5(canvas, fill);
        break;
      case 6:
        _type6(canvas, fill);
        break;
      case 7:
        _type7(canvas);
        break;
    }
  }

  // Type 1 — separate hard lumps: 5 circles like pellets
  void _type1(Canvas canvas, Paint p) {
    const r = 4.0;
    const spots = [
      Offset(7, 15),
      Offset(16, 13),
      Offset(26, 16),
      Offset(36, 13),
      Offset(45, 15),
    ];
    for (final o in spots) {
      canvas.drawCircle(o, r, p);
    }
  }

  // Type 2 — lumpy sausage: smooth bottom, 3 bumps on top
  void _type2(Canvas canvas, Paint p) {
    final path = Path()
      ..moveTo(3, 24)
      ..quadraticBezierTo(3, 15, 7, 13)
      ..quadraticBezierTo(13, 7, 19, 13)
      ..quadraticBezierTo(26, 7, 33, 13)
      ..quadraticBezierTo(39, 7, 45, 13)
      ..quadraticBezierTo(49, 15, 49, 24)
      ..quadraticBezierTo(26, 30, 3, 24);
    canvas.drawPath(path, p);
  }

  // Type 3 — cracked sausage: smooth sausage with 2 surface crack lines
  void _type3(Canvas canvas, Paint p) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTRB(3, 9, 49, 23),
        const Radius.circular(7),
      ),
      p,
    );
    final crack = Paint()
      ..color = Colors.white.withValues(alpha: 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(18, 11), const Offset(16, 21), crack);
    canvas.drawLine(const Offset(32, 10), const Offset(34, 21), crack);
  }

  // Type 4 — smooth sausage: clean rounded rect
  void _type4(Canvas canvas, Paint p) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTRB(3, 8, 49, 24),
        const Radius.circular(8),
      ),
      p,
    );
  }

  // Type 5 — soft blobs: 3 separate ovals
  void _type5(Canvas canvas, Paint p) {
    canvas.drawOval(
        Rect.fromCenter(center: const Offset(11, 16), width: 16, height: 14), p);
    canvas.drawOval(
        Rect.fromCenter(center: const Offset(26, 15), width: 14, height: 15), p);
    canvas.drawOval(
        Rect.fromCenter(center: const Offset(41, 16), width: 16, height: 13), p);
  }

  // Type 6 — fluffy pieces: irregular ragged blob
  void _type6(Canvas canvas, Paint p) {
    final path = Path()
      ..moveTo(4, 16)
      ..quadraticBezierTo(3, 9, 9, 8)
      ..quadraticBezierTo(15, 4, 20, 9)
      ..quadraticBezierTo(24, 5, 30, 8)
      ..quadraticBezierTo(36, 4, 41, 9)
      ..quadraticBezierTo(48, 8, 49, 16)
      ..quadraticBezierTo(48, 24, 41, 24)
      ..quadraticBezierTo(34, 28, 26, 25)
      ..quadraticBezierTo(18, 28, 11, 24)
      ..quadraticBezierTo(3, 24, 4, 16);
    canvas.drawPath(path, p);
  }

  // Type 7 — watery: 3 wavy horizontal stroke lines
  void _type7(Canvas canvas) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    for (int row = 0; row < 3; row++) {
      final y = 9.0 + row * 7;
      final path = Path()..moveTo(4, y);
      for (int w = 0; w < 3; w++) {
        final x = 4.0 + w * 16;
        path
          ..quadraticBezierTo(x + 4, y - 3, x + 8, y)
          ..quadraticBezierTo(x + 12, y + 3, x + 16, y);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(_ShapePainter old) =>
      old.type != type || old.color != color;
}
