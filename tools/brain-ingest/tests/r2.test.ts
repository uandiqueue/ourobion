/**
 * R2 storage adapter tests (design §6, §10.5) — node:test, run via tsx.
 *
 * NO network: the pure helpers (`sha256`, key-builders) need no client, and the
 * `R2Store` methods are driven by an in-memory mock `S3Like` that records the
 * commands it receives. Proves:
 *  - sha256 is the standard lowercase-hex digest (matches node:crypto);
 *  - key-builders emit the §6 layout and percent-encode the `:`/`/` in a uid;
 *  - putObject sends a PutObjectCommand carrying the body + sha256 metadata;
 *  - getObjectText decodes a body (the JATS fixture) via transformToString;
 *  - headExists maps a NotFound error to { exists:false } and propagates others;
 *  - sync is idempotent — a matching-sha head skips the upload, a mismatch
 *    (or missing object) re-uploads.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  R2Store,
  sha256,
  pdfKey,
  jatsKey,
  textKey,
  metaKey,
  MANIFEST_KEY,
  encodeKeySegment,
  isNotFound,
  type S3Like,
} from '../src/storage/r2.js';
import type { Config } from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'r2-sample.jats.xml');

/** A minimal Config — only the r2* keys matter to the store. */
function fakeConfig(): Config {
  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'oa-key',
      r2Endpoint: 'https://acct.r2.cloudflarestorage.com',
      r2AccessKeyId: 'access',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'ourobion-corpus',
    },
    enabled: {
      crossref: true,
      pubmed: false,
      europepmc: true,
      arxiv: true,
      s2: false,
      doaj: true,
      biorxiv: true,
      lens: false,
      openalex: true,
      unpaywall: true,
      pmc: true,
      directOa: true,
      core: false,
    },
  };
}

/** Command shapes the SDK builds — we read the `.input` the mock receives. */
interface CommandLike {
  constructor: { name: string };
  input: Record<string, unknown>;
}

/**
 * In-memory mock S3 client. Records every command and serves Head/Get from a
 * tiny object map keyed by `Key`. `notFoundKeys` force a NotFound on Head.
 */
class MockS3 implements S3Like {
  readonly sent: CommandLike[] = [];
  readonly store = new Map<string, { body: Uint8Array; sha256?: string }>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async send(command: unknown): Promise<unknown> {
    const cmd = command as CommandLike;
    this.sent.push(cmd);
    const name = cmd.constructor.name;
    const key = String(cmd.input['Key']);

    if (name === 'PutObjectCommand') {
      const body = cmd.input['Body'] as Uint8Array;
      const meta = cmd.input['Metadata'] as Record<string, string> | undefined;
      this.store.set(key, { body, sha256: meta?.['sha256'] });
      return {};
    }
    if (name === 'HeadObjectCommand') {
      const obj = this.store.get(key);
      if (obj === undefined) {
        const err = new Error('Not Found') as Error & {
          name: string;
          $metadata: { httpStatusCode: number };
        };
        err.name = 'NotFound';
        err.$metadata = { httpStatusCode: 404 };
        throw err;
      }
      return obj.sha256 !== undefined ? { Metadata: { sha256: obj.sha256 } } : {};
    }
    if (name === 'GetObjectCommand') {
      const obj = this.store.get(key);
      if (obj === undefined) throw new Error(`mock: no object at ${key}`);
      const text = Buffer.from(obj.body).toString('utf-8');
      return { Body: { transformToString: async (_enc?: string) => text } };
    }
    if (name === 'DeleteObjectCommand') {
      // R2/S3 DELETE is idempotent — succeeds whether or not the key existed.
      this.store.delete(key);
      return {};
    }
    throw new Error(`mock: unexpected command ${name}`);
  }
}

const enc = (s: string) => new TextEncoder().encode(s);

test('sha256 matches node:crypto lowercase-hex', () => {
  const bytes = enc('hello R2');
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256(bytes), expected);
  assert.match(sha256(bytes), /^[0-9a-f]{64}$/);
});

test('key-builders emit the §6 layout and percent-encode uid : and /', () => {
  // A DOI-derived uid carries both `:` and `/` (design §4).
  const uid = 'doi:10.1234/sample.2026.0001';
  assert.equal(pdfKey(uid), 'pdf/doi%3A10.1234%2Fsample.2026.0001.pdf');
  assert.equal(jatsKey(uid), 'jats/doi%3A10.1234%2Fsample.2026.0001.xml');
  assert.equal(textKey(uid), 'text/doi%3A10.1234%2Fsample.2026.0001.txt');

  // Single prefix slash only — the uid contributes no extra hierarchy.
  assert.equal(pdfKey(uid).split('/').length, 2);
  // Human-auditable chars survive: `.` `-` `_` are not escaped.
  assert.equal(encodeKeySegment('corpus:01-ab_cd.ef'), 'corpus%3A01-ab_cd.ef');
});

