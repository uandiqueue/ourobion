/**
 * Deterministic, provider-free preflight for the two-leg acceptance run.
 *
 * This is intentionally not a second router. It freezes the exact inputs that
 * a later, explicitly-authorised provider run would consume, exercises the A8
 * gates over a checked-in/caller-supplied response, then runs A9 + A10 dry-run
 * verification. It never imports a provider adapter, R2 store, or DB loader.
 */
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { familyOf, loadConfig as loadRouterConfig } from '../../llm-router/src/config.js';
import { loadActiveMetricKeys, loadClaimValidator, loadCopyValidator, repoRoot } from './synth/load.js';
import { assembleSynthesisInput, pairFromKeys } from './synth/index.js';
import { toJsonl as claimsToJsonl } from './synth/artifact.js';
import { processSynthesisResponse } from './synth/postprocess.js';
import { PROMPT_VERSION } from './synth/prompt.js';
import type { SynthClaim } from './synth/types.js';
import { corpusTexts, loadCorpusFromText } from './verify/corpus.js';
import { verify } from './verify/verifier.js';

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const RUN_ID = /^[a-z0-9][a-z0-9._-]{2,127}$/i;
const REVISION = /^[a-z0-9][a-z0-9._/-]{2,255}$/i;

export interface OfflineAcceptanceBundle {
  acceptanceRunId: string;
  artifactRevision: string;
  pair: [string, string];
  paperUids: string[];
  /** Relative-to-bundle JSONL corpus; absolute paths are deliberately refused. */
  corpus: string;
  /** Relative-to-bundle frozen A8 response; no provider is contacted. */
  synthesisResponse: string;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`offline-acceptance: ${name} must be a non-empty string`);
  return value;
}

function readBundle(bytes: Buffer): OfflineAcceptanceBundle {
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('offline-acceptance: bundle must be valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('offline-acceptance: bundle must be a JSON object');
  const raw = parsed as Record<string, unknown>;
  const pair = raw.pair;
  const paperUids = raw.paperUids;
  if (!Array.isArray(pair) || pair.length !== 2 || pair.some((v) => typeof v !== 'string' || v.trim() === '')) {
    throw new Error('offline-acceptance: pair must contain exactly two non-empty metric keys');
  }
  if (!Array.isArray(paperUids) || paperUids.length === 0 || paperUids.some((v) => typeof v !== 'string' || v.trim() === '')) {
    throw new Error('offline-acceptance: paperUids must contain at least one non-empty paper id');
  }
  const acceptanceRunId = requireString(raw.acceptanceRunId, 'acceptanceRunId');
  const artifactRevision = requireString(raw.artifactRevision, 'artifactRevision');
  if (!RUN_ID.test(acceptanceRunId)) throw new Error('offline-acceptance: acceptanceRunId contains unsupported characters');
  if (!REVISION.test(artifactRevision)) throw new Error('offline-acceptance: artifactRevision contains unsupported characters');
  return {
    acceptanceRunId,
    artifactRevision,
    pair: [pair[0] as string, pair[1] as string],
    paperUids: paperUids as string[],
    corpus: requireString(raw.corpus, 'corpus'),
    synthesisResponse: requireString(raw.synthesisResponse, 'synthesisResponse'),
  };
}

interface FrozenFile {
  path: string;
  bytes: Buffer;
}

function sameIdentity(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

function sameSnapshot(a: Stats, b: Stats): boolean {
  return sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

/**
 * Read once from one no-follow descriptor and bind every parse/hash to those
 * bytes. The hook is an injectable race seam used only by regression tests.
 */
export function readFrozenFile(path: string, label: string, onOpened?: () => void): FrozenFile {
  const direct = resolve(path);
  const before = lstatSync(direct);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`offline-acceptance: ${label} must be a regular non-symlink file`);
  }
  let descriptor: number;
  try {
    descriptor = openSync(direct, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    throw new Error(`offline-acceptance: ${label} could not be opened safely`);
  }
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || !sameIdentity(before, opened)) {
      throw new Error(`offline-acceptance: ${label} changed before it was opened`);
    }
    onOpened?.();
    const current = lstatSync(direct);
    if (current.isSymbolicLink() || !sameIdentity(current, opened)) {
      throw new Error(`offline-acceptance: ${label} path was replaced during read`);
    }
    const canonical = realpathSync(direct);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (!sameSnapshot(opened, after)) {
      throw new Error(`offline-acceptance: ${label} changed during read`);
    }
    const finalPath = lstatSync(direct);
    if (finalPath.isSymbolicLink() || !sameIdentity(finalPath, after)) {
      throw new Error(`offline-acceptance: ${label} path was replaced during read`);
    }
    return { path: canonical, bytes };
  } finally {
    closeSync(descriptor);
  }
}

/** Resolve and freeze one regular file beneath the bundle directory. */
function readBundleFile(root: string, value: string, label: string): FrozenFile {
  if (isAbsolute(value) || value.includes('\0')) throw new Error('offline-acceptance: bundle file path must be relative and NUL-free');
  const candidate = resolve(root, value);
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('offline-acceptance: bundle file escapes its directory');
  const frozen = readFrozenFile(candidate, label);
  const canonicalRel = relative(root, frozen.path);
  if (canonicalRel.startsWith('..') || isAbsolute(canonicalRel)) {
    throw new Error('offline-acceptance: bundle file resolves outside its directory');
  }
  return frozen;
}

/** Exact bytes that would be staged as claims.jsonl. */
export function encodeClaimsJsonl(claims: readonly SynthClaim[]): Buffer {
  const jsonl = claimsToJsonl(claims);
  return Buffer.from(jsonl.length === 0 ? '' : `${jsonl}\n`, 'utf8');
}

