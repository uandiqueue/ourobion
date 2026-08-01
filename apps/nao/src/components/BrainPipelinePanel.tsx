'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BRAIN_PIPELINE_CORPORA, BRAIN_PIPELINE_METRICS } from '@/lib/brainPipelineControl';
import type { BrainPipelineRun } from '@/lib/brainPipelineControl';
import type { ClaimView } from '@/lib/claimsControl';
import type { CapOverrideRow, ModelSpendRow, ModelStatusRow } from '@/lib/modelsControl';

type Dispatchability = 'active' | 'not_on_default_branch' | 'unregistered_or_invalid';
interface PipelineState {
  ok: true;
  dispatchability: Dispatchability;
  defaultBranch: string;
  runs: BrainPipelineRun[];
}
interface ModelsState {
  today: string;
  status: ModelStatusRow[];
  spend: ModelSpendRow[];
  overrides: CapOverrideRow[];
}
interface DispatchResponse {
  ok: true;
  operationId: string;
  dispatch: { run: { id: number; apiUrl: string; htmlUrl: string } | null };
}

const OWNER_SNAPSHOT = {
  observedAt: '2026-08-01',
  openAiUsd: 1.118,
  openAiCapUsd: 20,
  anthropicSgd: 0,
  anthropicCapSgd: 2,
  agnesCalls: 19,
  agnesCapCalls: 50,
} as const;

