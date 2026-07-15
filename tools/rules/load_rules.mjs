#!/usr/bin/env node
// tools/rules/load_rules.mjs — the B3 rules loader (rules-engine-design §B3, memory 0007).
//
// data/rules/**.json (TRUTH) → validate (zod contract + copy gate + registry keys, HARD FAIL on
// any violation) → flatten + content-hash → TRANSACTIONAL full-rebuild of the derived `rules`
// table: upsert on (rule_id), then prune rows whose blueprint is gone. Deterministic, batch,
// no LLM. Same input → same rows (only loaded_at, load metadata, moves).
//
// Usage:
//   node tools/rules/load_rules.mjs               # validate + load (needs SUPABASE_DB_URL)
//   node tools/rules/load_rules.mjs --dry-run     # validate + print rows, no DB
//   node tools/rules/load_rules.mjs --check       # alias of --dry-run for CI
//   SUPABASE_DB_URL=postgresql://...  (local stack: `npx supabase status` → DB URL)
//
// Root package.json aliases: `npm run rules:load` / `npm run rules:check`.

import process from 'node:process';
import { buildRows, RULES_DIR } from './lib/blueprints.mjs';

const COLUMNS = [
  'rule_id',
  'schema_version',
  'scope',
  'metric_keys',
  'condition_type',
  'condition_params',
  'title_template',
  'body_template',
  'severity',
  'category',
  'enabled_phase',
  'provenance_tier',
  'source_citation',
  'effective_from',
  'effective_to',
  'status',
  'deprecated_at',
  'cooldown_days',
  'expiry_days',
  'content_hash',
];

function upsertSql() {
  const params = COLUMNS.map((c, i) =>
    c === 'condition_params' || c === 'source_citation' ? `$${i + 1}::jsonb` : `$${i + 1}`,
  );
  const updates = COLUMNS.filter((c) => c !== 'rule_id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return (
    `insert into public.rules (${COLUMNS.join(', ')}, loaded_at) ` +
    `values (${params.join(', ')}, now()) ` +
    `on conflict (rule_id) do update set ${updates}, loaded_at = now()`
  );
}

function rowParams(row) {
  return COLUMNS.map((c) =>
    c === 'condition_params' || c === 'source_citation' ? JSON.stringify(row[c]) : row[c],
  );
}

async function loadIntoDb(rows, dbUrl) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('begin');
    const sql = upsertSql();
    for (const row of rows) {
      await client.query(sql, rowParams(row));
    }
    const ruleIds = rows.map((r) => r.rule_id);
    const pruned = await client.query(
      'delete from public.rules where not (rule_id = any($1::text[])) returning rule_id',
      [ruleIds],
    );
    await client.query('commit');
    const count = await client.query('select count(*)::int as n from public.rules');
    return { pruned: pruned.rows.map((r) => r.rule_id), total: count.rows[0].n };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run') || args.has('--check');

  const { rows, errors } = buildRows();

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} blueprint error(s) in ${RULES_DIR}:`);
    for (const { relPath, message } of errors) console.error(`  - ${relPath}: ${message}`);
    console.error('Nothing loaded — fix the blueprints (TRUTH) and re-run.');
    process.exit(1);
  }

  console.log(`✓ ${rows.length} blueprint(s) valid (schema + copy gate + registry keys)`);
  for (const row of rows) {
    console.log(
      `  - ${row.rule_id} [${row.scope}/${row.category}] ${row.condition_type} ` +
        `(${row.metric_keys.join(', ')}) ${row.content_hash.slice(0, 12)}`,
    );
  }

  if (dryRun) {
    console.log('Dry run — no database writes.');
    return;
  }

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error(
      'SUPABASE_DB_URL is not set (local stack: `npx supabase status` → DB URL). ' +
        'Use --dry-run to validate without a database.',
    );
    process.exit(1);
  }

  const { pruned, total } = await loadIntoDb(rows, dbUrl);
  console.log(`✓ upserted ${rows.length} rule(s); pruned ${pruned.length}` +
    (pruned.length ? ` (${pruned.join(', ')})` : ''));
  console.log(`✓ rules table now holds ${total} row(s)`);
}

await main();
