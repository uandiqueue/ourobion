// ourobion nao — per-paper detail (v1).
//
// Server component. Reads the FULL PaperRecord metadata from R2 via the native
// CORPUS binding (getPaperMeta): bibliographic header, OA {status,license,
// version,bestOaUrl}, journal, citation count, every identifier, topics +
// concepts, and the pipeline/provenance record (discovery → fetch → extraction →
// storage). All FACTS that mirror the ingestion pipeline — no quality/rating.
//
// HARD RULE (NAO-DESIGN §6/§9): NEVER fetch or render full paper text
// (text/<uid>.txt). Only the metadata record is read.
//
// MUST be dynamic: touches the R2 binding via getCloudflareContext().
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PaperRecord } from '@/lib/types';
import { getPaperMeta } from '@/lib/r2';
import { CollapsibleAbstract } from '@/components/CollapsibleAbstract';
import {
  oaColor,
  retrievabilityColor,
  workTypeColor,
  statusColor,
  humanBytes,
} from '@/lib/palette';

export const dynamic = 'force-dynamic';

type Params = { uid: string };

export const metadata: Metadata = {
  title: 'Paper · ourobion nao',
};

const ID_LABELS: Record<string, string> = {
  doi: 'DOI',
  pmid: 'PMID',
  pmcid: 'PMCID',
  arxiv: 'arXiv',
  openalex: 'OpenAlex',
  s2: 'Semantic Scholar',
};
const ID_ORDER = ['doi', 'pmid', 'pmcid', 'arxiv', 'openalex', 's2'];

function idHref(kind: string, value: string): string | null {
  switch (kind) {
    case 'doi':
      return `https://doi.org/${value}`;
    case 'pmid':
      return `https://pubmed.ncbi.nlm.nih.gov/${value}/`;
    case 'pmcid':
      return `https://www.ncbi.nlm.nih.gov/pmc/articles/${value}/`;
    case 'arxiv':
      return `https://arxiv.org/abs/${value}`;
    case 'openalex':
      return `https://openalex.org/${value}`;
    default:
      return null;
  }
}

function FactChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="fact-chip fact-chip--lg">
      <span className="fact-chip__dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export default async function PaperDetailPage({ params }: { params: Promise<Params> }) {
  const { uid } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(uid);
  } catch {
    notFound();
  }
  const paper: PaperRecord | null = await getPaperMeta(decoded);
  if (paper === null) {
    notFound();
  }

  const authorsFull = paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown authors';
  const citedBy = paper.metrics?.citedByCount ?? null;
  const primaryTopic = paper.topicTags[0] ?? paper.workType ?? 'record';
  const venueLine = [paper.year !== null ? String(paper.year) : null, paper.venue]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ');

  const identifiers = ID_ORDER.flatMap((kind) => {
    const value = (paper.identifiers as Record<string, string | undefined>)[kind];
    return typeof value === 'string' && value.length > 0 ? [{ kind, value }] : [];
  });

  const allTags = [...paper.topicTags, ...(paper.concepts ?? [])];

  const provenance: Array<{ k: string; v: string }> = [
    { k: 'discoveredVia', v: paper.discoveredVia || '—' },
    { k: 'status', v: paper.status },
    { k: 'fetchedAt', v: paper.fetchedAt ? paper.fetchedAt.replace('T', ' ').replace('Z', ' UTC') : '—' },
    { k: 'retrievability', v: paper.retrievability },
    { k: 'fullText.extracted', v: String(paper.fullText.extracted) },
    { k: 'fullText.method', v: paper.fullText.method ?? '—' },
    {
      k: 'fullText.charCount',
      v: paper.fullText.charCount !== null ? paper.fullText.charCount.toLocaleString() : '0',
    },
    { k: 'storage.kind', v: paper.storage.kind },
    { k: 'storage.sizeBytes', v: humanBytes(paper.storage.sizeBytes) },
    { k: 'storage.contentType', v: paper.storage.contentType ?? '—' },
    { k: 'storage.sha256', v: paper.storage.sha256 ?? '—' },
  ];

  return (
    <main className="detail">
      <Link href="/papers" className="detail__back">
        ← Back to papers
      </Link>

      <div className="eyebrow detail__topic">Paper · {primaryTopic}</div>
      <h1 className="detail__title">{paper.title || 'Untitled'}</h1>
      <div className="detail__authors">{authorsFull}</div>
      {venueLine ? <div className="detail__venue">{venueLine}</div> : null}
      <div className="detail__uid">{paper.paperUid}</div>

      <div className="detail__facts">
        <FactChip label={paper.oa.status} color={oaColor(paper.oa.status)} />
        <FactChip label={paper.retrievability} color={retrievabilityColor(paper.retrievability)} />
        {paper.workType ? (
          <FactChip label={paper.workType} color={workTypeColor(paper.workType)} />
        ) : null}
        <FactChip label={paper.status} color={statusColor(paper.status)} />
        {citedBy !== null ? (
          <FactChip label={`cited ${citedBy.toLocaleString()}`} color="var(--accent-3)" />
        ) : null}
      </div>

      {paper.abstract ? <CollapsibleAbstract text={paper.abstract} /> : null}

      <div className="detail__grid2">
        {/* Identifiers */}
        <div className="detail__section">
          <div className="eyebrow panel__label">Identifiers</div>
          {identifiers.length > 0 ? (
            identifiers.map(({ kind, value }) => {
              const href = idHref(kind, value);
              return (
                <div key={kind} className="idrow">
                  <span className="idrow__label">{ID_LABELS[kind] ?? kind}</span>
                  {href ? (
                    <a className="idrow__value" href={href} target="_blank" rel="noopener noreferrer">
                      {value}
                    </a>
                  ) : (
                    <span className="idrow__value">{value}</span>
                  )}
                </div>
              );
            })
          ) : (
            <p className="prov__sub" style={{ margin: 0 }}>
              No external identifiers recorded.
            </p>
          )}
        </div>

        {/* Open access */}
        <div className="detail__section oacol">
          <div className="eyebrow panel__label">Open access</div>
          <div className="oacol__rows">
            <div className="oacol__row">
              <span className="oacol__k">Status</span>
              <span className="oacol__v">{paper.oa.status}</span>
            </div>
            <div className="oacol__row">
              <span className="oacol__k">License</span>
              <span className="oacol__v oacol__v--mono">{paper.oa.license ?? '—'}</span>
            </div>
            <div className="oacol__row">
              <span className="oacol__k">Version</span>
              <span className="oacol__v">{paper.oa.version ?? '—'}</span>
            </div>
          </div>
          {paper.oa.bestOaUrl ? (
            <a className="oalink" href={paper.oa.bestOaUrl} target="_blank" rel="noopener noreferrer">
              Open-access copy ↗
            </a>
          ) : (
            <span className="oacol__k" style={{ marginTop: 'auto' }}>
              No open-access copy located.
            </span>
          )}
        </div>
      </div>

      {/* Topics & concepts */}
      {allTags.length > 0 ? (
        <div className="detail__section">
          <div className="eyebrow panel__label">Topics &amp; concepts</div>
          <div className="tagwrap">
            {allTags.map((t) => (
              <span key={t} className="tagpill">
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pipeline & provenance */}
      <div className="detail__section prov">
        <div className="eyebrow panel__label" style={{ color: 'var(--accent-4)', marginBottom: 6 }}>
          Pipeline &amp; provenance
        </div>
        <div className="prov__sub">How this record moved through ingestion</div>
        <div className="prov__grid">
          {provenance.map((r) => (
            <div key={r.k} className="prov__row">
              <span className="prov__k">{r.k}</span>
              <span className="prov__v">{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {paper.errors.length > 0 ? (
        <div className="errbox">
          <div className="eyebrow panel__label" style={{ color: 'var(--text-secondary)' }}>
            Errors
          </div>
          <div className="errbox__list">
            {paper.errors.map((e, i) => (
              <div key={i} className="errbox__row">
                <span className="errbox__stage">{paper.status}</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
