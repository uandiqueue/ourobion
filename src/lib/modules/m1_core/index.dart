// app/lib/modules/m1_core/index.dart

/*
public interface (what other modules may use)

// Auth
Future<AuthResult> signIn(email, password)
Future<AuthResult> signInWithGoogle()
Future<AuthResult> signInWithApple()
Future<void> signOut()
Future<UserIdentity?> getCurrentUser()
Future<bool> verifyToken(String token)

// Profile
Future<UserProfile> getProfile(String userId)
Future<void> updateProfile(String userId, ProfileUpdate update)

// Consent
Future<ConsentRecord> getConsent(String userId)
Future<void> updateConsent(String userId, ConsentUpdate update)
bool hasConsented(ConsentRecord consent, ConsentScope scope)

// Copy enforcement
bool validateCopyString(String text)
String getCopyRule(String ruleKey)
*/

export 'impl/auth_service.dart';
export 'impl/profile_service.dart';
export 'impl/consent_service.dart';
