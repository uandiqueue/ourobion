import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/session_refresh_retry.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  const refreshRace = PostgrestException(
    message: 'JWT issued at future',
    code: 'PGRST303',
    details: 'Unauthorized',
  );

  test('retries the exact restored-session refresh race once', () async {
    var attempts = 0;
    var delayedBy = Duration.zero;

    final result = await retryAfterSessionRefresh(
      () async {
        attempts += 1;
        if (attempts == 1) throw refreshRace;
        return 'ready';
      },
      delay: (duration) async => delayedBy = duration,
    );

    expect(result, 'ready');
    expect(attempts, 2);
    expect(delayedBy, const Duration(milliseconds: 500));
  });

  test('does not retry another PostgREST authorization error', () async {
    var attempts = 0;
    const denied = PostgrestException(
      message: 'permission denied',
      code: '42501',
      details: 'Unauthorized',
    );

    await expectLater(
      retryAfterSessionRefresh(
        () async {
          attempts += 1;
          throw denied;
        },
        delay: (_) async => fail('unexpected delay'),
      ),
      throwsA(same(denied)),
    );
    expect(attempts, 1);
  });

  test('a second matching failure is rethrown instead of looping', () async {
    var attempts = 0;

    await expectLater(
      retryAfterSessionRefresh(
        () async {
          attempts += 1;
          throw refreshRace;
        },
        delay: (_) async {},
      ),
      throwsA(same(refreshRace)),
    );
    expect(attempts, 2);
  });
}
