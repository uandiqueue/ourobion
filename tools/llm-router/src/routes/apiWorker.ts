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
 *  - `google` family: no adapter yet; dispatching a google-family model throws a
 *    clear RouterConfigError.
 *
 * R4-U3 · RAW BODY RETENTION: both adapters keep the provider's verbatim response
 * text on `LlmResponse.rawBody` (defaulted ON, byte-capped, truncation recorded).
 * The parsed subset below is a lossy projection; the raw body is the evidence.
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
import { billingModeOf, priceIsAuthoritativeAt, providerFor, resolveRepoPath, validateConfig } from '../config.js';
import { costUsd } from '../budget.js';
import { RouterConfigError, RouterHttpError, RouterKeyMissingError } from '../errors.js';
import {
  AttemptJournal,
  acceptanceAuthorizationHash,
  acceptanceJournalRepoPath,
  providerContentSha256,
  validateAcceptanceAuthorization,
  type AttemptReservationInput,
} from '../attemptJournal.js';
import { captureRawBody } from '../raw.js';
import {
  DEFAULT_RAW_BODY_CAP_BYTES,
  ACCEPTANCE_RUNTIME_REPO_ROOT,
  ACCEPTANCE_MAX_INPUT_BYTES,
  ACCEPTANCE_MAX_OUTPUT_TOKENS,
  type LlmRequest,
  type LlmResponse,
  type ModelIdentity,
  type VendorFamily,
} from '../types.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
export const AGNES_CHAT_COMPLETIONS_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';

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
  /** Injectable clock for price-window acceptance checks. */
  now?: () => number;
  /**
   * R4-U3 · Retain the provider's raw response body on the LlmResponse.
   * DEFAULT TRUE. Retention is opt-OUT rather than opt-in on purpose: the whole
   * reason this exists is that a previous run's provider evidence was discarded
   * at parse time and could not be recovered, so "forgot to switch it on" must
   * not be a way to lose it again.
   */
  retainRawBody?: boolean;
  /** Byte cap for a retained raw body (default {@link DEFAULT_RAW_BODY_CAP_BYTES}). */
  rawBodyCapBytes?: number;
  /** Acceptance-only durable reservation hook, constructed by LlmRouter. */
  attemptJournal?: { journal: AttemptJournal; input: AttemptReservationInput };
}

function realSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Instruction appended for providers without a JSON-mode switch on this surface. */
const JSON_INSTRUCTION = 'Respond with a single valid JSON object and nothing else — no prose, no code fences.';

export interface CanonicalProviderContent {
  system?: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  /** JSON array of role/content messages: the one byte/hash/cost acceptance unit. */
  serialized: string;
  /** UTF-8 bytes of {@link serialized}. */
  inputBytes: number;
}

/**
 * Build provider message content once. The wire body, acceptance byte ceiling,
 * and journal hash all consume this same value, including injected JSON text.
 */
export function canonicalizeProviderContent(
  req: LlmRequest,
  family: VendorFamily,
): CanonicalProviderContent {
  const injectJsonInstruction = req.expectJson === true && (family === 'anthropic' || family === 'agnes');
  const system = injectJsonInstruction
    ? [req.system, JSON_INSTRUCTION].filter((value): value is string => value !== undefined).join('\n\n')
    : req.system;
  const messages: CanonicalProviderContent['messages'] = [];
  if (system !== undefined && system.length > 0) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: req.prompt });
  const serialized = JSON.stringify(messages);
  return {
    ...(system !== undefined && system.length > 0 ? { system } : {}),
    messages,
    serialized,
    inputBytes: Buffer.byteLength(serialized, 'utf8'),
  };
}

interface ResolvedOptions {
  fetchFn: FetchLike;
  env: Record<string, string | undefined>;
  maxAttempts: number;
  baseDelayMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  retainRawBody: boolean;
  rawBodyCapBytes: number;
  attemptJournal?: { journal: AttemptJournal; input: AttemptReservationInput };
}

function resolveOptions(opts: ApiWorkerOptions): ResolvedOptions {
  return {
    fetchFn: opts.fetchFn ?? (fetch as FetchLike),
    env: opts.env ?? process.env,
    maxAttempts: opts.maxAttempts ?? 3,
    baseDelayMs: opts.baseDelayMs ?? 500,
    sleep: opts.sleep ?? realSleep,
    now: opts.now ?? Date.now,
    // Defaulted ON — see ApiWorkerOptions.retainRawBody.
    retainRawBody: opts.retainRawBody ?? true,
    rawBodyCapBytes: opts.rawBodyCapBytes ?? DEFAULT_RAW_BODY_CAP_BYTES,
    ...(opts.attemptJournal !== undefined ? { attemptJournal: opts.attemptJournal } : {}),
  };
}

