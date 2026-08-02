/**
 * #300 §A + G1/G2/G3/G5 · Whole-paper batch synthesis.
 *
 * G5 · ONE SELECTION CODE PATH, TWO FRONT DOORS. `synthesizePapers()` is the single entry
 * point. The session-screened demo batch and the nao-triggered single paper both call it —
 * a batch of 20 and a batch of 1 differ only in the length of `paperUids`. There is
 * deliberately NO separate "demo path" that could drift from the product path.
 *
 * G1 · N papers, N calls. One process, one call per paper, serial. Parallelism across papers
 * is explicitly NOT required at this volume and is avoided because it would add rate-limit and
 * budget-race complexity for no demo benefit.
 *
 * G2 · BUDGET ACCOUNTING + RESUMABILITY. Two independent protections:
 *   - **Stop cleanly at a ceiling.** Before each paper the loop checks the remaining call and
 *     USD ceilings and stops with `stopReason` set, rather than dying halfway with artifacts
 *     half-written. Every paper already completed keeps its artifacts; papers not reached are
 *     reported as `not-reached`, so the operator knows exactly where to resume.
 *   - **Never pay twice.** Papers already present in the run's claims artifact are skipped
 *     BEFORE any provider call. Re-running a partially-completed batch costs nothing for the
 *     papers that already landed.
 *   USD is computed with the router's OWN `costUsd()` against the router's OWN configured
 *   prices. No pricing is invented here, and a model with no price entry raises rather than
 *   being silently accounted as free.
 *
 * G3 · Blueprint dedupe runs across the WHOLE batch before writing, so twenty papers proposing
 * the same rule produce one blueprint with merged citations, not twenty near-identical cards.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { existsSync, readFileSync } from 'node:fs';

import { LlmRouter, costUsd, loadConfig as loadRouterConfig } from '../../../llm-router/src/index.js';
import type { LlmRequest, LlmResponse, RouterConfig } from '../../../llm-router/src/index.js';

import { loadConfig } from '../config.js';
import { R2Store } from '../storage/r2.js';
import { r2TextLoader, type PaperTextLoader } from '../verify/quoteCheck.js';
import { Manifest } from '../manifest.js';
import { classifyEvidenceTier } from '../evidenceTier.js';

import {
  appendClaimsToDir,
  appendClaimsToR2,
  appendRawSynthesisToDir,
  buildSynthRawRecord,
  claimsPath,
  defaultEdgesDir,
  R2_CLAIMS_KEY,
} from './artifact.js';
import {
  appendBlueprintsToR2,
  appendBlueprintsToDir,
  blueprintsPath,
  existingBlueprintKeys,
} from './blueprintArtifact.js';
import { dedupeBlueprints } from './blueprint.js';
import {
  loadActiveMetricCatalogue,
  loadActiveMetricKeys,
  loadBlueprintValidator,
  loadClaimValidator,
  loadCopyValidator,
  repoRoot,
  type ActiveMetricDescriptor,
  type BlueprintValidator,
  type ClaimValidator,
  type CopyValidator,
} from './load.js';
import { buildPaperSynthesisPrompt, PAPER_PROMPT_VERSION } from './paperPrompt.js';
import { processPaperSynthesisResponse } from './paperPostprocess.js';
import { defaultCorpusDir } from './index.js';
import type {
  BatchBudgetReport,
  PaperOutcome,
  PaperCitationMetadata,
  SynthBlueprintRecord,
  SynthClaim,
  SynthPaperTarget,
} from './types.js';

/** Structural minimum of the router this node needs (injectable in tests). */
export interface SynthesisRouter {
  route(req: LlmRequest): Promise<LlmResponse>;
}

