'use client';

// ourobion nao — ingestion remote-control panel (Client Component).
//
// Three independent controls: pause/resume the CLI (settings, /api/ingest-control),
// override OpenAlex's daily budget cap (same settings endpoint), and trigger a
// real run right now via GitHub Actions (/api/ingest-control/trigger — see
// lib/githubDispatch.ts for why this can't just run inside nao itself).
//
// R4-U2: `updatedBy` is a staff EMAIL ADDRESS server-side, so /api/ingest-control
// now redacts it out of the response (redactDeep drops the key — see
// src/lib/authz.ts) and the actor lives in the admin-only nao_control_events log
// instead. The field is therefore absent at runtime even though
// IngestControlConfig types it as required, hence the `|| '[redacted]'` fallback
// at the one render site below.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { INGEST_SEED_TOPICS, DEFAULT_INGEST_CONTROL } from '@/lib/types';
import type { IngestControlConfig } from '@/lib/types';
import { buildSeedCatalog, seedRunabilityError } from '@/lib/seedsControl';
import type { SeedCatalogEntry } from '@/lib/seedsControl';

type LoadState = 'loading' | 'ready' | 'error';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || iso === DEFAULT_INGEST_CONTROL.updatedAt) return 'never';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export interface IngestControlPanelProps {
  seedCatalogRevision?: number;
}

export function IngestControlPanel({ seedCatalogRevision = 0 }: IngestControlPanelProps = {}) {
  const [state, setState] = useState<LoadState>('loading');
  const [control, setControl] = useState<IngestControlConfig>(DEFAULT_INGEST_CONTROL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [seedCatalog, setSeedCatalog] = useState<SeedCatalogEntry[]>(() =>
    buildSeedCatalog(INGEST_SEED_TOPICS, []),
  );
  const [seedCatalogWarning, setSeedCatalogWarning] = useState<string | null>(null);

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

  async function refreshSeedCatalog(): Promise<void> {
    try {
      const res = await fetch('/api/seeds');
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const data = (await res.json()) as { ok: true; seeds: SeedCatalogEntry[] };
      setSeedCatalog(data.seeds);
      setSeedCatalogWarning(null);
      setSeed((current) => {
        if (seedRunabilityError(data.seeds, current) === null) return current;
        return data.seeds.find((entry) => seedRunabilityError(data.seeds, entry.slug) === null)?.slug
          ?? INGEST_SEED_TOPICS[0];
      });
    } catch {
      const fallback = buildSeedCatalog(INGEST_SEED_TOPICS, []);
      setSeedCatalog(fallback);
      setSeed(INGEST_SEED_TOPICS[0]);
      setSeedCatalogWarning('Custom seed catalog unavailable — showing built-in seeds only.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    void refreshSeedCatalog();
  }, [seedCatalogRevision]);

  async function patchSettings(body: Record<string, unknown>): Promise<void> {
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

  async function submitRun(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTriggerMessage(null);
    const n = Number.parseInt(limit, 10);
    try {
      const res = await fetch('/api/ingest-control/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seed, limit: Number.isFinite(n) && n > 0 ? n : undefined }),
      });
      const data = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || !('ok' in data)) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      setTriggerMessage(`Triggered — ${seed}${limit ? `, limit ${limit}` : ''}. Check the repo's Actions tab for progress.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function submitBudget(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = budget.trim();
    const n = trimmed === '' ? null : Number.parseFloat(trimmed);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) {
      setError('OpenAlex daily budget must be a positive number, or blank to use the default ($1.00).');
      return;
    }
    void patchSettings({ openalexDailyUsd: n });
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
            onClick={() => void patchSettings({ paused: !control.paused })}
          >
            {control.paused ? 'Resume ingestion' : 'Pause ingestion'}
          </button>
        </div>
        <p className="fmt__cap">
          Paused blocks both &quot;Run now&quot; below and any <code>--remote-control</code> CLI run. Last
          changed by {control.updatedBy || '[redacted]'} at {fmtWhen(control.updatedAt)}.
        </p>
      </div>

      {/* Run now */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Run now</div>
        <form className="ingest-form" onSubmit={submitRun}>
          <select value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Seed topic">
            <optgroup label="Built-in seeds">
              {seedCatalog.filter((entry) => entry.builtIn).map((entry) => (
                <option key={`built-in:${entry.slug}`} value={entry.slug}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Custom seeds">
              {seedCatalog.some((entry) => !entry.builtIn) ? (
                seedCatalog.filter((entry) => !entry.builtIn).map((entry) => {
                  const reason = entry.unavailableReason;
                  return (
                    <option
                      key={`custom:${entry.slug}`}
                      value={entry.slug}
                      disabled={reason !== null}
                    >
                      {entry.label}{reason ? ` — unavailable: ${reason}` : ''}
                    </option>
                  );
                })
              ) : (
                <option value="" disabled>No custom seeds available</option>
              )}
            </optgroup>
          </select>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            aria-label="Paper limit"
            placeholder="limit"
          />
          <button type="submit" className="ingest-btn" disabled={busy || control.paused}>
            Run now
          </button>
        </form>
        <p className="fmt__cap">
          Triggers a real ingestion run immediately on GitHub Actions ({' '}
          <code>.github/workflows/brain-ingest.yml</code>) with this seed/limit.
        </p>
        {seedCatalogWarning ? <p className="fmt__cap ingest-error">{seedCatalogWarning}</p> : null}
        {triggerMessage ? <p className="fmt__cap ingest-success">{triggerMessage}</p> : null}
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
