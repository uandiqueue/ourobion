// Metric-aware trend axes — the policy in ui/widgets/metric_trend_section.dart
// (`trendAxisTicks`, `trendAxisBounds`, `trendAxisLabel`), held against
// shared/metrics/registry.dart.
//
// The bug class this pins: chart_math's 1/2/5 nice-number ladder is
// metric-agnostic, so an ordinal series (Bristol stool form, integer types 1..7)
// would get gridlines and a label at 2.5. There is no Bristol type 2.5 — that
// number is an interpolation of the user's own log presented as if it were a
// reading. Ordinal metrics must therefore tick on whole numbers over their
// DECLARED registry scale, and continuous metrics must keep the numeric ladder
// and state their registry unit.
//
// Ordinal-vs-continuous is DERIVED here by parsing the registry (`type`,
// `scale`, `ui.inputType`, `unit`, `status`, `baselineApplicable`), not by
// restating a list — the same source-parsing technique as test/guards/*, so
// registry drift fails this suite instead of silently changing what a chart
// claims. Neither source can be imported from lib/: shared/metrics/registry.dart
// is a cross-language parity mirror rather than a package dependency, and the
// axis policy is a switch inside a widget file.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/chart_math.dart';
import 'package:src/modules/m5a_baselines/impl/metric_value_format.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';

/// Input types whose values are whole steps by construction — there is no half
/// a Bristol type, half a likert point, half a stool or half a mosquito bite.
/// Matched as prefixes so `stepper_0_10` and `stepper_0_20` are both covered.
const kWholeStepInputPrefixes = <String>[
  'armstrong_',
  'bristol_',
  'likert_',
  'segmented_',
  'stepper_',
];

/// The two ordinal scales whose axis labels carry the scale's own vocabulary
/// (Armstrong shades, Bristol forms) rather than a bare number.
const kCategoryLabelledOrdinals = <String>{'urine_colour', 'stool_form'};

/// Walk up to the repo root — the first ancestor holding both `shared/` and
/// `supabase/`. (Duplicated from test/guards/guard_support.dart rather than
/// imported, so this suite has no cross-directory test dependency.)
Directory _repoRoot() {
  var dir = Directory.current;
  for (var i = 0; i < 8; i++) {
    if (Directory('${dir.path}/shared').existsSync() &&
        Directory('${dir.path}/supabase').existsSync()) {
      return dir;
    }
    final parent = dir.parent;
    if (parent.path == dir.path) break;
    dir = parent;
  }
  throw StateError('repo root not found from ${Directory.current.path}');
}

String _readRepoFile(String relPath) =>
    File('${_repoRoot().path}/$relPath').readAsStringSync();

/// One registry entry's axis-relevant fields, parsed from registry.dart.
class _Entry {
  _Entry({
    required this.type,
    required this.inputType,
    required this.scaleMin,
    required this.scaleMax,
    required this.unit,
    required this.baselineApplicable,
    required this.status,
  });

  final String type;
  final String? inputType;
  final double? scaleMin;
  final double? scaleMax;
  final String? unit;
  final bool baselineApplicable;
  final String status;

  bool get isActiveCharted => status == 'active' && baselineApplicable;

  /// A bounded ordinal: the registry says `type: 'ordinal'` AND declares the
  /// scale the axis would have to span.
  bool get isOrdinalByType =>
      type == 'ordinal' && scaleMin != null && scaleMax != null;

  /// A whole-step quantity by its input control, whatever `type` says — counts
  /// (`stepper_*`) and segmented pickers included.
  bool get isWholeStepByInput =>
      inputType != null &&
      kWholeStepInputPrefixes.any((p) => inputType!.startsWith(p));
}

