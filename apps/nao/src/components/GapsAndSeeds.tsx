'use client';

// ourobion nao — seeds + gaps wiring (run-2 U11).
//
// Thin client wrapper holding the one piece of shared state between the two
// /ingest sections: a gap row's "Add as seed" click prefills the Seeds form
// (label derived from the metric pair). This is the HUMAN-in-the-loop bridge
// into O14's manual seed path only — NOT the autonomous gap→research loop,
// which stays gated on B5 + U16.
import { useState } from 'react';
import { GapsPanel } from './GapsPanel';
import { SeedsPanel } from './SeedsPanel';
import type { SeedPrefill } from './SeedsPanel';

export interface GapsAndSeedsProps {
  onSeedCatalogChanged?: () => void;
}

export function GapsAndSeeds({ onSeedCatalogChanged }: GapsAndSeedsProps = {}) {
  const [prefill, setPrefill] = useState<SeedPrefill | null>(null);
  return (
    <>
      <SeedsPanel prefill={prefill} onCatalogChanged={onSeedCatalogChanged} />
      <GapsPanel
        onAddAsSeed={(label) => setPrefill((p) => ({ label, nonce: (p?.nonce ?? 0) + 1 }))}
      />
    </>
  );
}
