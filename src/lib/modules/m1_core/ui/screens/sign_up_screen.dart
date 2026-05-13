import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../../core/theme.dart';
import '../../impl/auth_service.dart';
import '../widgets/living_backdrop.dart';

class SignUpScreen extends StatefulWidget {
  final AuthService authService;
  const SignUpScreen({super.key, required this.authService});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey    = GlobalKey<FormState>();
  final _emailCtrl  = TextEditingController();
  final _passCtrl   = TextEditingController();
  final _confirmCtrl= TextEditingController();
  bool _isLoading   = false;
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
    setState(() { _isLoading = true; _error = null; });

    final result = await widget.authService.signUp(
      _emailCtrl.text.trim(),
      _passCtrl.text,
    );

    if (!mounted) return;
    setState(() { _isLoading = false; });

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Account created! Please sign in.',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w600)),
          backgroundColor: BiotopeColors.primary,
        ),
      );
      Navigator.of(context).pop();
    } else {
      setState(() { _error = result.errorMessage; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const LivingBackdrop(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 52),

                    // ── Logo + brand ───────────────────────────
                    Image.asset(
                      'assets/images/logo.png',
                      width: 72, height: 72,
                      errorBuilder: (context, error, stackTrace) => Container(
                        width: 72, height: 72,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [BiotopeColors.primaryFixed, BiotopeColors.primary],
                          ),
                        ),
                        child: const Icon(Icons.eco, color: Colors.white, size: 36),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text('Biotope', style: GoogleFonts.manrope(
                      fontSize: 28, fontWeight: FontWeight.w700,
                      letterSpacing: -0.6, color: BiotopeColors.onSurface,
                    )),
                    const SizedBox(height: 4),
                    Text('Start your journey.', style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w400,
                      color: BiotopeColors.outline,
                    )),

                    const SizedBox(height: 40),

                    // ── Eyebrow ────────────────────────────────
                    Text('CREATE ACCOUNT', style: GoogleFonts.manrope(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      letterSpacing: 1.6, color: BiotopeColors.primary,
                    )),

                    const SizedBox(height: 20),

                    // ── Email ──────────────────────────────────
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
                      decoration: const InputDecoration(hintText: 'Email address'),
                      validator: (v) => (v == null || v.isEmpty) ? 'Enter your email' : null,
                    ),
                    const SizedBox(height: 12),

                    // ── Password ───────────────────────────────
                    TextFormField(
                      controller: _passCtrl,
                      obscureText: _obscurePass,
                      textInputAction: TextInputAction.next,
                      style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Password',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePass ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: BiotopeColors.outline,
                          ),
                          onPressed: () => setState(() => _obscurePass = !_obscurePass),
                        ),
                      ),
                      validator: (v) => (v != null && v.length >= 6) ? null : 'At least 6 characters',
                    ),
                    const SizedBox(height: 12),

                    // ── Confirm password ───────────────────────
                    TextFormField(
                      controller: _confirmCtrl,
                      obscureText: _obscureConf,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Confirm password',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureConf ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: BiotopeColors.outline,
                          ),
                          onPressed: () => setState(() => _obscureConf = !_obscureConf),
                        ),
                      ),
                      validator: (v) => v == _passCtrl.text ? null : 'Passwords do not match',
                    ),

                    // ── Error ──────────────────────────────────
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: GoogleFonts.manrope(
                        fontSize: 13, color: Theme.of(context).colorScheme.error,
                      )),
                    ],

                    const SizedBox(height: 24),

                    // ── CTA ────────────────────────────────────
                    FilledButton(
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading
                          ? const SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Get Started →'),
                    ),

                    // ── Consent note ───────────────────────────
                    const SizedBox(height: 16),
                    Text(
                      "By continuing you agree to our Terms and Privacy Policy.\nYou'll set your data permissions in the next step.",
                      textAlign: TextAlign.center,
                      style: GoogleFonts.manrope(
                        fontSize: 11, fontWeight: FontWeight.w400,
                        color: BiotopeColors.outline, height: 1.6,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // ── Sign in link ───────────────────────────
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('Already have an account? ', style: GoogleFonts.manrope(
                        fontSize: 13, color: BiotopeColors.outline,
                      )),
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Text('Sign In →', style: GoogleFonts.manrope(
                          fontSize: 13, fontWeight: FontWeight.w600,
                          color: BiotopeColors.primary,
                        )),
                      ),
                    ]),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
