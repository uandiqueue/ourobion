import { METRICS } from '../../../../shared/metrics/registry.ts';

export const BRAIN_PIPELINE_METRICS = Object.freeze(
  METRICS
    .filter((metric) => metric.status === 'active')
    .map((metric) => ({ key: metric.key, label: metric.ui?.label ?? metric.key })),
);

const ALLOWED_KEYS = new Set(BRAIN_PIPELINE_METRICS.map((metric) => metric.key));
const BODY_KEYS = new Set([
  'pair',
  'papers',
  'artifactRevision',
  'dryRun',
  'confirmSpend',
]);
const PAPER_UID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const ARTIFACT_REVISION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface BrainPipelineRequest {
  pair: readonly [string, string];
  papers: readonly string[];
  artifactRevision: string;
  dryRun: boolean;
  confirmSpend: '' | 'RUN';
}

/**
 * The operation this control surface dispatches. `brain-pipeline.yml` declares
 * `operation` as a REQUIRED choice input, and GitHub rejects a
 * `workflow_dispatch` that omits a required input — so it has to be sent.
 *
 * It is pinned to `full` because that is the only operation this form can
 * express: the workflow's `project-only` branch demands exact 64-hex SHA-256
 * digests for the three R2 edge artifacts, and nao collects papers and an
 * artifact revision instead. The workflow keeps `default: project-only`, so the
 * no-spend projection remains the default for every other dispatcher and for a
 * manual run from the Actions tab. The `full` path is still fail-closed here:
 * `dry_run` defaults to true and a live run needs the exact `confirm_spend: RUN`.
 * The workflow builds its verifier corpus from the hydrated real manifest and
 * excludes cited paper ids; callers cannot substitute a fixture or arbitrary path.
 */
export const BRAIN_PIPELINE_OPERATION = 'full';

export interface BrainPipelineWorkflowInputs {
  operation: typeof BRAIN_PIPELINE_OPERATION;
  papers: string;
  artifact_revision: string;
  authorization_operation_id: string;
  dry_run: boolean;
  confirm_spend: string;
}

export interface BrainPipelineRun {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
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
    dryRun,
    confirmSpend: confirmSpend as BrainPipelineRequest['confirmSpend'],
  };
  return {
    ok: true,
    value: parsed,
    workflowInputs: {
      operation: BRAIN_PIPELINE_OPERATION,
      // `pair` is deliberately absent: brain-pipeline.yml declares no such
      // input, and GitHub 422s a dispatch carrying an undeclared one. The
      // chosen metric pair is still recorded on the control-audit event.
      papers: parsed.papers.join(','),
      artifact_revision: parsed.artifactRevision,
      // The route replaces this with the already-validated control operation id.
      // Keeping the key here makes the workflow_dispatch contract exact while
      // preventing request-body spoofing (authorization_operation_id is not a BODY_KEY).
      authorization_operation_id: '',
      dry_run: parsed.dryRun,
      confirm_spend: parsed.confirmSpend,
    },
  };
}
