'use client';

// ourobion nao — claims & verdicts curation panel (Client Component, O13 / demo
// feature (b), run-2 U9).
//
// Renders relationship claims (subject → relation → object, derivation, quote
// spans, citations), each one's latest verifier verdict stamped with the
// verbatim TEST-MODE label (all verdicts this cycle are interim, single-provider,
// decorrelation OFF — B5 pending), the O13 human-verdict status, and the ONE
// write action: REJECT (optional reason) → POST /api/claims/reject. A reject is
// recorded on top of the verifier (never an edit) and supersedes it for serving;
// no human action = the verifier default stands. Follows ModelsPanel's
// fetch/busy/error conventions and reuses the ingest panel styles.
//
// Used twice: the /claims page (all claims) and the per-paper "Claims &
// verdicts" section on /paper/[uid] (paperUid prop → citation containment
// filter server-side).
//
// R4 viewer read-only UX: reading claims and verdicts is open to every caller
// who can reach this page, so the cards, quotes and citations stay live. REJECT
// is the panel's only write and is gated on the route it posts to.
import { useCallback, useEffect, useState } from 'react';
import { TEST_MODE_LABEL, type ClaimView } from '@/lib/claimsControl';
import { ControlNote, useControlGate } from './NaoAccess';

const REJECT_ROUTE = 'POST /api/claims/reject';

interface ClaimsPanelProps {
  /** When set, only claims whose citations include this paper are shown. */
  paperUid?: string;
}

type LoadState = 'loading' | 'ready' | 'error';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function ClaimsPanel({ paperUid }: ClaimsPanelProps) {
  const gate = useControlGate();
  const [state, setState] = useState<LoadState>('loading');
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [busyEdge, setBusyEdge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Per-edge optional reject reason drafts.
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const url = paperUid ? `/api/claims?paper=${encodeURIComponent(paperUid)}` : '/api/claims';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const next = (await res.json()) as { claims: ClaimView[] };
      setClaims(next.claims);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [paperUid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function reject(edgeId: string): Promise<void> {
    setBusyEdge(edgeId);
    setError(null);
    setMessage(null);
    try {
      const reason = (reasons[edgeId] ?? '').trim();
      const res = await fetch('/api/claims/reject', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edgeId, reason: reason === '' ? null : reason }),
      });
      const result = (await res.json()) as { ok: true } | { error: string };
      if (!res.ok || !('ok' in result)) {
        throw new Error('error' in result ? result.error : `HTTP ${res.status}`);
      }
      setMessage(
        `Recorded human REJECT for ${edgeId} — supersedes the verifier for serving; ` +
          'new cards will not cite this edge. The verifier verdict itself is untouched ' +
          '(recorded override, not an edit).',
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEdge(null);
    }
  }

  if (state === 'loading') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Loading claims…</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">Couldn&apos;t load claims. Try refreshing.</p>
      </div>
    );
  }
  if (claims.length === 0) {
    return (
      <div className="panel ingest-panel">
        <p className="fmt__cap">
          {paperUid
            ? 'No relationship claims cite this paper.'
            : 'No relationship claims loaded. Run tools/edge-loader against the edge artifacts to project them.'}
        </p>
      </div>
    );
  }

  return (
    <div className="ingest-grid">
      <div className="panel ingest-panel models-testmode" role="status">
        <div className="eyebrow panel__label">TEST-MODE</div>
        <p className="fmt__cap">
          All verifier verdicts below are interim: <strong>{TEST_MODE_LABEL}</strong>. The
          verifier default stands unless a human records a REJECT (O13); nothing here is an
          independent verification claim.
        </p>
        {/* Once, here, rather than under every card: the reason is the same for all of them. */}
        <ControlNote route={REJECT_ROUTE} />
      </div>

      {claims.map((c) => {
        const rejected = c.humanVerdict === 'reject';
        return (
          <div key={c.edgeId} className="panel ingest-panel claims-card">
            <div className="eyebrow panel__label">
              {c.subject} → {c.relation} → {c.object}
            </div>
            <p className="fmt__cap claims-edgeid">{c.edgeId}</p>
            {c.claimKind ? <p className="fmt__cap">Claim kind: {c.claimKind}</p> : null}
            {c.population ? <p className="fmt__cap">Population: {c.population}</p> : null}
            {c.derivation ? <p className="fmt__cap">Derivation: {c.derivation}</p> : null}

            {c.quoteSpans.length > 0 ? (
              <div className="claims-quotes">
                {c.quoteSpans.map((q, i) => (
                  <blockquote key={i} className="claims-quote">
                    &ldquo;{q.quote}&rdquo;
                    <span className="claims-quote__src">
                      — {q.paperId}
                      {q.locator ? `, ${q.locator}` : ''}
                    </span>
                  </blockquote>
                ))}
              </div>
            ) : null}

            {c.citations.length > 0 ? (
              <div className="claims-citations">
                {c.citations.map((cit, i) => (
                  <p key={i} className="fmt__cap">
                    {cit.paperId} · {cit.title}
                    {cit.year !== null ? ` (${cit.year})` : ''}
                    {cit.evidenceTier !== undefined ? ` · evidence tier ${cit.evidenceTier}` : ''}
                    {cit.stance ? ` · ${cit.stance}` : ''}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="claims-verdict">
              {c.verification ? (
                <p className="fmt__cap">
                  Verifier verdict: <strong>{c.verification.verdict}</strong> · band{' '}
                  {c.verification.servingBand} · score {c.verification.edgeScore.toFixed(3)} ·{' '}
                  {fmtWhen(c.verification.verifiedAt)}{' '}
                  <span className="claims-stamp">[{TEST_MODE_LABEL}]</span>
                </p>
              ) : (
                <p className="fmt__cap">
                  No active verification yet — nothing servable for this claim.
                </p>
              )}
              {rejected ? (
                <p className="fmt__cap">
                  <span className="ingest-pause__badge ingest-pause__badge--paused">
                    REJECTED BY HUMAN
                  </span>{' '}
                  {c.humanVerdictAt ? fmtWhen(c.humanVerdictAt) : ''} — supersedes the verifier
                  for serving (new cards will not cite this edge; already-served cards keep
                  honest provenance).
                </p>
              ) : (
                <p className="fmt__cap">
                  No human check — the verifier verdict stands (interim until B5).
                </p>
              )}
            </div>

            {!rejected && c.verification ? (
              <div className="ingest-form claims-reject">
                <input
                  type="text"
                  value={reasons[c.edgeId] ?? ''}
                  onChange={(e) => setReasons({ ...reasons, [c.edgeId]: e.target.value })}
                  placeholder="Reason (optional)"
                  maxLength={2000}
                  aria-label={`Reason for rejecting ${c.edgeId}`}
                  {...gate(REJECT_ROUTE)}
                />
                <button
                  type="button"
                  className="ingest-btn claims-reject__btn"
                  onClick={() => void reject(c.edgeId)}
                  {...gate(REJECT_ROUTE, busyEdge !== null)}
                >
                  {busyEdge === c.edgeId ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {message ? <p className="fmt__cap ingest-success">{message}</p> : null}
      {error ? <p className="ingest-error">{error}</p> : null}
    </div>
  );
}
