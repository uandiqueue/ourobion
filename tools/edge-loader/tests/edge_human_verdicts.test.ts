// Coupling guard for the O13 human-verdict overlay (run-2 U9). Three seams, one file:
//
//   1. The edge_human_verdicts table (migration 20260724150000) — the ADDITIVE human layer's
//      audit shape: append-only columns, action CHECK limited to 'reject' (no 'approve'/'restore'
//      semantics this cycle), NO foreign key to relationship_claims (the loader's full-rebuild
//      prune must never cascade-delete a human decision), RLS with a forged-audit guard
//      (created_by = auth.uid()).
//   2. The verified_edges recreation (migration 20260724150001) — the CURRENT view definition.
//      It must keep the S6/A16 serving semantics character-for-character in spirit (security
//      invoker, newest ACTIVE verification per edge) and add ONLY the two human columns at the
//      end via a latest-row lateral join.
//   3. generate-insights' serving read — the one NEW-card consumer. It must exclude
//      human_verdict = 'reject' null-safely (absence of human action = verifier default).
//      Cross-language pin, same style as the S6 column/CHECK guards in edge_table_schema.test.ts.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from '../lib/artifacts.mjs';

const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');

function migrationSql(suffixPattern: RegExp): string {
  const file = readdirSync(migrationsDir).find((f) => suffixPattern.test(f));
  assert.ok(file, `migration matching ${suffixPattern} not found in supabase/migrations`);
  // CRLF-normalized (Windows checkout states differ per file).
  return readFileSync(path.join(migrationsDir, file), 'utf8').replace(/\r\n/g, '\n');
}

const verdictsSql = migrationSql(/create_o13_edge_human_verdicts\.sql$/);
const overlaySql = migrationSql(/o13_verified_edges_human_overlay\.sql$/);

// ── 1. edge_human_verdicts table ─────────────────────────────────────────────────────────────

test('edge_human_verdicts: append-only audit columns, reject-only CHECK', () => {
  const block = /create table[^(]*\bpublic\.edge_human_verdicts\b[^(]*\(([\s\S]*?)\n\);/.exec(
    verdictsSql,
  );
  assert.ok(block, 'create table public.edge_human_verdicts block not found');
  const body = block[1]!;
  for (const col of ['id', 'edge_id', 'action', 'reason', 'created_by', 'created_at']) {
    assert.match(body, new RegExp(`^\\s*${col}\\s+\\S`, 'm'), `column ${col} missing`);
  }
  // Only 'reject' exists this cycle — an approve/restore action is intentionally NOT modelled.
  const check = /check \(action in\s*\(([^)]*)\)\)/.exec(body);
  assert.ok(check, "check (action in (...)) not found");
  assert.deepEqual([...check![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]), ['reject']);
  // created_by is the audit column; it must be non-nullable.
  assert.match(body, /created_by\s+uuid not null/);
});

test('edge_human_verdicts: NO foreign key to relationship_claims (prune-safety)', () => {
  // Human curation is truth — the loader's full-rebuild prune deletes/re-inserts claim rows and
  // an FK would cascade-delete (or block) around it. The write route checks existence instead.
  // Comments stripped: the migration header EXPLAINS the no-FK decision in prose.
  const code = verdictsSql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  assert.doesNotMatch(code, /references\s+public\.relationship_claims/i);
  assert.doesNotMatch(code, /foreign key/i);
});

test('edge_human_verdicts: RLS on, authenticated select + audit-guarded insert, append-only', () => {
  assert.match(verdictsSql, /alter table public\.edge_human_verdicts enable row level security/);
  assert.match(verdictsSql, /for select\s+to authenticated\s+using \(true\)/);
  assert.match(verdictsSql, /for insert\s+to authenticated\s+with check \(created_by = auth\.uid\(\)\)/);
  // Append-only audit: no UPDATE/DELETE policies anywhere in the migration.
  assert.doesNotMatch(verdictsSql, /for (update|delete)/);
});

// ── 2. verified_edges overlay recreation ─────────────────────────────────────────────────────

test('verified_edges overlay: keeps S6 serving semantics, appends the two human columns', () => {
  const view = /create or replace view public\.verified_edges([\s\S]*?);/.exec(overlaySql);
  assert.ok(view, 'verified_edges recreation not found in the overlay migration');
  const body = view![1]!;
  // The S6/A16 core semantics (mirrors edge_table_schema.test.ts's pins on the originals).
  assert.match(body, /security_invoker = true/);
  assert.match(body, /select distinct on \(c\.edge_id\)/);
  assert.match(body, /where v\.status = 'active'/);
  assert.match(body, /order by c\.edge_id, v\.verified_at desc/);
  // The base column list is unchanged and the human columns come AFTER it (CREATE OR REPLACE
  // VIEW only permits appending columns at the end — this is also the additive-layer contract).
  assert.match(
    body,
    /c\.\*, v\.verified_at, v\.verification, v\.verdict, v\.edge_score, v\.serving_band,\s*\n\s*hv\.action as human_verdict, hv\.created_at as human_verdict_at/,
  );
  // Latest-human-verdict-per-edge: a lateral limit-1 join ordered newest-first.
  assert.match(body, /left join lateral \(/);
  assert.match(body, /from public\.edge_human_verdicts h/);
  assert.match(body, /order by h\.created_at desc, h\.id desc\s*\n\s*limit 1/);
});

test('overlay: get_insight_provenance keeps rejected edges VISIBLE and adds the human keys', () => {
  const fn = /create or replace function public\.get_insight_provenance[\s\S]*?\$\$;/.exec(overlaySql);
  assert.ok(fn, 'get_insight_provenance recreation not found in the overlay migration');
  const body = fn![0]!;
  // Additive keys only — the O12 contract's existing keys must all still be produced.
  for (const key of [
    'edgeId', 'subject', 'object', 'relation', 'direction', 'servingBand', 'edgeScore',
    'verdict', 'verifiedAt', 'derivation', 'population', 'quoteSpans', 'citations',
    'humanVerdict', 'humanVerdictAt',
  ]) {
    assert.match(body, new RegExp(`'${key}',`), `edges[] key ${key} missing`);
  }
  // Honest history: no filter on the human verdict — the RPC never hides a rejected edge.
  assert.doesNotMatch(body, /human_verdict\s*(!?=|<>|not)/i);
});

// ── 3. generate-insights serving exclusion (the NEW-card consumer) ───────────────────────────

test('generate-insights excludes human-rejected edges null-safely in its verified_edges fetch', () => {
  const fnPath = path.join(REPO_ROOT, 'supabase', 'functions', 'generate-insights', 'index.ts');
  const source = readFileSync(fnPath, 'utf8').replace(/\r\n/g, '\n');
  const fetch = /\.from\("verified_edges"\)([\s\S]*?)\.range\(from, to\)/.exec(source);
  assert.ok(fetch, 'verified_edges fetch not found in generate-insights/index.ts');
  // Null-safe exclusion: (human_verdict is null) OR (human_verdict <> 'reject') — a bare
  // .neq would silently drop every un-curated (null) edge from serving.
  assert.match(fetch![1]!, /\.or\("human_verdict\.is\.null,human_verdict\.neq\.reject"\)/);
  // The band gate must still be there — the human layer sits ON TOP of it, not instead.
  assert.match(fetch![1]!, /\.in\("serving_band", \["high", "mid"\]\)/);
});
