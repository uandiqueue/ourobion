// ourobion nao — Overview dashboard (v1). "What the pipeline did."
//
// Server component. Reads corpus-wide aggregates from the D1 index (corpusStats)
// — NEVER R2 per request, NEVER full text. Every number here mirrors the
// ingestion pipeline's own work: discovery, retrievability, fetch, format
// conversion. No nao-derived facts, no quality/rating (v1 scope).
//
// MUST be dynamic: it touches the D1 binding via getCloudflareContext().
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { corpusStats } from '@/lib/d1';
import type { CorpusStats, FacetBucket } from '@/lib/d1';
import {
  oaColor,
  retrievabilityColor,
  humanBytes,
  humanCount,
} from '@/lib/palette';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Overview · ourobion nao',
  description: 'What the ingestion pipeline did — corpus coverage and conversion.',
};

// ── small helpers ────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtRun(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hh}:${mm}`;
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

const SOURCE_LABEL: Record<string, string> = {
  crossref: 'Crossref',
  pubmed: 'PubMed',
  europepmc: 'Europe PMC',
  semanticscholar: 'Semantic Scholar',
  arxiv: 'arXiv',
  biorxiv: 'bioRxiv',
  openalex: 'OpenAlex',
  core: 'CORE',
};

const METHOD_COLOR: Record<string, string> = {
  jats: '#2bc4be',
  core: '#2fb7d6',
  pdf: '#3fa2e6',
  html: '#5e8df0',
};

function maxCount(buckets: FacetBucket[]): number {
  return Math.max(1, ...buckets.map((b) => b.count));
}

// ── presentational sub-components (server) ────────────────────────────────────
function PanelLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="eyebrow panel__label" style={style}>
      {children}
    </div>
  );
}

function BarRow({
  label,
  count,
  widthPct,
  background,
  labelWidth,
}: {
  label: string;
  count: number;
  widthPct: number;
  background: string;
  labelWidth: number;
}) {
  return (
    <div className="bar-row">
      <span className="bar-label" style={{ width: labelWidth }}>
        {label}
      </span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${widthPct}%`, background }} />
      </span>
      <span className="bar-val">{count.toLocaleString()}</span>
    </div>
  );
}

const RET_ORDER = ['pdf', 'html', 'paywalled', 'unknown'];

function retrievabilityConic(buckets: FacetBucket[], total: number): string {
  if (total <= 0) return 'var(--chart-muted)';
  const map = new Map(buckets.map((b) => [b.value, b.count]));
  const ordered = [
    ...RET_ORDER.filter((k) => map.has(k)),
    ...buckets.map((b) => b.value).filter((v) => !RET_ORDER.includes(v)),
  ];
  let acc = 0;
  const stops: string[] = [];
  for (const v of ordered) {
    const c = map.get(v) ?? 0;
    const start = (acc / total) * 100;
    acc += c;
    const end = (acc / total) * 100;
    stops.push(`${retrievabilityColor(v)} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
  }
  return `conic-gradient(${stops.join(',')})`;
}

