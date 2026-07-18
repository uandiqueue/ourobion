/**
 * LLM budget / usage ledger (phase2-run-config C7; mirrors the fail-closed
 * semantics of tools/brain-ingest/src/limits/budget.ts).
 *
 * Two caps, both hard-stopped at `hardStopFraction` (0.95 shipped):
 *  - **per-day, per-node USD** — each pipeline node/stage may spend at most
 *    `perDayUsdPerNode` per UTC day ($5 shipped). Cost is computed from the
 *    config price table (all prices PROVISIONAL — see router.config.json).
 *  - **per-run output tokens** — one run (identified by the router's `runId`)
 *    may emit at most `perRunOutputTokens` output tokens (200k shipped).
 *
 * The gate is PRE-CALL and fail-closed: the router asks `assertCanSpend` with a
 * worst-case estimate (prompt-length input estimate + the call's full
 * maxOutputTokens ceiling) and the call is refused BEFORE dispatch when the
 * projection would land at or beyond the hard-stop line. Actual usage is then
 * recorded post-call. The 5% headroom absorbs estimate error, mirroring
 * brain-ingest's wouldExceed95.
 *
 * Crash-safe + resumable: counters live in a small JSON ledger file, re-read at
 * construction, written atomically (tmp + rename). Day counters key on the UTC
 * date; run counters key on the caller-supplied runId.
 *
 * Lifecycle (audit A11): entries older than the retention window
 * (`budget.retentionDays`, default {@link DEFAULT_RETENTION_DAYS}) are pruned
 * on every load and persist, so the file stays bounded. Runs carry no
 * completion marker, so a run counts as finished once its `startedAt` UTC day
 * ages out of the same window. The on-disk format is unchanged (version 1) —
 * an old ledger file loads fine and simply gets pruned.
 *
 * Concurrency (audit A10): `record()` re-reads the on-disk ledger and MERGES
 * it with in-memory state before persisting, so two concurrent processes no
 * longer drop each other's spend (last-write-wins). See {@link
 * BudgetLedger.record} for the merge semantics and the (one-call-wide)
 * residual race the 5% hard-stop headroom absorbs.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RouterConfig } from './config.js';
import { resolveRepoPath } from './config.js';
import { RouterBudgetExceededError, RouterConfigError } from './errors.js';
import type { LlmNodeId, LlmUsage } from './types.js';

/** One node's accumulated spend within one UTC day. */
export interface NodeDayCounter {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

/** One run's accumulated output tokens. */
export interface RunCounter {
  startedAt: string;
  outputTokens: number;
}

/** On-disk ledger shape. */
interface LedgerFile {
  version: 1;
  /** UTC date (YYYY-MM-DD) → per-node counters. */
  days: Record<string, Partial<Record<LlmNodeId, NodeDayCounter>>>;
  /** runId → run counter. */
  runs: Record<string, RunCounter>;
}

export interface BudgetLedgerOptions {
  config: RouterConfig;
  /** Explicit ledger path; default `config.budget.ledgerPath` (repo-root-relative). */
  ledgerPath?: string;
  /** Injectable clock for deterministic tests; default Date.now. */
  now?: () => number;
}

/** UTC date key (YYYY-MM-DD) for the day containing `ms`. */
export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Ledger retention (A11): day/run entries whose UTC day is strictly older
 * than this many days before "today" are pruned on load and persist.
 * Overridable per config via `budget.retentionDays`.
 */
export const DEFAULT_RETENTION_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/** USD cost of `usage` on `model` per the config price table. */
export function costUsd(config: RouterConfig, model: string, usage: LlmUsage): number {
  const price = config.prices[model];
  if (price === undefined) {
    throw new RouterConfigError(
      `llm-router budget: no prices[] entry for model '${model}' — cannot account its spend`,
    );
  }
  return (
    (usage.inputTokens / 1_000_000) * price.inputUsdPerMTok +
    (usage.outputTokens / 1_000_000) * price.outputUsdPerMTok
  );
}

/** Summary snapshot for reports (`checkConfig`, the `ledger` CLI verb). */
export interface BudgetState {
  day: string;
  perDayUsdPerNode: number;
  perRunOutputTokens: number;
  hardStopFraction: number;
  nodes: Partial<Record<LlmNodeId, NodeDayCounter>>;
  runs: Record<string, RunCounter>;
}

/**
 * File-backed dual-cap ledger. Read at construction, persisted on every
 * `record`. Missing/corrupt file → start clean (same tolerance as
 * brain-ingest's FileBudgetGuard).
 */
export class BudgetLedger {
  private readonly config: RouterConfig;
  private readonly ledgerPath: string;
  private readonly now: () => number;
  private data: LedgerFile;

