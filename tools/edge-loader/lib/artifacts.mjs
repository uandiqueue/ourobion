// tools/edge-loader/lib/artifacts.mjs
//
// Pure artifact pipeline shared by the loader CLI (../load_edges.mjs) and the guard tests
// (../tests/): JSONL edge-artifact text (edges/claims.jsonl + edges/verifications.jsonl — the
// TRUTH tier, docs/memory/0001) → per-line zod validation against the shared/brain contract
// (HARD FAIL with line numbers on any violation) → registry endpoint check → join verifications
// to claims by edgeId → precompute edge_score / serving_band via shared/brain/index.ts
// (edgeScore / servingBand — the single source of gating truth) → S6-table rows. No database
// access here.
//
// Deterministic: same artifact text → same rows (stable edge order, stable status computation).
// The only load-time-varying column, loaded_at, is set by the DB.
//
// The shared contract is TypeScript; this stays an .mjs Node script (house tools/ style, per
// tools/rules), so it registers the tsx ESM loader once and imports the TS sources directly —
// no build step, one source of truth.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

register();

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// R2 key layout (insight-engine-architecture §A8/§A10/§A11): a local mirror directory holds the
// same basenames the R2 `edges/` prefix does.
export const CLAIMS_BASENAME = 'claims.jsonl';
export const VERIFICATIONS_BASENAME = 'verifications.jsonl';
export const R2_CLAIMS_KEY = `edges/${CLAIMS_BASENAME}`;
export const R2_VERIFICATIONS_KEY = `edges/${VERIFICATIONS_BASENAME}`;

const sharedUrl = (rel) => pathToFileURL(path.join(REPO_ROOT, 'shared', rel)).href;
// shared/ compiles as CommonJS, so `export * from` re-exports are not statically visible through
// the ESM interop — import the schema module directly, not only the barrel (tools/rules gotcha).
const schema = await import(sharedUrl('brain/relationships.schema.ts'));
const brain = await import(sharedUrl('brain/index.ts')); // edgeScore/servingBand/EDGE_GATES live here
const metrics = await import(sharedUrl('metrics/index.ts'));
// O20 (verdict H3): the shared copy gate — `derivation` is user-adjacent copy (nao evidence
// panels) and must never carry diagnostic language. Same import style as tools/rules/lib/blueprints.mjs.
const copy = await import(sharedUrl('constants/copy_guidelines.ts'));

export { schema as brainSchema, brain, metrics as metricsRegistry };

/** One validation problem, addressable back to the exact artifact line. */
function problem(source, line, message) {
  return { source, line, message };
}

function formatZodIssues(error) {
  return error.issues
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ');
}

/**
 * Parse one JSONL artifact: one JSON record per line, blank lines ignored. Every line must
 * JSON-parse AND satisfy `validate` (a shared/brain zod validator) or it becomes a line-numbered
 * error — the loader hard-fails on any error (fix the artifact / its producer, re-run).
 */
export function parseArtifactLines(text, validate, source) {
  const records = [];
  const errors = [];
  // Tolerate a UTF-8 BOM: Windows tooling (e.g. PowerShell 5.1 Set-Content) prefixes local
  // mirror files with one, and it would otherwise poison line 1's JSON.parse.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  clean.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    if (rawLine.trim() === '') return;
    let raw;
    try {
      raw = JSON.parse(rawLine);
    } catch (e) {
      errors.push(problem(source, line, `invalid JSON: ${e.message}`));
      return;
    }
    try {
      records.push({ line, record: validate(raw) });
    } catch (e) {
      const message = Array.isArray(e?.issues) ? formatZodIssues(e) : String(e?.message ?? e);
      errors.push(problem(source, line, `schema: ${message}`));
    }
  });
  return { records, errors };
}

/**
 * Parse + validate edges/claims.jsonl. Beyond the zod contract, enforces the contract-header
 * invariant that every endpoint resolves to an ACTIVE shared/metrics registry key
 * (relationships.ts: "validate with metrics.isActiveMetric"), and re-checks the O20 copy gate:
 * `derivation` must pass validateCopyString (the producer gates it at synthesis, but
 * hand-authored / legacy / imported artifacts bypass the producer — the loader is the last
 * line before the serving tables). Both are line-numbered HARD-FAIL errors, same as the zod
 * contract (fix the artifact / its producer, re-run).
 */
