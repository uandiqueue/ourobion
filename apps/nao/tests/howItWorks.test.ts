// ourobion nao — public explainer page tests (issue #260, source-conformance).
//
// Same idiom as authz.test.ts / productionBuildContract.test.ts: neither
// src/middleware.ts nor src/app/how-it-works/page.tsx can be imported under
// plain `node --test` (the `@/*` path alias is unresolvable and
// `next/server` / `next/headers` have no ESM `exports` entry plain Node can
// resolve), so both are read as text and their SHAPE is asserted instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(__dirname, '..');

const MIDDLEWARE_PATH = path.join(NAO_ROOT, 'src', 'middleware.ts');
const PAGE_PATH = path.join(NAO_ROOT, 'src', 'app', 'how-it-works', 'page.tsx');
const APP_GROUP_PAGE_PATH = path.join(NAO_ROOT, 'src', 'app', '(app)', 'page.tsx');

function readMiddleware(): string {
  return readFileSync(MIDDLEWARE_PATH, 'utf8');
}

function readPage(): string {
  return readFileSync(PAGE_PATH, 'utf8');
}

// Same convention as authz.test.ts: this file's own doc comments legitimately
// DISCUSS the forbidden shapes/vocabulary by name (e.g. explaining why the
// page must NOT have a client directive or a forced-dynamic export) — that
// prose is not executable code and must not trip a check meant for the code
// itself. Only the stripped (comment-free) source is scanned below.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ── 1. /how-it-works short-circuits before any config/session/role read ────
test('isPublicPath() allow-lists /how-it-works, and the short-circuit precedes every auth-gate read', () => {
  const content = readMiddleware();

  const isPublicPathStart = content.indexOf('function isPublicPath');
  const middlewareStart = content.indexOf('export async function middleware');
  assert.ok(isPublicPathStart !== -1, 'isPublicPath() not found');
  assert.ok(middlewareStart !== -1, 'middleware() not found');
  assert.ok(isPublicPathStart < middlewareStart, 'isPublicPath() must be declared before middleware()');

  const isPublicPathBody = content.slice(isPublicPathStart, middlewareStart);
  assert.match(
    isPublicPathBody,
    /pathname === '\/how-it-works' \|\| pathname\.startsWith\('\/how-it-works\/'\)/,
    'isPublicPath() must allow both /how-it-works and its child/trailing-slash form',
  );

  // Positional proof: within middleware()'s own body, the isPublicPath()
  // short-circuit must occur strictly BEFORE the first occurrence of each
  // auth-gate read that follows it. The redirectToLogin() function (declared
  // immediately after middleware()) bounds the slice so an import line above
  // middleware() (e.g. `import { verifyAccessToken } from '@/lib/auth'`)
  // cannot masquerade as "the read" and make this assertion vacuous.
  const middlewareEnd = content.indexOf('function redirectToLogin', middlewareStart);
  assert.ok(middlewareEnd !== -1, 'redirectToLogin() not found after middleware()');
  const middlewareBody = content.slice(middlewareStart, middlewareEnd);

  const shortCircuitIdx = middlewareBody.indexOf('isPublicPath(pathname)');
  const envReadIdx = middlewareBody.indexOf('process.env.NEXT_PUBLIC_SUPABASE_URL');
  const getSessionIdx = middlewareBody.indexOf('getSession');
  const verifyAccessTokenIdx = middlewareBody.indexOf('verifyAccessToken(');
  const rpcMatch = /rpc\(\s*['"]nao_role['"]\s*\)/.exec(middlewareBody);

  assert.ok(shortCircuitIdx !== -1, 'no isPublicPath(pathname) call in middleware()');
  assert.ok(envReadIdx !== -1, 'no env/config read in middleware()');
  assert.ok(getSessionIdx !== -1, 'no getSession() call in middleware()');
  assert.ok(verifyAccessTokenIdx !== -1, 'no verifyAccessToken(...) call in middleware()');
  assert.ok(rpcMatch, "no rpc('nao_role') call in middleware()");

  assert.ok(shortCircuitIdx < envReadIdx, 'isPublicPath must precede the env/config read');
  assert.ok(shortCircuitIdx < getSessionIdx, 'isPublicPath must precede getSession()');
  assert.ok(shortCircuitIdx < verifyAccessTokenIdx, 'isPublicPath must precede verifyAccessToken()');
  assert.ok(shortCircuitIdx < (rpcMatch.index ?? -1), "isPublicPath must precede rpc('nao_role')");
});

// ── 2. The protected surfaces stay gated; nothing else in middleware.ts changed ──
test('middleware still gates every protected surface, and config.matcher is unchanged', () => {
  const content = readMiddleware();

  const isPublicPathStart = content.indexOf('function isPublicPath');
  const middlewareStart = content.indexOf('export async function middleware');
  const isPublicPathBody = content.slice(isPublicPathStart, middlewareStart);

  for (const protectedPath of ['/papers', '/ingest', '/loader', '/claims', '/models', '/api']) {
    assert.doesNotMatch(
      isPublicPathBody,
      new RegExp(protectedPath.replace('/', '\\/')),
      `isPublicPath() must not allow-list ${protectedPath}`,
    );
  }

  // The RPC role check, the edge signature verification, and the denied=nao
  // redirect must all still be present and wired exactly as before.
  assert.match(content, /supabase\.rpc\(\s*['"]nao_role['"]\s*\)/, "nao_role RPC call must remain");
  assert.match(content, /verifyAccessToken\(/, 'verifyAccessToken call must remain');
  assert.match(
    content,
    /redirectToLogin\(req,\s*'nao'\)/,
    "the denied='nao' redirect call site must remain",
  );
  assert.match(
    content,
    /searchParams\.set\('denied',\s*denied\)/,
    "the denied=nao query param must still be constructed",
  );

  // config.matcher must be byte-identical to its pre-change literal — this
  // change adds an in-handler allowance only, never touches the matcher.
  const matcherMatch = /matcher:\s*\[([^\]]*)\]/.exec(content);
  assert.ok(matcherMatch, 'config.matcher not found');
  assert.equal(
    matcherMatch[1],
    "'/((?!_next/static|_next/image|favicon.ico|.*\\\\..*).*)'",
    'config.matcher must be unchanged',
  );
});

// ── Forbidden imports the public page must never carry ──────────────────────
const FORBIDDEN_SPECIFIERS: readonly string[] = [
  '@/lib/d1',
  '@/lib/r2',
  '@/lib/supabase',
  '@/lib/supabase-server',
  '@/lib/authz',
  '@/lib/authzServer',
  '@/lib/auth',
  '@/lib/controlAudit',
  '@/lib/serverKey',
  '@/lib/githubDispatch',
  '@opennextjs/cloudflare',
  'next/headers',
  '@supabase/ssr',
];

// ── 3. The page itself: no client directive, no privileged import ──────────
test('how-it-works/page.tsx has no "use client" and imports none of the forbidden privileged modules', () => {
  const content = stripComments(readPage());

  assert.doesNotMatch(content, /^\s*['"]use client['"]/m, 'the page must be a Server Component');
  assert.doesNotMatch(content, /dynamic\s*=\s*['"]force-dynamic['"]/, 'the page must be static');

  for (const specifier of FORBIDDEN_SPECIFIERS) {
    const re = new RegExp(`from\\s+['"]${specifier.replace(/[/@-]/g, '\\$&')}['"]`);
    assert.doesNotMatch(content, re, `must not import ${specifier}`);
  }

  // Prefer zero @/lib/ imports outright, rather than allow-listing individual
  // ones — the page has no legitimate reason to reach into src/lib at all.
  assert.doesNotMatch(content, /from\s+['"]@\/lib\//, 'the page must not import anything from @/lib/');
});

// ── 4. Approved copy is present verbatim, including the /login CTA ─────────
const APPROVED_STRINGS: readonly string[] = [
  'OUROBION',
  'How Ourobion works',
  'Ourobion connects a personal reflection app with an expert workspace for preparing research context.',
  'BIOTOPE',
  'A personal app for recording daily observations and revisiting patterns over time.',
  'NAO',
  'A workspace for authorized team members to inspect and prepare research context.',
  'THE BOUNDARY',
  'Biotope and nao do not call each other directly.',
  "Personal entries stay in Biotope's account-bound experience; nao is not a personal-records dashboard.",
  'SYNTHESIS',
  'INDEPENDENT VERIFICATION',
  'PUBLICATION',
  'Signing in gives authorized workspace members access to the review tools for research context.',
  'Sign in to nao',
  'For authorized workspace members.',
];

// JSX text nodes may be wrapped across source lines for readability (the
// same way a browser/React collapses interior whitespace when rendering
// text content) — so this check normalises runs of whitespace to a single
// space on both sides before comparing, rather than requiring the approved
// copy to sit unwrapped on one physical source line.
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

test('how-it-works/page.tsx contains every approved copy string verbatim', () => {
  const content = normalizeWhitespace(readPage());
  for (const approved of APPROVED_STRINGS) {
    assert.ok(
      content.includes(normalizeWhitespace(approved)),
      `missing approved copy: "${approved}"`,
    );
  }
});

test('how-it-works/page.tsx CTA links to /login', () => {
  const content = readPage();
  assert.match(content, /href="\/login"/, 'the "Sign in to nao" CTA must link to /login');
});

// ── 5. No metric claims / disallowed vocabulary in the page's own copy ─────
//
// Scanned against the COPY region only (everything above the trailing
// `const styles: Record<string, CSSProperties> = { ... }` block, same
// idiom login/page.tsx uses for its own styles object) — CSS values like
// `width: '100%'` are presentation, not a metric claim about nao's coverage,
// and word-boundary matching keeps "count" from false-hitting "account"
// inside the approved boundary copy.
const FORBIDDEN_WORDS: readonly string[] = [
  'papers',
  'studies',
  'corpus',
  'count',
  'provider',
  'secret',
  'token',
  'role',
  'encrypt',
];

test("how-it-works/page.tsx copy has no digit-bearing metric claim (%) or disallowed vocabulary", () => {
  const content = stripComments(readPage());
  const stylesStart = content.indexOf('const styles: Record<string, CSSProperties>');
  assert.ok(stylesStart !== -1, 'expected a trailing styles object (login/page.tsx convention)');
  const copy = content.slice(0, stylesStart);

  assert.ok(!copy.includes('%'), 'the page copy must not contain a percentage claim');
  for (const word of FORBIDDEN_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    assert.doesNotMatch(copy, re, `the page copy must not mention "${word}"`);
  }
});

// ── 6. The page lives outside (app), and / was NOT made public ─────────────
test('how-it-works/page.tsx lives outside the (app) route group, and / is still gated behind D1', () => {
  const relative = path.relative(NAO_ROOT, PAGE_PATH).split(path.sep).join('/');
  assert.equal(relative, 'src/app/how-it-works/page.tsx');
  assert.ok(!relative.includes('(app)'), 'the public page must not live inside the (app) route group');

  const rootPageContent = readFileSync(APP_GROUP_PAGE_PATH, 'utf8');
  assert.match(
    rootPageContent,
    /from ['"]@\/lib\/d1['"]/,
    '/ (src/app/(app)/page.tsx) must still import @/lib/d1 — it must remain gated, not made public',
  );
});
