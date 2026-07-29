/**
 * Local-agent route — the KEYLESS route (memory 0013: "host Opus inside Claude
 * Code, no API / no specialised worker").
 *
 * Implemented as a **filesystem mailbox**: `requestLocalAgent` writes
 * `<id>.request.json` into the mailbox dir and polls for `<id>.response.json`
 * until a configurable timeout. The *hosting agent session* (e.g. the Claude
 * Code session orchestrating a pipeline run) watches the dir and fulfills
 * requests by answering the prompt itself and writing the response file. The
 * exact fulfillment contract is documented in the package README (an
 * orchestrating agent must be able to implement it from the README alone) and
 * restated compactly here:
 *
 *   REQUEST  <id>.request.json  (written by the router, atomically):
 *     { "version": 1, "id", "createdAt", "nodeId", "model", "system"?,
 *       "prompt", "maxOutputTokens", "temperature"?, "expectJson"? }
 *     `model` is a HINT — the fulfilling session answers with whatever model it
 *     is running; it should record what it used in the response's `model`.
 *
 *   RESPONSE <id>.response.json  (written by the fulfiller; write to a temp
 *   name then rename so the router never reads a half-written file — the
 *   poller additionally tolerates unparsable JSON by treating it as
 *   not-ready-yet):
 *     success: { "id", "status": "ok", "text", "model"?,
 *                "usage"?: { "inputTokens", "outputTokens" } }
 *     failure: { "id", "status": "error", "error": "<human-readable reason>" }
 *
 *   Usage is optional because an agent session has no token meter; when
 *   absent the router estimates (~4 chars/token) so budget accounting still
 *   moves. Files are LEFT IN PLACE after consumption as an audit trail of the
 *   run; the mailbox dir is runtime state (gitignored), never truth.
 *
 * No hardcoded absolute paths: the mailbox dir comes from config
 * (repo-root-relative) or the caller. Timeout → typed RouterTimeoutError.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RouterTimeoutError } from '../errors.js';
import { estimateTokens, type LlmRequest, type LlmResponse } from '../types.js';

/** On-disk request shape (the fulfillment contract's input half). */
export interface MailboxRequestFile {
  version: 1;
  id: string;
  createdAt: string;
  nodeId: LlmRequest['nodeId'];
  /** Model HINT — the fulfilling session uses whatever it runs. */
  model: string;
  system?: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  expectJson?: boolean;
}

/** On-disk response shape (the contract's output half). */
export type MailboxResponseFile =
  | {
      id: string;
      status: 'ok';
      text: string;
      model?: string;
      usage?: { inputTokens: number; outputTokens: number };
    }
  | { id: string; status: 'error'; error: string };

export interface LocalAgentOptions {
  /** Mailbox directory (created if missing). */
  dir: string;
  /** Give up after this long (default from config: 300000ms). */
  timeoutMs: number;
  /** Poll cadence (default from config: 500ms). */
  pollIntervalMs: number;
  /** Injectable request id (default: crypto.randomUUID()). */
  id?: string;
  /** Injectable clock for deterministic tests; default Date.now. */
  now?: () => number;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function requestPath(dir: string, id: string): string {
  return join(dir, `${id}.request.json`);
}

export function responsePath(dir: string, id: string): string {
  return join(dir, `${id}.response.json`);
}

/**
 * Write the request file (atomically: tmp + rename) and poll for the response.
 */
export async function requestLocalAgent(
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
  opts: LocalAgentOptions,
): Promise<LlmResponse> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const id = opts.id ?? randomUUID();

  mkdirSync(opts.dir, { recursive: true });

  const requestFile: MailboxRequestFile = {
    version: 1,
    id,
    createdAt: new Date(now()).toISOString(),
    nodeId: req.nodeId,
    model,
    prompt: req.prompt,
    maxOutputTokens,
  };
  if (req.system !== undefined) requestFile.system = req.system;
  if (req.temperature !== undefined) requestFile.temperature = req.temperature;
  if (req.expectJson !== undefined) requestFile.expectJson = req.expectJson;

  const reqPath = requestPath(opts.dir, id);
  const tmp = `${reqPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(requestFile, null, 2), 'utf8');
  renameSync(tmp, reqPath);

  const resPath = responsePath(opts.dir, id);
  const deadline = now() + opts.timeoutMs;

  for (;;) {
    if (existsSync(resPath)) {
      let parsed: MailboxResponseFile | undefined;
      try {
        parsed = JSON.parse(readFileSync(resPath, 'utf8')) as MailboxResponseFile;
      } catch {
        // Half-written or invalid — treat as not-ready and keep polling.
        parsed = undefined;
      }
      if (parsed !== undefined && parsed.id === id) {
        if (parsed.status === 'error') {
          throw new Error(
            `llm-router local_agent: fulfiller reported an error for request '${id}': ${parsed.error}`,
          );
        }
        const inputText = (req.system ?? '') + req.prompt;
        return {
          text: parsed.text,
          usage: parsed.usage ?? {
            inputTokens: estimateTokens(inputText),
            outputTokens: estimateTokens(parsed.text),
          },
          model: parsed.model ?? model,
          // R4-U4 follow-on (B-BR1): a mailbox fulfilment is a HOST AGENT SESSION
          // writing a file — there is no provider response body at all, so the id
          // here (whatever the fulfiller wrote, or the configured one) can never be
          // attestation. providerAttested is false unconditionally on this route.
          modelIdentity: {
            model: parsed.model ?? model,
            source: 'local-agent-mailbox',
            providerAttested: false,
            family: null,
            returnedVersion: null,
            decorrelatedFromSynthesis: null,
          },
          route: 'local_agent',
        };
      }
    }
    if (now() >= deadline) {
      throw new RouterTimeoutError(id, opts.timeoutMs);
    }
    await sleep(opts.pollIntervalMs);
  }
}
