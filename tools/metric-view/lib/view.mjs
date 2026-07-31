// tools/metric-view/lib/view.mjs
//
// Pure S2 view generator shared by the CLI (../gen_metric_view.mjs) and the drift-guard tests
// (../tests/): shared/metrics/registry.ts (TRUTH) → deterministic `metric_daily_values` view SQL
// (insight-engine-architecture §S2). Same registry → byte-identical SQL: stable registry order,
// LF newlines, no timestamps.
//
// The registry is TypeScript; this stays an .mjs Node script (house tools/ style, same pattern as
// tools/rules/lib/blueprints.mjs), so it registers the tsx ESM loader once and imports the TS
// source directly — no build step, one source of truth.
//
// Unpivot semantics:
//   * Wide legacy tables (daily_gut_rows / wearable_daily): one UNION ALL branch per active
//     numeric/ordinal metric key, `where <col> is not null` — the view carries only days that
//     HAVE a value, so downstream day-counts (S3 days_of_data / total_history_days) are plain
//     row counts.
//   * signals (long-format primitive): already (user, metric, ts, value) — a single generated
//     branch aggregates to daily grain as the MEAN of the day's readings (UTC day bucket), so any
//     future registry metric stored in signals surfaces automatically with no per-key branch.
//   * Any other table declared by an active numeric/ordinal metric is a hard error: add its
//     branch config here (and re-generate) when the table lands.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

register();

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** The committed home of the generated SQL — the file `--check` guards against drift. */
export const VIEW_MIGRATION_RELPATH =
  'supabase/migrations/20260730020002_replace_m5a_metric_daily_values_view.sql';

// shared/ compiles as CommonJS, so import the registry module directly (not via a barrel).
const metrics = await import(
  pathToFileURL(path.join(REPO_ROOT, 'shared', 'metrics', 'registry.ts')).href
);

export { metrics as metricsRegistry };

/**
 * Wide (one-column-per-metric) truth tables and how to unpivot them:
 * the day column and the constant `source` tag each branch carries.
 */
const WIDE_TABLES = {
  daily_gut_rows: { dateColumn: 'log_date', source: 'self_report' },
  wearable_daily: { dateColumn: 'date', source: 'wearable' },
};

/** Long-format tables that get a single generated aggregation branch (no per-key unpivot). */
const LONG_TABLES = new Set(['signals']);

/** The metrics the view unpivots: active + numeric/ordinal (a superset of baselineApplicable). */
export function viewMetrics(registry = metrics.METRICS) {
  return registry.filter(
    (m) => m.status === 'active' && (m.type === 'numeric' || m.type === 'ordinal'),
  );
}

function eventBranch(metric) {
  const policy = metric.dailyProjection;
  const date = `(occurred_at at time zone 'utc')::date`;
  // jsonb_typeof alone is insufficient: PostgreSQL accepts enormous JSON numbers and then aborts
  // on a double cast. CASE fences evaluation; this conservative grammar is ample for registry scales.
  const numericText = `(value #>> '{}')`;
  const numericValue =
    `case when jsonb_typeof(value) = 'number' and length(${numericText}) <= 512 ` +
    `and ${numericText} ~ '^-?(0|[1-9][0-9]{0,99})(\\.[0-9]+)?$' ` +
    `then ${numericText}::double precision end`;
  const commonWhere = `metric_key = '${metric.key}'`;

  if (policy.reducer === 'count') {
    return [
      `select user_id,`,
      `       ${date} as log_date,`,
      `       '${metric.key}'::text as metric_key,`,
      `       count(*)::double precision as value,`,
      `       '${policy.source}'::text as source`,
      `  from public.events`,
      ` where ${commonWhere}`,
      ` group by user_id, ${date}`,
    ].join('\n');
  }

  if (policy.reducer === 'sum' || policy.reducer === 'mean') {
    const aggregate = policy.reducer === 'sum' ? 'sum' : 'avg';
    return [
      `select user_id,`,
      `       ${date} as log_date,`,
      `       '${metric.key}'::text as metric_key,`,
      `       ${aggregate}(${numericValue})::double precision as value,`,
      `       '${policy.source}'::text as source`,
      `  from public.events`,
      ` where ${commonWhere}`,
      `   and (${numericValue}) is not null`,
      ` group by user_id, ${date}`,
    ].join('\n');
  }

  return [
    `select user_id, log_date, '${metric.key}'::text as metric_key, value, '${policy.source}'::text as source`,
    `  from (`,
    `    select distinct on (user_id, ${date})`,
    `           user_id, ${date} as log_date, ${numericValue} as value`,
    `      from public.events`,
    `     where ${commonWhere}`,
    `       and (${numericValue}) is not null`,
    `     order by user_id, ${date}, occurred_at desc, id desc`,
    `  ) as latest_event`,
  ].join('\n');
}

