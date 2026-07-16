#!/usr/bin/env node
// tools/edge-loader/load_edges.mjs — the A11 edge loader (insight-engine-architecture §A11/§S6).
//
// Truth-tier edge artifacts (edges/claims.jsonl + edges/verifications.jsonl — R2, or a local
// mirror directory for offline runs) → validate every line against the shared/brain zod contract
// (HARD FAIL with line numbers on any violation) → join verifications to claims by edgeId →
// precompute edge_score / serving_band via shared/brain edgeScore / servingBand → TRANSACTIONAL
// projection into the S6 tables: claims upsert on edge_id, verifications upsert on
// (edge_id, verified_at) — prior active verifications of an edge land/flip 'superseded' — then
// prune rows whose artifact line is gone. The tables end up a pure function of the current
// artifact set (full rebuild every run — they are a DERIVED projection, docs/memory/0001).
// Deterministic, batch, no LLM.
//
// Usage:
//   node tools/edge-loader/load_edges.mjs --from-dir <dir>   # local mirror of the R2 edges/ prefix
//   node tools/edge-loader/load_edges.mjs --from-r2          # R2_ENDPOINT / R2_ACCESS_KEY_ID /
//                                                            # R2_SECRET_ACCESS_KEY / R2_BUCKET
//   ... --dry-run | --check                                  # validate + print rows, no DB
//   SUPABASE_DB_URL=postgresql://...  (local stack: `npx supabase status` → DB URL)
//
// A local directory holds the same basenames the R2 `edges/` prefix does (claims.jsonl +
// verifications.jsonl). claims.jsonl must exist; a missing verifications.jsonl is a legitimate
// early state (claims synthesised, verifier not yet run) and loads zero verifications.
//
// Root package.json aliases: `npm run edges:load` / `npm run edges:check` / `npm run edges:test`.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  buildLoad,
  CLAIMS_BASENAME,
  VERIFICATIONS_BASENAME,
  R2_CLAIMS_KEY,
  R2_VERIFICATIONS_KEY,
} from './lib/artifacts.mjs';

const CLAIM_COLUMNS = [
  'edge_id',
  'subject',
  'object',
  'relation',
  'claim',
  'prompt_version',
  'synthesised_at',
];

const VERIFICATION_COLUMNS = [
  'edge_id',
  'verified_at',
  'verification',
  'verdict',
  'status',
  'edge_score',
  'serving_band',
];

const JSONB_COLUMNS = new Set(['claim', 'verification']);

// ── artifact sources ─────────────────────────────────────────────────────────────────────────────

function readFromDir(dir) {
  const claimsPath = path.join(dir, CLAIMS_BASENAME);
  const verificationsPath = path.join(dir, VERIFICATIONS_BASENAME);
  if (!existsSync(claimsPath)) {
    throw new Error(`no ${CLAIMS_BASENAME} in '${dir}' — is this a mirror of the R2 edges/ prefix?`);
  }
  const claimsText = readFileSync(claimsPath, 'utf8');
  let verificationsText = '';
  if (existsSync(verificationsPath)) {
    verificationsText = readFileSync(verificationsPath, 'utf8');
  } else {
    console.warn(`! no ${VERIFICATIONS_BASENAME} in '${dir}' — loading claims only (nothing servable)`);
  }
  return { claimsText, verificationsText, sourceLabel: `dir ${dir}` };
}

async function readFromR2() {
  const required = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`--from-r2 needs env vars: ${missing.join(', ')} (tools/brain-ingest env names)`);
  }
  // Same client settings as tools/brain-ingest/src/storage/r2.ts (R2 is S3-compatible).
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const bucket = process.env.R2_BUCKET;
  const getText = async (key, { optional = false } = {}) => {
    try {
      const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return await out.Body.transformToString('utf-8');
    } catch (err) {
      const notFound =
        err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
      if (notFound && optional) {
        console.warn(`! r2: no ${key} — loading claims only (nothing servable)`);
        return '';
      }
      throw err;
    }
  };
  const claimsText = await getText(R2_CLAIMS_KEY);
  const verificationsText = await getText(R2_VERIFICATIONS_KEY, { optional: true });
  return { claimsText, verificationsText, sourceLabel: `r2 ${bucket}` };
}

// ── database projection ──────────────────────────────────────────────────────────────────────────

