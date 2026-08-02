#!/usr/bin/env node

import process from 'node:process';
import { validateNaoAuthorization } from './lib/nao_authorization.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (!name?.startsWith('--')) throw new Error(`unexpected argument '${name ?? ''}'`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
    values.set(name.slice(2), value);
  }
  const allowed = new Set(['operation-id', 'artifact-revision', 'paper-count']);
  for (const name of values.keys()) if (!allowed.has(name)) throw new Error(`unknown argument '--${name}'`);
  const operationId = values.get('operation-id') ?? '';
  const artifactRevision = values.get('artifact-revision') ?? '';
  const paperCount = Number(values.get('paper-count'));
  if (!UUID.test(operationId)) throw new Error('--operation-id must be a canonical UUID');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(artifactRevision)) {
    throw new Error('--artifact-revision has an invalid shape');
  }
  if (!Number.isInteger(paperCount) || paperCount < 1 || paperCount > 20) {
    throw new Error('--paper-count must be an integer from 1 to 20');
  }
  return { operationId, artifactRevision, paperCount };
}

async function main() {
  const expected = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!dbUrl) throw new Error('SUPABASE_DB_URL is required for authorization validation');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    let rows = [];
    // GitHub may schedule the job a moment before nao appends the terminal
    // outcome after the dispatch API returns. Wait briefly for that one known
    // race; a failed outcome or any ambiguous lifecycle is never retried away.
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await client.query(
        `select actor_user_id::text, actor_role, action, phase, target, detail, occurred_at
           from public.nao_control_events
          where operation_id = $1::uuid
            and phase in ('attempted', 'succeeded', 'failed')
          order by occurred_at asc, id asc`,
        [expected.operationId],
      );
      rows = result.rows;
      if (rows.some((row) => row.phase === 'failed') || rows.some((row) => row.phase === 'succeeded')) break;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    const validated = validateNaoAuthorization(rows, expected);
    console.log(
      `validated fresh nao authorization ${validated.operationId}: ` +
        `${validated.actorRole}, ${validated.paperCount} paper(s), ${validated.artifactRevision}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
