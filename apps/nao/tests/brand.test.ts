// ourobion nao — brand identity regression tests (issue #223, nao identity kit adoption).
//
// These tests are filesystem/source-text checks, not app checks: `src/app/layout.tsx` cannot be
// `import`ed under `node --test` because it pulls in `next/font/google`, which needs the Next
// build pipeline (see apps/nao/tests/redact.test.ts / claimsControl.test.ts for the same
// constraint on route files that use the `@/lib/...` TS path alias). So metadata claims below are
// asserted against layout.tsx's SOURCE TEXT, and asset claims are asserted against the real files
// on disk — no Next runtime, no network, no build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(__dirname, '..'); // apps/nao
const REPO_ROOT = path.resolve(NAO_ROOT, '..', '..');
const SRC_DIR = path.join(NAO_ROOT, 'src');
const PUBLIC_DIR = path.join(NAO_ROOT, 'public');
const KIT_DIR = path.join(REPO_ROOT, 'assets', 'ourobion-nao-logo');
const LAYOUT_PATH = path.join(SRC_DIR, 'app', 'layout.tsx');
const TOPBAR_PATH = path.join(SRC_DIR, 'components', 'TopBar.tsx');
const SHELL_CSS_PATH = path.join(SRC_DIR, 'app', 'shell.css');

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/** All files under `dir`, recursively, as absolute paths. */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

// ── 1. Bundled brand assets are byte-identical copies of the kit ───────────
//
// apps/nao/README.md's "Brand assets" section is explicit: these files are COPIED from
// assets/ourobion-nao-logo/ and must never be redrawn or hand-edited in place — if the kit
// changes, re-copy; don't patch the copy. A byte-for-byte (sha256) comparison is the only check
// that actually enforces that rule: a visually-identical hand-edit would still fail it.
const COPIED_PAIRS: Array<{ served: string; source: string }> = [
  { served: 'nao-mark-dark.svg', source: path.join('logo', 'svg', 'nao-mark-dark.svg') },
  { served: 'nao-mark-light.svg', source: path.join('logo', 'svg', 'nao-mark-light.svg') },
  { served: 'nao-lockup-dark.svg', source: path.join('logo', 'svg', 'nao-lockup-dark.svg') },
  { served: 'nao-lockup-light.svg', source: path.join('logo', 'svg', 'nao-lockup-light.svg') },
  { served: 'nao-favicon.svg', source: path.join('favicon', 'favicon.svg') },
  { served: 'nao-favicon-16.png', source: path.join('favicon', 'favicon-16.png') },
  { served: 'nao-favicon-32.png', source: path.join('favicon', 'favicon-32.png') },
  { served: 'nao-apple-touch-icon-180.png', source: path.join('favicon', 'apple-touch-icon-180.png') },
];

for (const { served, source } of COPIED_PAIRS) {
  test(`public/brand/${served} is a byte-identical copy of the kit file, not a hand-edit`, () => {
    const servedPath = path.join(PUBLIC_DIR, 'brand', served);
    const sourcePath = path.join(KIT_DIR, source);
    assert.equal(existsSync(servedPath), true, `served asset missing: ${servedPath}`);
    assert.equal(existsSync(sourcePath), true, `kit source missing: ${sourcePath} (fixture invalid — cannot compare)`);
    const servedDigest = sha256(servedPath);
    const sourceDigest = sha256(sourcePath);
    assert.equal(
      servedDigest,
      sourceDigest,
      `public/brand/${served} (sha256 ${servedDigest}) has DRIFTED from the kit's ` +
        `${source} (sha256 ${sourceDigest}). Per apps/nao/README.md, brand assets under ` +
        `public/brand/ are copies of assets/ourobion-nao-logo/ and must never be redrawn or ` +
        `hand-edited in place — if the mark needs to change, edit the kit and re-copy, don't ` +
        `patch this file.`,
    );
  });
}

// ── 2. Top bar uses one supplied mark, with one accessible name ────────────

function extractTopBarBrandButton(): string {
  const source = readFileSync(TOPBAR_PATH, 'utf8').replace(/\r\n/g, '\n');
  const match = source.match(/<button[\s\S]*?className="topbar__brand"[\s\S]*?<\/button>/);
  assert.notEqual(match, null, 'TopBar.tsx lost the topbar__brand button');
  return match![0];
}

