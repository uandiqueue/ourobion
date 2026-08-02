/**
 * No-spend promotion of an already-produced post-#300 artifact bundle.
 *
 * This is intentionally separate from synthesis and verification: it never
 * constructs an LLM router and never changes artifact content. The operator
 * pins all three local files by SHA-256, the shared schemas validate every
 * record before network I/O, and R2 collisions fail before the first PUT.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { R2Store, sha256 } from './storage/r2.js';
import { CLAIMS_BASENAME, R2_CLAIMS_KEY } from './synth/artifact.js';
import {
  BLUEPRINTS_BASENAME,
  R2_BLUEPRINTS_KEY,
  blueprintDedupeKey,
} from './synth/blueprintArtifact.js';
import {
  loadBlueprintValidator,
  loadClaimValidator,
  type BlueprintValidator,
  type ClaimValidator,
} from './synth/load.js';
import type { SynthClaim, SynthBlueprintRecord } from './synth/types.js';
import { R2_VERIFICATIONS_KEY, VERIFICATIONS_BASENAME } from './verify/artifact.js';
import { loadVerificationValidator } from './verify/load.js';
import type { VerificationValidator, VerifyRecord } from './verify/types.js';

export interface ArtifactHashes {
  claims: string;
  blueprints: string;
  verifications: string;
}

export interface ArtifactBundleValidators {
  claim: ClaimValidator;
  blueprint: BlueprintValidator;
  verification: VerificationValidator;
}

export interface PinnedArtifact {
  basename: string;
  objectName: string;
  bytes: Uint8Array;
  text: string;
  sha256: string;
  records: number;
}

export interface PinnedArtifactBundle {
  claims: PinnedArtifact;
  blueprints: PinnedArtifact;
  verifications: PinnedArtifact;
}

export type RemoteArtifactState = 'missing' | 'identical';

export interface ArtifactPromotionResult {
  checked: Record<keyof ArtifactHashes, RemoteArtifactState>;
  written: Array<keyof ArtifactHashes>;
}

const SHA256_RE = /^[0-9a-f]{64}$/i;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const ENCODER = new TextEncoder();

const SPECS = {
  claims: { basename: CLAIMS_BASENAME, objectName: R2_CLAIMS_KEY },
  blueprints: { basename: BLUEPRINTS_BASENAME, objectName: R2_BLUEPRINTS_KEY },
  verifications: { basename: VERIFICATIONS_BASENAME, objectName: R2_VERIFICATIONS_KEY },
} as const;

const KINDS = Object.keys(SPECS) as Array<keyof typeof SPECS>;

export function normalizeArtifactHashes(input: ArtifactHashes): ArtifactHashes {
  const normalized = {} as ArtifactHashes;
  for (const kind of KINDS) {
    const value = input[kind].trim().toLowerCase();
    if (!SHA256_RE.test(value)) {
      throw new Error(`${kind} SHA-256 must be exactly 64 hexadecimal characters`);
    }
    normalized[kind] = value;
  }
  return normalized;
}

function jsonlRecords(text: string, basename: string): unknown[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: unknown[] = [];
  for (const [index, line] of clean.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    try {
      records.push(JSON.parse(line));
    } catch (error: unknown) {
      throw new Error(
        `${basename}:${index + 1}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (records.length === 0) throw new Error(`${basename}: artifact is empty`);
  return records;
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label}: expected an object`);
  }
  return value as Record<string, unknown>;
}

async function defaultValidators(): Promise<ArtifactBundleValidators> {
  const [claim, blueprint, verification] = await Promise.all([
    loadClaimValidator(),
    loadBlueprintValidator(),
    loadVerificationValidator(),
  ]);
  return { claim, blueprint, verification };
}

function validateBytes(
  bytesByKind: Record<keyof ArtifactHashes, Uint8Array>,
  expectedInput: ArtifactHashes,
  validators: ArtifactBundleValidators,
): PinnedArtifactBundle {
  const expected = normalizeArtifactHashes(expectedInput);
  const artifacts = {} as Record<keyof ArtifactHashes, PinnedArtifact>;
  const parsed = {} as Record<keyof ArtifactHashes, unknown[]>;

  for (const kind of KINDS) {
    const bytes = bytesByKind[kind];
    const digest = sha256(bytes);
    if (digest !== expected[kind]) {
      throw new Error(`${SPECS[kind].basename}: SHA-256 mismatch (expected ${expected[kind]}, got ${digest})`);
    }
    let text: string;
    try {
      text = UTF8.decode(bytes);
    } catch {
      throw new Error(`${SPECS[kind].basename}: artifact is not valid UTF-8`);
    }
    parsed[kind] = jsonlRecords(text, SPECS[kind].basename);
    artifacts[kind] = {
      ...SPECS[kind],
      bytes,
      text,
      sha256: digest,
      records: parsed[kind].length,
    };
  }

  const claimEdgeIds = new Set<string>();
  for (const [index, raw] of parsed.claims.entries()) {
    try {
      const claim = validators.claim(raw) as SynthClaim;
      claimEdgeIds.add(claim.edgeId);
    } catch (error: unknown) {
      throw new Error(
        `${CLAIMS_BASENAME}:${index + 1}: contract validation failed: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const [index, raw] of parsed.blueprints.entries()) {
    const label = `${BLUEPRINTS_BASENAME}:${index + 1}`;
    const record = objectRecord(raw, label) as unknown as SynthBlueprintRecord;
    if (
      typeof record.dedupeKey !== 'string' ||
      typeof record.paperId !== 'string' ||
      typeof record.synthesisModel !== 'string' ||
      typeof record.promptVersion !== 'string' ||
      typeof record.synthesisedAt !== 'string'
    ) {
      throw new Error(`${label}: invalid SynthBlueprintRecord envelope`);
    }
    try {
      const blueprint = validators.blueprint(record.blueprint);
      const canonicalKey = blueprintDedupeKey(blueprint);
      if (record.dedupeKey !== canonicalKey) {
        throw new Error(`dedupeKey mismatch (expected ${JSON.stringify(canonicalKey)})`);
      }
    } catch (error: unknown) {
      throw new Error(
        `${label}: contract validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const [index, raw] of parsed.verifications.entries()) {
    try {
      const verification = validators.verification(raw) as VerifyRecord;
      if (!claimEdgeIds.has(verification.edgeId)) {
        throw new Error(`verification references absent claim ${verification.edgeId}`);
      }
    } catch (error: unknown) {
      throw new Error(
        `${VERIFICATIONS_BASENAME}:${index + 1}: contract validation failed: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return artifacts as unknown as PinnedArtifactBundle;
}

export async function readLocalArtifactBundle(
  edgesDir: string,
  expected: ArtifactHashes,
  validators?: ArtifactBundleValidators,
): Promise<PinnedArtifactBundle> {
  const bytes = {} as Record<keyof ArtifactHashes, Uint8Array>;
  for (const kind of KINDS) {
    try {
      bytes[kind] = readFileSync(join(edgesDir, SPECS[kind].basename));
    } catch (error: unknown) {
      throw new Error(
        `${SPECS[kind].basename}: cannot read from ${edgesDir}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return validateBytes(bytes, expected, validators ?? (await defaultValidators()));
}

export async function readR2ArtifactBundle(
  store: R2Store,
  expected: ArtifactHashes,
  validators?: ArtifactBundleValidators,
): Promise<PinnedArtifactBundle> {
  const texts = await Promise.all(KINDS.map((kind) => store.getObjectText(SPECS[kind].objectName)));
  const bytes = {} as Record<keyof ArtifactHashes, Uint8Array>;
  for (const [index, kind] of KINDS.entries()) bytes[kind] = ENCODER.encode(texts[index]!);
  return validateBytes(bytes, expected, validators ?? (await defaultValidators()));
}

/**
 * Read and contract-validate the current canonical R2 bundle when no external
 * hash pin exists (the full synthesis/verification workflow has just written
 * it). The hashes are calculated from the fetched bytes and returned with the
 * bundle so every downstream consumer can use one immutable local snapshot.
 */
