import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  generateViewSql,
  metricsRegistry,
  REPO_ROOT,
  VIEW_MIGRATION_RELPATH,
} from '../lib/view.mjs';
import { validateRegistry } from '../../../shared/metrics/registry.schema.ts';
import type { MetricDefinition } from '../../../shared/metrics/registry.ts';

const productionMetrics =
  metricsRegistry.METRICS as readonly MetricDefinition[];

function productionMetric(key: string): MetricDefinition {
  const metric = productionMetrics.find((candidate) => candidate.key === key);
  assert.ok(metric, `missing production metric: ${key}`);
  return metric;
}

function fixture(overrides: Partial<MetricDefinition>): MetricDefinition {
  return {
    ...productionMetrics[0]!,
    key: 'fixture_metric',
    table: 'events',
    tier: 'T3',
    continuity: 'episodic',
    type: 'numeric',
    scale: { min: 0, max: 100 },
    valueStep: null,
    baselineApplicable: false,
    signal: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    ...overrides,
  };
}

test('event reducers emit exact-key UTC branches with explicit payload semantics', () => {
  for (const reducer of ['count', 'sum', 'mean', 'latest'] as const) {
    const sql = generateViewSql([
      fixture({ dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer } }),
    ]);
    assert.match(sql, /where metric_key = 'fixture_metric'/);
    assert.match(sql, /\(occurred_at at time zone 'utc'\)::date/);
    assert.doesNotMatch(sql, /where metric_key = metric_key/);
    if (reducer === 'count') {
      assert.match(sql, /count\(\*\)::double precision/);
      assert.doesNotMatch(sql, /jsonb_typeof\(value\)/);
    } else {
    assert.match(sql, /jsonb_typeof\(value\) = 'number'/);
    assert.match(sql, /'self_report'::text as source/);
    }
    if (reducer === 'latest') {
      assert.match(sql, /order by .*occurred_at desc, id desc/);
    }
  }
});

test('event branches never manufacture quiet-day zero rows', () => {
  const sql = generateViewSql([
    fixture({
      key: 'occurrences_only',
      dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'count' },
    }),
  ]);
  assert.doesNotMatch(sql, /generate_series/);
  assert.doesNotMatch(sql, /coalesce/i);
  assert.doesNotMatch(sql, /'unregistered_metric'/);
});

test('state presence is exact-key, UTC, half-open, open-band aware, and overlap-collapsing', () => {
  const sql = generateViewSql([
    fixture({
      table: 'state_bands',
      tier: 'T4',
      continuity: 'state',
      dailyProjection: {
        storage: 'state_bands',
        calendar: 'utc',
        source: 'self_report',
        reducer: 'presence',
        interval: 'half_open',
      },
    }),
  ]);
  assert.match(sql, /where band\.metric_key = 'fixture_metric'/);
  assert.match(sql, /current_timestamp at time zone 'utc'/);
  assert.match(sql, /ended_at - interval '1 microsecond'/);
  assert.match(sql, /ended_at > band\.started_at/);
  assert.match(sql, /group by band\.user_id, day\.log_date/);
  assert.doesNotMatch(sql, /band\.value/);
});

test('active numeric primitive metrics fail closed without a compatible policy', () => {
  assert.throws(() => generateViewSql([fixture({ dailyProjection: null })]), /requires dailyProjection/);
  assert.throws(
    () =>
      generateViewSql([
        fixture({
          dailyProjection: {
            storage: 'events',
            calendar: 'local' as 'utc',
            source: 'self_report',
            reducer: 'count',
          },
        }),
      ]),
    /incompatible dailyProjection/,
  );
  assert.throws(
    () =>
      generateViewSql([
        fixture({
          table: 'state_bands',
          dailyProjection: {
            storage: 'state_bands',
            calendar: 'utc',
            source: 'self_report',
            reducer: 'presence',
            interval: 'closed' as 'half_open',
          },
        }),
      ]),
    /unsupported state_bands policy/,
  );
  assert.throws(
    () =>
      generateViewSql([
        fixture({
          dailyProjection: {
            storage: 'events',
            calendar: 'utc',
            source: 'other' as 'self_report',
            reducer: 'count',
          },
        }),
      ]),
    /incompatible dailyProjection/,
  );
  assert.throws(
    () => generateViewSql([fixture({ key: "bad_key' union select", dailyProjection: null })]),
    /invalid metric key/,
  );
});

