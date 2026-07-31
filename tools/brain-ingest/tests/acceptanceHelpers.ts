import type { AcceptanceAuthorization } from '../../llm-router/src/index.js';

export function testAcceptanceAuthorization(
  mutate?: (authorization: AcceptanceAuthorization) => void,
): AcceptanceAuthorization {
  const authorization: AcceptanceAuthorization = {
    version: 1,
    authorizationId: 'brain-test-authorization',
    authorizationBasis: 'Test-only finite provider ceilings; fixture USD values require no conversion.',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    providers: {
      anthropic: { maxPostStarts: 100, maxReservedUsd: 100, priorPostStarts: 0, priorReservedUsd: 0 },
      openai: { maxPostStarts: 100, maxReservedUsd: 100, priorPostStarts: 0, priorReservedUsd: 0 },
      agnes: { maxPostStarts: 100, maxReservedUsd: 0, priorPostStarts: 0, priorReservedUsd: 0 },
    },
  };
  mutate?.(authorization);
  return authorization;
}