test('top bar brand button uses only the supplied dark mark and its exact alt as the accessible name', () => {
  const button = extractTopBarBrandButton();
  assert.match(button, /src="\/brand\/nao-mark-dark\.svg"/);
  assert.match(button, /alt="ourobion nao — Overview"/);
  assert.equal((button.match(/<img\b/g) ?? []).length, 1, 'topbar brand button must contain exactly one image');
  assert.doesNotMatch(button, /aria-label=/, 'button aria-label would compete with the image alt');
  assert.doesNotMatch(button, /aria-hidden/, 'the image supplies the button accessible name and cannot be hidden');
  assert.doesNotMatch(button, /<span\b/, 'do not recreate the supplied wordmark with HTML spans');
  assert.doesNotMatch(button, />\s*(?:ourobion|nao)\s*</i, 'do not recreate the supplied wordmark as text');
});

test('top bar has no recreated wordmark selectors and keeps one nonshrinking 40x40 mark rule', () => {
  const component = readFileSync(TOPBAR_PATH, 'utf8');
  const css = readFileSync(SHELL_CSS_PATH, 'utf8').replace(/\r\n/g, '\n');
  for (const staleClass of ['topbar__lockup', 'topbar__word', 'topbar__sub']) {
    assert.equal(component.includes(staleClass), false, `${staleClass} markup returned to TopBar.tsx`);
    assert.equal(css.includes(`.${staleClass}`), false, `${staleClass} styling returned to shell.css`);
  }
  const rules = [...css.matchAll(/\.topbar__mark\s*\{([^}]*)\}/g)];
  assert.equal(rules.length, 1, 'shell.css must define exactly one topbar__mark rule');
  assert.match(rules[0][1], /\bwidth:\s*40px\s*;/);
  assert.match(rules[0][1], /\bheight:\s*40px\s*;/);
  assert.match(rules[0][1], /\bflex:\s*none\s*;/);
});

