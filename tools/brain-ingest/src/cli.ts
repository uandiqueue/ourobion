#!/usr/bin/env tsx
/**
 * brain-ingest CLI entrypoint (design §10.1, §10.6).
 *
 * Ships `--help`, `--check-config`, and the pipeline verbs `ingest` / `status`
 * / `resume`, which delegate to `run.ts` (the §10.6 orchestrator).
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { inspectConfig, loadConfig, sourceEnablement, REQUIRED_VARS } from './config.js';
import { run, statusReport, type RunResult } from './run.js';
import { SEED_TOPICS } from './seeds.js';
import { VenueCache, lookupVenueCached } from './venue/cache.js';
import { bandImpactTier, type SjrQuartile } from './venue/banding.js';
import {
  buildSeederPrompt,
  candidateCounts,
  enumerateSeederCandidates,
  generateSeedQueries,
} from './seeder/index.js';
import { pairFromKeys, synthesize, claimsPath, defaultEdgesDir } from './synth/index.js';
import { repoRoot } from './seeder/load.js';
import { R2Store } from './storage/r2.js';
import { r2TextLoader } from './verify/quoteCheck.js';
import { verify } from './verify/verifier.js';
import { corpusTexts, loadCorpusFromFile } from './verify/corpus.js';
import { LlmRouter } from '../../llm-router/src/index.js';

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
  seed-queries [--dry-run|--candidates-only] [--cap N]
                                                   agentic seeder: registry derivedFrom[] + rule-blueprint
                                                   pairs + static topics → LLM search queries (via router);
                                                   writes data/corpus/seed-queries.json (ingest consumes it)
  synthesize (--pair a,b | --from-seed-artifact) --paper <uid>[,<uid>]
             [--terms t1,t2] [--dry-run] [--push-r2]
                                                   A8 synthesis: load canonical text → passages → LLM
                                                   RelationshipClaims (via router), quoteCheck-gated;
                                                   appends data/corpus/edges/claims.jsonl (edge-loader reads it)
  verify [--from-claims <path>] [--corpus <path>] [--edge <edgeId>]
         [--edges-dir <dir>] [--dry-run] [--triage-only]
                                                   A10 adversarial verification: A9 quoteCheck →
                                                   budget triage (C7) → verifier-owned retrieval →
                                                   refute-first LLM (router node 'verifier',
                                                   non-Anthropic) → schema-enforced EdgeVerification;
                                                   appends <edges-dir>/verifications.jsonl.
                                                   --corpus <path>: JSONL of CorpusDoc lines the
                                                   verifier retrieves over (O15; corpus texts also
                                                   serve the quoteCheck for papers they cover);
                                                   WITHOUT it retrieval runs over an EMPTY corpus.
                                                   --triage-only / --dry-run make no LLM call.
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

/**
 * Parse the optional `--cap N` (per-candidate query cap) into a positive
 * integer, or `undefined` when absent. Throws on a non-positive value.
 */
