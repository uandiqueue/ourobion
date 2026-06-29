/**
 * Offline tests for src/extract.ts — JATS body extraction + whitespace collapse.
 * No network, no PDF binaries: the JATS path runs against a tiny fixture XML.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { extractFromJats, collapseWhitespace } from '../src/extract.js';

const here = dirname(fileURLToPath(import.meta.url));
const jatsXml = readFileSync(join(here, 'fixtures', 'jats-sample.xml'), 'utf8');

test('collapseWhitespace collapses runs and trims', () => {
  assert.equal(collapseWhitespace('  a\n\n  b\t c  '), 'a b c');
  assert.equal(collapseWhitespace(''), '');
});

test('extractFromJats returns jats method with matching charCount', () => {
  const result = extractFromJats(jatsXml);
  assert.equal(result.method, 'jats');
  assert.equal(result.charCount, result.text.length);
  assert.ok(result.text.length > 0, 'expected non-empty body text');
});

test('extractFromJats pulls body prose', () => {
  const { text } = extractFromJats(jatsXml);
  assert.match(text, /gut microbiome shapes host immunity/i);
  assert.match(text, /Aedes aegypti/);
  assert.match(text, /Introduction/);
  assert.match(text, /Methods/);
});

test('extractFromJats resolves XML entities (&amp; -> &)', () => {
  const { text } = extractFromJats(jatsXml);
  assert.match(text, /sequenced & analysed/);
});

test('extractFromJats excludes front-matter abstract (only <body>)', () => {
  const { text } = extractFromJats(jatsXml);
  assert.doesNotMatch(text, /should NOT appear/i);
});

test('extractFromJats skips xref markers, formulae and table cells', () => {
  const { text } = extractFromJats(jatsXml);
  assert.doesNotMatch(text, /\[1\]/, 'xref citation marker should be skipped');
  assert.doesNotMatch(text, /E = mc/, 'tex-math/formula should be skipped');
  assert.doesNotMatch(text, /ignored cell/, 'table cell should be skipped');
});

test('extractFromJats whitespace is fully collapsed (no double spaces / newlines)', () => {
  const { text } = extractFromJats(jatsXml);
  assert.doesNotMatch(text, /\s{2,}/);
  assert.doesNotMatch(text, /[\n\t]/);
});

test('extractFromJats falls back to whole tree when no <body>', () => {
  const noBody = '<article><front><p>only front prose here</p></front></article>';
  const { text, method } = extractFromJats(noBody);
  assert.equal(method, 'jats');
  assert.match(text, /only front prose here/);
});
