/**
 * A8 · Synthesis — orchestration + barrel (insight-engine-architecture §A8).
 *
 * Wires the deterministic input assembly (load canonical text → select passages
 * → build the versioned prompt) to the router `synthesis` node (local_agent
 * mailbox per config) and the post-processing GATE (validateClaim + A9
 * quoteCheck + pair/foreign-paper checks + O20 derivation copy gate), then appends accepted claims to the
 * append-safe `edges/claims.jsonl` the A11 edge-loader reads.
 *
 * Flow (a real run):
 *   resolve pair(s) [--pair | --from-seed-artifact]  (C9: the only source of edges)
 *   → load canonical text/<uid>.txt  → selectPassages (cheap DET prefilter; A6 later)
 *   → buildSynthesisPrompt (versioned)
 *   → router.route({ nodeId:'synthesis', expectJson:true })  [local_agent mailbox]
 *   → processSynthesisResponse (the gate: reject unrequested pair / foreign paper /
 *      schema-invalid / fabricated quote / copy-gated derivation; backfill offsets; force edgeId)
 *   → appendClaimsToDir (+ appendClaimsToR2 when --push-r2).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { LlmRouter, logicalCallIdSha256 } from '../../../llm-router/src/index.js';
import type {
  AcceptanceCallContext,
  LlmRequest,
  LlmResponse,
} from '../../../llm-router/src/index.js';

import { loadConfig } from '../config.js';
import { R2Store } from '../storage/r2.js';
import { r2TextLoader, type PaperTextLoader } from '../verify/quoteCheck.js';
import { readArtifact } from '../seeder/artifact.js';
import { Manifest } from '../manifest.js';
import { classifyEvidenceTier } from '../evidenceTier.js';

import {
  appendClaimsToDir,
  appendClaimsToR2,
  appendRawSynthesisToDir,
  defaultEdgesDir,
} from './artifact.js';
import {
  loadActiveMetricKeys,
  loadClaimValidator,
  loadCopyValidator,
  repoRoot,
  type ClaimValidator,
  type CopyValidator,
} from './load.js';
import { defaultTermsForKeys, selectPassages } from './passages.js';
import { buildSynthesisPrompt, PROMPT_VERSION } from './prompt.js';
import { processSynthesisResponse } from './postprocess.js';
import { buildSynthRawRecord } from './artifact.js';
import type {
  AssembledSynthesisInput,
  PaperPassages,
  ProcessResult,
  SynthClaim,
  PaperCitationMetadata,
  SynthPair,
  SynthRawRecord,
} from './types.js';

/** Structural minimum of the router the synthesis node needs (injectable in tests). */
export interface SynthesisRouter {
  route(req: LlmRequest): Promise<LlmResponse>;
}

