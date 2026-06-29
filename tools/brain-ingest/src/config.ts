/**
 * Config loader (design §10.1).
 *
 * Reads `tools/brain-ingest/.env` with a tiny inline parser (no dotenv dep),
 * validates the REQUIRED keys (fails fast if any is missing), and marks
 * RECOMMENDED/OPTIONAL keys' presence as per-source enabled flags.
 *
 * Secrets come ONLY from `.env` — never inlined, never logged.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Config, SourceEnablement, SourceName } from './types.js';

/** Default `.env` path: `tools/brain-ingest/.env` (one level up from `src/`). */
function defaultEnvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '.env');
}

/**
 * Minimal `.env` parser: `KEY=VALUE` per line, `#` comments, blank lines, and
 * surrounding quotes stripped. No interpolation, no export, no multiline.
 */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key === '') continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Read + parse the `.env` file; merges over `process.env` (file wins). */
function readEnv(envPath: string): Record<string, string> {
  let fileVars: Record<string, string> = {};
  try {
    fileVars = parseEnv(readFileSync(envPath, 'utf8'));
  } catch {
    // Missing .env is tolerated here — validation below reports missing keys.
  }
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') merged[k] = v;
  }
  for (const [k, v] of Object.entries(fileVars)) merged[k] = v;
  return merged;
}

/** A var is "present" when it exists and is non-empty after trimming. */
function present(vars: Record<string, string>, key: string): string | undefined {
  const v = vars[key];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  // Reject the unfilled template placeholders for R2_ENDPOINT.
  if (trimmed === '' || trimmed.includes('<accountid>')) return undefined;
  return trimmed;
}

/** The env var names the loader validates (design §E env template). */
export const REQUIRED_VARS = [
  'INGEST_CONTACT_EMAIL',
  'OPENALEX_API_KEY',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

export const OPTIONAL_VARS = ['NCBI_API_KEY', 'S2_API_KEY', 'CORE_API_KEY', 'LENS_API_KEY'] as const;

/** Result of inspecting the env without throwing (powers `--check-config`). */
export interface ConfigInspection {
  ok: boolean;
  missingRequired: string[];
  /** keyless sources are always usable; keyed sources depend on key presence */
  enabled: SourceEnablement;
  /** sources enabled because they need no key */
  keyless: SourceName[];
  /** sources enabled because a key is present */
  keyed: SourceName[];
  /** sources disabled because their (optional) key is absent */
  disabled: SourceName[];
}

/** Sources that need no key and are always enabled (design §2). */
const KEYLESS_SOURCES: SourceName[] = [
  'crossref',
  'europepmc',
  'arxiv',
  'doaj',
  'biorxiv',
  'unpaywall',
  'pmc',
];

/**
 * Inspect the environment without throwing — used by `--check-config`.
 * Computes which sources are enabled (keyless / keyed) vs disabled (no key).
 */
export function inspectConfig(envPath: string = defaultEnvPath()): ConfigInspection {
  const vars = readEnv(envPath);

  const missingRequired = REQUIRED_VARS.filter((k) => present(vars, k) === undefined);

  const hasOpenalex = present(vars, 'OPENALEX_API_KEY') !== undefined;
  const hasNcbi = present(vars, 'NCBI_API_KEY') !== undefined;
  const hasS2 = present(vars, 'S2_API_KEY') !== undefined;
  const hasCore = present(vars, 'CORE_API_KEY') !== undefined;
  const hasLens = present(vars, 'LENS_API_KEY') !== undefined;

  const enabled: SourceEnablement = {
    crossref: true,
    pubmed: true, // works keyless (3 req/s); NCBI key only raises the rate
    europepmc: true,
    arxiv: true,
    doaj: true,
    biorxiv: true,
    unpaywall: true,
    pmc: true,
    openalex: hasOpenalex, // required, but reflect actual presence
    s2: hasS2,
    core: hasCore,
    lens: hasLens,
  };

  const keyless = [...KEYLESS_SOURCES, 'pubmed' as SourceName];
  const keyed: SourceName[] = [];
  const disabled: SourceName[] = [];

  if (hasOpenalex) keyed.push('openalex');
  else disabled.push('openalex');
  // pubmed: keyless-capable; the NCBI key only lifts its rate (not a gate)
  if (hasNcbi) keyed.push('pubmed');
  if (hasS2) keyed.push('s2');
  else disabled.push('s2');
  if (hasCore) keyed.push('core');
  else disabled.push('core');
  if (hasLens) keyed.push('lens');
  else disabled.push('lens');

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    enabled,
    keyless,
    keyed,
    disabled,
  };
}

/**
 * Load + validate config. Throws with a clear message listing every missing
 * REQUIRED key. Optional keys set per-source enabled flags rather than failing.
 */
export function loadConfig(envPath: string = defaultEnvPath()): Config {
  const vars = readEnv(envPath);
  const inspection = inspectConfig(envPath);

  if (!inspection.ok) {
    throw new Error(
      `brain-ingest config invalid — missing required env var(s): ${inspection.missingRequired.join(
        ', ',
      )}. Set them in tools/brain-ingest/.env (see .env.example).`,
    );
  }

  // Non-null assertions are safe: inspection.ok guarantees all required present.
  return {
    contactEmail: present(vars, 'INGEST_CONTACT_EMAIL')!,
    keys: {
      openalex: present(vars, 'OPENALEX_API_KEY')!,
      r2Endpoint: present(vars, 'R2_ENDPOINT')!,
      r2AccessKeyId: present(vars, 'R2_ACCESS_KEY_ID')!,
      r2SecretAccessKey: present(vars, 'R2_SECRET_ACCESS_KEY')!,
      r2Bucket: present(vars, 'R2_BUCKET')!,
      ncbi: present(vars, 'NCBI_API_KEY'),
      s2: present(vars, 'S2_API_KEY'),
      core: present(vars, 'CORE_API_KEY'),
      lens: present(vars, 'LENS_API_KEY'),
    },
    enabled: inspection.enabled,
  };
}

/** Human-readable enablement summary (for `--check-config` output). */
export function sourceEnablement(inspection: ConfigInspection): string {
  const lines: string[] = [];
  lines.push(`enabled (keyless): ${inspection.keyless.join(', ')}`);
  lines.push(`enabled (keyed):   ${inspection.keyed.length ? inspection.keyed.join(', ') : '(none)'}`);
  lines.push(
    `disabled (no key): ${inspection.disabled.length ? inspection.disabled.join(', ') : '(none)'}`,
  );
  return lines.join('\n');
}
