#!/usr/bin/env node
// tools/secret_scan_guard.mjs
//
// O36 fail-closed secret-scanning + client-surface leak guard (Run 4 unit R4-U1).
//
// Node stdlib ONLY. ESM. Must run on Node 20. Zero third-party imports.
//
// Subcommands: verify-binary, policy, canary, history-canary, verify-report, client-surface,
// local-artifacts.
// See docs/... design (O36) for the full rationale; this file implements it. Every fail-closed
// path throws (or calls fail(), which throws) rather than returning a falsy value silently —
// an uncaught throw is what turns into the non-zero `node` exit code CI depends on.

import { readFileSync, existsSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Constants (design §D)
// ---------------------------------------------------------------------------------------------

export const SERVER_ONLY_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'OPENALEX_API_KEY',
  'GH_ACTIONS_TOKEN',
  'OUROBION_INTERNAL_SECRET',
  'NCBI_API_KEY',
  'S2_API_KEY',
  'CORE_API_KEY',
  'LENS_API_KEY',
  'GOOGLE_API_KEY',
  'INGEST_CONTACT_EMAIL',
];

export const APPROVED_NEXT_PUBLIC = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_ENV',
];

export const APPROVED_FLUTTER_PUBLIC = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'APP_ENV'];

// Rule ids known to originate from gitleaks' own default ruleset (v8.30.1), used only to
// sanity-check that an allowlist entry's ruleId isn't a typo that would silently suppress
// nothing while looking like coverage (ALLOW_RULE_UNKNOWN). Not exhaustive of gitleaks' ~170
// default rules by design — it only needs to cover rule ids this repo has actually observed,
// plus a modest set of very common ones for convenience. Rule ids declared in
// tools/secret-scan/gitleaks.toml's own [[rules]] blocks are unioned in at policy-check time.
export const KNOWN_DEFAULT_RULE_IDS = [
  'generic-api-key',
  'stripe-access-token',
  'curl-auth-header',
  'jwt',
  'aws-access-token',
  'aws-secret-access-key',
  'github-pat',
  'github-oauth',
  'gitlab-pat',
  'slack-access-token',
  'slack-bot-token',
  'slack-webhook-url',
  'google-api-key',
  'gcp-api-key',
  'private-key',
  'npm-access-token',
  'openai-api-key',
  'anthropic-api-key',
  'pypi-upload-token',
  'sendgrid-api-token',
  'twilio-api-key',
  'databricks-api-token',
  'digitalocean-pat',
  'dockerhub-pat',
  'grafana-api-key',
  'hashicorp-tf-api-token',
  'shopify-access-token',
  'square-access-token',
  'stripe-secret-key',
];

// Rule ids that MUST be declared in tools/secret-scan/gitleaks.toml's own [[rules]] blocks.
export const REQUIRED_RULE_IDS = ['ourobion-canary'];

export const ALLOWLIST_CAP = 16; // raised from the design's original 10 — see gitleaks.toml / C5
export const ALLOWLIST_MAX_LIFETIME_DAYS = 180;

const THIN_JUSTIFICATION_RE =
  /^(false[ -]?positive|fp|test|fixture|example|n\/?a|todo|wip|known|placeholder)\.?$/i;

// The inline allow-comment marker gitleaks itself recognises (see `--ignore-gitleaks-allow`
// below), assembled from fragments so this guard's own tracked source never contains it as one
// contiguous, greppable string — see the comment above the `policy()` bypass-channel checks for
// why that matters (a naive search for the spelled-out marker flags the file that searches for it).
export const ALLOW_COMMENT_MARKER = ['gitleaks', 'allow'].join(':');

// Assembled from fragments (never a single contiguous literal in this SOURCE file) — belt and
// braces alongside the complete-token detection in `policy()` below (see CANARY_TOKEN_COMMITTED):
// even though only a COMPLETE token (this prefix + 32 [A-Z0-9] chars) is treated as a committed
// fixture, keeping the bare prefix non-contiguous here means no tracked file, including this one,
// ever holds one recognisable copy-pasteable run of it.
export const CANARY_TOKEN_PREFIX = ['OUROBION', 'CANARY', 'SECRET'].join('_') + '_';
// A stripe-shaped synthetic literal, deliberately identical to the one already committed at
// model-training/tests/test_release.py:118 (this repo's own established "obviously fake"
// convention), chosen as the canary's default-rule proof value. MEASURED DEVIATION from the
// design doc's §D.5 assumption: the design proposed the canonical AWS example key
// `AKIAIOSFODNN7EXAMPLE` for this purpose. A real run of gitleaks 8.30.1 with
// `useDefault = true` shows that value does NOT fire any rule — gitleaks' own default global
// allowlist filters it (it is the literal, extremely well-known, "*EXAMPLE" AWS documentation
// key). The same measurement shows a sequential alphabet+digit run
// ("ABCDEFGHIJKLMNOPQRSTUVWXYZ123456") is filtered the same way, which is *also* why the
// canary's own random suffix below is generated character-by-character with crypto.randomInt
// rather than any deterministic/sequential scheme. This stripe-shaped literal was verified
// (locally, against the real pinned binary) to reliably trigger the default `stripe-access-token`
// rule with `useDefault = true`, so it is used here as the default-rule proof.
// Built from parts (never a single contiguous literal in this SOURCE file) so that this guard's
// own tracked source never itself contains a stripe-access-token-shaped token — measured: it did
// during development, tripping the real scanner on itself (fingerprint
// tools/secret_scan_guard.mjs:stripe-access-token:<line>). The runtime-assembled value written
// into the ephemeral canary fixture file is unaffected and still matches the rule as intended.
const CANARY_DEFAULT_RULE_FIXTURE = `stripe_key = "${['sk_live_', '0000fake', '0000fake'].join('')}"`;
const CANARY_DEFAULT_RULE_ID = 'stripe-access-token';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT_DEFAULT = process.cwd();

// ---------------------------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------------------------

export function fail(message) {
  throw new Error(`[secret-scan-guard] ${message}`);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Run `git <args>` with cwd=repoRoot. Throws on non-zero exit unless allowFailure. */
function git(args, repoRoot, { allowFailure = false } = {}) {
  const res = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (res.error) fail(`failed to spawn git ${args.join(' ')}: ${res.error.message}`);
  if (!allowFailure && res.status !== 0) {
    fail(`git ${args.join(' ')} exited ${res.status}: ${(res.stderr || '').trim()}`);
  }
  return res;
}

export function isTracked(repoRoot, relPath) {
  const res = git(['ls-files', '--error-unmatch', '--', relPath], repoRoot, { allowFailure: true });
  return res.status === 0 && res.stdout.trim().length > 0;
}

export function gitLsFiles(repoRoot) {
  const res = git(['ls-files'], repoRoot);
  return res.stdout.split(/\r?\n/).filter(Boolean);
}

function readTextIfExists(p) {
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

/** Recursively walk a directory, yielding absolute file paths. Skips nothing by default. */
function* walk(root) {
  if (!existsSync(root)) return;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }
}

/**
 * Given text and the index of a callee's opening '(' (i.e. text[openIdx] === '('), return the
 * substring of the balanced argument list (exclusive of the outer parens) plus the index just
 * past the matching ')'. Returns null if unbalanced (ran off the end of the string).
 */
function extractBalancedArgs(text, openIdx) {
  if (text[openIdx] !== '(') return null;
  let depth = 0;
  let inStr = null; // active quote char, or null
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') {
        i += 1; // skip escaped char
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return { args: text.slice(openIdx + 1, i), endIdx: i + 1 };
      }
    }
  }
  return null;
}

/** Find every call site of the given callee-name regex source (must NOT include the trailing
 * '(') and return [{ args, matchIndex, endIdx }] using balanced-paren extraction. */
function findCallSites(text, calleeSource, flags = 'g') {
  const re = new RegExp(calleeSource + '\\s*\\(', flags);
  const results = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const openIdx = m.index + m[0].length - 1; // position of the '('
    const extracted = extractBalancedArgs(text, openIdx);
    if (extracted) {
      results.push({ args: extracted.args, matchIndex: m.index, argsStartIdx: openIdx + 1, endIdx: extracted.endIdx });
      re.lastIndex = extracted.endIdx;
    } else {
      re.lastIndex = openIdx + 1;
    }
  }
  return results;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

// ---------------------------------------------------------------------------------------------
// verify-binary
// ---------------------------------------------------------------------------------------------

function normalizeVersion(v) {
  const trimmed = String(v).trim();
  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
}

/** Spawn `<binary> version`, normalise one optional leading "v" on both sides, compare. */
export function verifyBinary({ binary, expectVersion }) {
  if (!binary) fail('--binary is required');
  if (!expectVersion) fail('--expect-version is required');

  const res = spawnSync(binary, ['version'], { encoding: 'utf8' });
  if (res.error) fail(`failed to spawn "${binary} version": ${res.error.message}`);
  if (res.status !== 0) {
    fail(`"${binary} version" exited ${res.status}: ${(res.stderr || '').trim()}`);
  }
  const actual = (res.stdout || '').trim();
  if (!actual) fail(`"${binary} version" produced no output`);

  // MEASURED (real gitleaks 8.30.1 run): stdout is the bare "8.30.1", no leading "v". Design
  // item U-2 is therefore RESOLVED by measurement, not left as an assumption — but we still
  // normalise one optional leading "v" on both sides so a future gitleaks release that adds one
  // back does not spuriously fail this check.
  const normActual = normalizeVersion(actual);
  const normExpect = normalizeVersion(expectVersion);
  if (normActual !== normExpect) {
    fail(
      `gitleaks version mismatch: expected "${expectVersion}" (normalised "${normExpect}"), ` +
        `got "${actual}" (normalised "${normActual}")`
    );
  }
  process.stdout.write(`[secret-scan-guard] verify-binary OK: ${binary} version == ${actual}\n`);
  return { actual, normActual };
}

