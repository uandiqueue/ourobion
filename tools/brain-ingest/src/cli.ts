#!/usr/bin/env tsx
/**
 * brain-ingest CLI entrypoint (design §10.1, §10.6).
 *
 * Ships `--help`, `--check-config`, and the pipeline verbs `ingest` / `status`
 * / `resume`, which delegate to `run.ts` (the §10.6 orchestrator).
 */

import { inspectConfig, loadConfig, sourceEnablement, REQUIRED_VARS } from './config.js';
import { run, statusReport, type RunResult } from './run.js';
import { SEED_TOPICS } from './seeds.js';
import { VenueCache, lookupVenueCached } from './venue/cache.js';
import { bandImpactTier, type SjrQuartile } from './venue/banding.js';

const USAGE = `ourobion brain-ingest — open-access-first paper-corpus fetcher

Usage:
  brain-ingest <command> [options]
  brain-ingest --help
  brain-ingest --check-config

Commands:
  ingest [--seed <topic>] [--limit N] [--dry-run] [--remote-control]
                                                    discover → resolve → retrieve → extract → store
  status                                           manifest + budget summary
  resume [--remote-control]                        continue an interrupted multi-day run (skip 'fetched')
  venue --issn <issn> [--sjr-quartile 1-4]         b2 venue lookup: OpenAlex Source stats +
                                                   C8 impactTier band (per-ISSN cache)

Seed topics:
  ${SEED_TOPICS.join(', ')}

Global options:
  --check-config    print which sources are enabled (keyless/keyed/disabled);
                    exit 0 if all required keys present, non-zero otherwise.
  --remote-control  read control/ingest-config.json from R2 before running: honor a
                    remote pause, a queued seed/limit request, and any budget-limit
                    override (see docs/nao/brain-ingestion-design.md). A --seed/--limit
                    passed on this command line always wins over a queued request.
  --help, -h        show this help.

Required env (tools/brain-ingest/.env):
  ${REQUIRED_VARS.join(', ')}
`;

/** Parsed CLI invocation. */
interface ParsedArgs {
  command: string | undefined;
  flags: Set<string>;
  options: Map<string, string>;
}

/** Tiny arg parser: first non-flag token is the command; `--k v` / `--k=v` / bare `--flag`. */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok.startsWith('--')) {
      const body = tok.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        options.set(body.slice(0, eq), body.slice(eq + 1));
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          options.set(body, next);
          i++;
        } else {
          flags.add(body);
        }
      }
    } else if (tok === '-h') {
      flags.add('help');
    } else if (command === undefined) {
      command = tok;
    }
  }

  return { command, flags, options };
}

/** Print the enablement summary and return the process exit code. */
function runCheckConfig(): number {
  const inspection = inspectConfig();
  process.stdout.write(sourceEnablement(inspection) + '\n');
  if (inspection.ok) {
    process.stdout.write('\nconfig OK — all required keys present.\n');
    return 0;
  }
  process.stderr.write(
    `\nconfig INVALID — missing required: ${inspection.missingRequired.join(', ')}\n`,
  );
  return 1;
}

/** Print the tallies of a completed run. */
function printRunResult(result: RunResult): void {
  process.stdout.write(
    `\ningest done: discovered=${result.discovered} fetched=${result.fetched} ` +
      `skipped=${result.skipped} deferred=${result.deferred}` +
      (result.budgetStopped ? ' (budget hard-stop)' : '') +
      '\n',
  );
}

/**
 * Parse the optional `--limit N` into a positive integer, or `undefined` when
 * absent. Throws on a non-numeric / non-positive value so the CLI fails loudly.
 */
function parseLimit(options: Map<string, string>): number | undefined {
  const raw = options.get('limit');
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--limit must be a positive integer (got '${raw}')`);
  }
  return n;
}

/**
 * Parse the optional `--sjr-quartile N` (1–4), or `undefined` when absent.
 * Throws on any other value so the CLI fails loudly.
 */
function parseSjrQuartile(options: Map<string, string>): SjrQuartile | undefined {
  const raw = options.get('sjr-quartile');
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (n !== 1 && n !== 2 && n !== 3 && n !== 4) {
    throw new Error(`--sjr-quartile must be 1, 2, 3, or 4 (got '${raw}')`);
  }
  return n;
}

/**
 * `venue --issn <issn>` — b2 lookup: cached OpenAlex Source stats + the C8
 * impactTier band. Works without a valid .env (the lookup is keyless); the
 * polite-pool mailto is sent only when config loads.
 */
async function runVenueLookup(options: Map<string, string>): Promise<number> {
  const issn = options.get('issn');
  if (issn === undefined) {
    process.stderr.write('venue: --issn <issn> is required\n');
    return 2;
  }
  let contactEmail: string | undefined;
  try {
    contactEmail = loadConfig().contactEmail;
  } catch {
    // keyless lookup still works; just no polite-pool mailto
  }
  const cache = VenueCache.open();
  const { venue, cacheHit } = await lookupVenueCached(issn, cache, { contactEmail });
  const outcome = bandImpactTier(venue, { sjrQuartile: parseSjrQuartile(options) ?? null });
  process.stdout.write(JSON.stringify({ venue, impactTier: outcome, cacheHit }, null, 2) + '\n');
  return 0;
}

/** CLI main — returns the process exit code. Async: the pipeline verbs await `run`. */
export async function main(argv: string[]): Promise<number> {
  const { command, flags, options } = parseArgs(argv);

  if (flags.has('help') || command === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  if (flags.has('check-config') || command === 'check-config') {
    return runCheckConfig();
  }

  try {
    switch (command) {
      case undefined:
        process.stdout.write(USAGE);
        return 0;

      case 'ingest': {
        const result = await run({
          seed: options.get('seed'),
          limit: parseLimit(options),
          dryRun: flags.has('dry-run'),
          // Real CLI runs get the host-memory guard (limits/memoryGuard.ts) —
          // `{}` uses its sensible defaults. `run()` callers that omit this
          // (tests) get no memory checking at all.
          memoryGuard: {},
          // Opt-in: read control/ingest-config.json from R2 (src/control.ts).
          controlFromR2: flags.has('remote-control'),
        });
        printRunResult(result);
        return 0;
      }

      case 'resume': {
        // Resume is `ingest` without a dry-run: already-'fetched' papers are
        // skipped (run() resumes from the manifest), so this picks up where an
        // interrupted multi-day run stopped.
        const result = await run({
          seed: options.get('seed'),
          limit: parseLimit(options),
          dryRun: false,
          memoryGuard: {},
          controlFromR2: flags.has('remote-control'),
        });
        printRunResult(result);
        return 0;
      }

      case 'status':
        process.stdout.write(statusReport() + '\n');
        return 0;

      case 'venue':
        return await runVenueLookup(options);

      default:
        process.stderr.write(`unknown command: ${command}\n\n` + USAGE);
        return 2;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${msg}\n`);
    return 1;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
