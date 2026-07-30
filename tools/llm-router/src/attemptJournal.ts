/**
 * Acceptance-only provider attempt journal.
 *
 * Every possible billable POST is reserved before dispatch under an exclusive
 * lock. JSONL is append-only, hash-chained, and fsynced per line; a crash after
 * reservation is charged in full without claiming stronger power-loss atomicity.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { RouterAttemptJournalError } from './errors.js';
import {
  ACCEPTANCE_AGNES_MAX_POST_STARTS_PER_LEG,
  ACCEPTANCE_GLOBAL_MAX_USD,
  ACCEPTANCE_ANTHROPIC_MAX_POST_STARTS_PER_LEG,
  LLM_NODE_IDS,
  type LlmNodeId,
  type VendorFamily,
} from './types.js';

export type AttemptEventKind = 'reserved' | 'started' | 'response' | 'failed' | 'unknown';

export interface AttemptJournalEvent {
  version: 1;
  sequence: number;
  previousHash: string | null;
  eventHash: string;
  acceptanceRunId: string;
  logicalCallId: string;
  nodeId: LlmNodeId;
  providerFamily: VendorFamily;
  model: string;
  attempt: number;
  promptHash: string;
  inputByteCeiling: number;
  outputTokenCeiling: number;
  reservedUsd: number;
  kind: AttemptEventKind;
  at: string;
  httpStatus?: number;
  errorClass?: string;
}

export interface AttemptReservationInput {
  acceptanceRunId: string;
  logicalCallId: string;
  nodeId: LlmNodeId;
  providerFamily: VendorFamily;
  model: string;
  promptHash: string;
  inputByteCeiling: number;
  outputTokenCeiling: number;
  reservedUsd: number;
}

export interface AttemptReservation extends AttemptReservationInput {
  attempt: number;
}

function sameReservationIdentity(
  left: AttemptReservationInput & { attempt: number },
  right: AttemptReservationInput & { attempt: number },
): boolean {
  return (
    left.acceptanceRunId === right.acceptanceRunId &&
    left.logicalCallId === right.logicalCallId &&
    left.nodeId === right.nodeId &&
    left.providerFamily === right.providerFamily &&
    left.model === right.model &&
    left.attempt === right.attempt &&
    left.promptHash === right.promptHash &&
    left.inputByteCeiling === right.inputByteCeiling &&
    left.outputTokenCeiling === right.outputTokenCeiling &&
    left.reservedUsd === right.reservedUsd
  );
}

interface LockRecord {
  version: 1;
  pid: number;
  nonce: string;
  startedAt: string;
}

interface HeldLock {
  fd: number;
  nonce: string;
}

export interface AttemptJournalOptions {
  now?: () => number;
  nonce?: () => string;
  pid?: number;
  /** Expired locks may be recovered only after a nonce-stability check. */
  lockTtlMs?: number;
  /** Test seams for explicit read/fsync failure coverage. */
  readText?: (path: string) => string;
  fsync?: (fd: number) => void;
  /** Test seam; production checks whether an expired lock owner still exists. */
  isPidAlive?: (pid: number) => boolean;
  /** When set, journal and lock must be ordinary files under this real directory. */
  allowedRoot?: string;
}

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DEFAULT_LOCK_TTL_MS = 30_000;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new RouterAttemptJournalError('attempt journal: cannot hash undefined');
  return encoded;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function eventHash(event: Omit<AttemptJournalEvent, 'eventHash'>): string {
  return sha256(canonicalJson(event));
}

function fail(message: string): never {
  throw new RouterAttemptJournalError(`llm-router acceptance: ${message}`);
}

function maxPostStartsFor(providerFamily: VendorFamily, model: string): number {
  if (providerFamily === 'anthropic' && model.startsWith('claude-')) return ACCEPTANCE_ANTHROPIC_MAX_POST_STARTS_PER_LEG;
  if (providerFamily === 'agnes' && model.startsWith('agnes-')) return ACCEPTANCE_AGNES_MAX_POST_STARTS_PER_LEG;
  fail(`provider family/model '${providerFamily}/${model}' is not a canonical acceptance provider`);
}

function validateId(label: string, value: string): void {
  if (!ID_RE.test(value)) fail(`${label} must match ${ID_RE.source}`);
}

function parseLock(text: string, path: string): LockRecord {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail(`lock '${path}' is malformed; manual reconciliation required (${error instanceof Error ? error.message : String(error)})`);
  }
  const lock = value as Partial<LockRecord>;
  if (
    lock?.version !== 1 ||
    !Number.isInteger(lock.pid) ||
    typeof lock.nonce !== 'string' ||
    lock.nonce.length === 0 ||
    typeof lock.startedAt !== 'string' ||
    Number.isNaN(Date.parse(lock.startedAt))
  ) {
    fail(`lock '${path}' has an invalid shape; manual reconciliation required`);
  }
  return lock as LockRecord;
}

