// shared/constants/copy-guidelines.ts

export const COPY_RULES = {
  // Never use: "diagnosed", "condition", "disease", "illness", "treatment", "symptom" (as label)
  // Always use: "pattern", "signal", "observation", "your data shows", "you may notice"

  // NOTE (A8): entries must stay lowercase word-characters only ([a-z0-9_]) — the matcher
  // anchors on \b word boundaries, which only work against \w-only terms.
  FORBIDDEN_WORDS: [
    'diagnosed',
    'condition',
    'disease',
    'illness',
    'treatment',
    // 'symptom' // context dependent, string matching needs care
  ],

  ALLOWED_PHRASES: [
    'pattern',
    'signal',
    'observation',
    'your data shows',
    'you may notice'
  ],

  SEVERITIES: {
    INFO: 'info', // blue
    NOTICE: 'notice', // amber
    WATCH: 'watch' // soft red
  }
};

// Word-boundary matcher with an optional plural suffix (audit A8): a forbidden term only trips
// the gate as a standalone word ("illness", "conditions", "treatment-plan") — never as a
// fragment of a benign word ("stillness", "conditioning", "air-conditioned", "mistreatment").
// The Dart mirror (copy_guidelines.dart) implements the CHARACTER-IDENTICAL pattern — keep in
// lockstep (guard: apps/biotope/test/guards/copy_guidelines_parity_test.dart).
function forbiddenWordPattern(word: string): RegExp {
  return new RegExp(`\\b${word}(?:e?s)?\\b`);
}

export function validateCopyString(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const word of COPY_RULES.FORBIDDEN_WORDS) {
    if (forbiddenWordPattern(word).test(lowerText)) {
      return false; // Diagnostic language detected
    }
  }
  return true;
}