// ---------------------------------------------------------------------------------------------
// policy
// ---------------------------------------------------------------------------------------------

/** Extract every `id = "..."` declared inside a [[rules]] block of the raw TOML text. Text-level
 * only, per design's explicit "not semantic TOML validation" limitation (structural validity is
 * gitleaks' own job when it loads the config; #8 in the condition table). */
export function extractDeclaredRuleIds(configText) {
  const ids = new Set();
  const re = /^\s*id\s*=\s*"([^"]+)"\s*$/gm;
  let m;
  while ((m = re.exec(configText)) !== null) ids.add(m[1]);
  return ids;
}

/** Text-level policy assertions over the raw gitleaks.toml (design §B.1 #9, §C.5, §B.0). */
export function checkConfigPolicy(configText) {
  const violations = [];

  if (!/\[extend\]/.test(configText)) {
    violations.push({ id: 'POLICY_NO_EXTEND_BLOCK', detail: 'missing [extend] table' });
  }
  if (!/useDefault\s*=\s*true/.test(configText)) {
    violations.push({ id: 'POLICY_DEFAULT_RULESET_DISABLED', detail: 'useDefault must be true' });
  }

  const declaredIds = extractDeclaredRuleIds(configText);
  for (const required of REQUIRED_RULE_IDS) {
    if (!declaredIds.has(required)) {
      violations.push({ id: 'POLICY_REQUIRED_RULE_MISSING', detail: `rule id "${required}" not declared` });
    }
  }

  // §C.5 / §B.0: broad gitleaks-native suppression keys must never appear in our authored
  // config, anchored to line-start key assignments (not prose that happens to contain the word).
  const nativeAllowlistTableRe = /^\s*\[{1,2}[^\]\r\n]*\ballowlists?\b[^\]\r\n]*\]{1,2}\s*$/mi;
  const bannedKeyRe = /^\s*(allowlists?|paths|regexes|stopwords|regexTarget|commits)\s*=/m;
  if (nativeAllowlistTableRe.test(configText) || bannedKeyRe.test(configText)) {
    violations.push({ id: 'POLICY_BROAD_NATIVE_ALLOWLIST_KEY', detail: 'native allowlist table or suppression key present' });
  }

  return { violations, declaredIds };
}

/** Validate a single allowlist entry against design §C.2/§C.3. Returns an array of violation ids
 * (may be more than one per entry). `knownRuleIds` is the union of declared config rule ids and
 * KNOWN_DEFAULT_RULE_IDS. `today` is a "YYYY-MM-DD" string. `checkTracked` lets tests / dry runs
 * disable the git dependency when validating synthetic entries outside a repo. */
export function validateAllowlistEntry(entry, { repoRoot, knownRuleIds, today, checkTracked = true }) {
  const violations = [];

  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return ['ALLOW_ENTRY_NOT_OBJECT'];
  }

  const allowedKeys = new Set(['ruleId', 'path', 'fingerprint', 'justification', 'approvedBy', 'addedOn', 'expiresOn']);
  const nativeBroadKeys = ['paths', 'regexes', 'stopwords', 'regexTarget', 'commits', 'tags'];
  for (const key of nativeBroadKeys) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      violations.push('ALLOW_NATIVE_BROAD_FIELD');
      break;
    }
  }
  for (const key of Object.keys(entry)) {
    if (!allowedKeys.has(key) && !nativeBroadKeys.includes(key)) {
      violations.push('ALLOW_NATIVE_BROAD_FIELD');
      break;
    }
  }

  // ruleId
  const ruleId = entry.ruleId;
  if (ruleId === '*' || ruleId === '' || ruleId === null || ruleId === undefined || Array.isArray(ruleId)) {
    violations.push('ALLOW_RULE_WILDCARD');
  } else if (typeof ruleId !== 'string' || !knownRuleIds.has(ruleId)) {
    violations.push('ALLOW_RULE_UNKNOWN');
  }

  // path
  const p = entry.path;
  if (typeof p !== 'string' || p === '') {
    violations.push('ALLOW_PATH_NOT_TRACKED');
  } else {
    if (/[*?[\]{}]/.test(p) || p.endsWith('/') || p.includes('**')) {
      violations.push('ALLOW_BROAD_PATH_GLOB');
    }
    if (checkTracked && !isTracked(repoRoot, p)) {
      violations.push('ALLOW_PATH_NOT_TRACKED');
    }
  }

  // fingerprint
  const fp = entry.fingerprint;
  if (typeof fp !== 'string' || fp === '') {
    violations.push('ALLOW_FINGERPRINT_MISSING');
  } else {
    const parsed = parseFingerprint(fp);
    if (!parsed) {
      violations.push('ALLOW_FINGERPRINT_MISSING');
    } else if (typeof p === 'string' && typeof ruleId === 'string') {
      if (parsed.file !== p || parsed.ruleId !== ruleId) {
        violations.push('ALLOW_FINGERPRINT_MISMATCH');
      }
    }
  }

  // justification
  const j = entry.justification;
  if (typeof j !== 'string' || j.length < 40 || THIN_JUSTIFICATION_RE.test(j.trim())) {
    violations.push('ALLOW_JUSTIFICATION_THIN');
  }

  // approvedBy
  if (typeof entry.approvedBy !== 'string' || entry.approvedBy.trim() === '') {
    violations.push('ALLOW_NO_OWNER');
  }

  // dates
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const addedOn = entry.addedOn;
  const expiresOn = entry.expiresOn;
  if (typeof addedOn !== 'string' || !dateRe.test(addedOn) || typeof expiresOn !== 'string' || !dateRe.test(expiresOn)) {
    violations.push('ALLOW_BAD_DATE');
  } else {
    const added = Date.parse(`${addedOn}T00:00:00Z`);
    const expires = Date.parse(`${expiresOn}T00:00:00Z`);
    if (Number.isNaN(added) || Number.isNaN(expires) || expires <= added) {
      violations.push('ALLOW_BAD_DATE');
    } else {
      const maxExpires = added + ALLOWLIST_MAX_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
      if (expires > maxExpires) {
        violations.push('ALLOW_BAD_DATE');
      }
    }
    if (typeof expiresOn === 'string' && dateRe.test(expiresOn) && typeof today === 'string') {
      if (today > expiresOn) violations.push('ALLOW_EXPIRED');
    }
  }

  return violations;
}

/** Parse either fingerprint shape:
 *   dir-mode:  <file>:<ruleId>:<startLine>                    (>= 3 colon-separated parts)
 *   git-mode:  <commit>:<file>:<ruleId>:<startLine>            (>= 4 colon-separated parts,
 *                                                                first part is 40 hex chars)
 * Splits from the RIGHT for line/ruleId (the file component itself never contains a colon in
 * this repo, but splitting from the right is robust even if it did, provided the commit-hash
 * detection below is unambiguous). Returns null if fewer than 3 parts. */
export function parseFingerprint(fingerprint) {
  const parts = fingerprint.split(':');
  if (parts.length < 3) return null;
  const line = parts[parts.length - 1];
  const ruleId = parts[parts.length - 2];
  const rest = parts.slice(0, parts.length - 2);
  let commit = null;
  let file;
  if (rest.length >= 2 && /^[0-9a-f]{40}$/i.test(rest[0])) {
    commit = rest[0];
    file = rest.slice(1).join(':');
  } else {
    file = rest.join(':');
  }
  if (!file) return null;
  return { commit, file, ruleId, line };
}

