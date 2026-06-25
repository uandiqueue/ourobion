import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme.dart';

const _kFlags = <(String, String, IconData)>[
  ('feverish', 'Feverish', Icons.thermostat_rounded),
  ('nausea', 'Nausea', Icons.sick_rounded),
  ('body_aches', 'Body aches', Icons.accessibility_new_rounded),
  ('fatigue', 'Fatigue', Icons.battery_1_bar_rounded),
  ('loss_of_appetite', 'Loss of appetite', Icons.no_meals_rounded),
  ('abdominal_cramps', 'Abdominal cramps', Icons.healing_rounded),
  ('headache', 'Headache', Icons.psychology_rounded),
];

class SymptomFlagsScreen extends StatefulWidget {
  final List<String> initialFlags;
  const SymptomFlagsScreen({super.key, this.initialFlags = const []});

  @override
  State<SymptomFlagsScreen> createState() => _SymptomFlagsScreenState();
}

class _SymptomFlagsScreenState extends State<SymptomFlagsScreen> {
  late final Set<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = Set.from(widget.initialFlags);
  }

  void _toggle(String flag) => setState(() {
        if (_selected.contains(flag)) {
          _selected.remove(flag);
        } else {
          _selected.add(flag);
        }
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      appBar: AppBar(
        backgroundColor: OurobionColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(_selected.toList()),
        ),
        title: Text(
          'SYMPTOM SIGNALS',
          style: GoogleFonts.manrope(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
            color: OurobionColors.primary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(_selected.toList()),
            child: Text(
              'Done',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w600,
                color: OurobionColors.primary,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
            child: Text(
              'Select signals you noticed today. Not selecting a signal does not mean it was absent.',
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _kFlags.map((f) {
                  final (key, label, icon) = f;
                  return _FlagChip(
                    label: label,
                    icon: icon,
                    selected: _selected.contains(key),
                    onTap: () => _toggle(key),
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FlagChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _FlagChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? OurobionColors.primary : OurobionColors.surfaceLowest,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected
                ? OurobionColors.primary
                : OurobionColors.outlineVariant,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: selected ? OurobionColors.onPrimary : OurobionColors.outline,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected
                    ? OurobionColors.onPrimary
                    : OurobionColors.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
