// ourobion nao — Data loader (O11, run-2 U6; unavailable state as of run 4).
//
// The route and its place in the nav are kept: the loader's server side is
// intact and still gated, so the capability is only unpresented, not removed.
// Thin Server Component shell over LoaderPanel, matching the app's page
// convention (see ingest/page.tsx).
import type { Metadata } from 'next';
import { LoaderPanel } from '@/components/LoaderPanel';

export const metadata: Metadata = {
  title: 'Data loader · ourobion nao',
  description: 'Loading demo health data and running the analysis pipeline is coming soon.',
};

export default function DataLoaderPage() {
  return (
    <div className="ingest">
      <div className="ingest__head">
        <div className="eyebrow">Feed the engine</div>
        <h1 className="ingest__title">Data loader</h1>
      </div>
      <LoaderPanel />
    </div>
  );
}