export interface SynthesizePapersOptions {
  /** Papers to synthesise — one provider call each, in order (G1). */
  paperUids: readonly string[];
  /** Where claims.jsonl / blueprints.jsonl are written; default `<repoRoot>/data/corpus/edges`. */
  edgesDir?: string;
  /** Manifest home; default `<repoRoot>/data/corpus`. */
  corpusDir?: string;
  /** Injected router (tests); default a real `LlmRouter`. */
  router?: SynthesisRouter;
  /** Injected text loader (tests); default `r2TextLoader` over the configured bucket. */
  textLoader?: PaperTextLoader;
  /** Manifest/corpus-owned citation title/year (tests + frozen bundles inject this). */
  paperMetadata?: ReadonlyMap<string, PaperCitationMetadata>;
  /** Injected gates (tests); defaults loaded from shared/. */
  validateClaim?: ClaimValidator;
  validateCopy?: CopyValidator;
  validateBlueprint?: BlueprintValidator;
  /** Injected active-metric vocabulary (tests); default loaded from shared/metrics. */
  activeMetricKeys?: ReadonlySet<string>;
  metricCatalogue?: readonly ActiveMetricDescriptor[];
  /** Router pricing source for G2 accounting; default the router's own config. */
  routerConfig?: RouterConfig;
  /** G2 · stop before exceeding this many USD across the run. null/undefined = uncapped. */
  maxUsd?: number | null;
  /** G2 · stop after this many provider calls. null/undefined = uncapped. */
  maxCalls?: number | null;
  /** G2 · skip papers already present in the claims artifact (default true — never pay twice). */
  resume?: boolean;
  /** §D · emit rule blueprints alongside edges (default true). */
  emitBlueprints?: boolean;
  /** Router per-run token cap identity. */
  runId?: string;
  /** Assemble + build prompts, issue no router call, write nothing. */
  dryRun?: boolean;
  /** Also append accepted claims to R2 `edges/claims.jsonl` (opt-in). */
  pushR2?: boolean;
  /** Injected R2 store (tests); default the configured canonical store. */
  r2Store?: R2Store;
  now?: () => number;
  log?: (line: string) => void;
}

export interface SynthesizePapersResult {
  perPaper: PaperOutcome[];
  accepted: SynthClaim[];
  rejectedCount: number;
  blueprints: SynthBlueprintRecord[];
  rejectedBlueprintCount: number;
  missingPapers: string[];
  budget: BatchBudgetReport;
  /** Prompts assembled, returned only on a dry run so the caller can print them. */
  assembled?: Array<{ paperUid: string; system: string; prompt: string }>;
  write?: { path: string; written: number; skipped: number };
  blueprintWrite?: { path: string; written: number; skipped: number };
  r2?: { key: string; written: number; skipped: number };
  blueprintR2?: { key: string; written: number; skipped: number };
}

/** Paper uids already represented in an existing claims artifact (G2 resumability). */
export function paperUidsAlreadySynthesised(path: string): Set<string> {
  const done = new Set<string>();
  if (!existsSync(path)) return done;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return done;
  }
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const line of clean.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const record = JSON.parse(line) as SynthClaim;
      for (const citation of record.citations ?? []) {
        if (typeof citation?.paperId === 'string') done.add(citation.paperId);
      }
    } catch {
      // tolerate a bad line — that paper just won't be treated as done
    }
  }
  return done;
}

/**
 * Strict R2 counterpart to the best-effort local cache reader.
 *
 * A malformed remote truth artifact must stop a `--push-r2` resume before spend. Treating it as
 * empty would repeat provider calls precisely when the durable resume evidence is unreadable.
 */
