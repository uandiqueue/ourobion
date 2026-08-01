// Coupling guard: rules-schema-to-rules-table (docs/graph/couplings.yaml). The flattened row the
// loader produces and the `rules` migration's columns/CHECK sets are the same shape in two
// languages (JS object vs SQL DDL) with no import linking them — this test holds them together:
// column set equality, and every CHECK enum character-set-identical to the shared/rules zod enums.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadBlueprints, flattenRule, REPO_ROOT } from '../lib/blueprints.mjs';
import {
  CONDITION_TYPES,
  ruleCategorySchema,
  ruleSeveritySchema,
  ruleScopeSchema,
  ruleStatusSchema,
  ruleProvenanceTierSchema,
} from '../../../shared/rules/rule.schema.ts';

const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
const migrationFile = readdirSync(migrationsDir).find((f) => /create_m5b_rules_table\.sql$/.test(f));
assert.ok(migrationFile, 'rules table migration not found in supabase/migrations');
const sql = readFileSync(path.join(migrationsDir, migrationFile), 'utf8');

/** Column names of the `create table ... rules (...)` block (leading identifier per line). */
function tableColumns(source: string): Set<string> {
  const m = /create table[^(]*\bpublic\.rules\b[^(]*\(([\s\S]*?)\n\);/.exec(source);
  assert.ok(m, 'create table public.rules block not found');
  const cols = new Set<string>();
  for (const rawLine of (m[1] ?? '').split('\n')) {
    const line = rawLine.replace(/--.*$/, '').trim();
    if (line === '') continue;
    const col = /^([a-z_][a-z0-9_]*)\s+\S/.exec(line);
    if (col?.[1]) cols.add(col[1]);
  }
  return cols;
}

/** The quoted values of `check (<column> in (...))`. */
function checkSet(source: string, column: string): string[] {
  const m = new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`).exec(source);
  assert.ok(m, `check (${column} in (...)) not found in migration`);
  return [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '');
}

test('flattened loader rows and the rules table declare the same columns', () => {
  const { blueprints, errors } = loadBlueprints();
  assert.deepEqual(errors, []);
  assert.ok(blueprints.length > 0);
  const rowKeys = new Set<string>(Object.keys(flattenRule(blueprints[0]!.blueprint)));
  rowKeys.add('loaded_at'); // DB-defaulted load metadata — the one column the loader never sets
  assert.deepEqual([...tableColumns(sql)].sort(), [...rowKeys].sort());
});

test('condition_type CHECK covers exactly the contract condition union', () => {
  assert.deepEqual(checkSet(sql, 'condition_type').sort(), [...CONDITION_TYPES].sort());
});

test('category / severity CHECK sets equal the shared/rules enums (== insight_cards sets)', () => {
  assert.deepEqual(checkSet(sql, 'category'), ruleCategorySchema.options);
  assert.deepEqual(checkSet(sql, 'severity'), ruleSeveritySchema.options);
});

test('scope / status / provenance_tier CHECK sets equal the shared/rules enums', () => {
  assert.deepEqual(checkSet(sql, 'scope'), ruleScopeSchema.options);
  assert.deepEqual(checkSet(sql, 'status'), ruleStatusSchema.options);
  assert.deepEqual(checkSet(sql, 'provenance_tier'), ruleProvenanceTierSchema.options);
});
