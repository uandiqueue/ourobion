// shared/constants/copy_guidelines.dart

class CopyRules {
  // NOTE (A8): entries must stay lowercase word-characters only ([a-z0-9_]) — the matcher
  // anchors on \b word boundaries, which only work against \w-only terms.
  static const List<String> forbiddenWords = [
    'diagnosed',
    'condition',
    'disease',
    'illness',
    'treatment',
  ];

  static const List<String> allowedPhrases = [
    'pattern',
    'signal',
    'observation',
    'your data shows',
    'you may notice',
  ];

  // Word-boundary matcher with an optional plural suffix (audit A8): a forbidden term only trips
  // the gate as a standalone word ("illness", "conditions", "treatment-plan") — never as a
  // fragment of a benign word ("stillness", "conditioning", "air-conditioned", "mistreatment").
  // The TS original (copy_guidelines.ts) implements the CHARACTER-IDENTICAL pattern — keep in
  // lockstep (guard: apps/biotope/test/guards/copy_guidelines_parity_test.dart).
  static RegExp _forbiddenWordPattern(String word) =>
      RegExp('\\b$word(?:e?s)?\\b');

  static bool validateCopyString(String text) {
    final lowerText = text.toLowerCase();
    for (final word in forbiddenWords) {
      if (_forbiddenWordPattern(word).hasMatch(lowerText)) {
        return false; // Diagnostic language detected
      }
    }
    return true;
  }
}
