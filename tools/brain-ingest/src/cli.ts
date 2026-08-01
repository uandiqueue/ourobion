#!/usr/bin/env tsx
/**
 * brain-ingest CLI entrypoint (design §10.1, §10.6).
 *
 * Ships `--help`, `--check-config`, and the pipeline verbs `ingest` / `status`
 * / `resume`, which delegate to `run.ts` (the §10.6 orchestrator).
 */

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectConfig, loadConfig, sourceEnablement, REQUIRED_VARS } from './config.js';
import { run, statusReport, hydrateManifestFromR2, defaultCorpusDir, type RunResult } from './run.js';
import { Manifest, MANIFEST_FILENAME, readAll } from './manifest.js';
import { SEED_TOPICS } from './seeds.js';
import { VenueCache, lookupVenueCached } from './venue/cache.js';
import { bandImpactTier, type SjrQuartile } from './venue/banding.js';
import {
  buildSeederPrompt,
  candidateCounts,
  enumerateSeederCandidates,
  generateSeedQueries,
  loadMergedSeeds,
  type MergedSeeds,
} from './seeder/index.js';
import {
  pairFromKeys,
  synthesize,
  synthesizePapers,
  claimsPath,
  defaultEdgesDir,
} from './synth/index.js';
import { repoRoot } from './seeder/load.js';
import { R2Store } from './storage/r2.js';
import { r2TextLoader } from './verify/quoteCheck.js';
import { verify } from './verify/verifier.js';
import { corpusTexts, loadCorpusFromFile } from './verify/corpus.js';
import {
  buildCorpusRows,
  cachedVenueImpactResolver,
  serializeCorpusRows,
  textDirLoader,
} from './verify/corpusBuild.js';
import { LlmRouter, validateAcceptanceAuthorization } from '../../llm-router/src/index.js';
import type { AcceptanceCallContext } from '../../llm-router/src/index.js';
import { runSinglePaper } from './singlePaper.js';
import { runOfflineAcceptance } from './offlineAcceptance.js';
import { runLiveAcceptance, type LiveAcceptanceLeg } from './liveAcceptance.js';
import {
  normalizeArtifactHashes,
  promoteArtifactBundle,
  readLocalArtifactBundle,
  readR2ArtifactBundle,
  type ArtifactHashes,
} from './artifactPromotion.js';

