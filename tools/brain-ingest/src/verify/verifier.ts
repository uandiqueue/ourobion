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
 *   → append `edges/verifications.jsonl` (artifact.ts) the A11 edge-loader reads,
 *     PLUS the raw provider body to `edges/verification-raw.jsonl` (R4-U3).
 *
 * ROUTE CONSTRAINT (docs/memory/0012-0013): the verifier MUST run in a DIFFERENT
 * vendor family than the synthesis node (decorrelation) — enforced unconditionally
 * at router config load. Which vendor is free; the run-4 posture is OpenAI
 * synthesis + Anthropic verifier (config decision C13). In production it routes
 * `api_worker`; real runs are BLOCKED on the verifier vendor's key. Tests mock the
 * router; any fixture verdict is stamped MOCK in `verifierModel` so it can never be
 * mistaken for a real verdict.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { readFileSync } from 'node:fs';

import type {
  AcceptanceCallContext,
  LlmRequest,
  LlmResponse,
} from '../../../llm-router/src/index.js';
import { logicalCallIdSha256 } from '../../../llm-router/src/index.js';

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
import { loadCopyValidator, loadVerificationValidator, type CopyValidator } from './load.js';
import { chooseCaveat } from './caveat.js';
import { appendVerificationsToDir, appendVerificationsToR2, type WriteResult } from './artifact.js';
import { loadConfig } from '../config.js';
import { R2Store } from '../storage/r2.js';
import { buildArtifactRef, buildAttestation, buildRawRecord, posturefor } from './attest.js';
import type {
  RetrievalResult,
  SynthClaim,
  TriageConfig,
  TriageDecision,
  VerificationValidator,
  VerifyCitation,
  VerifyModelAttestation,
  VerifyRawRecord,
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
  /**
   * #300 §E · The shared copy gate for a MODEL-authored `caveat` (injected in tests); default
   * loaded from shared/constants. Only ever screens the verifier's own phrasing — the DERIVED
   * caveat sentences are authored clean and guarded by their own test.
   */
  validateCopy?: CopyValidator;
  /**
   * Provenance stamp written to `verifierModel` (MOCK proofs override this).
   * This is the CONFIGURED id — a config echo, NOT attestation (B-BR1). What the
   * provider returned is captured separately into `record.attestation`.
   */
  verifierModel?: string;
  /**
   * R4-U4/O27 · Artifact BUNDLE revision stamped onto every record this run emits
   * (`--artifact-revision`). Absent ⇒ records carry NO artifact ref and can never
   * pass the serving trust gate — deliberately fail-closed, never auto-invented.
   */
  artifactRevision?: string;
  /** Acceptance run identity; each edge derives one stable logical call id. */
  acceptance?: Omit<AcceptanceCallContext, 'logicalCallId'>;
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
  ctx: {
    verifierModel: string;
    verifiedAt: string;
    validateVerification: VerificationValidator;
    attestation?: VerifyModelAttestation;
    artifactRevision?: string;
  },
): VerifyRecord {
  // Retrieval sources kept (with their neutral 'mentions' stance) — no verdict trusted.
  const sources: VerifyCitation[] = retrieval.sources.map((s) => ({ ...s, stance: 'mentions' as const }));
  // #300 §E · DERIVED only, and deliberately so: this record exists BECAUSE the model's reply could
  // not be enforced, so its words have already been discarded — reusing its caveat here would be
  // salvaging phrasing from the one answer we refused to trust. What fired is the corroboration
  // state we can still state honestly (nothing retrieved, or retrieved but none of it counted).
  const caveat = chooseCaveat(
    {
      retrievalPerformed: retrieval.performed,
      sourceCount: sources.length,
      supporting: 0,
      contradicting: 0,
      evidenceTier: 1,
      scopeMismatch: false,
      claimKindMatches: false,
      claimedKind: claim.claimKind,
      supportedKind: claim.claimKind,
      directionMatches: false,
      effectSizeMatches: false,
      confidence: 0.3,
    },
    null,
  ).caveat;
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
    caveat,
    verifierModel: ctx.verifierModel,
    promptVersion: VERIFIER_PROMPT_VERSION,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
    ...(ctx.attestation !== undefined ? { attestation: ctx.attestation } : {}),
  };
  // The attestation is kept even here — a provider DID answer, the answer just could
  // not be enforced. Honest history; the 'uncertain' verdict is what keeps it unserved.
  const artifact = buildArtifactRef(record, ctx.artifactRevision, posturefor(ctx.attestation));
  if (artifact !== undefined) record.artifact = artifact;
  return ctx.validateVerification(record);
}

