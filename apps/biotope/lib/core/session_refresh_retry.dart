import 'package:supabase_flutter/supabase_flutter.dart';

/// Runs an authenticated read again once when PostgREST catches the brief
/// boundary between a restored session and its refreshed access token.
///
/// Only the exact PGRST303 clock-boundary response is retryable. All other
/// authorization and data errors are rethrown unchanged, and a second matching
/// failure is also rethrown, so this never becomes an authorization bypass or
/// an unbounded retry loop.
Future<T> retryAfterSessionRefresh<T>(
  Future<T> Function() operation, {
  Future<void> Function(Duration)? delay,
}) async {
  try {
    return await operation();
  } on PostgrestException catch (error) {
    if (error.code != 'PGRST303' || error.message != 'JWT issued at future') {
      rethrow;
    }
    await (delay ?? Future<void>.delayed)(const Duration(milliseconds: 500));
    return operation();
  }
}
