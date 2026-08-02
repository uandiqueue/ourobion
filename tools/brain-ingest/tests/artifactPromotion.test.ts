import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  promoteArtifactBundle,
  readCurrentR2ArtifactBundle,
  readLocalArtifactBundle,
  readR2ArtifactBundle,
  writeArtifactBundle,
  type ArtifactBundleValidators,
  type ArtifactHashes,
} from '../src/artifactPromotion.js';
import { R2Store, sha256, type S3Like } from '../src/storage/r2.js';
import { R2_CLAIMS_KEY } from '../src/synth/artifact.js';
import {
  appendBlueprintsToR2,
  blueprintDedupeKey,
  R2_BLUEPRINTS_KEY,
} from '../src/synth/blueprintArtifact.js';
import type { SynthClaim, SynthBlueprintRecord } from '../src/synth/types.js';
import { R2_VERIFICATIONS_KEY } from '../src/verify/artifact.js';
import type { VerifyRecord } from '../src/verify/types.js';
import type { Config } from '../src/types.js';

interface CommandLike {
  constructor: { name: string };
  input: Record<string, unknown>;
}

class MemoryS3 implements S3Like {
  readonly sent: CommandLike[] = [];
  readonly objects = new Map<string, Uint8Array>();

  async send(command: unknown): Promise<unknown> {
    const cmd = command as CommandLike;
    this.sent.push(cmd);
    const key = String(cmd.input['Key']);
    if (cmd.constructor.name === 'HeadObjectCommand') {
      if (!this.objects.has(key)) {
        const error = new Error('NotFound') as Error & { name: string };
        error.name = 'NotFound';
        throw error;
      }
      return {};
    }
    if (cmd.constructor.name === 'GetObjectCommand') {
      const body = this.objects.get(key);
      if (body === undefined) {
        const error = new Error('NoSuchKey') as Error & { name: string };
        error.name = 'NoSuchKey';
        throw error;
      }
      return { Body: { transformToString: async () => new TextDecoder().decode(body) } };
    }
    if (cmd.constructor.name === 'PutObjectCommand') {
      this.objects.set(key, cmd.input['Body'] as Uint8Array);
      return {};
    }
    throw new Error(`unexpected mock command ${cmd.constructor.name}`);
  }
}

function config(): Config {
  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'openalex',
      r2Endpoint: 'https://example.invalid',
      r2AccessKeyId: 'access',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
    },
    enabled: {
      crossref: false,
      openalex: false,
      s2: false,
      pubmed: false,
      europepmc: false,
      arxiv: false,
      doaj: false,
      biorxiv: false,
      unpaywall: false,
      pmc: false,
      directOa: false,
      core: false,
      lens: false,
    },
  };
}

const encoder = new TextEncoder();
const claim = { edgeId: 'sleep_duration_min|decreases|resting_hr_bpm', citations: [] } as unknown as SynthClaim;
const blueprint = {
  condition: { type: 'trend', metricKey: 'sleep_duration_min', equals: 'falling' },
};
const blueprintRecord: SynthBlueprintRecord = {
  blueprint,
  dedupeKey: blueprintDedupeKey(blueprint),
  paperId: 'doi:10.1/example',
  synthesisModel: 'test-synthesis',
  promptVersion: 'test-prompt',
  synthesisedAt: '2026-08-01T00:00:00.000Z',
};
const verification = { edgeId: claim.edgeId, verifiedAt: '2026-08-01T00:01:00.000Z' } as VerifyRecord;

const texts = {
  claims: `${JSON.stringify(claim)}\n`,
  blueprints: `${JSON.stringify(blueprintRecord)}\n`,
  verifications: `${JSON.stringify(verification)}\n`,
};

const hashes: ArtifactHashes = {
  claims: sha256(encoder.encode(texts.claims)),
  blueprints: sha256(encoder.encode(texts.blueprints)),
  verifications: sha256(encoder.encode(texts.verifications)),
};

const validators: ArtifactBundleValidators = {
  claim: (value) => value as SynthClaim,
  blueprint: (value) => value as Record<string, unknown>,
  verification: (value) => value as VerifyRecord,
};

function localBundleDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-edge-promotion-'));
  writeFileSync(join(dir, 'claims.jsonl'), texts.claims);
  writeFileSync(join(dir, 'blueprints.jsonl'), texts.blueprints);
  writeFileSync(join(dir, 'verifications.jsonl'), texts.verifications);
  return dir;
}

