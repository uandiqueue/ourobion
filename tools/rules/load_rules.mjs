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
//   ... --allow-empty                             # A14: an EMPTY validated blueprint set otherwise
//                                                 # aborts (exit 1, no prune) — this flag lets it
//                                                 # legitimately empty the rules table
//   ... --rules-dir <dir>                         # blueprint tree override (default data/rules —
//                                                 # tests/ops only)
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

function parseArgs(argv) {
  const args = { dryRun: false, allowEmpty: false, rulesDir: RULES_DIR };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--check') args.dryRun = true;
    else if (a === '--allow-empty') args.allowEmpty = true;
    else if (a === '--rules-dir') {
      args.rulesDir = argv[++i];
      if (!args.rulesDir) throw new Error('--rules-dir needs a directory path');
    } else throw new Error(`unknown argument '${a}'`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }
  const { dryRun } = args;

  const { rows, errors } = buildRows(args.rulesDir);

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} blueprint error(s) in ${args.rulesDir}:`);
    for (const { relPath, message } of errors) console.error(`  - ${relPath}: ${message}`);
    console.error('Nothing loaded — fix the blueprints (TRUTH) and re-run.');
    process.exit(1);
  }

  // A14 empty-set guard: the end-of-run prune makes the rules table a pure function of the
  // blueprint set, so a zero-blueprint input (e.g. a checkout where the scope dirs are missing —
  // discoverBlueprintFiles returns [] rather than erroring) would wipe every rules row. Refuse
  // (exit 1, nothing written, no prune) unless the operator states the intent with --allow-empty.
  // Fires in --dry-run/--check too, so the check verdict mirrors what a real run would do.
  if (rows.length === 0 && !args.allowEmpty) {
    console.error(
      `✗ validated blueprint set is EMPTY (${args.rulesDir}) — refusing to load: the prune would ` +
        'wipe every rules row. If the blueprint set really is empty (not a missing or mis-pointed ' +
        'tree), re-run with --allow-empty.',
    );
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
