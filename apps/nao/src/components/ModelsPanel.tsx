'use client';

// ourobion nao — model-config + spend panel (Client Component, O10 / demo feature (a), run-2 U8).
//
// Reads the O10 boundaries via /api/models (llm_router_status + llm_router_spend +
// llm_router_cap_overrides — PROJECTIONS of tools/llm-router's config file + budget
// ledger, publish-driven) and writes ONLY cap overrides via /api/models/caps (the
// locked demo exception). Follows IngestControlPanel/LoaderPanel's fetch/busy/error
// conventions and reuses the ingest panel styles.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  effectiveCap,
  isHardStopped,
  isStale,
  spendFraction,
  type CapOverrideRow,
  type LlmRouterNode,
  type ModelSpendRow,
  type ModelStatusRow,
} from '@/lib/modelsControl';

// RUN budget context (labelled constants, NOT read from the boundary): the Phase-2
// Run 2.0 caps set by Jayden — see docs/temp/run2/orchestration-log.md
// "Budget" (20 SGD total OpenAI; 2 SGD Anthropic, verifier-decorrelation only).
// The per-day USD caps below live in router.config.json; these run caps frame them.
const RUN_CAP_SGD_OPENAI = 20;
const RUN_CAP_SGD_ANTHROPIC = 2;

interface ModelsState {
  today: string;
  status: ModelStatusRow[];
  spend: ModelSpendRow[];
  overrides: CapOverrideRow[];
}

