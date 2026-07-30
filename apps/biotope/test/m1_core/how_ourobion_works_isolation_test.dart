// Source-conformance guard: the explainer screen and its Home teaser card
// must stay free of services, network access and Supabase, since that is
// what lets them be pumped in a widget test with no mocking at all — unlike
// HomeTab, which reaches for Supabase.instance.client directly and cannot be
// pumped. This test reads the .dart source as plain text rather than
// constructing the widgets, so it also works as a static proof independent
// of the widget tests above.
//
// The substring checks below are deliberately narrow (e.g. `_service.dart`,
// `import 'dart:io'`) rather than bare words like "service", so a legitimate
// doc-comment sentence ("no services are called here") cannot trip the gate
// by accident — only a real dependency does.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  late final String screenSource = File(
    'lib/modules/m1_core/ui/screens/how_ourobion_works_screen.dart',
  ).readAsStringSync();
  late final String cardSource = File(
    'lib/modules/m1_core/ui/widgets/about_biotope_card.dart',
  ).readAsStringSync();
  late final String homeSource = File(
    'lib/modules/m1_core/ui/screens/home_tab.dart',
  ).readAsStringSync();

  group('the explainer screen has no service/network dependency', () {
    test('no supabase import or reference', () {
      expect(screenSource.toLowerCase().contains('supabase'), isFalse);
    });

    test('no *_service.dart import and no Service class reference', () {
      expect(screenSource.contains('_service.dart'), isFalse);
      expect(screenSource.contains('Service'), isFalse);
    });

    test('no http and no dart:io', () {
      expect(screenSource.contains('http'), isFalse);
      expect(screenSource.contains("import 'dart:io'"), isFalse);
    });
  });

  group('the About Biotope card has no service/network dependency', () {
    test('no supabase import or reference', () {
      expect(cardSource.toLowerCase().contains('supabase'), isFalse);
    });

    test('no *_service.dart import and no Service class reference', () {
      expect(cardSource.contains('_service.dart'), isFalse);
      expect(cardSource.contains('Service'), isFalse);
    });

    test('no http and no dart:io', () {
      expect(cardSource.contains('http'), isFalse);
      expect(cardSource.contains("import 'dart:io'"), isFalse);
    });
  });

  group('Home is actually wired to the new surfaces', () {
    // HomeTab cannot be pumped in a widget test (it calls Supabase.instance
    // directly with no injection seam), so source-string assertion is the
    // only way to prove the wiring exists.
    test('references AboutBiotopeCard', () {
      expect(homeSource.contains('AboutBiotopeCard'), isTrue);
    });

    test('references HowOurobionWorksScreen', () {
      expect(homeSource.contains('HowOurobionWorksScreen'), isTrue);
    });
  });
}
