import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../impl/antibiotic_service.dart';

const _kMonths = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

class AntibioticCourseScreen extends StatefulWidget {
  const AntibioticCourseScreen({super.key});

  @override
  State<AntibioticCourseScreen> createState() => _AntibioticCourseScreenState();
}

class _AntibioticCourseScreenState extends State<AntibioticCourseScreen> {
  final _drugCtrl = TextEditingController();
  DateTime _startDate = DateTime.now();
  int _durationDays = 7;
  bool _isSaving = false;

  DateTime get _endDate =>
      _startDate.add(Duration(days: _durationDays - 1));

  String _fmt(DateTime d) =>
      '${d.day} ${_kMonths[d.month - 1]} ${d.year}';

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _save() async {
    final drug = _drugCtrl.text.trim();
    if (drug.isEmpty) return;
    setState(() => _isSaving = true);
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;
      await AntibioticService(client).addCourse(
        userId: userId,
        drugName: drug,
        startDate: _startDate,
        durationDays: _durationDays,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Course logged',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          backgroundColor: OurobionColors.primary,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );
      Navigator.of(context).pop();
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
  void dispose() {
    _drugCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canSave = _drugCtrl.text.trim().isNotEmpty && !_isSaving;
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      appBar: AppBar(
        backgroundColor: OurobionColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'ANTIBIOTIC COURSE',
          style: GoogleFonts.manrope(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
            color: OurobionColors.primary,
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _label('DRUG NAME'),
              const SizedBox(height: 8),
              _box(
                child: TextField(
                  controller: _drugCtrl,
                  onChanged: (_) => setState(() {}),
                  textCapitalization: TextCapitalization.words,
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                  decoration: InputDecoration(
                    hintText: 'e.g. Amoxicillin',
                    hintStyle: GoogleFonts.manrope(
                      color: OurobionColors.outline,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              _label('START DATE'),
              const SizedBox(height: 8),
              _box(
                child: ListTile(
                  dense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                  leading: Icon(
                    Icons.calendar_today_rounded,
                    size: 18,
                    color: OurobionColors.primary,
                  ),
                  title: Text(
                    _fmt(_startDate),
                    style: GoogleFonts.manrope(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  trailing: Icon(
                    Icons.chevron_right_rounded,
                    color: OurobionColors.outlineVariant,
                  ),
                  onTap: _pickDate,
                ),
              ),
              const SizedBox(height: 20),
              _label('DURATION'),
              const SizedBox(height: 8),
              _box(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.schedule_rounded,
                        size: 18,
                        color: OurobionColors.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '$_durationDays days · ends ${_fmt(_endDate)}',
                          style: GoogleFonts.manrope(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      _StepBtn(
                        icon: Icons.remove_rounded,
                        onTap: _durationDays > 1
                            ? () => setState(() => _durationDays--)
                            : null,
                      ),
                      SizedBox(
                        width: 40,
                        child: Text(
                          '$_durationDays',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.manrope(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      _StepBtn(
                        icon: Icons.add_rounded,
                        onTap: _durationDays < 30
                            ? () => setState(() => _durationDays++)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '14-day gut watch period begins automatically after the course ends.',
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  color: OurobionColors.onSurfaceVariant,
                ),
              ),
              const Spacer(),
              FilledButton(
                onPressed: canSave ? _save : null,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Log course'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: GoogleFonts.manrope(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.4,
          color: OurobionColors.onSurfaceVariant,
        ),
      );

  Widget _box({required Widget child}) => Container(
        decoration: BoxDecoration(
          color: OurobionColors.surfaceLowest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: OurobionColors.outlineVariant),
        ),
        child: child,
      );
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
          color: enabled ? OurobionColors.onSurface : OurobionColors.outlineVariant,
        ),
      ),
    );
  }
}
