/**
 * Typed router errors. Downstream node code branches on `instanceof`, so each
 * failure mode gets its own class:
 *  - RouterConfigError        — invalid router.config.json (incl. decorrelation
 *                               invariant violations). Fail-loudly at load.
 *  - RouterKeyMissingError    — api_worker route selected but the provider's
 *                               env key is absent; `.envVar` names exactly which
 *                               variable to provision (this is how blocked-on-
 *                               key surfaces downstream — register B5).
 *  - RouterBudgetExceededError— a call would cross the 95% hard-stop line of a
 *                               per-day-USD or per-run-token cap.
 *  - RouterHttpError          — provider returned a non-retryable status, or
 *                               retries were exhausted.
 *  - RouterTimeoutError       — local-agent mailbox response did not appear
 *                               within the configured timeout.
 */

export class RouterConfigError extends Error {
  override readonly name = 'RouterConfigError';
}

export class RouterKeyMissingError extends Error {
  override readonly name = 'RouterKeyMissingError';
  constructor(
    /** The env var that must be set (e.g. 'OPENAI_API_KEY'). */
    readonly envVar: string,
    /** The model whose provider needs the key. */
    readonly model: string,
  ) {
    super(
      `llm-router: api_worker route for model '${model}' requires env var ${envVar}, ` +
        `which is not set. Provision the key or switch the node to the 'local_agent' route.`,
    );
  }
}

export class RouterBudgetExceededError extends Error {
  override readonly name = 'RouterBudgetExceededError';
  constructor(
    /** 'day_usd' — per-day per-node USD cap; 'run_tokens' — per-run output-token cap. */
    readonly cap: 'day_usd' | 'run_tokens',
    message: string,
  ) {
    super(message);
  }
}

export class RouterHttpError extends Error {
  override readonly name = 'RouterHttpError';
  constructor(
    readonly status: number,
    /** Truncated response body for diagnostics. */
    readonly body: string,
    message: string,
  ) {
    super(message);
  }
}

export class RouterTimeoutError extends Error {
  override readonly name = 'RouterTimeoutError';
  constructor(
    /** The mailbox request id whose response never arrived. */
    readonly requestId: string,
    readonly timeoutMs: number,
  ) {
    super(
      `llm-router: local_agent mailbox response for request '${requestId}' did not ` +
        `arrive within ${timeoutMs}ms. Is a hosting agent session fulfilling the mailbox?`,
    );
  }
}
