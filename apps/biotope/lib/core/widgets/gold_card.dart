import 'package:flutter/material.dart';

import '../theme.dart';

/// Shared card container for the biomech-botanical reskin: porcelain surface,
/// gold-tinted border, soft warm shadow. Extracted from the pattern previously
/// copy-pasted across `_TodayCard`/`_StreakCard`/`_InsightsTeaser` (home_tab.dart)
/// and `_InsightCardTile` (insights_tab.dart) — reuse here rather than re-inlining.
class GoldCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final bool emphasized;

  const GoldCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = kCardRadius,
    this.onTap,
    this.emphasized = false,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: emphasized
              ? OurobionColors.primary.withValues(alpha: 0.75)
              : OurobionColors.primary.withValues(alpha: 0.36),
        ),
        boxShadow: [
          BoxShadow(
            color: OurobionColors.primary.withValues(alpha: 0.03),
            blurRadius: 3,
          ),
          BoxShadow(
            color: OurobionColors.primary.withValues(alpha: emphasized ? 0.2 : 0.14),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
