/**
 * R4-U4 follow-on (O27 / B-BR1) · Turn one router response into the artifact-trust
 * fields a verification record must carry to ever be servable.
 *
 * TWO SEPARATE THINGS, kept separate on purpose:
 *
 *  1. `verifierModel` (built elsewhere) is the CONFIGURED id — what we asked the
 *     router for, or a MOCK / INTERIM provenance stamp. It is a config echo.
 *  2. `attestation` (built here) is what the PROVIDER RETURNED. `attested` is true
 *     only when `LlmResponse.modelIdentity.source === 'provider-response'`, which
 *     only `routes/apiWorker.ts` can produce and only from the provider's own
 *     response body. There is no path in this file that can promote a configured
 *     id, a mailbox id, or a sentinel string into an attested one.
 *
 * FAIL CLOSED: no response ⇒ no attestation (undefined), which
 * shared/brain trustFailures() reports as 'missing-attestation' and which BLOCKS
 * serving. An unattested response still yields a record — with `attested: false`,
 * which blocks just as hard ('unattested-model') while keeping the honest history
 * of what actually answered.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { createHash } from 'node:crypto';

import type { LlmResponse } from '../../../llm-router/src/index.js';

import type {
  VerifyArtifactPosture,
  VerifyArtifactRef,
  VerifyModelAttestation,
  VerifyRecord,
} from './types.js';

/**
 * Model strings that are provenance stamps, never a provider-returned identity:
 * the CLI's configured-node echo, the unset default, MOCK proofs, INTERIM
 * single-paper stamps, hand-authored fixtures, and the router's TEST-MODE label.
 * Nothing here may ever be recorded as attested — asserted by a guard test, and
 * mirrored at the serving boundary (generate-insights/composer.ts) so a
 * hand-edited row cannot smuggle one past the gate either.
 */
export const NON_PROVIDER_MODEL_MARKERS: readonly RegExp[] = [
  /^config:/i,
  /^router:/i,
  /^unset-/i,
  /^mock\b/i,
  /^interim:/i,
  /^fixture:/i,
  /TEST-MODE/i,
];

/** True when `model` is one of the provenance stamps above rather than a provider id. */
export function isNonProviderModelString(model: string): boolean {
  return NON_PROVIDER_MODEL_MARKERS.some((re) => re.test(model.trim()));
}

/**
 * Build the `ModelAttestation` for a completed verifier call, or undefined when no
 * call backed the record.
 *
 * `attested` requires BOTH that the route reported a provider-returned identity AND
 * that the string is not one of our own provenance stamps. The second condition is
 * redundant today (only apiWorker sets 'provider-response', and it copies the
 * provider's body) — it is belt-and-braces against a future route, or a mocked
 * router in a test harness, claiming attestation for a sentinel.
 */
export function buildAttestation(response: LlmResponse | undefined): VerifyModelAttestation | undefined {
  if (response === undefined) return undefined;
  const identity = response.modelIdentity;
  const attested = identity.providerAttested && !isNonProviderModelString(identity.model);
  return {
    returnedModel: identity.model,
    returnedVersion: identity.returnedVersion,
    // Family is the O7/B-BR2 comparison unit. 'unknown' when the route could not
    // resolve one — it is never guessed, and an unknown family cannot be equal to
    // the synthesising family by accident.
    family: identity.family ?? 'unknown',
    // NEVER default decorrelation to true: null (undetermined) records as false.
    decorrelated: identity.decorrelatedFromSynthesis === true,
    attested,
  };
}

/**
 * Posture for a record: 'live' only when a real provider response produced it.
 * The U4 migration defines the pair as "'fixture' (no provider was called)" vs
 * "'live' (a live provider run produced this claim)", so the quoteCheck-only rung,
 * mailbox fulfilments, and MOCK runs are all 'fixture' — no provider was called,
 * or none answered for itself.
 */
export function posturefor(attestation: VerifyModelAttestation | undefined): VerifyArtifactPosture {
  return attestation?.attested === true ? 'live' : 'fixture';
}

/**
 * Canonical JSON: object keys sorted at every depth, arrays in order. Two records
 * with the same content hash to the same value regardless of key insertion order,
 * which is what makes the hash a stable identity for the exact bytes rather than
 * for one particular serialization of them.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('canonicalJson: cannot hash undefined');
  return encoded;
}

/**
 * `sha256:<64 lowercase hex>` over the record's canonical bytes, with `artifact`
 * itself EXCLUDED — the hash pins the record's content, and a hash cannot contain
 * itself. Everything else (verdict, sources, attestation, verifiedAt) is inside the
 * hash, so a re-synthesised or re-verified record yields a different hash, which is
 * exactly what retires a revision-bound expert verdict (B-BR7).
 */
export function recordContentHash(record: Omit<VerifyRecord, 'artifact'> & { artifact?: unknown }): string {
  const { artifact: _omitted, ...hashable } = record;
  return `sha256:${createHash('sha256').update(canonicalJson(hashable), 'utf8').digest('hex')}`;
}

/**
 * Stamp the artifact ref onto a built record. `revision` names the artifact BUNDLE
 * and must be supplied by the operator (`--artifact-revision`) — it is not
 * derivable from one record, and inventing one would be fabricating provenance.
 * Returns undefined when no revision was supplied, which leaves the record without
 * an artifact ref and therefore UNSERVABLE (fail closed, honestly).
 */
export function buildArtifactRef(
  record: Omit<VerifyRecord, 'artifact'> & { artifact?: unknown },
  revision: string | undefined,
  posture: VerifyArtifactPosture,
): VerifyArtifactRef | undefined {
  if (revision === undefined || revision.trim() === '') return undefined;
  return { revision: revision.trim(), contentHash: recordContentHash(record), posture };
}
