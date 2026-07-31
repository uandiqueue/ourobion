// Metric-aware trend axes — the policy in ui/widgets/metric_trend_section.dart
// (`trendAxisTicks`, `trendAxisBounds`, `trendAxisLabel`), held against
// shared/metrics/lib/src/registry.dart.
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
// claims. Neither source can be imported from lib/: the registry at
// shared/metrics/lib/src/registry.dart is a cross-language parity mirror rather
// than a package dependency, and the axis policy is a switch inside a widget
// file.

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
    required this.valueStep,
    required this.unit,
    required this.baselineApplicable,
    required this.status,
  });

  final String type;
  final String? inputType;
  final double? scaleMin;
  final double? scaleMax;
  final double? valueStep;
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

  /// The registry declares the smallest legal increment, so the axis can be
  /// aligned to it instead of to a metric-agnostic 1/2/5 ladder.
  bool get declaresValueStep => valueStep != null;

  /// …and declares the scale that increment runs over, so the axis can be fixed
  /// to the whole scale rather than to whatever the data window happened to be.
  bool get declaresBoundedSteps =>
      declaresValueStep && scaleMin != null && scaleMax != null;
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
      valueStep: double.tryParse(
        RegExp(r'valueStep:\s*(-?[\d.]+)').firstMatch(block)?.group(1) ?? '',
      ),
      unit: RegExp(
        r"(?<![A-Za-z])unit:\s*'([^']+)'",
      ).firstMatch(block)?.group(1),
      baselineApplicable:
          RegExp(
            r'baselineApplicable:\s*(true|false)',
          ).firstMatch(block)?.group(1) ==
          'true',
      status: RegExp(r"status:\s*'([a-z]+)'").firstMatch(block)?.group(1) ?? '',
    );
  }
  return out;
}

/// The source of `trendAxisTicks` + `trendAxisBounds`, so this suite can assert
/// HOW the axis decides as well as what it draws.
String _axisPolicySource(String widgetSource) {
  const startMarker = 'List<double> trendAxisTicks';
  const endMarker = 'String trendAxisLabel';
  final start = widgetSource.indexOf(startMarker);
  final end = widgetSource.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw StateError('the axis policy was not found in metric_trend_section');
  }
  return widgetSource.substring(start, end);
}

/// Registry metric keys named as literals inside the axis policy. #268 filed
/// the hardcoded switch as the defect, and #285 replaced it with registry
/// lookups, so this set must now be EMPTY — a key reappearing here means a
/// metric was special-cased in the chart instead of described in the registry.
/// Intersected with the registry so ordinary strings (`'ordinal'`) do not count.
Set<String> _hardcodedMetricKeys(
  String axisPolicySource,
  Iterable<String> registryKeys,
) => RegExp(r"'([a-z][a-z0-9_]{2,})'")
    .allMatches(axisPolicySource)
    .map((m) => m.group(1)!)
    .where(registryKeys.contains)
    .toSet();

/// A probe window that would land on a fractional 1/2/5 tick if the metric were
/// not axis-aware — niceTicks(1..2) is [1, 1.5, 2].
const _fractionalProbe = <double>[1, 2];

