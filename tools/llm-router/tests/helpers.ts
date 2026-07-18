/**
 * Shared test helpers (not matched by the `*.test.ts` runner glob).
 *
 * `baseConfigObject()` mirrors the shipped router.config.json but routes most
 * nodes through api_worker so adapter/facade tests exercise that path; tests
 * mutate the raw object before validation to produce invalid variants.
 */

import { validateConfig, type RouterConfig } from '../src/config.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function baseConfigObject(): any {
  return {
    version: 1,
    nodes: {
      seeder: { model: 'claude-sonnet-5', route: 'local_agent', maxOutputTokens: 8000 },
      synthesis: { model: 'claude-sonnet-5', route: 'api_worker', maxOutputTokens: 8000 },
      verifier: { model: 'gpt-5', route: 'api_worker', maxOutputTokens: 8000 },
      phrasing_card: { model: 'claude-haiku-4-5', route: 'api_worker', maxOutputTokens: 2000 },
      report_narrative: { model: 'claude-sonnet-5', route: 'api_worker', maxOutputTokens: 4000 },
      extract_assist: { model: 'claude-haiku-4-5', route: 'local_agent', maxOutputTokens: 2000 },
    },
    providers: [
      { prefix: 'claude-', family: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
      { prefix: 'gpt-', family: 'openai', envKey: 'OPENAI_API_KEY' },
      { prefix: 'gemini-', family: 'google', envKey: 'GOOGLE_API_KEY' },
    ],
    prices: {
      'claude-sonnet-5': { inputUsdPerMTok: 3, outputUsdPerMTok: 15, provisional: true },
      'claude-haiku-4-5': { inputUsdPerMTok: 1, outputUsdPerMTok: 5, provisional: true },
      'gpt-5': { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10, provisional: true },
    },
    budget: {
      perRunOutputTokens: 200000,
      perDayUsdPerNode: 5,
      hardStopFraction: 0.95,
      ledgerPath: 'data/llm-router/ledger.json',
    },
    localAgent: {
      mailboxDir: 'data/llm-router/mailbox',
      timeoutMs: 300000,
      pollIntervalMs: 500,
    },
  };
}

/** Validate a (possibly mutated) base config into a typed RouterConfig. */
export function testConfig(mutate?: (raw: any) => void): RouterConfig {
  const raw = baseConfigObject();
  mutate?.(raw);
  return validateConfig(raw);
}

/** A JSON `Response` for mocked-fetch adapters. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Canned Anthropic Messages API success body. */
export function anthropicBody(text: string, inputTokens = 100, outputTokens = 50): unknown {
  return {
    id: 'msg_test',
    type: 'message',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

/** Canned OpenAI chat/completions success body. */
export function openaiBody(text: string, promptTokens = 100, completionTokens = 50): unknown {
  return {
    id: 'chatcmpl_test',
    object: 'chat.completion',
    model: 'gpt-5',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}
