/**
 * Remote control-plane tests (`src/control.ts`) — node:test, via tsx. NO network:
 * a fake R2 client backs a real `R2Store` with an in-memory object map so
 * `getObjectText` round-trips for real. Proves:
 *  - `loadIngestControl` reads back exactly what was written;
 *  - a missing/malformed/empty control document degrades to
 *    `DEFAULT_INGEST_CONTROL` rather than throwing;
 *  - `normalizeIngestControl` fills in missing fields from a partial/older doc.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadIngestControl, normalizeIngestControl, CONTROL_KEY } from '../src/control.js';
import { R2Store } from '../src/storage/r2.js';
import { DEFAULT_INGEST_CONTROL } from '../src/types.js';
import type { Config, IngestControlConfig } from '../src/types.js';

function makeConfig(): Config {
  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'k',
      r2Endpoint: 'https://r2.example.com',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'corpus',
    },
    enabled: {
      crossref: false,
      pubmed: false,
      europepmc: false,
      arxiv: false,
      s2: false,
      doaj: false,
      biorxiv: false,
      lens: false,
      openalex: false,
      unpaywall: false,
      pmc: false,
      directOa: false,
      core: false,
    },
  };
}

/** A real R2Store backed by an in-memory object map — get/put actually round-trip. */
function memStore(seed?: Record<string, string>): R2Store {
  const objects = new Map<string, Uint8Array>(
    Object.entries(seed ?? {}).map(([k, v]) => [k, new TextEncoder().encode(v)]),
  );
  const client = {
    async send(command: unknown): Promise<unknown> {
      const c = command as { constructor: { name: string }; input: Record<string, unknown> };
      const name = c.constructor.name;
      const key = c.input['Key'] as string;
      if (name === 'HeadObjectCommand') {
        if (!objects.has(key)) {
          const err = new Error('NotFound') as Error & { name: string };
          err.name = 'NotFound';
          throw err;
        }
        return { Metadata: {} };
      }
      if (name === 'PutObjectCommand') {
        objects.set(key, c.input['Body'] as Uint8Array);
        return {};
      }
      if (name === 'GetObjectCommand') {
        const body = objects.get(key);
        if (body === undefined) {
          const err = new Error('NoSuchKey') as Error & { name: string };
          err.name = 'NoSuchKey';
          throw err;
        }
        return { Body: { transformToString: async () => new TextDecoder().decode(body) } };
      }
      return {};
    },
  };
  return new R2Store(makeConfig(), { client });
}

test('loadIngestControl: round-trips a real control document', async () => {
  const doc: IngestControlConfig = {
    paused: true,
    limits: { openalexDailyUsd: 0.5 },
    updatedAt: '2026-07-02T00:00:00.000Z',
    updatedBy: 'a@b.com',
  };
  const store = memStore({ [CONTROL_KEY]: JSON.stringify(doc) });
  const loaded = await loadIngestControl(store);
  assert.deepEqual(loaded, doc);
});

test('loadIngestControl: a missing document degrades to DEFAULT_INGEST_CONTROL', async () => {
  const store = memStore(); // nothing written
  const loaded = await loadIngestControl(store);
  assert.deepEqual(loaded, DEFAULT_INGEST_CONTROL);
});

test('loadIngestControl: malformed JSON degrades to DEFAULT_INGEST_CONTROL, never throws', async () => {
  const store = memStore({ [CONTROL_KEY]: '{not json' });
  const loaded = await loadIngestControl(store);
  assert.deepEqual(loaded, DEFAULT_INGEST_CONTROL);
});

test('normalizeIngestControl: fills in missing fields from a partial/older document', () => {
  const normalized = normalizeIngestControl({ paused: true });
  assert.equal(normalized.paused, true);
  assert.deepEqual(normalized.limits, {});
  assert.equal(typeof normalized.updatedAt, 'string');
});

test('normalizeIngestControl: null/non-object input degrades to defaults', () => {
  assert.deepEqual(normalizeIngestControl(null), DEFAULT_INGEST_CONTROL);
  assert.deepEqual(normalizeIngestControl(undefined), DEFAULT_INGEST_CONTROL);
});