const USAGE = `ourobion brain-ingest — open-access-first paper-corpus fetcher

Usage:
  brain-ingest <command> [options]
  brain-ingest --help
  brain-ingest --check-config

Commands:
  ingest [--seed <topic>] [--limit N] [--dry-run] [--remote-control]
                                                    discover → resolve → retrieve → extract → store
  status                                           manifest + budget summary
  hydrate-manifest                                 populate the LOCAL corpus manifest cache from R2's
                                                   canonical manifest/papers.jsonl. Required before
                                                   synthesize on a machine that has never run ingest
                                                   (e.g. a fresh CI runner), which otherwise fails
                                                   with "manifest/corpus metadata missing".
                                                   No-op when the cache is already populated.
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
  synthesize-papers --paper <uid>[,<uid>] [--max-usd <n>] [--max-calls <n>]
                    [--no-resume] [--no-blueprints] [--dry-run] [--push-r2]
                                                   #300 WHOLE-PAPER synthesis: the full canonical text goes
                                                   in (no keyword prefilter), one provider call per paper,
                                                   serial. Emits RelationshipClaims AND 'extracted' rule
                                                   blueprints, each grounded in a verbatim evidence quote
                                                   plus the paper's own verbatim mechanism sentence.
                                                   Stops cleanly at --max-usd/--max-calls and skips papers
                                                   already synthesised, so a re-run never pays twice;
                                                   appends claims.jsonl + blueprints.jsonl
  verify [--from-claims <path>] [--corpus <path>] [--edge <edgeId>]
         [--edges-dir <dir>] [--artifact-revision <id>] [--dry-run] [--triage-only]
         [--acceptance-authorization <file> --acceptance-run-id <id>]
                                                   the two acceptance flags are given TOGETHER and
                                                   carry an owner-issued authorization into the
                                                   verifier call. REQUIRED whenever the verifier
                                                   node is a family the router restricts to the
                                                   acceptance path (Agnes): free pricing means the
                                                   USD ledger cannot bound that node, so the attempt
                                                   journal + validated descriptor + per-logical-call
                                                   POST cap are the only bound. Without them an
                                                   Agnes verifier is refused BEFORE dispatch, which
                                                   is the guard working, not a fault. The descriptor
                                                   is validated by the router, so a malformed,
                                                   expired or over-spent authorization fails closed
                                                   before any provider call
                                                   A10 adversarial verification: A9 quoteCheck →
                                                   budget triage (C7) → verifier-owned retrieval →
                                                   refute-first LLM (router node 'verifier', in a
                                                   different vendor family than synthesis) →
                                                   schema-enforced EdgeVerification; appends
                                                   <edges-dir>/verifications.jsonl + the raw provider
                                                   body to <edges-dir>/verification-raw.jsonl.
                                                   --corpus <path>: JSONL of CorpusDoc lines the
                                                   verifier retrieves over (O15; corpus texts also
                                                   serve the quoteCheck for papers they cover);
                                                   WITHOUT it retrieval runs over an EMPTY corpus.
                                                   --triage-only / --dry-run make no LLM call.
  single-paper --doi <doi> --local-dir <dir> --pair <a,b> [--terms t1,t2]
               [--load-local-db <loopback PostgreSQL URL>] [--dry-run] [--resume]
                                                   local-only request/response intake; no remote routing.
  offline-acceptance --bundle <file> --dry-run
                                                   frozen A8 → A9 → A10 preflight; no provider, R2, or DB.
  live-acceptance --bundle <file> --leg <anthropic-synthesis|openai-synthesis|agnes-verification> --execute
                                                   one ordered provider leg after offline preflight;
                                                   fixed journal/state, no R2 or DB.
  promote-edge-artifacts [--edges-dir <dir>] --claims-sha256 <hex>
                         --blueprints-sha256 <hex> --verifications-sha256 <hex>
                         [--env-file <path>] [--check]
                                                   NO-PROVIDER exact-byte promotion of an existing
                                                   post-#300 claim + blueprint + verification bundle.
                                                   Every hash and shared contract is checked before
                                                   R2; any non-identical existing key fails closed.
  check-r2-edge-artifacts --claims-sha256 <hex> --blueprints-sha256 <hex>
                          --verifications-sha256 <hex> [--env-file <path>]
                                                   fetch and validate the exact pinned three-object
                                                   R2 bundle; no provider or database access.
  venue --issn <issn> [--sjr-quartile 1-4]         b2 venue lookup: OpenAlex Source stats +
                                                   C8 impactTier band (per-ISSN cache)
  build-verify-corpus [--manifest <path>] [--out <path>] [--text-dir <dir>]
                      [--limit N] [--dry-run]
                                                   OFFLINE projection of data/corpus/papers.jsonl
                                                   into the REAL CorpusDoc JSONL that 'verify
                                                   --corpus' ranks over (replaces the 5-line test
                                                   fixture, which would fabricate corroboration).
                                                   evidenceTier: the deterministic classifier
                                                   (src/evidenceTier.ts), with evidenceInputs kept
                                                   so every load recomputes it. impactTier: the
                                                   per-ISSN venue cache + C8 bands — warm it with
                                                   'venue --issn' first; an unresolvable venue takes
                                                   the repo's conservative unscored band, never a
                                                   flattering guess. text: real canonical text when
                                                   --text-dir mirrors R2's text/<uid>.txt, else the
                                                   real abstract; papers with NEITHER are skipped
                                                   and counted. No provider, R2, or network calls.
                                                   Default out: data/corpus/verify-corpus.jsonl
                                                   (gitignored — do not commit it).

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

/** Default output for `build-verify-corpus` — inside the gitignored corpus dir. */
export const VERIFY_CORPUS_FILENAME = 'verify-corpus.jsonl';

/**
 * `build-verify-corpus` — project the ingested manifest into a REAL
 * `--corpus` JSONL for `verify` (src/verify/corpusBuild.ts).
 *
 * Fully OFFLINE: no provider, no R2, no OpenAlex. `evidenceTier` comes from the
 * deterministic classifier via `buildCorpusDoc`; `impactTier` from the per-ISSN
 * venue cache the `venue` verb warms, falling back to the repo's conservative
 * unscored-venue band; `text` from real canonical text (`--text-dir`) else the
 * real abstract. Papers with neither are skipped and counted — never padded.
 *
 * Writes into the gitignored `data/corpus/` by default so a large derived
 * corpus never lands in git, and prints an accounting summary to stdout.
 */
function runBuildVerifyCorpus(flags: Set<string>, options: Map<string, string>): number {
  const corpusDir = defaultCorpusDir();
  const manifestPath = options.get('manifest') ?? join(corpusDir, MANIFEST_FILENAME);
  const outPath = options.get('out') ?? join(corpusDir, VERIFY_CORPUS_FILENAME);
  const textDir = options.get('text-dir');

  const records = readAll(manifestPath);
  if (records.length === 0) {
    process.stderr.write(
      `build-verify-corpus: no records at '${manifestPath}' — run 'ingest' or 'hydrate-manifest' first\n`,
    );
    return 1;
  }

  const result = buildCorpusRows(records, {
    ...(textDir !== undefined ? { loadText: textDirLoader(textDir) } : {}),
    resolveImpact: cachedVenueImpactResolver(VenueCache.open(corpusDir)),
    ...(parseLimit(options) !== undefined ? { limit: parseLimit(options) } : {}),
  });

  if (result.rows.length === 0) {
    process.stderr.write('build-verify-corpus: no paper yielded an honest CorpusDoc — nothing written\n');
    return 1;
  }

  if (!flags.has('dry-run')) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, serializeCorpusRows(result.rows), 'utf8');
  }

  // Skip reasons are reported in full: a corpus that silently dropped papers
  // would misrepresent how much literature the verifier actually searched.
  process.stdout.write(
    JSON.stringify(
      {
        manifest: manifestPath,
        out: flags.has('dry-run') ? null : outPath,
        dryRun: flags.has('dry-run'),
        textDir: textDir ?? null,
        ...result.stats,
        skipExamples: result.skips.slice(0, 10),
      },
      null,
      2,
    ) + '\n',
  );
  if (result.stats.venueBanded === 0) {
    process.stdout.write(
      "note: 0 venues were banded from data/corpus/venues.json, so every impactTier is the " +
        "conservative unscored band. Warm the cache with 'brain-ingest venue --issn <issn>' " +
        'and re-run to get real C8 bands.\n',
    );
  }
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
 * Log the O14 topic-pool header ("topics: N static + M db") so every run makes
 * the seeds source visible; the merge itself is `seeder/dbSeeds.ts` (fail-soft:
 * no/unreachable Supabase → static only + one loud warning on stderr).
 */
async function loadTopicPool(log: (line: string) => void): Promise<MergedSeeds> {
  const merged = await loadMergedSeeds({ warn: (m) => process.stderr.write(m + '\n') });
  log(
    `topics: ${merged.staticCount} static + ${merged.dbCount} db` +
      (merged.dbAvailable ? '' : ' (db seeds unavailable — static only)'),
  );
  return merged;
}

/**
 * `seed-queries` — the agentic seeder (design steps 1–3).
 *  - `--candidates-only`: print the deterministic candidate list, no LLM call.
 *  - `--dry-run`: print candidates + the prompt that WOULD be sent, no call/write.
 *  - default: call the router (local_agent mailbox per config), validate, and
 *    write `data/corpus/seed-queries.json`.
 * Topic anchors are the MERGED static + `ingestion_seeds` pool (O14
 * seeds-as-data): a db seed anchors candidates exactly like a static topic;
 * the C9 pair gate is untouched.
 */
async function runSeedQueries(
  flags: Set<string>,
  options: Map<string, string>,
): Promise<number> {
  const cap = parseCap(options);
  const log = (line: string) => process.stdout.write(line + '\n');
  const topics = (await loadTopicPool(log)).seeds;

  if (flags.has('candidates-only')) {
    const candidates = await enumerateSeederCandidates({ topics });
    const counts = candidateCounts(candidates);
    log(
      `candidates: ${candidates.length} (derivedFrom=${counts.derivedFrom} ` +
        `rule_blueprint=${counts.rule_blueprint} static_topic=${counts.static_topic})`,
    );
    for (const c of candidates) log(`  [${c.source}] ${c.id} — ${c.label}`);
    return 0;
  }

  if (flags.has('dry-run')) {
    const candidates = await enumerateSeederCandidates({ topics });
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
    topics,
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
 *  - `--artifact-revision <id>`: R4-U4/O27 — the artifact BUNDLE revision stamped onto every
 *    emitted record (with a content hash of the record's own bytes and its fixture/live
 *    posture). WITHOUT it records carry no artifact ref and can NEVER pass the serving trust
 *    gate; a revision is operator knowledge, so it is never invented here.
 *  - `--triage-only`: print the budget-triage decision per claim; no retrieval / LLM / write.
 *  - `--dry-run`: run quoteCheck + retrieval + assemble the prompt; no LLM call / no write.
 *  - default: full run — routes the verifier node (api_worker per config; real runs need the
 *    verifier vendor's key — ANTHROPIC_API_KEY under the C13 posture) and appends
 *    edges/verifications.jsonl plus edges/verification-raw.jsonl (R4-U3 raw evidence).
 */
/**
 * #307 option (d) · Load an owner-issued acceptance authorization for the plain `verify` route.
 *
 * WHY THIS EXISTS. `verify()` has always declared an acceptance context (`verifier.ts:115`) and
 * used it (`:276-279`), but only `liveAcceptance.ts` ever supplied one — `cli.ts` never did. That
 * gap became load-bearing the moment the verifier moved to Agnes: `callApiWorker` refuses family
 * `agnes` without `req.acceptance` ("Agnes is acceptance-only"), so the ordinary `verify` command
 * could not dispatch at all.
 *
 * The fix is to make the authorization REACHABLE, not to weaken the guard. Agnes is priced free and
 * reserves US$0, so the per-day USD ledger cannot bound the verifier node; the attempt journal, the
 * validated descriptor and the per-logical-call POST cap are the only remaining bound. Relaxing the
 * acceptance-only check would have removed all three at once. This keeps every one of them and
 * simply lets an operator hand in the descriptor the owner issued.
 *
 * The descriptor is validated by the router's own `validateAcceptanceAuthorization`, so a malformed,
 * expired or over-spent authorization fails closed HERE, before any provider call.
 */
function loadAcceptanceContext(
  options: Map<string, string>,
  log: (line: string) => void,
): Omit<AcceptanceCallContext, 'logicalCallId'> | undefined {
  const file = options.get('acceptance-authorization');
  const runId = options.get('acceptance-run-id');
  if (file === undefined && runId === undefined) return undefined;
  if (file === undefined || runId === undefined) {
    throw new Error(
      'verify: --acceptance-authorization <file> and --acceptance-run-id <id> must be given together',
    );
  }

  let raw: unknown;
  try {
    // Strip a UTF-8 BOM: an operator on Windows writing this descriptor with PowerShell's
    // `Out-File`/`Set-Content` gets one by default, and `JSON.parse` rejects it with an opaque
    // "Unexpected token" that reads like a malformed authorization rather than an encoding artifact.
    // Same tolerance the JSONL readers in synth/artifact.ts already apply.
    const text = readFileSync(file, 'utf8');
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error: unknown) {
    throw new Error(
      `verify: cannot read acceptance authorization '${file}' — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Fails closed on a bad window, a bad id, or prior use exceeding the cap.
  const authorization = validateAcceptanceAuthorization(raw, Date.now());
  const perProvider = Object.entries(authorization.providers)
    .map(([family, limit]) => `${family} ${limit.priorPostStarts}/${limit.maxPostStarts} starts`)
    .join(', ');
  log(
    `verify: acceptance authorization '${authorization.authorizationId}' accepted ` +
      `(run ${runId}) — ${perProvider}`,
  );
  return { acceptanceRunId: runId, authorization };
}