function parseR2ClaimsForResume(
  text: string,
  validateClaim: ClaimValidator,
): { paperUids: Set<string>; claims: SynthClaim[] } {
  const paperUids = new Set<string>();
  const claims: SynthClaim[] = [];
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const [index, line] of clean.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch (error: unknown) {
      throw new Error(
        `${R2_CLAIMS_KEY}:${index + 1}: invalid JSON during spend-safe resume: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let claim: SynthClaim;
    try {
      claim = validateClaim(record);
    } catch (error: unknown) {
      throw new Error(
        `${R2_CLAIMS_KEY}:${index + 1}: contract validation failed during spend-safe resume: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const citations = claim.citations;
    if (!Array.isArray(citations) || citations.length === 0) {
      throw new Error(`${R2_CLAIMS_KEY}:${index + 1}: missing citations during spend-safe resume`);
    }
    for (const citation of citations) {
      const paperId = (citation as { paperId?: unknown })?.paperId;
      if (typeof paperId !== 'string' || paperId.trim() === '') {
        throw new Error(
          `${R2_CLAIMS_KEY}:${index + 1}: invalid citation paperId during spend-safe resume`,
        );
      }
      paperUids.add(paperId);
    }
    claims.push(claim);
  }
  return { paperUids, claims };
}

/**
 * #300 · Whole-paper batch synthesis (the single entry point — G5).
 *
 * Never throws for a per-paper failure: one unparseable reply must not discard the papers that
 * already succeeded. It records the failure on that paper's outcome and continues, so a
 * 20-paper batch degrades to 19 good papers rather than to nothing.
 */
export async function synthesizePapers(
  opts: SynthesizePapersOptions,
): Promise<SynthesizePapersResult> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now;
  const root = repoRoot();
  const corpusDir = opts.corpusDir ?? defaultCorpusDir(root);
  const edgesDir = opts.edgesDir ?? defaultEdgesDir(root);
  const emitBlueprints = opts.emitBlueprints ?? true;
  const resume = opts.resume ?? true;
  const maxUsd = opts.maxUsd ?? null;
  const maxCalls = opts.maxCalls ?? null;

  const requested = [...new Set(opts.paperUids)];
  if (requested.length === 0) throw new Error('synth: no papers requested (pass --paper <uid>[,<uid>])');

  // Vocabulary: the ACTIVE registry is what bounds claim endpoints in whole-paper mode.
  const activeMetricKeys = opts.activeMetricKeys ?? (await loadActiveMetricKeys(root));
  const metricCatalogue = opts.metricCatalogue ?? (await loadActiveMetricCatalogue(root));
  if (metricCatalogue.length === 0) {
    throw new Error('synth: the active metric catalogue is empty — nothing could be proposed');
  }
  const validateClaim = opts.validateClaim ?? (await loadClaimValidator(root));

  // G2 · resumability, decided BEFORE any provider call.
  const alreadyDone = resume ? paperUidsAlreadySynthesised(claimsPath(edgesDir)) : new Set<string>();
  let sharedR2Store = opts.r2Store;
  if (resume && opts.pushR2) {
    sharedR2Store ??= new R2Store(loadConfig());
    const remote = await sharedR2Store.headExists(R2_CLAIMS_KEY);
    if (remote.exists) {
      const remoteResume = parseR2ClaimsForResume(
        await sharedR2Store.getObjectText(R2_CLAIMS_KEY),
        validateClaim,
      );
      const hydration = appendClaimsToDir(edgesDir, remoteResume.claims);
      for (const paperUid of remoteResume.paperUids) alreadyDone.add(paperUid);
      log(
        `synth: resume checked ${remoteResume.paperUids.size} paper uid(s) in r2 ` +
          `${R2_CLAIMS_KEY}; hydrated ${hydration.written} claim(s) locally`,
      );
    }
  }

  const loader = opts.textLoader ?? r2TextLoader(sharedR2Store ?? new R2Store(loadConfig()));
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

  const validateCopy = opts.validateCopy ?? (await loadCopyValidator(root));
  const validateBlueprint = emitBlueprints
    ? opts.validateBlueprint ?? (await loadBlueprintValidator(root))
    : undefined;

  const router: SynthesisRouter | undefined = opts.dryRun
    ? undefined
    : opts.router ??
      (await LlmRouter.create({ ...(opts.runId !== undefined ? { runId: opts.runId } : {}) }));
  // Pricing for G2 accounting comes from the router's own config — never invented here.
  const routerConfig = opts.dryRun ? undefined : opts.routerConfig ?? loadRouterConfig();

  const perPaper: PaperOutcome[] = [];
  const accepted: SynthClaim[] = [];
  const blueprintRecords: SynthBlueprintRecord[] = [];
  const assembled: Array<{ paperUid: string; system: string; prompt: string }> = [];
  const missingPapers: string[] = [];
  let rejectedCount = 0;
  let rejectedBlueprintCount = 0;
  let providerCalls = 0;
  let usdSpent = 0;
  let stopReason: BatchBudgetReport['stopReason'] = 'completed';
  let stopped = false;

  for (const paperUid of requested) {
    if (stopped) {
      perPaper.push(emptyOutcome(paperUid, 'not-reached'));
      continue;
    }

    if (alreadyDone.has(paperUid)) {
      log(`synth: ${paperUid} — already in ${claimsPath(edgesDir)}; skipped (never pay twice)`);
      perPaper.push(emptyOutcome(paperUid, 'skipped-already-done'));
      continue;
    }

    // G2 · ceilings are checked BEFORE the call, so we stop cleanly rather than overrun.
    if (maxCalls !== null && providerCalls >= maxCalls) {
      stopReason = 'call-ceiling';
      stopped = true;
      log(`synth: STOP — call ceiling ${maxCalls} reached before ${paperUid}`);
      perPaper.push(emptyOutcome(paperUid, 'not-reached'));
      continue;
    }

    let text: string | null = null;
    try {
      text = await loader(paperUid);
    } catch {
      text = null;
    }
    if (text === null || text.length === 0) {
      missingPapers.push(paperUid);
      log(`synth: ${paperUid} — no canonical text; skipped`);
      perPaper.push({ ...emptyOutcome(paperUid, 'failed'), detail: 'no canonical text' });
      continue;
    }
    if (!paperMetadata.has(paperUid)) {
      // Same failure the pair-scoped path raises, but per-paper: one paper missing from the
      // manifest must not abort the other nineteen.
      log(`synth: ${paperUid} — manifest/corpus metadata missing; skipped`);
      perPaper.push({
        ...emptyOutcome(paperUid, 'failed'),
        detail: 'manifest/corpus metadata missing (run hydrate-manifest first)',
      });
      continue;
    }

    const target: SynthPaperTarget = {
      paperUid,
      title: paperMetadata.get(paperUid)?.title ?? null,
      text,
    };
    const { system, prompt } = buildPaperSynthesisPrompt(target, metricCatalogue, {
      includeBlueprints: emitBlueprints,
    });
    log(`synth: ${paperUid} — whole paper, ${text.length} chars, ${metricCatalogue.length} active metrics`);

    if (opts.dryRun) {
      assembled.push({ paperUid, system, prompt });
      perPaper.push(emptyOutcome(paperUid, 'not-reached'));
      continue;
    }

    let response: LlmResponse;
    try {
      response = await router!.route({ nodeId: 'synthesis', system, prompt, expectJson: true });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      log(`synth: ${paperUid} — router call failed: ${detail}`);
      perPaper.push({ ...emptyOutcome(paperUid, 'failed'), detail });
      continue;
    }
    providerCalls += 1;

    // G2 · account this call with the router's own pricing.
    //
    // FAIL-CLOSED PRICING. `response.model` is the provider-ATTESTED id, which for OpenAI is a
    // dated snapshot (`gpt-5-2025-08-07`) with no `prices[]` row — only the configured id
    // (`gpt-5`) has one. Accounting 0 for an unpriced model made this ceiling DECORATIVE: a live
    // two-paper run spent US$0.055 and recorded US$0.000000, so `--max-usd` could never fire.
    // Measured on a real run, not hypothesised.
    //
    // So: price the attested id when it is priced, else fall back to the CONFIGURED node model —
    // which is the rate actually authorised for this node. If neither is priced, refuse: at that
    // point the run cannot account its own spend and continuing would silently burn budget.
    const configuredModel = routerConfig!.nodes?.synthesis?.model;
    let callUsd: number;
    try {
      callUsd = costUsd(routerConfig!, response.model, response.usage);
    } catch {
      try {
        if (configuredModel === undefined) throw new Error('no configured synthesis model');
        callUsd = costUsd(routerConfig!, configuredModel, response.usage);
        log(
          `synth: ${paperUid} — attested id '${response.model}' has no prices[] row; ` +
            `accounted at the configured '${configuredModel}' rate (US$${callUsd.toFixed(6)})`,
        );
      } catch (error: unknown) {
        throw new Error(
          `synth: cannot account spend for attested '${response.model}' nor configured ` +
            `'${configuredModel}' — refusing to continue an unaccountable run ` +
            `(${error instanceof Error ? error.message : String(error)})`,
        );
      }
    }
    usdSpent += callUsd;

    const texts = new Map([[paperUid, text]]);
    const outcome: PaperOutcome = { ...emptyOutcome(paperUid, 'synthesised'), usd: callUsd };
    try {
      const result = processPaperSynthesisResponse(response.text, {
        paperUid,
        texts,
        paperMetadata,
        activeMetricKeys,
        validateClaim,
        validateCopy,
        ...(validateBlueprint !== undefined ? { validateBlueprint } : {}),
        synthesisModel: response.model,
        promptVersion: PAPER_PROMPT_VERSION,
        now,
      });
      for (const r of result.rejected) log(`synth: REJECT ${r.edgeId ?? '(no edgeId)'} — ${r.reason}: ${r.detail}`);
      for (const r of result.rejectedBlueprints ?? []) {
        log(`synth: REJECT blueprint ${r.ruleId ?? '(no ruleId)'} — ${r.reason}: ${r.detail}`);
      }
      accepted.push(...result.accepted);
      blueprintRecords.push(...(result.acceptedBlueprints ?? []));
      rejectedCount += result.rejected.length;
      rejectedBlueprintCount += (result.rejectedBlueprints ?? []).length;
      outcome.acceptedClaims = result.accepted.length;
      outcome.rejectedClaims = result.rejected.length;
      outcome.acceptedBlueprints = (result.acceptedBlueprints ?? []).length;
      outcome.rejectedBlueprints = (result.rejectedBlueprints ?? []).length;
      log(
        `synth: ${paperUid} — ${result.accepted.length} claim(s), ` +
          `${(result.acceptedBlueprints ?? []).length} blueprint(s) accepted; ` +
          `${result.rejected.length} claim(s) rejected via ${response.route} (${response.model}); ` +
          `US$${callUsd.toFixed(6)}`,
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      log(`synth: ${paperUid} — unparseable reply: ${detail}`);
      outcome.status = 'failed';
      outcome.detail = detail;
    }

    // Provider evidence is written per paper, so a later stop never loses earlier evidence.
    const rawRecord = buildSynthRawRecord(
      { id: `paper:${paperUid}`, metricKeys: ['', ''], label: paperUid, terms: [] },
      response,
      {
        synthesisRunId: opts.runId ?? 'unscoped',
        logicalCallId: `paper:${paperUid}`,
        attempt: 1,
        capturedAt: new Date(now()).toISOString(),
        result: outcome.acceptedClaims > 0 ? 'accepted' : outcome.status === 'failed' ? 'parse-error' : 'adverse-empty',
        acceptedCount: outcome.acceptedClaims,
        rejectedCount: outcome.rejectedClaims,
      },
    );
    if (rawRecord !== undefined) appendRawSynthesisToDir(edgesDir, [rawRecord]);

    perPaper.push(outcome);

    // G2 · after accounting, decide whether the NEXT paper can be afforded.
    if (maxUsd !== null && usdSpent >= maxUsd) {
      stopReason = 'budget-ceiling';
      stopped = true;
      log(`synth: STOP — USD ceiling ${maxUsd} reached (spent US$${usdSpent.toFixed(6)})`);
    }
  }

  // G3 · dedupe blueprints across the WHOLE batch before writing.
  const existingKeys = emitBlueprints ? existingBlueprintKeys(blueprintsPath(edgesDir)) : new Set<string>();
  const deduped = dedupeBlueprints(existingKeys, blueprintRecords);
  if (deduped.merged.length > 0) {
    log(
      `synth: blueprint dedupe — ${deduped.toWrite.length} distinct, ` +
        `${deduped.merged.length} merged as corroboration (G3)`,
    );
  }

  const result: SynthesizePapersResult = {
    perPaper,
    accepted,
    rejectedCount,
    blueprints: deduped.toWrite,
    rejectedBlueprintCount,
    missingPapers,
    budget: {
      stopReason,
      papersRequested: requested.length,
      papersSynthesised: perPaper.filter((p) => p.status === 'synthesised').length,
      papersSkippedAlreadyDone: perPaper.filter((p) => p.status === 'skipped-already-done').length,
      papersNotReached: perPaper.filter((p) => p.status === 'not-reached').length,
      papersFailed: perPaper.filter((p) => p.status === 'failed').length,
      providerCalls,
      usdSpent,
      maxUsd,
      maxCalls,
    },
    ...(opts.dryRun ? { assembled } : {}),
  };

  if (!opts.dryRun && accepted.length > 0) {
    result.write = appendClaimsToDir(edgesDir, accepted);
    log(`synth: wrote ${result.write.written} claim(s) (${result.write.skipped} dup) → ${result.write.path}`);
  }
  if (!opts.dryRun && deduped.toWrite.length > 0) {
    result.blueprintWrite = appendBlueprintsToDir(edgesDir, deduped.toWrite);
    log(
      `synth: wrote ${result.blueprintWrite.written} blueprint(s) ` +
      `(${result.blueprintWrite.skipped} dup) → ${result.blueprintWrite.path}`,
    );
  }
  if (!opts.dryRun && opts.pushR2) {
    const store = sharedR2Store ?? new R2Store(loadConfig());
    // Publish the required blueprint first. If it fails, no new claim becomes
    // visible in R2 without its post-#300 rule artifact.
    if (deduped.toWrite.length > 0) {
      result.blueprintR2 = await appendBlueprintsToR2(store, deduped.toWrite);
      log(
        `synth: pushed ${result.blueprintR2.written} blueprint(s) ` +
          `(${result.blueprintR2.skipped} dup) → r2 ${result.blueprintR2.key}`,
      );
    }
    if (accepted.length > 0) {
      result.r2 = await appendClaimsToR2(store, accepted);
      log(`synth: pushed ${result.r2.written} claim(s) (${result.r2.skipped} dup) → r2 ${result.r2.key}`);
    }
  }

  return result;
}

function emptyOutcome(paperUid: string, status: PaperOutcome['status']): PaperOutcome {
  return {
    paperUid,
    status,
    acceptedClaims: 0,
    rejectedClaims: 0,
    acceptedBlueprints: 0,
    rejectedBlueprints: 0,
  };
}
