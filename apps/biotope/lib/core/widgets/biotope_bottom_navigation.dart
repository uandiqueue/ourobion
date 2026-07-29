import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme.dart';

/// Floating five-tab navigation used by the Biotope shell.
///
/// This intentionally does not wrap Material's [NavigationBar]: the reference
/// uses a floating glass capsule and a sliding, compact selected pill.
class BiotopeBottomNavigation extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  const BiotopeBottomNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  static const _destinations = <_BiotopeNavigationDestination>[
    _BiotopeNavigationDestination('Home', Icons.home_outlined, Icons.home_rounded),
    _BiotopeNavigationDestination('Scan', Icons.radar_outlined, Icons.radar_rounded),
    _BiotopeNavigationDestination(
      'Insights',
      Icons.lightbulb_outline_rounded,
      Icons.lightbulb_rounded,
    ),
    _BiotopeNavigationDestination(
      'Archive',
      Icons.inventory_2_outlined,
      Icons.inventory_2_rounded,
    ),
    _BiotopeNavigationDestination(
      'Profile',
      Icons.person_outline_rounded,
      Icons.person_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: BiotopeGeometry.navigationHorizontalInset,
        ),
        child: SizedBox(
          height: BiotopeGeometry.navigationHeight,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(BiotopeGeometry.navigationRadius),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: OurobionColors.surfaceLowest.withValues(alpha: 0.82),
                  borderRadius: BorderRadius.circular(BiotopeGeometry.navigationRadius),
                  border: Border.all(
                    color: OurobionColors.primaryFixedDim.withValues(alpha: 0.52),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: OurobionColors.primary.withValues(alpha: 0.28),
                      blurRadius: 34,
                      offset: const Offset(0, 14),
                      spreadRadius: -20,
                    ),
                  ],
                ),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final itemWidth = constraints.maxWidth / _destinations.length;
                    return Stack(
                      children: [
                        AnimatedPositioned(
                          duration: reduceMotion
                              ? Duration.zero
                              : BiotopeMotion.navigationSettle,
                          curve: BiotopeMotion.expressiveCurve,
                          left: selectedIndex * itemWidth + 4,
                          top: 6,
                          width: itemWidth - 8,
                          height: constraints.maxHeight - 12,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: OurobionColors.primaryFixed.withValues(alpha: 0.75),
                              borderRadius: BorderRadius.circular(19),
                            ),
                          ),
                        ),
                        Row(
                          children: List.generate(_destinations.length, (index) {
                            final destination = _destinations[index];
                            return Expanded(
                              child: _BiotopeNavigationItem(
                                destination: destination,
                                selected: index == selectedIndex,
                                onTap: () => onSelected(index),
                              ),
                            );
                          }),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BiotopeNavigationItem extends StatelessWidget {
  final _BiotopeNavigationDestination destination;
  final bool selected;
  final VoidCallback onTap;

  const _BiotopeNavigationItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? OurobionColors.brandGoldDark : OurobionColors.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(19),
        child: Center(
          child: ExcludeSemantics(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(selected ? destination.selectedIcon : destination.icon, color: color, size: 21),
                const SizedBox(height: 3),
                Text(
                  destination.label,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    height: 1,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BiotopeNavigationDestination {
  final String label;
  final IconData icon;
  final IconData selectedIcon;

  const _BiotopeNavigationDestination(this.label, this.icon, this.selectedIcon);
}