async function runVerify(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const log = (line: string) => process.stdout.write(line + '\n');
  const root = repoRoot();
  const edgesDir = options.get('edges-dir') ?? defaultEdgesDir(root);
  const claimsFile = options.get('from-claims') ?? claimsPath(edgesDir);
  const triageOnly = flags.has('triage-only');
  const dryRun = flags.has('dry-run');
  const acceptance = loadAcceptanceContext(options, log);

  const runOpts: Parameters<typeof verify>[0] = {
    claimsPath: claimsFile,
    edgesDir,
    triageOnly,
    dryRun,
    log,
    // #307 (d): present only when the operator supplied an owner-issued authorization. Absent, the
    // Agnes verifier is refused before dispatch — which is the guard working, not a bug.
    ...(acceptance !== undefined ? { acceptance } : {}),
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
      // The router config enforces the decorrelation invariant (family(verifier) !==
      // family(synthesis)) unconditionally at load; a real dispatch surfaces the missing
      // key (run decision D4 / register B5).
      // U8/D13 carry-forward: the async factory fetches nao's cap overrides
      // (llm_router_cap_overrides) FAIL-SOFT so they bind this real verify run.
      const router = await LlmRouter.create();
      runOpts.router = router;
      // R4-U4/O27 (B-BR1): this is the CONFIGURED id, and the `config:` prefix says so
      // out loud. It used to be the opaque sentinel 'router:verifier-node', which read
      // like an identity while being a stand-in; either way it is a config echo and can
      // never be attestation. What the provider RETURNS is captured separately at
      // response time and lands in the record's `attestation` block.
      runOpts.verifierModel = `config:${router.config.nodes.verifier.model}`;
    }
  }

  // R4-U4/O27: the artifact BUNDLE revision. Absent ⇒ no artifact ref is stamped and the
  // records stay unservable by construction — say so loudly rather than silently emitting
  // provenance-less records that will be blocked much later at the serving gate.
  const artifactRevision = options.get('artifact-revision');
  if (artifactRevision !== undefined && artifactRevision.trim() !== '') {
    runOpts.artifactRevision = artifactRevision.trim();
  } else if (!triageOnly && !dryRun) {
    log(
      'verify: WARNING — no --artifact-revision supplied: emitted records carry NO artifact ' +
        'reference (revision / content hash / posture), so the serving trust gate will block ' +
        'every card derived from them (missing-artifact-ref). Pass --artifact-revision <id> ' +
        'naming the artifact bundle this run belongs to.',
    );
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

/**
 * `synthesize-papers` — #300 whole-paper batch synthesis (§A–§D, G1/G2/G3/G5).
 *
 * The SINGLE entry point for both front doors (G5): the session-screened demo batch and the
 * nao-triggered single paper differ only in how many uids `--paper` carries.
 *
 *  - `--paper <uid>[,<uid>]`: papers to synthesise — one provider call each, serial.
 *  - `--max-usd <n>`:  G2 stop cleanly once this much has been spent.
 *  - `--max-calls <n>`: G2 stop cleanly after this many provider calls.
 *  - `--no-resume`:    re-synthesise papers already present in claims.jsonl (default is to skip
 *                      them, so a re-run never pays twice).
 *  - `--no-blueprints`: emit edges only, no rule blueprints.
 *  - `--dry-run`:      assemble + print prompts, no LLM call, no write.
 *  - `--push-r2`:      also append accepted claims to R2 edges/claims.jsonl.
 */
async function runSynthesizePapersCli(
  flags: Set<string>,
  options: Map<string, string>,
): Promise<number> {
  const log = (line: string) => process.stdout.write(line + '\n');
  const paperUids = parseCsv(options, 'paper');
  if (paperUids === undefined) {
    process.stderr.write('synthesize-papers: --paper <uid>[,<uid>] is required\n');
    return 2;
  }

  const numeric = (key: string): number | null | undefined => {
    // FAIL CLOSED on a malformed ceiling. `parseArgs` files `--max-usd -5` (and a bare
    // `--max-usd` with no value at all) under `flags`, not `options`, because the next token
    // starts with '-'. Reading only `options` would silently mean "no ceiling" — a spend guard
    // that vanishes when you typo it is worse than no guard, so refuse instead of defaulting.
    if (flags.has(key)) {
      process.stderr.write(
        `synthesize-papers: --${key} needs a non-negative value (use --${key}=<n>; ` +
          'a negative or missing value is refused rather than treated as "no ceiling")\n',
      );
      return null;
    }
    const raw = options.get(key);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      process.stderr.write(`synthesize-papers: --${key} must be a non-negative number\n`);
      return null;
    }
    return value;
  };
  const maxUsd = numeric('max-usd');
  const maxCalls = numeric('max-calls');
  if (maxUsd === null || maxCalls === null) return 2;

  const result = await synthesizePapers({
    paperUids,
    ...(maxUsd !== undefined ? { maxUsd } : {}),
    ...(maxCalls !== undefined ? { maxCalls } : {}),
    resume: !flags.has('no-resume'),
    emitBlueprints: !flags.has('no-blueprints'),
    dryRun: flags.has('dry-run'),
    pushR2: flags.has('push-r2'),
    log,
  });

  if (flags.has('dry-run')) {
    for (const a of result.assembled ?? []) {
      log(`\n--- system (${a.paperUid}) ---\n${a.system}`);
      log(`\n--- prompt (${a.paperUid}) ---\n${a.prompt}`);
    }
    log(`\ndry-run: ${(result.assembled ?? []).length} paper(s) assembled — no LLM call.`);
    return 0;
  }

  // G2 · the run ALWAYS reports where it stopped and what it cost, so a partial pass is a
  // legitimate, resumable outcome rather than an ambiguous failure.
  const b = result.budget;
  log('');
  log(`synthesize-papers stopped: ${b.stopReason}`);
  // #307 · All FOUR buckets, and they must sum to papersRequested. Reporting only three printed
  // `2 synthesised, 0 already done, 0 not reached (of 3 requested)` on a real run — a failed paper
  // counted nowhere. The reconciliation line makes any future gap impossible to miss.
  const accounted =
    b.papersSynthesised + b.papersSkippedAlreadyDone + b.papersNotReached + b.papersFailed;
  log(
    `  papers: ${b.papersSynthesised} synthesised, ${b.papersSkippedAlreadyDone} already done, ` +
      `${b.papersFailed} failed, ${b.papersNotReached} not reached ` +
      `(of ${b.papersRequested} requested)`,
  );
  if (accounted !== b.papersRequested) {
    log(
      `  WARNING: accounting gap — ${accounted} papers accounted for of ${b.papersRequested} ` +
        'requested; some paper is unreported',
    );
  }
  if (b.papersFailed > 0) {
    for (const p of result.perPaper.filter((x) => x.status === 'failed')) {
      log(`  FAILED ${p.paperUid}: ${p.detail ?? 'no detail recorded'}`);
    }
  }
  log(
    `  provider: ${b.providerCalls} call(s), US$${b.usdSpent.toFixed(6)}` +
      `${b.maxUsd !== null ? ` of US$${b.maxUsd} ceiling` : ''}` +
      `${b.maxCalls !== null ? `, ${b.maxCalls}-call ceiling` : ''}`,
  );
  log(
    `  output: ${result.accepted.length} claim(s), ${result.blueprints.length} blueprint(s) ` +
      `(${result.rejectedCount} claim / ${result.rejectedBlueprintCount} blueprint rejected)`,
  );
  if (b.papersNotReached > 0) {
    const remaining = result.perPaper.filter((p) => p.status === 'not-reached').map((p) => p.paperUid);
    log(`  resume with: --paper ${remaining.join(',')}`);
  }
  return 0;
}

