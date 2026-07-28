// UI gap 3 — the "Living backdrop" preference must survive an app restart.
//
// Before this, AppPreferences held a bare in-memory ValueNotifier: switching the
// backdrop off lasted until the process died. It is a DISPLAY preference, so it
// belongs on the device (shared_preferences), not in the user's Supabase data —
// these tests pin both halves of that: it persists, and it persists LOCALLY.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:src/core/app_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    AppPreferences.resetForTest();
  });

  test('defaults to on when nothing has been stored', () async {
    await AppPreferences.restore();
    expect(AppPreferences.backdropEnabled.value, isTrue);
  });

  test('a stored value is restored on launch', () async {
    SharedPreferences.setMockInitialValues({
      AppPreferences.backdropEnabledKey: false,
    });

    await AppPreferences.restore();

    expect(AppPreferences.backdropEnabled.value, isFalse,
        reason: 'restore() runs from main() before the first frame — the '
            'waking screen must already know the user turned this off');
  });

  test('setting the value writes it through to storage', () async {
    await AppPreferences.restore();

    await AppPreferences.setBackdropEnabled(false);

    final store = await SharedPreferences.getInstance();
    expect(store.getBool(AppPreferences.backdropEnabledKey), isFalse);
  });

  test('the choice survives a simulated restart', () async {
    await AppPreferences.restore();
    await AppPreferences.setBackdropEnabled(false);

    // Simulate a cold start: drop every in-memory trace, keep the store.
    AppPreferences.resetForTest();
    expect(AppPreferences.backdropEnabled.value, isTrue,
        reason: 'sanity: the notifier really was reset to the default');

    await AppPreferences.restore();

    expect(AppPreferences.backdropEnabled.value, isFalse,
        reason: 'this is the whole gap: the preference must come back');
  });

  test('the notifier updates immediately, before the write settles', () async {
    await AppPreferences.restore();

    final future = AppPreferences.setBackdropEnabled(false);
    expect(AppPreferences.backdropEnabled.value, isFalse,
        reason: 'the switch must not lag behind the tap');
    await future;
  });

  test('listeners are notified so WakingScreen repaints', () async {
    await AppPreferences.restore();
    final seen = <bool>[];
    void listener() => seen.add(AppPreferences.backdropEnabled.value);
    AppPreferences.backdropEnabled.addListener(listener);
    addTearDown(() => AppPreferences.backdropEnabled.removeListener(listener));

    await AppPreferences.setBackdropEnabled(false);
    await AppPreferences.setBackdropEnabled(true);

    expect(seen, [false, true]);
  });

  test('the storage key is namespaced and stable', () {
    // Changing this silently resets every existing install's preference.
    expect(AppPreferences.backdropEnabledKey,
        'ourobion.display.backdrop_enabled');
  });
}
