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
  canonicalVerifiedAt,
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

test('A1: a partial verdict without independent retrieval is rejected (grounding safeguard)', () => {
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    // EDGE_SLEEP_RHR is already partial; strip its retrieval so the safeguard must bite.
    v.independentRetrieval = { performed: false, sources: [] };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3); // EDGE_SLEEP_RHR verification is fixture line 3
  assert.match(errors[0]!.message, /requires independentRetrieval\.performed/);
});

test('A1: a partial verdict WITH retrieval + ≥1 supporting source is accepted', () => {
  // The unmodified fixture partial line already satisfies this — assert it stays green.
  const { errors, verificationRows } = buildLoad(claimsText, verificationsText);
  assert.deepEqual(errors, []);
  const partial = verificationRows.find(
    (r) => r.edge_id === EDGE_SLEEP_RHR && r.verification.verdict === 'partial',
  )!;
  assert.equal(partial.verification.independentRetrieval.performed, true);
  assert.ok(partial.verification.corroboration.supporting >= 1);
});

test('A2: invented corroboration (supporting exceeds retrieved supporting/mixed sources) is rejected', () => {
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    // Fixture has 1 supporting source; claim 2 supporting without adding a source.
    v.corroboration = { supporting: 2, contradicting: 0 };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3);
  assert.match(errors[0]!.message, /corroboration\.supporting .* exceeds retrieved/);
});

test('A2: corroboration counts within the retrieved supporting/mixed source count are accepted', () => {
  // Fixture line 1 (EDGE_SLEEP_HRV @ 2026-07-11) has supporting:2 with 2 supports sources.
  const { errors } = buildLoad(claimsText, verificationsText);
  assert.deepEqual(errors, []);
});

test('A3: a vacuous quoteCheck (spansFound:0, spansTotal:0, allPresent:true) is rejected', () => {
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    v.quoteCheck = { spansFound: 0, spansTotal: 0, allPresent: true };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3);
  assert.match(errors[0]!.message, /allPresent must equal/);
});

test('A3: the in-repo quoteCheck zero-span output (allPresent:false at 0/0) is accepted on a NON-SERVABLE verdict', () => {
  // brain-ingest quoteCheck.ts computes allPresent = spansTotal > 0 && …, so a zero-span block
  // is {0,0,false} — the schema must accept exactly that encoding. Since O17, only on a
  // non-servable verdict (zero-span `uncertain` records are intentionally retained); the fixture
  // uncertain line (EDGE_STEPS_SLEEP) is the honest carrier for it.
  const zeroSpan = mutateLine(verificationsText, EDGE_STEPS_SLEEP, (v) => {
    v.quoteCheck = { spansFound: 0, spansTotal: 0, allPresent: false };
  });
  const { errors } = parseVerifications(zeroSpan);
  assert.deepEqual(errors, []);
});

// ── O17: a servable verdict requires a PASSING quote check (verdict B3) ──────────────────────────

test('O17: partial + zero-span quoteCheck ({0,0,false}) fails validation — never a servable band row', () => {
  // EDGE_SLEEP_RHR's fixture verification is `partial` (servable) with a passing quoteCheck;
  // strip its quote grounding entirely. Pre-O17 this validated and banded `mid`.
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    v.quoteCheck = { spansFound: 0, spansTotal: 0, allPresent: false };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3); // EDGE_SLEEP_RHR verification is fixture line 3
  assert.match(errors[0]!.message, /servable verdict 'partial' requires a passing quote check/);
  // Loader-seam consequence: the record is unloadable, so NO row (a fortiori no servable band
  // row) can reach the serving tables for that edge.
  const { verificationRows } = buildLoad(claimsText, broken);
  assert.deepEqual(verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_RHR), []);
});

