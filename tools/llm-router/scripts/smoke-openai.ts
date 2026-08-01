#!/usr/bin/env tsx
/**
 * ⚠️ LIVE SMOKE SCRIPT — THIS COSTS REAL MONEY. NOT part of `npm test`. ⚠️
 *
 * Manual, run-once proof that the REAL api_worker route works end-to-end
 * against OpenAI under the Run 2.0 TEST-MODE posture:
 *
 *   1. loads OPENAI_API_KEY from tools/brain-ingest/.env (gitignored);
 *   2. routes ONE minimal request ("Reply with the single word: ok") through
 *      the cheapest node (`phrasing_card` → gpt-5-mini per router.config.json);
 *   3. prints the router result and the ledger entry the call recorded,
 *      including the USD cost.
 *
 * Cost per run: well under US$0.01 (≤ ~600 tokens total on gpt-5-mini).
 * The router's C7 caps + 95% hard-stop still gate the call like any other.
 *
 * Run from an activated toolchain shell:
 *   cd tools/llm-router && npx tsx scripts/smoke-openai.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { costUsd } from '../src/budget.js';
import { repoRoot, resolveRepoPath } from '../src/config.js';
import { LlmRouter } from '../src/router.js';

/** Minimal .env parse: first `KEY=value` line wins; quotes stripped; comments skipped. */
function envValue(envPath: string, key: string): string | undefined {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m === null || m[1] !== key) continue;
    const raw = m[2]!.trim();
    const unquoted = /^(['"])(.*)\1$/.exec(raw);
    return unquoted !== null ? unquoted[2] : raw;
  }
  return undefined;
}

async function main(): Promise<number> {
  const envPath = resolve(repoRoot(), 'tools', 'brain-ingest', '.env');
  const key = envValue(envPath, 'OPENAI_API_KEY');
  if (key === undefined || key.length === 0) {
    console.error(`OPENAI_API_KEY is empty/absent in ${envPath} — provision it first.`);
    return 1;
  }
  process.env.OPENAI_API_KEY = key;

  const runId = `smoke-openai-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const router = new LlmRouter({ runId });
  const nodeId = 'phrasing_card' as const; // cheapest node (gpt-5-mini)
  const model = router.config.nodes[nodeId].model;

  console.log(`llm-router live smoke — node=${nodeId} model=${model} runId=${runId}`);
  console.log('Routing one minimal request through the REAL OpenAI api_worker route…\n');

  const res = await router.route({
    nodeId,
    prompt: 'Reply with the single word: ok',
    // gpt-5-family reasoning tokens count against max_completion_tokens —
    // leave headroom so the visible reply is not starved.
    maxOutputTokens: 512,
  });

  console.log('Router result:');
  console.log(JSON.stringify(res, null, 2));

  const usd = costUsd(router.config, model, res.usage);
  console.log(`\nThis call, priced per config prices['${model}']: US$${usd.toFixed(6)}`);

  const ledgerPath = resolveRepoPath(router.config.budget.ledgerPath);
  console.log(`\nLedger (${ledgerPath}):`);
  console.log(JSON.stringify(JSON.parse(readFileSync(ledgerPath, 'utf8')), null, 2));

  const state = router.budgetState();
  console.log(
    `\nToday '${nodeId}': calls=${state.nodes[nodeId]?.calls} ` +
      `in=${state.nodes[nodeId]?.inputTokens} out=${state.nodes[nodeId]?.outputTokens} ` +
      `usd=${state.nodes[nodeId]?.usd.toFixed(6)}`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error('SMOKE FAILED:', err);
    process.exitCode = 1;
  },
);
