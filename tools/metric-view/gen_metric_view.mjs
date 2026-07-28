#!/usr/bin/env node
// tools/metric-view/gen_metric_view.mjs — the S2 view generator CLI
// (insight-engine-architecture §S2; view logic in ./lib/view.mjs).
//
// shared/metrics/registry.ts (TRUTH) → deterministic `metric_daily_values` view SQL.
//
// Usage:
//   node tools/metric-view/gen_metric_view.mjs            # print the SQL to stdout
//   node tools/metric-view/gen_metric_view.mjs --write    # write a NEW migration target only
//   node tools/metric-view/gen_metric_view.mjs --check    # diff vs the committed migration (drift guard)
//
// Root package.json aliases: `npm run view:gen` / `npm run view:check`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { generateViewSql, REPO_ROOT, VIEW_MIGRATION_RELPATH } from './lib/view.mjs';

const args = new Set(process.argv.slice(2));
const sql = generateViewSql();
const migrationPath = path.join(REPO_ROOT, ...VIEW_MIGRATION_RELPATH.split('/'));

if (args.has('--write')) {
  if (existsSync(migrationPath)) {
    console.error(
      `✗ refusing to overwrite landed migration ${VIEW_MIGRATION_RELPATH} — ` +
        `first set VIEW_MIGRATION_RELPATH to a new timestamped, nonexistent migration`,
    );
    process.exit(1);
  }
  writeFileSync(migrationPath, sql);
  console.log(`✓ wrote ${VIEW_MIGRATION_RELPATH}`);
} else if (args.has('--check')) {
  let committed;
  try {
    committed = readFileSync(migrationPath, 'utf8');
  } catch {
    console.error(`✗ ${VIEW_MIGRATION_RELPATH} is missing — generate it with --write`);
    process.exit(1);
  }
  // CRLF-tolerant compare (Windows checkouts), byte-identical otherwise.
  if (committed.replace(/\r\n/g, '\n') === sql) {
    console.log(`✓ ${VIEW_MIGRATION_RELPATH} matches the registry-generated SQL`);
  } else {
    console.error(
      `✗ ${VIEW_MIGRATION_RELPATH} has drifted from shared/metrics/registry.ts — ` +
        `do not overwrite it; point VIEW_MIGRATION_RELPATH at a new timestamped migration`,
    );
    process.exit(1);
  }
} else {
  process.stdout.write(sql);
}