test('reducer/type compatibility fails closed', () => {
  for (const reducer of ['count', 'sum'] as const) {
    assert.throws(
      () =>
        generateViewSql([
          fixture({
            type: 'ordinal',
            dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer },
          }),
        ]),
      /requires numeric metric/,
    );
  }
  assert.throws(
    () =>
      generateViewSql([
        fixture({
          type: 'ordinal',
          table: 'state_bands',
          dailyProjection: {
            storage: 'state_bands',
            calendar: 'utc',
            source: 'self_report',
            reducer: 'presence',
            interval: 'half_open',
          },
        }),
      ]),
    /requires numeric metric/,
  );
});

test('payload reducers fence extreme JSON numbers before the double cast', () => {
  const sql = generateViewSql([
    fixture({ dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'sum' } }),
  ]);
  assert.match(sql, /case when jsonb_typeof\(value\) = 'number'/);
  assert.match(sql, /\[0-9\]\{0,99\}/);
  assert.match(sql, /then \(value #>> '\{\}'\)::double precision end/);
});

test('deprecated primitive metrics and unrelated registry keys do not surface', () => {
  const sql = generateViewSql([
    fixture({ key: 'kept', dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'count' } }),
    fixture({ key: 'retired', status: 'deprecated', dailyProjection: null }),
  ]);
  assert.match(sql, /'kept'::text as metric_key/);
  assert.doesNotMatch(sql, /retired/);
});

test('runtime schema rejects absent, wrong-table, and wrong-type primitive policies', () => {
  assert.throws(() => validateRegistry([fixture({ dailyProjection: null })]), /requires dailyProjection/);
  assert.throws(
    () =>
      validateRegistry([
        fixture({ table: 'daily_gut_rows', dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'count' } }),
      ]),
    /dailyProjection/,
  );
  assert.throws(
    () =>
      validateRegistry([
        fixture({ type: 'boolean', scale: null, dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'count' } }),
      ]),
    /dailyProjection/,
  );
  const missingSource = fixture({
    dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer: 'count' },
  }) as unknown as Record<string, unknown>;
  const policy = { ...(missingSource.dailyProjection as Record<string, unknown>) };
  delete policy.source;
  missingSource.dailyProjection = policy;
  assert.throws(() => validateRegistry([missingSource]), /source/);
});

test('runtime schema accepts all production metrics with absent policy defaulting to null', () => {
  const validated = validateRegistry(metricsRegistry.METRICS);
  assert.equal(validated.length, metricsRegistry.METRICS.length);
  for (const metric of validated) {
    assert.ok('dailyProjection' in metric);
    assert.equal(metric.dailyProjection, null);
  }
});

test('valueStep is optional-with-default and rejects incompatible grids', () => {
  const sleep = {
    ...productionMetric('sleep_duration_min'),
  } as Record<string, unknown>;
  delete sleep.valueStep;
  const [normalized] = validateRegistry([sleep]);
  assert.equal(normalized?.valueStep, null);

  assert.throws(
    () =>
      validateRegistry([
        {
          ...productionMetric('stool_form'),
          valueStep: null,
        },
      ]),
    /ordinal metrics require valueStep/,
  );
  assert.throws(
    () =>
      validateRegistry([
        {
          ...productionMetric('stool_count'),
          valueStep: 4,
        },
      ]),
    /whole multiple of valueStep/,
  );
  assert.throws(
    () =>
      validateRegistry([
        {
          ...productionMetric('standing_water_present'),
          valueStep: 1,
        },
      ]),
    /valueStep is only valid for numeric\|ordinal/,
  );
});

test('production whole-step policy covers all 15 discrete metrics explicitly', () => {
  const stepped = productionMetrics
    .filter((metric) => metric.valueStep === 1)
    .map((metric) => metric.key)
    .sort();
  assert.deepEqual(
    stepped,
    [
      'anxiety_score',
      'appetite_score',
      'brain_clarity_score',
      'energy_score',
      'focus_score',
      'gut_comfort_score',
      'mood_score',
      'mosquito_bites',
      'outside_meals',
      'social_interaction_quality_score',
      'step_count',
      'stool_count',
      'stool_form',
      'stool_variability',
      'urine_colour',
    ],
  );
});

