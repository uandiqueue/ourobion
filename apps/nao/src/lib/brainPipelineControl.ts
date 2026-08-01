import { METRICS } from '../../../../shared/metrics/registry.ts';

export const BRAIN_PIPELINE_METRICS = Object.freeze(
  METRICS
    .filter((metric) => metric.status === 'active')
    .map((metric) => ({ key: metric.key, label: metric.ui?.label ?? metric.key })),
);

export const BRAIN_PIPELINE_CORPORA = Object.freeze([
  'tools/brain-ingest/fixtures/verify-corpus.jsonl',
] as const);

const ALLOWED_KEYS = new Set(BRAIN_PIPELINE_METRICS.map((metric) => metric.key));
const BODY_KEYS = new Set([
  'pair',
  'papers',
  'artifactRevision',
  'corpus',
  'dryRun',
  'confirmSpend',
]);
const PAPER_UID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const ARTIFACT_REVISION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface BrainPipelineRequest {
  pair: readonly [string, string];
  papers: readonly string[];
  artifactRevision: string;
  corpus: (typeof BRAIN_PIPELINE_CORPORA)[number] | '';
  dryRun: boolean;
  confirmSpend: '' | 'RUN';
}

export interface BrainPipelineWorkflowInputs {
  pair: string;
  papers: string;
  artifact_revision: string;
  corpus: string;
  dry_run: boolean;
  confirm_spend: string;
}

export type BrainPipelineParseResult =
  | { ok: true; value: BrainPipelineRequest; workflowInputs: BrainPipelineWorkflowInputs }
  | { ok: false; error: string };

function stringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.every((part) => typeof part === 'string')
      ? value.map((part) => part.trim()).filter(Boolean)
      : null;
  }
  if (typeof value !== 'string') return null;
  return value.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);
}

/** Fail-closed parser for POST /api/brain-pipeline. */
export function parseBrainPipelineRequest(body: unknown): BrainPipelineParseResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const value = body as Record<string, unknown>;
  const unknown = Object.keys(value).filter((key) => !BODY_KEYS.has(key));
  if (unknown.length > 0) return { ok: false, error: `unknown field: ${unknown[0]}` };

  const pair = stringList(value.pair);
  if (pair === null || pair.length !== 2) {
    return { ok: false, error: 'pair must contain exactly two metric keys' };
  }
  if (pair[0] === pair[1]) return { ok: false, error: 'pair metric keys must be different' };
  if (!pair.every((key) => ALLOWED_KEYS.has(key))) {
    return { ok: false, error: 'pair contains a metric outside the active registry' };
  }

  const papers = stringList(value.papers);
  if (papers === null || papers.length < 1 || papers.length > 20) {
    return { ok: false, error: 'papers must contain between 1 and 20 paper UIDs' };
  }
  if (new Set(papers).size !== papers.length) {
    return { ok: false, error: 'papers must not contain duplicate UIDs' };
  }
  if (!papers.every((paper) => PAPER_UID.test(paper))) {
    return { ok: false, error: 'papers contains an unsupported UID' };
  }

  const artifactRevision = typeof value.artifactRevision === 'string'
    ? value.artifactRevision.trim()
    : '';
  if (!ARTIFACT_REVISION.test(artifactRevision)) {
    return {
      ok: false,
      error: 'artifactRevision is required and must use letters, numbers, dot, underscore, or hyphen',
    };
  }

  if (value.dryRun !== undefined && typeof value.dryRun !== 'boolean') {
    return { ok: false, error: 'dryRun must be a boolean' };
  }
  const dryRun = value.dryRun !== false;
  const corpus = typeof value.corpus === 'string' ? value.corpus.trim() : '';
  if (corpus !== '' && !(BRAIN_PIPELINE_CORPORA as readonly string[]).includes(corpus)) {
    return { ok: false, error: 'corpus must be an approved repository corpus' };
  }
  if (!dryRun && corpus === '') {
    return { ok: false, error: 'a live run requires a non-empty approved corpus' };
  }

  const confirmSpend = typeof value.confirmSpend === 'string' ? value.confirmSpend : '';
  if (dryRun && confirmSpend !== '') {
    return { ok: false, error: 'dry runs must not include a spend confirmation' };
  }
  if (!dryRun && confirmSpend !== 'RUN') {
    return { ok: false, error: 'a live run requires the exact confirmation RUN' };
  }

  const parsed: BrainPipelineRequest = {
    pair: [pair[0]!, pair[1]!],
    papers,
    artifactRevision,
    corpus: corpus as BrainPipelineRequest['corpus'],
    dryRun,
    confirmSpend: confirmSpend as BrainPipelineRequest['confirmSpend'],
  };
  return {
    ok: true,
    value: parsed,
    workflowInputs: {
      pair: parsed.pair.join(','),
      papers: parsed.papers.join(','),
      artifact_revision: parsed.artifactRevision,
      corpus: parsed.corpus,
      dry_run: parsed.dryRun,
      confirm_spend: parsed.confirmSpend,
    },
  };
}
