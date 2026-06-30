/// Lightweight identity object representing the currently authenticated user.
/// This is NOT the full profile — just the auth-level identity.
class UserIdentity {
  final String id;
  final String? email;
  final DateTime? lastSignInAt;

  const UserIdentity({
    required this.id,
    this.email,
    this.lastSignInAt,
  });
}
