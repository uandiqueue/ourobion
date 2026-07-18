/**
 * API-worker route (memory 0013 execution constraint; C6 model ids).
 *
 * Native-`fetch` adapters — no SDKs, zero deps — for:
 *  - **Anthropic Messages API** (`POST /v1/messages`, `anthropic-version:
 *    2023-06-01`, `x-api-key` auth);
 *  - **OpenAI Chat Completions API** (`POST /v1/chat/completions`, Bearer
 *    auth). Chosen over the newer Responses API deliberately: chat/completions
 *    is the stable, exhaustively documented surface and the router only needs
 *    single-turn text/JSON — recorded as a session decision. Swapping to
 *    Responses later is contained to this file.
 *  - `google` family: no adapter yet (verifier is provisionally gpt-5 per C6);
 *    dispatching a google-family model throws a clear RouterConfigError.
 *
 * Retry: exponential backoff on 429 and 5xx (attempt n sleeps
 * baseDelayMs * 2^(n-1)); other non-2xx statuses fail immediately with a typed
 * RouterHttpError. `fetch` and `sleep` are injectable so every path is testable
 * offline with a mocked fetch — NO api key is required to import or construct
 * anything here; a missing key surfaces as a typed RouterKeyMissingError naming
 * the exact env var, thrown before any network attempt.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { RouterConfig } from '../config.js';
import { providerFor } from '../config.js';
import { RouterConfigError, RouterHttpError, RouterKeyMissingError } from '../errors.js';
import type { LlmRequest, LlmResponse } from '../types.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Minimal fetch signature the adapters need (global fetch satisfies it). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface ApiWorkerOptions {
  /** Injectable fetch for tests; default global fetch. */
  fetchFn?: FetchLike;
  /** Injectable env for tests; default process.env. */
  env?: Record<string, string | undefined>;
  /** Total attempts including the first (default 3). */
  maxAttempts?: number;
  /** First backoff delay; doubles per retry (default 500ms). */
  baseDelayMs?: number;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Instruction appended for providers without a JSON-mode switch on this surface. */
const JSON_INSTRUCTION = 'Respond with a single valid JSON object and nothing else — no prose, no code fences.';

interface ResolvedOptions {
  fetchFn: FetchLike;
  env: Record<string, string | undefined>;
  maxAttempts: number;
  baseDelayMs: number;
  sleep: (ms: number) => Promise<void>;
}

function resolveOptions(opts: ApiWorkerOptions): ResolvedOptions {
  return {
    fetchFn: opts.fetchFn ?? (fetch as FetchLike),
    env: opts.env ?? process.env,
    maxAttempts: opts.maxAttempts ?? 3,
    baseDelayMs: opts.baseDelayMs ?? 500,
    sleep: opts.sleep ?? realSleep,
  };
}

/** POST once-with-retries; returns the parsed JSON body of the first 2xx. */
async function postWithRetry(
  o: ResolvedOptions,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 1; attempt <= o.maxAttempts; attempt++) {
    const res = await o.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return (await res.json()) as unknown;
    }
    lastStatus = res.status;
    lastBody = (await res.text()).slice(0, 2000);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) {
      throw new RouterHttpError(
        res.status,
        lastBody,
        `llm-router api_worker: ${url} returned non-retryable ${res.status}: ${lastBody.slice(0, 300)}`,
      );
    }
    if (attempt < o.maxAttempts) {
      await o.sleep(o.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new RouterHttpError(
    lastStatus,
    lastBody,
    `llm-router api_worker: ${url} still failing (${lastStatus}) after ${o.maxAttempts} attempts: ${lastBody.slice(0, 300)}`,
  );
}

/** Anthropic Messages API response subset we consume. */
interface AnthropicResponse {
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callAnthropic(
  o: ResolvedOptions,
  apiKey: string,
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
): Promise<LlmResponse> {
  const system =
    req.expectJson === true
      ? [req.system, JSON_INSTRUCTION].filter((s): s is string => s !== undefined).join('\n\n')
      : req.system;
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxOutputTokens,
    messages: [{ role: 'user', content: req.prompt }],
  };
  if (system !== undefined && system.length > 0) body.system = system;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const json = (await postWithRetry(
    o,
    ANTHROPIC_MESSAGES_URL,
    { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body,
  )) as AnthropicResponse;

  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
  return {
    text,
    usage: {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    },
    model: json.model ?? model,
    route: 'api_worker',
  };
}

/** OpenAI chat/completions response subset we consume. */
interface OpenAiResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callOpenAi(
  o: ResolvedOptions,
  apiKey: string,
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
): Promise<LlmResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (req.system !== undefined && req.system.length > 0) {
    messages.push({ role: 'system', content: req.system });
  }
  messages.push({ role: 'user', content: req.prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    // `max_completion_tokens` is the current parameter (plain `max_tokens` is
    // rejected by newer OpenAI models, gpt-5 family included).
    max_completion_tokens: maxOutputTokens,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.expectJson === true) body.response_format = { type: 'json_object' };

  const json = (await postWithRetry(
    o,
    OPENAI_CHAT_COMPLETIONS_URL,
    { authorization: `Bearer ${apiKey}` },
    body,
  )) as OpenAiResponse;

  return {
    text: json.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
    model: json.model ?? model,
    route: 'api_worker',
  };
}

/**
 * Dispatch one request over the API-worker route. Resolves the vendor family
 * from the model-id prefix, checks the provider's env key (typed
 * RouterKeyMissingError when absent — before any fetch), then calls the
 * family's adapter.
 */
export async function callApiWorker(
  config: RouterConfig,
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
  opts: ApiWorkerOptions = {},
): Promise<LlmResponse> {
  const o = resolveOptions(opts);
  const provider = providerFor(config, model);
  if (provider === undefined) {
    throw new RouterConfigError(`llm-router api_worker: model '${model}' matches no provider prefix`);
  }
  const key = o.env[provider.envKey];
  if (key === undefined || key.length === 0) {
    throw new RouterKeyMissingError(provider.envKey, model);
  }
  switch (provider.family) {
    case 'anthropic':
      return callAnthropic(o, key, req, model, maxOutputTokens);
    case 'openai':
      return callOpenAi(o, key, req, model, maxOutputTokens);
    case 'google':
      throw new RouterConfigError(
        `llm-router api_worker: no Google adapter is implemented yet (verifier is provisionally ` +
          `gpt-5-family per phase2-run-config C6). Add an adapter in routes/apiWorker.ts before ` +
          `routing '${model}' through api_worker.`,
      );
  }
}