function emitGitleaksIgnore(entries, emitPath) {
  const lines = entries.map((e) => e.fingerprint);
  mkdirSync(path.dirname(emitPath), { recursive: true });
  writeFileSync(emitPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  return lines.length;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function policy({ configPath, allowlistPath, emitIgnorePath, repoRoot = REPO_ROOT_DEFAULT, today = todayIso() }) {
  if (!configPath) fail('--config is required');
  if (!allowlistPath) fail('--allowlist is required');

  // Condition #8 territory is gitleaks' own job; we still need the raw text to policy-check it,
  // and a missing/unreadable file must fail closed here too (readFileSync throws for us).
  const configText = readFileSync(configPath, 'utf8');
  const { violations: configViolations, declaredIds } = checkConfigPolicy(configText);

  // Condition #10: allowlist.json is REQUIRED. No existsSync "skip if absent" branch.
  const allowlistRaw = readFileSync(allowlistPath, 'utf8');
  let allowlist;
  try {
    allowlist = JSON.parse(allowlistRaw);
  } catch (err) {
    fail(`allowlist.json is not valid JSON: ${err.message}`);
  }
  if (allowlist === null || typeof allowlist !== 'object' || Array.isArray(allowlist)) {
    fail('allowlist.json must be a JSON object with {version, entries}');
  }
  if (allowlist.version !== 1) {
    fail(`allowlist.json "version" must be exactly 1 (got ${JSON.stringify(allowlist.version)})`);
  }
  if (!Array.isArray(allowlist.entries)) {
    fail('allowlist.json "entries" must be an array');
  }

  const allViolations = [...configViolations.map((v) => `${v.id}: ${v.detail}`)];

  if (allowlist.entries.length > ALLOWLIST_CAP) {
    allViolations.push(`ALLOW_CAP_EXCEEDED: ${allowlist.entries.length} entries > cap of ${ALLOWLIST_CAP}`);
  }

  const knownRuleIds = new Set([...declaredIds, ...KNOWN_DEFAULT_RULE_IDS]);
  const seenFingerprints = new Map();
  allowlist.entries.forEach((entry, idx) => {
    const entryViolations = validateAllowlistEntry(entry, { repoRoot, knownRuleIds, today });
    for (const v of entryViolations) {
      allViolations.push(`${v}: entry[${idx}] (fingerprint=${JSON.stringify(entry && entry.fingerprint)})`);
    }
    if (entry && typeof entry.fingerprint === 'string') {
      if (seenFingerprints.has(entry.fingerprint)) {
        allViolations.push(`ALLOW_DUPLICATE: entry[${idx}] duplicates entry[${seenFingerprints.get(entry.fingerprint)}]`);
      } else {
        seenFingerprints.set(entry.fingerprint, idx);
      }
    }
  });

  // §B.1 #15 / §C.5 — bypass-channel closure, policy half. §B.1 #19 — canary token leak check.
  const tracked = gitLsFiles(repoRoot);
  for (const rel of tracked) {
    const base = path.basename(rel);
    const normalizedRel = rel.split(path.sep).join('/');
    if (base === '.gitleaksignore' || base === '.gitleaks.toml') {
      allViolations.push(`BYPASS_TRACKED_IGNORE_FILE: ${rel}`);
      continue;
    }
    if (base === 'gitleaks.toml' && !normalizedRel.startsWith('tools/secret-scan/')) {
      allViolations.push(`BYPASS_TRACKED_SECOND_CONFIG: ${rel}`);
    }
  }
  // Inline allow-comment marker / canary literal — content scan restricted to tracked files via
  // a fast git grep rather than reading and re-globbing 1100+ files ourselves.
  //
  // The marker itself is assembled from fragments rather than spelled out as one contiguous
  // literal — this guard's OWN tracked source (this file, and its test file) necessarily
  // mentions the marker it searches for, and a naive `git grep -F '<marker>'` would flag itself
  // (measured: it did, once these files were tracked instead of untracked during development).
  const grepAllow = git(['grep', '-l', '-I', '-F', ALLOW_COMMENT_MARKER], repoRoot, { allowFailure: true });
  if (grepAllow.status === 0 && grepAllow.stdout.trim()) {
    for (const rel of grepAllow.stdout.trim().split(/\r?\n/)) {
      allViolations.push(`BYPASS_GITLEAKS_ALLOW_COMMENT: ${rel}`);
    }
  }
  // CANARY_TOKEN_COMMITTED must detect a COMPLETE generated fixture token (prefix + exactly 32
  // [A-Z0-9] chars — see randomCanaryToken()), NOT a bare mention of the prefix. Matching the bare
  // prefix is a false positive baked into an earlier version of this check: it flagged
  // tools/secret-scan/gitleaks.toml, which MUST legitimately contain the prefix as part of the
  // canary rule's own regex declaration (`OUROBION_CANARY_SECRET_[A-Z0-9]{32}`) — that text is
  // the rule definition, not a leaked token, and the `[A-Z0-9]{32}` after it is regex syntax, not
  // 32 literal alnum characters. Using `-E` with an exact-length quantifier distinguishes the two.
  const canaryCompleteTokenPattern = `${escapeRegExp(CANARY_TOKEN_PREFIX)}[A-Z0-9]{32}`;
  const grepCanary = git(['grep', '-l', '-I', '-E', canaryCompleteTokenPattern], repoRoot, { allowFailure: true });
  if (grepCanary.status === 0 && grepCanary.stdout.trim()) {
    for (const rel of grepCanary.stdout.trim().split(/\r?\n/)) {
      allViolations.push(`CANARY_TOKEN_COMMITTED: ${rel}`);
    }
  }

  if (allViolations.length > 0) {
    fail(`policy violations:\n  - ${allViolations.join('\n  - ')}`);
  }

  let emittedCount = 0;
  if (emitIgnorePath) {
    emittedCount = emitGitleaksIgnore(allowlist.entries, emitIgnorePath);
  }

  process.stdout.write(
    `[secret-scan-guard] policy OK: config valid, ${allowlist.entries.length} allowlist entries valid` +
      (emitIgnorePath ? `, emitted ${emittedCount} fingerprint(s) to ${emitIgnorePath}\n` : '\n')
  );
  return { allowlist, emittedCount };
}

// ---------------------------------------------------------------------------------------------
// canary
// ---------------------------------------------------------------------------------------------

function randomCanaryToken() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  // Node-stdlib crypto (globalThis.crypto, available since Node 19+/20 without an import) —
  // fall back to Math.random only if unavailable, which should not happen on Node 20.
  const getRandomInt = (max) => {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  for (let i = 0; i < 32; i += 1) suffix += alphabet[getRandomInt(alphabet.length)];
  return CANARY_TOKEN_PREFIX + suffix;
}

export function canary({ binary, configPath, gitleaksIgnorePath, dir, reportPath }) {
  if (!binary) fail('--binary is required');
  if (!configPath) fail('--config is required');
  if (!dir) fail('--dir is required');
  if (!reportPath) fail('--report is required');

  mkdirSync(dir, { recursive: true });
  const token = randomCanaryToken();
  const fixtureText = `${token}\n${CANARY_DEFAULT_RULE_FIXTURE}\n`;
  writeFileSync(path.join(dir, 'canary-fixture.txt'), fixtureText, 'utf8');
  mkdirSync(path.dirname(reportPath), { recursive: true });

  const args = [
    'dir',
    dir,
    '--config',
    configPath,
    '--ignore-gitleaks-allow',
    '--redact=100', // measured: gitleaks 8.30.1's --redact is `uint[=100]`; the space form
                     // (`--redact 100`) parses as the flag PLUS a stray positional arg and
                     // gitleaks exits non-zero with "accepts at most 1 arg(s), received 2".
                     // The equals form is required everywhere in this file.
    '--no-banner',
    '--no-color',
    '--report-format',
    'json',
    '--report-path',
    reportPath,
    '--exit-code',
    '1',
    '--log-level',
    'info',
  ];
  if (gitleaksIgnorePath) {
    args.push('--gitleaks-ignore-path', gitleaksIgnorePath);
  }

  const res = spawnSync(binary, args, { encoding: 'utf8' });
  if (res.error) fail(`failed to spawn canary scan: ${res.error.message}`);

  // gitleaks exit-code contract (v8.30.1): 0 = no leaks, 1 = leaks found (or an error — but a
  // *canary* scan's whole point is to expect leaks, so 1 here is success), 126 = unknown flag.
  // Any other exit code, OR exit code 0 (meaning the canary was NOT detected), is a failure.
  if (res.status === 0) {
    fail('canary scan reported "no leaks found" — the scanner did not detect its own canary fixture; config or ruleset failed to load');
  }
  if (res.status !== 1) {
    fail(`canary scan exited ${res.status} (expected 1): ${(res.stderr || '').trim()}`);
  }

  const reportRaw = readFileSync(reportPath, 'utf8');
  let findings;
  try {
    findings = JSON.parse(reportRaw);
  } catch (err) {
    fail(`canary report is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(findings)) fail('canary report did not parse to an array');

  const ruleIds = new Set(findings.map((f) => f.RuleID));
  if (!ruleIds.has('ourobion-canary')) {
    fail(`canary scan did not report the "ourobion-canary" rule — custom config was not applied (rule ids seen: ${[...ruleIds].join(', ') || 'none'})`);
  }
  if (!ruleIds.has(CANARY_DEFAULT_RULE_ID)) {
    fail(`canary scan did not report a default-ruleset rule ("${CANARY_DEFAULT_RULE_ID}") — useDefault=true did not take effect (rule ids seen: ${[...ruleIds].join(', ') || 'none'})`);
  }

  process.stdout.write(
    `[secret-scan-guard] canary OK: both "ourobion-canary" and "${CANARY_DEFAULT_RULE_ID}" fired (${findings.length} finding(s) total)\n`
  );
  return { findings, ruleIds };
}

// ---------------------------------------------------------------------------------------------
// history-canary
// ---------------------------------------------------------------------------------------------

/**
 * Reachable-failure-path proof for the *history* scan specifically.
 *
 * The `canary` subcommand above proves `gitleaks dir` detects. It says nothing about `gitleaks
 * git`, and nothing about whether the `--log-opts` scoping the history step uses still reaches
 * commits whose content is absent from the working tree. Those are exactly the properties a
 * scoped history scan must keep, so they get their own proof rather than an assumption.
 *
 * Builds an ephemeral repo where the canary token exists ONLY in an ancestor commit (added, then
 * deleted in a later commit), then asserts both halves:
 *   1. `gitleaks dir` over the clean worktree finds nothing — the secret really is history-only.
 *   2. `gitleaks git --log-opts=<opts>` finds it anyway — scoped history traversal still detects.
 * If (2) ever stops holding, the history step is scanning nothing useful and this fails closed.
 */
export function historyCanary({ binary, configPath, gitleaksIgnorePath, dir, reportPath, logOpts = 'HEAD' }) {
  if (!binary) fail('--binary is required');
  if (!configPath) fail('--config is required');
  if (!dir) fail('--dir is required');
  if (!reportPath) fail('--report is required');

  mkdirSync(dir, { recursive: true });
  const run = (args) => git(args, dir);
  run(['init', '--quiet', '--initial-branch=main']);
  run(['config', 'user.email', 'history-canary@invalid']);
  run(['config', 'user.name', 'history canary']);
  run(['config', 'commit.gpgsign', 'false']);

  // An innocuous tracked file so the exported clean tree below is non-empty — a 0-finding scan
  // over an empty directory would be vacuously true and prove nothing.
  writeFileSync(path.join(dir, 'history-canary-readme.txt'), 'ephemeral history-canary fixture repo\n', 'utf8');
  run(['add', '--', 'history-canary-readme.txt']);
  run(['commit', '--quiet', '-m', 'history canary: baseline']);

  const token = randomCanaryToken();
  const fixture = path.join(dir, 'history-canary-fixture.txt');
  writeFileSync(fixture, `${token}\n${CANARY_DEFAULT_RULE_FIXTURE}\n`, 'utf8');
  run(['add', '--', 'history-canary-fixture.txt']);
  run(['commit', '--quiet', '-m', 'history canary: plant']);
  run(['rm', '--quiet', '--', 'history-canary-fixture.txt']);
  run(['commit', '--quiet', '-m', 'history canary: remove from worktree']);
  if (existsSync(fixture)) fail('history canary fixture is still present in the worktree');

  // Materialise the tracked tree at HEAD somewhere with no .git alongside it. Scanning `dir` on
  // the repo itself would walk .git and find the blob in the object store, which would say
  // nothing about whether the secret is still in the checked-out tree.
  const exportDir = `${dir}-clean`;
  mkdirSync(exportDir, { recursive: true });
  git(['checkout-index', '-a', '-f', `--prefix=${exportDir}${path.sep}`], dir);
  if (existsSync(path.join(exportDir, 'history-canary-fixture.txt'))) {
    fail('history canary fixture survived into the exported clean tree');
  }

  // Both scans below run with cwd set to an ephemeral directory, so every caller-supplied path
  // must be absolute first — a relative --config silently resolves against the wrong root and
  // gitleaks then exits 1 as an ERROR, which would otherwise read as "canary detected".
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const absConfig = path.resolve(configPath);
  const absReport = path.resolve(reportPath);
  if (!existsSync(absConfig)) fail(`history-canary config is not readable at ${absConfig}`);
  const baseArgs = [
    '--config', absConfig,
    '--ignore-gitleaks-allow',
    '--redact=100',
    '--no-banner',
    '--no-color',
    '--report-format', 'json',
    '--exit-code', '1',
    '--log-level', 'info',
  ];
  if (gitleaksIgnorePath) baseArgs.push('--gitleaks-ignore-path', path.resolve(gitleaksIgnorePath));

  const worktreeReport = `${absReport}.worktree.json`;
  const dirScan = spawnSync(binary, ['dir', '.', ...baseArgs, '--report-path', worktreeReport], { cwd: exportDir, encoding: 'utf8' });
  if (dirScan.error) fail(`failed to spawn history-canary clean-tree scan: ${dirScan.error.message}`);
  if (dirScan.status !== 0) {
    fail(`history-canary clean-tree scan exited ${dirScan.status} (expected 0) — the fixture is still reachable in the checked-out tree, so the history half proves nothing`);
  }

  const gitScan = spawnSync(binary, ['git', '.', `--log-opts=${logOpts}`, ...baseArgs, '--report-path', absReport], { cwd: dir, encoding: 'utf8' });
  if (gitScan.error) fail(`failed to spawn history-canary git scan: ${gitScan.error.message}`);
  if (gitScan.status === 0) {
    fail(`history-canary git scan (--log-opts=${logOpts}) reported "no leaks found" — scoped history scanning does NOT reach secrets that exist only in ancestry; the history step is fail-open`);
  }
  if (gitScan.status !== 1) {
    fail(`history-canary git scan exited ${gitScan.status} (expected 1): ${(gitScan.stderr || '').trim()}`);
  }

  let findings;
  try {
    findings = JSON.parse(readFileSync(absReport, 'utf8'));
  } catch (err) {
    fail(`history-canary report is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(findings) || findings.length === 0) fail('history-canary report did not parse to a non-empty array');
  const ruleIds = new Set(findings.map((f) => f.RuleID));
  if (!ruleIds.has('ourobion-canary')) {
    fail(`history-canary git scan did not report the "ourobion-canary" rule — custom config was not applied to git-mode scanning (rule ids seen: ${[...ruleIds].join(', ') || 'none'})`);
  }
  if (findings.some((f) => !f.Commit || !/^[0-9a-f]{40}$/i.test(f.Commit))) {
    fail('history-canary findings carry no commit provenance — the scan did not run in git mode');
  }

  process.stdout.write(
    `[secret-scan-guard] history-canary OK: exported clean tree scanned 0 findings, --log-opts=${logOpts} still detected ${findings.length} history-only finding(s)\n`
  );
  return { findings, ruleIds };
}

// ---------------------------------------------------------------------------------------------
// verify-report
// ---------------------------------------------------------------------------------------------

export function verifyReport({
  reportPath,
  scope,
  minFiles,
  minCommits,
  sentinelCommits = [],
  sentinels = [],
  repoRoot = REPO_ROOT_DEFAULT,
}) {
  if (!reportPath) fail('--report is required');
  if (scope !== 'worktree' && scope !== 'history') fail('--scope must be "worktree" or "history"');

  const raw = readFileSync(reportPath, 'utf8'); // throws if missing — condition #13
  if (raw.trim() === '') fail(`report at ${reportPath} is empty`);
  let findings;
  try {
    findings = JSON.parse(raw);
  } catch (err) {
    fail(`report at ${reportPath} did not parse as JSON: ${err.message}`);
  }
  if (!Array.isArray(findings)) fail(`report at ${reportPath} did not parse to an array`);
  if (findings.length !== 0) {
    const ids = findings.map((f) => f.Fingerprint || `${f.File}:${f.RuleID}:${f.StartLine}`);
    fail(`report at ${reportPath} contains ${findings.length} unexpected finding(s): ${ids.join(', ')}`);
  }

  if (scope === 'worktree') {
    const files = gitLsFiles(repoRoot);
    const min = minFiles ?? 500;
    if (files.length < min) {
      fail(`tracked file count ${files.length} is below --min-files ${min} — checkout looks degenerate`);
    }
    for (const sentinel of sentinels) {
      if (!isTracked(repoRoot, sentinel)) {
        fail(`sentinel path "${sentinel}" is not tracked`);
      }
      const abs = path.join(repoRoot, sentinel);
      if (!existsSync(abs)) {
        fail(`sentinel path "${sentinel}" is tracked but not present on disk at ${abs}`);
      }
      try {
        readFileSync(abs);
      } catch (err) {
        fail(`sentinel path "${sentinel}" is not readable: ${err.message}`);
      }
    }
  }

  // History scope: an empty report is only meaningful if the scan actually had history to walk.
  // The history step scans `--log-opts=HEAD`, i.e. the full ancestry of the landing ref rather
  // than every ref the runner happens to have fetched. That is deliberately narrower than
  // gitleaks' all-refs default (a finding on an unrelated sibling branch is that branch's CI to
  // fail, not this one's), and narrowing a scan is only safe if the remaining coverage is
  // *proven* rather than assumed. Without the assertions below, a shallow checkout, a detached
  // HEAD at the root commit, or a mistyped --log-opts would all produce `[]` and read as OK —
  // three fail-open paths. So history scope requires an explicit traversal floor and refuses to
  // accept a report whose ancestry cannot be shown to be deep and complete.
  if (scope === 'history') {
    if (!Number.isSafeInteger(minCommits) || minCommits < 1) {
      fail('--min-commits is required for --scope history and must be a positive integer');
    }
    const shallow = git(['rev-parse', '--is-shallow-repository'], repoRoot).stdout.trim();
    if (shallow !== 'false') {
      fail(`history scan ran against a shallow or indeterminate repository (--is-shallow-repository=${shallow || '<empty>'})`);
    }
    const count = Number(git(['rev-list', '--count', 'HEAD'], repoRoot).stdout.trim());
    if (!Number.isSafeInteger(count) || count < minCommits) {
      fail(`HEAD ancestry is ${count} commit(s), below --min-commits ${minCommits} — the history scan covered too little to be meaningful`);
    }
    const roots = git(['rev-list', '--max-parents=0', 'HEAD'], repoRoot).stdout.split(/\r?\n/).filter(Boolean);
    if (roots.length === 0) {
      fail('HEAD ancestry contains no root commit — history is truncated');
    }
    for (const sentinelCommit of sentinelCommits) {
      if (!/^[0-9a-f]{40}$/i.test(sentinelCommit)) {
        fail(`sentinel commit "${sentinelCommit}" is not a full 40-character SHA`);
      }
      if (git(['cat-file', '-t', sentinelCommit], repoRoot, { allowFailure: true }).stdout.trim() !== 'commit') {
        fail(`sentinel commit ${sentinelCommit} is unavailable or not a commit`);
      }
      if (git(['merge-base', '--is-ancestor', sentinelCommit, 'HEAD'], repoRoot, { allowFailure: true }).status !== 0) {
        fail(`sentinel commit ${sentinelCommit} is not an ancestor of HEAD — the scanned ref is not the expected history`);
      }
    }
    process.stdout.write(
      `[secret-scan-guard] verify-report OK (scope=history): 0 findings over ${count} commit(s) of HEAD ancestry ` +
        `(min ${minCommits}, ${roots.length} root commit(s), ${sentinelCommits.length} sentinel commit(s) confirmed as ancestors)\n`
    );
    return { findings, commits: count, roots: roots.length };
  }

  process.stdout.write(`[secret-scan-guard] verify-report OK (scope=${scope}): 0 findings\n`);
  return { findings };
}

// ---------------------------------------------------------------------------------------------
// client-surface (design §D)
// ---------------------------------------------------------------------------------------------

// NOTE: these builder functions deliberately use a plain, non-capturing `(?:'|")` for every
// quote position rather than a captured backreference (`(['"])...\1`). A regex fragment with
// numbered capture groups changes meaning when its `.source` is spliced into a *larger* regex
// that has capture groups of its own (the group numbers shift and a `\1` written against this
// fragment's own numbering can silently start referring to the wrong group). These fragments
// ARE spliced into larger regexes elsewhere in this file (see findTaintedIdentifiers), so they
// must be numbering-safe on their own. The trade-off — accepting a mismatched-quote pair like
// `env['NAME"]` — is a harmless over-match, not a missed detection.
function buildTsJsReferenceRegex(name) {
  const n = escapeRegExp(name);
  return new RegExp(
    `process\\.env\\.${n}\\b` +
      `|process\\.env\\[\\s*(?:'|")${n}(?:'|")\\s*\\]` +
      `|import\\.meta\\.env\\.${n}\\b` +
      `|Deno\\.env\\.get\\(\\s*(?:'|")${n}(?:'|")\\s*\\)` +
      `|\\benv\\.${n}\\b` +
      `|\\benv\\[\\s*(?:'|")${n}(?:'|")\\s*\\]`,
    'g'
  );
}

function buildDartReferenceRegex(name) {
  const n = escapeRegExp(name);
  return new RegExp(
    `String\\.fromEnvironment\\(\\s*(?:'|")${n}(?:'|")` +
      `|dotenv\\.env\\[\\s*(?:'|")${n}(?:'|")\\s*\\]` +
      `|dotenv\\.get\\(\\s*(?:'|")${n}(?:'|")` +
      `|Platform\\.environment\\[\\s*(?:'|")${n}(?:'|")\\s*\\]`,
    'g'
  );
}

/** Find every value-bearing reference (design §D.0) to `name` in `text` (TS/JS contexts). */
function findTsJsReferences(text, name) {
  const re = buildTsJsReferenceRegex(name);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ index: m.index, length: m[0].length, name });
  return out;
}

function findDartReferences(text, name) {
  const re = buildDartReferenceRegex(name);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ index: m.index, length: m[0].length, name });
  return out;
}

