'use client';

// ourobion nao — ingestion remote-control panel (Client Component).
//
// Reads/writes control/ingest-config.json via /api/ingest-control. Three
// independent controls: pause/resume the CLI, queue a one-shot run request,
// and override OpenAlex's daily budget cap — all optional, all merged
// server-side (see the route handler) so this panel never needs to know the
// full document shape to change one field.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { INGEST_SEED_TOPICS, DEFAULT_INGEST_CONTROL } from '@/lib/types';
import type { IngestControlConfig } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'error';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || iso === DEFAULT_INGEST_CONTROL.updatedAt) return 'never';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function IngestControlPanel() {
  const [state, setState] = useState<LoadState>('loading');
  const [control, setControl] = useState<IngestControlConfig>(DEFAULT_INGEST_CONTROL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seed, setSeed] = useState<string>(INGEST_SEED_TOPICS[0]);
  const [limit, setLimit] = useState('20');
  const [budget, setBudget] = useState('');

  async function refresh(): Promise<void> {
    try {
      const res = await fetch('/api/ingest-control');
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const data = (await res.json()) as IngestControlConfig;
      setControl(data);
      setBudget(data.limits.openalexDailyUsd?.toString() ?? '');
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function patch(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ingest-control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as IngestControlConfig | { error: string };
      if (!res.ok) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      setControl(data as IngestControlConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function submitRequest(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const n = Number.parseInt(limit, 10);
    void patch({ requestSeed: seed, requestLimit: Number.isFinite(n) && n > 0 ? n : undefined });
  }

  function submitBudget(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = budget.trim();
    const n = trimmed === '' ? null : Number.parseFloat(trimmed);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) {
      setError('OpenAlex daily budget must be a positive number, or blank to use the default ($1.00).');
      return;
    }
    void patch({ openalexDailyUsd: n });
  }

  if (state === 'loading') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Loading control state…</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Couldn&apos;t load ingestion control state. Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="ingest-grid">
      {/* Pause / resume */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Pipeline state</div>
        <div className="ingest-pause">
          <span className={`ingest-pause__badge ${control.paused ? 'ingest-pause__badge--paused' : 'ingest-pause__badge--running'}`}>
            {control.paused ? 'PAUSED' : 'RUNNING'}
          </span>
          <button
            type="button"
            className="ingest-btn"
            disabled={busy}
            onClick={() => void patch({ paused: !control.paused })}
          >
            {control.paused ? 'Resume ingestion' : 'Pause ingestion'}
          </button>
        </div>
        <p className="fmt__cap">
          A paused CLI (run with <code>--remote-control</code>) does no discovery or retrieval work and
          exits immediately. Last changed by {control.updatedBy} at {fmtWhen(control.updatedAt)}.
        </p>
      </div>

      {/* Queue a run */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Queue a run</div>
        {control.requestedRun ? (
          <div className="ingest-queued">
            <p className="fmt__cap">
              Queued: <strong>{control.requestedRun.seed ?? 'all seeds'}</strong>
              {control.requestedRun.limit ? `, limit ${control.requestedRun.limit}` : ''} — by{' '}
              {control.requestedRun.requestedBy} at {fmtWhen(control.requestedRun.requestedAt)}
            </p>
            <button type="button" className="ingest-btn ingest-btn--ghost" disabled={busy} onClick={() => void patch({ clearRequest: true })}>
              Cancel request
            </button>
          </div>
        ) : (
          <form className="ingest-form" onSubmit={submitRequest}>
            <select value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Seed topic">
              {INGEST_SEED_TOPICS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-label="Paper limit"
              placeholder="limit"
            />
            <button type="submit" className="ingest-btn" disabled={busy}>
              Request run
            </button>
          </form>
        )}
        <p className="fmt__cap">
          Consumed one-shot by the next <code>--remote-control</code> CLI invocation that runs without its
          own <code>--seed</code>/<code>--limit</code>.
        </p>
      </div>

      {/* Budget override */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">OpenAlex daily budget</div>
        <form className="ingest-form" onSubmit={submitBudget}>
          <span className="ingest-form__prefix">$</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="1.00 (default)"
            aria-label="OpenAlex daily budget in USD"
          />
          <button type="submit" className="ingest-btn" disabled={busy}>
            Save
          </button>
        </form>
        <p className="fmt__cap">Overrides the compiled-in $1.00/day cap. Leave blank to use the default.</p>
      </div>

      {error ? <p className="ingest-error">{error}</p> : null}
    </div>
  );
}
