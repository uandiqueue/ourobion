// shared/constants/copy-guidelines.ts

export const COPY_RULES = {
  // Never use: "diagnosed", "condition", "disease", "illness", "treatment", "symptom" (as label)
  // Always use: "pattern", "signal", "observation", "your data shows", "you may notice"
  
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

export function validateCopyString(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const word of COPY_RULES.FORBIDDEN_WORDS) {
    if (lowerText.includes(word)) {
      return false; // Diagnostic language detected
    }
  }
  return true;
}
