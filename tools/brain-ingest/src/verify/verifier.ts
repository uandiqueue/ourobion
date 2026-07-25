/**
 * A10 · Verifier orchestration + barrel (insight-engine-architecture §A10).
 *
 * Per claim:
 *   A9 quoteCheck (deterministic, embedded verbatim — quoteCheck.ts, U4)
 *   → budget triage (C7 — triage.ts): full retrieval vs quoteCheck-only
 *   → [full] verifier-owned retrieval (retrieval.ts) → refute-first prompt
 *       (prompt.ts) → router node 'verifier' (api_worker) → parse → POST-ENFORCE
 *       the schema invariants (enforce.ts, never trusting the LLM) → validate
 *   → [quoteCheck-only] the cheap uncertain record (no retrieval, no LLM)
 *   → append `edges/verifications.jsonl` (artifact.ts) the A11 edge-loader reads.
 *
 * ROUTE CONSTRAINT (docs/memory/0012-0013): the verifier MUST run non-Anthropic
 * (decorrelation) — enforced by the router config load. In production it routes
 * `api_worker`; real runs are BLOCKED on the non-Anthropic key. Tests mock the
 * router; any fixture verdict is stamped MOCK in `verifierModel` so it can never be
 * mistaken for a real verdict.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { readFileSync } from 'node:fs';

import type { LlmRequest, LlmResponse } from '../../../llm-router/src/index.js';

import { checkClaimQuotes, type PaperTextLoader, type QuoteCheckBlock } from './quoteCheck.js';
import { decideTriage, DEFAULT_TRIAGE_CONFIG } from './triage.js';
import { retrieveForClaim, type RetrieveOptions } from './retrieval.js';
import { buildVerifierPrompt, VERIFIER_PROMPT_VERSION } from './prompt.js';
import {
  buildQuoteOnlyRecord,
  enforceVerification,
  parseVerifierResponse,
  type EnforceResult,
} from './enforce.js';
import { loadVerificationValidator } from './load.js';
import { appendVerificationsToDir } from './artifact.js';
import type {
  RetrievalResult,
  SynthClaim,
  TriageConfig,
  TriageDecision,
  VerificationValidator,
  VerifyCitation,
  VerifyRecord,
} from './types.js';

/** Structural minimum of the router the verifier node needs (injectable in tests). */
export interface VerifierRouter {
  route(req: LlmRequest): Promise<LlmResponse>;
}

/** Why a claim produced no record (logged; the caller retries / falls back). */
export interface VerifyRejection {
  reason: 'quote-check-failed' | 'enforcement-violation' | 'schema-invalid' | 'no-response';
  detail: string;
}

/** Per-claim outcome (record OR rejection; triage/retrieval kept for the run log). */
export interface VerifyClaimResult {
  claim: SynthClaim;
  triage: TriageDecision;
  quoteCheck: QuoteCheckBlock;
  retrieval?: RetrievalResult;
  record?: VerifyRecord;
  rejected?: VerifyRejection;
  response?: LlmResponse;
  /** True when the LLM verdict was rejected and this record is the uncertain fallback. */
  fallback?: boolean;
}

export interface VerifyClaimOptions {
  /** Budget-triage policy (C7); default {@link DEFAULT_TRIAGE_CONFIG}. */
  triageConfig?: TriageConfig;
  /** Retrieval inputs (corpus docs + optional live external top-up). */
  retrieve?: RetrieveOptions;
  /** The verifier router (mocked in tests / MOCK proofs). Required for full mode. */
  router?: VerifierRouter;
  /** Text loader for the A9 quoteCheck (injected in tests). */
  textLoader?: PaperTextLoader;
  /**
   * Pre-supplied paper texts for quoteCheck. MERGED with `textLoader`: these seed
   * the text map and the loader fills only cited ids missing from it (e.g. a
   * --corpus run supplies corpus texts here and R2 covers the rest).
   */
  texts?: ReadonlyMap<string, string>;
  /** The shared zod gate (injected in tests); default loaded from shared/brain. */
  validateVerification?: VerificationValidator;
  /** Provenance stamp written to `verifierModel` (MOCK proofs override this). */
  verifierModel?: string;
  /** Clock for `verifiedAt` (tests inject a fixed one). */
  now?: () => number;
  /** Only compute + return the triage decision (no retrieval, no LLM, no record). */
  triageOnly?: boolean;
  /** Assemble retrieval + prompt but issue no router call and build no record. */
  dryRun?: boolean;
  /** Enforcement retries before falling back to uncertain (§A10 failure). Default 2. */
  maxAttempts?: number;
  log?: (line: string) => void;
}