export class AttemptJournal {
  readonly path: string;
  readonly lockPath: string;
  private readonly now: () => number;
  private readonly nonce: () => string;
  private readonly pid: number;
  private readonly lockTtlMs: number;
  private readonly readText: (path: string) => string;
  private readonly sync: (fd: number) => void;
  private readonly isPidAlive: (pid: number) => boolean;
  private readonly allowedRoot: string | undefined;

  constructor(path: string, options: AttemptJournalOptions = {}) {
    this.path = path;
    this.lockPath = `${path}.lock`;
    this.now = options.now ?? Date.now;
    this.nonce = options.nonce ?? randomUUID;
    this.pid = options.pid ?? process.pid;
    this.lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
    this.readText = options.readText ?? ((target) => readFileSync(target, 'utf8'));
    this.sync = options.fsync ?? fsyncSync;
    this.isPidAlive = options.isPidAlive ?? ((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
      }
    });
    this.allowedRoot = options.allowedRoot;
  }

  /** Parse and verify the complete chain. ENOENT alone means a new journal. */
  readEvents(): AttemptJournalEvent[] {
    let text: string;
    try {
      text = this.readText(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      fail(`cannot read journal '${this.path}': ${error instanceof Error ? error.message : String(error)}`);
    }
    if (text === '') return [];
    if (!text.endsWith('\n')) fail(`journal '${this.path}' has a truncated final line`);

    const events: AttemptJournalEvent[] = [];
    let previousHash: string | null = null;
    for (const [index, line] of text.slice(0, -1).split('\n').entries()) {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch (error) {
        fail(`journal '${this.path}' line ${index + 1} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
      const event = value as AttemptJournalEvent;
      if (
        event?.version !== 1 ||
        event.sequence !== index + 1 ||
        event.previousHash !== previousHash ||
        !HASH_RE.test(event.eventHash ?? '') ||
        !['reserved', 'started', 'response', 'failed', 'unknown'].includes(event.kind) ||
        !Number.isInteger(event.attempt) || event.attempt < 1 ||
        !Number.isFinite(event.reservedUsd) || event.reservedUsd <= 0 ||
        !Number.isInteger(event.inputByteCeiling) || event.inputByteCeiling <= 0 ||
        !Number.isInteger(event.outputTokenCeiling) || event.outputTokenCeiling <= 0 ||
        !HASH_RE.test(event.promptHash ?? '') ||
        typeof event.model !== 'string' || event.model.length === 0 ||
        !LLM_NODE_IDS.includes(event.nodeId) ||
        !['anthropic', 'openai', 'google', 'agnes'].includes(event.providerFamily) ||
        Number.isNaN(Date.parse(event.at))
      ) {
        fail(`journal '${this.path}' line ${index + 1} has an invalid shape or chain position`);
      }
      if (event.kind === 'reserved') maxPostStartsFor(event.providerFamily, event.model);
      const { eventHash: recorded, ...hashable } = event;
      if (eventHash(hashable) !== recorded) fail(`journal '${this.path}' line ${index + 1} hash mismatch`);
      events.push(event);
      previousHash = recorded;
    }
    const lifecycle = new Map<string, {
      reserved: AttemptJournalEvent | undefined;
      started: boolean;
      terminal: boolean;
    }>();
    for (const event of events) {
      const key = `${event.acceptanceRunId}\u0000${event.logicalCallId}\u0000${event.attempt}`;
      const state = lifecycle.get(key) ?? { reserved: undefined, started: false, terminal: false };
      if (event.kind === 'reserved') {
        if (state.reserved) fail(`duplicate reservation for ${event.logicalCallId}#${event.attempt}`);
        state.reserved = event;
      } else if (event.kind === 'started') {
        if (state.reserved === undefined || !sameReservationIdentity(state.reserved, event) || state.started || state.terminal) {
          fail(`invalid started lifecycle for ${event.logicalCallId}#${event.attempt}`);
        }
        state.started = true;
      } else {
        if (state.reserved === undefined || !sameReservationIdentity(state.reserved, event) || !state.started || state.terminal) {
          fail(`duplicate, conflicting, or premature terminal outcome for ${event.logicalCallId}#${event.attempt}`);
        }
        state.terminal = true;
      }
      lifecycle.set(key, state);
    }
    return events;
  }

  reserveAndStart(input: AttemptReservationInput): AttemptReservation {
    validateId('acceptanceRunId', input.acceptanceRunId);
    validateId('logicalCallId', input.logicalCallId);
    if (!HASH_RE.test(input.promptHash)) fail('promptHash must be sha256:<64 lowercase hex>');
    if (!Number.isFinite(input.reservedUsd) || input.reservedUsd <= 0) fail('reservedUsd must be positive and finite');
    const maxPostStarts = maxPostStartsFor(input.providerFamily, input.model);

    return this.withLock(() => {
      const events = this.readEvents();
      const reservations = events.filter((event) => event.kind === 'reserved');
      // A run id groups evidence; it is not an authorization/budget key. The
      // stable hashed logical id is capped across the entire singleton journal.
      const legReservations = reservations.filter((event) => event.logicalCallId === input.logicalCallId);

      const first = legReservations[0];
      if (first !== undefined && (
        first.nodeId !== input.nodeId ||
        first.providerFamily !== input.providerFamily ||
        first.model !== input.model ||
        first.promptHash !== input.promptHash ||
        first.inputByteCeiling !== input.inputByteCeiling ||
        first.outputTokenCeiling !== input.outputTokenCeiling
      )) {
        fail(`logical call '${input.logicalCallId}' changed identity, prompt, or ceilings between retries`);
      }

      if (legReservations.length >= maxPostStarts) {
        fail(`logical call '${input.logicalCallId}' exhausted its ${maxPostStarts} POST starts`);
      }
      // The US$5 ceiling is global to this journal, not resettable by choosing a
      // fresh acceptanceRunId. Run ids group evidence; they are not budget keys.
      const reserved = reservations.reduce((sum, event) => sum + event.reservedUsd, 0);
      if (reserved + input.reservedUsd > ACCEPTANCE_GLOBAL_MAX_USD + Number.EPSILON) {
        fail(
          `run '${input.acceptanceRunId}' would exceed the global US$${ACCEPTANCE_GLOBAL_MAX_USD} ceiling ` +
            `(reserved US$${reserved.toFixed(6)}, next US$${input.reservedUsd.toFixed(6)})`,
        );
      }

      const reservation: AttemptReservation = { ...input, attempt: legReservations.length + 1 };
      this.appendEvent(events, reservation, 'reserved');
      // A separate fsynced line distinguishes reservation from the actual start.
      // The reservation still counts if the process dies between these lines.
      this.appendEvent(events, reservation, 'started');
      return reservation;
    });
  }

  record(
    reservation: AttemptReservation,
    kind: Exclude<AttemptEventKind, 'reserved' | 'started'>,
    details: { httpStatus?: number; errorClass?: string } = {},
  ): void {
    this.withLock(() => {
      const events = this.readEvents();
      const reservedEvent = events.find((event) =>
        event.kind === 'reserved' &&
        event.acceptanceRunId === reservation.acceptanceRunId &&
        event.logicalCallId === reservation.logicalCallId &&
        event.attempt === reservation.attempt
      );
      if (reservedEvent === undefined) {
        fail(`cannot record outcome for unknown attempt ${reservation.logicalCallId}#${reservation.attempt}`);
      }
      if (!sameReservationIdentity(reservedEvent, reservation)) {
        fail(`terminal outcome changed immutable reservation fields for ${reservation.logicalCallId}#${reservation.attempt}`);
      }
      const terminalExists = events.some((event) =>
        event.acceptanceRunId === reservation.acceptanceRunId &&
        event.logicalCallId === reservation.logicalCallId &&
        event.attempt === reservation.attempt &&
        event.kind !== 'reserved' &&
        event.kind !== 'started'
      );
      if (terminalExists) {
        fail(`attempt ${reservation.logicalCallId}#${reservation.attempt} already has a terminal outcome`);
      }
      this.appendEvent(events, reservation, kind, details);
    });
  }

  private appendEvent(
    events: AttemptJournalEvent[],
    reservation: AttemptReservation,
    kind: AttemptEventKind,
    details: { httpStatus?: number; errorClass?: string } = {},
  ): void {
    const previousHash = events.at(-1)?.eventHash ?? null;
    const hashable: Omit<AttemptJournalEvent, 'eventHash'> = {
      version: 1,
      sequence: events.length + 1,
      previousHash,
      ...reservation,
      kind,
      at: new Date(this.now()).toISOString(),
      ...(details.httpStatus !== undefined ? { httpStatus: details.httpStatus } : {}),
      ...(details.errorClass !== undefined ? { errorClass: details.errorClass } : {}),
    };
    const event: AttemptJournalEvent = { ...hashable, eventHash: eventHash(hashable) };
    const fd = openSync(this.path, 'a');
    try {
      const line = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8');
      if (writeSync(fd, line) !== line.byteLength) fail(`short append to journal '${this.path}'`);
      this.sync(fd);
    } finally {
      closeSync(fd);
    }
    events.push(event);
  }

  private withLock<T>(operation: () => T): T {
    mkdirSync(dirname(this.path), { recursive: true });
    this.assertSafePaths();
    const held = this.acquireLock();
    let result: T;
    let operationError: unknown;
    try {
      result = operation();
    } catch (error) {
      operationError = error;
      throw error;
    } finally {
      try {
        this.releaseLock(held);
      } catch (releaseError) {
        if (operationError === undefined) throw releaseError;
      }
    }
    return result!;
  }

  private assertSafePaths(): void {
    if (this.allowedRoot === undefined) return;
    const root = resolve(this.allowedRoot);
    const target = resolve(this.path);
    const rel = relative(root, target);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      fail(`journal '${this.path}' is outside its router-owned runtime root`);
    }
    const normalize = (value: string): string =>
      process.platform === 'win32' ? value.toLowerCase() : value;
    let realRoot: string;
    let realParent: string;
    try {
      realRoot = realpathSync(root);
      realParent = realpathSync(dirname(target));
    } catch (error) {
      fail(`cannot resolve acceptance runtime path safely: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (normalize(realRoot) !== normalize(root) || normalize(realParent) !== normalize(dirname(target))) {
      fail('acceptance runtime path uses a symlink, junction, or alias outside the canonical root');
    }
    for (const candidate of [target, `${target}.lock`]) {
      try {
        const stat = lstatSync(candidate);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          fail(`acceptance runtime file '${candidate}' is not an ordinary file`);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  /** Common adapter guard: path safety must be configured, current, and rooted exactly here. */
  assertRouterOwnedRoot(expectedRoot: string): void {
    if (
      this.allowedRoot === undefined ||
      resolve(this.allowedRoot) !== resolve(expectedRoot)
    ) {
      fail('journal lacks the router-owned safe-root binding');
    }
    mkdirSync(dirname(this.path), { recursive: true });
    this.assertSafePaths();
  }

  private acquireLock(): HeldLock {
    const nonce = this.nonce();
    let fd: number;
    try {
      fd = openSync(this.lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        fail(`cannot create lock '${this.lockPath}': ${error instanceof Error ? error.message : String(error)}`);
      }
      const observed = parseLock(this.readLock(), this.lockPath);
      const started = Date.parse(observed.startedAt);
      const age = this.now() - started;
      if (age < 0) fail(`lock '${this.lockPath}' is future-dated; refusing recovery`);
      if (age <= this.lockTtlMs) fail(`lock '${this.lockPath}' is live; concurrent reservation denied`);
      if (this.isPidAlive(observed.pid)) {
        fail(`lock '${this.lockPath}' expired by time but owner pid ${observed.pid} is still live`);
      }

      const confirmed = parseLock(this.readLock(), this.lockPath);
      if (confirmed.nonce !== observed.nonce) fail(`lock '${this.lockPath}' changed during expired-lock recovery`);
      try {
        unlinkSync(this.lockPath);
        fd = openSync(this.lockPath, 'wx');
      } catch (recoveryError) {
        fail(`expired lock '${this.lockPath}' could not be recovered safely: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
      }
    }

    const record: LockRecord = {
      version: 1,
      pid: this.pid,
      nonce,
      startedAt: new Date(this.now()).toISOString(),
    };
    try {
      const bytes = Buffer.from(JSON.stringify(record), 'utf8');
      if (writeSync(fd, bytes) !== bytes.byteLength) fail(`short write to lock '${this.lockPath}'`);
      this.sync(fd);
      return { fd, nonce };
    } catch (error) {
      closeSync(fd);
      fail(`cannot persist lock '${this.lockPath}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private readLock(): string {
    try {
      // lstat first so a symlink/directory/special-file replacement cannot read as a lock.
      const stat = lstatSync(this.lockPath);
      if (stat.isSymbolicLink() || !stat.isFile()) fail(`lock '${this.lockPath}' is not a regular file`);
      return this.readText(this.lockPath);
    } catch (error) {
      if (error instanceof RouterAttemptJournalError) throw error;
      fail(`cannot read lock '${this.lockPath}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private releaseLock(held: HeldLock): void {
    closeSync(held.fd);
    const current = parseLock(this.readLock(), this.lockPath);
    if (current.nonce !== held.nonce) {
      fail(`lock '${this.lockPath}' nonce changed before release; replacement was not removed`);
    }
    unlinkSync(this.lockPath);
  }
}

/** Stable bounded id for a raw pair/edge identity that may contain pipes or arbitrary Unicode. */
export function logicalCallIdSha256(namespace: 'synthesis' | 'verifier', rawIdentity: string): string {
  if (rawIdentity.length === 0) fail('logical call raw identity must be non-empty');
  return `${namespace}:${createHash('sha256').update(rawIdentity, 'utf8').digest('hex')}`;
}

/** Hash an unambiguous canonical serialization of the exact provider message content. */
export function providerContentSha256(canonicalContent: string): string {
  return sha256(canonicalContent);
}