type LoadState = 'loading' | 'ready' | 'error';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function ModelsPanel() {
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<ModelsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Editor drafts: per node, the two override fields as raw input strings ('' = no override).
  const [drafts, setDrafts] = useState<Record<string, { day: string; run: string }>>({});

  async function refresh(): Promise<void> {
    try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const next = (await res.json()) as ModelsState;
      setData(next);
      const nextDrafts: Record<string, { day: string; run: string }> = {};
      for (const row of next.status) {
        const o = next.overrides.find((x) => x.node === row.node);
        nextDrafts[row.node] = {
          day: o?.per_day_usd_cap != null ? String(o.per_day_usd_cap) : '',
          run: o?.per_run_token_cap != null ? String(o.per_run_token_cap) : '',
        };
      }
      setDrafts(nextDrafts);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCaps(e: FormEvent<HTMLFormElement>, node: LlmRouterNode): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedMessage(null);
    const draft = drafts[node] ?? { day: '', run: '' };
    const dayValue = draft.day.trim() === '' ? null : Number.parseFloat(draft.day);
    const runValue = draft.run.trim() === '' ? null : Number.parseInt(draft.run, 10);
    try {
      const res = await fetch('/api/models/caps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ node, perDayUsdCap: dayValue, perRunTokenCap: runValue }),
      });
      const result = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || !('ok' in result)) {
        throw new Error('error' in result ? result.error : `HTTP ${res.status}`);
      }
      setSavedMessage(
        `Saved caps for ${node} — day ${dayValue === null ? 'cleared (file cap)' : `US$${dayValue}`}, ` +
          `run ${runValue === null ? 'cleared (file cap)' : `${runValue} tokens`}. The router applies ` +
          'this on its next config check (fail-soft boundary).',
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Loading model config…</p>
      </div>
    );
  }
  if (state === 'error' || data === null) {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Couldn&apos;t load the model-config boundary. Try refreshing.</p>
      </div>
    );
  }
  if (data.status.length === 0) {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">
          No published router status yet. Run{' '}
          <code>tools/llm-router npx tsx scripts/publish-status.ts</code> to project
          router.config.json + the budget ledger into the read boundary.
        </p>
      </div>
    );
  }

  const testMode = data.status.find((r) => r.test_mode);
  const publishedAt = data.status[0].published_at;
  const stale = isStale(publishedAt, Date.now());
  const spendByNode = new Map(data.spend.map((r) => [r.node, r]));
  const overrideByNode = new Map(data.overrides.map((r) => [r.node, r]));

  const rows = data.status.map((s) => {
    const o = overrideByNode.get(s.node);
    const dayCap = effectiveCap(s.per_day_usd_cap, o?.per_day_usd_cap);
    const runCap = effectiveCap(s.per_run_token_cap, o?.per_run_token_cap);
    const usdToday = spendByNode.get(s.node)?.usd ?? 0;
    return {
      status: s,
      dayCap,
      runCap,
      usdToday,
      fraction: spendFraction(usdToday, dayCap.value),
      hardStopped: isHardStopped(usdToday, dayCap.value, s.hard_stop_fraction),
    };
  });
  const totalUsdToday = rows.reduce((sum, r) => sum + r.usdToday, 0);
  const totalDayCap = rows.reduce((sum, r) => sum + r.dayCap.value, 0);

  return (
    <div className="ingest-grid">
      {testMode ? (
        <div className="panel ingest-panel models-testmode" role="status">
          <div className="eyebrow panel__label">TEST-MODE</div>
          <p className="fmt__cap">
            <strong>scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)</strong>
          </p>
          <p className="fmt__cap">{testMode.test_mode_reason}</p>
        </div>
      ) : null}

      {/* Per-node config + spend */}
      <div className="panel ingest-panel models-nodes-panel">
        <div className="eyebrow panel__label">Model nodes (router.config.json snapshot)</div>
        <div className="models-table-wrap">
          <table className="models-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Model</th>
                <th>Route</th>
                <th>Max out</th>
                <th>Day cap (US$)</th>
                <th>Run cap (tok)</th>
                <th>Today US$</th>
                <th>% of cap</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status.node}>
                  <td>{r.status.node}</td>
                  <td>{r.status.model_id}</td>
                  <td>{r.status.route}</td>
                  <td>{r.status.max_output_tokens}</td>
                  <td>
                    {r.dayCap.value.toFixed(2)}
                    {r.dayCap.overridden ? <span className="models-override"> (override)</span> : null}
                  </td>
                  <td>
                    {r.runCap.value}
                    {r.runCap.overridden ? <span className="models-override"> (override)</span> : null}
                  </td>
                  <td>{r.usdToday.toFixed(8)}</td>
                  <td>{(r.fraction * 100).toFixed(2)}%</td>
                  <td>
                    {r.hardStopped ? (
                      <span className="ingest-pause__badge ingest-pause__badge--paused">
                        HARD-STOP ≥{Math.round(r.status.hard_stop_fraction * 100)}%
                      </span>
                    ) : (
                      <span className="ingest-pause__badge ingest-pause__badge--running">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fmt__cap">
          Snapshot published {fmtWhen(publishedAt)}
          {stale ? (
            <span className="ingest-error">
              {' '}
              — STALE (&gt;1h old). The boundary is publish-driven; re-run
              tools/llm-router&apos;s publish-status script for fresh numbers.
            </span>
          ) : null}
        </p>
      </div>

      {/* Spend vs budget */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Spend vs budget ({data.today})</div>
        <p className="fmt__cap">
          Today across all nodes: <strong>US${totalUsdToday.toFixed(8)}</strong> of a combined
          per-day cap of <strong>US${totalDayCap.toFixed(2)}</strong> (
          {(spendFraction(totalUsdToday, totalDayCap) * 100).toFixed(3)}%).
        </p>
        <p className="fmt__cap">
          Run 2.0 budget context: <strong>{RUN_CAP_SGD_OPENAI} SGD</strong> total OpenAI ·{' '}
          <strong>{RUN_CAP_SGD_ANTHROPIC} SGD</strong> Anthropic (verifier decorrelation only) —
          per docs/temp/run2/orchestration-log.md §Budget. Per-day caps above are
          router.config.json values; spend is the router&apos;s own ledger, republished on demand.
        </p>
      </div>

      {/* Caps editor — THE demo-exception write surface (caps only) */}
      <div className="panel ingest-panel">
        <div className="eyebrow panel__label">Edit caps (writes llm_router_cap_overrides)</div>
        <p className="fmt__cap">
          Per-node overrides REPLACE the file caps in the router (fail-soft: an unreachable
          boundary falls back to file caps). Blank clears the override. Bounds: day cap ≤ US$5.00,
          run cap ≤ 200000 tokens. Caps only — models and routes are config-file-owned.
        </p>
        {rows.map((r) => {
          const draft = drafts[r.status.node] ?? { day: '', run: '' };
          return (
            <form
              key={r.status.node}
              className="ingest-form"
              onSubmit={(e) => void saveCaps(e, r.status.node)}
            >
              <span className="models-editor-node">{r.status.node}</span>
              <span className="ingest-form__prefix">$</span>
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={5}
                value={draft.day}
                onChange={(e) =>
                  setDrafts({ ...drafts, [r.status.node]: { ...draft, day: e.target.value } })
                }
                placeholder={`${r.status.per_day_usd_cap.toFixed(2)} (file)`}
                aria-label={`${r.status.node} per-day USD cap override`}
              />
              <input
                type="number"
                step="1"
                min={1}
                max={200000}
                value={draft.run}
                onChange={(e) =>
                  setDrafts({ ...drafts, [r.status.node]: { ...draft, run: e.target.value } })
                }
                placeholder={`${r.status.per_run_token_cap} (file)`}
                aria-label={`${r.status.node} per-run token cap override`}
              />
              <button type="submit" className="ingest-btn" disabled={busy}>
                Save
              </button>
            </form>
          );
        })}
        {savedMessage ? <p className="fmt__cap ingest-success">{savedMessage}</p> : null}
      </div>

      {error ? <p className="ingest-error">{error}</p> : null}
    </div>
  );
}
