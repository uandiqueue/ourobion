#!/usr/bin/env node
// tools/edge-loader/load_edges.mjs — the A11 edge loader (insight-engine-architecture §A11/§S6).
//
// Truth-tier edge artifacts (edges/claims.jsonl + edges/verifications.jsonl — R2, or a local
// mirror directory for offline runs) → validate every line against the shared/brain zod contract
// (HARD FAIL with line numbers on any violation) → join verifications to claims by edgeId →
// precompute edge_score / serving_band via shared/brain edgeScore / servingBand → project the
// R4-U4/O27 artifact-trust + model-attestation columns verbatim from the artifact (NULL, i.e.
// UNTRUSTED, when the artifact asserts none — never derived) → TRANSACTIONAL
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
//   ... --allow-empty                                        # A14: an EMPTY validated artifact set
//                                                            # otherwise aborts (exit 1, no prune) —
//                                                            # this flag lets it legitimately empty
//                                                            # the projection tables
//   ... --db-url postgresql://localhost/... --no-prune        # explicit DB URL / incremental upsert;
//                                                            # default remains full-projection prune
//   SUPABASE_DB_URL=postgresql://...  (local stack: `npx supabase status` → DB URL)
//
// A local directory holds the same basenames the R2 `edges/` prefix does (claims.jsonl +
// verifications.jsonl). claims.jsonl must exist; a missing verifications.jsonl is a legitimate
// early state (claims synthesised, verifier not yet run) and loads zero verifications.
//
// Root package.json aliases: `npm run edges:load` / `npm run edges:check` / `npm run edges:test`.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  brain,
  buildLoad,
  CLAIMS_BASENAME,
  VERIFICATIONS_BASENAME,
  R2_CLAIMS_KEY,
  R2_VERIFICATIONS_KEY,
} from './lib/artifacts.mjs';

// R4-U4/O27 (20260728030000_r4u4_artifact_trust_and_revision_bound_disposition.sql): the
// artifact/attestation columns are written by the loader from here on — the U4 migration
// deliberately left population to this follow-on. Order matters only in that it must match
// the row-object keys the artifacts.mjs pipeline emits; the SQL builders below derive their
// placeholders from these arrays, so adding a name here is the whole change.
const CLAIM_COLUMNS = [
  'edge_id',
  'subject',
  'object',
  'relation',
  'claim',
  'prompt_version',
  'synthesised_at',
  'artifact_revision',
  'artifact_content_hash',
  'artifact_posture',
];

const VERIFICATION_COLUMNS = [
  'edge_id',
  'verified_at',
  'verification',
  'verdict',
  'status',
  'edge_score',
  'serving_band',
  'artifact_revision',
  'artifact_content_hash',
  'artifact_posture',
  'attestation_returned_model',
  'attestation_returned_version',
  'attestation_family',
  'attestation_decorrelated',
  'attestation_attested',
];

const JSONB_COLUMNS = new Set(['claim', 'verification']);

// ── artifact sources ─────────────────────────────────────────────────────────────────────────────

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function expectedArtifactHashes(required) {
  const claims = process.env.OUROBION_EXPECTED_CLAIMS_SHA256?.trim();
  const verifications = process.env.OUROBION_EXPECTED_VERIFICATIONS_SHA256?.trim();
  if (!claims && !verifications && !required) return null;
  if (!claims || !verifications) throw new Error('expected artifact hashes must include both claims and verifications');
  if (!/^[a-f0-9]{64}$/i.test(claims) || !/^[a-f0-9]{64}$/i.test(verifications)) {
    throw new Error('expected artifact hashes must be 64 hexadecimal SHA-256 values');
  }
  return { claims: claims.toLowerCase(), verifications: verifications.toLowerCase() };
}

