// ourobion nao — D1 search-index ETL (off-Workers Node script).
//
// Reads the truth-tier manifest `manifest/papers.jsonl` from R2 over the
// S3-compatible HTTP API (using the R2_* S3 creds from apps/nao/.env, projected
// into .dev.vars by gen-env), maps each PaperRecord line to a `papers` row, and
// UPSERTs the corpus into D1 via `wrangler d1 execute`. This script runs LOCALLY
// or in CI — never inside the Worker (the Worker has no S3 creds; it uses the
// native CORPUS binding). The D1 index is a DERIVED, rebuildable projection.
//
// No npm dependency: R2 is reached with hand-rolled AWS SigV4 over global fetch,
// and SQL is generated as text — so this works from the apps/nao package as-is.
//
// ── RUN ──────────────────────────────────────────────────────────────────────
//   # 1. ensure secrets exist (apps/nao/.env has R2_ENDPOINT/R2_ACCESS_KEY_ID/
//   #    R2_SECRET_ACCESS_KEY/R2_BUCKET) and the schema is applied:
//   npm run gen-env
//   npx wrangler d1 execute ourobion-nao-index --local --file=src/db/schema.sql
//
//   # 2. build the index (writes SQL then pipes it through wrangler):
//   npm run etl                 # local D1   (default)
//   npm run etl -- --remote     # remote D1  (requires wrangler auth — opt in)
//   npm run etl -- --sql-only   # just emit scratch/etl.sql, run nothing
//
// Idempotent: each row is an INSERT ... ON CONFLICT(paper_uid) DO UPDATE, so a
// re-run refreshes existing rows and adds new ones without duplication.

import { createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');

const MANIFEST_KEY = 'manifest/papers.jsonl';
const D1_NAME = 'ourobion-nao-index';

// ─────────────────────────────────────────────────────────────────────────────
// Config — read R2 S3 creds from .dev.vars (generated) or .env (source).
// ─────────────────────────────────────────────────────────────────────────────
function loadEnv() {
  const files = [resolve(appRoot, '.dev.vars'), resolve(appRoot, '.env')];
  const env = {};
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k !== '' && env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS SigV4 (s3) GET — minimal signer for a single R2 object fetch.
// ─────────────────────────────────────────────────────────────────────────────
function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

async function r2GetObject(env, key) {
  const endpoint = env.R2_ENDPOINT;
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error(
      'etl: missing R2 creds — need R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET in .dev.vars or .env',
    );
  }

  const url = new URL(`${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`);
  const host = url.host;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex('');

  // canonical path: path-style, each segment encoded but '/' preserved
  const canonicalUri = url.pathname
    .split('/')
    .map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()))
    .join('/');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`etl: R2 GET ${key} failed: ${res.status} ${res.statusText}\n${body.slice(0, 500)}`);
  }
  return res.text();
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mapping — PaperRecord (one manifest line) → `papers` column object.
// Exported pure helpers so tests/d1.test.ts can exercise mapping + SQL offline.
// ─────────────────────────────────────────────────────────────────────────────

/** Map a parsed PaperRecord into the flat `papers` row shape (snake_case keys). */
export function recordToRow(rec) {
  const ids = rec.identifiers ?? {};
  const oa = rec.oa ?? {};
  const metrics = rec.metrics ?? undefined;
  const journal = rec.journal ?? undefined;
  const fullText = rec.fullText ?? {};
  const storage = rec.storage ?? {};
  return {
    paper_uid: String(rec.paperUid),
    title: rec.title ?? '',
    authors_json: JSON.stringify(Array.isArray(rec.authors) ? rec.authors : []),
    year: typeof rec.year === 'number' ? rec.year : null,
    venue: rec.venue ?? null,
    abstract: rec.abstract ?? null,
    oa_status: oa.status ?? 'unknown',
    retrievability: rec.retrievability ?? 'unknown',
    work_type: rec.workType ?? null,
    cited_by_count:
      metrics && typeof metrics.citedByCount === 'number' ? metrics.citedByCount : null,
    journal_publisher: journal && journal.publisher ? journal.publisher : null,
    topic_tags: JSON.stringify(Array.isArray(rec.topicTags) ? rec.topicTags : []),
    concepts: JSON.stringify(Array.isArray(rec.concepts) ? rec.concepts : []),
    doi: ids.doi ?? null,
    pmid: ids.pmid ?? null,
    pmcid: ids.pmcid ?? null,
    status: rec.status ?? 'discovered',
    discovered_via: rec.discoveredVia ?? null,
    full_text_extracted: fullText.extracted === true ? 1 : 0,
    full_text_method: fullText.method ?? null,
    full_text_char_count:
      typeof fullText.charCount === 'number' ? fullText.charCount : null,
    storage_kind: storage.kind ?? null,
    storage_size_bytes: typeof storage.sizeBytes === 'number' ? storage.sizeBytes : null,
    fetched_at: rec.fetchedAt ?? null,
  };
}

