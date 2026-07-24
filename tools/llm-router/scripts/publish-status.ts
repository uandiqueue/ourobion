#!/usr/bin/env tsx
/**
 * O10 publisher (run-2 U8): project the two file-backed sources of truth —
 * router.config.json + data/llm-router/ledger.json — into the Supabase read
 * boundaries nao's /models panel consumes:
 *
 *   llm_router_status  (one row per node; upsert on node)
 *   llm_router_spend   (one row per (day, node); upsert on day,node)
 *
 * TWO-TIER TRUTH: the files stay canonical; the tables are rebuildable
 * snapshots stamped with a single published_at per run (nao shows a stale
 * hint when it ages). Publishing is an EXPLICIT script this cycle — the
 * router does NOT auto-publish per call (candidate improvement, noted in the
 * U8 session log).
 *
 * ENV SOURCING (documented): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 * read from process.env first; when absent, from apps/nao/.dev.vars — the
 * gitignored file apps/nao/scripts/gen-env.mjs generates from apps/nao/.env,
 * which locally carries the values `npx supabase status` prints (that is the
 * established server-side env convention since U6's run-pipeline relay).
 * Service key only — this is the service_role write path for the projections.
 *
 * Run from an activated toolchain shell:
 *   cd tools/llm-router && npx tsx scripts/publish-status.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { LedgerFile } from '../src/budget.js';
import { loadConfig, repoRoot, resolveRepoPath } from '../src/config.js';
import { buildStatusRows } from '../src/publish.js';

/** Minimal dotenv parse (same helper shape as scripts/smoke-openai.ts). */
function envValue(envPath: string, key: string): string | undefined {
  if (!existsSync(envPath)) return undefined;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m === null || m[1] !== key) continue;
    const raw = m[2]!.trim();
    const unquoted = /^(['"])(.*)\1$/.exec(raw);
    return unquoted !== null ? unquoted[2] : raw;
  }
  return undefined;
}

/** process.env first, then apps/nao/.dev.vars (the U6 local convention). */
function resolveEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (fromProcess !== undefined && fromProcess.length > 0) return fromProcess;
  return envValue(resolve(repoRoot(), 'apps', 'nao', '.dev.vars'), key);
}

async function upsert(
  baseUrl: string,
  serviceKey: string,
  table: string,
  onConflict: string,
  rows: unknown[],
): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(
    `${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    throw new Error(`${table} upsert failed: HTTP ${res.status} ${(await res.text()).slice(0, 500)}`);
  }
}

async function main(): Promise<number> {
  const baseUrl = resolveEnv('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceKey = resolveEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (baseUrl === undefined || serviceKey === undefined) {
    console.error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in process.env or apps/nao/.dev.vars.\n' +
        'Locally: `npx supabase status` prints both; apps/nao `npm run gen-env` projects them\n' +
        'from apps/nao/.env into apps/nao/.dev.vars.',
    );
    return 1;
  }

  const config = loadConfig(); // TEST-MODE warning (if any) prints here — deliberate.
  const ledgerPath = resolveRepoPath(config.budget.ledgerPath);
  let ledger: LedgerFile = { version: 1, days: {}, runs: {} };
  if (existsSync(ledgerPath)) {
    ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as LedgerFile;
  } else {
    console.warn(`ledger file ${ledgerPath} not found — publishing config only (0 spend rows).`);
  }

  const publishedAt = new Date().toISOString();
  const { status, spend } = buildStatusRows(config, ledger, publishedAt);

  await upsert(baseUrl, serviceKey, 'llm_router_status', 'node', status);
  await upsert(baseUrl, serviceKey, 'llm_router_spend', 'day,node', spend);

  console.log(`published_at=${publishedAt}`);
  console.log(`llm_router_status: upserted ${status.length} node rows (test_mode=${status[0]?.test_mode})`);
  console.log(`llm_router_spend:  upserted ${spend.length} (day,node) rows`);
  for (const row of spend) {
    console.log(
      `  ${row.day} ${row.node.padEnd(17)} calls=${row.calls} in=${row.tokens_in} out=${row.tokens_out} usd=${row.usd}`,
    );
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error('PUBLISH FAILED:', err);
    process.exitCode = 1;
  },
);