function readFromDir(dir, expected) {
  const claimsPath = path.join(dir, CLAIMS_BASENAME);
  const verificationsPath = path.join(dir, VERIFICATIONS_BASENAME);
  if (!existsSync(claimsPath)) {
    throw new Error(`no ${CLAIMS_BASENAME} in '${dir}' — is this a mirror of the R2 edges/ prefix?`);
  }
  // Hash and parse the exact same in-memory bytes: no check/use second read.
  const claimsBytes = readFileSync(claimsPath);
  const claimsText = claimsBytes.toString('utf8');
  let verificationsText = '';
  let verificationsBytes = null;
  if (existsSync(verificationsPath)) {
    verificationsBytes = readFileSync(verificationsPath);
    verificationsText = verificationsBytes.toString('utf8');
  } else {
    if (expected) throw new Error(`expected artifact ${VERIFICATIONS_BASENAME} is missing`);
    console.warn(`! no ${VERIFICATIONS_BASENAME} in '${dir}' — loading claims only (nothing servable)`);
  }
  if (expected) {
    if (verificationsBytes === null) throw new Error(`expected artifact ${VERIFICATIONS_BASENAME} is missing`);
    if (sha256(claimsBytes) !== expected.claims || sha256(verificationsBytes) !== expected.verifications) {
      throw new Error('local edge artifact SHA-256 mismatch; nothing loaded');
    }
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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('cannot compare undefined database content');
  return encoded;
}

/**
 * Incremental mode is deliberately collision-intolerant: an edge id already in
 * the local projection may only be re-presented with byte-equivalent canonical
 * claim content. All comparisons and verification ordering checks happen before
 * the first mutation, inside one transaction.
 */
async function planIncremental(client, claimRows, verificationRows) {
  const claimsToWrite = [];
  for (const row of claimRows) {
    const existing = await client.query(
      'select claim from public.relationship_claims where edge_id = $1 for update',
      [row.edge_id],
    );
    if (existing.rows.length === 0) claimsToWrite.push(row);
    else if (canonicalJson(existing.rows[0].claim) !== canonicalJson(row.claim)) {
      throw new Error(`${row.edge_id}: --no-prune refuses to replace materially different claim content`);
    }
  }

  const verificationsToWrite = [];
  const supersede = [];
  for (const row of verificationRows) {
    const existing = await client.query(
      `select verified_at, verification, status
         from public.edge_verifications
        where edge_id = $1
        for update`,
      [row.edge_id],
    );
    const sameInstant = existing.rows.find(
      (current) => new Date(current.verified_at).toISOString() === new Date(row.verified_at).toISOString(),
    );
    if (sameInstant) {
      if (canonicalJson(sameInstant.verification) !== canonicalJson(row.verification)) {
        throw new Error(`${row.edge_id}: --no-prune verification identity has different content`);
      }
      continue;
    }
    if (row.status === 'active') {
      const incomingAt = Date.parse(row.verified_at);
      const blocking = existing.rows.find(
        (current) => current.status === 'active' && Date.parse(current.verified_at) >= incomingAt,
      );
      if (blocking) throw new Error(`${row.edge_id}: --no-prune active verification is not newest`);
      supersede.push({ edgeId: row.edge_id, verifiedAt: row.verified_at });
    }
    verificationsToWrite.push(row);
  }
  return { claimsToWrite, verificationsToWrite, supersede };
}

/**
 * @param {any[]} claimRows
 * @param {any[]} verificationRows
 * @param {string} dbUrl
 * @param {{ prune?: boolean, clientFactory?: () => any }} [options]
 */
export async function loadIntoDb(claimRows, verificationRows, dbUrl, options = {}) {
  const { prune = true, clientFactory } = options;
  let client;
  if (clientFactory) client = clientFactory();
  else {
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: dbUrl });
  }
  await client.connect();
  try {
    await client.query('begin');

    const plan = prune
      ? { claimsToWrite: claimRows, verificationsToWrite: verificationRows, supersede: [] }
      : await planIncremental(client, claimRows, verificationRows);

    const claimSql = upsertClaimSql();
    for (const row of plan.claimsToWrite) await client.query(claimSql, rowParams(CLAIM_COLUMNS, row));

    // Make the incoming active uncertain hold the one selected version. This is
    // skipped for exact idempotent repeats by planIncremental.
    for (const row of plan.supersede) {
      await client.query(
        `update public.edge_verifications
            set status = 'superseded', loaded_at = now()
          where edge_id = $1 and status = 'active' and verified_at < $2::timestamptz`,
        [row.edgeId, row.verifiedAt],
      );
    }

    const verSql = upsertVerificationSql();
    for (const row of plan.verificationsToWrite) await client.query(verSql, rowParams(VERIFICATION_COLUMNS, row));

    // Full projection/prune remains the default. Incremental callers opt out explicitly.
    const prunedVer = prune ? await client.query(
      `delete from public.edge_verifications v
        where not exists (
          select 1 from unnest($1::text[], $2::timestamptz[]) as k(edge_id, verified_at)
           where k.edge_id = v.edge_id and k.verified_at = v.verified_at)
        returning v.edge_id, v.verified_at`,
      [verificationRows.map((r) => r.edge_id), verificationRows.map((r) => r.verified_at)],
    ) : { rows: [] };
    const prunedClaims = prune ? await client.query(
      'delete from public.relationship_claims where not (edge_id = any($1::text[])) returning edge_id',
      [claimRows.map((r) => r.edge_id)],
    ) : { rows: [] };

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
  const args = { dryRun: false, fromDir: null, fromR2: false, allowEmpty: false, dbUrl: null, noPrune: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--check') args.dryRun = true;
    else if (a === '--allow-empty') args.allowEmpty = true;
    else if (a === '--no-prune') args.noPrune = true;
    else if (a === '--db-url') {
      args.dbUrl = argv[++i];
      if (!args.dbUrl) throw new Error('--db-url needs a PostgreSQL URL');
    }
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

  const expected = expectedArtifactHashes(Boolean(args.noPrune && args.fromDir));
  const { claimsText, verificationsText, sourceLabel } = args.fromDir
    ? readFromDir(args.fromDir, expected)
    : await readFromR2();

  const { claimRows, verificationRows, errors } = buildLoad(claimsText, verificationsText);

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} artifact error(s) (${sourceLabel}):`);
    for (const { source, line, message } of errors) console.error(`  - ${source}:${line}: ${message}`);
    console.error('Nothing loaded — fix the artifacts (TRUTH tier) / their producer and re-run.');
    process.exit(1);
  }

  // A14 empty-set guard: the end-of-run prune makes the tables a pure function of the artifact
  // set (D13), so a zero-claim input would wipe EVERY relationship_claims + edge_verifications
  // row. That is almost always a mis-pointed/blank source, not an intent — refuse (exit 1,
  // nothing written, no prune) unless the operator states the intent with --allow-empty.
  // Fires in --dry-run/--check too, so the check verdict mirrors what a real run would do.
  if (claimRows.length === 0 && !args.allowEmpty) {
    console.error(
      `✗ validated artifact set is EMPTY (${sourceLabel}) — refusing to load: the prune would ` +
        'wipe every relationship_claims + edge_verifications row. If the truth set really is ' +
        'empty (not a mis-pointed or blank source), re-run with --allow-empty.',
    );
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
    // R4-U4/O27: say the trust posture out loud at load time. An operator staging a demo
    // must be able to see BEFORE the serving run that a record carries no artifact ref or
    // no provider attestation — those edges cannot produce a card, and finding that out
    // here is far better than staring at an empty insight_cards table afterwards.
    if (active) {
      const posture = active.artifact_posture ?? row.artifact_posture ?? 'no-artifact-ref';
      const attested =
        active.attestation_attested === true
          ? `attested ${active.attestation_returned_model} (${active.attestation_family})`
          : active.attestation_returned_model !== null
            ? `NOT provider-attested (${active.attestation_returned_model})`
            : 'no attestation captured';
      console.log(`      trust: posture ${posture}; ${attested}`);
    }
    // RU2 guardrail: surface WHY the edge scored as it did — the component breakdown alongside the
    // composite (uncited weights, so the composite is a rank aid, not a truth value). Review-only /
    // non-persisted: the DB projection stays edge_score + serving_band (persisting this is B2 backlog).
    if (active) {
      const c = brain.edgeScoreComponents(active.verification);
      console.log(
        `      components: confidence ${c.confidence.toFixed(3)} × [base ${c.baseContribution.toFixed(3)} + ` +
          `tier ${c.tierContribution.toFixed(3)} (w=${c.tierWeight.toFixed(2)}) + ` +
          `corrob ${c.corroborationContribution.toFixed(3)} (boost=${c.corroborationBoost.toFixed(2)})] ` +
          `= mult ${c.multiplier.toFixed(3)} → ${c.composite.toFixed(3)}`,
      );
    }
  }

  if (args.dryRun) {
    console.log('Dry run — no database writes.');
    return;
  }

  const dbUrl = args.dbUrl ?? process.env.SUPABASE_DB_URL;
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
  const result = await loadIntoDb(claimRows, verificationRows, dbUrl, { prune: !args.noPrune });
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

const invoked = process.argv[1];
if (invoked && path.resolve(invoked).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  await main();
}