test('O17: supported + partially-found quoteCheck ({1,3,false}) fails validation — never a servable band row', () => {
  const broken = mutateLine(verificationsText, EDGE_SLEEP_RHR, (v) => {
    v.verdict = 'supported'; // servable; fixture retrieval + corroboration already satisfy it
    v.quoteCheck = { spansFound: 1, spansTotal: 3, allPresent: false };
  });
  const { errors } = parseVerifications(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 3);
  assert.match(errors[0]!.message, /servable verdict 'supported' requires a passing quote check/);
  const { verificationRows } = buildLoad(claimsText, broken);
  assert.deepEqual(verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_RHR), []);
});

test('O17: a servable verdict with a PASSING quote check still loads and bands (no over-blocking)', () => {
  // The unmodified fixtures carry supported/partial lines with passing quoteChecks — they must
  // stay loadable and servable-banded exactly as before.
  const { errors, verificationRows } = buildLoad(claimsText, verificationsText);
  assert.deepEqual(errors, []);
  const partial = verificationRows.find((r) => r.edge_id === EDGE_SLEEP_RHR)!;
  assert.equal(partial.serving_band, 'mid');
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

// ── O20: derivation copy gate re-checked at loader ingestion (verdict H3) ────────────────────────

test('O20: a derivation with diagnostic language fails at the loader seam with its line number', () => {
  const broken = mutateLine(claimsText, EDGE_SLEEP_RHR, (c) => {
    c.derivation = 'Your condition is improving: sleep extension may be a treatment for elevated resting heart rate.';
  });
  const { errors } = parseClaims(broken);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 2); // EDGE_SLEEP_RHR claim is fixture line 2
  assert.match(errors[0]!.message, /derivation fails validateCopyString/);
});

test('O20: benign words containing forbidden fragments pass the loader copy gate (word boundaries)', () => {
  // Mirrors tools/rules/tests/copy_guidelines.test.ts TRUE_NEGATIVES — "stillness" ⊃ "illness",
  // "preconditioning" ⊃ "condition", "mistreatment" ⊃ "treatment": no over-blocking.
  const benign = mutateLine(claimsText, EDGE_SLEEP_RHR, (c) => {
    c.derivation =
      'Preconditioning, stillness and the mistreatment of outliers are avoided in this reading of the fixture cohort quote.';
  });
  const { errors } = parseClaims(benign);
  assert.deepEqual(errors, []);
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

  // Keys use the canonical verified_at (A13): fixture '…T00:00:00Z' → '…T00:00:00.000Z'.
  // supported, conf .9, tier 5, net +3: .9 * (.6 + .25*1 + .15*1) = 0.9 → high
  const newest = byKey.get(`${EDGE_SLEEP_HRV} 2026-07-12T00:00:00.000Z`)!;
  assert.ok(Math.abs(newest.edge_score - 0.9) < 1e-9);
  assert.equal(newest.serving_band, 'high');

  // supported, conf .85, tier 4, net +2: .85 * (.6 + .25*.8 + .15*(2/3)) = 0.765 → mid
  const older = byKey.get(`${EDGE_SLEEP_HRV} 2026-07-11T00:00:00.000Z`)!;
  assert.ok(Math.abs(older.edge_score - 0.765) < 1e-9);
  assert.equal(older.serving_band, 'mid');

  // partial, conf .7, tier 3, net +1: .7 * (.6 + .25*.6 + .15*(1/3)) = 0.56 → mid
  const partial = byKey.get(`${EDGE_SLEEP_RHR} 2026-07-12T00:00:00.000Z`)!;
  assert.ok(Math.abs(partial.edge_score - 0.56) < 1e-9);
  assert.equal(partial.serving_band, 'mid');

  // uncertain: never servable → score 0, hold
  const uncertain = byKey.get(`${EDGE_STEPS_SLEEP} 2026-07-12T00:00:00.000Z`)!;
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
  const older = rows.find((r) => r.verified_at === '2026-07-11T00:00:00.000Z')!;
  const newer = rows.find((r) => r.verified_at === '2026-07-12T00:00:00.000Z')!;
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

// ── A13: verifiedAt canonicalization (JS comparisons must match timestamptz semantics) ───────────

/** Replace the verification line matching (edgeId, verifiedAt) with a mutated copy. */
function mutateVerification(
  text: string,
  edgeId: string,
  verifiedAt: string,
  mutate: (record: any) => void,
): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.trim() === '') return line;
      const record = JSON.parse(line);
      if (record.edgeId !== edgeId || record.verifiedAt !== verifiedAt) return line;
      mutate(record);
      return JSON.stringify(record);
    })
    .join('\n');
}

