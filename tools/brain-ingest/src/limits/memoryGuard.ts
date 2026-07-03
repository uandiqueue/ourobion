/**
 * System memory guard (design §5.1-adjacent — a resource guard, not an API
 * budget). Unlike the rate limiter / budget guard (which protect external
 * quotas), this protects the HOST MACHINE: it checks system-wide free memory
 * (`os.freemem()`/`os.totalmem()`, not this process's own heap) before each
 * retrieval attempt and, when the machine is genuinely tight, pauses briefly
 * to avoid piling more work onto an already-struggling system.
 *
 * Motivated by a real incident (2026-07-01): the host machine was down to
 * ~5% free RAM (13 concurrent Claude Code processes + 23 VS Code windows + a
 * 3.4GB WSL VM + a leftover dev server), and background ingestion runs in that
 * environment were getting killed unpredictably. That crash source was outside
 * this tool's control (ambient system load, not ingestion's own footprint —
 * retrieval is fully sequential and each paper's PDF + extracted text is only
 * a few MB), but ingestion can still be a considerate citizen: pause instead
 * of firing off more network + PDF-parsing work at the worst possible moment.
 *
 * Deliberately soft-fail: after waiting out its budget, `waitForMemory`
 * ALWAYS lets the caller proceed — it never skips or drops a paper over
 * memory pressure it didn't cause. A paper is only ever left `discovered` for
 * a real reason (paywalled, no retrievable source, a metered source's own
 * guard); "the host machine was busy" is not one of them.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import * as os from 'node:os';

/** Tunables + injection points (tests never touch the real OS clock/memory). */
export interface MemoryGuardOptions {
  /** Pause when free memory falls below this fraction of total. Default 0.10 (10%). */
  minFreeFraction?: number;
  /** Pause when free memory falls below this many bytes, regardless of fraction. Default 512 MiB. */
  minFreeBytes?: number;
  /** How many times to wait-and-recheck before giving up and proceeding anyway. Default 3. */
  maxWaits?: number;
  /** How long to wait between checks, ms. Default 5000. */
  waitMs?: number;
  /** injectable free-memory reader (bytes); default `os.freemem`. */
  freemem?: () => number;
  /** injectable total-memory reader (bytes); default `os.totalmem`. */
  totalmem?: () => number;
  /** injectable sleep (deterministic tests); default setTimeout-based. */
  sleep?: (ms: number) => Promise<void>;
}

/** A single memory snapshot + whether it counts as "under pressure". */
export interface MemoryStatus {
  freeBytes: number;
  totalBytes: number;
  freeFraction: number;
  underPressure: boolean;
}

/** Default async sleep (real timers). */
function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read current system memory and classify it against the configured thresholds. */
export function checkMemory(opts: MemoryGuardOptions = {}): MemoryStatus {
  const freemem = opts.freemem ?? os.freemem;
  const totalmem = opts.totalmem ?? os.totalmem;
  const minFreeFraction = opts.minFreeFraction ?? 0.1;
  const minFreeBytes = opts.minFreeBytes ?? 512 * 1024 * 1024;

  const freeBytes = freemem();
  const totalBytes = totalmem();
  const freeFraction = totalBytes > 0 ? freeBytes / totalBytes : 1;
  const underPressure = freeBytes < minFreeBytes || freeFraction < minFreeFraction;

  return { freeBytes, totalBytes, freeFraction, underPressure };
}

/** Render a MemoryStatus as a short human-readable fragment for log lines. */
export function formatMemoryStatus(status: MemoryStatus): string {
  const mb = Math.round(status.freeBytes / (1024 * 1024));
  const pct = (status.freeFraction * 100).toFixed(1);
  return `${mb} MB free (${pct}%)`;
}

/**
 * If the system is under memory pressure, wait (up to `maxWaits` rechecks,
 * `waitMs` apart) for it to ease. Always returns — never throws, never tells
 * the caller to skip its work — this is a considerate pause, not a hard gate
 * (see module docstring). Logs once when pressure is first seen and once more
 * if it never eased, so a slow run is explainable rather than mysterious.
 */
export async function waitForMemory(
  opts: MemoryGuardOptions = {},
  log: (line: string) => void = () => {},
): Promise<void> {
  let status = checkMemory(opts);
  if (!status.underPressure) return;

  const maxWaits = Math.max(0, opts.maxWaits ?? 3);
  const waitMs = opts.waitMs ?? 5000;
  const sleep = opts.sleep ?? realSleep;

  log(`  memory guard: ${formatMemoryStatus(status)} — pausing for the host machine to ease up`);
  for (let attempt = 0; attempt < maxWaits; attempt++) {
    await sleep(waitMs);
    status = checkMemory(opts);
    if (!status.underPressure) {
      log(`  memory guard: recovered — ${formatMemoryStatus(status)}, resuming`);
      return;
    }
  }
  log(
    `  memory guard: still tight after ${maxWaits} wait(s) — ${formatMemoryStatus(status)}; ` +
      'proceeding anyway (ingestion\'s own footprint is small; never skip real work over ambient load)',
  );
}