/**
 * #307 · The acceptance logical-call id for ONE verifier call.
 *
 * Exported and used by BOTH the router call and its tests, so the derivation cannot drift between
 * them — the previous edgeId-only formula was duplicated in a test assertion, which is exactly how
 * a collision fix gets silently reverted.
 *
 * It discriminates by CITED PAPER, not by edgeId alone. Two claims may legitimately assert the same
 * edge from different papers — cross-paper corroboration is a desired outcome, not bad data. Keyed
 * on edgeId only they collapsed onto one logical call carrying different prompts, and the acceptance
 * journal correctly aborted the run with `logical call … changed identity, prompt, or ceilings/price
 * between retries`. Measured on a real 16-paper batch where one edge arrived from two papers.
 *
 * A RETRY of the same claim still yields the same id — which is what the per-logical-call POST cap
 * exists to bound — because every input is a stable property of the claim.
 */
export function verifierLogicalCallId(claim: {
  edgeId: string;
  promptVersion: string;
  citations: readonly { paperId: string }[];
}): string {
  return logicalCallIdSha256(
    'verifier',
    [
      claim.edgeId,
      claim.promptVersion,
      [...new Set(claim.citations.map((c) => c.paperId))].sort().join('|'),
    ].join('\0'),
  );
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
      ...(opts.artifactRevision !== undefined ? { artifactRevision: opts.artifactRevision } : {}),
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
  let validateCopy: CopyValidator | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    response = await opts.router.route({
      nodeId: 'verifier',
      system,
      prompt,
      expectJson: true,
      ...(opts.acceptance !== undefined
        ? {
            acceptance: {
              ...opts.acceptance,
              // #307 · The logical call id MUST discriminate by cited paper, not by edgeId alone.
              //
              // Two claims can legitimately assert the SAME edge from DIFFERENT papers — that is
              // cross-paper corroboration, a desired outcome, not bad data. Keyed on edgeId only,
              // both claims mapped to one logical call with different prompts, and the acceptance
              // journal correctly refused the second with "logical call … changed identity, prompt,
              // or ceilings/price between retries", aborting the whole run mid-batch. Measured on a
              // real 16-paper batch, where `sleep_duration_min|modulates|hrv_sdnn_ms` arrived twice.
              //
              // Mirrors `claimDedupeKey`'s discriminator (edgeId + promptVersion + sorted paperIds)
              // so a retry of the SAME claim still collapses onto one logical call — which is what
              // the per-logical-call POST cap is there to bound — while a different paper's claim
              // gets its own.
              logicalCallId: verifierLogicalCallId(claim),
            },
          }
        : {}),
    });
    let reply;
    try {
      reply = parseVerifierResponse(response.text);
    } catch (err) {
      lastReject = { ok: false, reason: 'enforcement-violation', detail: err instanceof Error ? err.message : String(err) };
      log(`verify: ${claim.edgeId} — attempt ${attempt} unparseable reply; ${attempt < maxAttempts ? 'retrying' : 'falling back'}`);
      continue;
    }
    // R4-U4/O27 (B-BR1): `verifierModel` stays the CONFIGURED id. It used to be
    // overwritten with `response.model`, which collapsed "what the provider returned"
    // into "what we configured" — one string that could mean either, so no consumer
    // could tell attestation from a config echo. The provider-returned identity now
    // travels in `attestation`, which carries its own `attested` flag.
    const attestation = buildAttestation(response);
    // #300 §E · the copy gate is loaded lazily, on the FIRST enforced reply only: it is needed
    // solely to screen model-authored caveat text, so the triage-only / dry-run / quoteCheck-only
    // rungs never pay a dynamic import for it.
    validateCopy ??= opts.validateCopy ?? (await loadCopyValidator());
    const enforced = enforceVerification(reply, {
      claim,
      quoteCheck,
      retrieval,
      verifierModel,
      promptVersion: VERIFIER_PROMPT_VERSION,
      verifiedAt,
      validateVerification,
      validateCopy,
      ...(attestation !== undefined ? { attestation } : {}),
      ...(opts.artifactRevision !== undefined ? { artifactRevision: opts.artifactRevision } : {}),
    });
    if (enforced.ok) {
      const caveatNote = enforced.record.caveat ? ` — caveat: ${enforced.record.caveat}` : '';
      log(
        `verify: ${claim.edgeId} — verdict ${enforced.record.verdict} (conf ${enforced.record.confidence}) ` +
          `via ${response.route}${caveatNote}`,
      );
      return { claim, triage, quoteCheck, retrieval, record: enforced.record, response };
    }
    lastReject = enforced;
    log(`verify: ${claim.edgeId} — attempt ${attempt} rejected (${enforced.reason}: ${enforced.detail}); ${attempt < maxAttempts ? 'retrying' : 'falling back'}`);
  }

  // Exhausted retries → safe uncertain fallback (§A10 failure mode 7).
  const fallbackAttestation = buildAttestation(response);
  const record = buildFallbackUncertain(claim, quoteCheck, retrieval, {
    verifierModel, // configured id, not the response's (B-BR1 — see the enforce call above)
    verifiedAt,
    validateVerification,
    ...(fallbackAttestation !== undefined ? { attestation: fallbackAttestation } : {}),
    ...(opts.artifactRevision !== undefined ? { artifactRevision: opts.artifactRevision } : {}),
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
  /**
   * Also append the accepted verifications to R2 `edges/verifications.jsonl` —
   * the shared truth-tier object `edge-loader --from-r2` reads.
   *
   * Opt-in and deliberately symmetric with synthesis's `--push-r2`: without it
   * the cloud pipeline can publish claims but never their verifications, so the
   * loader would project claims with no verdict attached. Never implied by a
   * plain run; the local mirror is always written first, so an R2 failure cannot
   * lose the evidence.
   */
  pushR2?: boolean;
  /** Test seam: inject the R2 store instead of constructing one from config. */
  r2Store?: R2Store;
}

export interface VerifyRunResult {
  results: VerifyClaimResult[];
  records: VerifyRecord[];
  rejectedCount: number;
  write?: WriteResult;
  /** Present only when `pushR2` was requested and records were written. */
  r2?: { key: string; written: number; skipped: number };
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
  // R4-U3: the raw provider body behind each written verification. Collected in
  // the SAME loop as the records so evidence and verdict cannot drift apart, and
  // written unconditionally with them — the retention is not opt-in.
  const rawRecords: VerifyRawRecord[] = [];
  let rejectedCount = 0;
  for (const claim of claims) {
    const r = await verifyClaim(claim, opts);
    results.push(r);
    if (r.record) {
      records.push(r.record);
      const raw = buildRawRecord(r.record, r.response);
      if (raw !== undefined) rawRecords.push(raw);
    }
    if (r.rejected && !r.record) {
      rejectedCount++;
      log(`verify: REJECT ${claim.edgeId} — ${r.rejected.reason}: ${r.rejected.detail}`);
    }
  }

  const out: VerifyRunResult = { results, records, rejectedCount };
  if (!opts.triageOnly && !opts.dryRun && opts.edgesDir && records.length > 0) {
    out.write = appendVerificationsToDir(opts.edgesDir, records, rawRecords);
    log(`verify: wrote ${out.write.written} verification(s) (${out.write.skipped} dup) → ${out.write.path}`);
    if (out.write.raw !== undefined) {
      log(
        `verify: retained ${out.write.raw.written} raw provider body/bodies ` +
          `(${out.write.raw.skipped} dup) → ${out.write.raw.path}`,
      );
    }
    // R2 last, and only after the local mirror landed: the local write is the
    // durable copy, so a network failure here degrades to "not yet published"
    // rather than "verdict lost".
    if (opts.pushR2) {
      const store = opts.r2Store ?? new R2Store(loadConfig());
      out.r2 = await appendVerificationsToR2(store, records);
      log(`verify: pushed ${out.r2.written} verification(s) (${out.r2.skipped} dup skipped) → r2 ${out.r2.key}`);
    }
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
export { loadCopyValidator, loadVerificationValidator } from './load.js';
export {
  caveatSentence,
  chooseCaveat,
  composeCaveat,
  corroboratesAFiredFlag,
  firedCaveatFlags,
  CAVEAT_SEVERITY_ORDER,
  LOW_CONFIDENCE_CAVEAT_THRESHOLD,
  MAX_CAVEAT_SENTENCES,
  MAX_MODEL_CAVEAT_CHARS,
  type CaveatChoice,
  type CaveatFlag,
  type CaveatInput,
  type CaveatSource,
} from './caveat.js';
export {
  buildArtifactRef,
  buildAttestation,
  buildRawRecord,
  canonicalJson,
  isNonProviderModelString,
  posturefor,
  recordContentHash,
  NON_PROVIDER_MODEL_MARKERS,
} from './attest.js';
export {
  appendRawVerificationsToDir,
  appendVerificationsToDir,
  appendVerificationsToR2,
  verificationDedupeKey,
  dedupeAgainst,
  rawVerificationsPath,
  verificationsPath,
  RAW_VERIFICATIONS_BASENAME,
  VERIFICATIONS_BASENAME,
  R2_VERIFICATIONS_KEY,
  type WriteResult,
} from './artifact.js';
export type * from './types.js';
