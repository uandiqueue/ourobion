/// Represents the result of an authentication operation.
class AuthResult {
  final bool success;
  /// True when an OAuth redirect has been launched and the session outcome
  /// is pending — not a failure, just async.
  final bool pending;
  final String? userId;
  final String? errorMessage;

  const AuthResult._({
    required this.success,
    this.pending = false,
    this.userId,
    this.errorMessage,
  });

  factory AuthResult.success(String userId) {
    return AuthResult._(success: true, userId: userId);
  }

  factory AuthResult.failure(String errorMessage) {
    return AuthResult._(success: false, errorMessage: errorMessage);
  }

  /// OAuth redirect launched; session will arrive via onAuthStateChange.
  factory AuthResult.pending() {
    return AuthResult._(success: false, pending: true);
  }
}