test('metadata keys: MANIFEST_KEY is the combined index; metaKey encodes the uid', () => {
  assert.equal(MANIFEST_KEY, 'manifest/papers.jsonl');
  const uid = 'doi:10.1234/sample.2026.0001';
  assert.equal(metaKey(uid), 'meta/doi%3A10.1234%2Fsample.2026.0001.json');
  // Single prefix slash only — the uid contributes no extra hierarchy.
  assert.equal(metaKey(uid).split('/').length, 2);
});

test('putObject sends PutObjectCommand with body + sha256 metadata', async () => {
  const mock = new MockS3();
  const store = new R2Store(fakeConfig(), { client: mock });
  const body = enc('PDF-ish bytes');
  const res = await store.putObject(pdfKey('doi:10.1/x'), body, 'application/pdf');

  assert.equal(res.sha256, sha256(body));
  assert.equal(res.sizeBytes, body.byteLength);
  assert.equal(mock.sent.length, 1);
  const put = mock.sent[0]!;
  assert.equal(put.constructor.name, 'PutObjectCommand');
  assert.equal(put.input['Bucket'], 'ourobion-corpus');
  assert.equal(put.input['ContentType'], 'application/pdf');
  assert.deepEqual(put.input['Metadata'], { sha256: sha256(body) });
});

test('getObjectText round-trips the JATS fixture body', async () => {
  const mock = new MockS3();
  const store = new R2Store(fakeConfig(), { client: mock });
  const jats = readFileSync(FIXTURE); // Buffer is a Uint8Array
  const key = jatsKey('doi:10.1234/sample.2026.0001');
  await store.putObject(key, jats, 'application/xml');

  const text = await store.getObjectText(key);
  assert.match(text, /A canned JATS sample for the R2 storage adapter test/);
  assert.equal(text, readFileSync(FIXTURE, 'utf-8'));
});

test('headExists: NotFound → {exists:false}; present → {exists:true,sha256}', async () => {
  const mock = new MockS3();
  const store = new R2Store(fakeConfig(), { client: mock });
  const key = textKey('doi:10.1/y');

  assert.deepEqual(await store.headExists(key), { exists: false });

  const body = enc('extracted text');
  await store.putObject(key, body, 'text/plain');
  assert.deepEqual(await store.headExists(key), { exists: true, sha256: sha256(body) });
});

test('sync is idempotent: matching sha skips upload, mismatch re-uploads', async () => {
  const mock = new MockS3();
  const store = new R2Store(fakeConfig(), { client: mock });
  const key = pdfKey('doi:10.1/z');
  const body = enc('the binary');

  // First sync: head (miss) → put.
  const first = await store.sync(key, body, 'application/pdf');
  assert.equal(first.skipped, false);
  assert.equal(first.sha256, sha256(body));
  const putsAfterFirst = mock.sent.filter((c) => c.constructor.name === 'PutObjectCommand').length;
  assert.equal(putsAfterFirst, 1);

  // Second sync, identical bytes: head matches sha → skip (no new put).
  const second = await store.sync(key, body, 'application/pdf');
  assert.equal(second.skipped, true);
  const putsAfterSecond = mock.sent.filter((c) => c.constructor.name === 'PutObjectCommand').length;
  assert.equal(putsAfterSecond, 1);

  // Third sync, changed bytes: sha differs → re-upload.
  const changed = enc('the binary, revised');
  const third = await store.sync(key, changed, 'application/pdf');
  assert.equal(third.skipped, false);
  assert.equal(third.sha256, sha256(changed));
  const putsAfterThird = mock.sent.filter((c) => c.constructor.name === 'PutObjectCommand').length;
  assert.equal(putsAfterThird, 2);
});

test('deleteObject removes the meta/ object; a NotFound resolves successfully', async () => {
  const mock = new MockS3();
  const store = new R2Store(fakeConfig(), { client: mock });
  const key = metaKey('pmcid:PMC8123456');

  // Seed an object, then delete it.
  await store.putObject(key, enc('{"orphan":true}'), 'application/json');
  assert.deepEqual(await store.headExists(key), { exists: true, sha256: sha256(enc('{"orphan":true}')) });

  await store.deleteObject(key);
  const del = mock.sent[mock.sent.length - 1]!;
  assert.equal(del.constructor.name, 'DeleteObjectCommand');
  assert.equal(del.input['Bucket'], 'ourobion-corpus');
  assert.equal(del.input['Key'], key);
  assert.deepEqual(await store.headExists(key), { exists: false });

  // Deleting an already-absent key must not throw (idempotent cleanup).
  await assert.doesNotReject(() => store.deleteObject(metaKey('doi:10.1/never-existed')));
});

test('isNotFound recognises the SDK 404 shapes only', () => {
  assert.equal(isNotFound({ name: 'NotFound' }), true);
  assert.equal(isNotFound({ name: 'NoSuchKey' }), true);
  assert.equal(isNotFound({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isNotFound({ $metadata: { httpStatusCode: 500 } }), false);
  assert.equal(isNotFound(new Error('network blip')), false);
  assert.equal(isNotFound(null), false);
});