test('Biotope consumes the registry through the public Dart package barrel', () => {
  const metricRoot = path.join(REPO_ROOT, 'shared', 'metrics');
  const barrel = readFileSync(path.join(metricRoot, 'lib', 'ourobion_metrics.dart'), 'utf8');
  const pubspec = readFileSync(path.join(REPO_ROOT, 'apps', 'biotope', 'pubspec.yaml'), 'utf8');
  const trend = readFileSync(
    path.join(
      REPO_ROOT,
      'apps',
      'biotope',
      'lib',
      'modules',
      'm5a_baselines',
      'ui',
      'widgets',
      'metric_trend_section.dart',
    ),
    'utf8',
  );
  const detail = readFileSync(
    path.join(
      REPO_ROOT,
      'apps',
      'biotope',
      'lib',
      'modules',
      'm5a_baselines',
      'ui',
      'screens',
      'metric_detail_screen.dart',
    ),
    'utf8',
  );
  const axisPolicy = readFileSync(
    path.join(
      REPO_ROOT,
      'apps',
      'biotope',
      'lib',
      'modules',
      'm5a_baselines',
      'impl',
      'metric_axis_policy.dart',
    ),
    'utf8',
  );

  assert.equal(existsSync(path.join(metricRoot, 'registry.dart')), false);
  assert.equal(existsSync(path.join(metricRoot, 'index.dart')), false);
  assert.match(barrel, /export 'src\/registry\.dart'/);
  assert.match(pubspec, /ourobion_metrics:\s*\r?\n\s+path: \.\.\/\.\.\/shared\/metrics/);
  assert.match(trend, /package:ourobion_metrics\/ourobion_metrics\.dart/);
  assert.match(trend, /metricByKey\(metricKey\)/);
  assert.match(trend, /metric\?\.valueStep/);
  assert.ok(trend.includes('metricAxisTickLabel(metricKey, tick)'));
  assert.equal(trend.includes('switch (metricKey)'), false);
  assert.ok(detail.includes('metricAxisDescription(metricKey)'));
  assert.equal(detail.includes('switch (metricKey)'), false);
  assert.ok(axisPolicy.includes('switch (metric.ui?.inputType)'));
  assert.ok(axisPolicy.includes('metric.ui?.label'));
  assert.ok(axisPolicy.includes('metric.scale'));
  assert.ok(axisPolicy.includes('metric.unit'));
  assert.ok(axisPolicy.includes('metric.valueStep'));
  assert.doesNotMatch(axisPolicy, /switch\s*\(metricKey\)/);
});

test('TS and Dart contracts expose the same closed dailyProjection vocabulary', () => {
  const ts = readFileSync(path.join(REPO_ROOT, 'shared', 'metrics', 'registry.ts'), 'utf8');
  const dart = readFileSync(
    path.join(REPO_ROOT, 'shared', 'metrics', 'lib', 'src', 'registry.dart'),
    'utf8',
  );

  const tsBlock = (name: string) =>
    ts.match(new RegExp(`export type ${name} = \\{([\\s\\S]*?)\\n\\};`))?.[1] ?? '';
  const tsValues = (block: string, field: string) => {
    const declaration = block.match(new RegExp(`${field}:([^;]+);`))?.[1] ?? '';
    return [...declaration.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  };
  const dartValues = (name: string) => {
    const block = dart.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
    return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  };
  const event = tsBlock('EventDailyProjection');
  const state = tsBlock('StateBandDailyProjection');
  assert.deepEqual(
    [...new Set([...tsValues(event, 'storage'), ...tsValues(state, 'storage')])].sort(),
    dartValues('DailyProjectionStorage'),
  );
  assert.deepEqual(
    [...new Set([...tsValues(event, 'calendar'), ...tsValues(state, 'calendar')])].sort(),
    dartValues('DailyProjectionCalendar'),
  );
  assert.deepEqual(
    [...new Set([...tsValues(event, 'source'), ...tsValues(state, 'source')])].sort(),
    dartValues('DailyProjectionSource'),
  );
  assert.deepEqual(tsValues(event, 'reducer'), dartValues('EventDailyReducer'));
  assert.deepEqual(tsValues(state, 'reducer'), dartValues('StateBandDailyReducer'));
  assert.deepEqual(tsValues(state, 'interval'), dartValues('StateBandInterval'));
  assert.match(dart, /final DailyProjection\? dailyProjection/);
  assert.match(dart, /this\.dailyProjection/);
  assert.match(dart, /final num\? valueStep/);
  assert.match(dart, /this\.valueStep/);
  for (const metric of metricsRegistry.METRICS) {
    assert.equal(metric.dailyProjection ?? null, null, `${metric.key} unexpectedly selected a production policy`);
  }
});

test('--write refuses to overwrite the generated target and leaves migration bytes unchanged', () => {
  const migration = path.join(REPO_ROOT, ...VIEW_MIGRATION_RELPATH.split('/'));
  const before = readFileSync(migration);
  const result = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, 'tools', 'metric-view', 'gen_metric_view.mjs'), '--write'],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to overwrite landed migration/);
  assert.deepEqual(readFileSync(migration), before);
});