async function runSinglePaperCli(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const doi = options.get('doi');
  const localDir = options.get('local-dir');
  const pair = parseCsv(options, 'pair');
  if (!doi || !localDir || !pair || pair.length !== 2) {
    process.stderr.write('single-paper: --doi <doi>, --local-dir <dir>, and --pair <a,b> are required\n');
    return 2;
  }
  const terms = parseCsv(options, 'terms');
  const db = options.get('load-local-db');
  const receipt = await runSinglePaper({ doi, localDir, pair: [pair[0]!, pair[1]!], ...(terms ? { terms } : {}), dryRun: flags.has('dry-run'), resume: flags.has('resume'), ...(db ? { loadLocalDb: db } : {}) });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  return 0;
}

/**
 * Populate the LOCAL corpus manifest cache from R2's canonical index.
 *
 * `synthesize` resolves each paper's citation metadata (title / year / evidence
 * tier) from the local manifest, not from R2. On a machine that has never run
 * `ingest` — every fresh CI runner — that cache is empty, so synthesis fails with
 * "manifest/corpus metadata missing" even though the paper's text loads from R2
 * fine. `ingest` hydrates as a side effect; the cloud pipeline needs it as a step
 * of its own, because ingestion runs in a different workflow on a different runner.
 *
 * No-op when the local cache is already populated, and best-effort when R2 has no
 * index yet — so it is safe to run unconditionally before synthesis.
 */
