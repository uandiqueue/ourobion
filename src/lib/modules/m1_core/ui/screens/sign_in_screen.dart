import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../../core/theme.dart';
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
                    Text('Your health, your ecosystem.', style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w400,
                      color: BiotopeColors.outline,
                    )),

                    const SizedBox(height: 40),

                    // ── Eyebrow ────────────────────────────────
                    Text('WELCOME BACK', style: GoogleFonts.manrope(
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
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Password',
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: BiotopeColors.outline,
                          ),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
                    ),

                    // ── Forgot password ────────────────────────
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          foregroundColor: BiotopeColors.outline,
                          textStyle: GoogleFonts.manrope(fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                        child: const Text('Forgot password?'),
                      ),
                    ),

                    // ── Error ──────────────────────────────────
                    if (_error != null) ...[
                      const SizedBox(height: 4),
                      Text(_error!, style: GoogleFonts.manrope(
                        fontSize: 13, color: Theme.of(context).colorScheme.error,
                      )),
                      const SizedBox(height: 8),
                    ],

                    const SizedBox(height: 8),

                    // ── CTA ────────────────────────────────────
                    FilledButton(
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading
                          ? const SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Sign In →'),
                    ),

                    const SizedBox(height: 28),

                    // ── Divider ────────────────────────────────
                    Row(children: [
                      const Expanded(child: Divider(color: BiotopeColors.outlineVariant)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text('or', style: GoogleFonts.manrope(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: BiotopeColors.outline,
                        )),
                      ),
                      const Expanded(child: Divider(color: BiotopeColors.outlineVariant)),
                    ]),

                    const SizedBox(height: 20),

                    // ── Sign up link ───────────────────────────
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text("No account? ", style: GoogleFonts.manrope(
                        fontSize: 13, color: BiotopeColors.outline,
                      )),
                      GestureDetector(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) =>
                            SignUpScreen(authService: widget.authService)),
                        ),
                        child: Text('Create one →', style: GoogleFonts.manrope(
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
