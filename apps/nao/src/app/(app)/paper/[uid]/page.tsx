// ourobion nao — per-paper detail (v1).
//
// Server component. Reads the FULL PaperRecord metadata from R2 via the native
// CORPUS binding (getPaperMeta): bibliographic header, OA {status,license,
// version,bestOaUrl}, journal, citation count, every identifier, topics +
// concepts, and the pipeline/provenance record (discovery → fetch → extraction →
// storage). All FACTS that mirror the ingestion pipeline — no quality/rating.
//
// TWO SOURCES, NOT EQUIVALENT. The corpus object is the full record. When it is
// not reachable — the local `next dev` R2 simulator holds no objects, so under
// dev it never is (apps/nao/README.md) — the page falls back to the D1 index row
// rather than answering 404. A bare 404 on a paper the /papers list had just
// shown reads as "no such paper", which is false: the record exists, its stored
// metadata object is simply out of reach here. The fallback is rendered as a
// visibly REDUCED record and names the nine fields D1 has no column for
// (lib/paperDetail.ts D1_UNAVAILABLE_FIELDS) instead of rendering them blank.
// A uid missing from D1 too is genuinely unknown, and still 404s.
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
import { getPaperDetailRow, type PaperDetailRow } from '@/lib/d1';
import {
  D1_UNAVAILABLE_FIELDS,
  indexRowFacts,
  indexRowIdentifiers,
  indexRowTags,
} from '@/lib/paperDetail';
import { CollapsibleAbstract } from '@/components/CollapsibleAbstract';
import { ClaimsPanel } from '@/components/ClaimsPanel';
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
  if (paper !== null) return <CorpusRecordDetail paper={paper} />;

  // The corpus object is out of reach. The index row is thinner, so it is
  // rendered as a reduced record, never as the full one.
  const row = await getPaperDetailRow(decoded);
  if (row === null) notFound();
  return <IndexRowDetail row={row} />;
}

function CorpusRecordDetail({ paper }: { paper: PaperRecord }) {
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
      <div className="detail__source">Full stored record, read from the corpus object.</div>

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

      {/* Claims & verdicts — O13 curation (run-2 U9): claims whose citations include this
          paper (jsonb containment via /api/claims?paper=), their interim verifier verdicts
          (TEST-MODE stamped) and the human REJECT action. */}
      <div className="detail__section">
        <div className="eyebrow panel__label" style={{ marginBottom: 6 }}>
          Claims &amp; verdicts
        </div>
        <ClaimsPanel paperUid={paper.paperUid} />
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

/**
 * The reduced record: everything the D1 index row genuinely holds, and an explicit
 * statement of what it does not. Deliberately NOT laid out to look like
 * CorpusRecordDetail — the Open access block and the four provenance rows D1 has
 * no column for are omitted outright rather than rendered as em dashes, because
 * an em dash here would claim "recorded as absent" when the truth is "never
 * carried in this source".
 */
function IndexRowDetail({ row }: { row: PaperDetailRow }) {
  const authorsFull = row.authors.length > 0 ? row.authors.join(', ') : 'Unknown authors';
  const primaryTopic = row.topicTags[0] ?? row.workType ?? 'record';
  const venueLine = [row.year !== null ? String(row.year) : null, row.venue]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ');
  const identifiers = indexRowIdentifiers(row);
  const facts = indexRowFacts(row);
  const allTags = indexRowTags(row);

  return (
    <main className="detail">
      <Link href="/papers" className="detail__back">
        ← Back to papers
      </Link>

      <div className="eyebrow detail__topic">Paper · {primaryTopic}</div>
      <h1 className="detail__title">{row.title || 'Untitled'}</h1>
      <div className="detail__authors">{authorsFull}</div>
      {venueLine ? <div className="detail__venue">{venueLine}</div> : null}
      <div className="detail__uid">{row.paperUid}</div>

      <div className="detail__reduced" role="status">
        <div className="eyebrow panel__label">Reduced record</div>
        <p className="detail__reduced-text">
          The stored metadata object for this paper is not reachable from this environment, so what
          follows is read from the search index instead. The index is a narrower projection: it has
          no column for the fields below, so they are left out rather than shown as blank.
        </p>
        <p className="detail__reduced-fields">{D1_UNAVAILABLE_FIELDS.join(' · ')}</p>
        <p className="detail__reduced-text">
          Everything shown on this page is a stored index value. Nothing here is filled in from
          another source.
        </p>
      </div>

      <div className="detail__facts">
        <FactChip label={row.oaStatus} color={oaColor(row.oaStatus)} />
        <FactChip label={row.retrievability} color={retrievabilityColor(row.retrievability)} />
        {row.workType ? (
          <FactChip label={row.workType} color={workTypeColor(row.workType)} />
        ) : null}
        <FactChip label={row.status} color={statusColor(row.status)} />
        {row.citedByCount !== null ? (
          <FactChip label={`cited ${row.citedByCount.toLocaleString()}`} color="var(--accent-3)" />
        ) : null}
      </div>

      {row.abstract ? <CollapsibleAbstract text={row.abstract} /> : null}

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
            No DOI, PMID, or PMCID is stored in the index for this paper.
          </p>
        )}
      </div>

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

      <div className="detail__section prov">
        <div className="eyebrow panel__label" style={{ color: 'var(--accent-4)', marginBottom: 6 }}>
          Pipeline &amp; provenance
        </div>
        <div className="prov__sub">Indexed values only — the stored record carries more</div>
        <div className="prov__grid">
          {facts.map((f) => (
            <div key={f.key} className="prov__row">
              <span className="prov__k">{f.key}</span>
              <span className="prov__v">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Claims read Supabase, not the corpus object, so they are unaffected. */}
      <div className="detail__section">
        <div className="eyebrow panel__label" style={{ marginBottom: 6 }}>
          Claims &amp; verdicts
        </div>
        <ClaimsPanel paperUid={row.paperUid} />
      </div>
    </main>
  );
}