  constructor(opts: BudgetLedgerOptions) {
    this.config = opts.config;
    this.ledgerPath = opts.ledgerPath ?? resolveRepoPath(opts.config.budget.ledgerPath);
    this.now = opts.now ?? Date.now;
    this.data = this.load();
  }

  private load(): LedgerFile {
    try {
      const parsed = JSON.parse(readFileSync(this.ledgerPath, 'utf8')) as LedgerFile;
      if (parsed && typeof parsed === 'object' && parsed.version === 1) {
        // Backward-compat: tolerate an older/hand-edited version-1 file
        // missing a map, then prune (A11) so stale entries never re-enter
        // memory. The format itself is unchanged.
        const data: LedgerFile = { version: 1, days: parsed.days ?? {}, runs: parsed.runs ?? {} };
        this.prune(data);
        return data;
      }
    } catch {
      // Missing or corrupt → clean start.
    }
    return { version: 1, days: {}, runs: {} };
  }

  /** Oldest UTC day key still retained (the boundary day itself is KEPT). */
  private retentionCutoffKey(): string {
    const days = this.config.budget.retentionDays ?? DEFAULT_RETENTION_DAYS;
    return utcDayKey(this.now() - days * MS_PER_DAY);
  }

  /**
   * A11: drop entries older than the retention window (in place). Day keys
   * (YYYY-MM-DD) compare lexicographically = chronologically. Runs have no
   * completion marker, so a run is treated as completed once its `startedAt`
   * UTC day ages out of the window (no run lives that long); an unparsable
   * `startedAt` (hand-edited file) is pruned as unaccountable.
   */
  private prune(data: LedgerFile): void {
    const cutoff = this.retentionCutoffKey();
    for (const dayKey of Object.keys(data.days)) {
      if (dayKey < cutoff) delete data.days[dayKey];
    }
    for (const [runId, run] of Object.entries(data.runs)) {
      const startedMs = Date.parse(run.startedAt);
      if (Number.isNaN(startedMs) || utcDayKey(startedMs) < cutoff) delete data.runs[runId];
    }
  }

  /**
   * A10: merge in-memory state with a fresh disk read, element-wise MAX.
   *
   * Why max and not sum: every counter only ever grows and every instance
   * persists after each `record()`, so the on-disk file always supersets this
   * instance's own past writes. Element-wise max therefore yields the union
   * of every writer's spend without double-counting, where a naive sum would
   * double-count the shared base both writers loaded. Runs union the same
   * way (max outputTokens, earliest startedAt).
   *
   * Residual race: two writers inside the same read→rename window can drop at
   * most ONE call's usage (down from "everything the other process ever
   * spent" pre-merge) — the 5% hard-stop headroom absorbs that, per the
   * module docstring. No cross-process file lock is attempted.
   */
  private mergeWithDisk(): LedgerFile {
    const disk = this.load();
    const merged: LedgerFile = { version: 1, days: {}, runs: {} };

    const dayKeys = new Set([...Object.keys(this.data.days), ...Object.keys(disk.days)]);
    for (const dayKey of dayKeys) {
      const mine = this.data.days[dayKey] ?? {};
      const theirs = disk.days[dayKey] ?? {};
      const day: Partial<Record<LlmNodeId, NodeDayCounter>> = {};
      const nodeIds = new Set([...Object.keys(mine), ...Object.keys(theirs)] as LlmNodeId[]);
      for (const nodeId of nodeIds) {
        const a = mine[nodeId];
        const b = theirs[nodeId];
        day[nodeId] = {
          calls: Math.max(a?.calls ?? 0, b?.calls ?? 0),
          inputTokens: Math.max(a?.inputTokens ?? 0, b?.inputTokens ?? 0),
          outputTokens: Math.max(a?.outputTokens ?? 0, b?.outputTokens ?? 0),
          usd: Math.max(a?.usd ?? 0, b?.usd ?? 0),
        };
      }
      merged.days[dayKey] = day;
    }

    const runIds = new Set([...Object.keys(this.data.runs), ...Object.keys(disk.runs)]);
    for (const runId of runIds) {
      const a = this.data.runs[runId];
      const b = disk.runs[runId];
      const startedAts = [a?.startedAt, b?.startedAt].filter((s): s is string => s !== undefined);
      merged.runs[runId] = {
        startedAt: startedAts.sort()[0]!,
        outputTokens: Math.max(a?.outputTokens ?? 0, b?.outputTokens ?? 0),
      };
    }

    return merged;
  }

