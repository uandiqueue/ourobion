// Legacy public explainer URL. Keep old links working while `/` remains the
// single canonical Ourobion explainer route.
import { permanentRedirect } from 'next/navigation';

export default function LegacyHowItWorksPage(): never {
  permanentRedirect('/');
}
