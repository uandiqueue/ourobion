#!/usr/bin/env node
/** Static contract for the supplemental #221 CI evidence workflow. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/run4-u6b-evidence.yml', import.meta.url), 'utf8');
const wellbeingFixture = readFileSync(new URL('../supabase/tests/wellbeing-foundation/local_schema_fixture.mjs', import.meta.url), 'utf8');
const metricViewFixture = readFileSync(new URL('../supabase/tests/metric-view/local_projection_fixture.mjs', import.meta.url), 'utf8');

test('U6b evidence workflow remains path-scoped and supplemental', () => {
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[dev-phase2-run4\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /run4-u6b-evidence\.yml/);
  assert.match(workflow, /node --test tools\/run4_u6b_evidence_workflow\.test\.mjs/);
  assert.doesNotMatch(workflow, /^  run4-(?:gate|release):/m);
  assert.doesNotMatch(workflow, /run4_release_gate\.mjs aggregate/);
  assert.doesNotMatch(workflow, /secrets\.|functions deploy|https?:\/\/[^\s]+supabase/i);
});

test('rollback evidence pins the existing fixture container contract and migration boundary', () => {
  assert.match(workflow, /docker rename "\$\{\{ job\.services\.postgres\.id \}\}" supabase_db_ourobion/);
  assert.match(workflow, /ci\/migrations-bootstrap\.sql/);
  assert.match(workflow, /filename" > "20260730020000"/);
  assert.match(workflow, /node supabase\/tests\/wellbeing-foundation\/local_schema_fixture\.mjs/);
  assert.match(workflow, /Grant only fixture role privileges \(RLS remains authoritative\)/);
  assert.match(workflow, /grant usage on schema public to authenticated/);
  assert.match(workflow, /grant select, insert on table public\.daily_gut_rows to authenticated/);
  assert.match(workflow, /grant usage on sequence public\.daily_gut_rows_id_seq to authenticated/);
  assert.match(workflow, /public\.signals, public\.metric_daily_values to authenticated/);
  assert.doesNotMatch(workflow, /disable row level security|bypassrls/i);
  assert.match(workflow, /node supabase\/tests\/metric-view\/local_projection_fixture\.mjs/);
  for (const fixture of [wellbeingFixture, metricViewFixture]) {
    assert.match(fixture, /insert into auth\.users \(id, email\) values/);
    assert.doesNotMatch(fixture, /auth\.users \(id, aud, role, email, created_at, updated_at\)/);
  }
});

test('attestation evidence pins exact local routes, denial hash, generator, and fresh graphs', () => {
  assert.match(workflow, /for name in compute-baselines evaluate-signals generate-insights run-pipeline/);
  assert.match(workflow, /\/functions\/v1\/\$name/);
  assert.match(workflow, /functions serve --debug --no-verify-jwt/);
  assert.match(workflow, /test "\$status" = '401'/);
  assert.match(workflow, /d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f/);
  assert.match(workflow, /record-attestation .*--manifest-path "\$manifest"/);
  assert.match(workflow, /record-graphs/);
  assert.match(workflow, /verify-graphs/);
  assert.match(workflow, /cp "\$manifest" supabase\/deploy-attestation\.json/);
  assert.match(workflow, /local-functions-serve\.log\.sha256/);
  assert.match(workflow, /supabase start --yes --exclude gotrue,realtime,storage-api,imgproxy,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor/);
  assert.match(workflow, /supabase stop --no-backup/);
  assert.match(workflow, /seq 1 120/);
  assert.match(workflow, /kill -0 .*server_pid/);
  assert.match(workflow, /listener did not become ready within 120 seconds/);
  assert.match(workflow, /sanitized_tail/);
  assert.match(workflow, /rm .*start_log.*stop_log/);
  assert.doesNotMatch(workflow, /grep -Eq '\^\(401\|404\|500\)\$'/);
  assert.equal((workflow.match(/checksums\.sha256/g) ?? []).length, 1);
  assert.match(workflow, /rm "\$server_log"/);
  assert.match(workflow, /cp "\$original_manifest" supabase\/deploy-attestation\.json/);
  assert.match(workflow, /rm "\$original_manifest"/);
  assert.match(workflow, /trap - EXIT/);
  assert.match(workflow, /retention-days: 1/);
});
