#!/usr/bin/env node
// Transactional local proof for U6b batch 1. It covers schema bounds, legacy-shape compatibility,
// and the unchanged authenticated owner boundary without persisting test rows or the migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(fileURLToPath(new URL(
  '../../migrations/20260730020001_add_u6b_wellbeing_metrics.sql', import.meta.url,
)), 'utf8');
const keys = ['appetite_score', 'anxiety_score', 'brain_clarity_score', 'focus_score', 'social_interaction_quality_score'];
const constraints = keys.map((key) => `daily_gut_rows_${key}_range`);
const userA = '61000000-0000-0000-0000-000000000001';
const userB = '61000000-0000-0000-0000-000000000002';
const sqlArray = (values) => values.map((value) => `'${value}'`).join(', ');

assert.match(migration, /^\s*--\s*metric-columns:/mi);
assert.doesNotMatch(migration, /add\s+column\s+if\s+not\s+exists/i);
assert.doesNotMatch(migration, /\b(?:create|alter|drop)\s+policy\b/i);
assert.doesNotMatch(migration, /\bupdate\s+public\.daily_gut_rows\b/i);

const sql = `
begin;
create temporary table wellbeing_policy_before as
select policyname, permissive, roles::text, cmd, qual, with_check
  from pg_policies where schemaname = 'public' and tablename = 'daily_gut_rows';

insert into auth.users (id, aud, role, email, created_at, updated_at) values
 ('${userA}', 'authenticated', 'authenticated', 'wellbeing-a@local.invalid', now(), now()),
 ('${userB}', 'authenticated', 'authenticated', 'wellbeing-b@local.invalid', now(), now());
${migration}

select 'columns_exact=' || count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'daily_gut_rows'
   and column_name in (${sqlArray(keys)}) and data_type = 'smallint'
   and is_nullable = 'YES' and column_default is null;
select 'named_checks=' || count(*) from pg_constraint c
 join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
 where n.nspname = 'public' and t.relname = 'daily_gut_rows' and c.contype = 'c'
   and c.conname in (${sqlArray(constraints)});

-- Authenticated legacy client omits every new column. NULL remains the compatibility contract.
set local role authenticated;
set local request.jwt.claim.sub = '${userA}';
insert into public.daily_gut_rows (user_id, log_date, region, log_completeness)
 values ('${userA}', '2026-07-01', 'SG', 0);
select 'legacy_insert_nulls=' || count(*) from public.daily_gut_rows
 where user_id = '${userA}' and log_date = '2026-07-01'
   and appetite_score is null and anxiety_score is null and brain_clarity_score is null
   and focus_score is null and social_interaction_quality_score is null;

-- A second authenticated subject cannot insert a row for the owner.
set local request.jwt.claim.sub = '${userB}';
do $$ begin
  begin
    insert into public.daily_gut_rows (user_id, log_date, region, log_completeness)
      values ('${userA}', '2026-07-02', 'SG', 0);
    raise exception 'cross-user INSERT unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claim.sub = '${userA}';
insert into public.daily_gut_rows (user_id, log_date, region, appetite_score, anxiety_score,
  brain_clarity_score, focus_score, social_interaction_quality_score, log_completeness)
 values ('${userA}', '2026-07-03', 'SG', 1, 2, 3, 4, 5, 0);
select 'boundary_insert=' || count(*) from public.daily_gut_rows
 where user_id = '${userA}' and log_date = '2026-07-03';

-- Every metric must reject both values outside its documented 1..5 ordinal range.
do $$
declare
  metric_key text;
  rejected_value smallint;
  test_day date := date '2026-07-04';
begin
  foreach metric_key in array array[${sqlArray(keys)}]
  loop
    foreach rejected_value in array array[0::smallint, 6::smallint]
    loop
      begin
        execute format(
          'insert into public.daily_gut_rows (user_id, log_date, region, %I, log_completeness) values ($1, $2, $3, $4, $5)',
          metric_key
        ) using '${userA}'::uuid, test_day, 'SG', rejected_value, 0;
        raise exception 'out-of-range value % unexpectedly accepted for %', rejected_value, metric_key;
      exception when check_violation then null;
      end;
      test_day := test_day + 1;
    end loop;
  end loop;
end $$;
select 'rejected_rows=' || count(*) from public.daily_gut_rows
 where user_id = '${userA}' and log_date >= '2026-07-04';
reset role;

select 'policy_drift=' || count(*) from (
  (select policyname, permissive, roles::text, cmd, qual, with_check
     from pg_policies where schemaname = 'public' and tablename = 'daily_gut_rows'
   except table wellbeing_policy_before)
  union all
  (table wellbeing_policy_before except select policyname, permissive, roles::text, cmd, qual, with_check
     from pg_policies where schemaname = 'public' and tablename = 'daily_gut_rows')
) drift;
rollback;
`;

const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_ourobion', 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1',
  '-U', 'postgres', '-d', 'postgres',
], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr);
const output = new Set(result.stdout.trim().split(/\r?\n/));
for (const expected of ['columns_exact=5', 'named_checks=5', 'legacy_insert_nulls=1', 'boundary_insert=1', 'rejected_rows=0', 'policy_drift=0']) {
  assert.ok(output.has(expected), `missing ${expected}; got:\n${result.stdout}`);
}
console.log('local U6b wellbeing schema fixture: PASS (transaction rolled back)');
