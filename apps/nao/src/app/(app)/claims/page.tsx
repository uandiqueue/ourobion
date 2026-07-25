// ourobion nao — Claims (O13 / demo feature (b), run-2 U9). "Curate what the brain believes."
//
// Claim-curation surface: every relationship claim the edge loader projected,
// its latest verifier verdict (interim — TEST-MODE stamped), the O13 human
// verdict status, and the one write action (REJECT, recorded on top of the
// verifier — supersedes it for serving only). Thin Server Component shell over
// ClaimsPanel, matching the app's page convention (models/page.tsx). The same
// panel also renders per-paper on /paper/[uid] via the citation containment
// filter.
import type { Metadata } from 'next';
import { ClaimsPanel } from '@/components/ClaimsPanel';

export const metadata: Metadata = {
  title: 'Claims · ourobion nao',
  description: 'Relationship claims, verifier verdicts, and human curation (reject overrides serving).',
};

export default function ClaimsPage() {
  return (
    <div className="ingest">
      <div className="ingest__head">
        <div className="eyebrow">Curation</div>
        <h1 className="ingest__title">Claims &amp; verdicts</h1>
      </div>
      <ClaimsPanel />
    </div>
  );
}