test('exact local bundle promotes blueprint first and is byte-idempotent', async () => {
  const dir = localBundleDir();
  try {
    const bundle = await readLocalArtifactBundle(dir, hashes, validators);
    const client = new MemoryS3();
    const store = new R2Store(config(), { client });
    const first = await promoteArtifactBundle(store, bundle);
    assert.deepEqual(first.written, ['blueprints', 'claims', 'verifications']);
    assert.deepEqual(
      client.sent.filter((cmd) => cmd.constructor.name === 'PutObjectCommand').map((cmd) => cmd.input['Key']),
      [R2_BLUEPRINTS_KEY, R2_CLAIMS_KEY, R2_VERIFICATIONS_KEY],
    );
    assert.equal(new TextDecoder().decode(client.objects.get(R2_CLAIMS_KEY)), texts.claims);
    assert.equal(new TextDecoder().decode(client.objects.get(R2_BLUEPRINTS_KEY)), texts.blueprints);
    assert.equal(new TextDecoder().decode(client.objects.get(R2_VERIFICATIONS_KEY)), texts.verifications);

    const second = await promoteArtifactBundle(store, bundle);
    assert.deepEqual(second.written, []);
    assert.deepEqual(second.checked, {
      claims: 'identical',
      blueprints: 'identical',
      verifications: 'identical',
    });
    await assert.doesNotReject(() => readR2ArtifactBundle(store, hashes, validators));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('current R2 bundle is contract-validated, hashed, and materialized byte-for-byte', async () => {
  const client = new MemoryS3();
  client.objects.set(R2_CLAIMS_KEY, encoder.encode(texts.claims));
  client.objects.set(R2_BLUEPRINTS_KEY, encoder.encode(texts.blueprints));
  client.objects.set(R2_VERIFICATIONS_KEY, encoder.encode(texts.verifications));
  const bundle = await readCurrentR2ArtifactBundle(new R2Store(config(), { client }), validators);
  assert.deepEqual(
    { claims: bundle.claims.sha256, blueprints: bundle.blueprints.sha256, verifications: bundle.verifications.sha256 },
    hashes,
  );

  const dir = mkdtempSync(join(tmpdir(), 'ourobion-edge-materialize-'));
  try {
    writeArtifactBundle(bundle, dir);
    assert.deepEqual(readFileSync(join(dir, 'claims.jsonl')), Buffer.from(bundle.claims.bytes));
    assert.deepEqual(readFileSync(join(dir, 'blueprints.jsonl')), Buffer.from(bundle.blueprints.bytes));
    assert.deepEqual(readFileSync(join(dir, 'verifications.jsonl')), Buffer.from(bundle.verifications.bytes));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a local hash mismatch fails before any R2 access', async () => {
  const dir = localBundleDir();
  try {
    await assert.rejects(
      () => readLocalArtifactBundle(dir, { ...hashes, claims: '0'.repeat(64) }, validators),
      /claims\.jsonl: SHA-256 mismatch/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one non-identical R2 key aborts before every PUT', async () => {
  const dir = localBundleDir();
  try {
    const bundle = await readLocalArtifactBundle(dir, hashes, validators);
    const client = new MemoryS3();
    client.objects.set(R2_CLAIMS_KEY, encoder.encode('{"different":true}\n'));
    const store = new R2Store(config(), { client });
    await assert.rejects(() => promoteArtifactBundle(store, bundle), /R2 collision.*nothing written/);
    assert.equal(client.sent.some((cmd) => cmd.constructor.name === 'PutObjectCommand'), false);
    assert.equal(client.objects.has(R2_BLUEPRINTS_KEY), false);
    assert.equal(client.objects.has(R2_VERIFICATIONS_KEY), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendBlueprintsToR2 publishes the canonical key and dedupes a rerun', async () => {
  const client = new MemoryS3();
  const store = new R2Store(config(), { client });
  const first = await appendBlueprintsToR2(store, [blueprintRecord]);
  const second = await appendBlueprintsToR2(store, [blueprintRecord]);
  assert.deepEqual(first, { key: R2_BLUEPRINTS_KEY, written: 1, skipped: 0 });
  assert.deepEqual(second, { key: R2_BLUEPRINTS_KEY, written: 0, skipped: 1 });
  assert.equal(new TextDecoder().decode(client.objects.get(R2_BLUEPRINTS_KEY)).trim().split('\n').length, 1);
});
