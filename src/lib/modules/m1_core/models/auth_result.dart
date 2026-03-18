/// Represents the result of an authentication operation.
class AuthResult {
  final bool success;
  final String? userId;
  final String? errorMessage;

  const AuthResult._({
    required this.success,
    this.userId,
    this.errorMessage,
  });

  /// Create a successful auth result.
  factory AuthResult.success(String userId) {
    return AuthResult._(success: true, userId: userId);
  }

  /// Create a failed auth result with an error message.
  factory AuthResult.failure(String errorMessage) {
    return AuthResult._(success: false, errorMessage: errorMessage);
  }
}