export async function readCurrentR2ArtifactBundle(
  store: R2Store,
  validators?: ArtifactBundleValidators,
): Promise<PinnedArtifactBundle> {
  const texts = await Promise.all(KINDS.map((kind) => store.getObjectText(SPECS[kind].objectName)));
  const bytes = {} as Record<keyof ArtifactHashes, Uint8Array>;
  const hashes = {} as ArtifactHashes;
  for (const [index, kind] of KINDS.entries()) {
    bytes[kind] = ENCODER.encode(texts[index]!);
    hashes[kind] = sha256(bytes[kind]);
  }
  return validateBytes(bytes, hashes, validators ?? (await defaultValidators()));
}

/** Materialize the already-validated bytes without reparsing or refetching. */
export function writeArtifactBundle(bundle: PinnedArtifactBundle, outDir: string): void {
  if (outDir.trim().length === 0) throw new Error('--out-dir must not be blank');
  mkdirSync(outDir, { recursive: true });
  for (const kind of KINDS) {
    writeFileSync(join(outDir, bundle[kind].basename), bundle[kind].bytes, { flag: 'w' });
  }
}

/**
 * Preflight every canonical key before writing any of them. A non-identical
 * existing object is a collision, never an implicit merge or overwrite.
 */
export async function promoteArtifactBundle(
  store: R2Store,
  bundle: PinnedArtifactBundle,
  options: { checkOnly?: boolean } = {},
): Promise<ArtifactPromotionResult> {
  const checked = {} as Record<keyof ArtifactHashes, RemoteArtifactState>;

  await Promise.all(
    KINDS.map(async (kind) => {
      const local = bundle[kind];
      const head = await store.headExists(local.objectName);
      if (!head.exists) {
        checked[kind] = 'missing';
        return;
      }
      const remoteText = await store.getObjectText(local.objectName);
      const remoteHash = sha256(ENCODER.encode(remoteText));
      if (remoteHash !== local.sha256) {
        throw new Error(
          `${local.objectName}: R2 collision (local ${local.sha256}, existing ${remoteHash}); nothing written`,
        );
      }
      checked[kind] = 'identical';
    }),
  );

  const written: Array<keyof ArtifactHashes> = [];
  if (!options.checkOnly) {
    // Blueprint first: claims never become visible without their required
    // post-#300 rule artifact. Verification is last because it depends on claims.
    for (const kind of ['blueprints', 'claims', 'verifications'] as const) {
      if (checked[kind] === 'missing') {
        const artifact = bundle[kind];
        await store.putObject(artifact.objectName, artifact.bytes, 'application/x-ndjson');
        written.push(kind);
      }
    }
  }
  return { checked, written };
}
