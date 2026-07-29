/**
 * Public surface of @ourobion/llm-router — what `tools/brain-*` node code
 * imports. See README.md for routes, the mailbox fulfillment contract, and the
 * config reference.
 */

export {
  estimateTokens,
  LLM_NODE_IDS,
  TEST_MODE_LABEL,
  type LlmNodeId,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
  type ModelIdentity,
  type ModelIdentitySource,
  type RouteKind,
  type TestModeState,
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
  type TestModeConfig,
  type ValidateOptions,
} from './config.js';
export {
  BudgetLedger,
  costUsd,
  utcDayKey,
  type BudgetState,
  type LedgerFile,
  type NodeDayCounter,
  type RunCounter,
} from './budget.js';
export {
  effectiveCapsFor,
  fetchCapOverrides,
  MAX_PER_DAY_USD_CAP,
  MAX_PER_RUN_TOKEN_CAP,
  type CapOverrides,
  type EffectiveCaps,
  type FetchCapOverridesOptions,
  type NodeCapOverride,
} from './overrides.js';
export { buildStatusRows, type PublishRows, type SpendRow, type StatusRow } from './publish.js';
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