/** One-hop-local taint (design §D.3): identifiers initialised directly from a server-only
 * reference context are tainted, in addition to the reference expression itself. TS/JS only —
 * (i)/F-checks use findDartReferences/findTsJsReferences directly and don't need taint. */
// `const { SUPABASE_SERVICE_ROLE_KEY } = process.env` / `Deno.env.toObject()`, with or without an
// `: alias` rename. Destructuring is the idiomatic way to read env in TS and it binds the value to
// a local WITHOUT ever producing a `process.env.NAME` reference expression, so a taint pass that
// only understands `const X = process.env.NAME` misses it completely.
const ENV_DESTRUCTURE_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:process\.env|Deno\.env\.toObject\s*\(\s*\))/g;

function findTaintedIdentifiers(text) {
  const tainted = new Set();
  for (const name of SERVER_ONLY_NAMES) {
    const refRe = buildTsJsReferenceRegex(name);
    // const/let/var IDENT = <reference...>  — bind IDENT if a reference immediately follows a
    // simple assignment for that name anywhere in the declaration's initializer.
    const declRe = new RegExp(
      `(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*(?::[^=]+)?=\\s*[^;\\n]*?(?:${refRe.source})`,
      'g'
    );
    let m;
    while ((m = declRe.exec(text)) !== null) {
      tainted.add(m[1]);
    }
  }

  // Destructured server-only keys taint whatever local name they land in — the key itself, or the
  // alias when renamed (`{ SUPABASE_SERVICE_ROLE_KEY: k }` binds `k`, not the key).
  ENV_DESTRUCTURE_RE.lastIndex = 0;
  let d;
  while ((d = ENV_DESTRUCTURE_RE.exec(text)) !== null) {
    for (const part of d[1].split(',')) {
      const [rawKey, rawAlias] = part.split(':');
      const key = (rawKey ?? '').trim().replace(/^\.\.\./, '');
      if (!SERVER_ONLY_NAMES.includes(key)) continue;
      const alias = (rawAlias ?? '').trim().replace(/=.*$/, '').trim();
      tainted.add(alias || key);
    }
  }
  return tainted;
}

