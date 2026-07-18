// Coupling guard: engine-producers-to-cards-schema (docs/graph/couplings.yaml). The S8 card
// producer speaks dynamic SQL into insight_cards / composed_insights, so the producer values,
// the 'relationship' category, the composer branch vocabulary, and the personal⇒uncited CHECK
// live in two languages (TS constants vs SQL DDL) with no import linking them. This test parses
// the §S7/§S8 migration and holds it character-for-character to the engine constants.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from '../lib/blueprints.mjs';
import { PRODUCERS, RELATIONSHIP_CATEGORY } from '../../../supabase/functions/generate-insights/render.ts';
import { ruleCategorySchema } from '../../../shared/rules/rule.schema.ts';

const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
const migrationFile = readdirSync(migrationsDir).find((f) =>
  /create_m5b_composed_insights_and_card_producers\.sql$/.test(f),
);
assert.ok(migrationFile, 'composed_insights / card-producers migration not found');
const sql = readFileSync(path.join(migrationsDir, migrationFile!), 'utf8');

/** The quoted values of the first `check (<column> in (...))` for a column. */
function checkSet(source: string, column: string): string[] {
  const m = new RegExp(`check \\(${column} in\\s*\\(([^)]*)\\)\\)`).exec(source.replace(/\n/g, ' '));
  assert.ok(m, `check (${column} in (...)) not found in migration`);
  return [...(m![1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '');
}

test('insight_cards.producer CHECK equals the engine PRODUCERS constant', () => {
  assert.deepEqual(checkSet(sql, 'producer'), [...PRODUCERS]);
});

test('the re-declared category CHECK is the blueprint category set + relationship', () => {
  assert.deepEqual(checkSet(sql, 'category'), [
    ...ruleCategorySchema.options,
    RELATIONSHIP_CATEGORY,
  ]);
});

test('composed_insights.branch CHECK covers exactly the composer branch vocabulary', () => {
  assert.deepEqual(checkSet(sql, 'branch').sort(), [
    'agree',
    'contradiction',
    'idiosyncratic',
    'research-context',
  ]);
});

test('the personal⇒uncited CHECK ships (a still-researching card can never carry a citation)', () => {
  assert.match(
    sql.replace(/\s+/g, ' '),
    /check \(producer <> 'personal' or edge_refs = '\[\]'::jsonb\)/,
  );
});

test('edge_refs defaults to [] and insight_id references composed_insights', () => {
  const flat = sql.replace(/\s+/g, ' ');
  assert.match(flat, /add column if not exists edge_refs jsonb not null default '\[\]'/);
  assert.match(flat, /add column if not exists insight_id text references public\.composed_insights\(insight_id\)/);
});
