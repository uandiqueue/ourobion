import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NAO_ROOT = path.resolve(HERE, '..');
const loginPage = readFileSync(path.join(NAO_ROOT, 'src', 'app', 'login', 'page.tsx'), 'utf8');
const explainer = readFileSync(
  path.join(NAO_ROOT, 'src', 'components', 'OurobionExplainer.tsx'),
  'utf8',
);
const globals = readFileSync(path.join(NAO_ROOT, 'src', 'app', 'globals.css'), 'utf8');

test('login inputs retain a visible keyboard focus indicator', () => {
  assert.doesNotMatch(loginPage, /outline:\s*['"]none['"]/, 'inline styles must not suppress focus');
  assert.equal(
    (loginPage.match(/className="nao-login-input"/g) ?? []).length,
    2,
    'both login inputs must use the focus-visible class',
  );
  assert.match(globals, /\.nao-login-input:focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  assert.match(globals, /\.nao-login-input:focus-visible\s*\{[^}]*outline-offset:\s*2px/s);
});

test('denied nao access is explained instead of rendering a pristine form', () => {
  assert.match(loginPage, /searchParams\.get\('denied'\)\s*===\s*'nao'/);
  assert.match(loginPage, /<p role="alert" style=\{styles\.notice\}>/);
  assert.match(
    loginPage.replace(/\s+/g, ' '),
    /This signed-in account does not currently have access to nao\. Ask a workspace administrator to confirm its membership\./,
  );
});

test('public explainer caption uses the AA text token', () => {
  assert.match(
    explainer,
    /ctaNote:\s*\{[^}]*color:\s*'var\(--text-secondary\)'/s,
    'the caption must not use the 3.91:1 muted token',
  );
});

test('public explainer has a compact mobile layout that keeps its CTA in the initial fold', () => {
  assert.match(explainer, /className="ourobion-explainer"/);
  assert.match(globals, /@media \(max-width:\s*30rem\)/);
  for (const selector of [
    'ourobion-explainer__intro',
    'ourobion-explainer__cards',
    'ourobion-explainer__card',
    'ourobion-explainer__flow-section',
    'ourobion-explainer__unlock',
  ]) {
    assert.match(explainer, new RegExp(`className="${selector}"`));
    assert.match(globals, new RegExp(`\\.${selector}\\s*\\{`));
  }
});