function textIsTainted(argText, tainted) {
  if (/(?:^|[([{,=:]\s*)process\.env\b(?!\s*[.[])/.test(argText) || /\bDeno\.env\.toObject\s*\(/.test(argText)) {
    return { tainted: true, reason: 'bare/bulk environment object' };
  }
  // Computed access with a non-literal key — `process.env[name]`, `Deno.env.get(name)`. The key
  // cannot be resolved statically, so it cannot be shown NOT to be a server-only name. A guard
  // that only matches quoted literals is trivially defeated by hoisting the name into a variable,
  // so unresolvable keys fail closed rather than being assumed safe.
  if (/\bprocess\.env\s*\[\s*(?!['"])/.test(argText) || /\bDeno\.env\.get\s*\(\s*(?!['"])/.test(argText)) {
    return { tainted: true, reason: 'computed environment access with a non-literal key' };
  }
  for (const name of SERVER_ONLY_NAMES) {
    if (buildTsJsReferenceRegex(name).test(argText)) return { tainted: true, reason: `direct reference to ${name}` };
  }
  for (const ident of tainted) {
    const identRe = new RegExp(`\\b${escapeRegExp(ident)}\\b`);
    if (identRe.test(argText)) return { tainted: true, reason: `tainted identifier "${ident}"` };
  }
  return { tainted: false };
}

const BULK_ENV_PATTERNS = [
  /\.\.\.process\.env\b/,
  /JSON\.stringify\(\s*process\.env\b/,
  /Object\.entries\(\s*process\.env\s*\)/,
  /Object\.assign\(\s*\{\s*\}\s*,\s*process\.env\s*\)/,
  /structuredClone\(\s*process\.env\s*\)/,
  /Deno\.env\.toObject\(\s*\)/,
];

function checkBulkEnv(text) {
  return BULK_ENV_PATTERNS.some((re) => re.test(text));
}

function relFrom(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/');
}

function isUnderAny(rel, dirs) {
  return dirs.some((d) => rel === d || rel.startsWith(d.endsWith('/') ? d : d + '/'));
}

/** F1/F2/F3 — Flutter/biotope. Returns a violations array. */
function checkBiotope(repoRoot, violations, surfaces) {
  const pubspecPath = path.join(repoRoot, 'apps/biotope/pubspec.yaml');
  const pubspecText = readTextIfExists(pubspecPath);
  if (pubspecText === null) {
    surfaces.push({ surface: 'apps/biotope/pubspec.yaml', status: 'REQUIRED_MISSING', reason: 'file not found' });
  } else {
    surfaces.push({ surface: 'apps/biotope/pubspec.yaml', status: 'SCANNED' });
    const assetsBlockMatch = pubspecText.match(/^\s*assets:\s*\n((?:^\s{2,}-.*\n?)+)/m);
    const assetLines = assetsBlockMatch ? assetsBlockMatch[1].split(/\r?\n/) : [];
    for (const line of assetLines) {
      const m = line.match(/^\s*-\s*(.+?)\s*$/);
      if (!m) continue;
      const entry = m[1];
      if (/^\.env/.test(entry) && entry !== '.env.public') {
        violations.push({ id: 'F1_ASSET_MANIFEST', detail: `pubspec.yaml flutter.assets contains "${entry}"` });
      }
    }
  }

  const libDir = path.join(repoRoot, 'apps/biotope/lib');
  if (!existsSync(libDir)) {
    surfaces.push({ surface: 'apps/biotope/lib/**', status: 'REQUIRED_MISSING', reason: 'directory not found' });
    return;
  }
  surfaces.push({ surface: 'apps/biotope/lib/**', status: 'SCANNED' });
  for (const file of walk(libDir)) {
    if (!file.endsWith('.dart')) continue;
    const text = readFileSync(file, 'utf8');
    const rel = relFrom(repoRoot, file);

    const loadMatches = [...text.matchAll(/dotenv\.load\(\s*fileName\s*:\s*(['"])([^'"]*)\1\s*\)/g)];
    for (const m of loadMatches) {
      if (m[2] !== '.env.public') {
        violations.push({ id: 'F2_DOTENV_SOURCE', detail: `${rel}: dotenv.load(fileName: '${m[2]}')` });
      }
    }

    for (const name of [...APPROVED_FLUTTER_PUBLIC, ...SERVER_ONLY_NAMES]) {
      const refs = findDartReferences(text, name);
      if (refs.length === 0) continue;
      if (!APPROVED_FLUTTER_PUBLIC.includes(name)) {
        for (const r of refs) {
          violations.push({ id: 'F3_DART_ENV_READ', detail: `${rel}:${lineNumberAt(text, r.index)}: reference to server-only "${name}"` });
        }
      }
    }
    // Also flag any Dart env-reference name that isn't in the approved set at all (covers
    // "any unapproved name" per the design, not just SERVER_ONLY_NAMES).
    const genericRefRe = /(?:String\.fromEnvironment\(\s*['"]([^'"]+)['"]|dotenv\.env\[\s*['"]([^'"]+)['"]\s*\]|dotenv\.get\(\s*['"]([^'"]+)['"]|Platform\.environment\[\s*['"]([^'"]+)['"]\s*\])/g;
    let gm;
    while ((gm = genericRefRe.exec(text)) !== null) {
      const name = gm[1] || gm[2] || gm[3] || gm[4];
      if (!APPROVED_FLUTTER_PUBLIC.includes(name)) {
        violations.push({ id: 'F3_DART_ENV_READ', detail: `${rel}:${lineNumberAt(text, gm.index)}: unapproved Dart env reference "${name}"` });
      }
    }
  }
}

/** F5/F6 — tracked-bundle + ignore-integrity. Requires git. */
function checkBundleIntegrity(repoRoot, violations, surfaces) {
  const tracked = gitLsFiles(repoRoot);
  const bundleRe = /(^|\/)(\.next|\.open-next|build|\.dart_tool|out)\//;
  const trackedBundlePaths = tracked.filter((p) => bundleRe.test(p));
  surfaces.push({ surface: 'git ls-files (build-output patterns)', status: 'SCANNED' });
  for (const p of trackedBundlePaths) {
    violations.push({ id: 'F5_TRACKED_BUNDLE', detail: `tracked build-output path: ${p}` });
  }

  const canonical = [
    { rel: 'apps/nao/.open-next/server-functions/default/.env', expectSubstr: '.open-next' },
    { rel: 'apps/nao/.next/foo.js', expectSubstr: '.next' },
    { rel: 'apps/biotope/build/x/.env.public', expectSubstr: 'build/' },
    { rel: 'apps/nao/.env', expectSubstr: '.env' },
  ];
  surfaces.push({ surface: 'git check-ignore (canonical representative paths)', status: 'SCANNED' });
  for (const { rel, expectSubstr } of canonical) {
    const res = git(['check-ignore', '-v', rel], repoRoot, { allowFailure: true });
    if (res.status !== 0 || !res.stdout.trim()) {
      violations.push({ id: 'F6_IGNORE_INTEGRITY', detail: `"${rel}" is not ignored (expected a rule matching "${expectSubstr}")` });
      continue;
    }
    if (!res.stdout.includes(expectSubstr)) {
      violations.push({ id: 'F6_IGNORE_INTEGRITY', detail: `"${rel}" ignored by unexpected rule: ${res.stdout.trim()}` });
    }
  }
}

/** F4 — nao client-surface transitive closure over relative imports from 'use client' roots. */
function findUseClientRoots(srcDir) {
  const roots = [];
  for (const file of walk(srcDir)) {
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    const firstNonBlank = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
    if (firstNonBlank && /^(['"])use client\1;?$/.test(firstNonBlank)) {
      roots.push(file);
    }
  }
  return roots;
}

function resolveRelativeImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function transitiveClosure(roots, aliasRoot) {
  const seen = new Set(roots);
  const queue = [...roots];
  const importRe = /(?:import|export)\s+(?:[\s\S]*?from\s+)?(['"])(\.[^'"]*|@\/[^'"]*)\1/g;
  while (queue.length) {
    const file = queue.shift();
    const text = readTextIfExists(file);
    if (text === null) continue;
    let m;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(text)) !== null) {
      const resolved = m[2].startsWith('@/')
        ? resolveRelativeImport(path.join(aliasRoot, '_alias.ts'), `./${m[2].slice(2)}`)
        : resolveRelativeImport(file, m[2]);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function checkNaoClientSurface(repoRoot, violations, surfaces) {
  const srcDir = path.join(repoRoot, 'apps/nao/src');
  if (!existsSync(srcDir)) {
    surfaces.push({ surface: 'apps/nao/src/**', status: 'REQUIRED_MISSING', reason: 'directory not found' });
    return;
  }
  const roots = findUseClientRoots(srcDir);
  surfaces.push({ surface: `apps/nao/src/** ('use client' closure, ${roots.length} root(s))`, status: 'SCANNED' });
  const closure = transitiveClosure(roots, srcDir);
  for (const file of closure) {
    const text = readTextIfExists(file);
    if (text === null) continue;
    const rel = relFrom(repoRoot, file);
    for (const name of SERVER_ONLY_NAMES) {
      for (const r of findTsJsReferences(text, name)) {
        violations.push({ id: 'F4_CLIENT_TS_ENV_READ', detail: `${rel}:${lineNumberAt(text, r.index)}: client-reachable reference to server-only "${name}"` });
      }
    }
  }
}

/** N1-N5 — NEXT_PUBLIC_* */
function checkNextPublic(repoRoot, violations, surfaces) {
  const naoDir = path.join(repoRoot, 'apps/nao');
  if (!existsSync(naoDir)) {
    surfaces.push({ surface: 'apps/nao/**', status: 'REQUIRED_MISSING', reason: 'directory not found' });
    return;
  }
  surfaces.push({ surface: 'apps/nao/** (NEXT_PUBLIC_* scan)', status: 'SCANNED' });

  const nextPublicNameRe = /NEXT_PUBLIC_[A-Z0-9_]+/g;
  const foundNames = new Set();
  const promotedSecretFindings = [];
  const secretRhsFindings = [];

  for (const file of walk(naoDir)) {
    if (/node_modules|\.next[\\/]|\.open-next[\\/]/.test(file)) continue;
    let text;
    text = readFileSync(file, 'utf8');
    const rel = relFrom(repoRoot, file);
    let m;
    nextPublicNameRe.lastIndex = 0;
    while ((m = nextPublicNameRe.exec(text)) !== null) {
      foundNames.add(m[0]);
      const remainder = m[0].slice('NEXT_PUBLIC_'.length);
      for (const serverName of SERVER_ONLY_NAMES) {
        if (remainder === serverName || remainder.includes(serverName)) {
          promotedSecretFindings.push(`${rel}:${lineNumberAt(text, m.index)}: "${m[0]}"`);
        }
      }
    }

    // N3: NEXT_PUBLIC_* left-hand side assigned/initialised from a SERVER_ONLY_NAMES reference.
    const assignRe = /(NEXT_PUBLIC_[A-Z0-9_]+)\s*[:=]\s*([^\n;,)]*)/g;
    while ((m = assignRe.exec(text)) !== null) {
      const rhs = m[2];
      for (const serverName of SERVER_ONLY_NAMES) {
        if (buildTsJsReferenceRegex(serverName).test(rhs) || new RegExp(`\\$\\{\\s*${serverName}\\s*\\}`).test(rhs)) {
          secretRhsFindings.push(`${rel}:${lineNumberAt(text, m.index)}: "${m[1]}" assigned from server-only "${serverName}"`);
        }
      }
    }
  }

  for (const f of promotedSecretFindings) violations.push({ id: 'N2_NO_PROMOTED_SECRET', detail: f });
  for (const f of secretRhsFindings) violations.push({ id: 'N3_NO_SECRET_RHS', detail: f });

  const approvedSet = new Set(APPROVED_NEXT_PUBLIC);
  const extra = [...foundNames].filter((n) => !approvedSet.has(n));
  const missing = APPROVED_NEXT_PUBLIC.filter((n) => !foundNames.has(n));
  for (const n of extra) violations.push({ id: 'N1_EXACT_SET', detail: `unapproved NEXT_PUBLIC_* name found: ${n}` });
  for (const n of missing) violations.push({ id: 'N1_EXACT_SET', detail: `approved NEXT_PUBLIC_* name missing from tree: ${n}` });

  // N4: apps/nao/.env.public.example
  const templatePath = path.join(naoDir, '.env.public.example');
  const templateText = readTextIfExists(templatePath);
  if (templateText === null) {
    surfaces.push({ surface: 'apps/nao/.env.public.example', status: 'REQUIRED_MISSING', reason: 'file not found' });
  } else {
    surfaces.push({ surface: 'apps/nao/.env.public.example', status: 'SCANNED' });
    const declared = new Set();
    for (const rawLine of templateText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      declared.add(line.slice(0, eq).trim());
    }
    for (const name of declared) {
      if (!APPROVED_NEXT_PUBLIC.includes(name)) {
        violations.push({ id: 'N4_PUBLIC_TEMPLATE_CLEAN', detail: `.env.public.example declares unapproved name "${name}"` });
      }
      if (SERVER_ONLY_NAMES.includes(name)) {
        violations.push({ id: 'N4_PUBLIC_TEMPLATE_CLEAN', detail: `.env.public.example declares server-only name "${name}"` });
      }
    }
    for (const name of APPROVED_NEXT_PUBLIC) {
      if (!declared.has(name)) {
        violations.push({ id: 'N4_PUBLIC_TEMPLATE_CLEAN', detail: `.env.public.example missing approved name "${name}"` });
      }
    }
  }

  // N5: apps/nao/scripts/gen-env.mjs direction check.
  const genEnvPath = path.join(naoDir, 'scripts/gen-env.mjs');
  const genEnvText = readTextIfExists(genEnvPath);
  if (genEnvText === null) {
    surfaces.push({ surface: 'apps/nao/scripts/gen-env.mjs', status: 'REQUIRED_MISSING', reason: 'file not found' });
  } else {
    surfaces.push({ surface: 'apps/nao/scripts/gen-env.mjs', status: 'SCANNED' });
    checkGenEnvDirection(genEnvText, violations);
  }
}

// N5_GENENV_DIRECTION is ADVISORY: brittle-by-design textual assertion over one known statement
// in a reserved file. See design §F.4 / task instructions — implemented, not silently dropped,
// but its failure is reported as advisory rather than a hard client-surface violation so a
// legitimate refactor of gen-env.mjs doesn't red the whole gate on a shape change alone. The
// message explicitly says so, per instructions.
export const N5_ADVISORY = true;

function findIdentifierBoundTo(text, targetCallSource) {
  const re = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*${targetCallSource}`);
  const m = re.exec(text);
  return m ? m[1] : null;
}

function checkGenEnvDirection(text, violations) {
  // Identifier bound to parseDotenv(p('.env')) — the SECRET parse, not '.env.public'. Quote
  // characters are matched independently (see the comment above buildTsJsReferenceRegex) since
  // this fragment gets spliced into findIdentifierBoundTo's own larger, capturing regex.
  const secretIdent = findIdentifierBoundTo(text, `parseDotenv\\(\\s*p\\(\\s*(?:'|")\\.env(?:'|")\\s*\\)\\s*\\)`);
  if (!secretIdent) {
    violations.push({
      id: 'N5_GENENV_DIRECTION',
      advisory: N5_ADVISORY,
      detail: 'generator contract shape changed — re-review (could not find the parseDotenv(p(\'.env\')) binding)',
    });
    return;
  }

  const writeCallRe = /writeFileSync\s*\(\s*p\(\s*(['"])\.env\.local\1\s*\)\s*,/g;
  const m = writeCallRe.exec(text);
  if (!m) {
    violations.push({
      id: 'N5_GENENV_DIRECTION',
      advisory: N5_ADVISORY,
      detail: "generator contract shape changed — re-review (could not find writeFileSync(p('.env.local'), ...))",
    });
    return;
  }
  // Back up to the 'writeFileSync' identifier's own opening paren for balanced extraction.
  const openIdx = text.indexOf('(', m.index);
  const extracted = extractBalancedArgs(text, openIdx);
  if (!extracted) {
    violations.push({
      id: 'N5_GENENV_DIRECTION',
      advisory: N5_ADVISORY,
      detail: 'generator contract shape changed — re-review (unbalanced writeFileSync(...) call)',
    });
    return;
  }
  const identRe = new RegExp(`\\b${escapeRegExp(secretIdent)}\\b`);
  if (identRe.test(extracted.args)) {
    violations.push({
      id: 'N5_GENENV_DIRECTION',
      advisory: N5_ADVISORY,
      detail: `writeFileSync(p('.env.local'), ...) mentions "${secretIdent}" (the server .env parse) — secret may cross into the client file`,
    });
  }
}

/** H1-H4 / L1-L4 — response/header/cookie/log/trace one-hop-local taint checks. */
const RESPONSE_CALLEES = [
  { id: 'H1_RESPONSE_BODY', pattern: 'NextResponse\\.json' },
  { id: 'H1_RESPONSE_BODY', pattern: 'Response\\.json' },
  { id: 'H1_RESPONSE_BODY', pattern: 'new\\s+Response' },
  { id: 'H1_RESPONSE_BODY', pattern: 'NextResponse\\.redirect' },
];
const HEADER_CALLEES = [
  { id: 'H2_HEADERS', pattern: 'headers\\.set' },
  { id: 'H2_HEADERS', pattern: 'res\\.setHeader' },
  { id: 'H2_HEADERS', pattern: 'new\\s+Headers' },
];
const COOKIE_CALLEES = [
  { id: 'H4_NO_COOKIE_TAINT', pattern: 'cookies\\(\\)\\.set' },
  { id: 'H4_NO_COOKIE_TAINT', pattern: '\\.cookies\\.set' },
];
const LOG_CALLEES = [
  { id: 'L1_LOG_CALL', pattern: 'console\\.(?:log|info|warn|error|debug|trace|dir)' },
  { id: 'L1_LOG_CALL', pattern: 'process\\.stdout\\.write' },
  { id: 'L1_LOG_CALL', pattern: 'process\\.stderr\\.write' },
  { id: 'L1_LOG_CALL', pattern: 'util\\.inspect' },
  { id: 'L1_LOG_CALL', pattern: 'logger\\.\\w+' },
  { id: 'L1_LOG_CALL', pattern: 'context\\.log' },
];
const THROW_CALLEES = [
  { id: 'L3_THROW_MESSAGE', pattern: 'new\\s+Error' },
  { id: 'L3_THROW_MESSAGE', pattern: 'new\\s+\\w*Error' },
];
const TRACE_CALLEES = [
  { id: 'L4_TRACE_CONTEXT', pattern: 'Sentry\\.(?:captureMessage|captureException|setContext|setExtra|setTag)' },
  { id: 'L4_TRACE_CONTEXT', pattern: 'span\\.setAttribute' },
  { id: 'L4_TRACE_CONTEXT', pattern: 'console\\.timeLog' },
];

function checkCalleeGroup(text, rel, tainted, calleeGroup, violations) {
  for (const { id, pattern } of calleeGroup) {
    for (const site of findCallSites(text, pattern)) {
      const { tainted: isTainted, reason } = textIsTainted(site.args, tainted);
      if (isTainted) {
        violations.push({ id, detail: `${rel}:${lineNumberAt(text, site.matchIndex)}: ${reason} inside call arguments` });
      }
    }
  }
}

function checkHeaderResponseAndLogSurfaces(repoRoot, violations, surfaces) {
  const hScopeDirs = ['apps/nao/src', 'supabase/functions'];
  const lScopeDirs = ['apps/nao/src', 'apps/nao/scripts', 'supabase/functions', 'tools'];

  const scannedFiles = new Set();
  for (const rel of hScopeDirs) {
    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs)) {
      surfaces.push({ surface: `${rel}/** (H1-H4)`, status: 'REQUIRED_MISSING', reason: 'directory not found' });
      continue;
    }
    surfaces.push({ surface: `${rel}/** (H1-H4)`, status: 'SCANNED' });
    for (const file of walk(abs)) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      scannedFiles.add(file);
      const text = readFileSync(file, 'utf8');
      const relPath = relFrom(repoRoot, file);
      const tainted = findTaintedIdentifiers(text);
      checkCalleeGroup(text, relPath, tainted, RESPONSE_CALLEES, violations);
      checkCalleeGroup(text, relPath, tainted, HEADER_CALLEES, violations);
      checkCalleeGroup(text, relPath, tainted, COOKIE_CALLEES, violations);
      // Header object literal "in a response init" (design §D.3, H2) — deliberately scoped to
      // a `headers:` key found *inside a response constructor's own argument list*
      // (RESPONSE_CALLEES: NextResponse.json/redirect, Response.json, new Response), NOT any
      // `headers:` object anywhere in the file. A bare whole-file scan would false-positive on
      // ordinary outbound server-to-server `fetch(url, { headers: { Authorization: ... } })`
      // calls that legitimately carry a server-only credential to another service (e.g.
      // apps/nao/src/app/(app)/api/loader/run-pipeline/route.ts relaying
      // SUPABASE_SERVICE_ROLE_KEY to the run-pipeline edge function) — that is normal
      // server-side credential use, not a client-surface leak, and is out of H2's scope.
      // NOTE: the alternatives MUST be wrapped in a non-capturing group before findCallSites
      // appends its own `\s*\(` suffix — `A|B\s*\(` binds `\s*\(` only to the last alternative
      // B, not to A too (regex alternation has lower precedence than concatenation). Measured:
      // without the group, `new Response(...)` call sites were silently never matched here.
      for (const site of findCallSites(text, `(?:${RESPONSE_CALLEES.map((c) => c.pattern).join('|')})`)) {
        const headersKeyRe = /headers\s*:\s*\{/g;
        let hm;
        while ((hm = headersKeyRe.exec(site.args)) !== null) {
          const absOpenIdx = site.argsStartIdx + hm.index + hm[0].length - 1; // '{' is the match's last char
          const extracted = extractBalancedArgsBrace(text, absOpenIdx);
          if (extracted) {
            const { tainted: isTainted, reason } = textIsTainted(extracted.args, tainted);
            if (isTainted) {
              violations.push({
                id: 'H2_HEADERS',
                detail: `${relPath}:${lineNumberAt(text, site.argsStartIdx + hm.index)}: ${reason} inside a response-init headers: object literal`,
              });
            }
          }
        }
      }
      if (checkBulkEnv(text)) {
        violations.push({ id: 'H3_NO_BULK_ENV', detail: `${relPath}: bulk env-dump pattern present` });
      }
    }
  }

  for (const rel of lScopeDirs) {
    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs)) {
      surfaces.push({ surface: `${rel}/** (L1-L4)`, status: 'REQUIRED_MISSING', reason: 'directory not found' });
      continue;
    }
    surfaces.push({ surface: `${rel}/** (L1-L4)`, status: 'SCANNED' });
    for (const file of walk(abs)) {
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(file)) continue;
      const relPath = relFrom(repoRoot, file);
      if (rel === 'tools') {
        // tools/**/tests/** excluded per design §D.4 (legitimate child-process env spreads in
        // per-package test harnesses, e.g. tools/edge-loader/tests/edge_loader_cli.test.ts).
        if (/\/tests\//.test('/' + relPath + '/')) continue;
        // ALSO excluded: this repo's *other* established test-file convention (inv-ci-infra §4B)
        // is a top-level `tools/<name>.test.mjs` sibling with no `tests/` subdirectory at all
        // (e.g. tools/run4_release_gate.test.mjs — and this guard's own
        // tools/secret_scan_guard.test.mjs). Such files legitimately contain fixture SOURCE
        // TEXT (as JS string literals) that names server-only reference contexts on purpose, to
        // prove the guard detects them — without this exclusion the guard would flag its own
        // test suite's fixture strings as if they were real production taint.
        if (/\.test\.(mjs|cjs|[jt]sx?)$/.test(relPath)) continue;
      }
      const text = readFileSync(file, 'utf8');
      const tainted = findTaintedIdentifiers(text);
      checkCalleeGroup(text, relPath, tainted, LOG_CALLEES, violations);
      checkCalleeGroup(text, relPath, tainted, THROW_CALLEES, violations);
      checkCalleeGroup(text, relPath, tainted, TRACE_CALLEES, violations);
      for (const { id, pattern } of LOG_CALLEES) {
        for (const site of findCallSites(text, pattern)) {
          if (checkBulkEnv(site.args)) {
            violations.push({ id: 'L2_BULK_ENV_LOG', detail: `${relPath}:${lineNumberAt(text, site.matchIndex)}: bulk env-dump pattern inside a log call` });
          }
        }
      }
    }
  }
}

function extractBalancedArgsBrace(text, openIdx) {
  if (text[openIdx] !== '{') return null;
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') i += 1;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { args: text.slice(openIdx + 1, i), endIdx: i + 1 };
    }
  }
  return null;
}

/** Non-throwing core: runs every F/N/H/L check and returns the full violation + surface list.
 * Exported separately from `clientSurface()` (the throwing CLI-facing wrapper) so tests can
 * assert on *which* violation id(s) a fixture produces without needing to parse a thrown
 * Error's message text. */
export function computeClientSurface({ repoRoot = REPO_ROOT_DEFAULT } = {}) {
  const violations = [];
  const surfaces = [];

  checkBiotope(repoRoot, violations, surfaces);
  checkBundleIntegrity(repoRoot, violations, surfaces);
  checkNaoClientSurface(repoRoot, violations, surfaces);
  checkNextPublic(repoRoot, violations, surfaces);
  checkHeaderResponseAndLogSurfaces(repoRoot, violations, surfaces);

  for (const s of surfaces) {
    if (s.status !== 'SCANNED') {
      violations.push({ id: 'SURFACE_MANIFEST_INVALID', detail: `surface "${s.surface}" has invalid status "${s.status}"` });
    }
  }

  return { violations, surfaces };
}

export function clientSurface({ repoRoot = REPO_ROOT_DEFAULT, surfaceReportPath }) {
  const { violations, surfaces } = computeClientSurface({ repoRoot });

  if (surfaceReportPath) {
    mkdirSync(path.dirname(surfaceReportPath), { recursive: true });
    writeFileSync(
      surfaceReportPath,
      JSON.stringify({ surfaces, violations, generatedAt: new Date().toISOString() }, null, 2) + '\n',
      'utf8'
    );
  }

  const hardViolations = violations.filter((v) => !v.advisory);
  const advisoryViolations = violations.filter((v) => v.advisory);

  if (advisoryViolations.length > 0) {
    process.stderr.write(
      `[secret-scan-guard] client-surface ADVISORY (non-fatal): \n  - ${advisoryViolations
        .map((v) => `${v.id}: ${v.detail}`)
        .join('\n  - ')}\n`
    );
  }

  if (hardViolations.length > 0) {
    fail(`client-surface violations:\n  - ${hardViolations.map((v) => `${v.id}: ${v.detail}`).join('\n  - ')}`);
  }

  process.stdout.write(
    `[secret-scan-guard] client-surface OK: ${surfaces.length} surface(s) checked, 0 hard violations` +
      (advisoryViolations.length ? `, ${advisoryViolations.length} advisory\n` : '\n')
  );
  return { violations, surfaces };
}

/** Inspect the actual Next client output produced by CI. This is local bundle evidence only. */
export function inspectClientBundle({ bundleDir, canary }) {
  if (!bundleDir || !canary) fail('inspect-client-bundle requires --dir and --canary');
  if (!existsSync(bundleDir) || !statSync(bundleDir).isDirectory()) fail(`client bundle directory is missing: ${bundleDir}`);
  let files = 0;
  for (const file of walk(bundleDir)) {
    files += 1;
    if (readFileSync(file).includes(Buffer.from(canary))) {
      fail(`synthetic server-only canary reached client bundle file ${path.relative(bundleDir, file)}`);
    }
  }
  if (files === 0) fail(`client bundle directory is empty: ${bundleDir}`);
  process.stdout.write(`[secret-scan-guard] client bundle inspection OK: ${files} local artifact(s), synthetic canary absent; no hosted/deployed proof claimed\n`);
  return { files };
}

// ---------------------------------------------------------------------------------------------
// local-artifacts (design §D.1 part 2/4 — local, opt-in, real; not wired into CI)
// ---------------------------------------------------------------------------------------------

const LOCAL_ARTIFACT_DIRS = ['apps/nao/.open-next', 'apps/nao/.next', 'apps/biotope/build', 'apps/biotope/.dart_tool'];

export function localArtifacts({ repoRoot = REPO_ROOT_DEFAULT }) {
  const findings = [];
  for (const relDir of LOCAL_ARTIFACT_DIRS) {
    const abs = path.join(repoRoot, relDir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      if (!/\.env(\.|$)/.test(path.basename(file))) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (SERVER_ONLY_NAMES.includes(key) && value !== '') {
          findings.push({ file: relFrom(repoRoot, file), key });
        }
      }
    }
  }
  if (findings.length > 0) {
    process.stdout.write(
      `[secret-scan-guard] local-artifacts: ${findings.length} server-only value(s) found in local build output ` +
        `(this is expected on a machine that has run a local build; not wired into CI — see design §D.1 part 2):\n` +
        findings.map((f) => `  - ${f.file}: ${f.key}`).join('\n') +
        '\n'
    );
  } else {
    process.stdout.write('[secret-scan-guard] local-artifacts: no local build-output directories found, or none contain server-only values.\n');
  }
  return { findings };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [], sentinel: [], 'sentinel-commit': [] };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (key === 'sentinel' || key === 'sentinel-commit') {
        args[key].push(next);
        i += 1;
      } else if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

export function runCli(argv) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);

  switch (command) {
    case 'verify-binary':
      return verifyBinary({ binary: args.binary, expectVersion: args['expect-version'] });
    case 'policy':
      return policy({
        configPath: args.config,
        allowlistPath: args.allowlist,
        emitIgnorePath: args['emit-ignore'],
        repoRoot: args['repo-root'] || REPO_ROOT_DEFAULT,
      });
    case 'canary':
      return canary({
        binary: args.binary,
        configPath: args.config,
        gitleaksIgnorePath: args['gitleaks-ignore-path'],
        dir: args.dir,
        reportPath: args.report,
      });
    case 'history-canary':
      return historyCanary({
        binary: args.binary,
        configPath: args.config,
        gitleaksIgnorePath: args['gitleaks-ignore-path'],
        dir: args.dir,
        reportPath: args.report,
        logOpts: args['log-opts'] || 'HEAD',
      });
    case 'verify-report':
      return verifyReport({
        reportPath: args.report,
        scope: args.scope,
        minFiles: args['min-files'] ? Number(args['min-files']) : undefined,
        minCommits: args['min-commits'] ? Number(args['min-commits']) : undefined,
        sentinelCommits: args['sentinel-commit'],
        sentinels: args.sentinel,
        repoRoot: args['repo-root'] || REPO_ROOT_DEFAULT,
      });
    case 'client-surface':
      return clientSurface({ repoRoot: args['repo-root'] || REPO_ROOT_DEFAULT, surfaceReportPath: args['surface-report'] });
    case 'local-artifacts':
      return localArtifacts({ repoRoot: args['repo-root'] || REPO_ROOT_DEFAULT });
    case 'inspect-client-bundle':
      return inspectClientBundle({ bundleDir: args.dir, canary: args.canary });
    default:
      fail(`unknown subcommand "${command}". Expected one of: verify-binary, policy, canary, history-canary, verify-report, client-surface, inspect-client-bundle, local-artifacts`);
  }
  return undefined;
}

const isDirectRun = (() => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  try {
    runCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  }
}