function stateBandBranch(metric) {
  const policy = metric.dailyProjection;
  return [
    `select band.user_id,`,
    `       day.log_date::date as log_date,`,
    `       '${metric.key}'::text as metric_key,`,
    `       1::double precision as value,`,
    `       '${policy.source}'::text as source`,
    `  from public.state_bands as band`,
    ` cross join lateral generate_series(`,
    `       (band.started_at at time zone 'utc')::date::timestamp,`,
    `       case when band.ended_at is null`,
    `            then (current_timestamp at time zone 'utc')::date::timestamp`,
    `            else ((band.ended_at - interval '1 microsecond') at time zone 'utc')::date::timestamp`,
    `       end,`,
    `       interval '1 day'`,
    `  ) as day(log_date)`,
    ` where band.metric_key = '${metric.key}'`,
    `   and (band.ended_at is null or band.ended_at > band.started_at)`,
    ` group by band.user_id, day.log_date`,
  ].join('\n');
}

function primitiveBranches(registry) {
  const branches = [];
  for (const metric of viewMetrics(registry)) {
    const primitive = metric.table === 'events' || metric.table === 'state_bands';
    const policy = metric.dailyProjection ?? null;
    if (!primitive) {
      if (policy !== null) {
        throw new Error(
          `gen-metric-view: ${metric.key} has dailyProjection but table ${metric.table} is not supported`,
        );
      }
      continue;
    }
    if (policy === null) {
      throw new Error(
        `gen-metric-view: active ${metric.type} metric ${metric.key} (${metric.table}) requires dailyProjection`,
      );
    }
    if (
      policy.storage !== metric.table ||
      policy.calendar !== 'utc' ||
      !['self_report', 'wearable', 'env', 'signal'].includes(policy.source)
    ) {
      throw new Error(`gen-metric-view: incompatible dailyProjection for ${metric.key} (${metric.table})`);
    }
    if (metric.table === 'events') {
      if (!['count', 'sum', 'mean', 'latest'].includes(policy.reducer)) {
        throw new Error(`gen-metric-view: unsupported events reducer for ${metric.key}`);
      }
      if ((policy.reducer === 'count' || policy.reducer === 'sum') && metric.type !== 'numeric') {
        throw new Error(`gen-metric-view: event ${policy.reducer} requires numeric metric ${metric.key}`);
      }
      branches.push(eventBranch(metric));
    } else {
      if (policy.reducer !== 'presence' || policy.interval !== 'half_open') {
        throw new Error(`gen-metric-view: unsupported state_bands policy for ${metric.key}`);
      }
      if (metric.type !== 'numeric') {
        throw new Error(`gen-metric-view: state presence requires numeric metric ${metric.key}`);
      }
      branches.push(stateBandBranch(metric));
    }
  }
  return branches;
}

function wideBranch(metric, { dateColumn, source }) {
  const dateSelect = dateColumn === 'log_date' ? 'log_date' : `${dateColumn} as log_date`;
  return [
    `select user_id,`,
    `       ${dateSelect},`,
    `       '${metric.key}'::text as metric_key,`,
    `       ${metric.key}::double precision as value,`,
    `       '${source}'::text as source`,
    `  from public.${metric.table}`,
    ` where ${metric.key} is not null`,
  ].join('\n');
}

