// A8 copy-gate word boundaries: the forbidden-term matcher must trip only on standalone
// diagnostic words (plus plain plurals), never on benign words that merely contain one —
// the pre-A8 substring matcher silently dropped cards for "stillness"/"conditioning" copy.
// Table vectors are kept in lockstep with the Dart side
// (apps/biotope/test/m5b_insight_engine/copy_gate_word_boundary_test.dart) — same strings,
// same expectations; the parity guard pins that both implementations build the identical regex.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COPY_RULES, validateCopyString } from '../../../shared/constants/copy_guidelines.ts';
import { renderCard } from '../../../supabase/functions/generate-insights/render.ts';

/** Benign copy that the pre-A8 substring matcher wrongly rejected (or would have). */
const TRUE_NEGATIVES = [
  'Try short stillness breaks after meals.',
  'Your conditioning routine looks steady.',
  'The air-conditioned room stayed cooler overnight.',
  'Mistreatment of outliers is avoided in this view.',
  'Preconditioning shows up in your data.',
];

/** Diagnostic copy that must still fail the gate — standalone words and plain plurals. */
const TRUE_POSITIVES = [
  'This may be an illness pattern.',
  'Your condition is improving.',
  'Consider treatment options.',
  'These conditions come and go.',
  'Recurring illnesses were reported.',
  'Two diseases share this signal.',
  'Several treatments exist.',
  'You were diagnosed last year.',
  'A treatment-plan was suggested.', // hyphen is a word boundary
  'Illness detected.', // case-insensitive
];

test('A8: benign containing words pass the copy gate', () => {
  for (const s of TRUE_NEGATIVES) {
    assert.equal(validateCopyString(s), true, `false positive — benign copy rejected: "${s}"`);
  }
});

test('A8: standalone diagnostic words (and plurals) still fail the copy gate', () => {
  for (const s of TRUE_POSITIVES) {
    assert.equal(validateCopyString(s), false, `false negative — diagnostic copy accepted: "${s}"`);
  }
});

test('A8: every forbidden term is lowercase \\w-only so \\b can anchor on it', () => {
  for (const term of COPY_RULES.FORBIDDEN_WORDS) {
    assert.match(term, /^[a-z0-9_]+$/, `forbidden term "${term}" is not \\w-only`);
  }
});

// The render-time gate consequence A8 describes: a card is dropped ONLY for real diagnostic
// words in its FINAL copy — benign containing words no longer ship nothing, silently.
test('A8: render-time drop fires only on real words, not benign fragments', () => {
  const benign = renderCard(
    { title: 'Fine title', body: 'Try short {{kind}} breaks after meals.' },
    { kind: 'stillness' },
  );
  assert.ok(benign.ok, JSON.stringify(benign));

  const diagnostic = renderCard(
    { title: 'Fine title', body: 'This may be an {{kind}} pattern.' },
    { kind: 'illness' },
  );
  assert.equal(diagnostic.ok, false);
  assert.deepEqual(!diagnostic.ok && diagnostic.failure, { reason: 'copy-gate', field: 'body' });
});