function parseCap(options: Map<string, string>): number | undefined {
  const raw = options.get('cap');
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--cap must be a positive integer (got '${raw}')`);
  }
  return n;
}

/**
 * `seed-queries` — the agentic seeder (design steps 1–3).
 *  - `--candidates-only`: print the deterministic candidate list, no LLM call.
 *  - `--dry-run`: print candidates + the prompt that WOULD be sent, no call/write.
 *  - default: call the router (local_agent mailbox per config), validate, and
 *    write `data/corpus/seed-queries.json`.
 */
async function runSeedQueries(
  flags: Set<string>,
  options: Map<string, string>,
): Promise<number> {
  const cap = parseCap(options);
  const log = (line: string) => process.stdout.write(line + '\n');

  if (flags.has('candidates-only')) {
    const candidates = await enumerateSeederCandidates();
    const counts = candidateCounts(candidates);
    log(
      `candidates: ${candidates.length} (derivedFrom=${counts.derivedFrom} ` +
        `rule_blueprint=${counts.rule_blueprint} static_topic=${counts.static_topic})`,
    );
    for (const c of candidates) log(`  [${c.source}] ${c.id} — ${c.label}`);
    return 0;
  }

  if (flags.has('dry-run')) {
    const candidates = await enumerateSeederCandidates();
    const counts = candidateCounts(candidates);
    const { system, prompt } = buildSeederPrompt(candidates);
    log(
      `dry-run: ${candidates.length} candidate(s) (derivedFrom=${counts.derivedFrom} ` +
        `rule_blueprint=${counts.rule_blueprint} static_topic=${counts.static_topic}) — no LLM call.`,
    );
    log('\n--- system ---\n' + system);
    log('\n--- prompt ---\n' + prompt);
    return 0;
  }

  const result = await generateSeedQueries({
    ...(cap !== undefined ? { capPerCandidate: cap } : {}),
    log,
  });
  const withQueries = result.artifact.candidates.filter((c) => c.queries.length > 0).length;
  log(
    `seed-queries done: ${withQueries}/${result.artifact.candidates.length} candidate(s) got queries ` +
      `via ${result.response.route} (${result.response.model}); rejected=${result.rejectedKeys.length}`,
  );
  return 0;
}

/** Parse a comma-separated option into a trimmed, non-empty list (or `undefined`). */
function parseCsv(options: Map<string, string>, key: string): string[] | undefined {
  const raw = options.get(key);
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}

/**
 * `synthesize` — the A8 synthesis node (design steps 1–4).
 *  - `--pair a,b`: synthesise for one explicit metric pair.
 *  - `--from-seed-artifact`: synthesise for every derivedFrom/rule_blueprint pair
 *    in data/corpus/seed-queries.json.
 *  - `--paper <uid>[,<uid>]`: papers to synthesise against (canonical text).
 *  - `--terms t1,t2`: override the passage-prefilter terms.
 *  - `--dry-run`: assemble + print the prompt, no LLM call / no write.
 *  - `--push-r2`: also append accepted claims to R2 edges/claims.jsonl.
 */
async function runSynthesize(
  flags: Set<string>,
  options: Map<string, string>,
): Promise<number> {
  const log = (line: string) => process.stdout.write(line + '\n');
  const paperUids = parseCsv(options, 'paper');
  if (paperUids === undefined) {
    process.stderr.write('synthesize: --paper <uid>[,<uid>] is required\n');
    return 2;
  }
  const pairRaw = parseCsv(options, 'pair');
  const fromSeed = flags.has('from-seed-artifact');
  if (!pairRaw && !fromSeed) {
    process.stderr.write('synthesize: pass --pair a,b OR --from-seed-artifact\n');
    return 2;
  }
  if (pairRaw && (pairRaw.length !== 2)) {
    process.stderr.write('synthesize: --pair needs exactly two metric keys (a,b)\n');
    return 2;
  }
  const terms = parseCsv(options, 'terms');
  const result = await synthesize({
    paperUids,
    ...(pairRaw ? { pairs: [pairFromKeys(pairRaw[0]!, pairRaw[1]!, terms)] } : { fromSeedArtifact: true }),
    ...(terms ? { terms } : {}),
    dryRun: flags.has('dry-run'),
    pushR2: flags.has('push-r2'),
    log,
  });

  if (flags.has('dry-run')) {
    for (const o of result.outcomes) {
      log(`\n--- system (pair ${o.pair.id}) ---\n` + o.assembled.system);
      log(`\n--- prompt (pair ${o.pair.id}) ---\n` + o.assembled.prompt);
    }
    log(`\ndry-run: ${result.outcomes.length} pair(s) assembled — no LLM call.`);
    return 0;
  }
  log(
    `synthesize done: ${result.accepted.length} claim(s) accepted, ${result.rejectedCount} rejected` +
      (result.write ? ` — ${result.write.written} written (${result.write.skipped} dup) → ${result.write.path}` : ''),
  );
  return 0;
}

/**
 * `verify` — the A10 adversarial verifier (design steps 1–4).
 *  - `--from-claims <path>`: claims.jsonl to verify (default <edges-dir>/claims.jsonl).
 *  - `--corpus <path>`: JSONL corpus (one CorpusDoc per line) the verifier's OWN retrieval
 *    ranks over (O15/B1 — without it retrieval runs over an EMPTY corpus and is logged
 *    loudly). Corpus texts also serve the A9 quoteCheck for the papers they cover; the
 *    R2 text loader fills cited ids the corpus lacks. Live retrieval is a later cycle.
 *  - `--edge <edgeId>`: verify only this edge.
 *  - `--edges-dir <dir>`: where claims.jsonl defaults from / verifications.jsonl is written
 *    (default data/corpus/edges).
 *  - `--triage-only`: print the budget-triage decision per claim; no retrieval / LLM / write.
 *  - `--dry-run`: run quoteCheck + retrieval + assemble the prompt; no LLM call / no write.
 *  - default: full run — routes the verifier node (api_worker per config; real runs need the
 *    non-Anthropic key) and appends edges/verifications.jsonl.
 */
async function runVerify(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const log = (line: string) => process.stdout.write(line + '\n');
  const root = repoRoot();
  const edgesDir = options.get('edges-dir') ?? defaultEdgesDir(root);
  const claimsFile = options.get('from-claims') ?? claimsPath(edgesDir);
  const triageOnly = flags.has('triage-only');
  const dryRun = flags.has('dry-run');

  const runOpts: Parameters<typeof verify>[0] = {
    claimsPath: claimsFile,
    edgesDir,
    triageOnly,
    dryRun,
    log,
  };
  const edge = options.get('edge');
  if (edge !== undefined) runOpts.edgeId = edge;

  // The quoteCheck / retrieval / LLM path needs paper text + the router; --triage-only needs neither.
  if (!triageOnly) {
    runOpts.textLoader = r2TextLoader(new R2Store(loadConfig()));

    // O15: feed the verifier's own retrieval. A committed fixture corpus is the
    // supported source this cycle; a live-retrieval adapter is a LATER cycle.
    const corpusFile = options.get('corpus');
    if (corpusFile !== undefined) {
      const corpus = loadCorpusFromFile(corpusFile);
      runOpts.retrieve = { corpus };
      // Corpus texts also serve the A9 quoteCheck for papers the corpus holds;
      // the R2 loader (above) fills only the cited ids the corpus lacks.
      runOpts.texts = corpusTexts(corpus);
      log(`verify: corpus loaded — ${corpus.length} doc(s) from ${corpusFile}`);
    } else {
      log(
        'verify: WARNING — no --corpus supplied: verifier-owned retrieval will run over an ' +
          'EMPTY corpus (ZERO sources retrieved for every claim), so full-mode verdicts cannot ' +
          'be grounded. Pass --corpus <path> (JSONL of CorpusDoc lines, e.g. ' +
          'tools/brain-ingest/fixtures/verify-corpus.jsonl). Live retrieval is a later cycle.',
      );
    }

    if (!dryRun) {
      // The router config enforces the non-Anthropic decorrelation invariant at load;
      // a real dispatch surfaces the missing key (run decision D4 / register B5).
      runOpts.router = new LlmRouter();
      runOpts.verifierModel = 'router:verifier-node';
    }
  }

  const result = await verify(runOpts);
  for (const r of result.results) {
    if (triageOnly) {
      log(`  - ${r.claim.edgeId} → ${r.triage.mode}` + (r.triage.reasons.length ? ` (${r.triage.reasons.join('; ')})` : ''));
    } else if (r.record) {
      log(`  - ${r.claim.edgeId} → ${r.record.verdict} [${r.triage.mode}]${r.fallback ? ' (fallback)' : ''}`);
    } else if (r.rejected) {
      log(`  - ${r.claim.edgeId} → REJECTED (${r.rejected.reason})`);
    } else if (dryRun) {
      log(`  - ${r.claim.edgeId} → dry-run [${r.triage.mode}] retrieved ${r.retrieval?.sources.length ?? 0} source(s)`);
    }
  }
  log(
    `verify done: ${result.records.length} verification(s), ${result.rejectedCount} rejected` +
      (result.write ? ` — ${result.write.written} written (${result.write.skipped} dup) → ${result.write.path}` : ''),
  );
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

      case 'seed-queries':
        return await runSeedQueries(flags, options);

      case 'synthesize':
        return await runSynthesize(flags, options);

      case 'verify':
        return await runVerify(flags, options);

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

/**
 * True when this module is the directly-invoked script (`tsx src/cli.ts …`,
 * `npm start -- …`) rather than an import (the CLI integration tests import
 * {@link main} and drive it with argv arrays — auto-running here would make the
 * test process print usage and exit). Windows: realpath + case-insensitive
 * compare (drive-letter casing varies by invoker).
 */
function isDirectCliRun(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const target = realpathSync(invoked);
    return process.platform === 'win32'
      ? self.toLowerCase() === target.toLowerCase()
      : self === target;
  } catch {
    return false;
  }
}

if (isDirectCliRun()) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
