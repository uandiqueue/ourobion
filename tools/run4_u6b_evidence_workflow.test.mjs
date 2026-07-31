#!/usr/bin/env node
/** Static contract for the supplemental #221 CI evidence workflow. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/run4-u6b-evidence.yml', import.meta.url), 'utf8');

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
  assert.match(workflow, /node supabase\/tests\/metric-view\/local_projection_fixture\.mjs/);
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
  assert.match(workflow, /rm "\$server_log"/);
  assert.match(workflow, /cp "\$original_manifest" supabase\/deploy-attestation\.json/);
  assert.match(workflow, /rm "\$original_manifest"/);
  assert.match(workflow, /trap - EXIT/);
  assert.match(workflow, /retention-days: 1/);
});