/** Default corpus dir (seed artifact home): `<repoRoot>/data/corpus`. */
export function defaultCorpusDir(root = repoRoot()): string {
  return `${root}/data/corpus`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pair resolution (C9 — the only source of edges)
// ─────────────────────────────────────────────────────────────────────────────

/** Build a SynthPair from an explicit `--pair a,b`. */
export function pairFromKeys(a: string, b: string, terms?: readonly string[]): SynthPair {
  return {
    id: `pair:${a}|${b}`,
    metricKeys: [a, b],
    label: `Relationship between "${a}" and "${b}"`,
    terms: terms && terms.length > 0 ? [...terms] : defaultTermsForKeys([a, b]),
  };
}

/** Read derivedFrom/rule_blueprint candidates (2 metric keys) from the seed artifact. */
export function pairsFromSeedArtifact(corpusDir: string, terms?: readonly string[]): SynthPair[] {
  const artifact = readArtifact(corpusDir);
  if (!artifact) return [];
  const out: SynthPair[] = [];
  for (const c of artifact.candidates) {
    if (c.metricKeys.length !== 2) continue; // static-topic anchors are not metric pairs
    const [a, b] = c.metricKeys as [string, string];
    out.push({
      id: c.id,
      metricKeys: [a, b],
      label: c.label,
      terms: terms && terms.length > 0 ? [...terms] : defaultTermsForKeys([a, b]),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic input assembly
// ─────────────────────────────────────────────────────────────────────────────

/** Load canonical text for each uid; missing texts are dropped (logged by caller). */
export async function loadPaperTexts(
  loader: PaperTextLoader,
  uids: readonly string[],
): Promise<{ texts: Map<string, string>; missing: string[] }> {
  const texts = new Map<string, string>();
  const missing: string[] = [];
  for (const uid of [...new Set(uids)]) {
    let text: string | null = null;
    try {
      text = await loader(uid);
    } catch {
      text = null;
    }
    if (text === null) missing.push(uid);
    else texts.set(uid, text);
  }
  return { texts, missing };
}

/** Assemble the per-pair synthesis input from loaded texts (pure over the map). */
export function assembleSynthesisInput(
  pair: SynthPair,
  texts: ReadonlyMap<string, string>,
  opts: { maxPassages?: number; paperMetadata?: ReadonlyMap<string, PaperCitationMetadata> } = {},
): AssembledSynthesisInput {
  const papers: PaperPassages[] = [...texts.entries()].map(([paperUid, text]) => ({
    paperUid,
    title: opts.paperMetadata?.get(paperUid)?.title ?? null,
    charCount: text.length,
    passages: selectPassages(text, pair.terms, { maxPassages: opts.maxPassages ?? 12 }),
  }));
  const { system, prompt } = buildSynthesisPrompt(pair, papers);
  return { pair, papers, system, prompt, allowedPaperIds: papers.map((p) => p.paperUid) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full run
// ─────────────────────────────────────────────────────────────────────────────

export interface SynthesizeOptions {
  /** Explicit pairs (from `--pair` or tests). Takes precedence over the seed artifact. */
  pairs?: readonly SynthPair[];
  /** Resolve pairs from `data/corpus/seed-queries.json` (derivedFrom/rule_blueprint). */
  fromSeedArtifact?: boolean;
  /** Papers to synthesise against (canonical text loaded for each). */
  paperUids: readonly string[];
  /** Override the passage-prefilter terms (applies to every pair). */
  terms?: readonly string[];
  /** Where claims.jsonl is written; default `<repoRoot>/data/corpus/edges`. */
  edgesDir?: string;
  /** Seed-artifact + default location; default `<repoRoot>/data/corpus`. */
  corpusDir?: string;
  /** Injected router (tests); default a real `LlmRouter`. */
  router?: SynthesisRouter;
  /** Injected text loader (tests); default `r2TextLoader` over the configured bucket. */
  textLoader?: PaperTextLoader;
  /** Manifest/corpus-owned citation title/year (tests and frozen bundles inject this). */
  paperMetadata?: ReadonlyMap<string, PaperCitationMetadata>;
  /** Injected zod gate (tests); default loaded from shared/brain. */
  validateClaim?: ClaimValidator;
  /** Injected copy gate over `derivation` (tests); default loaded from shared/constants (O20). */
  validateCopy?: CopyValidator;
  /** Injected active-metric set (tests); default loaded from shared/metrics. */
  activeMetricKeys?: ReadonlySet<string>;
  /** Router per-run token cap identity. */
  runId?: string;
  /** Acceptance run identity; each pair derives one stable logical call id. */
  acceptance?: Omit<AcceptanceCallContext, 'logicalCallId'>;
  /** Acceptance-only provider leg scope; keeps Anthropic/OpenAI reservations distinct. */
  logicalCallScope?: 'anthropic-synthesis' | 'openai-synthesis';
  /** Schema/enforcement retries; acceptance is additionally capped by its journal. */
  maxAttempts?: number;
  /** Assemble + build prompts, but issue no router call and write nothing. */
  dryRun?: boolean;
  /** Also append accepted claims to R2 `edges/claims.jsonl` (opt-in). */
  pushR2?: boolean;
  maxPassages?: number;
  now?: () => number;
  log?: (line: string) => void;
}

export interface PairOutcome {
  pair: SynthPair;
  assembled: AssembledSynthesisInput;
  result?: ProcessResult;
  response?: LlmResponse;
}

export interface SynthesizeResult {
  outcomes: PairOutcome[];
  accepted: SynthClaim[];
  rejectedCount: number;
  missingPapers: string[];
  write?: {
    path: string;
    written: number;
    skipped: number;
    raw?: { path: string; written: number; skipped: number };
  };
  evidence?: { path: string; written: number; skipped: number };
  r2?: { key: string; written: number; skipped: number };
}

/**
 * Full A8 run: resolve pairs → assemble → route → gate → append artifact.
 * Returns accepted claims + per-pair outcomes for the caller to log as evidence.
 */
export async function synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult> {
  const log = opts.log ?? (() => {});
  const root = repoRoot();
  const corpusDir = opts.corpusDir ?? defaultCorpusDir(root);
  const edgesDir = opts.edgesDir ?? defaultEdgesDir(root);

  // Resolve pairs (C9).
  const pairs: SynthPair[] = opts.pairs
    ? [...opts.pairs]
    : opts.fromSeedArtifact
      ? pairsFromSeedArtifact(corpusDir, opts.terms)
      : [];
  if (pairs.length === 0) throw new Error('synth: no candidate pairs (pass --pair or --from-seed-artifact)');

  // Validate explicit-pair endpoints are ACTIVE metrics (fail-fast; loader also enforces).
  const activeKeys = opts.activeMetricKeys ?? (await loadActiveMetricKeys(root));
  for (const p of pairs) {
    for (const k of p.metricKeys) {
      if (!activeKeys.has(k)) {
        throw new Error(`synth: pair endpoint '${k}' is not an active shared/metrics registry key`);
      }
    }
  }

  // Load canonical text once for the whole run.
  const loader = opts.textLoader ?? r2TextLoader(new R2Store(loadConfig()));
  const { texts, missing } = await loadPaperTexts(loader, opts.paperUids);
  if (missing.length > 0) log(`synth: no canonical text for ${missing.length} paper(s): ${missing.join(', ')}`);
  if (texts.size === 0) throw new Error('synth: no canonical text loaded for any requested paper');
  const paperMetadata = opts.paperMetadata ?? new Map(
    Manifest.open(corpusDir).all().map((paper) => [
      paper.paperUid,
      {
        title: paper.title,
        year: paper.year,
        evidenceTier: classifyEvidenceTier(paper).assignedTier,
      },
    ]),
  );
  const metadataMissing = [...texts.keys()].filter((paperUid) => !paperMetadata.has(paperUid));
  if (metadataMissing.length > 0) {
    throw new Error(`synth: manifest/corpus metadata missing for ${metadataMissing.join(', ')}`);
  }

  // U8/D13 carry-forward: construct via the async factory so nao-edited cap
  // overrides (llm_router_cap_overrides) bind this real pipeline call.
  // Fail-soft: absent env / unreachable Supabase → file caps + one warning.
  const router: SynthesisRouter =
    opts.router ??
    (await LlmRouter.create({ ...(opts.runId !== undefined ? { runId: opts.runId } : {}) }));
  const validateClaim = opts.validateClaim ?? (await loadClaimValidator(root));
  const validateCopy = opts.validateCopy ?? (await loadCopyValidator(root));

  const outcomes: PairOutcome[] = [];
  const allAccepted: SynthClaim[] = [];
  let evidence: { path: string; written: number; skipped: number } | undefined;
  let rejectedCount = 0;

  for (const pair of pairs) {
    const assembled = assembleSynthesisInput(pair, texts, {
      maxPassages: opts.maxPassages ?? 12,
      paperMetadata,
    });
    const passageCount = assembled.papers.reduce((n, p) => n + p.passages.length, 0);
    log(`synth: pair ${pair.id} — ${assembled.papers.length} paper(s), ${passageCount} passage(s)`);

    if (opts.dryRun) {
      outcomes.push({ pair, assembled });
      continue;
    }

    const maxAttempts = Math.max(1, opts.maxAttempts ?? (opts.acceptance ? 3 : 1));
    const logicalCallId = logicalCallIdSha256(opts.logicalCallScope ?? 'synthesis', pair.id);
    let response: LlmResponse | undefined;
    let result: ProcessResult | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      response = await router.route({
        nodeId: 'synthesis',
        system: assembled.system,
        prompt: assembled.prompt,
        expectJson: true,
        ...(opts.acceptance !== undefined
          ? {
              acceptance: {
                ...opts.acceptance,
                logicalCallId,
              },
            }
          : {}),
      });
      try {
        result = processSynthesisResponse(response.text, {
          pair,
          allowedPaperIds: assembled.allowedPaperIds,
          texts,
          paperMetadata,
          validateClaim,
          validateCopy,
          synthesisModel: response.model,
          promptVersion: PROMPT_VERSION,
          ...(opts.now !== undefined ? { now: opts.now } : {}),
        });
      } catch (error: unknown) {
        const rawRecord = buildSynthRawRecord(pair, response, {
          synthesisRunId: opts.acceptance?.acceptanceRunId ?? opts.runId ?? 'unscoped',
          logicalCallId,
          attempt,
          capturedAt: new Date((opts.now ?? Date.now)()).toISOString(),
          result: 'parse-error',
          acceptedCount: 0,
          rejectedCount: 0,
        });
        if (rawRecord !== undefined) {
          const wrote = appendRawSynthesisToDir(edgesDir, [rawRecord]);
          evidence = {
            path: wrote.path,
            written: (evidence?.written ?? 0) + wrote.written,
            skipped: (evidence?.skipped ?? 0) + wrote.skipped,
          };
        }
        lastError = error;
        if (attempt < maxAttempts) continue;
        throw error;
      }
      const resultKind: SynthRawRecord['result'] =
        result.accepted.length > 0
          ? 'accepted'
          : result.rejected.length === 0
            ? 'adverse-empty'
            : 'enforcement-rejected';
      const rawRecord = buildSynthRawRecord(pair, response, {
        synthesisRunId: opts.acceptance?.acceptanceRunId ?? opts.runId ?? 'unscoped',
        logicalCallId,
        attempt,
        capturedAt: new Date((opts.now ?? Date.now)()).toISOString(),
        result: resultKind,
        acceptedCount: result.accepted.length,
        rejectedCount: result.rejected.length,
      });
      if (rawRecord !== undefined) {
        const wrote = appendRawSynthesisToDir(edgesDir, [rawRecord]);
        evidence = {
          path: wrote.path,
          written: (evidence?.written ?? 0) + wrote.written,
          skipped: (evidence?.skipped ?? 0) + wrote.skipped,
        };
      }
      // A valid adverse/empty answer is complete. Retry only when every proposal
      // failed our schema/enforcement gates; never retry a valid verdict.
      if (result.accepted.length > 0 || result.rejected.length === 0 || attempt === maxAttempts) break;
    }
    if (response === undefined || result === undefined) throw lastError ?? new Error('synth: no response');
    for (const r of result.rejected) log(`synth: REJECT ${r.edgeId ?? '(no edgeId)'} — ${r.reason}: ${r.detail}`);
    log(`synth: pair ${pair.id} — ${result.accepted.length} accepted, ${result.rejected.length} rejected via ${response.route} (${response.model})`);

    allAccepted.push(...result.accepted);
    rejectedCount += result.rejected.length;
    outcomes.push({ pair, assembled, result, response });
  }

  const out: SynthesizeResult = {
    outcomes,
    accepted: allAccepted,
    rejectedCount,
    missingPapers: missing,
    ...(evidence !== undefined ? { evidence } : {}),
  };

  if (!opts.dryRun && allAccepted.length > 0) {
    out.write = appendClaimsToDir(edgesDir, allAccepted);
    log(`synth: wrote ${out.write.written} claim(s) (${out.write.skipped} dup skipped) → ${out.write.path}`);
    if (opts.pushR2) {
      const store = new R2Store(loadConfig());
      out.r2 = await appendClaimsToR2(store, allAccepted);
      log(`synth: pushed ${out.r2.written} claim(s) (${out.r2.skipped} dup skipped) → r2 ${out.r2.key}`);
    }
  }

  return out;
}

// ── barrel ──────────────────────────────────────────────────────────────────
export { buildSynthesisPrompt, PROMPT_VERSION, SYNTHESIS_SYSTEM } from './prompt.js';
export { selectPassages, segmentSentences, defaultTermsForKeys } from './passages.js';
export { processSynthesisResponse, parseClaimsResponse } from './postprocess.js';
export { buildSynthRawRecord } from './artifact.js';
export {
  appendClaimsToDir,
  appendClaimsToR2,
  claimDedupeKey,
  dedupeAgainst,
  defaultEdgesDir,
  claimsPath,
  rawSynthesisPath,
  appendRawSynthesisToDir,
  CLAIMS_BASENAME,
  RAW_SYNTHESIS_BASENAME,
  R2_CLAIMS_KEY,
} from './artifact.js';
export {
  loadClaimValidator,
  loadCopyValidator,
  loadActiveMetricKeys,
  loadActiveMetricCatalogue,
  loadBlueprintValidator,
} from './load.js';
export type {
  ActiveMetricDescriptor,
  BlueprintValidator,
  ClaimValidator,
  CopyValidator,
} from './load.js';

// ── #300 · whole-paper synthesis (§A–§D) + batch/budget/dedupe (G1/G2/G3/G5) ────
export { buildPaperSynthesisPrompt, PAPER_PROMPT_VERSION, PAPER_SYNTHESIS_SYSTEM } from './paperPrompt.js';
export { processPaperSynthesisResponse, parsePaperClaimsResponse, gateBlueprint } from './paperPostprocess.js';
export type { PaperProcessContext } from './paperPostprocess.js';
export {
  blueprintDedupeKey,
  creditedPapers,
  dedupeBlueprints,
  existingBlueprintKeysFromText,
} from './blueprint.js';
export type { BlueprintDedupeResult } from './blueprint.js';
export {
  appendBlueprintsToDir,
  blueprintsPath,
  blueprintsToJsonl,
  existingBlueprintKeys,
  BLUEPRINTS_BASENAME,
  R2_BLUEPRINTS_KEY,
} from './blueprintArtifact.js';
export { synthesizePapers, paperUidsAlreadySynthesised } from './paperRun.js';
export type { SynthesizePapersOptions, SynthesizePapersResult } from './paperRun.js';
export {
  INTRO_ZONE_FRACTION,
  MECHANISM_LOCATOR_PREFIX,
  isMechanismLocator,
  sectionFromLocator,
} from './types.js';

export type * from './types.js';