export function parseClaims(text, source = R2_CLAIMS_KEY) {
  const { records, errors } = parseArtifactLines(text, schema.validateClaim, source);
  for (const { line, record } of records) {
    for (const endpoint of ['subject', 'object']) {
      if (!metrics.isActiveMetric(record[endpoint])) {
        errors.push(
          problem(
            source,
            line,
            `${record.edgeId}: ${endpoint} '${record[endpoint]}' is not an active shared/metrics registry key`,
          ),
        );
      }
    }
    if (!copy.validateCopyString(record.derivation)) {
      errors.push(
        problem(
          source,
          line,
          `${record.edgeId}: derivation fails validateCopyString (diagnostic language)`,
        ),
      );
    }
  }
  return { records, errors };
}

/** Parse + validate edges/verifications.jsonl. */
export function parseVerifications(text, source = R2_VERIFICATIONS_KEY) {
  return parseArtifactLines(text, schema.validateVerification, source);
}

/**
 * A13: canonicalize a contract-valid `verifiedAt` (zod `.datetime({ offset: true })`, per U19)
 * to the ONE UTC ISO form `YYYY-MM-DDTHH:mm:ss.sssZ` (`Date#toISOString`). Postgres compares
 * `verified_at` as timestamptz, so mixed offset spellings of the same instant
 * ("…T10:00:00Z" vs "…T10:00:00+00:00" vs "…T18:00:00+08:00") are EQUAL there while raw JS
 * string comparison treats them as distinct — and lexicographic order across mixed offsets can
 * invert chronology. Canonicalizing before every JS comparison makes plain string equality and
 * ordering of this fixed-length form agree exactly with timestamptz semantics.
 *
 * Canonical everywhere: the dedup key, the newest-active supersede ordering AND the
 * `verified_at` column value all use this form. Only the `verification` jsonb keeps the
 * producer's verbatim string (truth-artifact copy, never rewritten).
 */
export function canonicalVerifiedAt(verifiedAt) {
  return new Date(verifiedAt).toISOString();
}

/**
 * R4-U4/O27 · Project a contract `ArtifactRef` onto the three artifact_* columns the U4
 * migration added to BOTH relationship_claims and edge_verifications
 * (20260728030000_r4u4_artifact_trust_and_revision_bound_disposition.sql).
 *
 * NULL DISCIPLINE (the migration's header, restated because it is easy to get wrong): a NULL
 * here is not a neutral "unset" — it is UNTRUSTED. The loader therefore projects the artifact
 * ref verbatim or leaves all three NULL together; it never synthesises a revision, never
 * back-fills a posture, and never hashes the line itself to manufacture a content hash the
 * producer did not assert. Deriving any of them would mean the loader — which has no idea
 * whether a provider was ever called — inventing provenance. Only the producer knows.
 */
function artifactColumns(artifact) {
  return {
    artifact_revision: artifact?.revision ?? null,
    artifact_content_hash: artifact?.contentHash ?? null,
    artifact_posture: artifact?.posture ?? null,
  };
}

/**
 * R4-U4/O27 · Project a contract `ModelAttestation` onto the five attestation_* columns on
 * edge_verifications. `attestation_attested` is the B-BR1 field: true ONLY when the artifact
 * says the identity came back from a provider response. `?? null` (never `?? false`, and
 * absolutely never `?? true`) keeps "no attestation captured" distinguishable from "captured
 * and false", and both fail the serving gate — 'missing-attestation' vs 'unattested-model'.
 */
function attestationColumns(attestation) {
  return {
    attestation_returned_model: attestation?.returnedModel ?? null,
    attestation_returned_version: attestation?.returnedVersion ?? null,
    attestation_family: attestation?.family ?? null,
    attestation_decorrelated: attestation?.decorrelated ?? null,
    attestation_attested: attestation?.attested ?? null,
  };
}

/**
 * Join validated claims + verifications into S6-table rows.
 *
 * - Claims: the artifact is append-only, so a re-synthesised edge appears as a LATER line for the
 *   same edgeId — the last line wins (mirrors the table's upsert-on-edge_id semantics).
 * - Verifications: every record must reference a claimed edgeId (else a line-numbered error — the
 *   FK would reject it anyway). Duplicate (edgeId, verifiedAt) lines dedupe first-wins on the
 *   CANONICAL verifiedAt (A13: same instant in different offset spellings is one key, matching
 *   the DB's timestamptz `(edge_id, verified_at)` uniqueness).
 * - Supersede: per edge, only the NEWEST verification whose artifact status is 'active' stays
 *   active in the status COLUMN; older active lines are stored as 'superseded'. Newest is decided
 *   on the canonical form (A13), so mixed-offset artifacts order chronologically, exactly as
 *   timestamptz would. The verification jsonb stays verbatim (truth artifact copy) — the column
 *   is the serving lifecycle.
 * - Gating: edge_score / serving_band precomputed with shared/brain edgeScore / servingBand.
 */
