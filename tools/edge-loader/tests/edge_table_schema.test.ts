// Coupling guard: brain-edge-to-schema (docs/graph/couplings.yaml). The rows the A11 loader
// writes and the S6 migration's DDL (relationship_claims / edge_verifications columns, CHECK
// sets, verified_edges view) are the same shape in two languages (JS object vs SQL) with no
// import linking them — this test holds them together: column-set equality per table, every
// CHECK enum character-identical to the shared/brain zod enums, and the view's newest-active
// semantics present in the SQL.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLoad, brain, REPO_ROOT } from '../lib/artifacts.mjs';
import {
  relationKindSchema,
  verdictSchema,
  verificationStatusSchema,
} from '../../../shared/brain/relationships.schema.ts';

const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
const migrationFile = readdirSync(migrationsDir).find((f) =>
  /create_brain_edge_read_store\.sql$/.test(f),
);
assert.ok(migrationFile, 'brain edge read store migration not found in supabase/migrations');
const sql = readFileSync(path.join(migrationsDir, migrationFile), 'utf8');

// R4-U4/O27 added the artifact-trust + attestation columns by ALTER TABLE, so a table's real
// column set is now "the create-table block" ∪ "every later add column". The loader populates
// those columns (this follow-on unit), so the column-set equality below has to see both files
// or it would report the loader as writing columns that "do not exist".
const u4MigrationFile = readdirSync(migrationsDir).find((f) =>
  /r4u4_artifact_trust_and_revision_bound_disposition\.sql$/.test(f),
);
assert.ok(u4MigrationFile, 'R4-U4 artifact-trust migration not found in supabase/migrations');
const u4Sql = readFileSync(path.join(migrationsDir, u4MigrationFile), 'utf8');

// #300 §E added `edge_verifications.caveat` by a further ALTER TABLE, and the loader now projects
// it (the column existed for weeks with nothing writing it — that is the regression this line
// exists to prevent recurring). Same union rule as the U4 file above.
const caveatMigrationFile = readdirSync(migrationsDir).find((f) =>
  /edge_verifications_caveat_column\.sql$/.test(f),
);
assert.ok(caveatMigrationFile, 'edge_verifications caveat migration not found in supabase/migrations');
const caveatSql = readFileSync(path.join(migrationsDir, caveatMigrationFile), 'utf8');

/** Columns an `alter table public.<table> add column ...` block introduces. */
function alterAddedColumns(source: string, table: string): Set<string> {
  const cols = new Set<string>();
  const blocks = source
    .replace(/\r\n/g, '\n')
    .matchAll(new RegExp(`alter table public\\.${table}\\b([\\s\\S]*?);`, 'g'));
  for (const block of blocks) {
    for (const m of (block[1] ?? '').matchAll(/add column\s+([a-z_][a-z0-9_]*)/g)) {
      cols.add(m[1]!);
    }
  }
  return cols;
}

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'edges');
const { claimRows, verificationRows, errors } = buildLoad(
  readFileSync(path.join(FIXTURES, 'claims.jsonl'), 'utf8'),
  readFileSync(path.join(FIXTURES, 'verifications.jsonl'), 'utf8'),
);
assert.deepEqual(errors, []);

/** Table-level constraint keywords — lines that are not column declarations. */
const NON_COLUMN_KEYWORDS = new Set(['primary', 'constraint', 'check', 'unique', 'foreign']);

/** Column names of the `create table ... <table> (...)` block (leading identifier per line). */
function tableColumns(source: string, table: string): Set<string> {
  const m = new RegExp(
    `create table[^(]*\\bpublic\\.${table}\\b[^(]*\\(([\\s\\S]*?)\\n\\);`,
  ).exec(source);
  assert.ok(m, `create table public.${table} block not found`);
  const cols = new Set<string>();
  for (const rawLine of (m[1] ?? '').split('\n')) {
    const line = rawLine.replace(/--.*$/, '').trim();
    if (line === '') continue;
    const col = /^([a-z_][a-z0-9_]*)\s+\S/.exec(line);
    if (col?.[1] && !NON_COLUMN_KEYWORDS.has(col[1])) cols.add(col[1]);
  }
  return cols;
}

/** The quoted values of `check (<column> in (...))` — tolerant of a line break after `in`. */
function checkSet(source: string, column: string): string[] {
  const m = new RegExp(`check \\(${column} in\\s*\\(([^)]*)\\)\\)`).exec(source);
  assert.ok(m, `check (${column} in (...)) not found in migration`);
  return [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '');
}

test('relationship_claims columns equal the loader claim-row keys (+ DB-defaulted loaded_at)', () => {
  const rowKeys = new Set<string>(Object.keys(claimRows[0]!));
  rowKeys.add('loaded_at'); // DB-defaulted load metadata — the one column the loader never sets
  const dbColumns = new Set<string>([
    ...tableColumns(sql, 'relationship_claims'),
    ...alterAddedColumns(u4Sql, 'relationship_claims'),
  ]);
  assert.deepEqual([...dbColumns].sort(), [...rowKeys].sort());
});

