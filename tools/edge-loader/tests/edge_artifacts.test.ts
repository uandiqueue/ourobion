// A11 loader pipeline tests (insight-engine-architecture §A11): line-numbered hard-fail
// validation against the real shared/brain zod contract, join semantics (claim without
// verification, newest-active-wins supersede, first-wins dedupe), gating precomputation held
// equal to shared/brain edgeScore/servingBand, and determinism.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLoad,
  parseClaims,
  parseVerifications,
  joinEdges,
  brain,
} from '../lib/artifacts.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'edges');
const claimsText = readFileSync(path.join(FIXTURES, 'claims.jsonl'), 'utf8');
const verificationsText = readFileSync(path.join(FIXTURES, 'verifications.jsonl'), 'utf8');

const EDGE_SLEEP_HRV = 'sleep_duration_min|increases|hrv_sdnn_ms';
const EDGE_SLEEP_RHR = 'sleep_duration_min|decreases|resting_hr_bpm';
const EDGE_STEPS_SLEEP = 'step_count|increases|sleep_duration_min';
const EDGE_STOOL_COMFORT = 'stool_form|correlates|gut_comfort_score';

/** Replace the JSONL line whose record has `edgeId` with a mutated copy (deep merge-free). */
function mutateLine(text: string, edgeId: string, mutate: (record: any) => void): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.trim() === '' || !line.includes(`"${edgeId}"`)) return line;
      const record = JSON.parse(line);
      if (record.edgeId !== edgeId) return line;
      mutate(record);
      return JSON.stringify(record);
    })
    .join('\n');
}

// ── fixtures are valid against the real contract ─────────────────────────────────────────────────

test('fixture artifacts pass the real shared/brain validators with zero errors', () => {
  const { claimRows, verificationRows, errors } = buildLoad(claimsText, verificationsText);
  assert.deepEqual(errors, []);
  assert.equal(claimRows.length, 4);
  assert.equal(verificationRows.length, 4);
});

// ── hard fail with line numbers ──────────────────────────────────────────────────────────────────

test('a non-JSON line fails with its exact line number', () => {
  const broken = claimsText.replace(/\n/, '\nnot json at all\n'); // becomes line 2
  const { errors } = parseClaims(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 2);
  assert.match(errors[0]!.message, /invalid JSON/);
});

test('a schema-invalid claim fails with its line number and the zod message', () => {
  // Base-shape failure (empty derivation) — zod reports it with the field path.
  const emptyDerivation = mutateLine(claimsText, EDGE_SLEEP_RHR, (c) => {
    c.derivation = '';
  });
  const base = parseClaims(emptyDerivation);
  assert.equal(base.errors.length, 1);
  assert.equal(base.errors[0]!.line, 2); // EDGE_SLEEP_RHR is fixture line 2
  assert.match(base.errors[0]!.message, /derivation/);

  // Invariant failure (edgeId != relationKey(subject, relation, object)) — the superRefine.
  const wrongId = mutateLine(claimsText, EDGE_SLEEP_RHR, (c) => {
    c.edgeId = 'wrong|edge|id';
  });
  const refined = parseClaims(wrongId);
  assert.equal(refined.errors.length, 1);
  assert.equal(refined.errors[0]!.line, 2);
  assert.match(refined.errors[0]!.message, /edgeId must equal/);
});

test('the safeguard invariant is enforced: supported without independent retrieval fails', () => {
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    v.verdict = 'supported';
    v.independentRetrieval = { performed: false, sources: [] };
    v.corroboration = { supporting: 1, contradicting: 0 };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3); // EDGE_SLEEP_RHR verification is fixture line 3
  assert.match(errors[0]!.message, /requires independentRetrieval\.performed/);
});

test('a claim endpoint that is not an active registry metric fails with its line number', () => {
  const broken = mutateLine(claimsText, EDGE_STEPS_SLEEP, (c) => {
    c.subject = 'not_a_registry_metric';
    c.edgeId = 'not_a_registry_metric|increases|sleep_duration_min';
  });
  const { errors } = parseClaims(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3); // EDGE_STEPS_SLEEP is fixture line 3
  assert.match(errors[0]!.message, /not an active shared\/metrics registry key/);
});

test('a verification referencing an unclaimed edgeId is a hard error', () => {
  const broken = mutateLine(verificationsText, EDGE_STEPS_SLEEP, (v) => {
    v.edgeId = 'urine_colour|correlates|energy_score';
  });
  const { errors } = buildLoad(claimsText, broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 4); // EDGE_STEPS_SLEEP verification is fixture line 4
  assert.match(errors[0]!.message, /unclaimed edgeId/);
});

// ── gating: precomputed columns == shared/brain functions ────────────────────────────────────────

test('edge_score / serving_band equal shared/brain edgeScore / servingBand on every row', () => {
  const { verificationRows } = buildLoad(claimsText, verificationsText);
  for (const row of verificationRows) {
    assert.equal(row.edge_score, brain.edgeScore(row.verification));
    assert.equal(row.serving_band, brain.servingBand(row.verification));
  }
});

