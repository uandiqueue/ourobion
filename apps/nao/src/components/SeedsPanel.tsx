'use client';

// ourobion nao — seeds-as-data panel (O14 / demo feature (c), run-2 U10).
//
// The /ingest "Seeds" section: lists the seed catalog (the six built-in topics
// from brain-ingest's static seeds.ts, labeled built-in, + human-added
// ingestion_seeds rows with their enabled state) and adds new seeds via
// POST /api/seeds as the authenticated user. Db seeds can be enabled/disabled
// (PATCH — the migration's column grant allows `enabled` only; no delete:
// disable, don't erase). A seed is a discovery TOPIC/query, never a metric
// pair — C9's candidate list stays the only pair source. The pipeline picks
// db seeds up fail-soft on its next run (static wins on a slug collision).
//
// R4 viewer read-only UX: the seed catalog is the one surface where READING is
// itself gated — `GET /api/seeds` requires the same tier as writing it, per the
// route matrix. So this panel asks about the read route too, and says plainly
// that the catalog is outside the caller's access rather than fetching, being
// refused, and reporting that as a load failure the caller could retry.
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { deriveSeedSlug, validateSeedSlug } from '@/lib/seedsControl';
import type { SeedCatalogEntry } from '@/lib/seedsControl';
import { ControlNote, useControlAccess, useControlGate } from './NaoAccess';

const SEEDS_READ_ROUTE = 'GET /api/seeds';
const SEEDS_ADD_ROUTE = 'POST /api/seeds';
const SEEDS_TOGGLE_ROUTE = 'PATCH /api/seeds';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * A prefill request from the gaps panel's "Add as seed" bridge (run-2 U11):
 * `nonce` increments per click so repeated clicks (even the same label)
 * re-apply. Human-in-the-loop only — the seed is still reviewed + submitted
 * by the user.
 */
export interface SeedPrefill {
  label: string;
  nonce: number;
}

export interface SeedsPanelProps {
  prefill?: SeedPrefill | null;
  onCatalogChanged?: () => void;
}

