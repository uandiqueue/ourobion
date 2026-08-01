// #300 §E · approve-with-caveat — the honesty properties of `verify/caveat.ts`.
//
// What these units defend, in the order the file's own contract states them:
//   1. a caveat names a limitation that ACTUALLY FIRED (never one that did not);
//   2. nothing fired ⇒ null (never a reassuring sentence);
//   3. the model's words are preferred only when they name a fired limitation, pass the copy gate
//      and stay bounded — otherwise the derived sentence wins;
//   4. quality-of-backing flags stay silent when there is no backing to describe.
//
// The derived sentences are checked against the REAL shared copy gate, not a stub: they are card
// copy, so a reworded sentence that drifts into diagnostic language must fail here rather than at
// artifact-append time, where it would sink a whole verdict.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  caveatSentence,
  chooseCaveat,
  composeCaveat,
  corroboratesAFiredFlag,
  firedCaveatFlags,
  CAVEAT_SEVERITY_ORDER,
  MAX_CAVEAT_SENTENCES,
  MAX_MODEL_CAVEAT_CHARS,
  loadCopyValidator,
  type CaveatFlag,
  type CaveatInput,
} from '../src/verify/verifier.js';

/** A well-corroborated, well-matched record: nothing to caveat. */
function clean(over: Partial<CaveatInput> = {}): CaveatInput {
  return {
    retrievalPerformed: true,
    sourceCount: 3,
    supporting: 2,
    contradicting: 0,
    evidenceTier: 4,
    scopeMismatch: false,
    claimKindMatches: true,
    claimedKind: 'correlational',
    supportedKind: 'correlational',
    directionMatches: true,
    effectSizeMatches: true,
    confidence: 0.8,
    ...over,
  };
}

// ── (2) nothing fired ⇒ null ────────────────────────────────────────────────────────────────────

test('caveat: a well-grounded record fires no flag and gets NO caveat (silence beats reassurance)', () => {
  assert.deepEqual(firedCaveatFlags(clean()), []);
  const choice = chooseCaveat(clean(), null);
  assert.equal(choice.caveat, null);
  assert.equal(choice.source, 'none');
});

test('caveat: composeCaveat of no flags is null, never an empty or filler string', () => {
  assert.equal(composeCaveat([], clean()), null);
});

// ── (1) every fired flag is a real read of the record ───────────────────────────────────────────

test('caveat: the live-run shape (retrieval performed, ZERO sources) names exactly that', () => {
  // This is the defect's own record: independentRetrieval {performed: true, sources: []}.
  const flags = firedCaveatFlags(clean({ sourceCount: 0, supporting: 0 }));
  assert.deepEqual(flags, ['no-sources-retrieved']);
  assert.equal(
    composeCaveat(flags, clean({ sourceCount: 0, supporting: 0 })),
    'No other studies were found to check this against.',
  );
});

test('caveat: retrieval never performed is distinguished from retrieval that found nothing', () => {
  assert.deepEqual(
    firedCaveatFlags(clean({ retrievalPerformed: false, sourceCount: 0, supporting: 0 })),
    ['not-checked-independently'],
  );
});

test('caveat: sources retrieved but none supporting is its own, distinct statement', () => {
  assert.deepEqual(firedCaveatFlags(clean({ sourceCount: 3, supporting: 0 })), ['no-supporting-source']);
});

test('caveat: thin corroboration (exactly one supporting source) fires the single-source flag', () => {
  assert.deepEqual(firedCaveatFlags(clean({ supporting: 1 })), ['single-supporting-source']);
});

test('caveat: two or more supporting sources fire NO corroboration flag', () => {
  assert.deepEqual(firedCaveatFlags(clean({ supporting: 2 })), []);
});

test('caveat: disagreement is surfaced even alongside support', () => {
  const flags = firedCaveatFlags(clean({ supporting: 2, contradicting: 1 }));
  assert.deepEqual(flags, ['contradicting-source']);
});

test('caveat: a causal claim supported only correlationally says so in plain words', () => {
  const input = clean({ claimKindMatches: false, claimedKind: 'causal', supportedKind: 'correlational' });
  assert.ok(firedCaveatFlags(input).includes('claim-kind-mismatch'));
  assert.equal(caveatSentence('claim-kind-mismatch', input), 'The evidence shows a link, not a proven cause.');
});

test('caveat: population mismatch, weak design, direction and effect size each fire on their own field', () => {
  assert.ok(firedCaveatFlags(clean({ scopeMismatch: true })).includes('population-mismatch'));
  assert.ok(firedCaveatFlags(clean({ evidenceTier: 1 })).includes('mechanistic-evidence'));
  assert.ok(firedCaveatFlags(clean({ evidenceTier: 2 })).includes('observational-evidence'));
  assert.ok(firedCaveatFlags(clean({ directionMatches: false })).includes('direction-unconfirmed'));
  assert.ok(firedCaveatFlags(clean({ effectSizeMatches: false })).includes('effect-size-unconfirmed'));
  assert.ok(firedCaveatFlags(clean({ confidence: 0.2 })).includes('low-confidence'));
});

// ── (4) quality-of-backing flags need backing ───────────────────────────────────────────────────

test('caveat: with ZERO supporting sources, no claim is made ABOUT the backing', () => {
  // Every quality-of-backing field is set to its worst value, but there is no backing to describe:
  // the honest statement is the absence, and asserting "the backing is weak" would invent one.
  const flags = firedCaveatFlags(
    clean({
      sourceCount: 0,
      supporting: 0,
      evidenceTier: 1,
      scopeMismatch: true,
      claimKindMatches: false,
      directionMatches: false,
      effectSizeMatches: false,
    }),
  );
  assert.deepEqual(flags, ['no-sources-retrieved']);
});

