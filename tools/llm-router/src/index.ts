/**
 * Public surface of @ourobion/llm-router — what `tools/brain-*` node code
 * imports. See README.md for routes, the mailbox fulfillment contract, and the
 * config reference.
 */

export {
  estimateTokens,
  LLM_NODE_IDS,
  type LlmNodeId,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
  type RouteKind,
  type VendorFamily,
} from './types.js';
export {
  RouterBudgetExceededError,
  RouterConfigError,
  RouterHttpError,
  RouterKeyMissingError,
  RouterTimeoutError,
} from './errors.js';
export {
  defaultConfigPath,
  familyOf,
  loadConfig,
  providerFor,
  resolveRepoPath,
  validateConfig,
  type BudgetConfig,
  type LocalAgentConfig,
  type NodeConfig,
  type PriceEntry,
  type ProviderEntry,
  type RouterConfig,
} from './config.js';
export { BudgetLedger, costUsd, utcDayKey, type BudgetState, type NodeDayCounter, type RunCounter } from './budget.js';
export {
  callApiWorker,
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  OPENAI_CHAT_COMPLETIONS_URL,
  type ApiWorkerOptions,
  type FetchLike,
} from './routes/apiWorker.js';
export {
  requestLocalAgent,
  requestPath,
  responsePath,
  type LocalAgentOptions,
  type MailboxRequestFile,
  type MailboxResponseFile,
} from './routes/localAgent.js';
export {
  checkConfig,
  LlmRouter,
  type CheckConfigOptions,
  type CheckConfigReport,
  type LlmRouterOptions,
  type NodeReportRow,
} from './router.js';