// ── page ──────────────────────────────────────────────────────────────────────
export default async function OverviewPage() {
  const s: CorpusStats = await corpusStats();

  if (s.total === 0) {
    return (
      <div className="ov">
        <PageHead lastRun={null} />
        <div className="empty">
          <div className="empty__ring" aria-hidden />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Corpus is empty</p>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Run the ingestion pipeline, then <code>npm run etl</code> to populate the index.
          </p>
        </div>
      </div>
    );
  }

  const retrievablePct = pct(s.retrievable, s.total);
  const topicMax = maxCount(s.topicTags);
  const sourceMax = maxCount(s.discoveredVia);
  const methodMax = maxCount(s.method);
  const oaMax = maxCount(s.oaStatus);
  const years = [...s.year].sort((a, b) => Number(a.value) - Number(b.value));
  const yearMax = maxCount(years);
  const storage = humanBytes(s.storageBytes); // e.g. "42.0 GB"
  const [storageNum, storageUnit] = storage === '—' ? ['—', ''] : storage.split(' ');

  const funnel = [
    {
      label: 'Explored',
      count: s.total,
      width: 100,
      background: 'linear-gradient(90deg,var(--deep-1),var(--deep-2))',
    },
    {
      label: 'Retrievable',
      count: s.retrievable,
      width: pct(s.retrievable, s.total),
      background: 'linear-gradient(90deg,var(--deep-2),var(--deep-3))',
    },
    {
      label: 'Fetched',
      count: s.fetched,
      width: pct(s.fetched, s.total),
      background: 'linear-gradient(90deg,var(--deep-3),var(--deep-4))',
    },
    {
      label: 'Text-extracted',
      count: s.extracted,
      width: pct(s.extracted, s.total),
      background: 'linear-gradient(90deg,var(--deep-4),var(--deep-5))',
    },
  ];

  return (
    <div className="ov">
      <PageHead lastRun={s.lastFetchedAt} />

      {/* KPI tiles */}
      <div className="kpis ov__row">
        <div className="kpi kpi--teal">
          <div className="eyebrow">Papers discovered</div>
          <div className="kpi__num">{s.total.toLocaleString()}</div>
          <div className="kpi__sub">across {s.topicTags.length} topic seeds</div>
        </div>
        <div className="kpi kpi--blue">
          <div className="eyebrow" style={{ color: 'var(--accent-3)' }}>
            Retrievable
          </div>
          <div className="kpi__num">
            {retrievablePct}
            <span className="kpi__unit">%</span>
          </div>
          <div className="kpi__sub">
            {s.retrievable.toLocaleString()} of {s.total.toLocaleString()}
          </div>
        </div>
        <div className="kpi kpi--teal">
          <div className="eyebrow">Full text extracted</div>
          <div className="kpi__num">{s.extracted.toLocaleString()}</div>
          <div className="kpi__sub">{humanCount(s.totalCharCount)} characters</div>
        </div>
        <Link href="/papers?status=failed" className="kpi kpi--muted">
          <div className="eyebrow" style={{ color: 'var(--text-muted)' }}>
            Failed
          </div>
          <div className="kpi__num">{s.failed.toLocaleString()}</div>
          <div className="kpi__sub">
            view records <span className="kpi__sub-arrow">→</span>
          </div>
        </Link>
      </div>

      {/* Ingestion funnel */}
      <div className="panel ov__row">
        <PanelLabel>Ingestion funnel</PanelLabel>
        <div className="funnel">
          {funnel.map((f) => (
            <div key={f.label} className="funnel__row">
              <span className="funnel__label">{f.label}</span>
              <span
                className="funnel__bar"
                style={{ width: `${Math.max(f.width, 6)}%`, background: f.background }}
              >
                <span className="funnel__bar-val">{f.count.toLocaleString()}</span>
              </span>
              <span className="funnel__grow" />
              <span className="funnel__pct">{pct(f.count, s.total)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Retrievability donut + OA bars */}
      <div className="ov-grid-2 ov__row">
        <div className="panel">
          <PanelLabel>Retrievability</PanelLabel>
          <div className="donut">
            <div
              className="donut__ring"
              style={{ background: retrievabilityConic(s.retrievability, s.total) }}
            >
              <div className="donut__hole">
                <span className="donut__hole-num">{retrievablePct}%</span>
                <span className="donut__hole-cap">retrievable</span>
              </div>
            </div>
            <div className="donut__legend">
              {[...s.retrievability]
                .sort((a, b) => RET_ORDER.indexOf(a.value) - RET_ORDER.indexOf(b.value))
                .map((b) => (
                  <div key={b.value} className="legend-row">
                    <span
                      className="legend-swatch"
                      style={{ background: retrievabilityColor(b.value) }}
                    />
                    <span className="legend-label">{b.value}</span>
                    <span className="legend-val">{b.count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <PanelLabel>Open-access status</PanelLabel>
          <div className="bars">
            {s.oaStatus.map((b) => (
              <BarRow
                key={b.value}
                label={b.value}
                count={b.count}
                widthPct={(b.count / oaMax) * 100}
                background={oaColor(b.value)}
                labelWidth={62}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Topic seeds + discovery source */}
      <div className="ov-grid-2 ov__row">
        <div className="panel">
          <PanelLabel>By topic seed</PanelLabel>
          <div className="bars">
            {s.topicTags.map((b) => (
              <BarRow
                key={b.value}
                label={b.value}
                count={b.count}
                widthPct={(b.count / topicMax) * 100}
                background="linear-gradient(90deg,var(--deep-1),var(--deep-3))"
                labelWidth={128}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelLabel>By discovery source</PanelLabel>
          <div className="bars">
            {s.discoveredVia.map((b) => (
              <BarRow
                key={b.value}
                label={SOURCE_LABEL[b.value] ?? b.value}
                count={b.count}
                widthPct={(b.count / sourceMax) * 100}
                background="var(--accent-3)"
                labelWidth={96}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Year histogram + format conversion */}
      <div className="ov-grid-year ov__row">
        <div className="panel">
          <PanelLabel>By publication year</PanelLabel>
          {years.length > 0 ? (
            <div className="hist">
              {years.map((b) => (
                <div key={b.value} className="hist__col">
                  <div
                    className="hist__bar"
                    style={{ height: `${(b.count / yearMax) * 100}%` }}
                    title={`${b.value}: ${b.count.toLocaleString()}`}
                  />
                  <span className="hist__label">{`'${String(b.value).slice(-2)}`}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="fmt__cap">No year data.</p>
          )}
        </div>

        <div className="panel fmt">
          <PanelLabel>Format conversion</PanelLabel>
          <div className="bars">
            {s.method.map((b) => (
              <BarRow
                key={b.value}
                label={b.value.toUpperCase()}
                count={b.count}
                widthPct={(b.count / methodMax) * 100}
                background={METHOD_COLOR[b.value] ?? 'var(--accent-3)'}
                labelWidth={54}
              />
            ))}
          </div>
          <div className="fmt__footer">
            <span className="fmt__big">{humanCount(s.totalCharCount)}</span>
            <span className="fmt__cap">characters from {s.extracted.toLocaleString()} papers</span>
          </div>
        </div>
      </div>

      {/* Work type + storage + failures */}
      <div className="ov-grid-3 ov__row">
        <div className="panel">
          <PanelLabel>By work type</PanelLabel>
          <div className="wt">
            {s.workType.length > 0 ? (
              s.workType.map((b) => (
                <div key={b.value} className="wt__tile">
                  <div className="wt__num">{b.count.toLocaleString()}</div>
                  <div className="wt__cap">{b.value}</div>
                </div>
              ))
            ) : (
              <p className="fmt__cap">No work-type data.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <PanelLabel>Storage</PanelLabel>
          <div className="storage__num">
            ≈ {storageNum}
            {storageUnit ? <span className="storage__unit"> {storageUnit}</span> : null}
          </div>
          <div className="storage__cap">across {s.storedObjects.toLocaleString()} stored objects</div>
        </div>

        <Link href="/papers?status=failed" className="panel panel--inset failtile">
          <PanelLabel style={{ color: 'var(--text-muted)', marginBottom: 10 }}>Failures</PanelLabel>
          <div className="failtile__row">
            <span className="failtile__num">{s.failed.toLocaleString()}</span>
            <span className="failtile__link">view records →</span>
          </div>
          <div className="failtile__cap">fetch &amp; extraction errors</div>
        </Link>
      </div>

      {/* v2 knowledge-graph teaser */}
      <div className="teaser ov__row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="teaser__mark" src="/brand/ourobion-mark-dark.svg" alt="" aria-hidden />
        <div className="teaser__body">
          <div className="eyebrow teaser__eyebrow">Coming in v2</div>
          <h2 className="teaser__title">Knowledge graph</h2>
          <p className="teaser__text">
            Concepts, papers and derived facts woven into a single living map — the open loop
            closing in on itself. v1 ingests and catalogues the corpus; the graph arrives once the
            relations are extracted.
          </p>
        </div>
        <span className="teaser__badge">NOT YET AVAILABLE</span>
      </div>
    </div>
  );
}

function PageHead({ lastRun }: { lastRun: string | null }) {
  return (
    <div className="ov__head">
      <div>
        <div className="eyebrow">What the pipeline did</div>
        <h1 className="ov__title">Ingestion overview</h1>
      </div>
      <div className="ov__head-meta">
        <div className="ov__head-meta-label">Last ingest run</div>
        <div className="ov__head-meta-val">{fmtRun(lastRun)}</div>
      </div>
    </div>
  );
}
