#!/usr/bin/env node
// Local-only transactional proof for synthetic events/state_bands policies. Requires local
// Supabase Docker; every view, row, and auth-user change is rolled back.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateViewSql } from '../../../tools/metric-view/lib/view.mjs';

const base = { source: 'manual', tier: 'T3', continuity: 'episodic', type: 'numeric', status: 'active' };
const event = (key, reducer) => ({
  ...base, key, table: 'events',
  dailyProjection: { storage: 'events', calendar: 'utc', source: 'self_report', reducer },
});
const registry = [
  event('fixture_count', 'count'), event('fixture_sum', 'sum'), event('fixture_mean', 'mean'),
  event('fixture_latest', 'latest'), event('fixture_malformed', 'sum'),
  {
    ...base, key: 'fixture_state', table: 'state_bands', tier: 'T4', continuity: 'state',
    dailyProjection: {
      storage: 'state_bands', calendar: 'utc', source: 'self_report',
      reducer: 'presence', interval: 'half_open',
    },
  },
  {
    ...base, key: 'fixture_boundary', table: 'state_bands', tier: 'T4', continuity: 'state',
    dailyProjection: {
      storage: 'state_bands', calendar: 'utc', source: 'self_report',
      reducer: 'presence', interval: 'half_open',
    },
  },
];
const userA = '10000000-0000-0000-0000-000000000001';
const userB = '10000000-0000-0000-0000-000000000002';

const sql = `
begin;
insert into auth.users (id, aud, role, email, created_at, updated_at) values
 ('${userA}', 'authenticated', 'authenticated', 'metric-view-a@local.invalid', now(), now()),
 ('${userB}', 'authenticated', 'authenticated', 'metric-view-b@local.invalid', now(), now());
insert into public.events (id, user_id, metric_key, occurred_at, value) values
 ('20000000-0000-0000-0000-000000000001','${userA}','fixture_count','2026-01-01T01:00Z',null),
 ('20000000-0000-0000-0000-000000000002','${userA}','fixture_count','2026-01-01T02:00Z','"ignored"'),
 ('20000000-0000-0000-0000-000000000003','${userA}','fixture_sum','2026-01-01T01:00Z','2'),
 ('20000000-0000-0000-0000-000000000004','${userA}','fixture_sum','2026-01-01T02:00Z','3'),
 ('20000000-0000-0000-0000-000000000005','${userA}','fixture_sum','2026-01-01T03:00Z','"bad"'),
 ('20000000-0000-0000-0000-000000000006','${userA}','fixture_sum','2026-01-01T04:00Z','1e100000'),
 ('20000000-0000-0000-0000-000000000007','${userA}','fixture_mean','2026-01-01T01:00Z','2'),
 ('20000000-0000-0000-0000-000000000008','${userA}','fixture_mean','2026-01-01T02:00Z','4'),
 ('20000000-0000-0000-0000-000000000009','${userA}','fixture_latest','2026-01-01T05:00Z','7'),
 ('20000000-0000-0000-0000-000000000010','${userA}','fixture_latest','2026-01-01T05:00Z','9'),
 ('20000000-0000-0000-0000-000000000011','${userA}','fixture_malformed','2026-01-01T01:00Z','"bad"'),
 ('20000000-0000-0000-0000-000000000012','${userA}','fixture_malformed','2026-01-01T02:00Z','1e100000'),
 ('20000000-0000-0000-0000-000000000014','${userA}','fixture_malformed','2026-01-01T03:00Z',null),
 ('20000000-0000-0000-0000-000000000015','${userA}','fixture_malformed','2026-01-01T04:00Z','null'),
 ('20000000-0000-0000-0000-000000000016','${userA}','fixture_malformed','2026-01-01T05:00Z','{}'),
 ('20000000-0000-0000-0000-000000000017','${userA}','fixture_malformed','2026-01-01T06:00Z','[]'),
 ('20000000-0000-0000-0000-000000000013','${userA}','not_registered','2026-01-01T01:00Z','99'),
 ('20000000-0000-0000-0000-000000000099','${userB}','fixture_count','2026-01-01T01:00Z',null);
insert into public.state_bands (id, user_id, metric_key, started_at, ended_at) values
 ('30000000-0000-0000-0000-000000000001','${userA}','fixture_state','2026-01-01T12:00Z','2026-01-03T00:00Z'),
 ('30000000-0000-0000-0000-000000000002','${userA}','fixture_state','2026-01-02T06:00Z','2026-01-04T12:00Z'),
 ('30000000-0000-0000-0000-000000000003','${userA}','fixture_state',(current_timestamp at time zone 'utc')::date,null),
 ('30000000-0000-0000-0000-000000000004','${userA}','fixture_boundary','2026-01-01T12:00Z','2026-01-03T00:00Z');
${generateViewSql(registry)}
select 'count='||value from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_count' and log_date='2026-01-01';
select 'sum='||value from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_sum';
select 'mean='||value from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_mean';
select 'latest='||value from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_latest';
select 'state_days='||count(*) from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_state' and log_date between '2026-01-01' and '2026-01-04';
select 'open_state_today='||count(*) from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_state' and log_date=(current_timestamp at time zone 'utc')::date;
select 'boundary_days='||count(*) from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_boundary';
select 'malformed_rows='||count(*) from public.metric_daily_values where metric_key='fixture_malformed';
select 'unregistered_rows='||count(*) from public.metric_daily_values where metric_key='not_registered';
select 'quiet_day_rows='||count(*) from public.metric_daily_values where user_id='${userA}' and metric_key='fixture_count' and log_date='2026-01-02';
set local role authenticated;
set local request.jwt.claim.sub = '${userA}';
select 'rls_visible_users='||count(distinct user_id) from public.metric_daily_values;
select 'rls_other_user_rows='||count(*) from public.metric_daily_values where user_id='${userB}';
reset role;
rollback;
`;

const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_ourobion', 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1',
  '-U', 'postgres', '-d', 'postgres',
], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr);
const output = new Set(result.stdout.trim().split(/\r?\n/));
for (const expected of [
  'count=2', 'sum=5', 'mean=3', 'latest=9', 'state_days=4', 'open_state_today=1',
  'boundary_days=2', 'malformed_rows=0',
  'unregistered_rows=0', 'quiet_day_rows=0', 'rls_visible_users=1', 'rls_other_user_rows=0',
]) assert.ok(output.has(expected), `missing ${expected}; got:\n${result.stdout}`);
console.log('local metric projection fixture: PASS (transaction rolled back)');