test('fixture scores/bands match hand-computed expectations', () => {
  const { verificationRows } = buildLoad(claimsText, verificationsText);
  const byKey = new Map(verificationRows.map((r) => [`${r.edge_id} ${r.verified_at}`, r]));

  // supported, conf .9, tier 5, net +3: .9 * (.6 + .25*1 + .15*1) = 0.9 → high
  const newest = byKey.get(`${EDGE_SLEEP_HRV} 2026-07-12T00:00:00Z`)!;
  assert.ok(Math.abs(newest.edge_score - 0.9) < 1e-9);
  assert.equal(newest.serving_band, 'high');

  // supported, conf .85, tier 4, net +2: .85 * (.6 + .25*.8 + .15*(2/3)) = 0.765 → mid
  const older = byKey.get(`${EDGE_SLEEP_HRV} 2026-07-11T00:00:00Z`)!;
  assert.ok(Math.abs(older.edge_score - 0.765) < 1e-9);
  assert.equal(older.serving_band, 'mid');

  // partial, conf .7, tier 3, net +1: .7 * (.6 + .25*.6 + .15*(1/3)) = 0.56 → mid
  const partial = byKey.get(`${EDGE_SLEEP_RHR} 2026-07-12T00:00:00Z`)!;
  assert.ok(Math.abs(partial.edge_score - 0.56) < 1e-9);
  assert.equal(partial.serving_band, 'mid');

  // uncertain: never servable → score 0, hold
  const uncertain = byKey.get(`${EDGE_STEPS_SLEEP} 2026-07-12T00:00:00Z`)!;
  assert.equal(uncertain.edge_score, 0);
  assert.equal(uncertain.serving_band, 'hold');
});

// ── join semantics ───────────────────────────────────────────────────────────────────────────────

test('a claim without any verification produces a claim row but is not servable', () => {
  const { claimRows, verificationRows } = buildLoad(claimsText, verificationsText);
  assert.ok(claimRows.some((r) => r.edge_id === EDGE_STOOL_COMFORT));
  assert.ok(!verificationRows.some((r) => r.edge_id === EDGE_STOOL_COMFORT));
});

test('multiple active verifications: only the newest stays active, older flipped superseded', () => {
  const { verificationRows } = buildLoad(claimsText, verificationsText);
  const rows = verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_HRV);
  assert.equal(rows.length, 2);
  const older = rows.find((r) => r.verified_at === '2026-07-11T00:00:00Z')!;
  const newer = rows.find((r) => r.verified_at === '2026-07-12T00:00:00Z')!;
  assert.equal(older.status, 'superseded');
  assert.equal(newer.status, 'active');
  // The truth-artifact copy stays verbatim — only the serving column flips.
  assert.equal(older.verification.status, 'active');
});

test('duplicate (edgeId, verifiedAt) lines dedupe first-wins (on-conflict-do-nothing mirror)', () => {
  const dupLine = verificationsText.split('\n').find((l) => l.includes(EDGE_SLEEP_RHR))!;
  const mutated = JSON.parse(dupLine);
  mutated.confidence = 0.1; // would change the score if the duplicate won
  const withDup = `${verificationsText.trimEnd()}\n${JSON.stringify(mutated)}\n`;
  const { verificationRows, errors } = buildLoad(claimsText, withDup);
  assert.deepEqual(errors, []);
  const rows = verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_RHR);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0]!.edge_score - 0.56) < 1e-9); // the first (fixture) line won
});

test('re-synthesised claim (same edgeId later in the append-only file) wins: last line', () => {
  const line = claimsText.split('\n').find((l) => l.includes(EDGE_STOOL_COMFORT))!;
  const resynth = JSON.parse(line);
  resynth.promptVersion = 'fixture-v1';
  const appended = `${claimsText.trimEnd()}\n${JSON.stringify(resynth)}\n`;
  const { claimRows, errors } = buildLoad(appended, verificationsText);
  assert.deepEqual(errors, []);
  assert.equal(claimRows.length, 4);
  assert.equal(claimRows.find((r) => r.edge_id === EDGE_STOOL_COMFORT)!.prompt_version, 'fixture-v1');
});

// ── determinism ──────────────────────────────────────────────────────────────────────────────────

test('same artifact text → identical rows (deterministic pipeline)', () => {
  const a = buildLoad(claimsText, verificationsText);
  const b = buildLoad(claimsText, verificationsText);
  assert.deepEqual(a.claimRows, b.claimRows);
  assert.deepEqual(a.verificationRows, b.verificationRows);
  // Stable order: claims and verifications sorted by edge identity.
  assert.deepEqual(
    a.claimRows.map((r) => r.edge_id),
    [...a.claimRows.map((r) => r.edge_id)].sort(),
  );
});

test('joinEdges is pure over already-validated records (empty inputs → empty outputs)', () => {
  const out = joinEdges([], []);
  assert.deepEqual(out, { claimRows: [], verificationRows: [], errors: [] });
});
