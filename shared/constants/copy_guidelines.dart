// shared/constants/copy_guidelines.dart

class CopyRules {
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

  static bool validateCopyString(String text) {
    final lowerText = text.toLowerCase();
    for (final word in forbiddenWords) {
      if (lowerText.contains(word)) {
        return false; // Diagnostic language detected
      }
    }
    return true;
  }
  
  static String getCopyRule(String ruleKey) {
    // TODO: Implement rule lookup
    return '';
  }
}
