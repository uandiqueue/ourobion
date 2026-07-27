import 'package:flutter/foundation.dart';

/// Session-only (not persisted across app restarts — no local-storage
/// dependency added for this scaffold pass) local preferences. Toggled from
/// the Profile tab. `backdropEnabled` actually affects [WakingScreen]'s
/// rendering; there is no real "digest" backend concept yet (no matching
/// ConsentScope/profile column — see the reskin session log), so that
/// toggle is UI-only for now.
abstract final class AppPreferences {
  static final backdropEnabled = ValueNotifier<bool>(true);
}