test('edge_verifications columns equal the loader verification-row keys (+ loaded_at)', () => {
  const rowKeys = new Set<string>(Object.keys(verificationRows[0]!));
  rowKeys.add('loaded_at');
  const dbColumns = new Set<string>([
    ...tableColumns(sql, 'edge_verifications'),
    ...alterAddedColumns(u4Sql, 'edge_verifications'),
    ...alterAddedColumns(caveatSql, 'edge_verifications'),
  ]);
  assert.deepEqual([...dbColumns].sort(), [...rowKeys].sort());
});

// #300 §E · the caveat column and the loader row must stay joined. A caveat that reaches the
// artifact but not the column is invisible to every card — which is precisely the state this
// change fixed, and it failed silently rather than loudly.
test('#300 §E: the caveat column the migration added is written by the loader', () => {
  const verificationKeys = new Set<string>(Object.keys(verificationRows[0]!));
  for (const col of alterAddedColumns(caveatSql, 'edge_verifications')) {
    assert.ok(verificationKeys.has(col), `loader verification row does not write caveat column '${col}'`);
  }
  assert.ok(verificationKeys.has('caveat'), 'loader verification row is missing "caveat"');
});

// The point of THIS unit: the U4 columns exist AND the loader writes them. A regression that
// silently drops one from the loader's row objects would otherwise only surface as a
// permanently-null trust posture — i.e. as "the demo produces no edge cards", with no error.
test('R4-U4: every artifact/attestation column the U4 migration added is written by the loader', () => {
  const claimKeys = new Set<string>(Object.keys(claimRows[0]!));
  for (const col of alterAddedColumns(u4Sql, 'relationship_claims')) {
    assert.ok(claimKeys.has(col), `loader claim row does not write U4 column '${col}'`);
  }
  const verificationKeys = new Set<string>(Object.keys(verificationRows[0]!));
  for (const col of alterAddedColumns(u4Sql, 'edge_verifications')) {
    assert.ok(verificationKeys.has(col), `loader verification row does not write U4 column '${col}'`);
  }
  // …and the five attestation columns specifically, named, so a rename in the migration that
  // the loader does not follow fails here rather than at a hosted run.
  for (const col of [
    'attestation_returned_model',
    'attestation_returned_version',
    'attestation_family',
    'attestation_decorrelated',
    'attestation_attested',
  ]) {
    assert.ok(verificationKeys.has(col), `loader verification row is missing '${col}'`);
  }
});

test('relation / verdict / status CHECK sets equal the shared/brain zod enums', () => {
  assert.deepEqual(checkSet(sql, 'relation'), relationKindSchema.options);
  assert.deepEqual(checkSet(sql, 'verdict'), verdictSchema.options);
  assert.deepEqual(checkSet(sql, 'status'), verificationStatusSchema.options);
});

test('serving_band CHECK covers exactly the shared/brain servingBand range (EDGE_GATES + hold)', () => {
  assert.deepEqual(checkSet(sql, 'serving_band').sort(), ['high', 'hold', 'mid']);
  for (const band of Object.keys(brain.EDGE_GATES)) {
    assert.ok(checkSet(sql, 'serving_band').includes(band), `EDGE_GATES band '${band}' missing`);
  }
});

test('verified_edges view: security_invoker, active-only, newest verification per edge', () => {
  const view = /create or replace view public\.verified_edges([\s\S]*?);/.exec(sql);
  assert.ok(view, 'verified_edges view not found');
  const body = view[1]!;
  assert.match(body, /security_invoker = true/);
  assert.match(body, /select distinct on \(c\.edge_id\)/);
  assert.match(body, /where v\.status = 'active'/);
  assert.match(body, /order by c\.edge_id, v\.verified_at desc/);
});

// The A16 hygiene migration (U25) must drop/recreate verified_edges around its edge_score
// type change — Postgres refuses to alter a column a view depends on. The view definition
// now exists in TWO migration files; this pins them character-identical so the serving
// semantics can never fork between the create-table migration and the amendment.
test('A16 hygiene migration recreates verified_edges character-identical to the S6 original', () => {
  const hygieneFile = readdirSync(migrationsDir).find((f) =>
    /constraint_hygiene_checks_and_edge_score_precision\.sql$/.test(f),
  );
  assert.ok(hygieneFile, 'A16/A17 constraint hygiene migration not found in supabase/migrations');
  const hygieneSql = readFileSync(path.join(migrationsDir, hygieneFile), 'utf8');
  // CRLF-normalized: the two files may sit at different line-ending states of a Windows checkout.
  const viewBlock = (source: string) =>
    /create or replace view public\.verified_edges[\s\S]*?;/.exec(source.replace(/\r\n/g, '\n'))?.[0];
  assert.ok(viewBlock(hygieneSql), 'verified_edges recreation not found in the hygiene migration');
  assert.equal(viewBlock(hygieneSql), viewBlock(sql));
  // The migration must widen edge_score to unconstrained numeric (no precision cap to round
  // the loader's float) — the A16 fix itself.
  assert.match(hygieneSql, /alter column edge_score type numeric;/);
});
