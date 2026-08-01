// Server-only replacement-key resolution for Nao's Edge Function caller.
// Do not place secret-key resolution in this module: Nao needs only the publishable transport
// key plus its separate internal secret, never database-bypass authority.

export class PublishableKeyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishableKeyConfigurationError';
  }
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface ResolvePublishableKeyOptions {
  keyName?: string;
  allowLegacyLocalCli?: boolean;
  supabaseUrl?: string;
}

export function isStrictLocalSupabaseUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    url.port === '54321' &&
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '' || url.pathname === '/') &&
    url.search === '' &&
    url.hash === ''
  );
}

function validatePublishableKey(value: string, variable: string): string {
  const trimmed = value.trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new PublishableKeyConfigurationError(`${variable} must be an sb_publishable_ replacement key`);
  }
  return trimmed;
}

/**
 * `SUPABASE_PUBLISHABLE_KEYS` is authoritative when supplied by hosted Edge Functions.
 * Singular replacement form supports one-key runtimes. The legacy values are a clearly
 * labelled local-CLI fallback only; malformed named config never falls through to it.
 */
export function resolvePublishableKey(
  env: Record<string, string | undefined> = process.env,
  options: ResolvePublishableKeyOptions = {},
): { value: string; source: 'named' | 'singular' | 'legacy-local-cli' } {
  const keyName = options.keyName ?? 'default';
  if (env.SUPABASE_PUBLISHABLE_KEYS !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.SUPABASE_PUBLISHABLE_KEYS);
    } catch {
      throw new PublishableKeyConfigurationError('SUPABASE_PUBLISHABLE_KEYS must be a JSON object');
    }
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new PublishableKeyConfigurationError('SUPABASE_PUBLISHABLE_KEYS must be a JSON object');
    }
    const value = (parsed as Record<string, unknown>)[keyName];
    if (!nonBlank(value)) {
      throw new PublishableKeyConfigurationError(
        `SUPABASE_PUBLISHABLE_KEYS.${keyName} must be a non-empty string`,
      );
    }
    return {
      value: validatePublishableKey(value, `SUPABASE_PUBLISHABLE_KEYS.${keyName}`),
      source: 'named',
    };
  }
  if (env.SUPABASE_PUBLISHABLE_KEY !== undefined) {
    if (!nonBlank(env.SUPABASE_PUBLISHABLE_KEY)) {
      throw new PublishableKeyConfigurationError('SUPABASE_PUBLISHABLE_KEY must be a non-empty string');
    }
    return {
      value: validatePublishableKey(env.SUPABASE_PUBLISHABLE_KEY, 'SUPABASE_PUBLISHABLE_KEY'),
      source: 'singular',
    };
  }

  const legacy = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (nonBlank(legacy)) {
    if (!options.allowLegacyLocalCli || !isStrictLocalSupabaseUrl(options.supabaseUrl)) {
      throw new PublishableKeyConfigurationError(
        'legacy anon key is permitted only for the strict local Supabase CLI origin',
      );
    }
    return { value: legacy.trim(), source: 'legacy-local-cli' };
  }
  throw new PublishableKeyConfigurationError(
    'SUPABASE_PUBLISHABLE_KEYS (preferred) or SUPABASE_PUBLISHABLE_KEY is required; legacy anon key is local CLI fallback only',
  );
}
