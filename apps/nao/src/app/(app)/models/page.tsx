// ourobion nao — Models (O10 / demo feature (a), run-2 U8). "See what the brain costs."
//
// Model-config + spend control plane: per-node model/route/caps from the published
// router.config.json snapshot, today's spend vs caps from the published budget
// ledger, the TEST-MODE banner, and the one writable surface — per-node cap
// overrides. Thin Server Component shell over ModelsPanel, matching the app's
// page convention (see ingest/page.tsx, loader/page.tsx).
import type { Metadata } from 'next';
import { ModelsPanel } from '@/components/ModelsPanel';

export const metadata: Metadata = {
  title: 'Models · ourobion nao',
  description: 'LLM router config, spend vs budget, and editable per-node caps.',
};

export default function ModelsPage() {
  return (
    <div className="ingest">
      <div className="ingest__head">
        <div className="eyebrow">Control plane</div>
        <h1 className="ingest__title">Models &amp; spend</h1>
      </div>
      <ModelsPanel />
    </div>
  );
}
