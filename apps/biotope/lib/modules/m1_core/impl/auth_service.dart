import 'package:supabase_flutter/supabase_flutter.dart' hide UserIdentity;
import '../models/auth_result.dart';
import '../models/user_identity.dart';

/// M1 Authentication Service — wraps Supabase Auth.
///
/// All other modules should depend on the public interface defined in
/// index.dart, not on this implementation directly.
class AuthService {
  final SupabaseClient _client;

  AuthService(this._client);

  // ─── Email / Password ───────────────────────────────────────────

  /// Sign in with email and password.
  Future<AuthResult> signIn(String email, String password) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      final userId = response.user?.id;
      if (userId == null) return AuthResult.failure('Sign-in returned no user.');
      return AuthResult.success(userId);
    } on AuthException catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('Unexpected error: $e');
    }
  }

  /// Register a new user with email and password.
  Future<AuthResult> signUp(String email, String password) async {
    try {
      final response = await _client.auth.signUp(
        email: email,
        password: password,
      );
      final userId = response.user?.id;
      if (userId == null) return AuthResult.failure('Sign-up returned no user.');
      return AuthResult.success(userId);
    } on AuthException catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('Unexpected error: $e');
    }
  }

  // ─── OAuth (placeholders — require Supabase dashboard config) ──

  /// Sign in with Google OAuth.
  /// Returns [AuthResult.pending] on successful redirect launch — the real
  /// session arrives via [onAuthStateChange], not this return value.
  Future<AuthResult> signInWithGoogle() async {
    try {
      await _client.auth.signInWithOAuth(OAuthProvider.google);
      return AuthResult.pending();
    } on AuthException catch (e) {
      return AuthResult.failure(e.message);
    }
  }

  /// Sign in with Apple.
  /// Returns [AuthResult.pending] on successful redirect launch — the real
  /// session arrives via [onAuthStateChange], not this return value.
  Future<AuthResult> signInWithApple() async {
    try {
      await _client.auth.signInWithOAuth(OAuthProvider.apple);
      return AuthResult.pending();
    } on AuthException catch (e) {
      return AuthResult.failure(e.message);
    }
  }

  // ─── Session helpers ────────────────────────────────────────────

  /// Sign out the current user.
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Get the currently authenticated user, or null if not signed in.
  UserIdentity? getCurrentUser() {
    final user = _client.auth.currentUser;
    if (user == null) return null;
    return UserIdentity(
      id: user.id,
      email: user.email,
      lastSignInAt: user.lastSignInAt != null
          ? DateTime.tryParse(user.lastSignInAt!)
          : null,
    );
  }

  /// Verify whether the current session token is still valid.
  Future<bool> verifyToken(String token) async {
    try {
      final session = _client.auth.currentSession;
      return session != null && session.accessToken == token;
    } catch (_) {
      return false;
    }
  }

  /// Stream of auth state changes (login, logout, token refresh).
  Stream<AuthState> get onAuthStateChange =>
      _client.auth.onAuthStateChange;
}
