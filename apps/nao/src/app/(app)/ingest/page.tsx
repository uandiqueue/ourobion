// ourobion nao — Ingestion control (v1). "Steer the pipeline."
//
// Client-driven panel over control/ingest-config.json (R2) — pause/resume the
// CLI, queue a one-shot run request, adjust the OpenAlex daily budget. This
// page itself needs no server data (the panel fetches its own state), but
// stays a thin Server Component shell for the title/metadata, matching the
// rest of the app's page convention.
import type { Metadata } from 'next';
import { IngestControlWorkspace } from '@/components/IngestControlWorkspace';

export const metadata: Metadata = {
  title: 'Ingestion control · ourobion nao',
  description:
    'Pause/resume the ingestion CLI, queue a run, adjust budget limits, manage ingestion seeds, ' +
    'and see the knowledge gaps the analysis has surfaced.',
};

export default function IngestControlPage() {
  return (
    <div className="ingest">
      <div className="ingest__head">
        <div className="eyebrow">Steer the pipeline</div>
        <h1 className="ingest__title">Ingestion control</h1>
      </div>
      {/* O14 seeds-as-data (U10) + O9 gap surfacing (U11): the workspace keeps
          Run-now synchronized with successful seed add/toggle mutations. */}
      <IngestControlWorkspace />
    </div>
  );
}
