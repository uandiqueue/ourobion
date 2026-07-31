// ourobion nao — canonical public product explainer.
//
// `/` intentionally lives outside the authenticated `(app)` route group. The
// middleware allow-lists this exact pathname before reading environment,
// session, or membership state. Authenticated operations remain under the
// `(app)` group and begin at `/overview`.
import type { Metadata } from 'next';
import { OurobionExplainer } from '@/components/OurobionExplainer';

export const metadata: Metadata = {
  title: 'How Ourobion works',
  description:
    'Ourobion connects a personal reflection app with an expert workspace for preparing research context.',
};

export default function HomePage() {
  return <OurobionExplainer />;
}