function when(iso: string | null): string {
  if (iso === null) return 'time unavailable';
  const value = new Date(iso);
  return Number.isNaN(value.getTime())
    ? iso
    : value.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function runLabel(run: BrainPipelineRun): string {
  return run.status === 'completed' ? (run.conclusion ?? 'completed') : run.status;
}

export function BrainPipelinePanel() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [models, setModels] = useState<ModelsState | null>(null);
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [spendBaseline, setSpendBaseline] = useState<number | null>(null);

  const [leftMetric, setLeftMetric] = useState('sleep_duration_min');
  const [rightMetric, setRightMetric] = useState('resting_hr_bpm');
  const [papers, setPapers] = useState('');
  const [artifactRevision, setArtifactRevision] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [corpus, setCorpus] = useState('');
  const [confirmSpend, setConfirmSpend] = useState('');

  const refresh = useCallback(async (): Promise<void> => {
    setLoadError(null);
    const results = await Promise.allSettled([
      fetch('/api/brain-pipeline').then(async (response) => {
        const body = await response.json() as PipelineState | { error?: string };
        if (!response.ok || !('dispatchability' in body)) {
          throw new Error('Pipeline registration could not be inspected.');
        }
        return body;
      }),
      fetch('/api/models').then(async (response) => {
        if (!response.ok) throw new Error('Published budget status could not be loaded.');
        return await response.json() as ModelsState;
      }),
      fetch('/api/claims').then(async (response) => {
        if (!response.ok) throw new Error('Projected verification results could not be loaded.');
        return await response.json() as { claims: ClaimView[] };
      }),
    ]);
    const [pipelineResult, modelsResult, claimsResult] = results;
    setPipeline(pipelineResult.status === 'fulfilled' ? pipelineResult.value : null);
    setModels(modelsResult.status === 'fulfilled' ? modelsResult.value : null);
    setClaims(claimsResult.status === 'fulfilled' ? claimsResult.value.claims : []);
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    setLoadError(errors.length > 0 ? errors.join(' ') : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const synthesisBudget = useMemo(() => {
    if (models === null) return null;
    const status = models.status.find((row) => row.node === 'synthesis');
    if (!status) return null;
    const override = models.overrides.find((row) => row.node === 'synthesis');
    const spend = models.spend.find((row) => row.node === 'synthesis')?.usd ?? 0;
    const dayCap = override?.per_day_usd_cap ?? status.per_day_usd_cap;
    return {
      model: status.model_id,
      spend,
      dayCap,
      hardStop: dayCap * status.hard_stop_fraction,
      remaining: Math.max(0, dayCap * status.hard_stop_fraction - spend),
      runCap: override?.per_run_token_cap ?? status.per_run_token_cap,
      publishedAt: status.published_at,
    };
  }, [models]);

  const verifierModel = models?.status.find((row) => row.node === 'verifier')?.model_id ?? null;
  const verified = claims
    .filter((claim): claim is ClaimView & { verification: NonNullable<ClaimView['verification']> } =>
      claim.verification !== null)
    .sort((a, b) => b.verification.verifiedAt.localeCompare(a.verification.verifiedAt));
  const observedDelta = spendBaseline !== null && synthesisBudget !== null
    ? Math.max(0, synthesisBudget.spend - spendBaseline)
    : null;
  const dispatchable = pipeline?.dispatchability === 'active';
  const formReady =
    dispatchable &&
    leftMetric !== rightMetric &&
    papers.trim() !== '' &&
    artifactRevision.trim() !== '' &&
    (dryRun || (corpus !== '' && confirmSpend === 'RUN'));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setActionError(null);
    setMessage(null);
    if (!formReady) {
      setActionError('Complete the required run inputs before dispatch.');
      return;
    }
    setBusy(true);
    setSpendBaseline(synthesisBudget?.spend ?? null);
    try {
      const response = await fetch('/api/brain-pipeline', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Ourobion-Operation-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          pair: [leftMetric, rightMetric],
          papers,
          artifactRevision,
          corpus,
          dryRun,
          confirmSpend: dryRun ? '' : confirmSpend,
        }),
      });
      const result = await response.json() as DispatchResponse | { error: string; operationId?: string };
      if (!response.ok || !('ok' in result)) {
        throw new Error('error' in result ? result.error : 'Dispatch failed with HTTP ' + response.status + '.');
      }
      setMessage(
        result.dispatch.run
          ? 'Dispatch accepted as run ' + result.dispatch.run.id + '. Operation ' + result.operationId + '.'
          : 'Dispatch accepted without a run identity. Operation ' + result.operationId + '.',
      );
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel ingest-panel"><p className="fmt__cap">Inspecting pipeline registration…</p></div>;
  }

  return (
    <div className="ingest-grid brain-pipeline">
      <section className="panel ingest-panel brain-pipeline__wide" aria-live="polite">
        <div className="eyebrow panel__label">Dispatchability</div>
        {pipeline?.dispatchability === 'active' ? (
          <p className="fmt__cap ingest-success">
            Dispatchable from the default branch <code>{pipeline.defaultBranch}</code>.
          </p>
        ) : pipeline?.dispatchability === 'not_on_default_branch' ? (
          <p className="fmt__cap brain-pipeline__blocked" role="status">
            <strong>Not dispatchable: workflow not on default branch.</strong>{' '}
            GitHub has not registered <code>brain-pipeline.yml</code> on <code>{pipeline.defaultBranch}</code>.
            The form stays disabled until the owner moves it.
          </p>
        ) : pipeline?.dispatchability === 'unregistered_or_invalid' ? (
          <p className="fmt__cap brain-pipeline__blocked" role="status">
            <strong>Not dispatchable: workflow is unregistered, invalid, or inactive on the default branch.</strong>
          </p>
        ) : (
          <p className="fmt__cap brain-pipeline__blocked" role="status">
            <strong>Dispatchability is unknown.</strong> No run can start until registration is confirmed.
          </p>
        )}
        <button type="button" className="ingest-btn ingest-btn--ghost" onClick={() => void refresh()} disabled={busy}>
          Refresh status
        </button>
      </section>

      <section className="panel ingest-panel brain-pipeline__wide">
        <div className="eyebrow panel__label">Bounded run</div>
        <form className="brain-pipeline__form" onSubmit={submit}>
          <div className="brain-pipeline__pair">
            <label>
              Metric A
              <select value={leftMetric} onChange={(event) => setLeftMetric(event.target.value)}>
                {BRAIN_PIPELINE_METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>{metric.label} · {metric.key}</option>
                ))}
              </select>
            </label>
            <label>
              Metric B
              <select value={rightMetric} onChange={(event) => setRightMetric(event.target.value)}>
                {BRAIN_PIPELINE_METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>{metric.label} · {metric.key}</option>
                ))}
              </select>
            </label>
          </div>
          {leftMetric === rightMetric ? <p className="fmt__cap brain-pipeline__blocked">Choose two different metrics.</p> : null}
          <label>
            Paper UIDs
            <textarea
              value={papers}
              onChange={(event) => setPapers(event.target.value)}
              placeholder="One DOI, PMID, or paper UID per line"
              rows={3}
              required
            />
          </label>
          <label>
            Artifact revision
            <input
              type="text"
              value={artifactRevision}
              onChange={(event) => setArtifactRevision(event.target.value)}
              placeholder="Required; no default"
              autoComplete="off"
              required
            />
          </label>
          <label className="brain-pipeline__mode">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => {
                setDryRun(event.target.checked);
                setConfirmSpend('');
              }}
            />
            Dry run — no provider call, R2 write, or database write
          </label>
          <label>
            Verification corpus
            <select value={corpus} onChange={(event) => setCorpus(event.target.value)} required={!dryRun}>
              <option value="">{dryRun ? 'None (allowed for dry run)' : 'Select a corpus for a live run'}</option>
              {BRAIN_PIPELINE_CORPORA.map((path) => <option key={path} value={path}>{path}</option>)}
            </select>
          </label>
          {!dryRun ? (
            <label>
              Type RUN to authorize live provider spend
              <input
                type="text"
                value={confirmSpend}
                onChange={(event) => setConfirmSpend(event.target.value)}
                placeholder="RUN"
                autoComplete="off"
                required
              />
            </label>
          ) : null}

          <div className="brain-pipeline__estimate" role="status">
            <strong>Pre-run estimate</strong>
            {dryRun ? (
              <span>Provider cost: US$0.00. Provider calls are disabled.</span>
            ) : synthesisBudget ? (
              <span>
                Synthesis is bounded to at most {'US$'}{synthesisBudget.remaining.toFixed(6)} before the
                published daily hard stop and {synthesisBudget.runCap.toLocaleString()} output tokens
                per run. Input size and verification claim count are not known before the run, so a
                narrower estimate would be misleading.
              </span>
            ) : (
              <span>Live cost cannot be bounded from the published model snapshot, so dispatch remains unsafe.</span>
            )}
            <span>
              Dated owner ceiling snapshot ({OWNER_SNAPSHOT.observedAt}): OpenAI {'US$'}
              {OWNER_SNAPSHOT.openAiUsd.toFixed(3)} of {OWNER_SNAPSHOT.openAiCapUsd};
              Anthropic {OWNER_SNAPSHOT.anthropicSgd} of SGD {OWNER_SNAPSHOT.anthropicCapSgd} — do not use;
              Agnes {OWNER_SNAPSHOT.agnesCalls} of {OWNER_SNAPSHOT.agnesCapCalls} calls.
              The reviewed workflow chooses providers; this UI offers no provider or cap override.
            </span>
          </div>

          <button type="submit" className="ingest-btn" disabled={busy || !formReady || (!dryRun && synthesisBudget === null)}>
            {busy ? 'Dispatching…' : dryRun ? 'Dispatch dry run' : 'Dispatch live run'}
          </button>
        </form>
        {message ? <p className="fmt__cap ingest-success">{message}</p> : null}
        {actionError ? <p className="fmt__cap brain-pipeline__blocked">{actionError}</p> : null}
      </section>

      <section className="panel ingest-panel">
        <div className="eyebrow panel__label">Published spend boundary</div>
        {synthesisBudget ? (
          <>
            <p className="fmt__cap">
              Synthesis · {synthesisBudget.model} · {'US$'}{synthesisBudget.spend.toFixed(8)} today ·
              hard stop {'US$'}{synthesisBudget.hardStop.toFixed(2)} · cap {'US$'}{synthesisBudget.dayCap.toFixed(2)}.
            </p>
            <p className="fmt__cap">Snapshot published {when(synthesisBudget.publishedAt)}.</p>
            <p className="fmt__cap">
              {observedDelta === null
                ? 'Per-run actual is not available before a dispatch.'
                : 'Observed published synthesis-ledger delta since dispatch: US$' + observedDelta.toFixed(8) + '.'}
              {' '}The ledger is day-and-node scoped, not run-isolated.
            </p>
          </>
        ) : (
          <p className="fmt__cap">No published synthesis budget snapshot is available.</p>
        )}
        <p className="fmt__cap">
          Verifier config: {verifierModel ?? 'not published'}. The workflow does not publish a
          structured per-run usage artifact, so Nao does not claim an exact run cost.
        </p>
      </section>

      <section className="panel ingest-panel">
        <div className="eyebrow panel__label">Recent workflow runs</div>
        {pipeline?.runs.length ? (
          <ul className="brain-pipeline__list">
            {pipeline.runs.map((run) => (
              <li key={run.id}>
                <a href={run.htmlUrl} target="_blank" rel="noreferrer">Run {run.id}</a>
                <span className="brain-pipeline__badge">{runLabel(run)}</span>
                <span>{when(run.updatedAt ?? run.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="fmt__cap">No registered workflow runs are available.</p>}
      </section>

      <section className="panel ingest-panel brain-pipeline__wide">
        <div className="eyebrow panel__label">Projected verification outcomes</div>
        <p className="fmt__cap">
          {verified.length} active verified edge{verified.length === 1 ? '' : 's'}. Zero is a valid
          projection state. Unsupported and uncertain verdicts are completed results, not failures.
        </p>
        {verified.length > 0 ? (
          <div className="brain-pipeline__results">
            {verified.slice(0, 10).map((claim) => {
              const result = claim.verification;
              return (
                <article key={claim.edgeId} className="brain-pipeline__result">
                  <div>
                    <strong>{claim.subject} · {claim.relation} · {claim.object}</strong>
                    <span className="brain-pipeline__badge">{result.verdict}</span>
                  </div>
                  <p className="fmt__cap">
                    Confidence {result.confidence === null ? 'not reported' : result.confidence.toFixed(2)}
                    {' · '}quote gate {result.quoteCheck
                      ? result.quoteCheck.spansFound + '/' + result.quoteCheck.spansTotal
                      : 'not reported'}
                    {' · '}corroboration {result.corroboration
                      ? result.corroboration.supporting + ' supporting / ' + result.corroboration.contradicting + ' contradicting'
                      : 'not reported'}
                    {' · '}verifier {result.verifierIdentity ?? 'not reported'}
                    {result.providerFamily ? ' (' + result.providerFamily + ')' : ''}
                    {result.decorrelated === true ? ' · family-decorrelated' : ''}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {loadError ? <p className="ingest-error">{loadError}</p> : null}
    </div>
  );
}
