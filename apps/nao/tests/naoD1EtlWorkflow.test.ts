/**
 * Textual security contract for the manually approved R2 -> D1 projection.
 * This intentionally reads the workflow rather than executing it: the safety
 * properties must remain visible in review before GitHub Actions evaluates it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_PATH = path.join(NAO_ROOT, '..', '..', '.github', 'workflows', 'nao-d1-etl.yml');

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, 'utf8').replace(/\r\n/g, '\n');
}

test('nao D1 ETL workflow is a manually confirmed, immutable projection', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^on:\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+schedule:/m);

  const actions = [...workflow.matchAll(/^\s*-?\s*uses:\s*[^\s@]+@([^\s#]+).*$/gm)];
  assert.ok(actions.length > 0, 'workflow must use explicitly pinned actions');
  for (const [, ref] of actions) {
    assert.match(ref, /^[a-f0-9]{40}$/i, `action reference must be a full immutable SHA: ${ref}`);
  }
  assert.doesNotMatch(workflow, /uses:\s*[^\s@]+@v\d+/i);

  assert.match(
    workflow,
    /uses:\s*actions\/checkout@[a-f0-9]{40}\s*\n\s*with:\s*\n\s*ref:\s*refs\/heads\/main\s*\n\s*persist-credentials:\s*false/m,
  );
  assert.match(workflow, /^defaults:\n\s+run:\n\s+shell:\s+bash/m);
  assert.match(workflow, /run:\s*\|\n\s+set -euo pipefail/m);

  assert.doesNotMatch(workflow, /(?:^|[\/\s])\.env(?:\.[\w-]+)?\b/m);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@/i);
  assert.doesNotMatch(workflow, /max_sql_bytes|20000000/);

  assert.equal(
    (workflow.match(/npm run etl -- --sql-only/g) ?? []).length,
    1,
    'SQL must be generated exactly once',
  );
  assert.match(workflow, /wrangler d1 execute\s+\S+\s+--remote\s+--file\s+scratch\/etl\.sql/);
  assert.doesNotMatch(workflow, /npm run etl -- --remote/);
  assert.doesNotMatch(workflow, /find\s+.*\.sql/);

  assert.match(
    workflow,
    /execute:\s*\n\s+description:.*\n\s+type:\s+boolean\s*\n\s+default:\s+false/m,
  );
  assert.match(workflow, /REBUILD_D1_FROM_R2/);
  assert.match(workflow, /inputs\.execute\s*==\s*true/);
  assert.match(workflow, /inputs\.(?:confirmation|confirm)\s*==\s*'REBUILD_D1_FROM_R2'/);
  assert.match(workflow, /github\.ref\s*==\s*'refs\/heads\/main'/);

  assert.match(
    workflow,
    /if:\s*\$\{\{\s*inputs\.execute\s*==\s*true\s*&&\s*\(\s*inputs\.(?:confirmation|confirm)\s*!=\s*'REBUILD_D1_FROM_R2'\s*\|\|\s*github\.ref\s*!=\s*'refs\/heads\/main'\s*\)\s*\}\}[\s\S]{0,500}?exit 1/m,
    'an execute request that is not exactly confirmed from main must fail closed before remote D1 access',
  );
});