function upsertClaimSql() {
  const params = CLAIM_COLUMNS.map((c, i) => (JSONB_COLUMNS.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`));
  const updates = CLAIM_COLUMNS.filter((c) => c !== 'edge_id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return (
    `insert into public.relationship_claims (${CLAIM_COLUMNS.join(', ')}, loaded_at) ` +
    `values (${params.join(', ')}, now()) ` +
    `on conflict (edge_id) do update set ${updates}, loaded_at = now()`
  );
}

function upsertVerificationSql() {
  const params = VERIFICATION_COLUMNS.map((c, i) =>
    JSONB_COLUMNS.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`,
  );
  // §A11 sketches `on conflict do nothing` (the artifacts are append-only, so a landed version's
  // content never changes) — but the computed status/serving columns DO move when a newer active
  // verification arrives, so this upserts: the tables stay a pure function of the current
  // artifact set (upsert + prune == full rebuild), including the supersede flip of rows landed
  // by prior runs.
  const updates = VERIFICATION_COLUMNS.filter((c) => c !== 'edge_id' && c !== 'verified_at')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return (
    `insert into public.edge_verifications (${VERIFICATION_COLUMNS.join(', ')}, loaded_at) ` +
    `values (${params.join(', ')}, now()) ` +
    `on conflict (edge_id, verified_at) do update set ${updates}, loaded_at = now()`
  );
}

function rowParams(columns, row) {
  return columns.map((c) => (JSONB_COLUMNS.has(c) ? JSON.stringify(row[c]) : row[c]));
}

async function loadIntoDb(claimRows, verificationRows, dbUrl) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('begin');

    const claimSql = upsertClaimSql();
    for (const row of claimRows) await client.query(claimSql, rowParams(CLAIM_COLUMNS, row));

    const verSql = upsertVerificationSql();
    for (const row of verificationRows) await client.query(verSql, rowParams(VERIFICATION_COLUMNS, row));

    // Prune: the artifacts are the whole truth — drop projection rows whose line is gone.
    const prunedVer = await client.query(
      `delete from public.edge_verifications v
        where not exists (
          select 1 from unnest($1::text[], $2::timestamptz[]) as k(edge_id, verified_at)
           where k.edge_id = v.edge_id and k.verified_at = v.verified_at)
        returning v.edge_id, v.verified_at`,
      [verificationRows.map((r) => r.edge_id), verificationRows.map((r) => r.verified_at)],
    );
    const prunedClaims = await client.query(
      'delete from public.relationship_claims where not (edge_id = any($1::text[])) returning edge_id',
      [claimRows.map((r) => r.edge_id)],
    );

    await client.query('commit');
    const counts = await client.query(
      `select (select count(*)::int from public.relationship_claims) as claims,
              (select count(*)::int from public.edge_verifications) as verifications,
              (select count(*)::int from public.verified_edges) as verified`,
    );
    return {
      prunedClaims: prunedClaims.rows.map((r) => r.edge_id),
      prunedVerifications: prunedVer.rows.length,
      totals: counts.rows[0],
    };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, fromDir: null, fromR2: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--check') args.dryRun = true;
    else if (a === '--from-r2') args.fromR2 = true;
    else if (a === '--from-dir') {
      args.fromDir = argv[++i];
      if (!args.fromDir) throw new Error('--from-dir needs a directory path');
    } else throw new Error(`unknown argument '${a}'`);
  }
  if (args.fromDir && args.fromR2) throw new Error('pass --from-dir OR --from-r2, not both');
  if (!args.fromDir && !args.fromR2) {
    throw new Error('pass an artifact source: --from-dir <dir> (local mirror) or --from-r2');
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

  const { claimsText, verificationsText, sourceLabel } = args.fromDir
    ? readFromDir(args.fromDir)
    : await readFromR2();

  const { claimRows, verificationRows, errors } = buildLoad(claimsText, verificationsText);

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} artifact error(s) (${sourceLabel}):`);
    for (const { source, line, message } of errors) console.error(`  - ${source}:${line}: ${message}`);
    console.error('Nothing loaded — fix the artifacts (TRUTH tier) / their producer and re-run.');
    process.exit(1);
  }

  const activeByEdge = new Map(
    verificationRows.filter((r) => r.status === 'active').map((r) => [r.edge_id, r]),
  );
  console.log(
    `✓ ${claimRows.length} claim(s) + ${verificationRows.length} verification(s) valid ` +
      '(shared/brain contract + active registry endpoints)',
  );
  for (const row of claimRows) {
    const active = activeByEdge.get(row.edge_id);
    const gate = active
      ? `${active.serving_band} @ ${active.edge_score.toFixed(3)} (${active.verdict}, ${active.verified_at})`
      : 'no active verification — not servable';
    console.log(`  - ${row.edge_id} → ${gate}`);
  }

  if (args.dryRun) {
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

  const superseded = verificationRows.filter(
    (r) => r.status === 'superseded' && r.verification.status === 'active',
  ).length;
  const result = await loadIntoDb(claimRows, verificationRows, dbUrl);
  console.log(
    `✓ upserted ${claimRows.length} claim(s) + ${verificationRows.length} verification(s) ` +
      `(${superseded} flipped superseded); pruned ${result.prunedClaims.length} claim(s)` +
      (result.prunedClaims.length ? ` (${result.prunedClaims.join(', ')})` : '') +
      ` + ${result.prunedVerifications} verification(s)`,
  );
  console.log(
    `✓ store now holds ${result.totals.claims} claim(s), ${result.totals.verifications} ` +
      `verification(s), ${result.totals.verified} verified edge(s)`,
  );
}

await main();