// ── 3. Favicon metadata (layout.tsx) resolves to real files ────────────────
//
// Extracted from layout.tsx's `metadata.icons` object, not imported — see file header.
function extractIconsBlock(): string {
  const source = readFileSync(LAYOUT_PATH, 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('icons: {');
  assert.notEqual(start, -1, 'layout.tsx lost its `icons:` metadata block entirely');
  const end = source.indexOf('\n};', start);
  assert.notEqual(end, -1, 'could not find the end of the `metadata` object after `icons:`');
  return source.slice(start, end);
}

test('layout.tsx metadata.icons: every referenced URL resolves to a file that exists under public/', () => {
  const block = extractIconsBlock();
  const urls = [...block.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(urls.length > 0, true, 'no icon `url:` entries found in the extracted metadata.icons block');
  for (const url of urls) {
    assert.match(url, /^\//, `icon url "${url}" is not root-relative — it will not resolve as a public/ asset`);
    const filePath = path.join(PUBLIC_DIR, url);
    assert.equal(
      existsSync(filePath),
      true,
      `layout.tsx's metadata.icons references "${url}", but no file exists at public${url}. ` +
        `Next 15 does not fall back to file-convention icons once metadata.icons is set (see ` +
        `layout.tsx's own comment), so a missing target here is a silent 404 favicon, not a build error.`,
    );
  }
});

test('layout.tsx metadata.icons: pins the two known-current URLs (favicon svg + apple touch icon png)', () => {
  const block = extractIconsBlock();
  const urls = [...block.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    urls,
    ['/brand/nao-apple-touch-icon-180.png', '/brand/nao-favicon.svg'],
    'the set of favicon URLs pinned in layout.tsx metadata.icons changed — update this test ' +
      'deliberately if that was an intended rebrand, not as a side effect of an unrelated edit',
  );
});

// ── 4. src/app/ contains no icon.* / apple-icon.* file-convention icons ────
//
// This is a deliberate decision, not an accident: Next 15's metadata resolver wires up
// file-convention icons (src/app/icon.* / apple-icon.*) ONLY when `metadata.icons` is unset
// entirely — any explicit `icons` entry (which layout.tsx has, see test 2 above) short-circuits
// file-convention discovery for the WHOLE icons object. A leftover icon.* file in src/app/ would
// therefore look load-bearing (it even builds its own route) while contributing nothing to the
// actual <head> — exactly how a stale pre-rebrand mark could survive undetected.
test('src/app/ (recursively) has no icon.* or apple-icon.* file-convention icon files', () => {
  const appDir = path.join(SRC_DIR, 'app');
  const offenders = listFilesRecursive(appDir).filter((f) => /^(apple-)?icon\./i.test(path.basename(f)));
  assert.deepEqual(
    offenders,
    [],
    `found file-convention icon file(s) under src/app/: ${JSON.stringify(offenders)}. ` +
      `These are dead weight, not redundancy: layout.tsx's explicit metadata.icons entirely ` +
      `overrides Next's file-convention icon discovery, so a file here would build and look ` +
      `load-bearing while contributing nothing to the emitted <head> — remove it, don't keep it ` +
      `"just in case".`,
  );
});

// ── 5. No stale generic-Ourobion brand references in nao source ────────────
//
// The pre-nao generic "ourobion-" mark/lockup files still physically exist in public/brand/
// (they were not deleted as part of this migration) — this test is about REFERENCES from
// src/, not file presence, so it starts with a sanity check that the premise is real: if the old
// files were ever deleted, an all-`.length===0` result below would be trivially true, so the test
// would stop proving anything, and this guard forces a human to notice that.
test('sanity: the pre-nao generic "ourobion-" brand files still exist in public/brand/ (fixture check)', () => {
  const legacy = listFilesRecursive(path.join(PUBLIC_DIR, 'brand')).filter((f) =>
    path.basename(f).startsWith('ourobion-'),
  );
  assert.equal(
    legacy.length > 0,
    true,
    'no "ourobion-*" files remain under public/brand/ — the "no stale references" test below ' +
      'would then be vacuous; if the old files were intentionally deleted, that test should be ' +
      'reworded (or dropped) instead of silently passing for the wrong reason',
  );
});

test('no file under apps/nao/src/ references the old generic "/brand/ourobion-" mark/lockup', () => {
  const offenders: string[] = [];
  for (const file of listFilesRecursive(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    if (text.includes('/brand/ourobion-')) offenders.push(path.relative(NAO_ROOT, file));
  }
  assert.deepEqual(
    offenders,
    [],
    `file(s) still reference the pre-nao generic brand mark ("/brand/ourobion-..."): ` +
      `${JSON.stringify(offenders)}. The nao identity adoption (#223) replaced these with the ` +
      `nao-* mark/lockup; a lingering reference means a UI surface is still rendering (or will ` +
      `404 on) the old brand.`,
  );
});

// ── 6. Every /brand/... URL referenced in src/ resolves to a real public/brand/ file ──
//
// The broadest, most durable check: written generically (scan + extract + verify) instead of a
// hardcoded list, so it also catches assets this file's author never enumerated — e.g. a typo'd
// or renamed path introduced later — at test time instead of as a browser 404.
const BRAND_URL_RE = /\/brand\/[A-Za-z0-9._-]+\.[A-Za-z0-9]+/g;

test('every /brand/... asset URL referenced anywhere in apps/nao/src/ resolves to an existing file', () => {
  const referencesByUrl = new Map<string, string[]>();
  for (const file of listFilesRecursive(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(BRAND_URL_RE)) {
      const url = match[0];
      const rel = path.relative(NAO_ROOT, file);
      const existing = referencesByUrl.get(url);
      if (existing) existing.push(rel);
      else referencesByUrl.set(url, [rel]);
    }
  }

  assert.equal(referencesByUrl.size > 0, true, 'no /brand/... references found under src/ at all — scan is broken');

  for (const [url, files] of referencesByUrl) {
    const filePath = path.join(PUBLIC_DIR, url);
    assert.equal(
      existsSync(filePath),
      true,
      `"${url}" is referenced in ${files.join(', ')} but no file exists at public${url} — this ` +
        `would 404 in the browser (a typo'd or renamed asset path caught at test time instead).`,
    );
  }
});