// signals is already long-format; aggregate to daily grain as the MEAN of the day's readings
// (UTC day bucket — aggregation choice recorded in the U6 session log; revisit per-metric if a
// sum-natured passive metric ever lands). Every registry metric stored in signals surfaces here
// automatically; signals.metric_key is tied to the registry by the metrics-registry-to-schema
// guard, and S3 filters to baselineApplicable keys on read.
function signalsBranch() {
  return [
    `select user_id,`,
    `       (ts at time zone 'utc')::date as log_date,`,
    `       metric_key,`,
    `       avg(value)::double precision as value,`,
    `       'signal'::text as source`,
    `  from public.signals`,
    ` group by user_id, metric_key, (ts at time zone 'utc')::date`,
  ].join('\n');
}

/** The full migration SQL (LF newlines, trailing newline) — deterministic for a given registry. */
export function generateViewSql(registry = metrics.METRICS) {
  const branches = [];

  for (const metric of viewMetrics(registry)) {
    if (!/^[a-z][a-z0-9_]*$/.test(metric.key)) {
      throw new Error(`gen-metric-view: invalid metric key: ${metric.key}`);
    }
  }

  for (const [table, config] of Object.entries(WIDE_TABLES)) {
    const tableMetrics = viewMetrics(registry).filter((m) => m.table === table);
    if (tableMetrics.length === 0) continue;
    branches.push(
      `-- ── ${table} (wide legacy) — one unpivot branch per active numeric/ordinal key ──`,
    );
    branches.push(...tableMetrics.map((m) => wideBranch(m, config)));
  }

  branches.push(...primitiveBranches(registry));

  const unhandled = viewMetrics(registry).filter(
    (m) =>
      !(m.table in WIDE_TABLES) &&
      !LONG_TABLES.has(m.table) &&
      m.table !== 'events' &&
      m.table !== 'state_bands',
  );
  if (unhandled.length > 0) {
    const list = unhandled.map((m) => `${m.key} (${m.table})`).join(', ');
    throw new Error(
      `gen-metric-view: no unpivot branch config for: ${list} — ` +
        `add the table to WIDE_TABLES or LONG_TABLES in tools/metric-view/lib/view.mjs`,
    );
  }

  branches.push(
    `-- ── signals (long-format primitive) — daily-grain MEAN; future passive metrics appear`,
    `-- automatically (no per-key branch; see tools/metric-view/lib/view.mjs) ──`,
  );
  branches.push(signalsBranch());

  // Interleave `union all` between branches, keeping comment lines attached to what follows.
  const body = [];
  let emittedSelect = false;
  for (const chunk of branches) {
    if (chunk.startsWith('--')) {
      if (emittedSelect) body.push('union all');
      body.push(chunk);
      emittedSelect = false; // next select follows a fresh comment header, union already emitted
      continue;
    }
    if (emittedSelect) body.push('union all');
    body.push(chunk);
    emittedSelect = true;
  }

  return [
    `-- S2 · metric_daily_values — the metric joint-series projection`,
    `-- (docs/shared/insight-engine-architecture.md §S2).`,
    `--`,
    `-- ▒▒ GENERATED FILE — DO NOT EDIT BY HAND ▒▒`,
    `-- Rendered from shared/metrics/registry.ts by tools/metric-view/gen_metric_view.mjs.`,
    `--   regenerate : node tools/metric-view/gen_metric_view.mjs --write`,
    `--   drift guard: node tools/metric-view/gen_metric_view.mjs --check (npm run view:check)`,
    `--`,
    `-- One canonical long-format read surface over the per-day truth tables: one row per`,
    `-- (user, metric, day) that HAS a non-null value. Two-tier truth (docs/memory/0001): a`,
    `-- zero-copy live VIEW over raw rows — never materialized, never hand-edited.`,
    `--`,
    `-- security_invoker (Postgres 15+): the view runs with the CALLER's privileges, so the`,
    `-- underlying tables' RLS still applies to app reads; the engine's service_role bypasses`,
    `-- RLS here exactly as it does on the tables themselves.`,
    ``,
    `create or replace view public.metric_daily_values`,
    `  with (security_invoker = true) as`,
    ...body,
    `;`,
    ``,
    `comment on view public.metric_daily_values is`,
    `  'S2 joint-series projection: one row per (user, metric, day) with a non-null value. GENERATED from shared/metrics/registry.ts by tools/metric-view/gen_metric_view.mjs — do not edit by hand.';`,
    ``,
  ].join('\n');
}
