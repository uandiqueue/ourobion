// Profile's visual shell is intentionally different from a generic centred
// avatar: the design reference uses a wide porcelain identity card with a
// decorative camellia. These source-level checks keep that composition while
// allowing the tab's real profile and preference behaviours to evolve.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  late final String source = File(
    'lib/modules/m1_core/ui/screens/profile_tab.dart',
  ).readAsStringSync();

  group('profile design alignment', () {
    test('uses the reference heading hierarchy and side gutter', () {
      expect(source.contains("'ACCOUNT'"), isTrue);
      expect(source.contains("'Profile'"), isTrue);
      expect(source.contains('EdgeInsets.fromLTRB(22, 10, 22, 40)'), isTrue);
    });

    test('renders the wide decorative identity card with existing assets', () {
      expect(source.contains('class _ProfileIdentityCard'), isTrue);
      expect(source.contains('height: 102'), isTrue);
      expect(source.contains('width: 62'), isTrue);
      expect(
        source.contains('BiotopeGeneratedAssets.profilePorcelainCamellia'),
        isTrue,
      );
      expect(
        source.contains('BiotopeGeneratedAssets.profileBotanicalCrest'),
        isTrue,
      );
    });

    test('continues to use only actual loaded identity values', () {
      expect(source.contains('heading: heading'), isTrue);
      expect(source.contains("city: profile?.city ?? ''"), isTrue);
      expect(source.contains("region: profile?.region ?? ''"), isTrue);
      expect(
        source.contains('email: accountEmail != heading ? accountEmail : null'),
        isTrue,
      );
    });
  });
}