async function runHydrateManifestCli(): Promise<number> {
  const log = (line: string) => process.stdout.write(line + '\n');
  const corpusDir = defaultCorpusDir();
  const manifest = Manifest.open(corpusDir);
  const before = manifest.all().length;
  await hydrateManifestFromR2(manifest, new R2Store(loadConfig()), log);
  const after = manifest.all().length;
  log(`hydrate-manifest: ${before} → ${after} local record(s) in ${corpusDir}`);
  return 0;
}

async function runOfflineAcceptanceCli(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const bundle = options.get('bundle');
  if (!bundle || !flags.has('dry-run')) {
    process.stderr.write('offline-acceptance: --bundle <file> and --dry-run are required; this command never dispatches providers\n');
    return 2;
  }
  const manifest = await runOfflineAcceptance(bundle, true);
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  return 0;
}

async function runLiveAcceptanceCli(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const bundle = options.get('bundle');
  const leg = options.get('leg');
  const allowed: readonly string[] = ['anthropic-synthesis', 'openai-synthesis', 'agnes-verification'];
  if (!bundle || !flags.has('execute') || leg === undefined || !allowed.includes(leg)) {
    process.stderr.write('live-acceptance: --bundle <file>, a valid --leg, and explicit --execute are required\n');
    return 2;
  }
  const manifest = await runLiveAcceptance(bundle, leg as LiveAcceptanceLeg);
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  return 0;
}

