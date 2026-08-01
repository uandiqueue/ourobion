import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../../core/theme.dart';

/// Five-point optional observational check-in with accessible labelled targets.
class LikertCheckInCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String lowLabel;
  final String highLabel;
  final int? value;
  final ValueChanged<int> onChanged;

  const LikertCheckInCard({
    super.key,
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
          color: logged
              ? OurobionColors.primaryContainer
              : OurobionColors.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: logged
                      ? OurobionColors.primary
                      : OurobionColors.outline,
                ),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: List.generate(5, (index) {
              final score = index + 1;
              final selected = value == score;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: index < 4 ? 6 : 0),
                  child: Semantics(
                    button: true,
                    selected: selected,
                    label: '$label, $score of 5',
                    onTap: () => onChanged(score),
                    child: SizedBox(
                      height: 44,
                      child: Material(
                        color: selected
                            ? OurobionColors.primary
                            : OurobionColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(8),
                        child: InkWell(
                          excludeFromSemantics: true,
                          borderRadius: BorderRadius.circular(8),
                          onTap: () => onChanged(score),
                          child: ExcludeSemantics(
                            child: Center(
                              child: Text(
                                '$score',
                                style: GoogleFonts.manrope(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? OurobionColors.onPrimary
                                      : OurobionColors.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          ExcludeSemantics(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  lowLabel,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    color: OurobionColors.outline,
                  ),
                ),
                Text(
                  highLabel,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    color: OurobionColors.outline,
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
