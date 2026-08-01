import type { Metadata } from 'next';
import { BrainPipelinePanel } from '@/components/BrainPipelinePanel';

export const metadata: Metadata = {
  title: 'Brain pipeline · ourobion nao',
  description: 'Dispatch and observe bounded synthesis and verification runs.',
};

export default function BrainPipelinePage() {
  return (
    <div className='ingest'>
      <div className='ingest__head'>
        <div className='eyebrow'>Corpus to evidence</div>
        <h1 className='ingest__title'>Brain pipeline</h1>
      </div>
      <BrainPipelinePanel />
    </div>
  );
}
