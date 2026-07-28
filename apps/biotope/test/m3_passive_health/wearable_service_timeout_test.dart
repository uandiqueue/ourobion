// Regression coverage for the Scan-tab sweep hang: a device with no wearable
// provider (e.g. Android 10 without Health Connect) never resolves
// `Health().requestAuthorization`, which — awaited inside a `Future.wait` in
// scan_tab.dart — left the sweep stuck on "Sweeping…" forever. Since the
// Scan gap card is the only route into DailyLogScreen, that made the whole
// self-report form unreachable on that device.
//
// [authorizeWithTimeout] is the fix: a bounded wrapper around the
// authorization call so a provider that never answers degrades to "not
// authorized" (the same outcome as a declined prompt) instead of hanging the
// sweep. These are plain unit tests against the pure helper — no Supabase /
// Health plugin wiring needed — using a `Completer` that is deliberately
// never completed as the exact failure mode from the field.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m3_passive_health/index.dart';

void main() {
  group('authorizeWithTimeout', () {
    test(
        'completes with false when the authorization call never resolves '
        '(the exact field failure)', () async {
      final neverResolves = Completer<bool>();

      final result = await authorizeWithTimeout(
        () => neverResolves.future,
        timeout: const Duration(milliseconds: 50),
      );

      expect(result, isFalse);
      // Nothing left pending — this future genuinely finished rather than
      // the test just moving on around it.
      expect(neverResolves.isCompleted, isFalse);
    });

    test('resolves immediately on the happy path without waiting out the '
        'timeout', () async {
      final stopwatch = Stopwatch()..start();

      final result = await authorizeWithTimeout(
        () async => true,
        timeout: const Duration(seconds: 5),
      );

      stopwatch.stop();
      expect(result, isTrue);
      expect(stopwatch.elapsed, lessThan(const Duration(seconds: 1)),
          reason: 'a fast-resolving provider must never wait out the '
              'timeout — the happy path is unaffected by this fix');
    });

    test(
        'a genuine failure is reported (not silently swallowed) and is '
        'distinguishable from a timeout', () async {
      final reported = <FlutterErrorDetails>[];
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) => reported.add(details);
      addTearDown(() => FlutterError.onError = previousOnError);

      final result = await authorizeWithTimeout(
        () => Future<bool>.error(Exception('plugin exploded')),
        timeout: const Duration(milliseconds: 50),
      );

      expect(result, isFalse);
      expect(reported, hasLength(1),
          reason: 'a genuine failure must surface through FlutterError, '
              'unlike a plain timeout, which degrades quietly');
      expect(reported.single.exception.toString(),
          contains('plugin exploded'));
    });

    test('a timeout does NOT report through FlutterError — it is the '
        'expected "nothing answered" case, not an error', () async {
      final reported = <FlutterErrorDetails>[];
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) => reported.add(details);
      addTearDown(() => FlutterError.onError = previousOnError);

      final result = await authorizeWithTimeout(
        () => Completer<bool>().future,
        timeout: const Duration(milliseconds: 50),
      );

      expect(result, isFalse);
      expect(reported, isEmpty);
    });
  });
}