/// Split registry.dart into per-metric blocks and pull out what the axis needs.
Map<String, _Entry> _parseRegistry(String source) {
  final keyRe = RegExp(r"key:\s*'([a-z0-9_]+)'");
  final matches = keyRe.allMatches(source).toList();
  final out = <String, _Entry>{};
  for (var i = 0; i < matches.length; i++) {
    final end = (i + 1 < matches.length) ? matches[i + 1].start : source.length;
    final block = source.substring(matches[i].start, end);
    final scale = RegExp(
      r'MetricScale\(min:\s*(-?[\d.]+),\s*max:\s*(-?[\d.]+)\)',
    ).firstMatch(block);
    out[matches[i].group(1)!] = _Entry(
      // Lookbehind so `inputType:` cannot be mistaken for the `type:` field.
      type:
          RegExp(
            r"(?<![A-Za-z])type:\s*'([a-z_]+)'",
          ).firstMatch(block)?.group(1) ??
          '',
      inputType: RegExp(
        r"inputType:\s*'([a-z0-9_]+)'",
      ).firstMatch(block)?.group(1),
      scaleMin: scale == null ? null : double.parse(scale.group(1)!),
      scaleMax: scale == null ? null : double.parse(scale.group(2)!),
      unit: RegExp(
        r"(?<![A-Za-z])unit:\s*'([^']+)'",
      ).firstMatch(block)?.group(1),
      baselineApplicable:
          RegExp(
            r'baselineApplicable:\s*(true|false)',
          ).firstMatch(block)?.group(1) ==
          'true',
      status:
          RegExp(r"status:\s*'([a-z]+)'").firstMatch(block)?.group(1) ?? '',
    );
  }
  return out;
}

/// The metric keys `trendAxisTicks` special-cases, read out of its own switch
/// so this suite cannot drift from the implementation it is guarding.
Set<String> _axisAwareKeys(String widgetSource) {
  const startMarker = 'List<double> trendAxisTicks';
  const endMarker = 'ValueBounds trendAxisBounds';
  final start = widgetSource.indexOf(startMarker);
  final end = widgetSource.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw StateError('trendAxisTicks switch not found in metric_trend_section');
  }
  final body = widgetSource.substring(start, end);
  return RegExp(
    r"'([a-z0-9_]+)'",
  ).allMatches(body).map((m) => m.group(1)!).toSet();
}

/// A probe window that would land on a fractional 1/2/5 tick if the metric were
/// not axis-aware — niceTicks(1..2) is [1, 1.5, 2].
const _fractionalProbe = <double>[1, 2];

