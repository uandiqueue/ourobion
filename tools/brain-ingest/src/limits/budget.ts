/**
 * Budget guard (design §5.1, §10.2).
 *
 * Some sources are **metered with a daily cap**, not merely rate-limited. This
 * tracker keeps a per-source running total of the day's spend in a persisted
 * state file (`data/corpus/usage.json`) and **fails closed** before issuing the
 * call that would cross 95% of a source's budget. The 5% headroom absorbs
 * in-flight/concurrent calls so the cap is never actually exceeded.
 *
 * Metered sources (design §5.1):
 *  - OpenAlex — unit = USD, daily budget $1.00, hard stop $0.95. Per-request
 *    costs: singleton $0 · list/filter $0.0001 · search $0.001 ·
 *    semantic/content/text $0.01.
 *  - CORE — unit = tokens, daily budget 1000, hard stop 950.
 *  - Everything else (Crossref, Europe PMC, PMC, arXiv, Unpaywall, DOAJ, S2,
 *    Lens, NCBI/pubmed) — unmetered → charge/wouldExceed95 are no-ops.
 *
 * Crash-safe + resumable: counters live on disk, are re-read at construction,
 * and reset at the provider's UTC-midnight window (the `windowStart` stored
 * with each counter). A multi-day ingest is the expected mode (§5.1).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { BudgetGuard, SourceName } from '../types.js';

/** Deterministic per-request OpenAlex prices in USD (design §5.1). */
export const OPENALEX_COST = {
  singleton: 0,
  list: 0.0001,
  filter: 0.0001,
  search: 0.001,
  semantic: 0.01,
  content: 0.01,
  text: 0.01,
} as const;

/** Daily caps + hard-stop fraction, per metered source. */
export interface SourceBudget {
  /** unit tracked (USD for OpenAlex, tokens for CORE) — informational */
  unit: 'usd' | 'tokens';
  /** full daily budget */
  daily: number;
}

/** Metered sources only; absent ⇒ unmetered (charge/guard are no-ops). */
export const BUDGETS: Partial<Record<SourceName, SourceBudget>> = {
  openalex: { unit: 'usd', daily: 1.0 },
  core: { unit: 'tokens', daily: 1000 },
};

/** The hard-stop line: stop BEFORE crossing 95% of the daily budget. */
export const HARD_STOP_FRACTION = 0.95;

/** One source's persisted counter. */
interface Counter {
  /** ISO timestamp of the UTC-midnight window this `spent` belongs to */
  windowStart: string;
  /** cumulative spend within the active window */
  spent: number;
}

/** On-disk shape of `usage.json`. */
interface UsageFile {
  /** schema marker for forward-compat */
  version: 1;
  counters: Partial<Record<SourceName, Counter>>;
}

export interface BudgetOptions {
  /**
   * Corpus dir whose `usage.json` we persist to. Defaults to `<repoRoot>/data/corpus`
   * resolved relative to this module (`src/limits` → up to repo root).
   */
  corpusDir?: string;
  /** Explicit usage-file path; overrides `corpusDir`. */
  usagePath?: string;
  /** Injectable clock for deterministic tests; default `Date.now`. */
  now?: () => number;
}

/** Default corpus dir: `<repoRoot>/data/corpus` (design §6). */
function defaultCorpusDir(): string {
  // src/limits/budget.ts → ../../../../data/corpus is the repo root's data dir.
  // tools/brain-ingest/src/limits → up 3 = tools/brain-ingest, up 4 = tools,
  // up 5 = repo root. The design path comment uses `../../data/corpus` relative
  // to tools/brain-ingest, i.e. <repoRoot>/data/corpus.
  const here = dirname(fileURLToPath(import.meta.url)); // .../src/limits
  const toolRoot = resolve(here, '..', '..'); // .../tools/brain-ingest
  return resolve(toolRoot, '..', '..', 'data', 'corpus'); // <repoRoot>/data/corpus
}

/** UTC-midnight ISO string for the day containing `ms`. */
function utcMidnightIso(ms: number): string {
  const d = new Date(ms);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  ).toISOString();
}

/**
 * File-backed {@link BudgetGuard}. Counters are read at construction and
 * rewritten on every `charge`. Reads tolerate a missing/corrupt file (treated
 * as empty). Writes are atomic (temp file + rename) so a crash mid-write can't
 * leave a half-written `usage.json`.
 */
export class FileBudgetGuard implements BudgetGuard {
  private readonly usagePath: string;
  private readonly now: () => number;
  private counters: Partial<Record<SourceName, Counter>>;

  constructor(opts: BudgetOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.usagePath =
      opts.usagePath ?? resolve(opts.corpusDir ?? defaultCorpusDir(), 'usage.json');
    this.counters = this.load();
  }

  /** Re-read counters from disk (crash-safe startup). */
  private load(): Partial<Record<SourceName, Counter>> {
    try {
      const raw = readFileSync(this.usagePath, 'utf8');
      const parsed = JSON.parse(raw) as UsageFile;
      if (parsed && typeof parsed === 'object' && parsed.counters) {
        return parsed.counters;
      }
    } catch {
      // Missing or corrupt file → start clean.
    }
    return {};
  }

  /** Atomic write: temp file + rename. */
  private persist(): void {
    const dir = dirname(this.usagePath);
    mkdirSync(dir, { recursive: true });
    const payload: UsageFile = { version: 1, counters: this.counters };
    const tmp = `${this.usagePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmp, this.usagePath);
  }

  /**
   * Return the live counter for `source`, resetting it (in memory) when the
   * stored window is from a previous UTC day. Returns `undefined` for
   * unmetered sources.
   */
  private currentCounter(source: SourceName): Counter | undefined {
    if (BUDGETS[source] === undefined) return undefined;
    const todayWindow = utcMidnightIso(this.now());
    const existing = this.counters[source];
    if (existing === undefined || existing.windowStart !== todayWindow) {
      const fresh: Counter = { windowStart: todayWindow, spent: 0 };
      this.counters[source] = fresh;
      return fresh;
    }
    return existing;
  }

  spent(source: SourceName): number {
    const counter = this.currentCounter(source);
    return counter?.spent ?? 0;
  }

  wouldExceed95(source: SourceName, cost: number): boolean {
    const budget = BUDGETS[source];
    if (budget === undefined) return false; // unmetered → never blocks
    const hardStop = budget.daily * HARD_STOP_FRACTION;
    const projected = this.spent(source) + cost;
    // "Cross the 95% line" — stop BEFORE crossing, i.e. refuse when the
    // projected total would land at or beyond the hard-stop line.
    return projected >= hardStop;
  }

  charge(source: SourceName, cost: number): void {
    const budget = BUDGETS[source];
    if (budget === undefined) return; // unmetered → no-op (NCBI etc.)
    if (this.wouldExceed95(source, cost)) {
      throw new Error(
        `budget: charging ${cost} to '${source}' would cross the 95% hard stop ` +
          `(${(budget.daily * HARD_STOP_FRACTION).toFixed(4)} ${budget.unit}; ` +
          `already spent ${this.spent(source)}). Call denied — leave work as 'discovered'.`,
      );
    }
    const counter = this.currentCounter(source)!; // metered ⇒ defined
    counter.spent += cost;
    this.persist();
  }
}

/** Factory mirroring the rate-limiter style. */
export function createBudgetGuard(opts: BudgetOptions = {}): BudgetGuard {
  return new FileBudgetGuard(opts);
}