test('A13: canonicalVerifiedAt collapses every offset spelling to one UTC ISO form', () => {
  assert.equal(canonicalVerifiedAt('2026-07-12T00:00:00Z'), '2026-07-12T00:00:00.000Z');
  assert.equal(canonicalVerifiedAt('2026-07-12T00:00:00+00:00'), '2026-07-12T00:00:00.000Z');
  assert.equal(canonicalVerifiedAt('2026-07-12T08:00:00+08:00'), '2026-07-12T00:00:00.000Z');
  assert.equal(canonicalVerifiedAt('2026-07-12T00:00:00.250+00:00'), '2026-07-12T00:00:00.250Z');
});

test('A13: two offset spellings of the SAME instant dedupe to one row (no silent DB last-wins)', () => {
  // Same instant as the fixture RHR line ('…T00:00:00Z'), spelled '+00:00', different content.
  // Pre-A13 these were two JS rows colliding on the DB (edge_id, verified_at) key — last wins
  // silently. Canonical dedup keeps exactly one, first-wins, like on-conflict-do-nothing.
  const dupLine = verificationsText.split('\n').find((l) => l.includes(EDGE_SLEEP_RHR))!;
  const variant = JSON.parse(dupLine);
  variant.verifiedAt = '2026-07-12T00:00:00+00:00';
  variant.confidence = 0.1; // would change the score if the offset variant won
  const withVariant = `${verificationsText.trimEnd()}\n${JSON.stringify(variant)}\n`;
  const { verificationRows, errors } = buildLoad(claimsText, withVariant);
  assert.deepEqual(errors, []);
  const rows = verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_RHR);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.verified_at, '2026-07-12T00:00:00.000Z');
  assert.ok(Math.abs(rows[0]!.edge_score - 0.56) < 1e-9); // the first (fixture) line won
});

test('A13: supersede picks the chronologically newest active verification across mixed offsets', () => {
  // '2026-07-13T07:00:00+08:00' == 2026-07-12T23:00Z — LEXICOGRAPHICALLY the largest string,
  // chronologically the OLDER instant. Raw string ordering would keep it active and flip the
  // actually-newest '2026-07-12T23:30:00Z'; canonical ordering must do the opposite.
  let text = mutateVerification(verificationsText, EDGE_SLEEP_HRV, '2026-07-11T00:00:00Z', (v) => {
    v.verifiedAt = '2026-07-13T07:00:00+08:00';
  });
  text = mutateVerification(text, EDGE_SLEEP_HRV, '2026-07-12T00:00:00Z', (v) => {
    v.verifiedAt = '2026-07-12T23:30:00Z';
  });
  const { verificationRows, errors } = buildLoad(claimsText, text);
  assert.deepEqual(errors, []);
  const rows = verificationRows.filter((r) => r.edge_id === EDGE_SLEEP_HRV);
  assert.equal(rows.length, 2);
  const offsetForm = rows.find((r) => r.verified_at === '2026-07-12T23:00:00.000Z')!;
  const newest = rows.find((r) => r.verified_at === '2026-07-12T23:30:00.000Z')!;
  assert.equal(newest.status, 'active');
  assert.equal(offsetForm.status, 'superseded');
  // Rows sort chronologically (canonical order), not lexicographically over raw spellings.
  assert.deepEqual(rows.map((r) => r.verified_at), [offsetForm.verified_at, newest.verified_at]);
  // The verification jsonb keeps the producer's verbatim spelling — only the column is canonical.
  assert.equal(offsetForm.verification.verifiedAt, '2026-07-13T07:00:00+08:00');
  assert.equal(newest.verification.verifiedAt, '2026-07-12T23:30:00Z');
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