void main() {
  late Map<String, _Entry> registry;
  late Map<String, _Entry> charted;
  late String axisPolicySource;

  /// Charted metrics the registry declares a value increment for. #285 made
  /// this — not a list of keys in the chart — what decides whether an axis is
  /// step-aligned, so it is what this suite derives its expectations from.
  late Set<String> stepAligned;

  /// …and of those, the ones that also declare the scale the increment runs
  /// over, whose axis is therefore fixed to the scale rather than to the data.
  late Set<String> scalePinned;

  setUpAll(() {
    registry = _parseRegistry(
      _readRepoFile('shared/metrics/lib/src/registry.dart'),
    );
    axisPolicySource = _axisPolicySource(
      _readRepoFile(
        'apps/biotope/lib/modules/m5a_baselines/ui/widgets/'
        'metric_trend_section.dart',
      ),
    );
    charted = {
      for (final e in registry.entries)
        if (e.value.isActiveCharted) e.key: e.value,
    };
    stepAligned = {
      for (final e in charted.entries)
        if (e.value.declaresValueStep) e.key,
    };
    scalePinned = {
      for (final e in charted.entries)
        if (e.value.declaresBoundedSteps) e.key,
    };
    expect(registry, isNotEmpty, reason: 'the registry parse found nothing');
    expect(
      axisPolicySource,
      isNotEmpty,
      reason: 'the axis policy parse found nothing',
    );
    expect(stepAligned, isNotEmpty, reason: 'no metric declares a valueStep');
    expect(scalePinned, isNotEmpty);
  });

  group('the derivation itself is grounded in the registry', () {
    test('the probe window really is fractional under the plain ladder', () {
      // Everything below rests on this: without a metric-aware axis, a 1..2
      // window produces a 1.5 gridline.
      expect(niceTicks(valueBounds(_fractionalProbe)), [1.0, 1.5, 2.0]);
    });

    test('the axis policy names no metric key of its own (#268 → #285)', () {
      // The original defect this suite recorded was that `trendAxisTicks` was a
      // hardcoded metric-key switch, so every newly registered metric silently
      // inherited the metric-agnostic ladder. #285 replaced it with registry
      // lookups. This is what keeps that fix from being undone one special case
      // at a time.
      expect(
        _hardcodedMetricKeys(axisPolicySource, registry.keys),
        isEmpty,
        reason:
            'a metric named in the axis policy is a metric whose axis stops '
            'following its registry declaration',
      );
      expect(
        axisPolicySource,
        contains('metricByKey('),
        reason: 'the axis must read the metric it is drawing from the registry',
      );
      expect(
        axisPolicySource,
        contains('valueStep'),
        reason:
            'the registry\'s declared increment is what makes an axis '
            'step-aligned instead of 1/2/5',
      );
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

      // This assertion carried an allowance while the axis was a hardcoded
      // switch: the five likert_1_5 wellbeing scores PR #274 added were
      // `type: ordinal`, were charted, and were not in the switch, so each
      // inherited the metric-agnostic 1/2/5 ladder and could be drawn at 3.5 on
      // a scale whose only legal values are 1..5. #285 made the axis read the
      // registry, which covers every ordinal by construction, so the allowance
      // is gone and this now carries all of them.
      expect(
        ordinals.difference(scalePinned),
        isEmpty,
        reason:
            'these registry `type: ordinal` metrics fall through to the '
            'metric-agnostic 1/2/5 ladder and can be drawn at a value the '
            'user never logged',
      );
    });

    test('every scale-pinned key is a charted whole-step registry metric', () {
      for (final key in scalePinned) {
        final entry = registry[key]!;
        expect(
          entry.isActiveCharted,
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
          entry.isOrdinalByType ||
              entry.isWholeStepByInput ||
              entry.type == 'numeric',
          isTrue,
          reason:
              '$key is pinned to whole steps but the registry calls it neither '
              'ordinal, a whole-step input, nor numeric',
        );
      }
    });
  });

  group('ordinal ticks are integers over the DECLARED registry scale', () {
    test('no tick is fractional, for any data window', () {
      for (final key in stepAligned) {
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
      for (final key in scalePinned) {
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
      for (final key in scalePinned) {
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
      for (final key in stepAligned) {
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
      // `trendAxisLabel` formats a tick supplied by `trendAxisTicks`; it is not
      // a second bounds or step validator. The loop above therefore proves the
      // user-visible contract on every tick the axis can actually emit, rather
      // than injecting an impossible half-step that bypasses the registry-led
      // tick policy.
    });
  });

  group('ordinal axes say what scale they are on', () {
    test('exactly the clinical scales carry category words', () {
      // A registry unit is not a category name, so it is removed before asking
      // whether the label carries a word — otherwise `step_count` ("4 steps")
      // would read as a named scale.
      bool namesACategory(String key, double tick) {
        final unit = registry[key]!.unit;
        var label = trendAxisLabel(key, tick);
        if (unit != null && unit.isNotEmpty && label.endsWith(unit)) {
          label = label.substring(0, label.length - unit.length);
        }
        return RegExp('[A-Za-z]').hasMatch(label);
      }

      final lettered = {
        for (final key in stepAligned)
          if (trendAxisTicks(
            key,
            _fractionalProbe,
          ).any((t) => namesACategory(key, t)))
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
            reason:
                '$key tick $tick reads "$label" — the scale endpoint has '
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
          if (e.value.unit == null && !stepAligned.contains(e.key)) e.key,
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
        if (stepAligned.contains(key)) continue;
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
        if (stepAligned.contains(key)) continue;
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

  group('CLOSED GAP (#268 → #285) — whole-step counts are axis-aware too', () {
    // This group recorded the gap while it was open: metrics that are whole
    // steps by their input control (there is no half a stool) but absent from
    // trendAxisTicks' hardcoded switch inherited the metric-agnostic 1/2/5
    // ladder and could be drawn at a fractional value the user never logged.
    // #285 made the axis registry-driven, closing it. The assertions below are
    // the same facts inverted, so the fix cannot silently regress.

    test('no charted whole-step metric is left on the 1/2/5 ladder', () {
      final uncovered = {
        for (final e in charted.entries)
          if (e.value.isWholeStepByInput && !stepAligned.contains(e.key)) e.key,
      };
      expect(
        uncovered,
        isEmpty,
        reason:
            'these metrics are whole steps by their input control but declare '
            'no registry valueStep, so their axis can invent a half-step',
      );
    });

    test('the previously uncovered metrics, made visible', () {
      // The concrete keys the open gap stood for: stool_count (stepper_0_10)
      // and the five likert_1_5 scores PR #274 added.
      for (final key in const [
        'stool_count',
        'appetite_score',
        'anxiety_score',
        'brain_clarity_score',
        'focus_score',
        'social_interaction_quality_score',
      ]) {
        expect(
          stepAligned,
          contains(key),
          reason: '$key has fallen back out of the registry-driven axis',
        );
        final ticks = trendAxisTicks(key, _fractionalProbe);
        expect(
          ticks.every((t) => t == t.roundToDouble()),
          isTrue,
          reason: '$key drew a fractional gridline: $ticks',
        );
        expect(
          ticks.map((t) => trendAxisLabel(key, t)),
          isNot(contains('1.5')),
          reason: 'there is no such thing as 1.5 of $key in a day',
        );
      }
    });
  });
}
