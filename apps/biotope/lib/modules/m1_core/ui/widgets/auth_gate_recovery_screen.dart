import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';

abstract final class AuthGateRecoveryCopy {
  static const title = 'Something needs another try';
  static const body = 'Check your connection and try again.';
  static const retry = 'Try again';

  static const all = [title, body, retry];
}

/// A recoverable replacement for a failed auth or onboarding wait.
class AuthGateRecoveryScreen extends StatelessWidget {
  final VoidCallback onRetry;

  const AuthGateRecoveryScreen({super.key, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: OurobionColors.surfaceCard,
                borderRadius: BorderRadius.circular(kCardRadius),
                border: Border.all(color: OurobionColors.outlineVariant),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.refresh_rounded,
                    color: OurobionColors.primary,
                    size: 30,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    AuthGateRecoveryCopy.title,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.manrope(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    AuthGateRecoveryCopy.body,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.manrope(
                      fontSize: 13,
                      height: 1.5,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: onRetry,
                    child: const Text(AuthGateRecoveryCopy.retry),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