  private persist(): void {
    mkdirSync(dirname(this.ledgerPath), { recursive: true });
    const tmp = `${this.ledgerPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    renameSync(tmp, this.ledgerPath);
  }

  /** Today's counter for `nodeId` (zeros when nothing spent yet). */
  nodeSpendToday(nodeId: LlmNodeId): NodeDayCounter {
    const day = this.data.days[utcDayKey(this.now())];
    return day?.[nodeId] ?? { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 };
  }

  /** Output tokens already attributed to `runId`. */
  runOutputTokens(runId: string): number {
    return this.data.runs[runId]?.outputTokens ?? 0;
  }

  /**
   * Which cap (if any) the projected spend would cross. `est` should be a
   * worst-case estimate (full maxOutputTokens); refusal happens when the
   * projection lands AT or BEYOND the hard-stop line, mirroring brain-ingest.
   */
  wouldExceed(nodeId: LlmNodeId, runId: string, model: string, est: LlmUsage): 'day_usd' | 'run_tokens' | undefined {
    const { perDayUsdPerNode, perRunOutputTokens, hardStopFraction } = this.config.budget;

    const usdHardStop = perDayUsdPerNode * hardStopFraction;
    const projectedUsd = this.nodeSpendToday(nodeId).usd + costUsd(this.config, model, est);
    if (projectedUsd >= usdHardStop) return 'day_usd';

    const tokenHardStop = perRunOutputTokens * hardStopFraction;
    const projectedTokens = this.runOutputTokens(runId) + est.outputTokens;
    if (projectedTokens >= tokenHardStop) return 'run_tokens';

    return undefined;
  }

  /** Throw {@link RouterBudgetExceededError} when the projection crosses a cap. */
  assertCanSpend(nodeId: LlmNodeId, runId: string, model: string, est: LlmUsage): void {
    const cap = this.wouldExceed(nodeId, runId, model, est);
    if (cap === undefined) return;
    const { perDayUsdPerNode, perRunOutputTokens, hardStopFraction } = this.config.budget;
    if (cap === 'day_usd') {
      throw new RouterBudgetExceededError(
        'day_usd',
        `llm-router budget: node '${nodeId}' would cross the ${hardStopFraction * 100}% hard stop of its ` +
          `US$${perDayUsdPerNode}/day cap (already spent US$${this.nodeSpendToday(nodeId).usd.toFixed(4)} today, ` +
          `worst-case call cost US$${costUsd(this.config, model, est).toFixed(4)}). Call denied.`,
      );
    }
    throw new RouterBudgetExceededError(
      'run_tokens',
      `llm-router budget: run '${runId}' would cross the ${hardStopFraction * 100}% hard stop of the ` +
        `${perRunOutputTokens}-output-token per-run cap (already ${this.runOutputTokens(runId)} tokens, ` +
        `this call may add ${est.outputTokens}). Call denied.`,
    );
  }

  /**
   * Record ACTUAL post-call usage and persist. Re-reads and merges the
   * on-disk ledger first (A10) so a concurrent process's spend persisted
   * since our last read is never dropped, then prunes (A11).
   */
  record(nodeId: LlmNodeId, runId: string, model: string, usage: LlmUsage): void {
    this.data = this.mergeWithDisk();

    const dayKey = utcDayKey(this.now());
    const day = (this.data.days[dayKey] ??= {});
    const counter = (day[nodeId] ??= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
    counter.calls += 1;
    counter.inputTokens += usage.inputTokens;
    counter.outputTokens += usage.outputTokens;
    counter.usd += costUsd(this.config, model, usage);

    const run = (this.data.runs[runId] ??= {
      startedAt: new Date(this.now()).toISOString(),
      outputTokens: 0,
    });
    run.outputTokens += usage.outputTokens;

    this.prune(this.data);
    this.persist();
  }

  /**
   * Snapshot for reports. Runs are pruned to the retention window first, so
   * the listing stays bounded even on a long-lived instance (A11).
   */
  state(): BudgetState {
    this.prune(this.data);
    const dayKey = utcDayKey(this.now());
    return {
      day: dayKey,
      perDayUsdPerNode: this.config.budget.perDayUsdPerNode,
      perRunOutputTokens: this.config.budget.perRunOutputTokens,
      hardStopFraction: this.config.budget.hardStopFraction,
      nodes: this.data.days[dayKey] ?? {},
      runs: this.data.runs,
    };
  }
}