/** CLI main — returns the process exit code. Async: the pipeline verbs await `run`. */
function artifactHashesFromOptions(options: Map<string, string>): ArtifactHashes {
  const claims = options.get('claims-sha256');
  const blueprints = options.get('blueprints-sha256');
  const verifications = options.get('verifications-sha256');
  const missing = [
    ['claims-sha256', claims],
    ['blueprints-sha256', blueprints],
    ['verifications-sha256', verifications],
  ]
    .filter(([, value]) => value === undefined)
    .map(([name]) => `--${name}`);
  if (missing.length > 0) throw new Error(`artifact bundle needs ${missing.join(', ')}`);
  return normalizeArtifactHashes({
    claims: claims!,
    blueprints: blueprints!,
    verifications: verifications!,
  });
}

async function runPromoteEdgeArtifacts(flags: Set<string>, options: Map<string, string>): Promise<number> {
  const hashes = artifactHashesFromOptions(options);
  const edgesDir = options.get('edges-dir') ?? defaultEdgesDir(repoRoot());
  const bundle = await readLocalArtifactBundle(edgesDir, hashes);
  process.stdout.write(
    `validated local bundle: ${bundle.claims.records} claim(s), ` +
      `${bundle.blueprints.records} blueprint(s), ${bundle.verifications.records} verification(s)\n`,
  );
  const result = await promoteArtifactBundle(new R2Store(loadConfig(options.get('env-file'))), bundle, {
    checkOnly: flags.has('check'),
  });
  for (const kind of ['blueprints', 'claims', 'verifications'] as const) {
    const action = result.written.includes(kind) ? 'written' : result.checked[kind];
    process.stdout.write(`  - ${bundle[kind].objectName}: ${action} (${bundle[kind].sha256})\n`);
  }
  process.stdout.write(
    flags.has('check')
      ? 'Check only — no R2 writes and no provider/database access.\n'
      : `Promotion complete — ${result.written.length} R2 object(s) written; no provider/database access.\n`,
  );
  return 0;
}