export function SeedsPanel({ prefill, onCatalogChanged }: SeedsPanelProps = {}) {
  const gate = useControlGate();
  const readAccess = useControlAccess(SEEDS_READ_ROUTE);
  const [state, setState] = useState<LoadState>('loading');
  const [catalog, setCatalog] = useState<SeedCatalogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [queryHint, setQueryHint] = useState('');
  const slugPreview = deriveSeedSlug(label);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Gap → seed prefill (U11): apply the bridged label and bring the form into
  // view so the human can review/edit before submitting.
  useEffect(() => {
    if (!prefill) return;
    setLabel(prefill.label);
    setMessage(null);
    setError(null);
    labelInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    labelInputRef.current?.focus({ preventScroll: true });
  }, [prefill]);

  async function refresh(): Promise<void> {
    try {
      const res = await fetch('/api/seeds');
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const data = (await res.json()) as { ok: true; seeds: SeedCatalogEntry[] };
      setCatalog(data.seeds);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    // Don't ask for a catalog the caller may not read: a refusal here is not a
    // load failure, and offering "Try refreshing" for one would be misleading.
    if (!readAccess.allowed) {
      setState('ready');
      return;
    }
    void refresh();
  }, [readAccess.allowed]);

  async function submitAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const trimmedHint = queryHint.trim();
      const res = await fetch('/api/seeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          ...(trimmedHint !== '' ? { queryHint: trimmedHint } : {}),
        }),
      });
      const data = (await res.json()) as { ok: true; seed: { slug: string } } | { error: string };
      if (!res.ok || !('ok' in data)) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      setMessage(
        `Seed '${data.seed.slug}' added — the pipeline merges it with the built-in topics on its next run.`,
      );
      setLabel('');
      setQueryHint('');
      onCatalogChanged?.();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(slug: string, enabled: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/seeds', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, enabled }),
      });
      const data = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || !('ok' in data)) throw new Error('error' in data ? data.error : `HTTP ${res.status}`);
      onCatalogChanged?.();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!readAccess.allowed) {
    return (
      <div className="panel ingest-panel seeds-panel">
        <div className="eyebrow panel__label">Seeds</div>
        <p className="fmt__cap">
          Ingestion topics the pipeline discovers literature for. The seed catalog is part of the
          editing surface, so it isn&apos;t shown at your access level.
        </p>
      </div>
    );
  }
  if (state === 'loading') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Loading seed catalog…</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Couldn&apos;t load the seed catalog. Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="panel ingest-panel seeds-panel">
      <div className="eyebrow panel__label">Seeds</div>
      <p className="fmt__cap">
        Ingestion topics the pipeline discovers literature for. Built-ins live in code
        (<code>seeds.ts</code>); seeds added here are DATA the pipeline merges in fail-soft on its
        next run. Seeds are topics/queries — never metric pairs (C9).
      </p>

      <ul className="seeds-list">
        {catalog.map((s) => {
          const invalidLegacySlug = !s.builtIn && validateSeedSlug(s.slug) !== null;
          return (
          <li key={s.slug} className={`seeds-row${s.enabled ? '' : ' seeds-row--disabled'}`}>
            <div className="seeds-row__main">
              <code className="seeds-row__slug">{s.slug}</code>
              {s.builtIn ? (
                <span className="seeds-badge seeds-badge--builtin">built-in</span>
              ) : (
                <span className={`seeds-badge ${s.enabled ? 'seeds-badge--enabled' : 'seeds-badge--off'}`}>
                  {s.enabled ? 'enabled' : 'disabled'}
                </span>
              )}
              {s.shadowedByBuiltIn ? (
                <span className="seeds-badge seeds-badge--off" title="A built-in topic has this slug; the pipeline ignores this row (static wins).">
                  shadowed
                </span>
              ) : null}
              {invalidLegacySlug ? (
                <span className="seeds-badge seeds-badge--off">unavailable</span>
              ) : null}
            </div>
            {!s.builtIn ? (
              <div className="seeds-row__detail">
                <span>{s.label}</span>
                {s.queryHint ? <span className="fmt__cap"> · query: {s.queryHint}</span> : null}
                {invalidLegacySlug ? (
                  <span className="fmt__cap"> · invalid legacy slug; database remediation required</span>
                ) : null}
              </div>
            ) : null}
            {!s.builtIn ? (
              <button
                type="button"
                className="ingest-btn ingest-btn--ghost seeds-row__toggle"
                onClick={() => void toggle(s.slug, !s.enabled)}
                {...gate(SEEDS_TOGGLE_ROUTE, busy || invalidLegacySlug)}
              >
                {s.enabled ? 'Disable' : 'Enable'}
              </button>
            ) : null}
          </li>
          );
        })}
      </ul>

      <form className="ingest-form seeds-form" onSubmit={submitAdd}>
        <input
          ref={labelInputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="New seed label, e.g. Magnesium and sleep quality"
          aria-label="Seed label"
          required
          {...gate(SEEDS_ADD_ROUTE)}
        />
        <input
          type="text"
          value={queryHint}
          onChange={(e) => setQueryHint(e.target.value)}
          placeholder="Query hint (optional)"
          aria-label="Query hint"
          {...gate(SEEDS_ADD_ROUTE)}
        />
        <button type="submit" className="ingest-btn" {...gate(SEEDS_ADD_ROUTE, busy || label.trim() === '')}>
          Add seed
        </button>
      </form>
      <ControlNote route={SEEDS_ADD_ROUTE} />
      {label.trim() !== '' ? (
        <p className="fmt__cap seeds-slug-preview">
          slug: <code>{slugPreview === '' ? '(label needs a letter or digit)' : slugPreview}</code>
        </p>
      ) : null}

      {message ? <p className="fmt__cap ingest-success">{message}</p> : null}
      {error ? <p className="ingest-error">{error}</p> : null}
    </div>
  );
}