export function joinEdges(claims, verifications) {
  const errors = [];

  const claimByEdge = new Map(); // last line wins (append-only artifact: later = newer)
  for (const { record } of claims) claimByEdge.set(record.edgeId, record);

  const seen = new Set();
  const verByEdge = new Map();
  for (const { line, record } of verifications) {
    if (!claimByEdge.has(record.edgeId)) {
      errors.push(
        problem(R2_VERIFICATIONS_KEY, line, `${record.edgeId}: verification references an unclaimed edgeId`),
      );
      continue;
    }
    const verifiedAt = canonicalVerifiedAt(record.verifiedAt); // A13: one UTC ISO form for all comparisons
    const key = `${record.edgeId}\n${verifiedAt}`;
    if (seen.has(key)) continue; // first wins == on conflict (edge_id, verified_at) do nothing
    seen.add(key);
    const list = verByEdge.get(record.edgeId) ?? [];
    list.push({ record, verifiedAt });
    verByEdge.set(record.edgeId, list);
  }

  const claimRows = [...claimByEdge.values()]
    .sort((a, b) => (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0)) // code-unit order: locale-independent
    .map((c) => ({
      edge_id: c.edgeId,
      subject: c.subject,
      object: c.object,
      relation: c.relation,
      claim: c,
      prompt_version: c.promptVersion,
      synthesised_at: c.synthesisedAt,
      // R4-U4/O27 · artifact trust posture, projected into its own columns so the serving
      // gate can read it without parsing the jsonb. NULL when the artifact line carries no
      // ArtifactRef — and NULL means UNTRUSTED, not "fine": shared/brain trustFailures()
      // blocks any card derived from a record with no artifact ref. Nothing is derived or
      // defaulted here; the loader projects exactly what the TRUTH-tier artifact states.
      ...artifactColumns(c.artifact),
    }));

  const verificationRows = [];
  for (const edgeId of [...verByEdge.keys()].sort()) {
    // Canonical-form comparisons throughout (A13): fixed-length UTC ISO strings order exactly
    // like the instants they name, so `<`/`>` here == timestamptz ordering in Postgres.
    const list = verByEdge
      .get(edgeId)
      .slice()
      .sort((a, b) => (a.verifiedAt < b.verifiedAt ? -1 : a.verifiedAt > b.verifiedAt ? 1 : 0));
    const newestActiveAt = list
      .filter(({ record }) => record.status === 'active')
      .reduce((acc, { verifiedAt }) => (acc === null || verifiedAt > acc ? verifiedAt : acc), null);
    for (const { record: v, verifiedAt } of list) {
      const superseded = v.status === 'active' && newestActiveAt !== null && verifiedAt < newestActiveAt;
      verificationRows.push({
        edge_id: v.edgeId,
        verified_at: verifiedAt, // canonical UTC ISO — the timestamptz the DB round-trips to
        verification: v, // verbatim truth copy — keeps the producer's original verifiedAt spelling
        verdict: v.verdict,
        status: superseded ? 'superseded' : v.status,
        edge_score: brain.edgeScore(v),
        serving_band: brain.servingBand(v),
        // #300 §E · approve-with-caveat, projected verbatim. `?? null` covers BOTH contract
        // states that mean "no text" — an explicit `caveat: null` and an absent key on a record
        // written before caveats existed. The loader does not compose, translate or default a
        // caveat: only the producer knows which limitation actually fired, exactly as with the
        // artifact/attestation columns above.
        caveat: v.caveat ?? null,
        ...artifactColumns(v.artifact),
        ...attestationColumns(v.attestation),
      });
    }
  }

  return { claimRows, verificationRows, errors };
}

/**
 * The full pure pipeline: parse + validate + join. Returns { claimRows, verificationRows,
 * errors }; rows are stable-ordered and safe to load only when errors is empty.
 */
export function buildLoad(claimsText, verificationsText) {
  const claims = parseClaims(claimsText);
  const verifications = parseVerifications(verificationsText);
  const joined = joinEdges(claims.records, verifications.records);
  return {
    claimRows: joined.claimRows,
    verificationRows: joined.verificationRows,
    errors: [...claims.errors, ...verifications.errors, ...joined.errors],
  };
}