/**
 * Run only the deterministic acceptance contract. `dryRun` is intentionally
 * mandatory: a future provider leg must be a distinct reviewed command.
 */
export async function runOfflineAcceptance(bundlePath: string, dryRun: boolean): Promise<Record<string, unknown>> {
  if (!dryRun) throw new Error('offline-acceptance: --dry-run is required; this command never dispatches providers');
  const bundleInput = readFrozenFile(bundlePath, 'bundle');
  const bundle = readBundle(bundleInput.bytes);
  const bundleRoot = realpathSync(dirname(bundleInput.path));
  const corpusInput = readBundleFile(bundleRoot, bundle.corpus, 'corpus');
  const responseInput = readBundleFile(bundleRoot, bundle.synthesisResponse, 'synthesis response');
  const corpus = loadCorpusFromText(corpusInput.bytes.toString('utf8'), corpusInput.path);
  const texts = corpusTexts(corpus);
  for (const paperUid of bundle.paperUids) {
    if (!texts.has(paperUid)) throw new Error(`offline-acceptance: corpus lacks frozen paper '${paperUid}'`);
  }

  // Validating the checked-in config first proves the exact configured model
  // families are independently separated, before any future spend is possible.
  const routerConfig = loadRouterConfig();
  const synthesisFamily = familyOf(routerConfig, routerConfig.nodes.synthesis.model);
  const verifierFamily = familyOf(routerConfig, routerConfig.nodes.verifier.model);
  if (synthesisFamily === verifierFamily) throw new Error('offline-acceptance: configured families are not separated');

  const root = repoRoot();
  const active = await loadActiveMetricKeys(root);
  for (const metric of bundle.pair) {
    if (!active.has(metric)) throw new Error(`offline-acceptance: pair endpoint '${metric}' is not an active metric`);
  }
  if (bundle.pair[0] === bundle.pair[1]) throw new Error('offline-acceptance: pair endpoints must differ');
  const pair = pairFromKeys(bundle.pair[0], bundle.pair[1]);
  const assembled = assembleSynthesisInput(pair, new Map(bundle.paperUids.map((id) => [id, texts.get(id)!])));
  const processed = processSynthesisResponse(responseInput.bytes.toString('utf8'), {
    pair,
    allowedPaperIds: bundle.paperUids,
    texts,
    validateClaim: await loadClaimValidator(root),
    validateCopy: await loadCopyValidator(root),
    synthesisModel: `config:${routerConfig.nodes.synthesis.model}`,
    promptVersion: PROMPT_VERSION,
    // Manifest determinism: never stamp wall-clock time into dry-run claims.
    now: () => 0,
  });
  if (processed.accepted.length === 0) throw new Error('offline-acceptance: frozen synthesis response produced no quote-valid claims');

  const verification = await verify({
    claims: processed.accepted,
    dryRun: true,
    texts,
    retrieve: { corpus },
    artifactRevision: bundle.artifactRevision,
  });
  const quoteFailed = verification.results.filter((result) => !result.quoteCheck.allPresent || result.rejected !== undefined);
  if (quoteFailed.length > 0) throw new Error('offline-acceptance: quoteCheck rejected a claim; provider dispatch remains blocked');
  const retrievalFailed = verification.results.filter(
    (result) => result.triage.mode !== 'full' || result.retrieval?.performed !== true || result.retrieval.sources.length === 0,
  );
  if (retrievalFailed.length > 0) {
    throw new Error('offline-acceptance: full-mode A10 retrieval with at least one independent source is required; quoteCheck-only/empty retrieval is non-acceptance');
  }

  const claimsBytes = encodeClaimsJsonl(processed.accepted);

  // The manifest intentionally has hashes and non-secret configuration identity
  // only. Attempts, tokens, costs and latency are literal zero because no route
  // or network capability is available in this command.
  return {
    schema: 'ourobion.offline-acceptance.v1',
    mode: 'dry-run',
    acceptanceRunId: bundle.acceptanceRunId,
    artifactRevision: bundle.artifactRevision,
    inputs: {
      bundleSha256: sha256(bundleInput.bytes),
      corpusSha256: sha256(corpusInput.bytes),
      synthesisResponseSha256: sha256(responseInput.bytes),
      pair: bundle.pair,
      paperUids: bundle.paperUids,
    },
    families: { synthesis: synthesisFamily, verifier: verifierFamily, separated: true },
    stages: {
      synthesis: {
        configuredModel: routerConfig.nodes.synthesis.model,
        identitySource: 'router-config', attempts: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0,
        acceptedClaims: processed.accepted.length, rejectedClaims: processed.rejected.length,
      },
      verify: {
        configuredModel: routerConfig.nodes.verifier.model,
        identitySource: 'router-config', attempts: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0,
        quoteCheck: verification.results.map((result) => ({ edgeId: result.claim.edgeId, ...result.quoteCheck })),
        fullMode: verification.results.every((result) => result.triage.mode === 'full'),
        retrievalPerformed: verification.results.every((result) => result.retrieval?.performed === true),
        retrievalSources: verification.results.map((result) => result.retrieval!.sources.length),
      },
    },
    artifacts: {
      claimsSha256: sha256(claimsBytes),
      claimsBytes: claimsBytes.length,
      claimsEncoding: 'jsonl-utf8-trailing-newline',
      verificationsSha256: null,
      rawEvidenceStaged: false,
    },
    // Prompt shape is part of the preflight evidence but the prompt itself can
    // contain paper passages, so retain only its hash/size in the manifest.
    synthesisPrompt: { sha256: sha256(assembled.prompt), bytes: Buffer.byteLength(assembled.prompt, 'utf8') },
  };
}
