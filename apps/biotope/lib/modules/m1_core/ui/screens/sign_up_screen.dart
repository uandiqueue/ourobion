import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../../core/app_preferences.dart';
import '../../../../../core/theme.dart';
import '../../../../../core/widgets/biotope_auth_scaffold.dart';
import '../../impl/auth_service.dart';
import '../widgets/living_backdrop.dart';

class SignUpScreen extends StatefulWidget {
  final AuthService authService;
  const SignUpScreen({super.key, required this.authService});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _isLoading = false;
  bool _obscurePass = true;
  bool _obscureConf = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await widget.authService.signUp(
      _emailCtrl.text.trim(),
      _passCtrl.text,
    );

    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Account created. Check your email to verify it. The confirmation link will return you to Biotope.',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w600),
          ),
          backgroundColor: OurobionColors.primary,
        ),
      );
      Navigator.of(context).pop();
    } else {
      setState(() {
        _error = result.errorMessage;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return BiotopeAuthScaffold(
      signingIn: false,
      onSwitchMode: () => Navigator.of(context).pop(),
      background: ValueListenableBuilder<bool>(
        valueListenable: AppPreferences.backdropEnabled,
        builder: (context, enabled, child) => enabled
            ? const LivingBackdrop()
            : const ColoredBox(color: OurobionColors.background),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'CREATE ACCOUNT',
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.6,
                color: OurobionColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              style: GoogleFonts.manrope(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
              decoration: const InputDecoration(hintText: 'Email address'),
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Enter your email' : null,
            ),
            const SizedBox(height: 11),
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscurePass,
              textInputAction: TextInputAction.next,
              style: GoogleFonts.manrope(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: 'Password',
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePass
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: OurobionColors.outline,
                  ),
                  onPressed: () => setState(() => _obscurePass = !_obscurePass),
                ),
              ),
              validator: (v) =>
                  (v != null && v.length >= 6) ? null : 'At least 6 characters',
            ),
            const SizedBox(height: 11),
            TextFormField(
              controller: _confirmCtrl,
              obscureText: _obscureConf,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              style: GoogleFonts.manrope(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: 'Confirm password',
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConf
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: OurobionColors.outline,
                  ),
                  onPressed: () => setState(() => _obscureConf = !_obscureConf),
                ),
              ),
              validator: (v) =>
                  v == _passCtrl.text ? null : 'Passwords do not match',
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              _SignUpError(message: _error!),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _isLoading ? null : _submit,
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Get Started →'),
            ),
            const SizedBox(height: 16),
            Text(
              "You'll set your data permissions in the next step.",
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 11,
                fontWeight: FontWeight.w400,
                color: OurobionColors.outline,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignUpError extends StatelessWidget {
  final String message;
  const _SignUpError({required this.message});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
    decoration: BoxDecoration(
      color: const Color(0xFFFFFAF4).withValues(alpha: 0.95),
      border: Border.all(color: const Color(0xFFB26844).withValues(alpha: 0.4)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(
      message,
      style: GoogleFonts.manrope(
        fontSize: 12,
        height: 1.4,
        fontWeight: FontWeight.w500,
        color: const Color(0xFF8A4A2C),
      ),
    ),
  );
}
