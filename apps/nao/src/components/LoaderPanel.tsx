'use client';

// ourobion nao — simulated health-data loader panel (Client Component, O11 run-2 U6).
//
// Demo main-loop steps 1 & 3: load N days of simulated, provenance-flagged health
// data into biotope's tables (via /api/loader — RLS-scoped to the signed-in user),
// then trigger the serve pipeline (via /api/loader/run-pipeline) and show the
// per-stage summaries. Deliberately functional-not-pretty (O11 locked: simplified
// UI); follows IngestControlPanel's fetch/busy/error conventions and reuses the
// ingest panel styles.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  DEFAULT_FIRST_LOAD_DAYS,
  DEFAULT_INCREMENT_DAYS,
  DEFAULT_SEED,
  LOADER_SCENARIOS,
  type LoaderScenario,
} from '@/lib/simulatedHealth';

interface RangeSummary {
  minDate: string | null;
  maxDate: string | null;
  days: number;
}

interface LoaderState {
  today: string;
  gut: RangeSummary;
  wearable: RangeSummary;
}

interface LoadResult {
  ok: true;
  loadedDays: number;
  forwardDays: number;
  backfillDays: number;
  seed: string;
  scenario: string;
  range: RangeSummary;
  requestKey: string;
  targetLabel: string | null;
}

interface StageResult {
  stage: string;
  status: number;
  ok: boolean;
  summary: unknown;
}

interface PipelineResult {
  ok: boolean;
  failedStage?: string;
  stages: StageResult[];
}

type LoadState = 'loading' | 'ready' | 'error';

function fmtRange(r: RangeSummary): string {
  if (r.minDate === null || r.maxDate === null) return 'no data loaded';
  return `${r.minDate} → ${r.maxDate} (${r.days} day${r.days === 1 ? '' : 's'})`;
}

/** One-line human summary of a pipeline stage's verbatim JSON summary. */
function fmtStage(stage: StageResult): string {
  const s = (stage.summary ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const num = (key: string) => (typeof s[key] === 'number' ? `${key} ${s[key]}` : null);
  for (const key of ['users', 'snapshots', 'snapshotsPruned'] as const) {
    const p = num(key);
    if (p) parts.push(p);
  }
  if (Array.isArray(s.metricSignals)) parts.push(`metricSignals ${s.metricSignals.length}`);
  if (Array.isArray(s.firedPatterns)) parts.push(`firedPatterns ${s.firedPatterns.length}`);
  else if (typeof s.firedPatterns === 'number') parts.push(`firedPatterns ${s.firedPatterns}`);
  const cards = s.cards as Record<string, unknown> | undefined;
  if (cards && typeof cards.upserted === 'number') {
    parts.push(`cards ${cards.upserted} (${JSON.stringify(cards.byProducer ?? {})})`);
  }
  const insights = s.insights as Record<string, unknown> | undefined;
  if (insights && typeof insights.upserted === 'number') parts.push(`insights ${insights.upserted}`);
  return parts.length > 0 ? parts.join(' · ') : 'ok';
}

export function LoaderPanel() {
  const [state, setState] = useState<LoadState>('loading');
  const [loader, setLoader] = useState<LoaderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);

  const [days, setDays] = useState('');
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [scenario, setScenario] = useState<LoaderScenario>('recent-dip');
  const [target, setTarget] = useState('');

  async function refresh(): Promise<void> {
    try {
      const res = await fetch('/api/loader');
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      setLoader((await res.json()) as LoaderState);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submitLoad(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLoadResult(null);
    const n = Number.parseInt(days, 10);
    try {
      const res = await fetch('/api/loader', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target: target.trim(),
          ...(Number.isFinite(n) && n > 0 ? { days: n } : {}),
          seed: seed.trim() === '' ? undefined : seed.trim(),
          scenario,
        }),
      });
      const data = (await res.json()) as LoadResult | { error: string };
      if (!res.ok || !('ok' in data)) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      setLoadResult(data);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis(): Promise<void> {
    if (loadResult === null) {
      setError('Load an approved demo target first; analysis is scoped to that load.');
      return;
    }
    setBusy(true);
    setError(null);
    setPipeline(null);
    try {
      const res = await fetch('/api/loader/run-pipeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestKey: loadResult.requestKey }),
      });
      const data = (await res.json()) as PipelineResult | { error: string };
      if (!('stages' in data)) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      setPipeline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Loading current data range…</p>
      </div>
    );
  }
  if (state === 'error' || loader === null) {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Couldn&apos;t load the current data range. Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="ingest-grid">
      {/* Current range */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Signed-in account range</div>
        <p className="fmt__cap">
          daily_gut_rows: {fmtRange(loader.gut)}
          <br />
          wearable_daily: {fmtRange(loader.wearable)}
          <br />
          server today (UTC): {loader.today}
        </p>
        <p className="fmt__cap">
          This shows the signed-in account only. Loads below target an approved, separate demo account
          and are provenance-flagged simulated data.
        </p>
      </div>

      {/* Load more days */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Load simulated days</div>
        <form className="ingest-form" onSubmit={submitLoad}>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Approved demo target ID"
            placeholder="Approved demo target ID"
            required
          />
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Days to load"
            placeholder={`${DEFAULT_FIRST_LOAD_DAYS} first / ${DEFAULT_INCREMENT_DAYS} more (server default)`}
          />
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as LoaderScenario)}
            aria-label="Scenario"
          >
            {LOADER_SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            aria-label="Deterministic seed"
            placeholder="seed"
          />
          <button type="submit" className="ingest-btn" disabled={busy}>
            Load days
          </button>
        </form>
        <p className="fmt__cap">
          First load ends today; further loads fill forward to today, then backfill history.
          &quot;recent-dip&quot; shifts the most recent days so signals fire; deterministic per seed.
        </p>
        {loadResult ? (
          <p className="fmt__cap ingest-success">
            Loaded {loadResult.loadedDays} day(s) ({loadResult.forwardDays} forward,{' '}
            {loadResult.backfillDays} backfill) · scenario {loadResult.scenario} · seed{' '}
            {loadResult.seed} · target {loadResult.targetLabel ?? 'approved demo'} · range now {fmtRange(loadResult.range)}
          </p>
        ) : null}
      </div>

      {/* Run analysis */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Run analysis</div>
        <div className="ingest-pause">
          <button type="button" className="ingest-btn" disabled={busy || loadResult === null} onClick={() => void runAnalysis()}>
            Run analysis
          </button>
        </div>
        <p className="fmt__cap">
          Runs the serve pipeline for the latest completed demo load (compute-baselines → evaluate-signals
          → generate-insights) via the server-side relay. Summaries below are the stages&apos; own JSON.
        </p>
        {pipeline ? (
          <div>
            <p className={`fmt__cap ${pipeline.ok ? 'ingest-success' : 'ingest-error'}`}>
              {pipeline.ok ? 'Pipeline complete.' : `Pipeline failed at ${pipeline.failedStage ?? '?'}.`}
            </p>
            <ul className="fmt__cap">
              {pipeline.stages.map((stage) => (
                <li key={stage.stage}>
                  {stage.ok ? 'OK' : 'FAIL'} · {stage.stage} · {fmtStage(stage)}
                </li>
              ))}
            </ul>
            <pre className="fmt__cap" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(pipeline, null, 1)}
            </pre>
          </div>
        ) : null}
      </div>

      {error ? <p className="ingest-error">{error}</p> : null}
    </div>
  );
}
