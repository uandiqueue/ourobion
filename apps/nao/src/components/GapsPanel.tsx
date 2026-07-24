'use client';

// ourobion nao — knowledge-gaps panel (O9 demo slice / feature (d), run-2 U11).
//
// The /ingest "Knowledge gaps" section: reads the A1 gap_ledger's aggregate
// rows via GET /api/gaps (authenticated; RLS exposes scope='aggregate' only —
// aggregate demand, NO user ids) and renders them demand-first. Statuses are
// research-coverage descriptions ("no research edge for this pair"), never
// anything diagnostic.
//
// The ONLY action here is human: "Add as seed" prefills the O14 seed form
// with a label derived from the pair — a person deciding to point the
// pipeline at a gap. The autonomous gap→research→verify loop (A3 queue,
// dispatch, auto-research) stays gated on B5 + U16 and is deliberately NOT
// built here.
import { useEffect, useState } from 'react';
import type { GapViewRow } from '@/lib/gapsControl';

type LoadState = 'loading' | 'ready' | 'error';

interface GapsResponse {
  ok: true;
  gaps: GapViewRow[];
  totalCount: number;
  pageSize: number;
}

export interface GapsPanelProps {
  /** Human bridge to the seeds form: called with the derived seed label. */
  onAddAsSeed?: (label: string) => void;
}

export function GapsPanel({ onAddAsSeed }: GapsPanelProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [gaps, setGaps] = useState<GapViewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gaps');
        if (!res.ok) throw new Error(`GET failed: ${res.status}`);
        const data = (await res.json()) as GapsResponse;
        if (cancelled) return;
        setGaps(data.gaps);
        setTotalCount(data.totalCount);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="panel ingest-panel gaps-panel">
      <div className="eyebrow panel__label">Knowledge gaps</div>
      <p className="fmt__cap">
        Metric pairs the analysis touched that the knowledge graph doesn&apos;t serve yet — the A1
        gap ledger&apos;s aggregate demand (fire-counts only, no user data). Detection + surfacing
        only: acting on a gap automatically stays gated (B5 + U16); &quot;Add as seed&quot; hands a
        gap to the manual seed form instead.
      </p>

      {state === 'loading' ? <p className="fmt__cap">Loading gap ledger…</p> : null}
      {state === 'error' ? (
        <p className="fmt__cap">Couldn&apos;t load the gap ledger. Try refreshing.</p>
      ) : null}

      {state === 'ready' && gaps.length === 0 ? (
        <p className="fmt__cap">
          No gaps recorded yet. Load data and run the analysis (Data Loader) — pairs the engine
          evaluates without a servable edge land here.
        </p>
      ) : null}

      {state === 'ready' && gaps.length > 0 ? (
        <>
          <div className="gaps-table-wrap">
            <table className="gaps-table">
              <thead>
                <tr>
                  <th>Metric pair</th>
                  <th>Status</th>
                  <th className="gaps-num">Demand</th>
                  <th>Last change</th>
                  <th>Context</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={`${g.metricA}|${g.metricB}|${g.status}`}>
                    <td className="gaps-pair">{g.pairLabel}</td>
                    <td>{g.statusLabel}</td>
                    <td className="gaps-num">{g.demand}</td>
                    <td className="gaps-when">
                      {g.lastStatusChange ? g.lastStatusChange.slice(0, 10) : '—'}
                    </td>
                    <td className="gaps-context">{g.context ?? '—'}</td>
                    <td>
                      {onAddAsSeed ? (
                        <button
                          type="button"
                          className="ingest-btn ingest-btn--ghost gaps-addseed"
                          title={`Prefill the seed form with "${g.seedLabel}"`}
                          onClick={() => onAddAsSeed(g.seedLabel)}
                        >
                          Add as seed
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > gaps.length ? (
            <p className="fmt__cap">
              Showing the top {gaps.length} of {totalCount} gaps by demand.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