// ── severity ordering + the sentence cap ────────────────────────────────────────────────────────

test('caveat: flags come back most-severe-first and the cap keeps a PREFIX of that order', () => {
  const input = clean({
    supporting: 1,
    contradicting: 1,
    evidenceTier: 1,
    scopeMismatch: true,
    directionMatches: false,
    confidence: 0.1,
  });
  const flags = firedCaveatFlags(input);
  const positions = flags.map((f) => CAVEAT_SEVERITY_ORDER.indexOf(f));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'flags are not in severity order');
  assert.ok(flags.length > MAX_CAVEAT_SENTENCES, 'this fixture must over-fire to exercise the cap');

  const text = composeCaveat(flags, input);
  const kept = flags.slice(0, MAX_CAVEAT_SENTENCES).map((f) => caveatSentence(f, input));
  assert.equal(text, kept.join(' '));
  // The dropped flags are strictly LESS severe than every kept one.
  for (const dropped of flags.slice(MAX_CAVEAT_SENTENCES)) {
    for (const k of flags.slice(0, MAX_CAVEAT_SENTENCES)) {
      assert.ok(CAVEAT_SEVERITY_ORDER.indexOf(dropped) > CAVEAT_SEVERITY_ORDER.indexOf(k));
    }
  }
});

// ── (3) model words: preferred, never trusted ───────────────────────────────────────────────────

const ALWAYS_CLEAN = (): boolean => true;

test('caveat: the model\'s own words are used when they name a limitation that fired', () => {
  const input = clean({ supporting: 1 });
  const choice = chooseCaveat(input, 'Only one study of shift workers backed this up.', ALWAYS_CLEAN);
  assert.equal(choice.source, 'model');
  assert.equal(choice.caveat, 'Only one study of shift workers backed this up.');
});

test('caveat: model text naming a limitation that did NOT fire is discarded for the derived one', () => {
  const input = clean({ supporting: 1 }); // single-source fired; nothing about study design did
  const choice = chooseCaveat(input, 'The trials were all conducted in zero gravity.', ALWAYS_CLEAN);
  assert.equal(choice.source, 'derived');
  assert.equal(choice.caveat, 'Only one other study backed this up.');
});

test('caveat: the model may NOT introduce a caveat when nothing fired at all', () => {
  const choice = chooseCaveat(clean(), 'Only one study backed this up.', ALWAYS_CLEAN);
  assert.equal(choice.caveat, null);
  assert.equal(choice.source, 'none');
});

test('caveat: model text failing the copy gate falls back to the derived sentence, not to nothing', () => {
  const input = clean({ supporting: 1 });
  const reject = (): boolean => false;
  const choice = chooseCaveat(input, 'Only one study backed this up.', reject);
  assert.equal(choice.source, 'derived');
  assert.equal(choice.caveat, 'Only one other study backed this up.');
});

test('caveat: no copy validator supplied ⇒ model text is NOT used (fail-closed)', () => {
  const input = clean({ supporting: 1 });
  const choice = chooseCaveat(input, 'Only one study backed this up.');
  assert.equal(choice.source, 'derived');
});

test('caveat: over-long model text is rejected (a card qualification, not an essay)', () => {
  const input = clean({ supporting: 1 });
  const long = `Only one study backed this up. ${'x'.repeat(MAX_MODEL_CAVEAT_CHARS)}`;
  assert.equal(chooseCaveat(input, long, ALWAYS_CLEAN).source, 'derived');
});

test('caveat: empty / whitespace / null model text falls back to derived', () => {
  const input = clean({ supporting: 1 });
  for (const t of ['', '   ', null, undefined]) {
    assert.equal(chooseCaveat(input, t, ALWAYS_CLEAN).source, 'derived');
  }
});

test('caveat: corroboration matching is per-FIRED-flag, not per-any-flag', () => {
  // "mechanistic" is real vocabulary — but for a flag that did not fire here.
  assert.equal(corroboratesAFiredFlag('The evidence is mechanistic.', ['single-supporting-source']), false);
  assert.equal(corroboratesAFiredFlag('The evidence is mechanistic.', ['mechanistic-evidence']), true);
});

// ── the derived copy is card-safe against the REAL shared gate ──────────────────────────────────

test('caveat: every derived sentence passes the REAL shared copy gate (memory 0003)', async () => {
  const validateCopy = await loadCopyValidator();
  // Both wordings of the one flag whose sentence branches, plus every other flag's sentence.
  const inputs: CaveatInput[] = [
    clean({ claimedKind: 'causal', supportedKind: 'correlational' }),
    clean({ claimedKind: 'correlational', supportedKind: 'mechanistic' }),
  ];
  for (const flag of CAVEAT_SEVERITY_ORDER) {
    for (const input of inputs) {
      const sentence = caveatSentence(flag as CaveatFlag, input);
      assert.ok(sentence.length > 0, `${flag}: empty sentence`);
      assert.ok(sentence.endsWith('.'), `${flag}: derived copy must be a sentence`);
      assert.ok(validateCopy(sentence), `${flag}: derived copy fails validateCopyString — "${sentence}"`);
    }
  }
});

test('caveat: no derived sentence is a generic reassurance — each names a specific limitation', () => {
  const input = clean();
  const banned = [/^this is fine/i, /no concerns/i, /looks good/i, /nothing to note/i];
  for (const flag of CAVEAT_SEVERITY_ORDER) {
    const s = caveatSentence(flag as CaveatFlag, input);
    for (const b of banned) assert.ok(!b.test(s), `${flag}: reassuring copy "${s}"`);
  }
});