const NOOP = (): void => {};

/**
 * Run the A9 quoteCheck for a claim, resolving each cited paper's text once.
 * `opts.texts` seeds the map; `opts.textLoader` fills only the cited ids the seed
 * is missing (so a corpus-backed run never touches R2 for papers the corpus holds).
 */
async function runQuoteCheck(
  claim: SynthClaim,
  opts: VerifyClaimOptions,
): Promise<QuoteCheckBlock> {
  const texts = new Map<string, string>();
  if (opts.texts) {
    for (const [uid, t] of opts.texts) texts.set(uid, t);
  }
  if (opts.textLoader) {
    const uids = [...new Set(claim.quoteSpans.map((s) => s.paperId))].filter((u) => !texts.has(u));
    for (const uid of uids) {
      try {
        const t = await opts.textLoader(uid);
        if (t !== null) texts.set(uid, t);
      } catch {
        // unavailable → text-missing verdict for its spans
      }
    }
  }
  return checkClaimQuotes({ quoteSpans: claim.quoteSpans }, texts).quoteCheck;
}

/** Build the safe uncertain fallback when the LLM verdict cannot be enforced. */
function buildFallbackUncertain(
  claim: SynthClaim,
  quoteCheck: QuoteCheckBlock,
  retrieval: RetrievalResult,
  ctx: { verifierModel: string; verifiedAt: string; validateVerification: VerificationValidator },
): VerifyRecord {
  // Retrieval sources kept (with their neutral 'mentions' stance) — no verdict trusted.
  const sources: VerifyCitation[] = retrieval.sources.map((s) => ({ ...s, stance: 'mentions' as const }));
  const record: VerifyRecord = {
    edgeId: claim.edgeId,
    verdict: 'uncertain',
    quoteCheck,
    independentRetrieval: { performed: retrieval.performed, sources },
    corroboration: { supporting: 0, contradicting: 0 },
    directionCheck: { matchesClaim: false },
    claimKindCheck: { matchesClaim: false, supportedKind: claim.claimKind },
    scopeCheck: { mismatch: false, supportedPopulation: null },
    effectSizeCheck: { matchesClaim: false, extractedSize: null },
    evidenceTier: 1,
    confidence: 0.3,
    dqs: { weight: 0.15 },
    verifierModel: ctx.verifierModel,
    promptVersion: VERIFIER_PROMPT_VERSION,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
  };
  return ctx.validateVerification(record);
}

/**
 * Verify ONE claim. Returns a record (full or quoteCheck-only), or a rejection.
 * The LLM is called only in full, non-dry-run mode; its output is never trusted —
 * every field of the record is re-derived / enforced (enforce.ts).
 */
