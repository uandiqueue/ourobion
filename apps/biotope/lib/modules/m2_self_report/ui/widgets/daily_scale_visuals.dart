import 'package:flutter/material.dart';

/// Armstrong urine-colour options shared by the Daily Log picker and Scan.
/// Index zero represents stored value 1.
const List<Color> kArmstrongColors = [
  Color(0xFFF5F0B8),
  Color(0xFFEEE060),
  Color(0xFFE8CE25),
  Color(0xFFD4A018),
  Color(0xFFC07818),
  Color(0xFFA05010),
  Color(0xFF7E3210),
  Color(0xFF501808),
];

const List<String> kArmstrongNames = [
  'Very pale',
  'Pale yellow',
  'Yellow',
  'Dark yellow',
  'Amber',
  'Dark amber',
  'Orange-brown',
  'Dark brown',
];

/// Descriptive Bristol names shared by the Daily Log picker and Scan.
/// These labels identify appearance only and intentionally carry no diagnosis.
const List<String> kBristolNames = [
  'Separate firm pieces',
  'Lumpy sausage',
  'Cracked sausage',
  'Smooth sausage',
  'Soft blobs',
  'Fluffy pieces',
  'Watery',
];

/// The single Bristol renderer used by both M2 entry surfaces.
class BristolShapePainter extends CustomPainter {
  final int type;
  final Color color;

  const BristolShapePainter({required this.type, required this.color})
    : assert(type >= 1 && type <= 7);

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

  void _type1(Canvas canvas, Paint paint) {
    const spots = [
      Offset(7, 15),
      Offset(16, 13),
      Offset(26, 16),
      Offset(36, 13),
      Offset(45, 15),
    ];
    for (final spot in spots) {
      canvas.drawCircle(spot, 4, paint);
    }
  }

  void _type2(Canvas canvas, Paint paint) {
    final path = Path()
      ..moveTo(3, 24)
      ..quadraticBezierTo(3, 15, 7, 13)
      ..quadraticBezierTo(13, 7, 19, 13)
      ..quadraticBezierTo(26, 7, 33, 13)
      ..quadraticBezierTo(39, 7, 45, 13)
      ..quadraticBezierTo(49, 15, 49, 24)
      ..quadraticBezierTo(26, 30, 3, 24);
    canvas.drawPath(path, paint);
  }

  void _type3(Canvas canvas, Paint paint) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTRB(3, 9, 49, 23),
        const Radius.circular(7),
      ),
      paint,
    );
    final crack = Paint()
      ..color = Colors.white.withValues(alpha: 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(18, 11), const Offset(16, 21), crack);
    canvas.drawLine(const Offset(32, 10), const Offset(34, 21), crack);
  }

  void _type4(Canvas canvas, Paint paint) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTRB(3, 8, 49, 24),
        const Radius.circular(8),
      ),
      paint,
    );
  }

  void _type5(Canvas canvas, Paint paint) {
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(11, 16), width: 16, height: 14),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(26, 15), width: 14, height: 15),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(41, 16), width: 16, height: 13),
      paint,
    );
  }

  void _type6(Canvas canvas, Paint paint) {
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
    canvas.drawPath(path, paint);
  }

  void _type7(Canvas canvas) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    for (var row = 0; row < 3; row++) {
      final y = 9.0 + row * 7;
      final path = Path()..moveTo(4, y);
      for (var wave = 0; wave < 3; wave++) {
        final x = 4.0 + wave * 16;
        path
          ..quadraticBezierTo(x + 4, y - 3, x + 8, y)
          ..quadraticBezierTo(x + 12, y + 3, x + 16, y);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant BristolShapePainter oldDelegate) =>
      oldDelegate.type != type || oldDelegate.color != color;
}
