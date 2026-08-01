// Configuration guard: Android Gradle must stay inside the documented 16 GB Windows envelope.
// This protects the host budget without affecting Android build behaviour or CI's build stages.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('configuration guard: android Gradle memory budget', () {
    test('uses the measured serial 16 GB Windows defaults', () {
      final properties = readRepoFile('apps/biotope/android/gradle.properties');

      expect(
        properties,
        contains(
          'org.gradle.jvmargs=-Xmx1536m '
          '-XX:MaxMetaspaceSize=768m '
          '-XX:ReservedCodeCacheSize=256m '
          '-XX:+HeapDumpOnOutOfMemoryError',
        ),
      );
      expect(properties, contains('org.gradle.workers.max=1'));
      expect(properties, contains('org.gradle.parallel=false'));
      expect(
        properties,
        contains('kotlin.compiler.execution.strategy=in-process'),
      );
      expect(properties, isNot(contains('-Xmx8G')));
      expect(properties, isNot(contains('MaxMetaspaceSize=4G')));
    });
  });
}