export async function verifyClaim(
  claim: SynthClaim,
  opts: VerifyClaimOptions,
): Promise<VerifyClaimResult> {
  const log = opts.log ?? NOOP;
  const now = opts.now ?? Date.now;
  const verifiedAt = new Date(now()).toISOString();
  const verifierModel = opts.verifierModel ?? 'unset-verifier-model';
  const validateVerification =
    opts.validateVerification ?? (await loadVerificationValidator());
  const triage = decideTriage(claim, opts.triageConfig ?? DEFAULT_TRIAGE_CONFIG);

  if (opts.triageOnly) {
    return {
      claim,
      triage,
      quoteCheck: { spansFound: 0, spansTotal: claim.quoteSpans.length, allPresent: false },
    };
  }

  // A9 quote gate — runs BEFORE any verifier spend.
  const quoteCheck = await runQuoteCheck(claim, opts);
  if (!quoteCheck.allPresent) {
    return {
      claim,
      triage,
      quoteCheck,
      rejected: {
        reason: 'quote-check-failed',
        detail: `quoteCheck ${quoteCheck.spansFound}/${quoteCheck.spansTotal} present — not verifying`,
      },
    };
  }

  // Cheap rung: no retrieval, no LLM → an uncertain record (never served).
  if (triage.mode === 'quoteCheck-only') {
    const record = buildQuoteOnlyRecord({
      claim,
      quoteCheck,
      verifierModel,
      promptVersion: VERIFIER_PROMPT_VERSION,
      verifiedAt,
      validateVerification,
    });
    log(`verify: ${claim.edgeId} — quoteCheck-only (uncertain), no LLM spend`);
    return { claim, triage, quoteCheck, record };
  }

  // Full rung: the verifier performs its own retrieval.
  const retrieval = await retrieveForClaim(claim, opts.retrieve ?? {});
  log(
    `verify: ${claim.edgeId} — full (${triage.reasons.join('; ')}); retrieved ${retrieval.sources.length} source(s) ` +
      `(${retrieval.corpusHits.length} corpus, ${retrieval.externalCount} external)`,
  );

  if (opts.dryRun) {
    return { claim, triage, quoteCheck, retrieval };
  }
  if (!opts.router) {
    throw new Error('verify: full-retrieval mode needs a router (inject one, or use --dry-run/--triage-only)');
  }

  const { system, prompt } = buildVerifierPrompt(claim, retrieval.sources);
  const maxAttempts = opts.maxAttempts ?? 2;

  let lastReject: EnforceResult | { ok: false; reason: 'no-response'; detail: string } | undefined;
  let response: LlmResponse | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    response = await opts.router.route({ nodeId: 'verifier', system, prompt, expectJson: true });
    let reply;
    try {
      reply = parseVerifierResponse(response.text);
    } catch (err) {
      lastReject = { ok: false, reason: 'enforcement-violation', detail: err instanceof Error ? err.message : String(err) };
      log(`verify: ${claim.edgeId} — attempt ${attempt} unparseable reply; ${attempt < maxAttempts ? 'retrying' : 'falling back'}`);
      continue;
    }
    const enforced = enforceVerification(reply, {
      claim,
      quoteCheck,
      retrieval,
      verifierModel: response.model || verifierModel,
      promptVersion: VERIFIER_PROMPT_VERSION,
      verifiedAt,
      validateVerification,
    });
    if (enforced.ok) {
      log(`verify: ${claim.edgeId} — verdict ${enforced.record.verdict} (conf ${enforced.record.confidence}) via ${response.route}`);
      return { claim, triage, quoteCheck, retrieval, record: enforced.record, response };
    }
    lastReject = enforced;
    log(`verify: ${claim.edgeId} — attempt ${attempt} rejected (${enforced.reason}: ${enforced.detail}); ${attempt < maxAttempts ? 'retrying' : 'falling back'}`);
  }

  // Exhausted retries → safe uncertain fallback (§A10 failure mode 7).
  const record = buildFallbackUncertain(claim, quoteCheck, retrieval, {
    verifierModel: response?.model || verifierModel,
    verifiedAt,
    validateVerification,
  });
  return {
    claim,
    triage,
    quoteCheck,
    retrieval,
    record,
    fallback: true,
    ...(response ? { response } : {}),
    ...(lastReject && !lastReject.ok ? { rejected: { reason: lastReject.reason, detail: lastReject.detail } } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims input
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a claims.jsonl file into SynthClaim records (blank/bad lines skipped). */
export function loadClaimsFromText(text: string): SynthClaim[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: SynthClaim[] = [];
  for (const line of clean.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const rec = JSON.parse(line) as SynthClaim;
      if (rec && typeof rec.edgeId === 'string') out.push(rec);
    } catch {
      // skip unparseable line
    }
  }
  return out;
}

/** Read + parse a claims.jsonl file from disk. */
export function loadClaimsFromFile(path: string): SynthClaim[] {
  return loadClaimsFromText(readFileSync(path, 'utf8'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Full run
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyRunOptions extends VerifyClaimOptions {
  /** Claims to verify (explicit; takes precedence over claimsPath). */
  claims?: readonly SynthClaim[];
  /** Path to claims.jsonl (default the caller resolves). */
  claimsPath?: string;
  /** Verify only this edgeId. */
  edgeId?: string;
  /** Where verifications.jsonl is written (append-safe). */
  edgesDir?: string;
}

export interface VerifyRunResult {
  results: VerifyClaimResult[];
  records: VerifyRecord[];
  rejectedCount: number;
  write?: { path: string; written: number; skipped: number };
}

/**
 * Verify a set of claims and append the accepted verifications. Records are written
 * only when not `triageOnly` / `dryRun`. Per-claim outcomes are returned for the
 * caller to log as evidence.
 */
export async function verify(opts: VerifyRunOptions): Promise<VerifyRunResult> {
  const log = opts.log ?? NOOP;
  let claims: SynthClaim[] = opts.claims
    ? [...opts.claims]
    : opts.claimsPath
      ? loadClaimsFromFile(opts.claimsPath)
      : [];
  if (opts.edgeId) claims = claims.filter((c) => c.edgeId === opts.edgeId);
  if (claims.length === 0) {
    throw new Error('verify: no claims to verify (pass --from-claims <path> / --edge, or claims[])');
  }

  const results: VerifyClaimResult[] = [];
  const records: VerifyRecord[] = [];
  let rejectedCount = 0;
  for (const claim of claims) {
    const r = await verifyClaim(claim, opts);
    results.push(r);
    if (r.record) records.push(r.record);
    if (r.rejected && !r.record) {
      rejectedCount++;
      log(`verify: REJECT ${claim.edgeId} — ${r.rejected.reason}: ${r.rejected.detail}`);
    }
  }

  const out: VerifyRunResult = { results, records, rejectedCount };
  if (!opts.triageOnly && !opts.dryRun && opts.edgesDir && records.length > 0) {
    out.write = appendVerificationsToDir(opts.edgesDir, records);
    log(`verify: wrote ${out.write.written} verification(s) (${out.write.skipped} dup) → ${out.write.path}`);
  }
  return out;
}

// ── barrel ──────────────────────────────────────────────────────────────────
export { VERIFIER_PROMPT_VERSION, VERIFIER_SYSTEM, buildVerifierPrompt } from './prompt.js';
export { decideTriage, topImpactTier, supportingCitationCount, DEFAULT_TRIAGE_CONFIG } from './triage.js';
export {
  rankCorpus,
  claimQueryTerms,
  retrieveForClaim,
  retrieveExternal,
  candidateToCitation,
  candidatePaperId,
  corpusHitToCitation,
  extractEvidencePassages,
  DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE,
  claimSeed,
  tokenize,
} from './retrieval.js';
export {
  loadCorpusFromFile,
  loadCorpusFromText,
  parseCorpusDoc,
  corpusTexts,
} from './corpus.js';
export {
  enforceVerification,
  parseVerifierResponse,
  buildQuoteOnlyRecord,
  type ParsedVerifierReply,
  type EnforceResult,
} from './enforce.js';
export { loadVerificationValidator } from './load.js';
export {
  appendVerificationsToDir,
  appendVerificationsToR2,
  verificationDedupeKey,
  dedupeAgainst,
  verificationsPath,
  VERIFICATIONS_BASENAME,
  R2_VERIFICATIONS_KEY,
} from './artifact.js';
export type * from './types.js';