/** The first 2xx of a POST: the parsed JSON body AND the exact text it was parsed from. */
interface ProviderReply {
  json: unknown;
  /** Verbatim response text — the retention evidence (R4-U3). */
  rawText: string;
}

/**
 * Attach the retained raw body to a response, when retention is on.
 *
 * Spread as `...rawBodyField(o, rawText)` so `rawBody` is absent (not
 * `undefined`) when retention is off — `exactOptionalPropertyTypes` distinguishes
 * the two, and an absent field serialises out of the artifact cleanly.
 */
function rawBodyField(o: ResolvedOptions, rawText: string): Pick<LlmResponse, 'rawBody'> | object {
  return o.retainRawBody ? { rawBody: captureRawBody(rawText, o.rawBodyCapBytes) } : {};
}

/**
 * POST once-with-retries; returns the first 2xx body BOTH parsed and verbatim.
 *
 * The response is read as TEXT and parsed here rather than via `res.json()`,
 * because `res.json()` consumes the stream and leaves no way to recover the
 * original bytes — which is precisely the evidence R4-U3 exists to keep.
 */
async function postWithRetry(
  o: ResolvedOptions,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<ProviderReply> {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 1; attempt <= o.maxAttempts; attempt++) {
    const reservation = o.attemptJournal?.journal.reserveAndStart(o.attemptJournal.input);
    let res: Response;
    try {
      res = await o.fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (reservation !== undefined) {
        o.attemptJournal!.journal.record(reservation, 'unknown', {
          errorClass: error instanceof Error ? error.name : 'UnknownThrownValue',
        });
      }
      lastStatus = 0;
      // Provider/network exceptions may echo request headers or prompt content.
      // Keep only a class in the journal and a fixed redacted diagnostic.
      lastBody = '[network failure details redacted]';
      if (attempt < o.maxAttempts) {
        await o.sleep(o.baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      throw new RouterHttpError(
        0,
        lastBody.slice(0, 2000),
        `llm-router api_worker: ${url} had an ambiguous network failure after ${o.maxAttempts} attempts`,
      );
    }
    let rawText: string;
    try {
      rawText = await res.text();
    } catch (error) {
      if (reservation !== undefined) {
        o.attemptJournal!.journal.record(reservation, 'unknown', {
          httpStatus: res.status,
          errorClass: 'ResponseBodyReadError',
        });
      }
      lastStatus = res.status;
      lastBody = '[response body read failure details redacted]';
      if (attempt < o.maxAttempts) {
        await o.sleep(o.baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      throw new RouterHttpError(
        res.status,
        lastBody,
        `llm-router api_worker: ${url} response body could not be read after ${o.maxAttempts} attempts`,
      );
    }
    if (res.ok) {
      let json: unknown;
      try {
        json = JSON.parse(rawText) as unknown;
      } catch (err) {
        if (reservation !== undefined) {
          o.attemptJournal!.journal.record(reservation, 'failed', {
            httpStatus: res.status,
            errorClass: 'NonJsonResponse',
          });
        }
        lastStatus = res.status;
        lastBody = '[non-JSON provider body redacted]';
        if (attempt < o.maxAttempts) {
          await o.sleep(o.baseDelayMs * 2 ** (attempt - 1));
          continue;
        }
        throw new RouterHttpError(
          res.status,
          lastBody,
          `llm-router api_worker: ${url} returned ${res.status} with a non-JSON body after ${o.maxAttempts} attempts`,
        );
      }
      if (reservation !== undefined) {
        o.attemptJournal!.journal.record(reservation, 'response', { httpStatus: res.status });
      }
      return { json, rawText };
    }
    lastStatus = res.status;
    lastBody = '[provider error body redacted]';
    const retryable = res.status === 429 || res.status >= 500;
    if (reservation !== undefined) {
      o.attemptJournal!.journal.record(reservation, 'failed', {
        httpStatus: res.status,
        errorClass: retryable ? 'RetryableHttpStatus' : 'NonRetryableHttpStatus',
      });
    }
    if (!retryable) {
      throw new RouterHttpError(
        res.status,
        lastBody,
        `llm-router api_worker: ${url} returned non-retryable ${res.status}; response body redacted`,
      );
    }
    if (attempt < o.maxAttempts) {
      await o.sleep(o.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new RouterHttpError(
    lastStatus,
    lastBody,
    `llm-router api_worker: ${url} still failing (${lastStatus}) after ${o.maxAttempts} attempts; response body redacted`,
  );
}

/**
 * R4-U4 follow-on (B-BR1) · Decide the model identity of one API-worker response.
 *
 * The ONLY thing that makes an identity attestable is the provider having put a
 * model id in its own response body. `requested` is what we asked for; when the
 * body carries nothing usable we fall back to it and say so — `providerAttested`
 * stays false, and downstream `attestation_attested` can never become true off a
 * config echo. Neither implemented surface returns a version distinct from the
 * model id, so `returnedVersion` is null here (a genuine "no version").
 * `decorrelatedFromSynthesis` is left null: only the router sees the whole config.
 */
function apiWorkerIdentity(
  returned: unknown,
  requested: string,
  family: VendorFamily,
): ModelIdentity {
  const providerModel = typeof returned === 'string' && returned.trim() !== '' ? returned : null;
  return {
    model: providerModel ?? requested,
    source: providerModel !== null ? 'provider-response' : 'router-config',
    providerAttested: providerModel !== null,
    family,
    returnedVersion: null,
    decorrelatedFromSynthesis: null,
  };
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
  content: CanonicalProviderContent,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxOutputTokens,
    messages: content.messages.filter((message) => message.role === 'user'),
  };
  if (content.system !== undefined) body.system = content.system;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const reply = await postWithRetry(
    o,
    ANTHROPIC_MESSAGES_URL,
    { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body,
  );
  const json = reply.json as AnthropicResponse;

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
    modelIdentity: apiWorkerIdentity(json.model, model, 'anthropic'),
    route: 'api_worker',
    // R4-U3: everything this adapter did NOT map above (stop_reason, refusal
    // metadata, ids, cache counters) survives only here.
    ...rawBodyField(o, reply.rawText),
  };
}

/** OpenAI chat/completions response subset we consume. */
interface OpenAiResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Agnes's documented OpenAI-shaped chat/completions response subset. */
interface AgnesResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callAgnes(
  o: ResolvedOptions,
  apiKey: string,
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
  content: CanonicalProviderContent,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = { model, messages: content.messages, max_tokens: maxOutputTokens };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  const reply = await postWithRetry(
    o,
    AGNES_CHAT_COMPLETIONS_URL,
    { authorization: `Bearer ${apiKey}` },
    body,
  );
  const json = reply.json as AgnesResponse;
  return {
    text: json.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
    model: json.model ?? model,
    modelIdentity: apiWorkerIdentity(json.model, model, 'agnes'),
    route: 'api_worker',
    ...rawBodyField(o, reply.rawText),
  };
}

async function callOpenAi(
  o: ResolvedOptions,
  apiKey: string,
  req: LlmRequest,
  model: string,
  maxOutputTokens: number,
  content: CanonicalProviderContent,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: content.messages,
    // `max_completion_tokens` is the current parameter (plain `max_tokens` is
    // rejected by newer OpenAI models, gpt-5 family included).
    max_completion_tokens: maxOutputTokens,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.expectJson === true) body.response_format = { type: 'json_object' };

  const reply = await postWithRetry(
    o,
    OPENAI_CHAT_COMPLETIONS_URL,
    { authorization: `Bearer ${apiKey}` },
    body,
  );
  const json = reply.json as OpenAiResponse;

  return {
    text: json.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
    model: json.model ?? model,
    modelIdentity: apiWorkerIdentity(json.model, model, 'openai'),
    route: 'api_worker',
    // R4-U3: same treatment as the Anthropic path — symmetric by design, so
    // which provider answered never changes what evidence is kept.
    ...rawBodyField(o, reply.rawText),
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
  const validatedConfig = validateConfig(structuredClone(config));
  const o = resolveOptions(opts);
  const provider = providerFor(validatedConfig, model);
  if (provider === undefined) {
    throw new RouterConfigError(`llm-router api_worker: model '${model}' matches no provider prefix`);
  }
  const content = canonicalizeProviderContent(req, provider.family);
  const acceptance = req.acceptance;
  if (provider.family === 'agnes' && acceptance === undefined) {
    throw new RouterConfigError('llm-router api_worker: Agnes is acceptance-only');
  }
  if (acceptance !== undefined || o.attemptJournal !== undefined) {
    const hook = o.attemptJournal;
    const authorization = acceptance === undefined
      ? undefined
      : validateAcceptanceAuthorization(acceptance.authorization, o.now());
    const authorizationHash = authorization === undefined
      ? undefined
      : acceptanceAuthorizationHash(authorization);
    const expectedJournalPath = authorization === undefined
      ? undefined
      : resolveRepoPath(acceptanceJournalRepoPath(authorization.authorizationId));
    if (hook !== undefined) {
      hook.journal.assertRouterOwnedRoot(resolveRepoPath(ACCEPTANCE_RUNTIME_REPO_ROOT));
    }
    const expectedNode =
      (req.nodeId === 'synthesis' && provider.family === 'anthropic') ||
      (req.nodeId === 'synthesis' && provider.family === 'openai') ||
      (req.nodeId === 'verifier' && provider.family === 'agnes');
    const expectedCost = costUsd(validatedConfig, model, {
      inputTokens: ACCEPTANCE_MAX_INPUT_BYTES,
      outputTokens: ACCEPTANCE_MAX_OUTPUT_TOKENS,
    });
    const expectedPrice = validatedConfig.prices[model]!;
    if (
      acceptance === undefined ||
      hook === undefined ||
      !expectedNode ||
      req.expectJson !== true ||
      (req.maxOutputTokens !== undefined && req.maxOutputTokens !== ACCEPTANCE_MAX_OUTPUT_TOKENS) ||
      maxOutputTokens !== ACCEPTANCE_MAX_OUTPUT_TOKENS ||
      o.maxAttempts < 1 ||
      o.maxAttempts > 3 ||
      o.retainRawBody !== true ||
      o.rawBodyCapBytes !== DEFAULT_RAW_BODY_CAP_BYTES ||
      content.inputBytes > ACCEPTANCE_MAX_INPUT_BYTES ||
      hook.journal.path !== expectedJournalPath ||
      acceptanceAuthorizationHash(validateAcceptanceAuthorization(hook.input.authorization, o.now())) !== authorizationHash ||
      hook.input.authorizationId !== authorization?.authorizationId ||
      hook.input.authorizationHash !== authorizationHash ||
      hook.input.authorizationBasis !== authorization?.authorizationBasis ||
      hook.input.acceptanceRunId !== acceptance.acceptanceRunId ||
      hook.input.logicalCallId !== acceptance.logicalCallId ||
      hook.input.nodeId !== req.nodeId ||
      hook.input.providerFamily !== provider.family ||
      hook.input.model !== model ||
      hook.input.promptHash !== providerContentSha256(content.serialized) ||
      hook.input.inputByteCeiling !== ACCEPTANCE_MAX_INPUT_BYTES ||
      hook.input.outputTokenCeiling !== ACCEPTANCE_MAX_OUTPUT_TOKENS ||
      !priceIsAuthoritativeAt(validatedConfig.prices[model], o.now()) ||
      hook.input.price?.billingMode !== billingModeOf(expectedPrice) ||
      hook.input.price?.inputUsdPerMTok !== expectedPrice.inputUsdPerMTok ||
      hook.input.price?.outputUsdPerMTok !== expectedPrice.outputUsdPerMTok ||
      hook.input.price?.provisional !== false ||
      hook.input.price?.pricingProvenance !== (expectedPrice.pricingProvenance ?? null) ||
      hook.input.price?.effectiveFrom !== (expectedPrice.effectiveFrom ?? null) ||
      hook.input.price?.expiresAt !== (expectedPrice.expiresAt ?? null) ||
      Math.abs(hook.input.reservedUsd - expectedCost) > Number.EPSILON
    ) {
      throw new RouterConfigError(
        'llm-router api_worker: acceptance requires the fixed router-owned journal, ceilings, retention, price, identity, and canonical message hash',
      );
    }
  }
  const key = o.env[provider.envKey];
  if (key === undefined || key.length === 0) {
    throw new RouterKeyMissingError(provider.envKey, model);
  }
  switch (provider.family) {
    case 'anthropic':
      return callAnthropic(o, key, req, model, maxOutputTokens, content);
    case 'openai':
      return callOpenAi(o, key, req, model, maxOutputTokens, content);
    case 'agnes':
      return callAgnes(o, key, req, model, maxOutputTokens, content);
    case 'google':
      throw new RouterConfigError(
        `llm-router api_worker: no Google adapter is implemented yet (the shipped posture is ` +
          `OpenAI synthesis + Anthropic verifier — run-4 config decision C13). Add an adapter in ` +
          `routes/apiWorker.ts before routing '${model}' through api_worker.`,
      );
  }
}
