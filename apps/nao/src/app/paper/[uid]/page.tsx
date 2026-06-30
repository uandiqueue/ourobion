// ourobion nao — per-paper detail (v1).
//
// Server component. Reads the FULL PaperRecord metadata from R2 via the native
// CORPUS binding (getPaperMeta) — title, authors, venue, year, abstract, OA
// {status,license,bestOaUrl}, journal/publisher/ISSN, citation count, every
// identifier, topic tags, concepts — and a link OUT to bestOaUrl.
//
// HARD RULE (NAO-DESIGN §6/§9): this page NEVER fetches or renders full paper
// text (text/<uid>.txt). Only the metadata record is read.
//
// MUST be dynamic: touches the R2 binding via getCloudflareContext(); force-dynamic
// keeps `next build` from executing the binding at build time.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PaperRecord } from '@/lib/types';
import { getPaperMeta } from '@/lib/r2';
import { EyebrowLabel } from '@/components/EyebrowLabel';
import { QualityBadge } from '@/components/QualityBadge';

export const dynamic = 'force-dynamic';

type Params = { uid: string };

export const metadata: Metadata = {
  title: 'Paper · ourobion nao',
};

/** Human label for an identifier kind. */
const ID_LABELS: Record<string, string> = {
  doi: 'DOI',
  pmid: 'PMID',
  pmcid: 'PMCID',
  arxiv: 'arXiv',
  openalex: 'OpenAlex',
  s2: 'Semantic Scholar',
};

/** Build a resolvable URL for an identifier where one exists; else null. */
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

/** Render a definition-list row only when there is a value to show. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { uid } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(uid);
  } catch {
    // Malformed percent-encoding (e.g. /paper/%) → 404, not an unhandled 500.
    notFound();
  }
  const paper: PaperRecord | null = await getPaperMeta(decoded);

  if (paper === null) {
    notFound();
  }

  const authors = paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown authors';
  const citedBy = paper.metrics?.citedByCount ?? null;
  const issn = paper.journal?.issn?.filter((s) => s.length > 0) ?? [];
  const identifiers = Object.entries(paper.identifiers).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );

  return (
    <main className="detail">
      <Link href="/" className="detail__back">
        ← Back to corpus
      </Link>

      <EyebrowLabel>Paper · {paper.workType ?? 'record'}</EyebrowLabel>
      <h1 className="detail__title">{paper.title || 'Untitled'}</h1>
      <p className="detail__authors">{authors}</p>

      <div className="detail__meta-row">
        <QualityBadge oaStatus={paper.oa.status} />
        {paper.year !== null ? <span className="chip">{paper.year}</span> : null}
        {paper.venue ? <span className="chip">{paper.venue}</span> : null}
        {citedBy !== null ? (
          <span className="chip chip--metric">{citedBy.toLocaleString()} citations</span>
        ) : null}
      </div>

      {paper.oa.bestOaUrl ? (
        <a
          className="detail__oa-link"
          href={paper.oa.bestOaUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open access version ↗
        </a>
      ) : null}

      {paper.abstract ? (
        <section className="detail__section">
          <h2>Abstract</h2>
          <p className="detail__abstract">{paper.abstract}</p>
        </section>
      ) : null}

      <section className="detail__section">
        <h2>Metadata</h2>
        <dl className="detail__dl">
          <Row label="Venue">{paper.venue}</Row>
          <Row label="Year">{paper.year}</Row>
          <Row label="Work type">{paper.workType}</Row>
          <Row label="Publisher">{paper.journal?.publisher}</Row>
          <Row label="Journal type">{paper.journal?.type}</Row>
          <Row label="ISSN">{issn.length > 0 ? issn.join(', ') : null}</Row>
          <Row label="OA status">{paper.oa.status}</Row>
          <Row label="OA license">{paper.oa.license}</Row>
          <Row label="OA version">{paper.oa.version}</Row>
          <Row label="Retrievability">{paper.retrievability}</Row>
          <Row label="Citations">{citedBy !== null ? citedBy.toLocaleString() : null}</Row>
          <Row label="Citations as-of">{paper.metrics?.asOf ?? null}</Row>
          <Row label="Discovered via">{paper.discoveredVia}</Row>
          <Row label="Corpus UID">{paper.paperUid}</Row>
        </dl>
      </section>

      {identifiers.length > 0 ? (
        <section className="detail__section">
          <h2>Identifiers</h2>
          <dl className="detail__dl">
            {identifiers.map(([kind, value]) => {
              const href = idHref(kind, value);
              return (
                <Row key={kind} label={ID_LABELS[kind] ?? kind}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </Row>
              );
            })}
          </dl>
        </section>
      ) : null}

      {paper.topicTags.length > 0 ? (
        <section className="detail__section">
          <h2>Topic tags</h2>
          <div className="detail__tags">
            {paper.topicTags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {paper.concepts && paper.concepts.length > 0 ? (
        <section className="detail__section">
          <h2>Concepts</h2>
          <div className="detail__tags">
            {paper.concepts.map((c) => (
              <span key={c} className="chip chip--muted">
                {c}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