async function runCheckR2EdgeArtifacts(options: Map<string, string>): Promise<number> {
  const hashes = artifactHashesFromOptions(options);
  const bundle = await readR2ArtifactBundle(new R2Store(loadConfig(options.get('env-file'))), hashes);
  process.stdout.write(
    `validated exact R2 bundle: ${bundle.claims.records} claim(s), ` +
      `${bundle.blueprints.records} blueprint(s), ${bundle.verifications.records} verification(s)\n`,
  );
  for (const kind of ['blueprints', 'claims', 'verifications'] as const) {
    process.stdout.write(`  - ${bundle[kind].objectName}: ${bundle[kind].sha256}\n`);
  }
  process.stdout.write('No provider or database access.\n');
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags, options } = parseArgs(argv);

  if (flags.has('help') || command === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  if (flags.has('check-config') || command === 'check-config') {
    return runCheckConfig();
  }
  if (command === 'hydrate-manifest') return runHydrateManifestCli();
  if (command === 'offline-acceptance') return runOfflineAcceptanceCli(flags, options);
  if (command === 'live-acceptance') return runLiveAcceptanceCli(flags, options);

  try {
    switch (command) {
      case undefined:
        process.stdout.write(USAGE);
        return 0;

      case 'ingest': {
        // O14 seeds-as-data: discovery draws from the merged static + db pool
        // (fail-soft; a db slug is also a valid --seed selector on real runs).
        const pool = await loadTopicPool((line) => process.stdout.write(line + '\n'));
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
          seedPool: pool.seeds,
          // So an explicit --seed that the STATIC pool cannot contain reports
          // the unloaded boundary rather than an "unknown topic".
          seedPoolDbAvailable: pool.dbAvailable,
        });
        printRunResult(result);
        return 0;
      }

      case 'resume': {
        // Resume is `ingest` without a dry-run: already-'fetched' papers are
        // skipped (run() resumes from the manifest), so this picks up where an
        // interrupted multi-day run stopped.
        const pool = await loadTopicPool((line) => process.stdout.write(line + '\n'));
        const result = await run({
          seed: options.get('seed'),
          limit: parseLimit(options),
          dryRun: false,
          memoryGuard: {},
          controlFromR2: flags.has('remote-control'),
          seedPool: pool.seeds,
          // So an explicit --seed that the STATIC pool cannot contain reports
          // the unloaded boundary rather than an "unknown topic".
          seedPoolDbAvailable: pool.dbAvailable,
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

      // #300 · whole-paper batch synthesis. Kept as a distinct verb from `synthesize` so the
      // pair-scoped path (and the live-acceptance evidence that used it) stays reproducible.
      case 'synthesize-papers':
        return await runSynthesizePapersCli(flags, options);

      case 'verify':
        return await runVerify(flags, options);

      case 'single-paper':
        return await runSinglePaperCli(flags, options);

      case 'promote-edge-artifacts':
        return await runPromoteEdgeArtifacts(flags, options);

      case 'check-r2-edge-artifacts':
        return await runCheckR2EdgeArtifacts(options);

      case 'venue':
        return await runVenueLookup(options);

      case 'build-verify-corpus':
        return runBuildVerifyCorpus(flags, options);

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