/** SQL-quote a JS value: NULL, number, or single-quote-escaped string literal. */
export function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const ROW_COLUMNS = [
  'paper_uid', 'title', 'authors_json', 'year', 'venue', 'abstract', 'oa_status',
  'retrievability', 'work_type', 'cited_by_count', 'journal_publisher', 'topic_tags',
  'concepts', 'doi', 'pmid', 'pmcid', 'status',
  'discovered_via', 'full_text_extracted', 'full_text_method', 'full_text_char_count',
  'storage_kind', 'storage_size_bytes', 'fetched_at',
];

/** One idempotent UPSERT statement for a mapped row (string-literal values). */
export function rowToUpsertSql(row) {
  const cols = ROW_COLUMNS.join(', ');
  const vals = ROW_COLUMNS.map((c) => sqlValue(row[c])).join(', ');
  const updates = ROW_COLUMNS.filter((c) => c !== 'paper_uid')
    .map((c) => `${c}=excluded.${c}`)
    .join(', ');
  return `INSERT INTO papers (${cols}) VALUES (${vals}) ON CONFLICT(paper_uid) DO UPDATE SET ${updates};`;
}

/** Parse a JSONL manifest body → array of UPSERT statements (skips blank/bad lines). */
export function manifestToSql(jsonl) {
  const stmts = [];
  let lineNo = 0;
  for (const raw of jsonl.split(/\r?\n/)) {
    lineNo += 1;
    const line = raw.trim();
    if (line === '') continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      console.warn(`[etl] WARN: skipping unparseable manifest line ${lineNo}`);
      continue;
    }
    if (!rec || typeof rec.paperUid !== 'string') {
      console.warn(`[etl] WARN: skipping line ${lineNo} (no paperUid)`);
      continue;
    }
    stmts.push(rowToUpsertSql(recordToRow(rec)));
  }
  return stmts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const sqlOnly = args.includes('--sql-only');
  const remote = args.includes('--remote');
  const env = loadEnv();

  console.log(`[etl] fetching ${MANIFEST_KEY} from R2 …`);
  const jsonl = await r2GetObject(env, MANIFEST_KEY);
  const stmts = manifestToSql(jsonl);
  console.log(`[etl] mapped ${stmts.length} paper rows.`);

  const sql = ['BEGIN TRANSACTION;', ...stmts, 'COMMIT;'].join('\n') + '\n';
  const scratchDir = resolve(appRoot, 'scratch');
  if (!existsSync(scratchDir)) mkdirSync(scratchDir, { recursive: true });
  const sqlPath = resolve(scratchDir, 'etl.sql');
  writeFileSync(sqlPath, sql);
  console.log(`[etl] wrote ${sqlPath}`);

  if (sqlOnly) {
    console.log('[etl] --sql-only: not executing. Apply with wrangler d1 execute --file.');
    return;
  }

  const wranglerArgs = [
    'wrangler', 'd1', 'execute', D1_NAME,
    remote ? '--remote' : '--local',
    `--file=${sqlPath}`,
  ];
  console.log(`[etl] npx ${wranglerArgs.join(' ')}`);
  const res = spawnSync('npx', wranglerArgs, {
    cwd: appRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    throw new Error(`etl: wrangler d1 execute exited ${res.status}`);
  }
  console.log('[etl] done.');
}

// Only run when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
