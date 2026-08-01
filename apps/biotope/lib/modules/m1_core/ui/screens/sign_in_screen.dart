import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../../core/app_preferences.dart';
import '../../../../../core/theme.dart';
import '../../../../../core/widgets/biotope_auth_scaffold.dart';
import '../../impl/auth_service.dart';
import '../widgets/living_backdrop.dart';
import 'sign_up_screen.dart';

class SignInScreen extends StatefulWidget {
  final AuthService authService;
  const SignInScreen({super.key, required this.authService});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _isLoading   = false;
  bool _obscure     = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _error = null; });

    final result = await widget.authService.signIn(
      _emailCtrl.text.trim(),
      _passCtrl.text,
    );

    if (!mounted) return;
    setState(() { _isLoading = false; });
    if (!result.success && !result.pending) {
      setState(() { _error = result.errorMessage; });
    }
    // On success the AuthGate StreamBuilder navigates automatically.
  }

  @override
  Widget build(BuildContext context) {
    return BiotopeAuthScaffold(
      signingIn: true,
      onSwitchMode: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SignUpScreen(authService: widget.authService)),
      ),
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
              'WELCOME BACK',
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
              style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
              decoration: const InputDecoration(hintText: 'Email address'),
              validator: (v) => (v == null || v.isEmpty) ? 'Enter your email' : null,
            ),
            const SizedBox(height: 11),
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: 'Password',
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: OurobionColors.outline,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              _AuthError(message: _error!),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _isLoading ? null : _submit,
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Sign In →'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthError extends StatelessWidget {
  final String message;
  const _AuthError({required this.message});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFAF4).withValues(alpha: 0.95),
          border: Border.all(color: const Color(0xFFB26844).withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const DecoratedBox(
              decoration: BoxDecoration(color: Color(0xFFB26844), shape: BoxShape.circle),
              child: SizedBox(width: 6, height: 6),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                message,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF8A4A2C),
                ),
              ),
            ),
          ],
        ),
      );
}