void main() {
  late Map<String, _Entry> registry;
  late Set<String> axisAware;
  late Map<String, _Entry> charted;

  setUpAll(() {
    registry = _parseRegistry(_readRepoFile('shared/metrics/registry.dart'));
    axisAware = _axisAwareKeys(
      _readRepoFile(
        'apps/biotope/lib/modules/m5a_baselines/ui/widgets/'
        'metric_trend_section.dart',
      ),
    );
    charted = {
      for (final e in registry.entries)
        if (e.value.isActiveCharted) e.key: e.value,
    };
    expect(registry, isNotEmpty, reason: 'the registry parse found nothing');
    expect(axisAware, isNotEmpty, reason: 'the axis switch parse found nothing');
  });

  group('the derivation itself is grounded in the registry', () {
    test('the probe window really is fractional under the plain ladder', () {
      // Everything below rests on this: without a metric-aware axis, a 1..2
      // window produces a 1.5 gridline.
      expect(niceTicks(valueBounds(_fractionalProbe)), [1.0, 1.5, 2.0]);
    });

    test('every whole-step input prefix is one the registry actually uses', () {
      final used = {
        for (final e in registry.values)
          if (e.inputType != null) e.inputType!,
      };
      for (final prefix in kWholeStepInputPrefixes) {
        expect(
          used.any((t) => t.startsWith(prefix)),
          isTrue,
          reason:
              '$prefix is no longer an input type in the registry — the '
              'ordinal derivation is matching on a dead string',
        );
      }
    });

    test('the registry still declares the two clinical ordinal scales', () {
      // Armstrong 1..8 and Bristol 1..7 are the scales #268 named.
      expect(registry['urine_colour']!.type, 'ordinal');
      expect(registry['urine_colour']!.inputType, 'armstrong_1_8');
      expect(registry['urine_colour']!.scaleMin, 1);
      expect(registry['urine_colour']!.scaleMax, 8);
      expect(registry['stool_form']!.type, 'ordinal');
      expect(registry['stool_form']!.inputType, 'bristol_1_7');
      expect(registry['stool_form']!.scaleMin, 1);
      expect(registry['stool_form']!.scaleMax, 7);
    });
  });

  group('ordinal coverage is complete for registry ordinal metrics', () {
    test('every charted registry ordinal has a metric-aware axis', () {
      final ordinals = {
        for (final e in charted.entries)
          if (e.value.isOrdinalByType) e.key,
      };
      expect(ordinals, isNotEmpty);
      expect(
        ordinals.difference(axisAware),
        isEmpty,
        reason:
            'these registry `type: ordinal` metrics fall through to the '
            'metric-agnostic 1/2/5 ladder and can be drawn at a value the '
            'user never logged',
      );
    });

    test('every axis-aware key is a charted registry metric with a scale', () {
      for (final key in axisAware) {
        final entry = registry[key];
        expect(entry, isNotNull, reason: '$key is not in the registry');
        expect(
          entry!.isActiveCharted,
          isTrue,
          reason: '$key is a stale axis policy — it cannot reach a chart',
        );
        expect(
          entry.scaleMin,
          isNotNull,
          reason: '$key has a fixed axis but no declared scale to fix it to',
        );
        expect(entry.scaleMax, isNotNull, reason: '$key scale.max');
        expect(
          entry.isOrdinalByType || entry.isWholeStepByInput,
          isTrue,
          reason:
              '$key is pinned to whole categories but the registry calls it '
              'neither ordinal nor a whole-step input',
        );
      }
    });
  });

  group('ordinal ticks are integers over the DECLARED registry scale', () {
    test('no tick is fractional, for any data window', () {
      for (final key in axisAware) {
        for (final values in const [
          _fractionalProbe,
          <double>[4, 4],
          <double>[0, 1, 2],
          <double>[2.5, 3.5],
        ]) {
          final ticks = trendAxisTicks(key, values);
          expect(ticks, isNotEmpty, reason: key);
          for (final t in ticks) {
            expect(
              t,
              t.roundToDouble(),
              reason: '$key drew a fractional gridline at $t for $values',
            );
          }
        }
      }
    });

    test('ticks span exactly the registry scale, end to end', () {
      for (final key in axisAware) {
        final entry = registry[key]!;
        final ticks = trendAxisTicks(key, _fractionalProbe);
        expect(ticks.first, entry.scaleMin, reason: '$key first tick');
        expect(ticks.last, entry.scaleMax, reason: '$key last tick');
        for (final t in ticks) {
          expect(t, greaterThanOrEqualTo(entry.scaleMin!), reason: key);
          expect(t, lessThanOrEqualTo(entry.scaleMax!), reason: key);
        }
      }
    });

    test('the axis is never narrowed or widened by the data window', () {
      // A week where the user only ever logged one value must still show the
      // whole scale — otherwise a flat week reads as a full-range week. And a
      // corrupt out-of-scale row must not stretch the declared scale either.
      for (final key in axisAware) {
        final entry = registry[key]!;
        for (final values in const [
          <double>[4, 4],
          _fractionalProbe,
          <double>[-3, 99],
        ]) {
          final bounds = trendAxisBounds(
            key,
            values,
            trendAxisTicks(key, values),
          );
          expect(bounds.min, entry.scaleMin, reason: '$key min for $values');
          expect(bounds.max, entry.scaleMax, reason: '$key max for $values');
        }
      }
    });

    test('no axis label is an interpolated number', () {
      for (final key in axisAware) {
        for (final t in trendAxisTicks(key, _fractionalProbe)) {
          expect(
            trendAxisLabel(key, t),
            isNot(contains('.')),
            reason:
                '$key labelled a tick with a decimal — an interpolated '
                'ordinal label is a value the user never logged',
          );
        }
      }
      // Even if a fractional value were forced through, a named clinical scale
      // labels the whole category rather than inventing a half-step.
      for (final key in kCategoryLabelledOrdinals) {
        expect(trendAxisLabel(key, 2.5), isNot(contains('.')), reason: key);
      }
    });
  });

  group('ordinal axes say what scale they are on', () {
    test('exactly the clinical scales carry category words', () {
      final lettered = {
        for (final key in axisAware)
          if (trendAxisTicks(key, _fractionalProbe).any(
            (t) => RegExp('[A-Za-z]').hasMatch(trendAxisLabel(key, t)),
          ))
            key,
      };
      expect(
        lettered,
        kCategoryLabelledOrdinals,
        reason:
            'Armstrong and Bristol are the named clinical scales; a bare '
            'number on either is unreadable, and a word on a likert or a '
            'count would be an invented category name',
      );
    });

    test('both ends of each clinical scale are named, not just numbered', () {
      for (final key in kCategoryLabelledOrdinals) {
        final entry = registry[key]!;
        for (final tick in [entry.scaleMin!, entry.scaleMax!]) {
          final label = trendAxisLabel(key, tick);
          expect(
            label,
            contains(tick.round().toString()),
            reason: '$key must keep the ordinal value on the axis',
          );
          expect(
            RegExp('[A-Za-z]').hasMatch(label),
            isTrue,
            reason: '$key tick $tick reads "$label" — the scale endpoint has '
                'to say what it means',
          );
        }
      }
    });
  });

  group('continuous axes keep numeric ticks and carry their unit', () {
    test('a metric with a registry unit states that exact unit', () {
      final withUnit = {
        for (final e in charted.entries)
          if (e.value.unit != null) e.key: e.value.unit!,
      };
      expect(withUnit, isNotEmpty);
      for (final entry in withUnit.entries) {
        for (final values in const [
          <double>[10, 20],
          <double>[36.4, 37.1],
          _fractionalProbe,
        ]) {
          for (final t in trendAxisTicks(entry.key, values)) {
            expect(
              trendAxisLabel(entry.key, t),
              endsWith(entry.value),
              reason:
                  '${entry.key} must render the registry unit '
                  '"${entry.value}" — a bare number silently mixes units',
            );
          }
        }
      }
    });

    test('a continuous metric with no registry unit invents none', () {
      final bare = {
        for (final e in charted.entries)
          if (e.value.unit == null && !axisAware.contains(e.key)) e.key,
      };
      expect(bare, isNotEmpty);
      for (final key in bare) {
        for (final t in trendAxisTicks(key, const [10, 20])) {
          expect(
            trendAxisLabel(key, t),
            compactValueLabel(t),
            reason: '$key must stay a plain number, never a guessed unit',
          );
        }
      }
    });

    test('continuous metrics keep the existing 1/2/5 ladder unchanged', () {
      for (final key in charted.keys) {
        if (axisAware.contains(key)) continue;
        for (final values in const [
          <double>[38, 71],
          <double>[360, 420],
          _fractionalProbe,
        ]) {
          final bounds = valueBounds(values);
          expect(
            trendAxisTicks(key, values),
            niceTicks(bounds),
            reason: '$key must not have been quietly moved off the ladder',
          );
        }
      }
    });

    test('continuous bounds still cover the real data', () {
      for (final key in charted.keys) {
        if (axisAware.contains(key)) continue;
        const values = <double>[38, 71];
        final ticks = trendAxisTicks(key, values);
        final bounds = trendAxisBounds(key, values, ticks);
        expect(bounds.min, lessThanOrEqualTo(38), reason: key);
        expect(bounds.max, greaterThanOrEqualTo(71), reason: key);
      }
    });

    test('the value suffix agrees with the registry unit where both exist', () {
      // metric_value_format.metricValueSuffix drives the detail screen's
      // headline suffix; where it names a real registry unit it must be the
      // SAME unit the axis draws, or one screen contradicts the other.
      for (final entry in charted.entries) {
        final suffix = metricValueSuffix(entry.key);
        final unit = entry.value.unit;
        if (suffix == null || unit == null) continue;
        expect(suffix, unit, reason: '${entry.key} unit disagreement');
      }
    });
  });

  group('KNOWN GAP (#268) — whole-step counts outside the axis switch', () {
    test('the uncovered whole-step metrics are exactly the recorded set', () {
      // DOCUMENTED, NOT ENDORSED. These registry metrics are whole steps by
      // their input control (there is no half a stool) but are not in
      // trendAxisTicks' switch, so they inherit the metric-agnostic 1/2/5
      // ladder and can be drawn at a fractional value the user never logged.
      //
      // If this set GROWS, a new whole-step metric has silently inherited the
      // same defect. If it becomes EMPTY, the gap has been fixed — delete this
      // group and let the ordinal-coverage guards above carry the metric.
      final uncovered = {
        for (final e in charted.entries)
          if (e.value.isWholeStepByInput && !axisAware.contains(e.key)) e.key,
      };
      expect(
        uncovered,
        {'stool_count'},
        reason:
            'stool_count is registry `numeric` with `stepper_0_10`; the axis '
            'switch covers its sibling mosquito_bites (stepper_0_20) but not '
            'it. Reported against #282, not fixed here.',
      );
    });

    test('the consequence, made visible', () {
      // The concrete defect the set above stands for.
      final ticks = trendAxisTicks('stool_count', _fractionalProbe);
      expect(
        ticks.any((t) => t != t.roundToDouble()),
        isTrue,
        reason:
            'if this no longer holds, stool_count has become axis-aware — '
            'remove this whole group',
      );
      expect(
        ticks.map((t) => trendAxisLabel('stool_count', t)),
        contains('1.5'),
        reason: 'there is no such thing as 1.5 stools in a day',
      );
    });
  });
}
