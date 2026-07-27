/** R4-U5: strictly local, host-mediated single-paper intake. */
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { relative, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { selectPassages, defaultTermsForKeys } from './synth/passages.js';
import { buildSynthesisPrompt, PROMPT_VERSION } from './synth/prompt.js';
import { processSynthesisResponse } from './synth/postprocess.js';
import {
  loadActiveMetricKeys,
  loadClaimValidator,
  loadCopyValidator,
  repoRoot,
  type ClaimValidator,
} from './synth/load.js';
import { buildQuoteOnlyRecord } from './verify/enforce.js';
import { loadVerificationValidator } from './verify/load.js';
import type { SynthClaim, SynthPair } from './synth/types.js';
import type { VerificationValidator, VerifyRecord } from './verify/types.js';

const RECEIPT = 'single-paper-receipt.json';
const RESPONSE = 'synthesis-response.json';
const GATE_REVISION = 'single-paper-gates:r4-u5-pass2';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

export interface SinglePaperOptions {
  doi: string;
  localDir: string;
  pair: [string, string];
  terms?: string[];
  dryRun?: boolean;
  resume?: boolean;
  loadLocalDb?: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('cannot hash an undefined value');
  return encoded;
}

export function normaliseDoi(value: string): string {
  const doi = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
  if (!/^10\.\d{4,9}\/[\-._;()/:a-z0-9]+$/i.test(doi)) throw new Error(`invalid DOI '${value}'`);
  return doi;
}

/** Parse, validate, and reconstruct the only DB target U5 may invoke. */
export function normaliseLocalDbUrl(value: string): string {
  if (value !== value.trim() || value.includes('\\') || value.includes('\0')) {
    throw new Error('--load-local-db contains ambiguous path/whitespace characters');
  }
  const match = /^(postgres(?:ql)?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(value);
  if (!match || value.includes('?') || value.includes('#')) {
    throw new Error('--load-local-db must be a parameter-free PostgreSQL URL');
  }
  const authority = match[2]!;
  const rawHostPort = authority.slice(authority.lastIndexOf('@') + 1);
  if (rawHostPort.includes('%')) throw new Error('--load-local-db host must not be encoded');
  const ipv6 = /^\[::1\](?::(\d+))?$/i.exec(rawHostPort);
  const named = /^(localhost|127\.0\.0\.1)(?::(\d+))?$/i.exec(rawHostPort);
  if (!ipv6 && !named) throw new Error('--load-local-db authority must be exactly localhost, 127.0.0.1, or ::1');
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('--load-local-db is malformed'); }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error('--load-local-db must use PostgreSQL');
  if (parsed.search || parsed.hash || parsed.pathname.startsWith('//')) throw new Error('--load-local-db cannot select a query, fragment, UNC, or socket target');
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('--load-local-db resolved to a non-loopback host');
  parsed.protocol = 'postgresql:';
  // Never leave DNS resolution in the DB path: even accepted `localhost` is
  // rewritten to a numeric loopback literal before pg sees it.
  parsed.hostname = host === '::1' ? '[::1]' : '127.0.0.1';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function jsonObject(path: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`invalid JSON '${path}': ${error instanceof Error ? error.message : String(error)}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`'${path}' must contain a JSON object`);
  return value as Record<string, unknown>;
}

function within(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function safeRoot(raw: string): string {
  if (/^(?:\\\\|\/\/)/.test(raw) || /^\\\\[?.]\\/.test(raw) || raw.includes('\0')) throw new Error('--local-dir rejects UNC/device paths');
  const resolved = resolve(raw);
  if (!existsSync(resolved)) throw new Error('--local-dir must exist');
  const direct = lstatSync(resolved);
  if (direct.isSymbolicLink()) throw new Error('--local-dir itself must not be a symlink, junction, or reparse link');
  const root = realpathSync(resolved);
  if (/^(?:\\\\|\/\/)/.test(root) || /^\\\\[?.]\\/.test(root)) throw new Error('--local-dir canonical path is UNC/device-backed');
  if (!lstatSync(root).isDirectory()) throw new Error('--local-dir must resolve to a directory');
  return root;
}

function regularFile(root: string, basename: string, required: boolean): string | null {
  const candidate = join(root, basename);
  if (!existsSync(candidate)) {
    if (required) throw new Error(`single-paper requires local ${basename}`);
    return null;
  }
  const direct = lstatSync(candidate);
  if (direct.isSymbolicLink() || !direct.isFile()) throw new Error(`${basename} must be a regular, non-symlink file`);
  const real = realpathSync(candidate);
  if (!within(root, real)) throw new Error(`${basename} escapes --local-dir`);
  return real;
}

interface OutputPaths { receipt: string; edges: string; claims: string; verifications: string; }
function outputPaths(root: string, create: boolean): OutputPaths {
  const receipt = join(root, RECEIPT), edges = join(root, 'edges');
  if (existsSync(receipt)) regularFile(root, RECEIPT, true);
  if (existsSync(edges)) {
    const direct = lstatSync(edges);
    if (direct.isSymbolicLink() || !direct.isDirectory()) throw new Error('edges must be a regular, non-symlink directory');
    if (!within(root, realpathSync(edges))) throw new Error('edges escapes --local-dir');
  } else if (create) {
    mkdirSync(edges);
  }
  const claims = join(edges, 'claims.jsonl'), verifications = join(edges, 'verifications.jsonl');
  if (existsSync(claims)) regularFile(edges, 'claims.jsonl', true);
  if (existsSync(verifications)) regularFile(edges, 'verifications.jsonl', true);
  return { receipt, edges, claims, verifications };
}

function parseJsonl<T>(path: string, validate: (value: unknown) => T): T[] {
  if (!existsSync(path)) return [];
  const rows: T[] = [];
  for (const [index, line] of readFileSync(path, 'utf8').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let raw: unknown;
    try { raw = JSON.parse(line); } catch (error) { throw new Error(`${path}:${index + 1}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
    try { rows.push(validate(raw)); } catch (error) { throw new Error(`${path}:${index + 1}: schema: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return rows;
}

function planAppend<T>(existing: readonly T[], incoming: readonly T[], identity: (value: T) => string): { add: T[]; skipped: number } {
  const seen = new Map<string, string>();
  for (const value of existing) {
    const key = identity(value), content = canonical(value), prior = seen.get(key);
    if (prior !== undefined && prior !== content) throw new Error(`existing artifact identity '${key}' has different canonical content`);
    seen.set(key, content);
  }
  const add: T[] = [];
  let skipped = 0;
  for (const value of incoming) {
    const key = identity(value), content = canonical(value), prior = seen.get(key);
    if (prior !== undefined) {
      if (prior !== content) throw new Error(`artifact identity '${key}' has different canonical content`);
      skipped++;
    } else { seen.set(key, content); add.push(value); }
  }
  return { add, skipped };
}

function appendPlanned<T>(path: string, plan: { add: T[]; skipped: number }) {
  const old = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (plan.add.length) {
    const lines = plan.add.map((value) => JSON.stringify(value)).join('\n');
    writeFileSync(path, old + (old && !old.endsWith('\n') ? '\n' : '') + lines + '\n');
  }
  return { written: plan.add.length, skipped: plan.skipped };
}

function deterministicAt(runId: string): string {
  return new Date(Date.UTC(2026, 0, 1) + Number.parseInt(runId.slice(0, 12), 16) % 31_536_000_000).toISOString();
}

function newestInterimAt(runId: string, edgeId: string, existing: readonly VerifyRecord[]): string {
  const marker = `INTERIM:local-quote-check-only:${runId}`;
  const prior = existing.find((record) => record.edgeId === edgeId && record.verifierModel === marker);
  if (prior) return prior.verifiedAt;
  const newest = existing.filter((record) => record.edgeId === edgeId).reduce((max, record) => Math.max(max, Date.parse(record.verifiedAt)), 0);
  return new Date(Math.max(Date.parse(deterministicAt(runId)), newest + 1)).toISOString();
}

function hashOrNull(path: string): string | null { return existsSync(path) ? sha(readFileSync(path, 'utf8')) : null; }

function finalRunId(inputHash: string, responseHash: string, claimsHash: string | null, verificationsHash: string | null): string {
  return sha(`${inputHash}\0${responseHash}\0${claimsHash ?? 'absent'}\0${verificationsHash ?? 'absent'}`);
}

function verifyCompletedReceipt(prior: Record<string, unknown>, paths: OutputPaths, inputHash: string, responseHash: string): void {
  if (prior.inputSha256 !== inputHash || prior.outputSha256 !== responseHash) throw new Error('completed receipt drift: input or synthesis response hash changed');
  if (sha(canonical(prior.input)) !== inputHash) throw new Error('completed receipt drift: recorded input does not match its hash');
  const artifacts = prior.artifacts as Record<string, unknown> | undefined;
  const claimsHash = hashOrNull(paths.claims), verificationsHash = hashOrNull(paths.verifications);
  if (!artifacts || artifacts.claimsSha256 !== claimsHash || artifacts.verificationsSha256 !== verificationsHash) {
    throw new Error('completed receipt drift: local edge artifacts were deleted or tampered');
  }
  if (prior.runId !== finalRunId(inputHash, responseHash, claimsHash, verificationsHash)) throw new Error('completed receipt drift: runId does not bind artifact hashes');
}

/** No R2, router, provider, hosted endpoint, or network API is imported or called. */
export async function runSinglePaper(options: SinglePaperOptions): Promise<Record<string, unknown>> {
  const doi = normaliseDoi(options.doi), root = safeRoot(options.localDir);
  const paperPath = regularFile(root, 'paper.json', true)!, textPath = regularFile(root, 'text.txt', true)!;
  const paper = jsonObject(paperPath), text = readFileSync(textPath, 'utf8');
  if (typeof paper.doi !== 'string' || normaliseDoi(paper.doi) !== doi) throw new Error('paper.json DOI does not match --doi');
  if (!text.trim()) throw new Error('text.txt must not be empty');
  const canonicalDbUrl = options.loadLocalDb ? normaliseLocalDbUrl(options.loadLocalDb) : undefined;
  const terms = options.terms?.length ? [...options.terms] : defaultTermsForKeys(options.pair);
  const active = await loadActiveMetricKeys(repoRoot());
  for (const key of options.pair) if (!active.has(key)) throw new Error(`single-paper: pair endpoint '${key}' is not an active shared/metrics registry key`);
  if (options.pair[0] === options.pair[1]) throw new Error('single-paper: pair endpoints must differ');
  const pair: SynthPair = { id: `local:${doi}:${options.pair.join('|')}`, metricKeys: options.pair, label: `Local relationship between "${options.pair[0]}" and "${options.pair[1]}"`, terms };
  const passages = selectPassages(text, terms, { maxPassages: 12 });
  const papers = [{ paperUid: doi, title: typeof paper.title === 'string' ? paper.title : null, charCount: text.length, passages }];
  const assembled = buildSynthesisPrompt(pair, papers);
  const activeKeys = [...active].sort();
  const input = {
    doi,
    pair: pair.metricKeys,
    terms,
    metadataSha256: sha(canonical(paper)),
    textSha256: sha(text),
    activeMetricRegistry: { keysSha256: sha(canonical(activeKeys)), count: activeKeys.length, requested: options.pair.map((key) => ({ key, active: active.has(key) })) },
    gates: { revision: GATE_REVISION, synthesisPrompt: PROMPT_VERSION, postprocessor: 'processSynthesisResponse', verificationBuilder: 'buildQuoteOnlyRecord' },
    assembled: { system: assembled.system, prompt: assembled.prompt, papers },
    posture: { paper: paper.fixture === true ? 'fixture' : 'local-user-supplied', live: false, verification: 'INTERIM quote-check-only', independentRetrieval: false, servable: false },
  };
  const inputSha256 = sha(canonical(input)), responsePath = regularFile(root, RESPONSE, false);
  const paths = outputPaths(root, false);
  if (!responsePath) {
    if (existsSync(paths.receipt)) throw new Error('completed receipt drift: synthesis response was deleted');
    return { status: 'request-needed', runId: inputSha256, inputSha256, input, synthesisResponsePath: join(root, RESPONSE), system: assembled.system, prompt: assembled.prompt, claimCount: 0, dbWrites: 0 };
  }
  const response = readFileSync(responsePath, 'utf8'), outputSha256 = sha(response), synthesisRunId = sha(`${inputSha256}\0${outputSha256}`);
  const [validateClaim, validateCopy, validateVerification] = await Promise.all([loadClaimValidator(repoRoot()), loadCopyValidator(repoRoot()), loadVerificationValidator(repoRoot())]);
  const existingClaims = parseJsonl(paths.claims, validateClaim);
  for (const claim of existingClaims) {
    if (!validateCopy(claim.derivation) || !active.has(claim.subject) || !active.has(claim.object)) throw new Error(`${paths.claims}: existing claim fails active-metric/copy gates`);
  }
  const existingVerifications = parseJsonl(paths.verifications, validateVerification);
  if (existsSync(paths.receipt)) {
    const prior = jsonObject(paths.receipt);
    verifyCompletedReceipt(prior, paths, inputSha256, outputSha256);
    return { ...prior, ...(options.resume ? { resumed: true } : { repeated: true }) };
  }
  const processed = processSynthesisResponse(response, { pair, allowedPaperIds: [doi], texts: new Map([[doi, text]]), validateClaim, validateCopy, synthesisModel: 'local-host-supplied', promptVersion: PROMPT_VERSION, now: () => Date.parse(deterministicAt(synthesisRunId)) });
  const verifications = processed.accepted.map((claim) => buildQuoteOnlyRecord({
    claim,
    quoteCheck: { spansFound: claim.quoteSpans.length, spansTotal: claim.quoteSpans.length, allPresent: claim.quoteSpans.length > 0 },
    verifierModel: `INTERIM:local-quote-check-only:${synthesisRunId}`,
    promptVersion: 'single-paper-interim-2',
    verifiedAt: newestInterimAt(synthesisRunId, claim.edgeId, existingVerifications),
    validateVerification,
  }));
  const claimIdentity = (claim: SynthClaim) => `${claim.edgeId}\0${claim.promptVersion}\0${[...new Set(claim.citations.map((citation) => citation.paperId))].sort().join('|')}`;
  const verificationIdentity = (record: VerifyRecord) => `${record.edgeId}\0${record.verifiedAt}`;
  const claimPlan = planAppend(existingClaims, processed.accepted, claimIdentity);
  const verificationPlan = planAppend(existingVerifications, verifications, verificationIdentity);
  const brainUrl = pathToFileURL(join(repoRoot(), 'shared', 'brain', 'index.ts')).href;
  const brain = await import(brainUrl) as { edgeScore: (record: VerifyRecord) => number; servingBand: (record: VerifyRecord) => string };
  const holds = verifications.map((record) => ({ edgeId: record.edgeId, edgeScore: brain.edgeScore(record), servingBand: brain.servingBand(record) }));
  if (holds.some((hold) => hold.servingBand !== 'hold')) throw new Error('INTERIM quote-only verification unexpectedly became servable');
  const receipt = { status: 'completed', synthesisRunId, inputSha256, outputSha256, input, claimCount: processed.accepted.length, rejected: processed.rejected, verification: { verdict: 'uncertain', status: 'active', independentRetrievalPerformed: false, checksPerformed: false, nonServableHold: true, results: holds } };
  if (options.dryRun) return { ...receipt, runId: synthesisRunId, dryRun: true, claimWrites: 0, verificationWrites: 0, dbWrites: 0 };
  const writable = outputPaths(root, true);
  const claimWrite = appendPlanned(writable.claims, claimPlan), verificationWrite = appendPlanned(writable.verifications, verificationPlan);
  if (canonicalDbUrl) {
    const loader = fileURLToPath(new URL('../../edge-loader/load_edges.mjs', import.meta.url));
    const child = spawnSync(process.execPath, [loader, '--from-dir', writable.edges, '--no-prune'], { encoding: 'utf8', env: { SUPABASE_DB_URL: canonicalDbUrl } });
    if (child.status !== 0) throw new Error(`edge-loader failed: ${child.stderr || child.stdout}`);
  }
  const artifacts = { claimsSha256: hashOrNull(writable.claims), verificationsSha256: hashOrNull(writable.verifications) };
  const runId = finalRunId(inputSha256, outputSha256, artifacts.claimsSha256, artifacts.verificationsSha256);
  const finalReceipt = { ...receipt, runId, claimWrite, verificationWrite, artifacts };
  writeFileSync(writable.receipt, JSON.stringify(finalReceipt, null, 2) + '\n');
  return { ...finalReceipt, dbWrites: canonicalDbUrl ? 'incremental edge-loader invoked' : 0 };
}
