'use client';

import { useCallback, useState } from 'react';
import { GapsAndSeeds } from './GapsAndSeeds';
import { IngestControlPanel } from './IngestControlPanel';

/** Keeps the Run-now catalog synchronized with successful seed mutations. */
export function IngestControlWorkspace() {
  const [seedCatalogRevision, setSeedCatalogRevision] = useState(0);
  const refreshRunNowSeeds = useCallback(() => {
    setSeedCatalogRevision((current) => current + 1);
  }, []);

  return (
    <>
      <IngestControlPanel seedCatalogRevision={seedCatalogRevision} />
      <GapsAndSeeds onSeedCatalogChanged={refreshRunNowSeeds} />
    </>
  );
}
