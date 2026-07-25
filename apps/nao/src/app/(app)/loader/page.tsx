// ourobion nao — Data Loader (O11, run-2 U6). "Feed the engine."
//
// Simulated health-data loader for the demo main loop: load N provenance-flagged
// days into biotope's tables as the signed-in user, then run the serve pipeline and
// inspect the per-stage summaries. Thin Server Component shell over LoaderPanel,
// matching the app's page convention (see ingest/page.tsx).
import type { Metadata } from 'next';
import { LoaderPanel } from '@/components/LoaderPanel';

export const metadata: Metadata = {
  title: 'Data loader · ourobion nao',
  description: 'Load simulated, provenance-flagged health data and trigger the serve pipeline.',
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
