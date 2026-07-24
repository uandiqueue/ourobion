#!/usr/bin/env tsx
/**
 * llm-router CLI (mirrors brain-ingest's tiny-verb style).
 *
 * Verbs:
 *   check-config  — print the operator report: per-node model/family/route,
 *                   decorrelation verdict, key presence, budget state.
 *                   Exit codes: 0 config valid; 1 config invalid (incl.
 *                   decorrelation violations); 2 config valid but at least one
 *                   api_worker-routed node is missing its provider key
 *                   (blocked-on-key — register B5).
 *   ledger        — print today's per-node spend + per-run output tokens.
 */

import { checkConfig } from './router.js';
import { RouterConfigError } from './errors.js';

const USAGE = `ourobion llm-router — dual-route LLM dispatch for the brain pipeline

Usage:
  llm-router check-config [--config <path>]
  llm-router ledger [--config <path>]
  llm-router --help

check-config exit codes: 0 ok · 1 invalid config · 2 api_worker node missing its key.
`;

function getOption(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  const val = i !== -1 ? argv[i + 1] : undefined;
  return val !== undefined && !val.startsWith('-') ? val : undefined;
}

function main(argv: string[]): number {
  const command = argv.find((t) => !t.startsWith('-'));
  if (command === undefined || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return command === undefined && !argv.includes('--help') && !argv.includes('-h') ? 1 : 0;
  }
  const configPath = getOption(argv, 'config');

  if (command === 'check-config') {
    let report;
    try {
      report = checkConfig(configPath !== undefined ? { configPath } : {});
    } catch (err) {
      if (err instanceof RouterConfigError) {
        process.stderr.write(`INVALID CONFIG: ${err.message}\n`);
        return 1;
      }
      throw err;
    }
    process.stdout.write('llm-router config OK\n\nNodes:\n');
    for (const n of report.nodes) {
      const key = n.route === 'api_worker' ? (n.keyPresent ? 'key present' : `MISSING ${n.keyEnvVar}`) : 'keyless';
      process.stdout.write(
        `  ${n.nodeId.padEnd(17)} ${n.model.padEnd(18)} ${n.family.padEnd(10)} ${n.route.padEnd(12)} ` +
          `maxOut=${String(n.maxOutputTokens).padEnd(6)} ${key}${n.priceProvisional ? ' (price provisional)' : ''}\n`,
      );
    }
    if (report.decorrelation.ok) {
      process.stdout.write(
        `\nDecorrelation: OK — synthesis=${report.decorrelation.synthesisFamily}, ` +
          `verifier=${report.decorrelation.verifierFamily} (non-Anthropic enforced)\n`,
      );
    } else {
      process.stdout.write(
        `\nDecorrelation: VIOLATED (allowed by TEST-MODE) — synthesis=${report.decorrelation.synthesisFamily}, ` +
          `verifier=${report.decorrelation.verifierFamily}\n`,
      );
    }
    if (report.testMode !== undefined) {
      process.stdout.write(
        `\nTEST-MODE ACTIVE — reason: ${report.testMode.reason}\n` +
          `  All results must carry the label: ${report.testMode.label}\n`,
      );
    }
    process.stdout.write('\nKeys:\n');
    for (const [envVar, present] of Object.entries(report.keys)) {
      process.stdout.write(`  ${envVar.padEnd(20)} ${present ? 'present' : 'absent'}\n`);
    }
    const b = report.budget;
    process.stdout.write(
      `\nBudget (${b.day}): US$${b.perDayUsdPerNode}/day/node, ${b.perRunOutputTokens} output tokens/run, ` +
        `hard stop at ${b.hardStopFraction * 100}%\n`,
    );
    const blocked = report.nodes.filter((n) => n.route === 'api_worker' && !n.keyPresent);
    if (blocked.length > 0) {
      process.stderr.write(
        `\nBLOCKED ON KEYS: ${blocked.map((n) => `${n.nodeId} (${n.keyEnvVar})`).join(', ')}\n`,
      );
      return 2;
    }
    return 0;
  }

  if (command === 'ledger') {
    let report;
    try {
      report = checkConfig(configPath !== undefined ? { configPath } : {});
    } catch (err) {
      if (err instanceof RouterConfigError) {
        process.stderr.write(`INVALID CONFIG: ${err.message}\n`);
        return 1;
      }
      throw err;
    }
    const b = report.budget;
    process.stdout.write(`Ledger day ${b.day} (caps: US$${b.perDayUsdPerNode}/day/node, ${b.perRunOutputTokens} tok/run):\n`);
    const entries = Object.entries(b.nodes);
    if (entries.length === 0) process.stdout.write('  (no spend recorded today)\n');
    for (const [nodeId, c] of entries) {
      if (c === undefined) continue;
      process.stdout.write(
        `  ${nodeId.padEnd(17)} calls=${c.calls} in=${c.inputTokens} out=${c.outputTokens} usd=${c.usd.toFixed(4)}\n`,
      );
    }
    const runs = Object.entries(b.runs);
    process.stdout.write(runs.length === 0 ? 'Runs: (none)\n' : 'Runs:\n');
    for (const [runId, r] of runs) {
      process.stdout.write(`  ${runId} started=${r.startedAt} outputTokens=${r.outputTokens}\n`);
    }
    return 0;
  }

  process.stderr.write(`unknown command '${command}'\n\n${USAGE}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
