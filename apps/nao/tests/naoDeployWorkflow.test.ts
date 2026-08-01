/**
 * Textual production-deploy contract. The workflow is infrastructure code:
 * these assertions keep branch, credential, and secret-preservation guards
 * visible without making a real Cloudflare deployment during tests.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const NAO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_PATH = path.join(NAO_ROOT, '..', '..', '.github', 'workflows', 'nao-deploy.yml');

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, 'utf8').replace(/\r\n/g, '\n');
}

test('nao production deploy is restricted to main and serialised', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^on:\n\s+push:\n\s+branches:\n\s+- main/m);
  assert.match(workflow, /^\s+workflow_dispatch:\s*$/m);
  assert.match(workflow, /^\s+if: github\.ref == 'refs\/heads\/main'$/m);
  assert.match(workflow, /group: nao-production\n\s+cancel-in-progress: false/m);
  assert.match(
    workflow,
    /uses: actions\/checkout@[a-f0-9]{40}[^\n]*\n\s+with:\n\s+ref: refs\/heads\/main\n\s+persist-credentials: false/m,
  );
});

test('nao production deploy pins actions and requires exact credential names', () => {
  const workflow = readWorkflow();
  const actions = [...workflow.matchAll(/^\s*uses:\s*[^\s@]+@([^\s#]+).*$/gm)];

  assert.ok(actions.length > 0, 'workflow must use explicitly pinned actions');
  for (const [, ref] of actions) {
    assert.match(ref, /^[a-f0-9]{40}$/i, 'action reference must be a full immutable SHA: ' + ref);
  }

  for (const name of [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ]) {
    assert.match(
      workflow,
      new RegExp('secrets\\.' + name + '\\b'),
      name + ' must come from GitHub secrets',
    );
  }
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('nao production deploy verifies the app before preserving Worker vars on deploy', () => {
  const workflow = readWorkflow();
  const packageJson = JSON.parse(readFileSync(path.join(NAO_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.match(workflow, /npm ci[\s\S]*npm run typecheck[\s\S]*npm test[\s\S]*npm run deploy/m);
  assert.equal(
    packageJson.scripts?.deploy,
    'opennextjs-cloudflare build && opennextjs-cloudflare deploy -- --keep-vars',
  );
});
