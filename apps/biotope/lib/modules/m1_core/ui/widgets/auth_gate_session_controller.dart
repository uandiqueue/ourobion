/// The small amount of durable state the root auth gate needs between
/// Supabase stream events. Keeping it free of Flutter and Supabase types makes
/// the sign-in, restored-session, sign-out, and retry transitions explicit.
enum AuthGateSessionPhase { signedOut, signedIn, recoverableError }

class AuthGateSessionController {
  AuthGateSessionController({String? initialUserId}) : _userId = initialUserId;

  String? _userId;
  Object? _error;

  String? get userId => _userId;

  AuthGateSessionPhase get phase {
    if (_error != null) return AuthGateSessionPhase.recoverableError;
    return _userId == null
        ? AuthGateSessionPhase.signedOut
        : AuthGateSessionPhase.signedIn;
  }

  /// An auth event is authoritative, including a null session on sign-out.
  void receiveSession(String? userId) {
    _userId = userId;
    _error = null;
  }

  /// Keep errors visible until the person chooses to try the stream again.
  void receiveError(Object error) {
    _error = error;
  }

  void retry() {
    _error = null;
  }
}
