import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device-local display preferences, persisted across app restarts.
///
/// These are deliberately NOT user data: they describe how *this install*
/// renders, never anything the person logged, so they live in the device's own
/// key/value store and are never written to Supabase. Nothing server-side
/// reads them, and signing in on another device starts from the default.
///
/// [backdropEnabled] drives the drifting-orb animation on `WakingScreen`.
///
/// The account-level "daily digest" preference is intentionally NOT here — it
/// is a real `profiles.daily_digest_enabled` column written through
/// `ProfileService`, because it is account state rather than a device setting.
abstract final class AppPreferences {
  /// Storage key, namespaced so it cannot collide with a plugin's own keys.
  /// Renaming it silently resets everyone's preference — treat it as a
  /// contract, not an implementation detail.
  @visibleForTesting
  static const backdropEnabledKey = 'ourobion.display.backdrop_enabled';

  /// Value shown before [restore] has run and whenever nothing is stored yet.
  static const backdropEnabledDefault = true;

  static final backdropEnabled = ValueNotifier<bool>(backdropEnabledDefault);

  static SharedPreferences? _store;

  /// Reads the persisted value into [backdropEnabled]. Called once from
  /// `main()` before `runApp`, so the first frame already reflects the user's
  /// last choice instead of flashing the default.
  static Future<void> restore() async {
    final store = await SharedPreferences.getInstance();
    _store = store;
    backdropEnabled.value =
        store.getBool(backdropEnabledKey) ?? backdropEnabledDefault;
  }

  /// Sets the value and persists it. The notifier updates first so the switch
  /// never lags behind the tap; the write is device-local, so unlike a profile
  /// write it has no network failure mode to report back to the user.
  static Future<void> setBackdropEnabled(bool value) async {
    backdropEnabled.value = value;
    final store = _store ??= await SharedPreferences.getInstance();
    await store.setBool(backdropEnabledKey, value);
  }

  /// Test seam: drops the cached store and the in-memory value so a following
  /// [restore] genuinely re-reads from storage.
  @visibleForTesting
  static void resetForTest() {
    _store = null;
    backdropEnabled.value = backdropEnabledDefault;
  }
}
